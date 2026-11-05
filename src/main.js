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
const state = { status: {}, selected: null };

/* ---------- renderer ---------- */
const isMobile = matchMedia('(max-width: 760px)').matches || /iPhone|iPad|Android/i.test(navigator.userAgent);
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#070b14');
scene.fog = new THREE.Fog('#070b14', 70, 140);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 300);
const labelRenderer = new CSS2DRenderer({ element: $('#labels') });

/* lights */
const hemi = new THREE.HemisphereLight('#b9c7ff', '#1a1430', 0.85); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1dc', 2.0);
sun.position.set(-14, 30, 18); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 24, bottom: -24, near: 5, far: 80 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
scene.add(sun);
const fill = new THREE.DirectionalLight('#7dd3fc', 0.45); fill.position.set(20, 12, -10); scene.add(fill);

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
  const R = 25, vf = THREE.MathUtils.degToRad(camera.fov) / 2;
  const hf = Math.atan(Math.tan(vf) * camera.aspect);
  const d = Math.max(R * 0.74 / Math.tan(vf), R * 0.92 / Math.tan(hf));
  return camera.aspect < 0.8 ? d * 0.58 : d;
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
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.45, 1.0);
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
  const h = ray.intersectObjects(hits, false)[0];
  if (h) selectRoom(h.object.userData.room); else closePanel();
});
$('#labels').addEventListener('click', e => { const el = e.target.closest('.rlabel'); if (el) selectRoom(el.dataset.room); });

/* ---------- UI ---------- */
const teamOf = (id) => DATA.teams.find(t => t.id === id);
const MINOR = {};

function applyData() {
  for (const t of DATA.teams) state.status[t.id] = t.status;
  // labels
  for (const R of Object.values(office.rooms)) {
    const t = teamOf(R.id); const el = R.labelEl;
    el.classList.toggle('sel', state.selected === R.id);
    if (!t) continue;
    el.querySelector('.nm').textContent = t.name;
    const st = el.querySelector('.st');
    const lbl = t.statusNote || DATA.statusLabels?.[t.status] || ST_LABEL[t.status];
    st.innerHTML = `<i class="dot ${esc(t.status)}"></i><span>${esc(lbl)}${t.private ? ' · 私密' : ` · ${t.agents ?? 0} 位成员`}</span>`;
  }
  const cnt = { busy: 0, confirm: 0, idle: 0 };
  DATA.teams.forEach(t => cnt[t.status] = (cnt[t.status] || 0) + 1);
  const pend = DATA.tasks.filter(x => x.status === 'confirm').length;
  $('#confirmBadge').textContent = pend; $('#confirmBadge').style.display = pend ? '' : 'none';
  $('#summary').innerHTML = `<span class="pill"><i class="dot busy"></i>${cnt.busy} 忙碌</span><span class="pill"><i class="dot confirm"></i>${pend} 项等你确认</span><span class="pill">${DATA.teams.length} 个团队</span>`;
  $('#updated').textContent = `更新 ${fmtTime(DATA.updatedAt)} (UTC+8)`;
  $('#company').textContent = DATA.office?.company ?? 'EVERGATE HOLDING SDN BHD';
  renderBoard();
  if (state.selected) renderPanel(state.selected);
}

function chip(s) { return `<span class="chip ${s === 'doing' ? 'busy' : esc(s)}">${esc(ST_LABEL[s] ?? s)}</span>`; }

function renderPanel(id) {
  const t = teamOf(id); const body = $('#panelBody');
  if (!t) {
    const m = MINOR[id]; const c = office.rooms[id]?.def.color ?? '#64748b';
    body.innerHTML = `<div class="ph" style="--c:${c}"><div class="ic">·</div><div><h3>${esc(m?.name ?? id)}</h3><div class="sub">公共区域</div></div></div><div class="sec"><div class="card empty">${esc(m?.text ?? '')}</div></div>`;
    return;
  }
  const lbl = t.statusNote || ST_LABEL[t.status];
  const head = `<div class="ph" style="--c:${esc(t.color)}"><div class="ic">${t.private ? '🔒' : esc(office.rooms[id]?.def.icon ?? '')}</div><div><h3>${esc(t.name)}</h3>
    <div class="sub"><span class="chip ${esc(t.status)}"><i class="dot ${esc(t.status)}"></i>${esc(lbl)}</span>${t.private ? '' : `<span>${t.agents ?? 0} 位 AI 成员</span>`}</div></div></div>`;
  if (t.private) {
    body.innerHTML = head + `<div class="sec"><div class="card private"><div class="lk">🔒</div><div>私密内容，仅 Edward 可见</div></div></div>`;
    return;
  }
  const tasks = DATA.tasks.filter(x => x.team === id);
  const order = { confirm: 0, doing: 1, done: 2 };
  tasks.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  const feed = DATA.feed.filter(f => f.team === id).sort((a, b) => new Date(b.time) - new Date(a.time));
  body.innerHTML = head +
    `<div class="sec"><h4>当前任务</h4><div class="card"><div class="cur ${t.currentTask ? '' : 'none'}">${t.currentTask ? esc(t.currentTask) : (t.status === 'idle' ? '暂无任务 · 待命中' : '—')}</div></div></div>` +
    `<div class="sec"><h4>任务 <span>${tasks.length}</span></h4>${tasks.length ? `<div class="card tlist">${tasks.map(x => `<div class="titem">${chip(x.status)}<div>${esc(x.title)}</div></div>`).join('')}</div>` : '<div class="card empty">暂无任务</div>'}</div>` +
    `<div class="sec"><h4>最新动态 <span>UTC+8</span></h4>${feed.length ? `<ul class="feed" style="--c:${esc(t.color)}">${feed.map(f => `<li><time>${fmtTime(f.time)}</time>${esc(f.text)}</li>`).join('')}</ul>` : '<div class="card empty">暂无动态</div>'}</div>`;
}
function selectRoom(id) {
  state.selected = id;
  $('#board').classList.add('hidden'); setTab('office');
  renderPanel(id); $('#panel').classList.remove('hidden'); $('#panel').scrollTop = 0;
  Object.values(office.rooms).forEach(R => R.labelEl.classList.toggle('sel', R.id === id));
  const R = office.rooms[id];
  const tgt = R.center.clone();
  const portrait = camera.aspect < 0.8;
  // shift target so the room sits in the visible area (left of side panel / above bottom sheet)
  const right = new THREE.Vector3(HOME_DIR.z, 0, -HOME_DIR.x).normalize();
  const fwd = new THREE.Vector3(-HOME_DIR.x, 0, -HOME_DIR.z).normalize();
  if (portrait) tgt.addScaledVector(fwd, -2.2);
  else if (viewW > 760) tgt.addScaledVector(right, 3.6).addScaledVector(fwd, -0.6);
  flyTo(tgt, portrait ? 31 : 22, HOME_DIR);
}
function closePanel() {
  if (!state.selected) return;
  state.selected = null; $('#panel').classList.add('hidden');
  Object.values(office.rooms).forEach(R => R.labelEl.classList.remove('sel'));
  goHome(true);
}
$('#panelClose').addEventListener('click', closePanel);

function renderBoard() {
  const cols = [['doing', '进行中', 'busy'], ['confirm', '等你确认', 'confirm'], ['done', '已完成', 'idle']];
  $('#boardCols').innerHTML = cols.map(([k, name, dot]) => {
    const items = DATA.tasks.filter(x => x.status === k);
    return `<div class="col"><h3><i class="dot ${dot}"></i>${name}<span class="n">${items.length}</span></h3>${items.map(x => {
      const t = teamOf(x.team) ?? { name: x.team, color: '#64748b' };
      const title = t.private ? '私密任务（仅 Edward 可见）' : esc(x.title);
      return `<div class="tcard ${k}" data-team="${esc(x.team)}" style="--c:${esc(t.color)}"><div class="tm"><i></i>${esc(t.name)} · ${fmtTime(x.updatedAt)}</div><div class="tt">${title}</div></div>`;
    }).join('') || '<div class="empty" style="padding:6px 4px">暂无</div>'}</div>`;
  }).join('');
}
$('#boardCols').addEventListener('click', e => { const c = e.target.closest('.tcard'); if (c) selectRoom(c.dataset.team); });
function setTab(v) { document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === v)); }
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.view; setTab(v);
  if (v === 'board') { $('#panel').classList.add('hidden'); state.selected = null; $('#board').classList.remove('hidden'); }
  else $('#board').classList.add('hidden');
}));
$('#boardClose').addEventListener('click', () => { $('#board').classList.add('hidden'); setTab('office'); });

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
  const host = document.createElement('div'); host.className = 'bubble-host';
  const el = document.createElement('div'); el.className = 'bubble'; el.style.setProperty('--c', t.color);
  el.innerHTML = `<b>${esc(t.name)}</b>${esc(latest.text)}`;
  host.appendChild(el);
  const o = new CSS2DObject(host); agent.userData.bubbleAnchor.add(o);
  const b = { o, el, agent, life: 5.2 }; activeBubbles.push(b);
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
applyData();
loadData();
setInterval(loadData, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadData(); });

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
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -22, 22);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -20, 20);
  controls.target.y = 0;
  office.update(t, dt, state);
  tickBubbles(dt);
  if (composer) composer.render(); else renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  if (first) { first = false; setTimeout(() => $('#loading').classList.add('gone'), 150); window.__ready = true; }
}
renderer.setAnimationLoop(frame);
window.__app = { popBubble, selectRoom, closePanel, setTab, office, camera, controls, renderer };
