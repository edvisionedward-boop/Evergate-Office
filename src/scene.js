import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/* ---------------- materials ---------------- */
const matCache = new Map();
export function M(color, o = {}) {
  const key = [color, o.r, o.m, o.e, o.ei, o.op, o.side, o.flat].join('|');
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? 0.72, metalness: o.m ?? 0.02,
    emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1,
    transparent: o.op != null, opacity: o.op ?? 1, side: o.side ?? THREE.FrontSide,
    flatShading: !!o.flat,
  });
  if (o.op != null) m.depthWrite = false;
  matCache.set(key, m);
  return m;
}
const basicCache = new Map();
function B(color, o = {}) {
  const key = [color, o.op, o.add, o.boost].join('|');
  if (basicCache.has(key)) return basicCache.get(key);
  const tr = o.op != null || !!o.add;
  const m = new THREE.MeshBasicMaterial({ color, transparent: tr, opacity: o.op ?? 1, toneMapped: false,
    blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !tr });
  if (o.boost) m.color.multiplyScalar(o.boost);
  basicCache.set(key, m);
  return m;
}

const geoCache = new Map();
function G(key, fn) { if (!geoCache.has(key)) geoCache.set(key, fn()); return geoCache.get(key); }
const boxG = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const rboxG = (w, h, d, r = 0.04) => G(`rb${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.01, h / 2.01, d / 2.01)));
const cylG = (rt, rb, h, s = 12) => G(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const sphG = (r, ws = 12, hs = 8) => G(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));

/** add a box whose bottom sits at y */
function box(parent, w, h, d, x, y, z, mat, o = {}) {
  const m = new THREE.Mesh(o.round ? rboxG(w, h, d, o.round) : boxG(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  if (o.ry) m.rotation.y = o.ry;
  m.castShadow = o.cast ?? true; m.receiveShadow = o.recv ?? true;
  parent.add(m); return m;
}
function cyl(parent, rt, rb, h, x, y, z, mat, s = 12, o = {}) {
  const m = new THREE.Mesh(cylG(rt, rb, h, s), mat);
  m.position.set(x, y + h / 2, z); m.castShadow = o.cast ?? true; m.receiveShadow = true;
  parent.add(m); return m;
}
function sph(parent, r, x, y, z, mat, o = {}) {
  const m = new THREE.Mesh(sphG(r, o.ws ?? 10, o.hs ?? 7), mat);
  m.position.set(x, y, z); m.castShadow = o.cast ?? true; m.receiveShadow = true;
  if (o.sy) m.scale.y = o.sy;
  parent.add(m); return m;
}

const col = (c) => new THREE.Color(c);
const mix = (a, b, t) => col(a).lerp(col(b), t);
const hex = (c) => '#' + c.getHexString();

/* ---------------- canvas textures ---------------- */
function screenTexture(kind, accent, dim = false) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = dim ? '#0a0f1c' : '#0b1222'; g.fillRect(0, 0, 256, 160);
  if (dim) {
    g.fillStyle = accent; g.globalAlpha = .35;
    g.beginPath(); g.arc(128, 80, 22, 0, Math.PI * 2); g.fill();
    g.globalAlpha = .6; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText('EVERGATE', 128, 130);
  } else if (kind === 'code') {
    for (let i = 0; i < 26; i++) {
      const y = 8 + i * 12, x = 10 + (i % 5) * 12;
      g.fillStyle = ['#60a5fa', '#f472b6', '#a3e635', '#e2e8f0', accent][i % 5]; g.globalAlpha = .9;
      g.fillRect(x, y % 320, 30 + ((i * 37) % 120), 5);
      g.fillStyle = '#94a3b8'; g.fillRect(x + 40 + ((i * 37) % 120), y % 320, 20 + (i * 13) % 40, 5);
    }
  } else if (kind === 'chart') {
    g.strokeStyle = 'rgba(148,163,184,.25)'; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(10, 20 + i * 24); g.lineTo(246, 20 + i * 24); g.stroke(); }
    g.fillStyle = accent; for (let i = 0; i < 10; i++) { const h = 20 + ((i * 47) % 90); g.globalAlpha = .85; g.fillRect(18 + i * 23, 140 - h, 14, h); }
    g.globalAlpha = 1; g.strokeStyle = '#f8fafc'; g.lineWidth = 2.5; g.beginPath();
    for (let i = 0; i < 11; i++) g.lineTo(14 + i * 23, 110 - Math.sin(i * .8) * 30 - i * 4); g.stroke();
  } else if (kind === 'doc') {
    g.fillStyle = '#f1f5f9'; g.fillRect(40, 8, 176, 150);
    g.fillStyle = accent; g.fillRect(56, 22, 90, 9);
    g.fillStyle = '#94a3b8'; for (let i = 0; i < 11; i++) g.fillRect(56, 42 + i * 10, 140 - (i * 29) % 60, 4);
  } else { // dash
    g.fillStyle = accent; g.globalAlpha = .9; g.fillRect(10, 10, 110, 60); g.globalAlpha = .5; g.fillRect(130, 10, 116, 60);
    g.globalAlpha = .9; g.fillStyle = '#e2e8f0';
    for (let i = 0; i < 5; i++) g.fillRect(10, 82 + i * 15, 236 - i * 30, 7);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
  return t;
}
const screenMats = new Map();
function screenMat(kind, accent, dim) {
  const k = kind + accent + dim;
  if (!screenMats.has(k)) {
    const m = new THREE.MeshBasicMaterial({ map: screenTexture(kind, accent, dim), toneMapped: false });
    m.color.setScalar(dim ? 0.7 : 1.7);
    screenMats.set(k, m);
  }
  return screenMats.get(k);
}

function signTexture(text, sub, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0d1322'; g.beginPath(); g.roundRect(0, 0, 512, 128, 18); g.fill();
  g.fillStyle = color; g.fillRect(24, 30, 10, 68);
  g.fillStyle = '#f8fafc'; g.font = '700 54px "PingFang SC","Noto Sans CJK SC","Noto Sans SC",sans-serif'; g.textBaseline = 'middle';
  g.fillText(text, 54, 56);
  g.fillStyle = '#8b97b0'; g.font = '500 22px sans-serif'; g.fillText(sub, 56, 102);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function floorTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8d948c'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(40,48,40,.18)'; g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function plankTexture(base) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(0, y, 256, 2);
    const off = (y * 7) % 256; g.fillRect(off, y, 2, 32);
    g.fillStyle = `rgba(255,255,255,${0.03 + ((y / 32) % 3) * 0.015})`; g.fillRect(0, y + 2, 256, 30);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function carpetTexture(base) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(255,255,255,${0.025 + (i % 4) * 0.012})`;
    g.fillRect((i * 19) % 128, (i * 31) % 128, 2, 1);
  }
  g.strokeStyle = 'rgba(0,0,0,.08)';
  for (let y = 8; y < 128; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y + 4); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function concreteTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2a3038'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 240; i++) {
    g.fillStyle = `rgba(255,255,255,${0.02 + (i % 5) * 0.012})`;
    g.fillRect((i * 13) % 128, (i * 23) % 128, 3, 2);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(4, 4); return t;
}
function skylineTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#f6d2ae'); sky.addColorStop(0.42, '#e7a888'); sky.addColorStop(0.7, '#8eabca'); sky.addColorStop(1, '#e7eef6');
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 48; i++) {
    const w = 16 + (i * 19) % 46, h = 70 + (i * 47) % 230, x = (i * 22) % 1000;
    g.fillStyle = `rgba(22,32,48,${0.45 + (i % 4) * 0.1})`;
    g.fillRect(x, 470 - h, w, h);
    g.fillStyle = 'rgba(255,236,196,.55)';
    for (let wy = 478 - h; wy < 460; wy += 9) for (let wx = x + 3; wx < x + w - 4; wx += 7) if ((wx * 3 + wy) % 13 > 4) g.fillRect(wx, wy, 2, 4);
  }
  g.fillStyle = '#243044';
  g.fillRect(468, 150, 26, 320); g.fillRect(532, 150, 26, 320);
  g.fillRect(494, 268, 38, 10);
  g.beginPath(); g.moveTo(481, 150); g.lineTo(481, 78); g.lineTo(468, 150); g.fill();
  g.beginPath(); g.moveTo(545, 150); g.lineTo(545, 78); g.lineTo(558, 150); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function logoTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 360;
  const g = c.getContext('2d');
  g.fillStyle = '#172033'; g.fillRect(0, 0, 1024, 360);
  g.fillStyle = '#D0B993'; g.fillRect(80, 48, 14, 264);
  g.fillStyle = '#f8fafc'; g.font = '700 118px sans-serif'; g.textBaseline = 'middle';
  g.fillText('EVERGATE', 120, 150);
  g.fillStyle = '#94a3b8'; g.font = '500 36px sans-serif'; g.fillText('HOLDING  ·  KUALA LUMPUR', 124, 240);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function keyTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#1b2230'; g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#3d465c';
  for (let r = 0; r < 4; r++) for (let i = 0; i < 14; i++) g.fillRect(3 + i * 9, 3 + r * 15, 7, 11);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function pendant(parent, x, z) {
  if (!pendantGlow) pendantGlow = M('#f7f1e4', { e: '#fff1d2', ei: 0.55, r: .45 });
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  cyl(g, 0.012, 0.012, 0.85, 0, 2.45, 0, M('#9aa3b2', { m: .65, r: .3 }), 6, { cast: false });
  cyl(g, 0.34, 0.18, 0.14, 0, 2.0, 0, pendantGlow, 14, { cast: false });
  return g;
}
function doorFrame(parent, x, z, ry, width = 1.15, h = 2.2) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  const frame = M('#d5dbe6', { m: .45, r: .32 });
  box(g, 0.07, h, 0.09, -width / 2, 0, 0, frame, { cast: false });
  box(g, 0.07, h, 0.09, width / 2, 0, 0, frame, { cast: false });
  box(g, width + 0.08, 0.08, 0.09, 0, h - 0.02, 0, frame, { cast: false });
  const leaf = new THREE.Mesh(boxG(width * 0.48, h - 0.16, 0.025), M('#e8eef8', { r: .06, m: .12, op: 0.34 }));
  leaf.position.set(-width * 0.2, (h - 0.16) / 2, 0.03); leaf.rotation.y = 0.42; g.add(leaf);
  return g;
}

/* ---------------- characters ---------------- */
const SKIN = ['#f1c7a5', '#e0ac85', '#c68a62', '#f5d3b8', '#a8714f'];
const HAIR = ['#1f1a17', '#3b2a20', '#6b4423', '#111827', '#c2410c', '#d6b370', '#475569'];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export function makeAgent(o = {}) {
  const root = new THREE.Group();
  const shirt = M(o.shirt ?? '#334155', { r: .8 });
  const pants = M(o.pants ?? '#1e293b', { r: .85 });
  const skin = M(o.skin ?? SKIN[Math.floor(rnd() * SKIN.length)], { r: .65 });
  const hair = M(o.hair ?? HAIR[Math.floor(rnd() * HAIR.length)], { r: .9 });
  const shoe = M('#0f172a', { r: .6 });

  const hips = new THREE.Group(); hips.position.y = 0.5; root.add(hips);
  const legs = [];
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(sx * 0.1, 0, 0); hips.add(p);
    const leg = new THREE.Mesh(G('leg', () => new THREE.CapsuleGeometry(0.075, 0.34, 3, 8)), pants);
    leg.position.y = -0.24; leg.castShadow = true; p.add(leg);
    const s = new THREE.Mesh(boxG(0.13, 0.07, 0.2), shoe); s.position.set(0, -0.47, 0.04); s.castShadow = true; p.add(s);
    legs.push(p);
  }
  const torso = new THREE.Mesh(G('torso', () => new THREE.CapsuleGeometry(0.19, 0.26, 4, 10)), shirt);
  torso.position.y = 0.74; torso.scale.set(1.05, 1, 0.78); torso.castShadow = true; root.add(torso);
  const belt = new THREE.Mesh(boxG(0.4, 0.06, 0.28), M('#1f2937', { r: .5 }));
  belt.position.set(0, 0.58, 0.02); root.add(belt);
  if (o.tie) { const tie = new THREE.Mesh(boxG(0.05, 0.22, 0.02), M(o.tie)); tie.position.set(0, 0.82, 0.15); root.add(tie); }
  const arms = [];
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(sx * 0.24, 0.92, 0); root.add(p);
    const a = new THREE.Mesh(G('arm', () => new THREE.CapsuleGeometry(0.058, 0.3, 3, 8)), shirt);
    a.position.y = -0.18; a.castShadow = true; p.add(a);
    const h = new THREE.Mesh(sphG(0.06, 8, 6), skin); h.position.y = -0.37; p.add(h);
    arms.push(p);
  }
  const headG = new THREE.Group(); headG.position.y = 1.2; root.add(headG);
  const neck = new THREE.Mesh(cylG(0.06, 0.06, 0.1, 8), skin); neck.position.y = -0.1; headG.add(neck);
  const head = new THREE.Mesh(sphG(0.22, 16, 12), skin); head.position.y = 0.12; head.castShadow = true; headG.add(head);
  const hairM = new THREE.Mesh(G('hair', () => new THREE.SphereGeometry(0.235, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), hair);
  hairM.position.set(0, 0.14, -0.015); hairM.rotation.x = -0.25; hairM.castShadow = true; headG.add(hairM);
  const eyeM = M('#0b0f19', { r: .3 });
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(sphG(0.025, 6, 5), eyeM); e.position.set(sx * 0.08, 0.13, 0.2); headG.add(e); }
  // status dot
  const dot = new THREE.Mesh(sphG(0.055, 10, 8), B('#22c55e'));
  dot.material = dot.material.clone(); dot.position.y = 0.55; dot.castShadow = false; headG.add(dot);
  // document in hand
  const doc = new THREE.Mesh(boxG(0.22, 0.3, 0.015), M('#f8fafc', { r: .5 }));
  doc.position.set(0, -0.42, 0.1); doc.rotation.x = -1.2; doc.visible = false; arms[1].add(doc);
  const bubbleAnchor = new THREE.Object3D(); bubbleAnchor.position.set(0.42, 1.35, 0.05); root.add(bubbleAnchor);

  root.userData = { legs, arms, headG, dot, doc, hips, bubbleAnchor, phase: rnd() * 10, mode: 'stand' };
  return root;
}
function nameTag(agent, staff, roomId) {
  if (!agent || !staff) return agent;
  agent.userData.room = roomId;
  agent.userData.staffId = staff.id;
  const el = document.createElement('div');
  el.className = 'ptag';
  el.dataset.room = roomId;
  el.dataset.staff = staff.id;
  el.textContent = '';
  const pn = document.createElement('span'); pn.className = 'pn'; pn.textContent = staff.name; el.appendChild(pn);
  const badge = document.createElement('i'); badge.className = 'gbadge'; el.appendChild(badge);
  const o = new CSS2DObject(el);
  o.position.set(0.85, 0.42, 0.2);
  o.center.set(0, 1);
  o.renderOrder = 1;
  agent.add(o);
  agent.userData.badgeEl = el;
  return agent;
}
export function setSeated(a) {
  const u = a.userData; u.mode = 'seated';
  u.legs.forEach(l => { l.rotation.x = -1.45; });
  a.position.y = 0.05;
}
function animateAgent(a, t, dt, mode) {
  const u = a.userData, p = u.phase;
  if (u.mode === 'seated') {
    if (mode === 'type') {
      u.arms[0].rotation.x = -1.15 + Math.sin(t * 16 + p) * 0.09;
      u.arms[1].rotation.x = -1.15 + Math.sin(t * 16 + p + 1.7) * 0.09;
      u.arms.forEach(x => x.rotation.z = 0);
      u.headG.rotation.x = 0.12 + Math.sin(t * 2 + p) * 0.04; u.headG.rotation.y = Math.sin(t * .5 + p) * 0.12;
    } else { // idle: relaxed, looking around, sometimes sipping
      u.arms[0].rotation.x = -0.55; u.arms[1].rotation.x = -0.55 - Math.max(0, Math.sin(t * .6 + p)) * 0.9;
      u.headG.rotation.y = Math.sin(t * .35 + p) * 0.6; u.headG.rotation.x = -0.05;
    }
  } else if (u.mode === 'walk') {
    const s = Math.sin(t * 8 + p);
    u.legs[0].rotation.x = s * 0.55; u.legs[1].rotation.x = -s * 0.55;
    u.arms[0].rotation.x = -s * 0.5; u.arms[1].rotation.x = u.doc.visible ? -0.9 : s * 0.5;
    a.position.y = Math.abs(Math.cos(t * 8 + p)) * 0.04;
  } else { // stand
    u.legs.forEach(l => l.rotation.x = 0);
    u.arms[0].rotation.x = Math.sin(t * 1.3 + p) * 0.05;
    u.arms[1].rotation.x = u.gesture ? -1.2 + Math.sin(t * 3) * 0.25 : Math.sin(t * 1.3 + p + 1) * 0.05;
    u.headG.rotation.y = Math.sin(t * .4 + p) * 0.3;
    a.position.y = 0;
  }
}

/* ---------------- furniture ---------------- */
const WOOD = '#b08463', WOOD_D = '#7c5a3e', METAL = '#2a3142', WHITE = '#e8ebf2';
function chair(parent, x, z, ry, accent) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  const dark = M('#1c2130', { r: .6 }), seat = M(accent, { r: .8 });
  cyl(g, 0.03, 0.03, 0.4, 0, 0.06, 0, M('#555e70', { m: .6, r: .4 }), 8);
  for (let i = 0; i < 5; i++) { const b = box(g, 0.05, 0.04, 0.3, 0, 0.03, 0, dark, { cast: false }); b.rotation.y = i * 1.2566; b.translateZ(0.13); }
  box(g, 0.5, 0.09, 0.48, 0, 0.44, 0, seat, { round: 0.04 });
  box(g, 0.46, 0.55, 0.08, 0, 0.6, 0.24, seat, { round: 0.04 }).rotation.x = -0.12;
  return g;
}
function plant(parent, x, z, s = 1, kind = 0, y = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
  const gold = kind % 2 === 1;
  cyl(g, 0.2, 0.15, 0.36, 0, 0, 0, M(gold ? '#7a5c32' : '#0a0a0a', { r: gold ? .32 : .72, m: gold ? .62 : .08 }), 8);
  const leaf = M(['#1f7a3a', '#3d8c4a', '#166534'][kind % 3], { r: .75, flat: true });
  const lg = G('leafico', () => new THREE.IcosahedronGeometry(0.28, 0));
  const pts = kind === 2 ? [[0, .62, 0, 1], [0, .95, 0, .8], [0, 1.22, 0, .55]] : [[0, .6, 0, 1], [.12, .82, .05, .75], [-.1, .86, -.06, .7], [.02, 1.05, 0, .55]];
  for (const [px, py, pz, sc] of pts) { const m = new THREE.Mesh(lg, leaf); m.position.set(px, py, pz); m.scale.setScalar(sc); m.rotation.set(px * 9, py * 5, pz); m.castShadow = false; g.add(m); }
  return g;
}
function buildGreenery(parent) {
  const spots = [];
  const add = (x, z, s, pot, h, y = 0) => spots.push({ x, z, s, pot, h, y });
  for (const def of Object.values(LAYOUT)) {
    const ix = def.w / 2 - 0.62, iz = def.d / 2 - 0.62, along = Math.min(1.45, def.w * 0.18);
    const corners = [[-ix + along, -iz, 1.15, 1, 2], [ix, -iz + along * 0.45, 0.82, 0, 1], [-ix, iz - along * 0.4, 0.78, 0, 1], [ix - along, iz, 1.05, 1, 2]];
    if (def.door === 'west') corners.splice(2, 1);
    corners.forEach(([lx, lz, s, pot, h], i) => add(def.x + lx, def.z + lz, s, (pot + i) % 2, h, FLOOR_H));
  }
  add(-6.6, 17.5, 1.45, 1, 2);
  add(6.6, 17.5, 1.3, 0, 2);
  add(-2.35, 17.9, 0.48, 1, 0);
  add(2.35, 17.9, 0.48, 0, 0);
  add(-3.5, 15.4, 0.9, 0, 1);
  add(3.5, 15.4, 0.9, 1, 1);
  const potGeo = new THREE.CylinderGeometry(0.2, 0.15, 0.34, 8);
  const soilGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 8);
  const leafGeo = new THREE.IcosahedronGeometry(0.26, 0);
  const mats = {
    black: M('#0a0a0a', { r: .72, m: .08 }),
    gold: M('#7a5c32', { m: .62, r: .32 }),
    soil: M('#1c1410', { r: .95 }),
    g0: M('#1f7a3a', { r: .72, flat: true }),
    g1: M('#3d8c4a', { r: .7, flat: true }),
    g2: M('#166534', { r: .74, flat: true }),
  };
  const buckets = { black: [], gold: [], soil: [], g0: [], g1: [], g2: [] };
  const dummy = new THREE.Object3D();
  const put = (key, x, y, z, sx, sy, sz, ry = 0) => {
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, ry, 0); dummy.updateMatrix();
    buckets[key].push(dummy.matrix.clone());
  };
  for (const s of spots) {
    const sc = s.s, y = s.y;
    put(s.pot ? 'gold' : 'black', s.x, y + 0.17 * sc, s.z, sc, sc, sc, s.x * 0.2);
    put('soil', s.x, y + 0.34 * sc, s.z, sc * 0.85, 1, sc * 0.85);
    if (s.h === 0) put('g1', s.x, y + 0.5 * sc, s.z, sc * 0.65, sc * 0.5, sc * 0.65, 0.4);
    else if (s.h === 2) {
      put('g2', s.x, y + 0.72 * sc, s.z, sc, sc * 1.2, sc, 0.3);
      put('g0', s.x + 0.04 * sc, y + 1.15 * sc, s.z, sc * 0.72, sc * 0.75, sc * 0.72, 1.1);
      put('g1', s.x - 0.03 * sc, y + 1.48 * sc, s.z, sc * 0.48, sc * 0.48, sc * 0.48, 0.7);
    } else {
      put('g0', s.x, y + 0.62 * sc, s.z, sc * 0.95, sc * 0.8, sc * 0.95, 0.5);
      put('g1', s.x + 0.06 * sc, y + 0.92 * sc, s.z, sc * 0.6, sc * 0.55, sc * 0.6, 1.3);
    }
  }
  const geos = { black: potGeo, gold: potGeo, soil: soilGeo, g0: leafGeo, g1: leafGeo, g2: leafGeo };
  for (const key of Object.keys(buckets)) {
    const list = buckets[key];
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(geos[key], mats[key], list.length);
    mesh.castShadow = false; mesh.receiveShadow = true;
    list.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    parent.add(mesh);
  }
}
function deskSet(parent, x, z, ry, team, opt = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  const top = M(opt.white ? '#e9e5df' : WOOD, { r: .55 }), leg = M('#1f2430', { m: .4, r: .5 });
  box(g, 1.5, 0.05, 0.72, 0, 0.72, 0, top, { round: 0.02 });
  box(g, 0.05, 0.72, 0.62, -0.7, 0, 0, leg); box(g, 0.05, 0.72, 0.62, 0.7, 0, 0, leg);
  box(g, 1.36, 0.3, 0.03, 0, 0.42, -0.3, leg);
  // monitors
  const kinds = opt.kinds ?? ['code', 'chart'];
  const n = opt.monitors ?? 2;
  const mStand = M('#111522', { r: .4, m: .3 });
  const mw = opt.wide ? 1.15 : 0.6, mh = opt.wide ? 0.64 : 0.37;
  const sw = opt.wide ? 1.05 : 0.56, sh = opt.wide ? 0.56 : 0.33;
  for (let i = 0; i < n; i++) {
    const mx = n === 1 ? 0 : (i - (n - 1) / 2) * 0.62, ang = n === 1 ? 0 : (i - (n - 1) / 2) * -0.35;
    const mg = new THREE.Group(); mg.position.set(mx, 0.77, -0.18); mg.rotation.y = ang; g.add(mg);
    box(mg, 0.18, 0.015, 0.14, 0, 0, 0, mStand); box(mg, 0.04, opt.wide ? 0.28 : 0.22, 0.03, 0, 0, -0.03, mStand);
    box(mg, mw, mh, 0.035, 0, opt.wide ? 0.28 : 0.18, 0, mStand, { round: 0.012 });
    const s = new THREE.Mesh(G('scr' + (opt.wide ? 'w' : ''), () => new THREE.PlaneGeometry(sw, sh)), screenMat(kinds[i % kinds.length], team.color, opt.dim));
    s.position.set(0, (opt.wide ? 0.28 : 0.18) + mh / 2 - 0.01, 0.019); mg.add(s);
  }
  if (opt.tablet) {
    box(g, 0.38, 0.02, 0.26, 0.38, 0.76, 0.1, M('#0f172a', { r: .28 }), { ry: -0.4 });
    box(g, 0.3, 0.012, 0.18, 0.38, 0.78, 0.1, M(team.color, { e: team.color, ei: 0.45, r: .2 }), { ry: -0.4, cast: false });
    box(g, 0.16, 0.012, 0.012, 0.55, 0.78, 0.22, M('#e2e8f0', { m: .4 }), { ry: 0.6, cast: false });
  }
  box(g, 0.42, 0.012, 0.16, -0.02, 0.775, 0.14, M('#232a38', { r: .45 }), { cast: false });
  const keys = new THREE.Mesh(G('keys', () => new THREE.PlaneGeometry(0.4, 0.14)), new THREE.MeshBasicMaterial({ map: keyTexture(), toneMapped: false }));
  keys.rotation.x = -Math.PI / 2; keys.position.set(-0.02, 0.786, 0.14); keys.userData.keep = true; g.add(keys);
  box(g, 0.07, 0.02, 0.1, 0.36, 0.77, 0.14, M('#1a1f2b'), { cast: false });
  if (opt.mug !== false) cyl(g, 0.04, 0.035, 0.1, -0.55, 0.77, 0.1, M(team.color, { r: .4 }), 8);
  if (opt.papers) { box(g, 0.24, 0.04, 0.32, 0.55, 0.77, 0.05, M('#dde3ec', { r: .9 }), { ry: 0.2 }); }
  if (opt.plant !== false) plant(g, opt.papers ? -0.42 : 0.55, 0.18, 0.32, 1, 0.775);
  const ch = chair(g, 0, 0.62, 0, opt.chair ?? '#2b3142');
  return { group: g, seat: new THREE.Vector3(0, 0, 0.58) };
}
function bookshelf(parent, x, z, ry, w = 1.4, h = 1.9, accents = []) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  const frame = M(WOOD_D, { r: .7 });
  box(g, w, h, 0.36, 0, 0, 0, frame);
  const inner = M('#3b2b20', { r: .9 });
  const shelves = Math.floor(h / 0.45);
  const bookCols = ['#141414', '#22201e', '#3a3632', '#6b5a40', '#8a7349', '#c4b496', '#1c1c1c', '#4a453f'];
  for (let s = 0; s < shelves; s++) {
    const y = 0.08 + s * (h - 0.1) / shelves;
    box(g, w - 0.08, (h - 0.1) / shelves - 0.04, 0.02, 0, y, 0.16, inner, { cast: false });
    let bx = -w / 2 + 0.1;
    while (bx < w / 2 - 0.15) {
      const bw = 0.05 + rnd() * 0.06, bh = 0.24 + rnd() * 0.13;
      if (rnd() > 0.12) box(g, bw, bh, 0.24, bx, y + 0.02, 0.19, M(bookCols[Math.floor(rnd() * bookCols.length)], { r: .8 }), { cast: false });
      bx += bw + 0.01;
    }
  }
  return g;
}
function whiteboard(parent, x, y, z, ry, w = 1.8, team) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  box(g, w + 0.08, 1.0, 0.04, 0, 0, 0, M('#cbd5e1', { m: .5, r: .3 }), { cast: false });
  box(g, w, 0.92, 0.02, 0, 0.04, 0.02, M('#f8fafc', { r: .25 }), { cast: false });
  const ink = M(team.color, { r: .5 }), ink2 = M('#334155');
  for (let i = 0; i < 4; i++) box(g, 0.4 + (i * 0.23) % 0.5, 0.04, 0.01, -w / 2 + 0.5 + (i % 2) * 0.05, 0.72 - i * 0.15, 0.035, i % 2 ? ink2 : ink, { cast: false });
  for (let i = 0; i < 5; i++) box(g, 0.08, 0.1 + i * 0.07, 0.01, w / 2 - 0.65 + i * 0.12, 0.2, 0.035, ink, { cast: false });
  return g;
}
function poster(parent, x, y, z, ry, w, h, color) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  box(g, w, h, 0.03, 0, 0, 0, M('#111827'), { cast: false });
  box(g, w - 0.08, h - 0.08, 0.01, 0, 0.04, 0.02, M(color, { r: .6 }), { cast: false });
  box(g, (w - 0.08) * .6, (h - 0.08) * .35, 0.01, -(w - 0.08) * .1, 0.1, 0.03, M('#f8fafc', { r: .6, op: .55 }), { cast: false });
  return g;
}
function floorLamp(parent, x, z, glowCol = '#fde68a') {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  cyl(g, 0.18, 0.2, 0.04, 0, 0, 0, M('#1f2937', { m: .5, r: .4 }), 12);
  cyl(g, 0.02, 0.02, 1.55, 0, 0.04, 0, M('#1f2937', { m: .5, r: .4 }), 6);
  cyl(g, 0.16, 0.24, 0.26, 0, 1.55, 0, M('#fef3c7', { e: glowCol, ei: 0.55, r: .8 }), 14, { cast: false });
  const pool = new THREE.PointLight('#fff4e0', 0.16, 5.4, 1.7);
  pool.position.set(0, 1.15, 0); g.add(pool);
  floorPools.push(pool);
  return g;
}
function cabinet(parent, x, z, ry, w = 0.5, h = 1.2, c = '#cbd5e1') {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  box(g, w, h, 0.55, 0, 0, 0, M(c, { m: .35, r: .45 }), { round: 0.02 });
  const n = Math.round(h / 0.4);
  for (let i = 0; i < n; i++) box(g, w * 0.4, 0.03, 0.02, 0, 0.25 + i * (h / n), 0.28, M('#475569', { m: .6 }), { cast: false });
  return g;
}
function rug(parent, x, z, w, d, c) {
  const m = new THREE.Mesh(rboxG(w, 0.02, d, 0.01), M('#101010', { r: .95 })); m.position.set(x, 0.01, z); m.receiveShadow = true; parent.add(m); return m;
}
function boxesStack(parent, x, z) {
  const k = M('#c08b5c', { r: .9 }), t = M('#d8b48a', { r: .9 });
  box(parent, 0.6, 0.45, 0.6, x, 0, z, k); box(parent, 0.6, 0.45, 0.6, x + 0.65, 0, z, t);
  box(parent, 0.55, 0.4, 0.55, x + 0.3, 0.45, z + 0.02, k, { ry: 0.15 });
  box(parent, 0.4, 0.3, 0.4, x - 0.05, 0.45, z - 0.05, t, { ry: -0.2 });
}

/* ---------------- room shell ---------------- */
const WALL_H = 2.4, FLOOR_H = 0.14;
const GOLD = '#D0B993', ORANGE = '#E87708', FLOOR_BLACK = '#060606', HOLO = '#7eb6d6';
const floorPools = [];
const windowPane = new THREE.MeshBasicMaterial({ color: 0x9ec3e0, toneMapped: false });
const smokeGlass = () => M('#9aa3ad', { r: .06, m: .28, op: 0.3, side: THREE.DoubleSide });
const goldFrame = () => M(GOLD, { m: .86, r: .24 });
let pendantGlow = null;
function roomShell(root, def, ctx) {
  const g = new THREE.Group(); g.position.set(def.x, FLOOR_H, def.z); root.add(g);
  const { w, d } = def;
  const slab = new THREE.Mesh(rboxG(w, FLOOR_H, d, 0.05), M(FLOOR_BLACK, { r: .9, m: .04 }));
  slab.position.y = -FLOOR_H / 2; slab.receiveShadow = true; g.add(slab);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, d - 0.12), M(FLOOR_BLACK, { r: .88, m: .06 }));
  fl.rotation.x = -Math.PI / 2; fl.position.y = 0.004; fl.receiveShadow = true; g.add(fl);
  const rail = goldFrame();
  box(g, w, 0.025, 0.035, 0, 0, d / 2 + 0.01, rail, { cast: false });
  box(g, 0.035, 0.025, d, w / 2 + 0.01, 0, 0, rail, { cast: false });

  const wallMat = smokeGlass();
  const trim = goldFrame();
  const hx = -w / 2, hz = -d / 2;
  if (def.walls !== 'glass') {
    // back (-z) wall with windows
    if (def.door === 'north') {
      const gap = 1.8, seg = (w - gap) / 2;
      box(g, seg, WALL_H, 0.04, -(gap + seg) / 2, 0, hz + 0.02, wallMat, { cast: false });
      box(g, seg, WALL_H, 0.04, (gap + seg) / 2, 0, hz + 0.02, wallMat, { cast: false });
    } else box(g, w, WALL_H, 0.04, 0, 0, hz + 0.02, wallMat, { cast: false });
    if (def.door === 'west') {
      const gap = 1.8, seg = (d - gap) / 2;
      box(g, 0.04, WALL_H, seg, hx + 0.02, 0, -(gap + seg) / 2, wallMat, { cast: false });
      box(g, 0.04, WALL_H, seg, hx + 0.02, 0, (gap + seg) / 2, wallMat, { cast: false });
    } else box(g, 0.04, WALL_H, d, hx + 0.02, 0, 0, wallMat, { cast: false });
    box(g, w, 0.1, 0.02, 0, 0, hz + 0.15, trim, { cast: false });
    box(g, 0.02, 0.1, d, hx + 0.15, 0, 0, trim, { cast: false });
    // top cap
    box(g, w + 0.02, 0.05, 0.18, 0, WALL_H, hz + 0.07, trim, { cast: false });
    box(g, 0.18, 0.05, d, hx + 0.07, WALL_H, 0, trim, { cast: false });
  }
  // sign plate on back wall (or stand)
  if (def.sign) {
    const sm = new THREE.MeshBasicMaterial({ map: signTexture(def.sign, def.signSub ?? '', def.color), toneMapped: false });
    sm.color.setScalar(0.95);
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), sm);
    if (def.id === 'ed') { sp.position.set(0, 2.78, hz + 0.66); sp.scale.setScalar(1.3); }
    else if (def.walls === 'glass') { sp.position.set(w / 2 - 1.2, 1.9, d / 2 + 0.03); }
    else { sp.position.set(w / 2 - 1.15, 1.95, hz + 0.15); }
    g.add(sp);
  }
  return g;
}
function glassRun(g, x0, z0, x1, z1, h, gaps = [], tint = '#9aa3ad', op = 0.28) {
  // glass panels from (x0,z0) to (x1,z1) with door gaps given as [t0,t1] fractions
  const glass = M(tint, { r: .06, m: .28, op, side: THREE.DoubleSide });
  const frame = M(GOLD, { m: .86, r: .24 });
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
  const segs = []; let t = 0;
  for (const [a, b] of gaps) { segs.push([t, a]); t = b; } segs.push([t, 1]);
  for (const [a, b] of segs) {
    if (b - a <= 0.001) continue;
    const L = (b - a) * len, mid = (a + b) / 2;
    const cx = x0 + (x1 - x0) * mid, cz = z0 + (z1 - z0) * mid;
    const p = new THREE.Mesh(boxG(L, h, 0.03), glass); p.position.set(cx, h / 2, cz); p.rotation.y = -ang; p.renderOrder = 2; g.add(p);
    const top = new THREE.Mesh(boxG(L, 0.05, 0.06), frame); top.position.set(cx, h, cz); top.rotation.y = -ang; top.castShadow = true; g.add(top);
    const bot = new THREE.Mesh(boxG(L, 0.06, 0.06), frame); bot.position.set(cx, 0.03, cz); bot.rotation.y = -ang; g.add(bot);
    const posts = Math.max(1, Math.round(L / 1.6));
    for (let i = 0; i <= posts; i++) {
      const tt = a + (b - a) * i / posts;
      const px = x0 + (x1 - x0) * tt, pz = z0 + (z1 - z0) * tt;
      const po = new THREE.Mesh(boxG(0.05, h, 0.05), frame); po.position.set(px, h / 2, pz); po.castShadow = true; g.add(po);
    }
  }
}
function windows(g, def) {
  const { w, d } = def; const hz = -d / 2, hx = -w / 2;
  const pane = windowPane, mull = M('#0f172a', { r: .4 });
  const n = Math.floor((w - 2.6) / 1.1);
  for (let i = 0; i < n; i++) {
    const x = hx + 0.9 + i * 1.1;
    const p = new THREE.Mesh(boxG(0.9, 1.1, 0.02), pane); p.position.set(x + 0.45, 1.45, hz + 0.15); g.add(p);
    box(g, 0.94, 0.05, 0.05, x + 0.45, 0.88, hz + 0.16, mull, { cast: false });
    box(g, 0.94, 0.05, 0.05, x + 0.45, 1.98, hz + 0.16, mull, { cast: false });
    box(g, 0.05, 1.12, 0.05, x + 0.45, 0.88, hz + 0.16, mull, { cast: false });
  }
}

/* ---------------- labels ---------------- */
function labelEl(def) {
  const el = document.createElement('div');
  el.className = 'rlabel' + (def.minor ? ' minor' : '');
  el.style.setProperty('--c', def.color);
  el.dataset.room = def.id;
  el.innerHTML = def.minor ? `<div class="nm">${def.label}</div>` :
    `<div class="ic">${def.icon}</div><div><div class="nmrow"><div class="nm">${def.label}</div><i class="gbadge" hidden></i></div><div class="st"><i class="dot idle"></i><span>空闲</span></div></div>`;
  return el;
}

/* ---------------- build ---------------- */
export const LAYOUT = {
  market:   { x: -13.5, z: -12, w: 10, d: 8.5, icon: '市', sign: '市场部', signSub: 'MARKETING & RESEARCH' },
  legal:    { x: 0,     z: -12, w: 11, d: 8.5, icon: '法', sign: '法务部', signSub: 'LEGAL' },
  proposal: { x: 13.5,  z: -12, w: 10, d: 8.5, icon: '策', sign: '策划部', signSub: 'PLANNING & PROPOSALS' },
  invest:   { x: -13.5, z: 0,   w: 10, d: 8.5, icon: '投', sign: '投资部', signSub: 'INVESTMENT' },
  ed:       { x: 0,     z: 0,   w: 11, d: 9,   icon: 'ED', walls: 'glass', sign: 'ED 中央指挥室', signSub: 'COMMAND CENTER' },
  info:     { x: 13.5,  z: 0,   w: 10, d: 8.5, icon: '信', sign: '信息部', signSub: 'AI NEWS & INFO' },
  corpfin:  { x: -13.5, z: 12,  w: 10, d: 8.5, icon: '会', sign: '会计部', signSub: 'ACCOUNTING' },
  logistics:{ x: 0,     z: 12,  w: 11, d: 8.5, icon: '物', sign: '物流部', signSub: 'LOGISTICS' },
  privfin:  { x: 13.5,  z: 12,  w: 10, d: 8.5, icon: '私', walls: 'glass', private: true, sign: '私人助理', signSub: 'PRIVATE · 仅 EDWARD' },
  lounge:   { x: 25.6, z: 0,   w: 9.4, d: 11, icon: '休', color: '#E87708', door: 'west', sign: '休息室', signSub: 'LOUNGE', label: '休息室' },
  archive:  { x: -25.8, z: -8, w: 8.4, d: 8.2, icon: '档', color: '#D0B993', sign: '档案室', signSub: 'ARCHIVE', label: '档案室' },
  meeting:  { x: -25.8, z: 8,   w: 9.2, d: 8.4, icon: '议', color: '#D0B993', sign: '会议室', signSub: 'MEETING', label: '会议室' },
  design:   { x: 25.6, z: 12,  w: 9.4, d: 8.2, icon: '设', color: '#E87708', door: 'west', sign: '设计部', signSub: 'DESIGN', label: '设计部' },
  showroom: { x: 25.6, z: -12, w: 9.4, d: 8.2, icon: '展', color: '#D0B993', door: 'west', gallery: true, sign: '品牌展厅', signSub: 'BRAND HALL', label: '品牌展厅' },
};

export function buildOffice(scene, teams) {
  seed = 11;
  const root = new THREE.Group(); scene.add(root);
  const staticG = new THREE.Group(); root.add(staticG);
  const dyn = new THREE.Group(); root.add(dyn);
  const rooms = {};
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
  const updaters = [];

  /* ground */
  const ft = floorTexture(); ft.repeat.set(28, 28);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), new THREE.MeshStandardMaterial({ map: ft, roughness: .9, color: '#ffffff' }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  // building base platform
  const base = new THREE.Mesh(rboxG(43.5, 0.1, 40, 0.05), M('#161d30', { r: .7 }));
  base.position.y = -0.04; base.receiveShadow = true; root.add(base);
  const edge = B(GOLD, { op: .55, boost: 1.2 });
  for (const [w, d, x, z] of [[43.5, .05, 0, 20], [43.5, .05, 0, -20], [.05, 40, 21.75, 0], [.05, 40, -21.75, 0]]) {
    const e = new THREE.Mesh(boxG(w, .04, d), edge); e.position.set(x, 0.02, z); root.add(e);
  }
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(150, 64), new THREE.MeshBasicMaterial({ map: skylineTexture() }));
  sky.position.set(0, 16, -34); root.add(sky);
  const sky2 = sky.clone(); sky2.position.set(-70, 26, 8); sky2.rotation.y = Math.PI / 2; root.add(sky2);
  // south gate on the central axis, due south of 物流部: wordmark above the news band
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.85), new THREE.MeshBasicMaterial({ map: logoTexture() }));
  logo.position.set(0, 2.55, 19.4); root.add(logo);
  box(staticG, 8.4, 3.7, 0.18, 0, 0, 19.15, M('#121a28', { r: .6 }), { cast: false });
  box(staticG, 2.4, 1.05, 0.7, 0, 0, 16.7, M('#d9c7a6', { r: .55 }), { round: 0.04 });
  box(staticG, 2.2, 0.06, 0.55, 0, 1.05, 16.7, M('#f4efe6', { r: .4 }), { cast: false });
  cyl(staticG, 0.12, 0.1, 0.22, -0.7, 1.11, 16.7, M('#111827', { m: .4 }), 10, { cast: false });
  plant(staticG, -4.6, 18.2, 1.25, 2); plant(staticG, 4.6, 18.2, 1.15, 0);
  const newsCanvas = document.createElement('canvas'); newsCanvas.width = 512; newsCanvas.height = 512;
  const newsCtx = newsCanvas.getContext('2d');
  const newsMap = new THREE.CanvasTexture(newsCanvas); newsMap.colorSpace = THREE.SRGBColorSpace; newsMap.wrapS = newsMap.wrapT = THREE.RepeatWrapping;
  const newsScreen = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), new THREE.MeshBasicMaterial({ map: newsMap, toneMapped: false }));
  newsScreen.position.set(0, 1.05, 19.32); root.add(newsScreen);
  box(staticG, 4.8, 1.35, 0.08, 0, 0.38, 19.22, M('#0b0f19'), { cast: false });
  const newsHit = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.6, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
  newsHit.position.set(0, 1.15, 19.35); newsHit.userData.room = 'news'; root.add(newsHit);
  // corridors: dark aisles with dashed glowing lines
  const aisleMat = new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.86, metalness: 0.04, color: '#c5ccd4' });
  const aisle = aisleMat;
  const dashM = B(GOLD, { op: .55, boost: 1.15 });
  const dashG = boxG(0.5, 0.012, 0.06);
  for (const z of [-6, 6]) {
    const a = new THREE.Mesh(boxG(42, 0.02, 2.6), aisle); a.position.set(0, 0.012, z); a.receiveShadow = true; staticG.add(a);
    for (let x = -20; x <= 20; x += 1.2) { const dm = new THREE.Mesh(dashG, dashM); dm.position.set(x, 0.03, z); root.add(dm); }
  }
  for (const x of [-6.75, 6.75]) {
    const a = new THREE.Mesh(boxG(2.4, 0.021, 38), aisle); a.position.set(x, 0.012, 0); a.receiveShadow = true; staticG.add(a);
    for (let z = -18; z <= 18; z += 1.2) { if (Math.abs(Math.abs(z) - 6) < 1.3) continue; const dm = new THREE.Mesh(dashG, dashM); dm.rotation.y = Math.PI / 2; dm.position.set(x, 0.03, z); root.add(dm); }
  }
  // corridor plants & benches
  for (const [x, z] of [[-20.5, -6], [20.5, -6], [-20.5, 6], [20.5, 6], [-6.75, -19], [6.75, -19], [-6.75, 19], [6.75, 19]]) plant(staticG, x, z, 1.1, 2);
  buildGreenery(staticG);

  /* rooms */
  for (const [id, L] of Object.entries(LAYOUT)) {
    const t = teamById[id];
    const def = { id, ...L, color: t?.color ?? L.color, label: t?.name ?? L.label };
    const g = roomShell(staticG, def);
    const R = rooms[id] = { id, def, group: g, agents: [], walkers: [], center: new THREE.Vector3(def.x, 0, def.z), team: t };
    // hit box
    const hit = new THREE.Mesh(new THREE.BoxGeometry(def.w, 3, def.d), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(def.x, 1.5, def.z); hit.userData.room = id; root.add(hit); R.hit = hit;
    // label
    const el = labelEl(def); R.labelEl = el;
    const lo = new CSS2DObject(el);
    if (def.id === 'ed') lo.position.set(def.x - 0.2, 5.6, def.z - def.d * 0.34);
    // 法务部 sits just north of ED; lift its plate so the member line clears ED's name.
    else if (def.id === 'legal') lo.position.set(def.x, 6.55, def.z - def.d * 0.1);
    else lo.position.set(def.x, def.minor ? 3.15 : 4.15, def.z - def.d * 0.1);
    // Meeting's status line is long; hang it toward the left edge so it misses 投资部.
    const anchorX = def.id === 'meeting' ? 0.92 : def.id === 'archive' ? 0.32 : def.x > 18 ? 0.92 : def.x < -18 ? 0.08 : 0.5;
    lo.center.set(anchorX, 1);
    lo.renderOrder = 3;
    root.add(lo); R.label = lo;
    // status lamp
    if (!def.minor && !def.gallery) {
      const lamp = new THREE.Group(); const lx = def.x - def.w / 2 + 0.45, lz = def.z - def.d / 2 + 0.45; lamp.position.set(lx, 3.05, lz); lamp.userData.base = 3.05; root.add(lamp);
      const core = new THREE.Mesh(sphG(0.2, 16, 12), B('#22c55e').clone()); core.userData.boost = 2.2; lamp.add(core);
      const halo = new THREE.Mesh(sphG(0.42, 16, 12), B('#22c55e', { op: .22, add: true }).clone()); lamp.add(halo);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 32), B('#22c55e').clone()); ring.userData.boost = 2.2; ring.rotation.x = Math.PI / 2; lamp.add(ring);
      const stem = new THREE.Mesh(cylG(0.012, 0.012, 0.8, 4), B('#334155')); stem.position.y = -0.55; lamp.add(stem);
      R.lamp = { group: lamp, core, halo, ring };
    }
    decorate(R, dyn, teamById);
  }

  /* ED hologram + connection arcs */
  const holo = new THREE.Group(); holo.position.set(0, FLOOR_H, 0); dyn.add(holo);
  const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshBasicMaterial({ color: HOLO, wireframe: true, transparent: true, opacity: .72, toneMapped: false }));
  ico.position.y = 2.05; holo.add(ico);
  const coreS = new THREE.Mesh(sphG(0.28, 16, 12), B(HOLO, { op: .55, add: true, boost: 1.15 })); coreS.position.y = 2.05; holo.add(coreS);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.85 + i * 0.22, 0.012, 6, 64), B(HOLO, { op: .55, add: true, boost: 1.2 }));
    r.position.y = 2.05; r.rotation.x = Math.PI / 2 + (i - 1) * 0.5; holo.add(r); rings.push(r);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 1.25, 24, 1, true), B(HOLO, { op: .1, add: true }));
  beam.position.y = 1.4; holo.add(beam);
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.42, 64), B(HOLO, { op: .4, add: true, boost: 1.15 }));
  floorRing.rotation.x = -Math.PI / 2; floorRing.position.y = 0.015; holo.add(floorRing);
  const floorRing2 = new THREE.Mesh(new THREE.RingGeometry(3.7, 3.74, 64), B(HOLO, { op: .22, add: true }));
  floorRing2.rotation.x = -Math.PI / 2; floorRing2.position.y = 0.015; holo.add(floorRing2);
  const holoLight = new THREE.PointLight(HOLO, 0.45, 8, 1.6); holoLight.position.set(0, 3.2, 0); holo.add(holoLight);

  const arcs = [];
  for (const id of ['market', 'legal', 'proposal', 'invest', 'info', 'corpfin', 'logistics', 'privfin']) {
    const R = rooms[id]; const c = R.def;
    const a = new THREE.Vector3(c.x, 2.9, c.z - c.d * 0.1), b = new THREE.Vector3(0, 2.2 + FLOOR_H, 0);
    const m = a.clone().lerp(b, 0.5); m.y = 6.2;
    const curve = new THREE.QuadraticBezierCurve3(a, m, b);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col(c.color).multiplyScalar(1.6), transparent: true, opacity: .45, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
    root.add(line);
    const pulse = new THREE.Mesh(sphG(0.11, 8, 6), B(c.color, { add: true, boost: 3 }));
    root.add(pulse);
    arcs.push({ id, curve, line, pulse, off: rnd() });
  }

  /* per-room soft colored lights */
  const roomLights = [];
  for (const id of ['market', 'legal', 'proposal', 'corpfin', 'logistics', 'privfin', 'invest', 'info']) {
    const R = rooms[id];
    const warm = R.def.color === ORANGE ? ORANGE : GOLD;
    const pl = new THREE.PointLight(warm, 0.16, 11, 1.6); pl.position.set(R.def.x + 1, 3.4, R.def.z + 1); root.add(pl);
    roomLights.push(pl);
  }

  /* walkers carrying documents to ED */
  const walkers = [];
  const walkerDefs = [
    { from: 'legal', path: [[1.4, -9.4], [1.8, -7.7], [1.8, -6], [-0.4, -6], [-0.4, -4.7], [-2.3, -4.4], [-2.6, -1.9]] },
    { from: 'proposal', path: [[9.9, -9.2], [9.7, -7.7], [9.7, -6], [0.4, -6], [0.4, -4.7], [2.3, -4.4], [2.3, -2.1]] },
    { from: 'info', path: [[12.2, 2.4], [13.2, 4.2], [13.2, 6], [6.75, 6], [6.75, -0.3], [5.2, -0.3], [3.6, -0.3]] },
    { from: 'market', path: [[-10.6, -9.2], [-10.4, -7.7], [-10.4, -6], [-6.75, -6], [-6.75, 0.3], [-5.2, 0.3], [-4.2, 0.3]] },
  ];
  for (const wd of walkerDefs) {
    const t = teamById[wd.from]; if (!t) continue;
    const a = makeAgent({ shirt: hex(mix(t.color, '#ffffff', 0.1)), pants: '#1e293b' });
    const pts = wd.path.map(([x, z]) => new THREE.Vector3(x, FLOOR_H, z));
    a.position.copy(pts[0]); a.userData.doc.visible = true; dyn.add(a);
    walkers.push({ agent: a, team: wd.from, pts, i: 0, dir: 1, wait: 1 + rnd() * 5, speed: 1.25 });
    rooms[wd.from].walkers.push(a);
  }

  /* lounge annex: short bridge from the east corridor, two visitors max */
  const lounge = rooms.lounge;
  const annex = new THREE.Mesh(rboxG(11.2, 0.1, 13.2, 0.06), M('#161d30', { r: .7 }));
  annex.position.set(lounge.def.x, -0.04, 0); annex.receiveShadow = true; staticG.add(annex);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 2.3), M('#12182a', { r: .6 }));
  bridge.position.set(20.2, 0.02, 0.15); bridge.receiveShadow = true; staticG.add(bridge);
  const westPad = new THREE.Mesh(rboxG(10.5, 0.1, 26, 0.05), M('#161d30', { r: .7 }));
  westPad.position.set(-25.8, -0.04, 0); westPad.receiveShadow = true; staticG.add(westPad);
  const westLinkA = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 2.1), M('#12182a', { r: .6 }));
  westLinkA.position.set(-20.6, 0.02, -8); westLinkA.receiveShadow = true; staticG.add(westLinkA);
  const westLinkB = westLinkA.clone(); westLinkB.position.set(-20.6, 0.02, 8); staticG.add(westLinkB);
  const loungeLight = new THREE.PointLight(ORANGE, 0.35, 9, 1.8);
  loungeLight.position.set(lounge.def.x, 3.1, 0.4); root.add(loungeLight);
  roomLights.push(loungeLight);
  const stSpan = lounge.labelEl?.querySelector('.st span');
  if (stSpan) stSpan.textContent = '暂无成员';
  lounge.occupancy = 0;

  const lingerSpots = [
    { pos: new THREE.Vector3(lounge.def.x - 1.15, FLOOR_H, lounge.def.z + 1.45), ry: Math.PI },
    { pos: new THREE.Vector3(lounge.def.x + 1.15, FLOOR_H, lounge.def.z + 3.1), ry: 0 },
  ];
  function loungePath(room) {
    const c = room.def, y = FLOOR_H;
    const door = new THREE.Vector3(lounge.def.x - lounge.def.w / 2 + 0.9, y, 0.15);
    if (c.x > 18) {
      return [
        new THREE.Vector3(c.x - c.w * 0.38, y, c.z),
        new THREE.Vector3(20.2, y, c.z),
        new THREE.Vector3(20.2, y, 0.15),
        door,
      ];
    }
    const aisleX = c.x < -2 ? -6.75 : (Math.abs(c.x) < 3 ? 0.5 : 6.75);
    return [
      new THREE.Vector3(c.x + Math.sign(aisleX - c.x) * c.w * 0.38, y, c.z),
      new THREE.Vector3(aisleX, y, c.z),
      new THREE.Vector3(aisleX, y, 0.35),
      new THREE.Vector3(19.4, y, 0.35),
      door,
    ];
  }
  const visitors = [];
  for (let i = 0; i < 2; i++) {
    const a = makeAgent({ shirt: i ? '#e7e5e4' : '#fed7aa', pants: '#1e293b' });
    a.visible = false; dyn.add(a);
    visitors.push({ agent: a, team: null, pts: [], i: 0, dir: 1, phase: 'idle', wait: 1.5 + i * 2.4, speed: 1.15, spot: i });
  }
  const meetRoom = rooms.meeting;
  const meetSeats = [[-1.3, -1.2], [1.3, -1.2], [-1.3, 1.2], [1.3, 1.2]].map(([x, z]) => new THREE.Vector3(meetRoom.def.x + x, FLOOR_H, meetRoom.def.z + z));
  const meeters = [];
  const meetFrom = ['market', 'proposal', 'logistics', 'design'];
  for (let i = 0; i < meetSeats.length; i++) {
    const tid = meetFrom[i];
    const a = makeAgent({ shirt: rooms[tid]?.def.color || '#bfdbfe', pants: '#1e293b' });
    a.visible = false; dyn.add(a);
    meeters.push({ agent: a, seat: meetSeats[i], phase: 'away', team: tid });
  }
  const designRoom = rooms.design;
  const showRoom = rooms.showroom;
  for (const R of [designRoom, showRoom]) {
    const pad = new THREE.Mesh(rboxG(R.def.w + 1.6, 0.1, R.def.d + 1.4, 0.05), M('#161d30', { r: .7 }));
    pad.position.set(R.def.x, -0.04, R.def.z); pad.receiveShadow = true; staticG.add(pad);
    const link = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 2.2), M('#12182a', { r: .6 }));
    link.position.set(20.2, 0.02, R.def.z); link.receiveShadow = true; staticG.add(link);
  }
  const designLight = new THREE.PointLight(ORANGE, 0.2, 9, 1.8);
  designLight.position.set(designRoom.def.x, 3.1, designRoom.def.z); root.add(designLight);
  roomLights.push(designLight);
  const showLight = new THREE.PointLight('#fff4e0', 0.18, 9, 1.8);
  showLight.position.set(showRoom.def.x, 3.1, showRoom.def.z); root.add(showLight);
  floorPools.push(showLight);
  const showLabel = showRoom.labelEl;
  showLabel.style.setProperty('--c', GOLD);
  showLabel.innerHTML = `<div class="ic">展</div><div><div class="nm">品牌展厅</div><div class="st"><span>展陈占位</span></div></div>`;
  const newsLabelEl = document.createElement('div');
  newsLabelEl.className = 'rlabel'; newsLabelEl.dataset.room = 'news'; newsLabelEl.style.setProperty('--c', GOLD);
  newsLabelEl.innerHTML = `<div class="ic">讯</div><div><div class="nm">新闻墙</div><div class="st"><i class="dot idle"></i><span>点击查看</span></div></div>`;
  const newsLabel = new CSS2DObject(newsLabelEl); newsLabel.position.set(0, 3.7, 19.2); newsLabel.center.set(0.5, 1); root.add(newsLabel);
  rooms.news = { id: 'news', hit: newsHit, labelEl: newsLabelEl, label: newsLabel, center: new THREE.Vector3(0, 0, 18.2), def: { icon: '讯', color: GOLD } };
  let newsLines = ['信息部简报将在此滚动显示'];
  function drawNews(shift) {
    const ctx = newsCtx; ctx.clearRect(0, 0, 512, 512); ctx.fillStyle = '#07111f'; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = GOLD; ctx.fillRect(0, 0, 512, 8);
    ctx.font = '700 36px sans-serif'; ctx.textAlign = 'left';
    const lines = newsLines.length ? newsLines : ['信息部简报将在此滚动显示'];
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#e2e8f0' : '#f8fafc';
      ctx.fillText(lines[i % lines.length], 28, 80 + i * 64 - (shift % 64));
    }
  }
  drawNews(0);
  let newsTick = 0, newsShift = 0;
  let occTick = 0;

  /* merge static geometry by material to cut draw calls */
  staticG.updateMatrixWorld(true);
  const buckets = new Map();
  const toRemove = [];
  staticG.traverse(o => {
    if (!o.isMesh || o.material.transparent || o.userData.keep) return;
    if (o.material.map && o.material.map.isCanvasTexture && o.geometry.type === 'PlaneGeometry' && o.material.isMeshBasicMaterial) { /* screens ok */ }
    const k = o.material.uuid + (o.castShadow ? 'c' : 'n');
    if (!buckets.has(k)) buckets.set(k, { mat: o.material, cast: o.castShadow, geos: [] });
    let gg = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(name)) gg.deleteAttribute(name);
    if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2));
    gg.applyMatrix4(o.matrixWorld);
    buckets.get(k).geos.push(gg); toRemove.push(o);
  });
  toRemove.forEach(o => o.parent.remove(o));
  const merged = new THREE.Group(); root.add(merged);
  for (const { mat, cast, geos } of buckets.values()) {
    const mg = mergeGeometries(geos, false); if (!mg) continue;
    const mesh = new THREE.Mesh(mg, mat); mesh.castShadow = cast; mesh.receiveShadow = true; merged.add(mesh);
  }
  // remaining (transparent etc.) stay in staticG

  const tmp = new THREE.Vector3();
  function update(t, dt, state) {
    // hologram
    ico.rotation.y += dt * 0.5; ico.rotation.x += dt * 0.2;
    rings.forEach((r, i) => { r.rotation.z += dt * (0.4 + i * 0.25) * (i % 2 ? -1 : 1); });
    coreS.scale.setScalar(1 + Math.sin(t * 2.2) * 0.08);
    floorRing.material.opacity = (0.32 + Math.sin(t * 1.5) * 0.1) * (1 + ((state.clock?.day ?? 1) < 0.45 ? 0.55 : 0));
    // arcs pulses
    for (const a of arcs) {
      const st = state.status[a.id];
      const active = st && st !== 'idle';
      a.pulse.visible = active && a.id !== 'privfin';
      a.line.material.opacity = active ? 0.55 : 0.16;
      if (a.pulse.visible) { const u = ((t * 0.28 + a.off) % 1); a.curve.getPoint(u, tmp); a.pulse.position.copy(tmp); }
    }
    // lamps
    for (const R of Object.values(rooms)) {
      if (!R.lamp) continue;
      const st = state.status[R.id] ?? 'idle';
      const night = (state.clock?.day ?? 1) < 0.45;
      const c = st === 'busy' ? ORANGE : st === 'confirm' ? GOLD : '#efe4cf';
      const lift = night ? 1.22 : 1;
      R.lamp.core.material.color.set(c).multiplyScalar(2.4 * lift); R.lamp.ring.material.color.set(c).multiplyScalar(2 * lift); R.lamp.halo.material.color.set(c);
      const k = st === 'confirm' ? 0.5 + 0.5 * Math.abs(Math.sin(t * 3)) : st === 'busy' ? 0.85 + 0.15 * Math.sin(t * 5) : 0.8;
      R.lamp.halo.material.opacity = 0.12 + 0.25 * k; R.lamp.halo.scale.setScalar(0.9 + 0.3 * k);
      R.lamp.ring.rotation.z += dt * (st === 'idle' ? 0.3 : 1.5);
      R.lamp.group.position.y = 3.0 + Math.sin(t * 1.2 + R.def.x) * 0.06;
      for (const a of R.agents) {
        a.userData.dot.material.color.set(c).multiplyScalar(2);
        animateAgent(a, t, dt, st === 'idle' ? 'idle' : 'type');
      }
    }
    // ED avatar
    if (rooms.ed.boss) { const b = rooms.ed.boss; b.userData.gesture = Math.sin(t * 0.7) > 0.6; animateAgent(b, t, dt); b.userData.dot.material.color.set(state.status.ed === 'confirm' ? GOLD : state.status.ed === 'busy' ? ORANGE : '#efe4cf'); }
    // walkers
    for (const w of walkers) {
      const st = state.status[w.team];
      const a = w.agent, u = a.userData;
      u.dot.material.color.set(st === 'busy' ? ORANGE : st === 'confirm' ? GOLD : '#efe4cf');
      if (w.wait > 0) {
        w.wait -= dt; u.mode = 'stand'; animateAgent(a, t, dt);
        if (w.wait <= 0 && !(st && st !== 'idle') && w.i === 0) w.wait = 3; // idle teams stay home
        continue;
      }
      const target = w.pts[w.i + w.dir];
      if (!target) { // reached an end
        if (w.i === w.pts.length - 1) { u.doc.visible = false; w.dir = -1; w.wait = 2.2; }
        else { w.dir = 1; w.wait = 5 + rnd() * 6; u.doc.visible = true; }
        continue;
      }
      u.mode = 'walk';
      tmp.subVectors(target, a.position); tmp.y = 0;
      const dist = tmp.length();
      const stp = w.speed * dt;
      if (dist <= stp) { a.position.x = target.x; a.position.z = target.z; w.i += w.dir; }
      else {
        tmp.multiplyScalar(stp / dist); a.position.x += tmp.x; a.position.z += tmp.z;
        const ang = Math.atan2(tmp.x, tmp.z); let da = ang - a.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
        a.rotation.y += da * Math.min(1, dt * 10);
      }
      animateAgent(a, t, dt);
    }
    // idle / standby staff drift into the lounge, at most two at a time
    const inside = (p) => Math.abs(p.x - lounge.def.x) < lounge.def.w / 2 && Math.abs(p.z - lounge.def.z) < lounge.def.d / 2;
    const loungePool = () => Object.values(rooms).filter(R => R.team && !R.team.private && state.status[R.id] === 'idle');
    let occ = 0;
    for (const v of visitors) {
      const a = v.agent, u = a.userData;
      const st = v.team ? state.status[v.team] : 'idle';
      u.dot.material.color.set(GOLD).multiplyScalar(1.4);
      if (v.phase === 'idle') {
        a.visible = false;
        v.wait -= dt;
        if (v.wait > 0) continue;
        const used = new Set(visitors.filter(o => o !== v && o.team).map(o => o.team));
        const pool = loungePool().filter(R => !used.has(R.id));
        const pick = pool.length ? pool[(Math.floor(t) + v.spot) % pool.length] : null;
        if (!pick) { v.wait = 2.5; continue; }
        v.team = pick.id;
        v.pts = loungePath(pick).concat([lingerSpots[v.spot % lingerSpots.length].pos]);
        v.i = 0; v.dir = 1; v.phase = 'go';
        a.position.copy(v.pts[0]); a.visible = true;
        continue;
      }
      if (st && st !== 'idle' && v.phase !== 'back') { v.phase = 'back'; v.dir = -1; }
      if (v.phase === 'linger') {
        occ++;
        if (!v.sat) {
          setSeated(a);
          a.position.y = FLOOR_H + 0.02;
          a.rotation.y = lingerSpots[v.spot % lingerSpots.length].ry;
          v.sat = true;
        }
        v.wait -= dt; animateAgent(a, t, dt, 'idle');
        if (v.wait <= 0) {
          v.sat = false; v.phase = 'back'; v.dir = -1;
          a.userData.mode = 'stand';
          a.userData.legs?.forEach(l => { l.rotation.x = 0; });
          a.position.y = FLOOR_H;
        }
        continue;
      }
      const target = v.pts[v.i + v.dir];
      if (!target) {
        if (v.dir > 0) { v.phase = 'linger'; v.wait = 6 + rnd() * 5; u.mode = 'stand'; }
        else { v.phase = 'idle'; v.team = null; v.wait = 7 + rnd() * 8; a.visible = false; }
        continue;
      }
      if (inside(a.position)) occ++;
      u.mode = 'walk';
      tmp.subVectors(target, a.position); tmp.y = 0;
      const dist = tmp.length(), stp = v.speed * dt;
      if (dist <= stp) { a.position.x = target.x; a.position.z = target.z; v.i += v.dir; }
      else {
        tmp.multiplyScalar(stp / dist); a.position.x += tmp.x; a.position.z += tmp.z;
        const ang = Math.atan2(tmp.x, tmp.z); let da = ang - a.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
        a.rotation.y += da * Math.min(1, dt * 10);
      }
      animateAgent(a, t, dt);
    }
    occTick -= dt;
    if (occTick <= 0) {
      occTick = 0.45;
      if (lounge.occupancy !== occ) {
        lounge.occupancy = occ;
        const span = lounge.labelEl?.querySelector('.st span');
        if (span) span.textContent = occ ? `${occ} 人在此` : '暂无成员';
        const sub = document.querySelector('.dcard[data-team="lounge"] .sub');
        if (sub) sub.textContent = `共享空间 · ${occ} 人在此`;
      }
    }
    const meetOn = !!state.clock?.meeting && !state.clock?.offDuty;
    for (const m of meeters) {
      const a = m.agent;
      if (!meetOn) { a.visible = false; m.phase = 'away'; continue; }
      if (m.phase === 'away') {
        a.visible = true;
        a.position.set(meetRoom.def.x + meetRoom.def.w / 2 + 0.7, FLOOR_H, meetRoom.def.z);
        m.phase = 'walk';
      }
      if (m.phase === 'walk') {
        tmp.set(m.seat.x - a.position.x, 0, m.seat.z - a.position.z);
        const dist = tmp.length();
        if (dist < 0.2) {
          a.position.x = m.seat.x; a.position.z = m.seat.z; m.phase = 'sit';
          setSeated(a);
          a.rotation.y = Math.atan2(meetRoom.def.x - a.position.x, meetRoom.def.z - a.position.z);
        } else {
          a.userData.mode = 'walk';
          tmp.multiplyScalar(Math.min(1, (1.15 * dt) / dist));
          a.position.x += tmp.x; a.position.z += tmp.z;
          a.rotation.y = Math.atan2(tmp.x, tmp.z);
          animateAgent(a, t, dt);
        }
      } else animateAgent(a, t, dt, 'idle');
    }
    if (state.clock?.offDuty) {
      for (const R of Object.values(rooms)) {
        if (R.id === 'ed') continue;
        for (const person of R.agents || []) person.visible = false;
        for (const person of R.walkers || []) person.visible = false;
      }
      for (const v of visitors) { v.agent.visible = false; v.sat = false; if (v.phase !== 'idle') { v.phase = 'idle'; v.team = null; v.wait = 4; } }
    } else {
      for (const R of Object.values(rooms)) {
        for (const person of R.agents || []) person.visible = true;
        for (const person of R.walkers || []) person.visible = true;
      }
    }
    newsTick += dt;
    if (newsTick > 0.08) { newsTick = 0; newsShift += 2; drawNews(newsShift); newsMap.needsUpdate = true; }
    if (loungeTv) { loungeTv.tick += dt; if (loungeTv.tick > 0.12) { loungeTv.tick = 0; paintLoungeTv(t); } }
    // server LEDs
    if (rooms.info?.leds) rooms.info.leds.forEach((o, i) => { o.m.color.copy(o.base).multiplyScalar((Math.sin(t * (3 + i * 1.7) + i) > 0.2) ? 1.4 : 0.35); });
    // screens subtle scroll
    for (const m of screenMats.values()) { if (m.map) m.map.offset.y = (Math.floor(t * 2) % 8) * 0.004; }
  }
  const cityLights = [];
  for (const [x, y, z] of [[-28, 10, -32], [-8, 12, -33], [12, 9, -32], [30, 11, -30], [-48, 8, 4]]) {
    const pl = new THREE.PointLight('#ffbf80', 0, 16, 2);
    pl.position.set(x, y, z); root.add(pl); cityLights.push(pl);
  }
  function applyAmbience(day) {
    const d = THREE.MathUtils.clamp(day, 0, 1);
    const night = 1 - d;
    sky.material.color.setRGB(0.07 + d * 0.9, 0.1 + d * 0.82, 0.16 + d * 0.78);
    windowPane.color.setHex(d > 0.45 ? 0xb7c9d6 : 0xffc98a);
    if (pendantGlow) pendantGlow.emissiveIntensity = 0.22 + night * 1.55;
    const glass = smokeGlass();
    glass.roughness = 0.08 - night * 0.035;
    const trim = goldFrame();
    trim.emissive.set(GOLD);
    trim.emissiveIntensity = night * 0.26;
    dashM.color.set(d > 0.55 ? '#e7d7b8' : '#d5dbe3');
    dashM.opacity = 0.26 + night * 0.55;
    holoLight.intensity = 0.4 + night * 0.9;
    ico.material.opacity = 0.62 + night * 0.28;
    coreS.material.opacity = 0.42 + night * 0.28;
    beam.material.opacity = 0.08 + night * 0.1;
    for (const pl of roomLights) pl.intensity = 0.14 + night * 0.95;
    for (const pl of floorPools) pl.intensity = 0.1 + night * 1.15;
    for (const pl of cityLights) pl.intensity = night * 0.7;
  }
  function setNews(items) {
    const lines = (items || []).map(n => n && n.title).filter(Boolean);
    if (lines.length) newsLines = lines;
  }
  return { rooms, update, walkers, root, applyAmbience, setNews };
}

function agendaTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 288;
  const g = c.getContext('2d');
  g.fillStyle = '#0c1a2e'; g.fillRect(0, 0, 512, 288);
  g.fillStyle = '#D0B993'; g.fillRect(0, 0, 512, 8);
  g.fillStyle = '#f8fafc'; g.font = '700 32px sans-serif'; g.textAlign = 'center';
  g.fillText('每周一 9:00 跨部门例会', 256, 110);
  g.fillText('每月 1 日 10:00 发展规划会', 256, 175);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function loungeBoardTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 288;
  const g = c.getContext('2d');
  g.fillStyle = '#102033'; g.fillRect(0, 0, 512, 288);
  g.fillStyle = '#E87708'; g.fillRect(0, 0, 512, 10);
  g.fillStyle = '#f8fafc'; g.font = '700 46px "PingFang SC","Noto Sans SC",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('本周跨部门例会', 256, 132);
  g.fillStyle = '#8b97b0'; g.font = '500 24px sans-serif'; g.fillText('周一  9:00', 256, 196);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function furnishLounge(g, def) {
  const W = def.w, D = def.d;
  const sofaM = M('#b45309', { r: .82 });
  const sofa = (x, z, ry) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s);
    box(s, 2.05, 0.36, 0.78, 0, 0.28, 0, sofaM, { round: 0.08 });
    box(s, 2.05, 0.5, 0.18, 0, 0.48, -0.32, sofaM, { round: 0.06 });
    box(s, 0.18, 0.42, 0.78, -0.96, 0.36, 0, sofaM, { round: 0.05 });
    box(s, 0.18, 0.42, 0.78, 0.96, 0.36, 0, sofaM, { round: 0.05 });
  };
  sofa(-1.15, 2.15, Math.PI);
  sofa(-1.15, -0.35, 0);
  // existing coffee table between the sofas
  cyl(g, 0.55, 0.55, 0.06, -1.15, 0.42, 0.9, M(WOOD, { r: .45 }), 20);
  cyl(g, 0.06, 0.08, 0.42, -1.15, 0, 0.9, M('#1f2937'), 8);
  chair(g, -0.35, 0.9, -Math.PI / 2, '#92400e');
  // dining table, set south of the sofa zone so people can walk between them
  const dineX = 1.15, dineZ = 4.15;
  cyl(g, 0.72, 0.72, 0.06, dineX, 0.72, dineZ, M('#c4a574', { r: .42 }), 22);
  cyl(g, 0.08, 0.1, 0.72, dineX, 0, dineZ, M('#1f2937'), 8);
  chair(g, dineX, dineZ - 1.05, Math.PI, '#44403c');
  chair(g, dineX, dineZ + 1.05, 0, '#44403c');
  chair(g, dineX - 1.05, dineZ, Math.PI / 2, '#44403c');
  chair(g, dineX + 1.05, dineZ, -Math.PI / 2, '#44403c');
  // coffee bar along the east wall
  const bar = M('#1f2937', { r: .45, m: .35 });
  box(g, 0.7, 1.05, 2.6, W / 2 - 0.55, 0, -1.35, bar, { round: 0.03 });
  box(g, 0.74, 0.06, 2.65, W / 2 - 0.55, 1.05, -1.35, M('#d6d3d1', { r: .35 }), { round: 0.02 });
  const machine = new THREE.Group(); machine.position.set(W / 2 - 0.55, 1.11, -1.85); g.add(machine);
  box(machine, 0.46, 0.42, 0.38, 0, 0.21, 0, M('#1c1917', { m: .72, r: .28 }), { round: 0.03 });
  box(machine, 0.16, 0.1, 0.03, 0.02, 0.38, 0.19, M('#f59e0b', { e: '#fbbf24', ei: 0.9 }), { cast: false });
  cyl(machine, 0.045, 0.05, 0.07, -0.12, 0, 0.18, M('#f8fafc', { r: .35 }), 8);
  cyl(machine, 0.045, 0.05, 0.07, 0.08, 0, 0.2, M('#e7e5e4', { r: .35 }), 8);
  cyl(g, 0.055, 0.05, 0.07, W / 2 - 0.78, 1.11, -0.85, M('#f8fafc', { r: .35 }), 8);
  cyl(g, 0.055, 0.05, 0.07, W / 2 - 0.42, 1.11, -0.7, M('#44403c', { r: .4 }), 8);
  // tall two-door fridge
  const steel = M('#d7dde6', { m: .82, r: .22 });
  box(g, 0.72, 1.85, 0.68, W / 2 - 0.5, 0, 1.15, steel, { round: 0.03 });
  box(g, 0.02, 1.7, 0.02, W / 2 - 0.5, 0.08, 1.48, M('#94a3b8', { m: .7, r: .3 }), { cast: false });
  box(g, 0.03, 0.55, 0.03, W / 2 - 0.22, 1.15, 1.48, M('#334155', { m: .6 }), { cast: false });
  box(g, 0.03, 0.55, 0.03, W / 2 - 0.78, 1.15, 1.48, M('#334155', { m: .6 }), { cast: false });
  // standing water cooler against the east wall, between the bar and the fridge
  const coolX = W / 2 - 0.48, coolZ = 0.15;
  box(g, 0.4, 1.02, 0.4, coolX, 0, coolZ, M('#eef2f6', { m: .45, r: .3 }), { round: 0.04 });
  cyl(g, 0.14, 0.14, 0.46, coolX, 1.02, coolZ, M('#3b82f6', { m: .12, r: .22, op: 0.82 }), 12);
  box(g, 0.07, 0.04, 0.05, coolX - 0.18, 0.78, coolZ, M('#334155', { m: .4 }), { cast: false });
  cyl(g, 0.045, 0.04, 0.06, coolX - 0.22, 0.62, coolZ, M('#f8fafc', { r: .35 }), 8);
  // east + south walls, door stays on the west
  const wallMat = smokeGlass();
  const gold = goldFrame();
  box(g, 0.04, WALL_H, D, W / 2 - 0.02, 0, 0, wallMat, { cast: false });
  box(g, W, WALL_H, 0.04, 0, 0, D / 2 - 0.02, wallMat, { cast: false });
  box(g, 0.045, 0.04, D, W / 2, WALL_H - 0.02, 0, gold, { cast: false });
  box(g, W, 0.04, 0.045, 0, WALL_H - 0.02, D / 2, gold, { cast: false });
  // wall-mounted flat TV, with the weekly meeting plaque beside it
  box(g, 1.15, 0.42, 0.04, -2.15, 1.55, -D / 2 + 0.16, M('#1e293b'), { cast: false });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.32), new THREE.MeshBasicMaterial({ map: loungeBoardTexture(), toneMapped: false }));
  plaque.position.set(-2.15, 1.78, -D / 2 + 0.2); plaque.userData.keep = true; g.add(plaque);
  box(g, 1.85, 1.05, 0.06, 0.55, 1.35, -D / 2 + 0.12, M('#111827', { r: .35, m: .4 }), { cast: false });
  const art = loungeTvArt();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 0.9), new THREE.MeshBasicMaterial({ map: art.tex, toneMapped: false }));
  screen.position.set(0.55, 1.9, -D / 2 + 0.18); screen.userData.keep = true; g.add(screen);
  loungeTv = art;
  // console shelf and two controllers
  box(g, 1.15, 0.08, 0.38, 0.55, 0.72, -D / 2 + 0.55, M('#1f2937', { r: .4 }), { round: 0.02 });
  box(g, 0.32, 0.08, 0.22, 0.35, 0.8, -D / 2 + 0.52, M('#0f172a', { m: .35, r: .4 }), { round: 0.02 });
  box(g, 0.05, 0.02, 0.05, 0.46, 0.86, -D / 2 + 0.52, M('#22c55e', { e: '#22c55e', ei: 0.8 }), { cast: false });
  const pad = M('#1e293b', { r: .55 });
  box(g, 0.16, 0.025, 0.08, 0.72, 0.82, -D / 2 + 0.5, pad, { round: 0.02, cast: false });
  box(g, 0.16, 0.025, 0.08, 0.96, 0.82, -D / 2 + 0.5, pad, { round: 0.02, cast: false });
  plant(g, -W / 2 + 0.55, -D / 2 + 0.7, 1.15, 2);
  plant(g, W / 2 - 1.3, D / 2 - 0.7, 1.05, 0);
  plant(g, -W / 2 + 0.6, D / 2 - 0.65, 0.9, 1);
  plant(g, W / 2 - 0.72, -0.35, 0.34, 1, 1.12);
  floorLamp(g, W / 2 - 1.15, -D / 2 + 0.8, '#fdba74');
  rug(g, -1.15, 0.9, 3.1, 3.2, '#e7d3b0');
  rug(g, 1.15, 4.15, 2.6, 2.6, '#d6c2a4');
}
let loungeTv = null;
function loungeTvArt() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 144;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return { c, ctx, tex, tick: 0 };
}
function paintLoungeTv(time) {
  if (!loungeTv) return;
  const { ctx, tex } = loungeTv;
  const g = ctx.createLinearGradient(0, 0, 256, 144);
  const h = (time * 8) % 360;
  g.addColorStop(0, `hsl(${h}, 42%, 28%)`);
  g.addColorStop(0.5, `hsl(${(h + 40) % 360}, 35%, 42%)`);
  g.addColorStop(1, `hsl(${(h + 80) % 360}, 30%, 18%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 144);
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.beginPath(); ctx.arc(70 + Math.sin(time * 0.4) * 18, 78, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,244,214,.35)';
  ctx.fillRect(150, 40 + Math.sin(time * 0.7) * 6, 46, 28);
  tex.needsUpdate = true;
}

/* ---------------- per-room decoration ---------------- */
function decorate(R, dyn, teamById) {
  const { def, group: g } = R; const id = def.id;
  const t = teamById[id] ?? { color: def.color };
  const W = def.w, D = def.d, bx = -W / 2, bz = -D / 2;
  const accentChair = hex(mix(def.color, '#1f2937', 0.55));
  const idle = t.status === 'idle';
  const seat = (ds, shirt, opts = {}) => {
    const a = makeAgent({ shirt, ...opts });
    const p = ds.group.localToWorld(ds.seat.clone());
    // place in room-local coords of dyn (world)
    ds.group.updateMatrixWorld(true);
    const wp = ds.seat.clone().applyMatrix4(ds.group.matrixWorld);
    a.position.copy(wp); a.rotation.y = ds.group.rotation.y + Math.PI + (g.rotation?.y ?? 0);
    setSeated(a); a.position.y += wp.y; dyn.add(a); R.agents.push(a); return a;
  };
  g.updateMatrixWorld(true);
  const shirtA = hex(mix(def.color, '#ffffff', 0.15)), shirtB = hex(mix(def.color, '#0f172a', 0.35));

  if (id === 'ed') {
    // big meeting table
    const top = M('#2a1f18', { r: .35, m: .1 });
    box(g, 5.2, 0.08, 1.9, 0, 0.72, 0, top, { round: 0.04 });
    box(g, 0.5, 0.72, 0.5, -1.8, 0, 0, M('#151a26', { m: .4 })); box(g, 0.5, 0.72, 0.5, 1.8, 0, 0, M('#151a26', { m: .4 }));
    cyl(g, 0.35, 0.4, 0.08, 0, 0.8, 0, M('#0f172a', { m: .7, r: .3 }), 20);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const cx = -1.95 + i * 1.3; chair(g, cx, s * 1.3, s > 0 ? 0 : Math.PI, '#334155');
      box(g, 0.32, 0.01, 0.22, cx, 0.8, s * 0.6, M('#dfe5ee', { r: .9 }), { cast: false });
    }
    // ED avatar at head
    chair(g, -3.1, 0, -Math.PI / 2, '#0e7490');
    const boss = makeAgent({ shirt: '#1e3a5f', pants: '#111827', tie: '#dc2626', hair: '#111827', skin: '#e9bf9c' });
    boss.position.set(def.x - 3.15, FLOOR_H, def.z + 0.9); boss.rotation.y = Math.PI / 2 + 0.3; dyn.add(boss); R.boss = boss;
    boss.userData.bubbleAnchor.position.set(-0.35, 2.9, -0.45);
    if (!t.private) nameTag(boss, (t.staff || [])[0], id);
    // big display stand at back
    const scr = new THREE.Group(); scr.position.set(0, 0, bz + 0.6); g.add(scr);
    box(scr, 0.12, 1.2, 0.12, -1.4, 0, 0, M('#111827', { m: .5 })); box(scr, 0.12, 1.2, 0.12, 1.4, 0, 0, M('#111827', { m: .5 }));
    box(scr, 3.3, 1.4, 0.08, 0, 1.05, 0, M('#0b0f19', { r: .3 }));
    const big = new THREE.Mesh(new THREE.PlaneGeometry(3.15, 1.25), screenMat('dash', GOLD, false)); big.position.set(0, 1.75, 0.045); scr.add(big);
    plant(g, bx + 0.6, bz + 0.6, 1.2, 1); plant(g, W / 2 - 0.6, bz + 0.6, 1.2, 1);
    plant(g, bx + 0.6, D / 2 - 0.6, 1, 0); plant(g, W / 2 - 0.6, D / 2 - 0.6, 1, 0);
    rug(g, 0, 0, 7, 3.6, '#0a2230');
    glassRun(g, -W / 2, -D / 2, W / 2, -D / 2, 1.05, [[0.42, 0.58]]);
    glassRun(g, -W / 2, D / 2, W / 2, D / 2, 1.05, [[0.42, 0.58]]);
    glassRun(g, -W / 2, -D / 2, -W / 2, D / 2, 1.05, [[0.4, 0.6]]);
    glassRun(g, W / 2, -D / 2, W / 2, D / 2, 1.05, [[0.4, 0.6]]);
    return;
  }
  // ---------- team rooms ----------
  if (def.walls !== 'glass') windows(g, def);
  const desks = [];
  if (id === 'market') {
    desks.push(deskSet(g, -2.6, bz + 1.0, 0, t, { kinds: ['chart', 'dash'], chair: accentChair }));
    desks.push(deskSet(g, -0.7, bz + 1.0, 0, t, { kinds: ['code', 'chart'], chair: accentChair }));
    desks.push(deskSet(g, bx + 1.0, 0.6, Math.PI / 2, t, { kinds: ['dash', 'chart'], chair: accentChair, papers: true }));
    whiteboard(g, 2.3, 0.9, bz + 0.17, 0, 2.0, t);
    bookshelf(g, bx + 0.35, -1.9, Math.PI / 2, 1.4, 1.9); plant(g, 3.9, -1.2, 1.1, 0); plant(g, 1.0, bz + 0.6, 0.9, 1);
    rug(g, 1.8, 1.2, 3.2, 2.2, hex(mix(def.color, '#e2e8f0', 0.6)));
    box(g, 1.2, 0.06, 0.7, 1.8, 0.42, 1.2, M('#cbd5e1', { r: .4 }), { round: 0.03 }); cyl(g, 0.05, 0.05, 0.42, 1.8, 0, 1.2, M('#1f2937'));
    chair(g, 1.8, 2.0, 0, '#475569'); chair(g, 1.8, 0.4, Math.PI, '#475569'); floorLamp(g, 3.9, 2.8);
  } else if (id === 'legal') {
    desks.push(deskSet(g, -3.0, bz + 1.0, 0, t, { kinds: ['doc', 'code'], chair: accentChair, papers: true }));
    desks.push(deskSet(g, -1.1, bz + 1.0, 0, t, { kinds: ['doc', 'doc'], chair: accentChair }));
    desks.push(deskSet(g, bx + 1.0, 0.9, Math.PI / 2, t, { kinds: ['doc', 'chart'], chair: accentChair, papers: true }));
    bookshelf(g, 1.4, bz + 0.35, 0, 1.6, 2.0); bookshelf(g, 3.1, bz + 0.35, 0, 1.6, 2.0);
    cabinet(g, 4.9, -1.5, -Math.PI / 2, 0.55, 1.2); cabinet(g, 4.9, -0.85, -Math.PI / 2, 0.55, 1.2);
    // small conference round table
    cyl(g, 0.65, 0.65, 0.05, 2.2, 0.72, 1.3, M(WOOD_D, { r: .4 }), 20); cyl(g, 0.06, 0.25, 0.72, 2.2, 0, 1.3, M('#1f2937'), 10);
    chair(g, 2.2, 2.2, 0, '#475569'); chair(g, 3.1, 1.0, Math.PI / 2 + 0.3, '#475569'); chair(g, 1.3, 1.0, -Math.PI / 2 - 0.3, '#475569');
    box(g, 0.3, 0.06, 0.4, 2.1, 0.77, 1.25, M('#dfe5ee', { r: .9 }), { ry: .3 });
    plant(g, bx + 0.6, D / 2 - 0.7, 1.2, 2); plant(g, -0.1, bz + 0.6, 0.9, 1); floorLamp(g, 4.8, 2.9);
    rug(g, 2.2, 1.3, 2.6, 2.4, hex(mix(def.color, '#e2e8f0', 0.65)));
  } else if (id === 'proposal') {
    desks.push(deskSet(g, -2.4, bz + 1.0, 0, t, { kinds: ['doc', 'dash'], chair: accentChair, papers: true }));
    desks.push(deskSet(g, bx + 1.0, 0.4, Math.PI / 2, t, { kinds: ['doc', 'code'], chair: accentChair }));
    whiteboard(g, 1.6, 0.9, bz + 0.17, 0, 2.2, t);
    // printer station
    box(g, 0.9, 0.75, 0.6, 3.9, 0, -2.6, M('#475569', { r: .6 }), { round: 0.02 });
    box(g, 0.75, 0.35, 0.5, 3.9, 0.75, -2.6, M('#e5e7eb', { r: .4 }), { round: 0.04 });
    box(g, 0.28, 0.03, 0.36, 3.9, 1.1, -2.55, M('#dfe5ee', { r: .9 }));
    // document stacks
    for (let i = 0; i < 3; i++) box(g, 0.32, 0.12 + i * 0.06, 0.42, 2.4 + i * 0.4, 0.72, 1.2, M('#dde3ec', { r: .9 }), { ry: i * 0.2 });
    box(g, 2.0, 0.05, 1.0, 2.8, 0.72, 1.2, M(WOOD, { r: .5 }), { round: 0.02 }); box(g, 0.06, 0.72, 0.9, 1.85, 0, 1.2, M('#1f2937')); box(g, 0.06, 0.72, 0.9, 3.75, 0, 1.2, M('#1f2937'));
    chair(g, 2.8, 2.0, 0, '#475569');
    bookshelf(g, bx + 0.35, -2.2, Math.PI / 2, 1.2, 1.6); plant(g, 4.1, 2.9, 1.2, 0); plant(g, -0.6, bz + 0.6, 0.9, 1); floorLamp(g, bx + 0.6, 3.0);
    rug(g, -1.2, 1.6, 3, 2, hex(mix(def.color, '#e2e8f0', 0.65)));
  } else if (id === 'corpfin') {
    desks.push(deskSet(g, -2.3, bz + 1.0, 0, t, { kinds: ['chart', 'chart'], chair: accentChair, dim: idle }));
    desks.push(deskSet(g, -0.3, bz + 1.0, 0, t, { kinds: ['dash', 'chart'], chair: accentChair, papers: true, dim: idle }));
    cabinet(g, bx + 0.45, -2.4, Math.PI / 2, 0.55, 1.3); cabinet(g, bx + 0.45, -1.75, Math.PI / 2, 0.55, 1.3); cabinet(g, bx + 0.45, -1.1, Math.PI / 2, 0.55, 1.3);
    box(g, 0.7, 0.9, 0.6, 2.6, 0, bz + 0.5, M('#374151', { m: .6, r: .35 }), { round: 0.04 });
    cyl(g, 0.12, 0.12, 0.04, 2.6, 0.55, bz + 0.81, M('#cbd5e1', { m: .8 }), 12).rotation.x = Math.PI / 2;
    poster(g, 1.0, 1.0, bz + 0.16, 0, 1.0, 0.8, def.color);
    box(g, 2.4, 0.05, 1.1, 1.6, 0.72, 1.4, M('#b9a58f', { r: .45 }), { round: 0.03 }); box(g, 0.06, 0.72, 1.0, 0.45, 0, 1.4, M('#1f2937')); box(g, 0.06, 0.72, 1.0, 2.75, 0, 1.4, M('#1f2937'));
    for (const cx of [0.9, 2.3]) { chair(g, cx, 2.2, 0, '#475569'); chair(g, cx, 0.6, Math.PI, '#475569'); }
    plant(g, 4.1, -2.9, 1.2, 2); plant(g, bx + 0.6, 3.1, 1.1, 0); floorLamp(g, 4.2, 3.0);
    rug(g, 1.6, 1.4, 3.6, 2.6, hex(mix(def.color, '#e2e8f0', 0.6)));
  } else if (id === 'logistics') {
    desks.push(deskSet(g, -3.0, bz + 1.0, 0, t, { kinds: ['dash', 'code'], chair: accentChair, dim: idle }));
    desks.push(deskSet(g, -1.1, bz + 1.0, 0, t, { kinds: ['chart', 'dash'], chair: accentChair, dim: idle }));
    boxesStack(g, 2.5, -2.6); boxesStack(g, 3.9, -2.4);
    // pallet
    box(g, 1.2, 0.14, 1.0, 3.6, 0, 0.2, M('#a16207', { r: .9 })); box(g, 1.0, 0.6, 0.8, 3.6, 0.14, 0.2, M('#d8b48a', { r: .9 }), { ry: 0.05 });
    // mini shipping container model
    box(g, 1.8, 0.7, 0.75, 1.2, 0, 1.8, M('#0f766e', { r: .6 }), { round: 0.02 });
    for (let i = 0; i < 8; i++) box(g, 0.04, 0.62, 0.02, 0.4 + i * 0.22, 0.04, 2.18, M('#115e59'), { cast: false });
    // world map poster
    poster(g, 1.4, 0.95, bz + 0.16, 0, 1.8, 1.0, '#134e4a');
    cabinet(g, bx + 0.45, -0.4, Math.PI / 2, 0.55, 1.2);
    plant(g, bx + 0.6, 3.1, 1.2, 2); plant(g, 4.8, 3.1, 1.0, 1); floorLamp(g, -0.2, 2.8);
    rug(g, -2, 1.4, 3, 2.2, hex(mix(def.color, '#e2e8f0', 0.65)));
  } else if (id === 'invest') {
    desks.push(deskSet(g, -2.6, bz + 1.0, 0, t, { kinds: ['chart', 'chart'], chair: accentChair, dim: idle }));
    desks.push(deskSet(g, -0.7, bz + 1.0, 0, t, { kinds: ['dash', 'chart'], chair: accentChair, dim: idle, papers: true }));
    // market ticker wall screen
    box(g, 2.3, 1.15, 0.06, 2.4, 1.0, bz + 0.18, M('#0b0f19', { r: .3 }), { cast: false });
    const tk = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 1.0), screenMat('chart', t.color, idle)); tk.position.set(2.4, 1.575, bz + 0.215); g.add(tk);
    bookshelf(g, bx + 0.35, -1.6, Math.PI / 2, 1.4, 1.9);
    // lounge corner: sofa + coffee table
    const sofaM = M(hex(mix(def.color, '#334155', 0.55)), { r: .9 });
    const sofa = new THREE.Group(); sofa.position.set(1.6, 0, 2.2); sofa.rotation.y = Math.PI; g.add(sofa);
    box(sofa, 2.2, 0.42, 0.9, 0, 0, 0, sofaM, { round: 0.08 }); box(sofa, 2.2, 0.55, 0.24, 0, 0.35, -0.34, sofaM, { round: 0.1 });
    box(sofa, 0.24, 0.3, 0.9, -1.1, 0.35, 0, sofaM, { round: 0.1 }); box(sofa, 0.24, 0.3, 0.9, 1.1, 0.35, 0, sofaM, { round: 0.1 });
    box(g, 1.2, 0.06, 0.6, 1.6, 0.38, 1.0, M(WOOD, { r: .4 }), { round: 0.03 }); cyl(g, 0.05, 0.05, 0.38, 1.6, 0, 1.0, M('#1f2937'));
    box(g, 0.24, 0.02, 0.32, 1.4, 0.44, 1.0, M('#dde3ec', { r: .9 }), { ry: .3 });
    rug(g, 1.6, 1.5, 3.2, 2.4, hex(mix(def.color, '#e2e8f0', 0.6)));
    cabinet(g, bx + 0.45, 1.0, Math.PI / 2, 0.55, 1.2);
    plant(g, 4.1, -2.9, 1.2, 2); plant(g, bx + 0.6, 3.0, 1.1, 0); floorLamp(g, 3.9, 0.2);
  } else if (id === 'info') {
    desks.push(deskSet(g, -2.8, bz + 1.0, 0, t, { kinds: ['doc', 'code'], chair: accentChair }));
    desks.push(deskSet(g, -0.9, bz + 1.0, 0, t, { kinds: ['dash', 'doc'], chair: accentChair }));
    // news video wall 3x2
    box(g, 3.1, 1.5, 0.06, 2.5, 0.75, bz + 0.18, M('#0b0f19', { r: .3 }), { cast: false });
    const kinds = ['dash', 'chart', 'doc', 'code', 'dash', 'chart'];
    for (let i = 0; i < 6; i++) { const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.66), screenMat(kinds[i], t.color, false)); sc.position.set(1.48 + (i % 3) * 1.02, 1.17 + Math.floor(i / 3) * 0.7, bz + 0.215); g.add(sc); }
    // two compute racks with blinking LEDs (data-centre nod)
    R.leds = [];
    const rackM = M('#141a26', { r: .4, m: .5 }), door = M('#1e2636', { r: .3, m: .6 });
    const ledMats = [0, 1, 2, 3].map(i => { const m = new THREE.MeshBasicMaterial({ color: [GOLD, ORANGE, GOLD, ORANGE][i], toneMapped: false }); R.leds.push({ m, base: m.color.clone() }); return m; });
    for (let i = 0; i < 2; i++) {
      const r = new THREE.Group(); r.position.set(bx + 0.65, 0, -0.4 + i * 1.0); r.rotation.y = Math.PI / 2; g.add(r);
      box(r, 0.85, 2.0, 0.95, 0, 0, 0, rackM, { round: 0.02 }); box(r, 0.75, 1.85, 0.02, 0, 0.08, 0.48, door, { cast: false });
      for (let k = 0; k < 9; k++) {
        const led = new THREE.Mesh(boxG(0.5, 0.025, 0.01), ledMats[(i + k) % 4]); led.position.set(-0.05, 0.25 + k * 0.18, 0.5); r.add(led);
        const led2 = new THREE.Mesh(boxG(0.04, 0.04, 0.01), ledMats[(i * 3 + k) % 4]); led2.position.set(0.28, 0.25 + k * 0.18, 0.5); r.add(led2);
      }
    }
    // standing briefing table
    box(g, 1.6, 0.05, 0.8, 2.4, 1.0, 1.4, M('#e5e7eb', { r: .4 }), { round: 0.02 }); box(g, 0.1, 1.0, 0.5, 2.4, 0, 1.4, M('#1f2937'));
    for (let i = 0; i < 3; i++) box(g, 0.26, 0.02, 0.34, 1.9 + i * 0.5, 1.05, 1.35, M('#dde3ec', { r: .9 }), { ry: i * 0.25 - 0.2 });
    rug(g, 2.4, 1.4, 3, 2.2, hex(mix(def.color, '#e2e8f0', 0.6)));
    plant(g, 4.1, -2.9, 1.0, 1); plant(g, 4.1, 3.0, 1.2, 2); floorLamp(g, bx + 0.6, 2.9);
  } else if (id === 'privfin') {
    // private glass room: frosted purple glass all round, locked door
    box(g, 0.04, WALL_H, D, bx + 0.02, 0, 0, smokeGlass(), { cast: false });
    box(g, W, WALL_H, 0.04, 0, 0, bz + 0.02, smokeGlass(), { cast: false });
    desks.push(deskSet(g, -1.0, bz + 1.1, 0, t, { kinds: ['dash', 'chart'], chair: accentChair, dim: true, monitors: 2 }));
    box(g, 0.7, 0.9, 0.6, 2.2, 0, bz + 0.5, M('#374151', { m: .6, r: .35 }), { round: 0.04 });
    cabinet(g, bx + 0.45, 0.2, Math.PI / 2, 0.55, 1.3); plant(g, 3.8, 2.8, 1.2, 2); plant(g, bx + 0.6, 3.0, 1, 0);
    // sofa
    box(g, 1.8, 0.42, 0.8, 2.6, 0, 0.8, M('#1c1917', { r: .9 }), { round: 0.08 }); box(g, 1.8, 0.5, 0.2, 2.6, 0.35, 0.5, M('#292524', { r: .9 }), { round: 0.08 });
    glassRun(g, -W / 2, D / 2, W / 2, D / 2, WALL_H, [[0.62, 0.76]]);
    glassRun(g, W / 2, -D / 2, W / 2, D / 2, WALL_H, []);
    const door = new THREE.Mesh(boxG(W * 0.14, WALL_H, 0.04), smokeGlass()); door.position.set(-W / 2 + W * 0.69, WALL_H / 2, D / 2); g.add(door);
    const band = new THREE.Mesh(boxG(W, 0.04, 0.035), goldFrame()); band.position.set(0, 1.25, D / 2 + 0.02); g.add(band);
    const band2 = new THREE.Mesh(boxG(0.035, 0.04, D), goldFrame()); band2.position.set(W / 2 + 0.02, 1.25, 0); g.add(band2);
    // padlock icon (3D) above door
    const lk = new THREE.Group(); lk.position.set(-W / 2 + W * 0.69, 2.75, D / 2 + 0.05); g.add(lk);
    const lkb = new THREE.Mesh(rboxG(0.42, 0.34, 0.12, 0.05), M(GOLD, { m: .7, r: .3, e: ORANGE, ei: .35 })); lkb.userData.keep = true; lk.add(lkb);
    const sh = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 8, 16, Math.PI), M('#e5e7eb', { m: .9, r: .2 })); sh.position.y = 0.17; sh.userData.keep = true; lk.add(sh);
    const kh = new THREE.Mesh(boxG(0.06, 0.12, 0.02), M('#1f2937')); kh.position.z = 0.065; kh.userData.keep = true; lk.add(kh);
    R.lock = lk;
  } else if (id === 'lounge') {
    furnishLounge(g, def);
  } else if (id === 'archive') {
    bookshelf(g, -1.6, -2.4, 0, 1.5, 1.8);
    bookshelf(g, 0.2, -2.4, 0, 1.5, 1.8);
    cabinet(g, 2.4, -2.2, 0, 0.7, 1.5, '#cbd5e1');
    cabinet(g, 3.3, -2.2, 0, 0.7, 1.5, '#94a3b8');
    boxesStack(g, 2.2, 1.4); boxesStack(g, 3.2, 1.6);
    box(g, 1.4, 0.9, 0.7, -2.2, 0, 1.6, M('#b08968', { r: .8 }));
  } else if (id === 'design') {
    desks.push(deskSet(g, 1.35, 1.05, 0, t, { kinds: ['chart'], monitors: 1, wide: true, tablet: true, chair: accentChair, papers: true }));
    whiteboard(g, W / 2 - 0.16, 1.4, -0.3, -Math.PI / 2, 1.6, t);
    poster(g, -2.4, 1.45, bz + 0.22, 0, 1.15, 1.45, t.color);
    cabinet(g, 3.3, -0.6, -Math.PI / 2, 0.5, 1.15);
    plant(g, 3.3, 2.7, 1.15, 1); plant(g, -3.4, 2.5, 1.05, 0);
    rug(g, 1.35, 1.7, 2.6, 2.0, hex(mix(def.color, '#f8fafc', 0.72)));
  } else if (id === 'showroom') {
    const stone = M('#f8fafc', { r: .5 });
    for (const [x, z] of [[-1.7, 0.15], [0, -0.85], [1.7, 0.15]]) {
      box(g, 0.72, 0.82, 0.72, x, 0, z, stone, { round: 0.04 });
      box(g, 0.48, 0.04, 0.48, x, 0.82, z, M('#e7e5e4', { r: .35 }), { cast: false });
    }
    box(g, 2.6, 1.15, 0.06, 0, 1.2, bz + 0.18, M('#f8fafc'), { cast: false });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 0.95), new THREE.MeshBasicMaterial({ map: signTexture('EVERGATE', 'BRAND HALL', '#94a3b8'), toneMapped: false }));
    board.position.set(0, 1.78, bz + 0.24); board.userData.keep = true; g.add(board);
    plant(g, -3.5, 2.8, 1.05, 0); plant(g, 3.5, 2.8, 1.05, 1);
  } else if (id === 'meeting') {
    box(g, 3.2, 0.08, 1.5, 0, 0.72, 0, M('#c4a574', { r: .45 }), { round: 0.04 });
    cyl(g, 0.12, 0.16, 0.72, -1.2, 0, -0.4, M('#1f2937'), 8);
    cyl(g, 0.12, 0.16, 0.72, 1.2, 0, -0.4, M('#1f2937'), 8);
    cyl(g, 0.12, 0.16, 0.72, -1.2, 0, 0.45, M('#1f2937'), 8);
    cyl(g, 0.12, 0.16, 0.72, 1.2, 0, 0.45, M('#1f2937'), 8);
    for (const [x, z, ry] of [[-1.5, -1.5, 0.4], [1.5, -1.5, -0.4], [-1.5, 1.5, 2.6], [1.5, 1.5, -2.6], [0, -1.7, 0], [0, 1.7, Math.PI]]) chair(g, x, z, ry, '#334155');
    box(g, 2.6, 1.35, 0.08, 0, 1.05, -D / 2 + 0.2, M('#0b0f19'), { cast: false });
    const agenda = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.15), new THREE.MeshBasicMaterial({ map: agendaTexture(), toneMapped: false }));
    agenda.position.set(0, 1.75, -D / 2 + 0.26); agenda.userData.keep = true; g.add(agenda);
    R.agenda = agenda;
  }
  // front glass partitions for open team rooms
  if (def.walls !== 'glass' && id !== 'lounge') {
    const doorFrac = id === 'market' ? [[0.74, 0.88]] : id === 'legal' ? [[0.60, 0.73]] : id === 'proposal' ? [[0.05, 0.19]] : [[0.4, 0.54]];
    const wing = id === 'design' || id === 'showroom';
    const sideDoor = id === 'archive' || id === 'meeting';
    glassRun(g, -W / 2, D / 2, W / 2, D / 2, 2.2, wing ? [] : doorFrac);
    glassRun(g, W / 2, -D / 2, W / 2, D / 2, 2.2, sideDoor ? [[0.34, 0.62]] : (!wing && def.z > 0 ? [[0.1, 0.26]] : []));
    if (!wing) {
      const [a, b] = doorFrac[0];
      doorFrame(g, -W / 2 + ((a + b) / 2) * W, D / 2, 0, (b - a) * W, 2.2);
    }
    if (sideDoor) doorFrame(g, W / 2, 0, Math.PI / 2, 0.28 * D, 2.2);
    if (wing) doorFrame(g, -W / 2, 0, Math.PI / 2, 1.8, 2.2);
  }
  if (id !== 'lounge') pendant(g, id === 'ed' ? -1.4 : 0, 0.2);
  if (id === 'ed') pendant(g, 1.4, 0.2);
  const shirts = [shirtA, shirtB, '#e2e8f0'];
  const n = Math.min(desks.length, t.agents ?? desks.length);
  const staff = t.private ? [] : (t.staff || []);
  for (let i = 0; i < desks.length; i++) {
    if (i < n) nameTag(seat(desks[i], id === 'design' ? t.color : shirts[i % 3]), staff[i], id);
  }
}
