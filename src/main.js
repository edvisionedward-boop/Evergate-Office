import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildOffice } from './scene.js';
import SEED from '../public/data.json';

const qs = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = 'Asia/Kuala_Lumpur';
const fmtTime = (iso) => {
  const d = new Date(iso); if (isNaN(d)) return esc(iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat('zh-CN', { timeZone: TZ, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map(x => [x.type, x.value]));
  return `${p.month}-${p.day} ${p.hour}:${p.minute}`;
};
const ST_LABEL = { busy: '忙碌', confirm: '等你确认', idle: '空闲', doing: '进行中', done: '已完成' };

let DATA = SEED, DATA_SRC = 'embedded';
const state = { status: {}, selected: null, staffId: null, dirMode: 'status', boardMode: 'tasks', clock: { mode: 'auto', day: 1, offDuty: false, meeting: false } };

/* ---------- renderer ---------- */
const isMobile = matchMedia('(max-width: 760px)').matches || /iPhone|iPad|Android/i.test(navigator.userAgent);
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#d5e2ee');
scene.fog = new THREE.Fog('#c9d5e2', 78, 220);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 300);
const labelRenderer = new CSS2DRenderer({ element: $('#labels') });

/* lights */
const hemi = new THREE.HemisphereLight('#fff4e4', '#3d3428', 0.72); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff6ea', 1.55);
sun.position.set(-18, 34, 16); sun.castShadow = true;
sun.shadow.mapSize.set(isMobile ? 512 : 1024, isMobile ? 512 : 1024);
Object.assign(sun.shadow.camera, { left: -40, right: 34, top: 28, bottom: -28, near: 8, far: 96 });
sun.shadow.bias = -0.00045; sun.shadow.normalBias = 0.035; sun.shadow.radius = isMobile ? 2 : 3.2;
scene.add(sun);
const fill = new THREE.DirectionalLight('#ffd8b0', 0.28); fill.position.set(22, 10, 14); scene.add(fill);

/* office */
const office = buildOffice(scene, DATA.teams);

/* controls */
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 9; controls.maxDistance = 120;
controls.minPolarAngle = 0.3; controls.maxPolarAngle = 1.22;
controls.screenSpacePanning = false;
controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.9; controls.panSpeed = 0.9;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
const HOME_DIR = new THREE.Vector3(0.82, 1.05, 1).normalize();

function homeDistance() {
  const R = 46, vf = THREE.MathUtils.degToRad(camera.fov) / 2;
  const hf = Math.atan(Math.tan(vf) * camera.aspect);
  const d = Math.max(R * 0.78 / Math.tan(vf), R * 1.05 / Math.tan(hf));
  return camera.aspect < 0.8 ? d * 0.72 : d;
}
let tween = null;
function flyTo(target, dist, dir, dur = 0.9) {
  const curDir = camera.position.clone().sub(controls.target).normalize();
  tween = { t: 0, dur, fromT: controls.target.clone(), toT: target.clone(), fromP: camera.position.clone(),
    toP: target.clone().add((dir ?? curDir).clone().multiplyScalar(dist)) };
}
function goHome(anim = true) {
  const tgt = camera.aspect < 0.8 ? new THREE.Vector3(1.6, 0, 3.2) : new THREE.Vector3(0, 0, 1.5);
  if (anim) flyTo(tgt, homeDistance(), HOME_DIR);
  else { controls.target.copy(tgt); camera.position.copy(tgt).add(HOME_DIR.clone().multiplyScalar(homeDistance())); }
}

/* post */
let composer = null, bloom = null;
const useBloom = qs.get('bloom') !== '0';
function setupComposer() {
  if (!useBloom) return;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.28, 0.45, 1.3);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
setupComposer();

/* Canvas CSS box, not window.innerWidth/Height. On iPad Safari those diverge
   after rotation, toolbar show/hide, and visualViewport changes, and the
   CSS2D layer (anchored top-left) then slides off the WebGL image. */
let viewW = 0, viewH = 0, viewPR = 0, viewReady = false;
function syncView() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  if (w < 2 || h < 2) return false;
  if (w === viewW && h === viewH && pr === viewPR) return true;
  viewW = w; viewH = h; viewPR = pr;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2); }
  if (!viewReady) { viewReady = true; goHome(false); }
  return true;
}
const viewBox = canvas.parentElement || canvas;
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => syncView()).observe(viewBox);
window.addEventListener('resize', syncView);
window.addEventListener('orientationchange', syncView);
if (window.visualViewport) {
  visualViewport.addEventListener('resize', syncView);
  visualViewport.addEventListener('scroll', syncView);
}
syncView();

/* ---------- picking ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const hits = Object.values(office.rooms).map(r => r.hit);
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; tween = null; });
canvas.addEventListener('pointerup', e => {
  if (!down || e.pointerId !== down.id) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
  if (moved > 8 || dt > 450) return;
  const rect = canvas.getBoundingClientRect();
  const rw = rect.width || canvas.clientWidth, rh = rect.height || canvas.clientHeight;
  ndc.set((e.clientX - rect.left) / rw * 2 - 1, -((e.clientY - rect.top) / rh) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const people = [];
  for (const R of Object.values(office.rooms)) {
    for (const a of R.agents || []) people.push(a);
    if (R.boss) people.push(R.boss);
    if (R.guard) people.push(R.guard);
  }
  const person = ray.intersectObjects(people, true)[0];
  const roomHit = ray.intersectObjects(hits, false)[0];
  const groundHit = office.ground ? ray.intersectObjects([office.ground], false)[0] : null;
  const roomInFront = roomHit && (!groundHit || roomHit.distance < groundHit.distance - 0.05);
  let who = null;
  if (person && (!roomHit || person.distance <= roomHit.distance + 0.35)) {
    let o = person.object;
    while (o && !o.userData.room) o = o.parent;
    who = o?.userData;
  }
  if (who?.room) selectRoom(who.room, null, who.staffId);
  else if (roomInFront) selectRoom(roomHit.object.userData.room);
  else closePanel();
});
$('#labels').addEventListener('click', e => {
  const tag = e.target.closest('.ptag');
  if (tag) { selectRoom(tag.dataset.room, null, tag.dataset.staff); return; }
  const el = e.target.closest('.rlabel');
  if (el) selectRoom(el.dataset.room);
});

/* ---------- UI ---------- */
const teamOf = (id) => DATA.teams.find(t => t.id === id);
const MINOR = {};

function reflectDoingStatus() {
  for (const t of DATA.teams || []) {
    if (t.private) continue;
    const doing = (DATA.tasks || []).filter(x => x.team === t.id && x.status === 'doing');
    if (!doing.length) continue;
    t.status = 'busy';
    t.statusNote = '忙碌';
    if (!t.currentTask) t.currentTask = doing[0].title;
  }
}
function applyData() {
  reflectDoingStatus();
  for (const t of DATA.teams) state.status[t.id] = t.status;
  // labels
  for (const R of Object.values(office.rooms)) {
    const t = teamOf(R.id); const el = R.labelEl;
    el.classList.toggle('sel', state.selected === R.id);
    if (!t) continue;
    el.querySelector('.nm').textContent = t.name;
    const gb = el.querySelector('.nmrow .gbadge');
    if (gb) {
      if (t.private) gb.hidden = true;
      else { gb.hidden = false; paintScoreEl(gb, t.score); }
    }
    for (const a of [R.boss, ...(R.agents || [])].filter(Boolean)) {
      const s = (t.staff || []).find(x => x.id === a.userData.staffId);
      const nm = a.userData.badgeEl?.querySelector('.pnn') || a.userData.badgeEl?.querySelector('.pn');
      const bar = a.userData.badgeEl?.querySelector('.wbar');
      if (nm && s) nm.textContent = t.private ? '私密' : t.id === 'ed' ? 'ED' : (s.chip || s.name);
      if (bar && s) paintWorkBar(bar, s);
    }
    const lbl = t.statusNote || DATA.statusLabels?.[t.status] || ST_LABEL[t.status];
    const st = el.querySelector('.st');
    st.innerHTML = `<i class="dot ${esc(t.status)}"></i><span>${esc(lbl)}${t.private ? ' · 私密' : ` · ${t.agents ?? 0} 位成员`}</span>`;
  }
  const cnt = { busy: 0, confirm: 0, idle: 0 };
  DATA.teams.forEach(t => cnt[t.status] = (cnt[t.status] || 0) + 1);
  const pend = DATA.tasks.filter(x => x.status === 'confirm').length;
  $('#confirmBadge').textContent = pend; $('#confirmBadge').style.display = pend ? '' : 'none';
  $('#summary').innerHTML = `<span class="pill"><i class="dot busy"></i>${cnt.busy} 忙碌</span><span class="pill"><i class="dot confirm"></i>${pend} 项等你确认</span><span class="pill teams">${DATA.teams.length} 个团队</span>`;
  $('#updated').textContent = '';
  paintFooter();
  $('#company').textContent = DATA.office?.company ?? 'EVERGATE HOLDING SDN BHD';
  if (office.setNews) office.setNews(DATA.news);
  renderQuick();
  renderBoard();
  renderDirectory();
  paintShiftLabels();
  if (state.selected && !$('#panel').classList.contains('hidden')) renderPanel(state.selected);
}

function chip(s) { return `<span class="chip ${s === 'doing' ? 'busy' : esc(s)}">${esc(ST_LABEL[s] ?? s)}</span>`; }

function scoreTone(score) {
  if (score == null || score === '') return 'pending';
  const n = Number(score);
  if (!Number.isFinite(n)) return 'pending';
  if (n >= 90) return 'gold';
  if (n >= 75) return 'orange';
  if (n >= 60) return 'silver';
  return 'gray';
}
function scorePct(score) {
  if (scoreTone(score) === 'pending') return 0;
  return Math.max(0, Math.min(100, Math.round(Number(score))));
}
function paintScoreEl(el, score) {
  const tone = scoreTone(score);
  const pct = scorePct(score);
  el.className = 'scorebit';
  el.innerHTML = `<i class="ring r-${tone}" style="--p:${pct}"></i>${tone === 'pending' ? '' : `<b>${pct}%</b>`}`;
}
function ringHtml(score) {
  const tone = scoreTone(score);
  const pct = scorePct(score);
  return `<i class="ring r-${tone}" style="--p:${pct}"></i>${tone === 'pending' ? '' : `<b class="rpct">${pct}%</b>`}`;
}
function barHtml(score) {
  const tone = scoreTone(score);
  const pct = scorePct(score);
  const label = tone === 'pending' ? '待评' : `${pct}%`;
  return `<span class="pbar r-${tone}"><i style="width:${pct}%"></i></span><b class="rpct">${esc(label)}</b>`;
}
function workRules() {
  return DATA.workRules || {
    taskPoints: 1,
    starPoints: { 1: 1, 2: 1.5, 3: 2, 4: 2.5, 5: 3 },
    mistakePoints: -0.3,
    failurePointsByStar: { 1: -0.3, 2: -0.6, 3: -0.9, 4: -1.2, 5: -1.5 },
    consecutiveFailureMultiplier: 2,
    consecutiveFailureFrom: 2,
    hourPoints: 0.5, overtimePoints: 0.8,
    workStart: '09:00', workEnd: '18:00', workDays: [1, 2, 3, 4, 5], asymptote: 8,
    trackingStartedAt: DATA.updatedAt,
  };
}
function isSpecialTask(task) {
  return task?.kind === 'special';
}
function taskStars(task) {
  const n = Math.round(Number(task?.stars));
  return n >= 1 && n <= 5 ? n : 1;
}
function tableAmount(table, star, fallback) {
  const pts = table?.[star] ?? table?.[String(star)];
  const n = Number(pts);
  return Number.isFinite(n) ? n : fallback;
}
function taskAward(task) {
  const rules = workRules();
  const base = Number(rules.taskPoints) || 1;
  if (!isSpecialTask(task)) return base;
  const bonus = tableAmount(rules.starPoints, taskStars(task), base);
  return base + bonus;
}
function failureBase(task) {
  const rules = workRules();
  const star = taskStars(task);
  const fromTable = tableAmount(rules.failurePointsByStar, star, NaN);
  if (Number.isFinite(fromTable)) return Math.abs(fromTable);
  return Math.abs(Number(rules.mistakePoints) || 0.3);
}
function failureDeduction(staff, task) {
  const rules = workRules();
  if (!isSpecialTask(task)) return Math.abs(Number(rules.mistakePoints) || 0.3);
  const from = Number(rules.consecutiveFailureFrom) || 2;
  const mult = Number(rules.consecutiveFailureMultiplier) || 2;
  const streak = Number(staff?.consecutiveFailures) || 0;
  const factor = streak + 1 >= from ? mult : 1;
  return failureBase(task) * factor;
}
function workRuleLine() {
  const saved = workRules().summary;
  if (saved) return saved;
  return '部门完成任务后须交审查部判定达标或敷衍，由 ED 记分。部门自行标完成不加分。私人助理不参与。';
}
function klParts(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]));
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute),
    dow: DOW[parts.weekday] ?? 0,
  };
}
function klToMs(y, m, d, h, min) {
  return Date.UTC(y, m - 1, d, h - 8, min, 0);
}
function regularHoursBetween(startMs, endMs) {
  if (!(endMs > startMs)) return 0;
  const rules = workRules();
  const days = new Set(rules.workDays || [1, 2, 3, 4, 5]);
  const openM = hm(rules.workStart || '09:00');
  const closeM = hm(rules.workEnd || '18:00');
  let total = 0;
  let dayMs = klToMs(klParts(new Date(startMs)).year, klParts(new Date(startMs)).month, klParts(new Date(startMs)).day, 0, 0);
  for (let i = 0; i < 800 && dayMs < endMs + 86400000; i++) {
    const p = klParts(new Date(dayMs + 12 * 3600000));
    if (days.has(p.dow)) {
      const win0 = klToMs(p.year, p.month, p.day, Math.floor(openM / 60), openM % 60);
      const win1 = klToMs(p.year, p.month, p.day, Math.floor(closeM / 60), closeM % 60);
      const a = Math.max(win0, startMs);
      const b = Math.min(win1, endMs);
      if (b > a) total += (b - a) / 3600000;
    }
    dayMs += 86400000;
  }
  return total;
}
function fmtScore(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v.toFixed(2);
}
function homeTeam(s) {
  if (!s?.id) return null;
  return (DATA.teams || []).find(t => (t.staff || []).some(x => x.id === s.id)) || null;
}
function workBarOff(s, team) {
  const home = team || homeTeam(s);
  if (s?.noWorkBar || home?.noWorkBar || home?.private) return true;
  const blocked = workRules().noWorkBarTeams || [];
  if (home?.id && blocked.includes(home.id)) return true;
  if (s?.id && blocked.includes(s.id)) return true;
  return false;
}
function scoreParts(s) {
  const rules = workRules();
  const task = Number(s?.workScore) || 0;
  const extra = Number(s?.extraPenalty) || 0;
  const otHours = Number(s?.overtimeHours) || 0;
  const overtime = otHours * (Number(rules.overtimePoints) || 0);
  const started = Date.parse(rules.trackingStartedAt || '');
  const hours = Number.isFinite(started) ? regularHoursBetween(started, Date.now()) : 0;
  const hourPts = hours * (Number(rules.hourPoints) || 0);
  // Stored workScore stays task-only (tasks, mistakes, penalties, recorded overtime).
  // Hour points are added from the clock and are not written back.
  const total = Math.round((task - extra + hourPts) * 100) / 100;
  return {
    task: Math.round(task * 100) / 100,
    extra,
    hours,
    hourPts: Math.round(hourPts * 100) / 100,
    overtime: Math.round(overtime * 100) / 100,
    total,
  };
}
function breakdownText(parts) {
  if (!parts) return '';
  return `任务分 ${fmtScore(parts.task)} · 工时分 ${fmtScore(parts.hourPts)} · 加班 ${fmtScore(parts.overtime)}`;
}
function displayedScore(s) {
  if (workBarOff(s)) return null;
  return scoreParts(s).total;
}
const ACT = {
  desk: ['忙碌', 'st-busy'],
  meeting: ['开会中', 'st-meet'],
  report: ['汇报中', 'st-report'],
  errand: ['交接任务', 'st-errand'],
  coffee: ['喝咖啡', 'st-coffee'],
  rest: ['休息', 'st-rest'],
  off: ['下班', 'st-off'],
};
function debugNow() {
  const q = qs.get('now');
  if (!q) return null;
  const d = new Date(q);
  return Number.isNaN(d.getTime()) ? null : d;
}
function isWorkingHours(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]));
  const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday] ?? 0;
  const mins = Number(parts.hour) * 60 + Number(parts.minute);
  return dow >= 1 && dow <= 5 && mins >= 9 * 60 && mins < 18 * 60;
}
function activityOf(id) {
  if (!state.clock.working) return 'off';
  if (!office?.rooms) return 'desk';
  for (const R of Object.values(office.rooms)) {
    for (const a of [R.boss, ...(R.agents || [])].filter(Boolean)) {
      if (a.userData?.staffId === id) return a.userData.activity || 'desk';
    }
  }
  return 'desk';
}
function statusBadgeHtml(s) {
  if (!s || s.id === 'privfin-1' || workBarOff(s) && homeTeam(s)?.private) return '';
  if (homeTeam(s)?.private) return '';
  const key = activityOf(s.id);
  const [label, cls] = ACT[key] || ACT.desk;
  return `<span class="pstat ${cls}" data-staff="${esc(s.id)}">${label}</span>`;
}
function paintStatusEl(el, key) {
  const [label, cls] = ACT[key] || ACT.desk;
  el.className = `pstat ${cls}`;
  el.textContent = label;
}
function refreshStatuses() {
  const working = !!state.clock.working;
  for (const el of document.querySelectorAll('.pstat[data-staff]')) {
    const id = el.dataset.staff;
    if (!id || id === 'privfin-1') continue;
    paintStatusEl(el, working ? activityOf(id) : 'off');
  }
}
function fillPct(score) {
  const s = Number(score) || 0;
  if (s <= 0) return 0;
  const k = Number(workRules().asymptote) || 8;
  return 100 * s / (s + k);
}
function workBarHtml(s) {
  if (workBarOff(s)) return '';
  const sc = displayedScore(s);
  return `<span class="wbar" data-staff="${esc(s.id)}"><span class="wtrack"><i class="wfill" style="width:${fillPct(sc)}%"></i></span><b class="wscore">${fmtScore(sc)}</b></span>`;
}
function workFactsHtml(s) {
  if (workBarOff(s)) return '';
  const extra = Number(s.extraPenalty) || 0;
  const penalty = extra !== 0 ? `<span>重大失职额外扣分 ${fmtScore(extra)}</span>` : '';
  return `<span class="wfacts" data-staff="${esc(s.id)}"><span class="wbreak">${breakdownText(scoreParts(s))}</span><span>已完成任务 ${s.tasksDone || 0}</span><span>失误 ${s.mistakes || 0}</span>${penalty}</span>`;
}
function paintWorkBar(el, s) {
  if (!el || !s || workBarOff(s)) return;
  const parts = scoreParts(s);
  const sc = parts.total;
  const fill = el.querySelector('.wfill');
  const num = el.querySelector('.wscore');
  if (fill) fill.style.width = `${fillPct(sc)}%`;
  if (num) num.textContent = fmtScore(sc);
  const tag = el.closest('.ptag');
  if (!tag || tag.classList.contains('guard')) return;
  let tip = tag.querySelector('.wtip');
  if (!tip) {
    tip = document.createElement('span');
    tip.className = 'wtip';
    tag.appendChild(tip);
  }
  tip.textContent = breakdownText(parts);
}
const staffById = new Map();
function indexStaff() {
  staffById.clear();
  for (const t of DATA.teams || []) for (const s of t.staff || []) staffById.set(s.id, s);
}
function refreshWorkBars() {
  indexStaff();
  for (const el of document.querySelectorAll('.wbar[data-staff]')) {
    const s = staffById.get(el.dataset.staff);
    if (s && !workBarOff(s)) paintWorkBar(el, s);
  }
  for (const el of document.querySelectorAll('.wfacts[data-staff]')) {
    const s = staffById.get(el.dataset.staff);
    const line = el.querySelector('.wbreak');
    if (s && line && !workBarOff(s)) line.textContent = breakdownText(scoreParts(s));
  }
  refreshStatuses();
}
function teamUpdatedAt(t) {
  const times = (DATA.tasks || []).filter(x => x.team === t.id).map(x => x.updatedAt).filter(Boolean);
  times.sort((a, b) => new Date(b) - new Date(a));
  return times[0] || DATA.updatedAt || '';
}

function renderPanel(id) {
  const t = teamOf(id); const body = $('#panelBody');
  if (id === 'archive') {
    const A = DATA.archive || {};
    const link = A.folderUrl ? `<a class="drivebtn" href="${esc(A.folderUrl)}" target="_blank" rel="noopener noreferrer">在 Google Drive 打开</a>` : '';
    const catList = (cats) => (cats || []).map(c => `<div class="sec"><h4>${esc(c.name)}</h4><div class="card tlist">${(c.items || []).map(item => `<div class="titem"><span>${esc(item)}</span></div>`).join('') || '<div class="empty">暂无</div>'}</div></div>`).join('');
    if (A.lobby || A.general || A.confidential) {
      const lobby = A.lobby || {};
      const guard = lobby.security || {};
      const general = A.general || {};
      const secret = A.confidential || {};
      const logs = Array.isArray(A.accessLog) ? A.accessLog : [];
      const logBody = logs.length
        ? logs.map(row => {
          const when = row.time || [row.in, row.out].filter(Boolean).join(' – ');
          const who = [row.name, row.dept || row.department || row.info].filter(Boolean).join(' · ');
          const approval = row.approval ? `<br>${esc(row.approval)}` : '';
          return `<div class="titem"><span class="chip idle">${esc(row.room || '')}</span><div><b>${esc(who)}</b><br>${esc(row.purpose || '')}<br>${esc(when)}${approval}</div></div>`;
        }).join('')
        : '<div class="empty">暂无进出记录。进出须登记姓名与信息（马来西亚时间）。</div>';
      const rule = secret.retrievalRule ? `<div class="card rule">${esc(secret.retrievalRule)}</div><div class="card">入库归档不是调取，不需要连署。</div>` : '';
      body.innerHTML = `<div class="ph" style="--c:#D0B993"><div class="ic">资</div><div><h3>${esc(A.name || '资料库')}</h3><div class="sub">客厅 · 普通文件房 · 机密文件房</div></div></div>
        <div class="sec"><h4>${esc(lobby.name || '客厅')}</h4><div class="card tlist"><div class="titem"><span class="chip confirm">${esc(guard.name || '保安')}</span><div>${esc(guard.duty || '24小时值守')}</div></div></div></div>
        <div class="sec"><h4>${esc(general.name || '普通文件房')}</h4><div class="card">${esc(general.description || '')}</div></div>
        ${catList(general.categories)}
        <div class="sec"><h4>${esc(secret.name || '机密文件房')}</h4><div class="card">${esc(secret.description || '')}</div>${rule}</div>
        ${catList(secret.categories)}
        <div class="sec"><h4>进出登记</h4><div class="card tlist">${logBody}</div></div>
        <div class="sec">${link}</div>`;
      return;
    }
    const cats = catList(A.categories);
    body.innerHTML = `<div class="ph" style="--c:#D0B993"><div class="ic">资</div><div><h3>${esc(A.name || '资料库')}</h3><div class="sub">分类目录 · 需登录 Google 查看原件</div></div></div>${cats}<div class="sec">${link}</div>`;
    return;
  }
  if (id === 'meeting') {
    const rows = (DATA.meetings || []).map(m => `<div class="titem"><span class="chip ${meetingActive(m, klNow()) ? 'busy' : 'idle'}">${meetingActive(m, klNow()) ? '进行中' : '安排'}</span><div>${esc(m.title)}</div></div>`).join('');
    body.innerHTML = `<div class="ph" style="--c:#D0B993"><div class="ic">议</div><div><h3>会议室</h3><div class="sub">${esc(nextMeetingText(klNow()))}</div></div></div><div class="sec"><h4>议程</h4><div class="card tlist">${rows || '<div class="empty">暂无会议</div>'}</div></div>`;
    return;
  }
  if (id === 'news') {
    const rows = (DATA.news || []).map(n => `<div class="titem"><span class="chip idle">${esc(fmtTime(n.time))}</span><div>${esc(n.title)}</div></div>`).join('');
    body.innerHTML = `<div class="ph" style="--c:#D0B993"><div class="ic">讯</div><div><h3>大厅新闻墙</h3><div class="sub">信息部简报</div></div></div><div class="sec"><h4>滚动标题</h4><div class="card tlist">${rows || '<div class="empty">暂无</div>'}</div></div>`;
    return;
  }
  if (id === 'showroom') {
    body.innerHTML = `<div class="ph" style="--c:#D0B993"><div class="ic">展</div><div><h3>品牌展厅</h3><div class="sub">右翼展陈占位 · 非部门</div></div></div><div class="sec"><div class="card empty">展位已留出，陈列内容稍后接入。</div></div>`;
    return;
  }
  if (id === 'lounge') {
    const L = DATA.lounge || {};
    const n = office.rooms.lounge?.occupancy ?? 0;
    const note = L.lastMeeting ? `<div class="sec"><h4>最新纪要</h4><div class="card"><div class="cur">${esc(L.lastMeeting)}</div></div></div>` : '';
    const pantry = L.pantry ? `<div class="sec"><div class="card"><div class="cur">${esc(L.pantry)}</div></div></div>` : '';
    body.innerHTML = `<div class="ph" style="--c:#E87708"><div class="ic">休</div><div><h3>${esc(L.name || '休息室')}</h3><div class="sub">跨部门交流区 · 每周一 9:00 例会</div></div></div>` +
      pantry +
      `<div class="sec"><h4>例会</h4><div class="card"><div class="cur">${esc(L.meeting || '每周一 9:00 跨部门例会')}</div></div></div>` +
      note +
      `<div class="sec"><div class="card empty">当前 ${n} 人在休息室</div></div>`;
    return;
  }
  if (id === 'vacant') {
    body.innerHTML = `<div class="ph" style="--c:#D0B993"><div class="ic">空</div><div><h3>空置</h3><div class="sub">空办公室 · 暂未分配部门</div></div></div><div class="sec"><div class="card empty">这间房暂时空着，还没有分配部门。</div></div>`;
    return;
  }
  if (!t) {
    const m = MINOR[id]; const c = office.rooms[id]?.def.color ?? '#D0B993';
    body.innerHTML = `<div class="ph" style="--c:${c}"><div class="ic">·</div><div><h3>${esc(m?.name ?? id)}</h3><div class="sub">公共区域</div></div></div><div class="sec"><div class="card empty">${esc(m?.text ?? '')}</div></div>`;
    return;
  }
  if (t.private) {
    const word = t.privateLabel || '私密';
    body.innerHTML = `<div class="ph" style="--c:${esc(t.color)}"><div class="ic">${esc(office.rooms[id]?.def.icon ?? '私')}</div><div><h3>${esc(t.name)}</h3></div></div><div class="sec"><div class="card private"><div>${esc(word)}</div></div></div>`;
    return;
  }
  const lbl = t.statusNote || DATA.statusLabels?.[t.status] || ST_LABEL[t.status];
  const doing = DATA.tasks.filter(x => x.team === id && x.status === 'doing');
  const doingItems = doing.length ? doing : (t.currentTask ? [{ status: 'doing', title: t.currentTask }] : []);
  const done = DATA.tasks.filter(x => x.team === id && x.status === 'done').sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 3);
  const staff = (t.staff || []).map(s => `<li class="srow${state.staffId === s.id ? ' on' : ''}" data-staff="${esc(s.id)}"><span class="sn">${esc(s.name)}${s.role ? `<span class="srole">${esc(s.role)}</span>` : ''}${statusBadgeHtml(s)}</span><span class="grow">${workBarHtml(s)}${workFactsHtml(s)}</span></li>`).join('');
  const head = `<div class="ph" style="--c:${esc(t.color)}"><div class="ic">${esc(office.rooms[id]?.def.icon ?? '')}</div><div><h3>${esc(t.name)}</h3>
    <div class="sub"><span class="chip ${esc(t.status)}"><i class="dot ${esc(t.status)}"></i>${esc(lbl)}</span><span class="scorebit">${ringHtml(t.score)}</span></div></div></div>`;
  body.innerHTML = head +
    `<div class="sec"><h4>职责</h4><div class="card"><div class="cur">${esc(t.duty || '—')}</div></div></div>` +
    `<div class="sec"><h4>本周在做</h4>${doingItems.length ? `<div class="card tlist">${doingItems.map(x => `<div class="titem">${chip(x.status)}<div>${isSpecialTask(x) ? `${taskStars(x)}★ ` : ''}${esc(x.title)}</div></div>`).join('')}</div>` : '<div class="card empty">—</div>'}</div>` +
    `<div class="sec"><h4>最近完成</h4>${done.length ? `<div class="card tlist">${done.map(x => `<div class="titem">${chip(x.status)}<div>${isSpecialTask(x) ? `${taskStars(x)}★ ` : ''}${esc(x.title)}</div></div>`).join('')}</div>` : '<div class="card empty">—</div>'}</div>` +
    `<div class="sec"><h4>考核</h4><div class="card"><div class="snote">${esc(workRuleLine())}</div></div>${staff ? `<ul class="staff">${staff}</ul>` : ''}</div>` +
    `<div class="sec"><h4>最后更新</h4><div class="card"><div class="cur">${esc(fmtTime(teamUpdatedAt(t)))} (UTC+8)</div></div></div>`;
}
function selectRoom(id, source, staffId) {
  const wideDir = source === 'directory' && viewW > 760 && !$('#directory').classList.contains('hidden');
  state.selected = id;
  state.staffId = staffId || null;
  if (!wideDir) {
    $('#board').classList.add('hidden');
    $('#directory').classList.add('hidden');
    setTab('office');
    renderPanel(id); $('#panel').classList.remove('hidden'); $('#panel').scrollTop = 0;
    syncPanelChrome();
  } else {
    $('#panel').classList.add('hidden');
    syncPanelChrome();
    document.querySelectorAll('.dcard').forEach(el => el.classList.toggle('sel', el.dataset.team === id));
  }
  Object.values(office.rooms).forEach(R => R.labelEl.classList.toggle('sel', R.id === id));
  const R = office.rooms[id];
  if (!R) return;
  const tgt = R.center.clone();
  const portrait = camera.aspect < 0.8;
  // shift target so the room sits in the visible area (beside the open frame / above the bottom sheet)
  const right = new THREE.Vector3(HOME_DIR.z, 0, -HOME_DIR.x).normalize();
  const fwd = new THREE.Vector3(-HOME_DIR.x, 0, -HOME_DIR.z).normalize();
  if (wideDir) tgt.addScaledVector(right, -4.4).addScaledVector(fwd, -0.4);
  else if (portrait) tgt.addScaledVector(fwd, -2.2);
  else if (viewW > 760) tgt.addScaledVector(right, 3.6).addScaledVector(fwd, -0.6);
  flyTo(tgt, portrait ? 31 : 22, HOME_DIR);
  renderQuick();
}
function syncPanelChrome() {
  const open = !$('#panel').classList.contains('hidden');
  document.getElementById('app').classList.toggle('panel-open', open);
  const panel = $('#panel');
  if (!panel) return;
  if (open && viewW > 760) {
    const bar = $('#topbar').getBoundingClientRect().height;
    panel.style.top = `${Math.ceil(bar + 8)}px`;
  } else panel.style.top = '';
}
window.addEventListener('resize', () => syncPanelChrome());
function closePanel() {
  if (!state.selected && $('#panel').classList.contains('hidden')) return;
  state.selected = null; state.staffId = null; $('#panel').classList.add('hidden');
  syncPanelChrome();
  Object.values(office.rooms).forEach(R => R.labelEl.classList.remove('sel'));
  renderQuick();
  goHome(true);
}
$('#panelClose').addEventListener('click', closePanel);

function teamCounts(team) {
  const tasks = DATA.tasks.filter(x => x.team === team.id);
  const n = (s) => tasks.filter(x => x.status === s).length;
  return { members: team.agents ?? 0, doing: n('doing'), confirm: n('confirm'), done: n('done'), total: tasks.length };
}
function renderBoard() {
  const mode = state.boardMode || 'tasks';
  document.querySelectorAll('#boardMode button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  if (mode === 'grades') {
    const teams = DATA.teams.filter(t => !t.private).slice().sort((a, b) => {
      const as = a.score, bs = b.score;
      if (as == null && bs == null) return a.name.localeCompare(b.name, 'zh');
      if (as == null) return 1;
      if (bs == null) return -1;
      return bs - as;
    });
    const scored = teams.filter(t => t.score != null).length;
    $('#boardStats').innerHTML = `<div class="bstotal">考核 <b>已评 ${scored}</b> · <b>待评 ${teams.length - scored}</b></div>`;
    $('#boardCols').innerHTML = `<div class="col grade-col">${teams.map(t => {
      const people = (t.staff || []).map(s => `<span class="smini"><b>${esc(s.name)}</b>${barHtml(s.score)}</span>`).join('');
      return `<button type="button" class="gcard" data-team="${esc(t.id)}" style="--c:${esc(t.color)}"><div class="top"><div class="bn">${esc(t.name)}</div>${barHtml(t.score)}</div><div class="snote">${esc(t.gradeNote || '')}</div>${t.gradedAt ? `<div class="gdate">${esc(fmtTime(t.gradedAt))}</div>` : ''}<div class="sminis">${people}</div></button>`;
    }).join('')}</div>`;
    return;
  }
  if (mode === 'bars') {
    const teams = DATA.teams.slice();
    const people = teams.reduce((n, t) => n + (t.private || workBarOff(null, t) ? 0 : (t.staff || []).filter(s => !workBarOff(s, t)).length), 0);
    $('#boardStats').innerHTML = `<div class="bstotal">分数 <b>与头顶绿条同一实时分数</b> · ${people} 人</div>`;
    $('#boardCols').innerHTML = `<div class="col grade-col">${teams.map(t => {
      const rows = t.private
        ? `<span class="smini"><b>私密</b></span>`
        : (t.staff || []).map(s => `<span class="smini"><b>${esc(s.name)}</b>${workBarHtml(s)}</span>`).join('');
      return `<button type="button" class="gcard" data-team="${esc(t.id)}" style="--c:${esc(t.color)}"><div class="top"><div class="bn">${esc(t.private ? '私密' : t.name)}</div></div><div class="sminis">${rows}</div></button>`;
    }).join('')}</div>`;
    return;
  }
  const members = DATA.teams.reduce((n, t) => n + (t.agents ?? 0), 0);
  const chips = DATA.teams.map(t => {
    const c = teamCounts(t);
    const icon = office.rooms[t.id]?.def.icon ?? (t.private ? '私' : '·');
    const stats = t.private
      ? `<div class="bpriv">私密</div>`
      : `<div class="bc"><span>进行中 ${c.doing}</span><span>等你确认 ${c.confirm}</span><span>已完成 ${c.done}</span></div><div class="bt">共 ${c.total} 项</div>`;
    return `<button type="button" class="bschip" data-team="${esc(t.id)}" style="--c:${esc(t.color)}"><div class="top"><span class="ic">${esc(icon)}</span><span class="bn">${esc(t.name)}</span></div><div class="bm">成员 ${c.members} 人</div>${stats}</button>`;
  }).join('');
  $('#boardStats').innerHTML = `<div class="bstotal">全公司 <b>成员 ${members}</b> / <b>任务 ${DATA.tasks.length}</b></div><div class="bsrow">${chips}</div>`;
  const cols = [['doing', '进行中', 'busy'], ['confirm', '等你确认', 'confirm'], ['done', '已完成', 'idle']];
  $('#boardCols').innerHTML = cols.map(([k, name, dot]) => {
    const items = DATA.tasks.filter(x => x.status === k);
    return `<div class="col"><h3><i class="dot ${dot}"></i>${name}<span class="n">${items.length}</span></h3>${items.map(x => {
      const t = teamOf(x.team) ?? { name: x.team, color: '#D0B993' };
      const title = t.private ? '私密任务（仅 Edward 可见）' : esc(x.title);
      return `<div class="tcard ${k}" data-team="${esc(x.team)}" style="--c:${esc(t.color)}"><div class="tm"><i></i>${esc(t.name)} · ${fmtTime(x.updatedAt)}</div><div class="tt">${title}</div></div>`;
    }).join('') || '<div class="empty" style="padding:6px 4px">暂无</div>'}</div>`;
  }).join('');
}
$('#boardCols').addEventListener('click', e => {
  const c = e.target.closest('.tcard, .gcard');
  if (c) selectRoom(c.dataset.team);
});
$('#boardStats').addEventListener('click', e => { const c = e.target.closest('.bschip'); if (c) selectRoom(c.dataset.team); });
function setTab(v) { document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === v)); }
function openView(v) {
  setTab(v);
  $('#navfabMenu').classList.add('hidden');
  $('#navfabBtn').setAttribute('aria-expanded', 'false');
  if (v === 'board') {
    $('#panel').classList.add('hidden'); state.selected = null;
    syncPanelChrome();
    $('#directory').classList.add('hidden');
    $('#board').classList.remove('hidden');
    Object.values(office.rooms).forEach(R => R.labelEl.classList.remove('sel'));
  } else if (v === 'directory') {
    $('#panel').classList.add('hidden');
    syncPanelChrome();
    $('#board').classList.add('hidden');
    $('#directory').classList.remove('hidden');
    renderDirectory();
  } else {
    $('#board').classList.add('hidden');
    $('#directory').classList.add('hidden');
  }
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => openView(b.dataset.view)));
$('#navfabBtn').addEventListener('click', () => {
  const menu = $('#navfabMenu');
  const open = menu.classList.toggle('hidden') === false;
  $('#navfabBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
});
$('#navfabMenu').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b?.dataset.view) openView(b.dataset.view);
});
$('#boardClose').addEventListener('click', () => { $('#board').classList.add('hidden'); setTab('office'); });
$('#boardMode')?.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b?.dataset.mode) return;
  state.boardMode = b.dataset.mode;
  renderBoard();
});

function renderQuick() {
  const row = $('#quickscroll');
  if (!row) return;
  row.innerHTML = DATA.teams.map(t => {
    const icon = office.rooms[t.id]?.def.icon ?? (t.private ? '私' : '·');
    const on = state.selected === t.id ? ' on' : '';
    return `<button type="button" class="qchip${on}" data-team="${esc(t.id)}" style="--c:${esc(t.color)}"><span class="qi">${esc(icon)}</span><span>${esc(t.short || t.name)}</span></button>`;
  }).join('');
}
$('#homeBtn')?.addEventListener('click', () => {
  state.selected = null; state.staffId = null;
  $('#panel').classList.add('hidden');
  syncPanelChrome();
  $('#board').classList.add('hidden');
  $('#directory').classList.add('hidden');
  setTab('office');
  Object.values(office.rooms).forEach(R => R.labelEl.classList.remove('sel'));
  renderQuick();
  goHome(true);
});
$('#quickscroll')?.addEventListener('click', e => {
  const b = e.target.closest('.qchip');
  if (b) selectRoom(b.dataset.team);
});

const DONE_SHOW = 3;
function directoryTasks(team) {
  const all = DATA.tasks.filter(x => x.team === team.id);
  const byTime = (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt);
  return [
    ...all.filter(x => x.status === 'doing').sort(byTime),
    ...all.filter(x => x.status === 'confirm').sort(byTime),
    ...all.filter(x => x.status === 'done').sort(byTime).slice(0, DONE_SHOW),
  ];
}
function deptCard(t) {
  const icon = office.rooms[t.id]?.def.icon ?? (t.private ? '私' : '·');
  const lbl = t.statusNote || DATA.statusLabels?.[t.status] || ST_LABEL[t.status] || '';
  const sel = state.selected === t.id ? ' sel' : '';
  if (t.private) {
    const note = t.privateNote || '私密内容，仅 Edward 可见';
    return `<button type="button" class="dcard${sel}" data-team="${esc(t.id)}" style="--c:${esc(t.color)}"><div class="dtop"><span class="ic">${esc(icon)}</span><div class="nm">${esc(t.name)}</div></div><div class="dlock">私 ${esc(note)}</div></button>`;
  }
  const head = `<div class="dtop"><span class="ic">${esc(icon)}</span><div><div class="nm">${esc(t.name)}</div><div class="sub"><i class="dot ${esc(t.status)}"></i>${esc(lbl)} · ${t.agents ?? 0} 位成员</div></div></div>`;
  const tasks = directoryTasks(t);
  const body = tasks.length
    ? `<ul class="dtasks">${tasks.map(x => `<li>${chip(x.status)}<span>${esc(x.title)}</span></li>`).join('')}</ul>`
    : '<div class="dnone">暂无任务</div>';
  return `<button type="button" class="dcard${sel}" data-team="${esc(t.id)}" style="--c:${esc(t.color)}">${head}${body}</button>`;
}
function renderDirectory() {
  const root = $('#dirBody');
  if (!root) return;
  const mode = state.dirMode || 'status';
  let html = '';
  if (mode === 'group') {
    const groups = DATA.directory?.groups || [];
    const seen = new Set();
    for (const g of groups) {
      const teams = (g.teams || []).map(teamOf).filter(Boolean);
      teams.forEach(t => seen.add(t.id));
      if (!teams.length) continue;
      html += `<section class="dgroup"><h3>${esc(g.name)}<span class="n">${teams.length}</span></h3>${teams.map(deptCard).join('')}</section>`;
    }
    const rest = DATA.teams.filter(t => !seen.has(t.id));
    if (rest.length) html += `<section class="dgroup"><h3>其他<span class="n">${rest.length}</span></h3>${rest.map(deptCard).join('')}</section>`;
  } else {
    const groups = DATA.directory?.statusGroups || [
      { status: 'busy', label: '忙碌' },
      { status: 'confirm', label: '等你确认' },
      { status: 'idle', label: '待命空闲' },
    ];
    for (const g of groups) {
      const teams = DATA.teams.filter(t => t.status === g.status);
      html += `<section class="dgroup"><h3><i class="dot ${esc(g.status)}"></i>${esc(g.label)}<span class="n">${teams.length}</span></h3>${teams.length ? teams.map(deptCard).join('') : '<div class="dnone">无</div>'}</section>`;
    }
  }
  root.innerHTML = html + sharedSpaceCard();
}
function sharedSpaceCard() {
  const L = DATA.lounge || {};
  const n = office.rooms.lounge?.occupancy ?? 0;
  const sel = (id) => state.selected === id ? ' sel' : '';
  const extra = [L.pantry, L.meeting, L.lastMeeting].filter(Boolean).map(s => `<div class="dnone">${esc(s)}</div>`).join('');
  const lounge = `<button type="button" class="dcard${sel('lounge')}" data-team="lounge" style="--c:#E87708"><div class="dtop"><span class="ic">休</span><div><div class="nm">${esc(L.name || '休息室')}</div><div class="sub">共享空间 · ${n} 人在此</div></div></div>${extra}</button>`;
  const archive = `<button type="button" class="dcard${sel('archive')}" data-team="archive" style="--c:#D0B993"><div class="dtop"><span class="ic">资</span><div><div class="nm">${esc(DATA.archive?.name || '资料库')}</div><div class="sub">客厅 · 普通文件房 · 机密文件房</div></div></div></button>`;
  const showroom = `<button type="button" class="dcard${sel('showroom')}" data-team="showroom" style="--c:#D0B993"><div class="dtop"><span class="ic">展</span><div><div class="nm">品牌展厅</div><div class="sub">展陈占位 · 非部门</div></div></div></button>`;
  const meeting = `<button type="button" class="dcard${sel('meeting')}" data-team="meeting" style="--c:#D0B993"><div class="dtop"><span class="ic">议</span><div><div class="nm">会议室</div><div class="sub">${esc(nextMeetingText(klNow()))}</div></div></div></button>`;
  const news = `<button type="button" class="dcard${sel('news')}" data-team="news" style="--c:#D0B993"><div class="dtop"><span class="ic">讯</span><div><div class="nm">新闻墙</div><div class="sub">大厅 · 信息部简报</div></div></div></button>`;
  return `<section class="dgroup"><h3>共享空间</h3>${lounge}${showroom}${archive}${meeting}${news}</section>`;
}
$('#dirBody').addEventListener('click', e => { const c = e.target.closest('.dcard'); if (c) selectRoom(c.dataset.team, 'directory'); });
$('#dirMode').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !b.dataset.mode) return;
  state.dirMode = b.dataset.mode;
  $('#dirMode').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  renderDirectory();
});
$('#dirClose').addEventListener('click', () => { $('#directory').classList.add('hidden'); setTab('office'); });

/* ---------- speech bubbles ---------- */
let bubbleTimer = 2.5, bubbleIdx = 0;
const activeBubbles = [];
function popBubble() {
  const cands = DATA.teams.filter(t => !t.private && DATA.feed.some(f => f.team === t.id));
  if (!cands.length) return;
  // prioritise non-idle teams but rotate through everyone
  const t = cands[bubbleIdx++ % cands.length];
  const R = office.rooms[t.id]; if (!R) return;
  const pool = t.id === 'ed' && R.boss ? [R.boss] : [...R.agents, ...R.walkers.filter(w => w.visible)];
  if (!pool.length) return;
  const agent = pool[Math.floor(Math.random() * pool.length)];
  const latest = DATA.feed.filter(f => f.team === t.id).sort((a, b) => new Date(b.time) - new Date(a.time))[0];
  if (activeBubbles.some(b => b.agent === agent)) return;
  if (activeBubbles.length >= (viewW <= 760 ? 1 : 3)) return;
  const host = document.createElement('div'); host.className = 'bubble-host' + (t.id === 'ed' ? ' ed' : '');
  const el = document.createElement('div'); el.className = 'bubble'; el.style.setProperty('--c', t.color);
  el.innerHTML = `<b>${esc(t.name)}</b>${esc(latest.text)}`;
  host.appendChild(el);
  const o = new CSS2DObject(host); o.renderOrder = t.id === 'ed' ? 40 : 8; agent.userData.bubbleAnchor.add(o);
  const b = { o, el, agent, life: 5.2, ed: t.id === 'ed' }; activeBubbles.push(b);
}
const labelNudge = {};
function separateLabels() {
  const list = Object.values(office.rooms).filter(R => R.labelEl);
  if (list.length < 2) return;
  const pad = 8;
  const base = {};
  for (const R of list) {
    const m = R.labelEl.getBoundingClientRect();
    const cur = labelNudge[R.id] || { x: 0, y: 0 };
    if (m.width < 2 || m.height < 2) continue;
    base[R.id] = { left: m.left - cur.x, top: m.top - cur.y, right: m.right - cur.x, bottom: m.bottom - cur.y };
  }
  const ids = Object.keys(base);
  const pos = {};
  for (const id of ids) pos[id] = { ...base[id] };
  for (let pass = 0; pass < 10; pass++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const A = pos[ids[i]], B = pos[ids[j]];
        const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left);
        const oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
        if (ox <= 0 || oy <= 0) continue;
        if (ox < oy) {
          const left = A.left <= B.left ? A : B;
          const right = left === A ? B : A;
          const d = (ox + pad) / 2;
          left.left -= d; left.right -= d; right.left += d; right.right += d;
        } else {
          const up = A.top <= B.top ? A : B;
          const down = up === A ? B : A;
          const d = (oy + pad) / 2;
          up.top -= d; up.bottom -= d; down.top += d; down.bottom += d;
        }
      }
    }
  }
  for (const R of list) {
    const b = base[R.id];
    if (!b) continue;
    const p = pos[R.id];
    const x = Math.round(Math.max(-96, Math.min(96, p.left - b.left)));
    const y = Math.round(Math.max(-72, Math.min(72, p.top - b.top)));
    labelNudge[R.id] = { x, y };
    R.labelEl.style.marginLeft = x ? `${x}px` : '';
    R.labelEl.style.marginTop = y ? `${y}px` : '';
  }
}
function settleStaffTags() {
  const tags = [...document.querySelectorAll('.ptag')];
  if (!tags.length) return;
  const dist = camera.position.distanceTo(controls.target);
  // Home view sits near distance 98. Closer than that, names belong next to people.
  const overview = dist > 80;
  if (overview) {
    for (const el of tags) el.style.visibility = 'hidden';
    return;
  }
  const plates = [...document.querySelectorAll('.rlabel')];
  const hit = (a, b) => a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2;
  for (const el of tags) {
    el.style.visibility = '';
    if (!el.dataset.baseTop) {
      const cs = getComputedStyle(el);
      el.dataset.baseTop = String(parseFloat(cs.marginTop) || 0);
      el.dataset.baseLeft = String(parseFloat(cs.marginLeft) || 0);
    }
  }
  for (const el of tags) {
    const baseT = Number(el.dataset.baseTop);
    const baseL = Number(el.dataset.baseLeft);
    let x = 0;
    let y = 0;
    for (let i = 0; i < 14; i++) {
      el.style.marginLeft = `${baseL + x}px`;
      el.style.marginTop = `${baseT + y}px`;
      const r = el.getBoundingClientRect();
      if (r.width < 2) break;
      const plate = plates.find(p => hit(r, p.getBoundingClientRect()));
      if (!plate) break;
      const pr = plate.getBoundingClientRect();
      const dx = (r.left + r.right) / 2 - (pr.left + pr.right) / 2;
      const dy = (r.top + r.bottom) / 2 - (pr.top + pr.bottom) / 2;
      if (Math.abs(dx) >= Math.abs(dy)) x += Math.sign(dx || 1) * 14;
      else y += Math.sign(dy || 1) * 14;
    }
  }
}
function layoutEdBubble(el) {
  const label = office.rooms.ed?.labelEl;
  if (!label) return;
  const lr = label.getBoundingClientRect();
  const br = el.getBoundingClientRect();
  if (br.width < 20 || lr.width < 20) return;
  const cs = getComputedStyle(el);
  const curLeft = parseFloat(cs.left) || 0;
  const curTop = parseFloat(cs.top) || 0;
  const originX = br.left - curLeft;
  const originY = br.top - curTop;
  let left = lr.left + (lr.width - br.width) / 2;
  let top = lr.top - 14 - br.height;
  const others = Object.values(office.rooms).filter(R => R.labelEl && R.id !== 'ed').map(R => R.labelEl.getBoundingClientRect());
  const hits = (x, y) => others.some(o => x < o.right - 0.5 && x + br.width > o.left + 0.5 && y < o.bottom - 0.5 && y + br.height > o.top + 0.5);
  if (hits(left, top)) {
    let placed = false;
    for (const dir of [-1, 1]) {
      let x = left;
      for (let i = 0; i < 10 && hits(x, top); i++) x += dir * 24;
      if (!hits(x, top)) { left = x; placed = true; break; }
    }
    if (!placed) { for (let i = 0; i < 8 && hits(left, top); i++) top -= 22; }
  }
  top = Math.max(8, top);
  el.style.left = `${Math.round(left - originX)}px`;
  el.style.top = `${Math.round(top - originY)}px`;
}
function tickBubbles(dt) {
  bubbleTimer -= dt;
  if (bubbleTimer <= 0) { popBubble(); bubbleTimer = 2.6 + Math.random() * 2; }
  for (let i = activeBubbles.length - 1; i >= 0; i--) {
    const b = activeBubbles[i]; b.life -= dt;
    if (b.life < 0.4 && !b.el.classList.contains('out')) b.el.classList.add('out');
    if (b.life <= 0) { b.o.parent?.remove(b.o); b.el.remove(); activeBubbles.splice(i, 1); }
  }
}

/* ---------- data loading ---------- */
async function loadData() {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    if (!j.teams || !j.tasks) throw new Error('bad data');
    if (JSON.stringify(j) !== JSON.stringify(DATA) || DATA_SRC !== 'remote') { DATA = j; DATA_SRC = 'remote'; applyData(); }
  } catch (e) {
    if (DATA_SRC !== 'remote') { DATA = SEED; DATA_SRC = 'embedded'; applyData(); }
    console.warn('data.json fetch failed, using', DATA_SRC, e);
  }
}
loadData();
setInterval(loadData, 60000);
setInterval(refreshWorkBars, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadData(); });

const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function klNow(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', weekday: 'short', day: 'numeric', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]));
  const hour = Number(parts.hour), minute = Number(parts.minute);
  return { hour, minute, minutes: hour * 60 + minute, dow: DOW[parts.weekday] ?? 0, day: Number(parts.day) };
}
function hm(s) { const [h, m] = String(s || '0:0').split(':').map(Number); return h * 60 + m; }
function meetingActive(m, kl) {
  if (!m) return false;
  if (m.weekday != null && kl.dow !== m.weekday) return false;
  if (m.monthday != null && kl.day !== m.monthday) return false;
  const t = kl.minutes;
  return t >= hm(m.start) && t < hm(m.end);
}
function dayFactor(minutes) {
  const dawn = 7 * 60, dusk = 19 * 60, fade = 20;
  if (minutes < dawn - fade) return 0;
  if (minutes < dawn + fade) return (minutes - (dawn - fade)) / (fade * 2);
  if (minutes < dusk - fade) return 1;
  if (minutes < dusk + fade) return 1 - (minutes - (dusk - fade)) / (fade * 2);
  return 0;
}
function nextMeetingText(kl) {
  let best = null, bestMin = 1e9;
  for (let i = 0; i < 40; i++) {
    const when = new Date(Date.now() + i * 86400000);
    const p = klNow(when);
    for (const m of DATA.meetings || []) {
      if (m.weekday != null && p.dow !== m.weekday) continue;
      if (m.monthday != null && p.day !== m.monthday) continue;
      const start = hm(m.start);
      const delta = i * 1440 + start - kl.minutes;
      if (delta >= 0 && delta < bestMin) { bestMin = delta; best = m; }
    }
  }
  if (!best) return '暂无安排';
  const live = (DATA.meetings || []).some(m => meetingActive(m, kl));
  return live ? '会议进行中' : best.title;
}
function paintShiftLabels() {
  const off = state.clock.offDuty;
  for (const R of Object.values(office.rooms)) {
    const t = teamOf(R.id);
    const span = R.labelEl?.querySelector('.st span');
    if (!t || !span) continue;
    if (off && t.id === 'ed') span.textContent = '值班';
    else if (off) span.textContent = '已下班';
    else {
      const lbl = t.statusNote || DATA.statusLabels?.[t.status] || ST_LABEL[t.status];
      span.textContent = `${lbl}${t.private ? ' · 私密' : ` · ${t.agents ?? 0} 位成员`}`;
    }
  }
  const meet = office.rooms.meeting?.labelEl?.querySelector('.st span');
  if (meet) meet.textContent = nextMeetingText(klNow());
}
function lerpColor(out, a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  out.copy(ca).lerp(cb, t);
}
const dayBg = new THREE.Color('#d5e2ee'), nightBg = new THREE.Color('#070b12');
const dayFog = new THREE.Color('#c9d5e2'), nightFog = new THREE.Color('#0c1420');
function officeUpdatedAt() {
  let latest = DATA.updatedAt || '';
  let latestMs = latest ? new Date(latest).getTime() : 0;
  for (const task of DATA.tasks || []) {
    if (!task.updatedAt) continue;
    const ms = new Date(task.updatedAt).getTime();
    if (ms > latestMs) { latestMs = ms; latest = task.updatedAt; }
  }
  return latest;
}
function paintFooter() {
  const upd = $('#updated');
  if (!upd) return;
  if (state.clock.offDuty) {
    const kl = klNow();
    const hh = String(kl.hour).padStart(2, '0');
    const mm = String(kl.minute).padStart(2, '0');
    upd.textContent = `夜间模式 ${hh}:${mm}`;
  } else {
    upd.textContent = `更新 ${fmtTime(officeUpdatedAt())} (UTC+8)`;
  }
}
function applyClock() {
  const kl = klNow();
  const mode = state.clock.mode;
  const day = mode === 'day' ? 1 : mode === 'night' ? 0 : dayFactor(kl.minutes);
  state.clock.day = day;
  const night = mode === 'night' || (mode === 'auto' && day < 0.5);
  state.clock.offDuty = night;
  state.clock.meeting = (DATA.meetings || []).some(m => meetingActive(m, kl));
  state.clock.working = isWorkingHours(debugNow() || new Date());
  const n = 1 - day;
  hemi.color.set('#f3efe6').lerp(new THREE.Color('#0C1824'), n);
  hemi.groundColor.set('#c9c2b2').lerp(new THREE.Color('#07080c'), n);
  hemi.intensity = 0.16 + day * 0.62;
  sun.intensity = 0.05 + day * 1.5;
  sun.color.set(day > 0.5 ? '#fff6ea' : '#243044');
  fill.intensity = 0.04 + day * 0.26;
  fill.color.set(day > 0.5 ? '#f0e2c8' : '#1a2433');
  scene.environmentIntensity = 0.16 + day * 0.4;
  scene.background.copy(nightBg).lerp(dayBg, day);
  scene.fog.color.copy(nightFog).lerp(dayFog, day);
  if (office.applyAmbience) office.applyAmbience(day);
  paintShiftLabels();
  paintFooter();
  const btn = $('#dayToggle');
  if (btn) btn.textContent = mode === 'day' ? '日间' : mode === 'night' ? '夜间' : '自动';
}
$('#dayToggle')?.addEventListener('click', () => {
  state.clock.mode = state.clock.mode === 'auto' ? 'day' : state.clock.mode === 'day' ? 'night' : 'auto';
  applyClock();
});
applyData();
applyClock();

/* ---------- loop ---------- */
let last = performance.now(), T = 0;
let first = true;
function frame() {
  syncView();
  const now = performance.now(); const dt = Math.min((now - last) / 1000, 0.05); last = now; T += dt; const t = T;
  if (tween) {
    tween.t += dt / tween.dur; const k = tween.t >= 1 ? 1 : 1 - Math.pow(1 - tween.t, 3);
    controls.target.lerpVectors(tween.fromT, tween.toT, k); camera.position.lerpVectors(tween.fromP, tween.toP, k);
    if (tween.t >= 1) tween = null;
  }
  controls.update();
  // keep target inside the office
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -40, 30);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -28, 24);
  controls.target.y = 0;
  office.update(t, dt, state);
  tickBubbles(dt);
  refreshWorkBars();
  if (composer) composer.render(); else renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  separateLabels();
  settleStaffTags();
  for (const b of activeBubbles) if (b.ed) layoutEdBubble(b.el);
  if ((T % 0.5) < dt) applyClock();
  if (first) { first = false; setTimeout(() => $('#loading').classList.add('gone'), 150); window.__ready = true; }
}
renderer.setAnimationLoop(frame);
window.__app = { popBubble, selectRoom, closePanel, setTab, openView, office, camera, controls, renderer };
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}
