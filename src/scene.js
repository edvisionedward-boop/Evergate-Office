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
  g.fillStyle = '#121829'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(120,140,190,.10)'; g.lineWidth = 2;
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
  torso.position.y = 0.74; torso.scale.set(1, 1, 0.78); torso.castShadow = true; root.add(torso);
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
  const bubbleAnchor = new THREE.Object3D(); bubbleAnchor.position.y = 1.95; root.add(bubbleAnchor);

  root.userData = { legs, arms, headG, dot, doc, hips, bubbleAnchor, phase: rnd() * 10, mode: 'stand' };
  return root;
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
function plant(parent, x, z, s = 1, kind = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); parent.add(g);
  cyl(g, 0.2, 0.15, 0.36, 0, 0, 0, M(kind ? '#e5e7eb' : '#3f3f46', { r: .5 }), 10);
  const leaf = M(['#22c55e', '#16a34a', '#15803d'][kind % 3], { r: .8, flat: true });
  const lg = G('leafico', () => new THREE.IcosahedronGeometry(0.28, 0));
  const pts = kind === 2 ? [[0, .62, 0, 1], [0, .95, 0, .8], [0, 1.22, 0, .55]] : [[0, .6, 0, 1], [.12, .82, .05, .75], [-.1, .86, -.06, .7], [.02, 1.05, 0, .55]];
  for (const [px, py, pz, sc] of pts) { const m = new THREE.Mesh(lg, leaf); m.position.set(px, py, pz); m.scale.setScalar(sc); m.rotation.set(px * 9, py * 5, pz); m.castShadow = true; g.add(m); }
  return g;
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
  for (let i = 0; i < n; i++) {
    const mx = n === 1 ? 0 : (i - (n - 1) / 2) * 0.62, ang = n === 1 ? 0 : (i - (n - 1) / 2) * -0.35;
    const mg = new THREE.Group(); mg.position.set(mx, 0.77, -0.18); mg.rotation.y = ang; g.add(mg);
    box(mg, 0.18, 0.015, 0.14, 0, 0, 0, mStand); box(mg, 0.04, 0.22, 0.03, 0, 0, -0.03, mStand);
    box(mg, 0.6, 0.37, 0.035, 0, 0.18, 0, mStand, { round: 0.012 });
    const s = new THREE.Mesh(G('scr', () => new THREE.PlaneGeometry(0.56, 0.33)), screenMat(kinds[i % kinds.length], team.color, opt.dim));
    s.position.set(0, 0.365, 0.019); mg.add(s);
  }
  box(g, 0.5, 0.02, 0.16, -0.05, 0.77, 0.12, M('#1a1f2b', { r: .5 }), { cast: false });
  box(g, 0.07, 0.02, 0.1, 0.36, 0.77, 0.14, M('#1a1f2b'), { cast: false });
  if (opt.mug !== false) cyl(g, 0.04, 0.035, 0.1, -0.55, 0.77, 0.1, M(team.color, { r: .4 }), 8);
  if (opt.papers) { box(g, 0.24, 0.04, 0.32, 0.55, 0.77, 0.05, M('#dde3ec', { r: .9 }), { ry: 0.2 }); }
  const ch = chair(g, 0, 0.62, 0, opt.chair ?? '#2b3142');
  return { group: g, seat: new THREE.Vector3(0, 0, 0.58) };
}
function bookshelf(parent, x, z, ry, w = 1.4, h = 1.9, accents = []) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  const frame = M(WOOD_D, { r: .7 });
  box(g, w, h, 0.36, 0, 0, 0, frame);
  const inner = M('#3b2b20', { r: .9 });
  const shelves = Math.floor(h / 0.45);
  const bookCols = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#e5e7eb', '#8b5cf6', '#0ea5e9', ...accents];
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
  const shade = cyl(g, 0.16, 0.24, 0.26, 0, 1.55, 0, M('#fef3c7', { e: glowCol, ei: 0.55, r: .8 }), 14, { cast: false });
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
  const m = new THREE.Mesh(rboxG(w, 0.02, d, 0.01), M(c, { r: 1 })); m.position.set(x, 0.01, z); m.receiveShadow = true; parent.add(m); return m;
}
function boxesStack(parent, x, z) {
  const k = M('#c08b5c', { r: .9 }), t = M('#d8b48a', { r: .9 });
  box(parent, 0.6, 0.45, 0.6, x, 0, z, k); box(parent, 0.6, 0.45, 0.6, x + 0.65, 0, z, t);
  box(parent, 0.55, 0.4, 0.55, x + 0.3, 0.45, z + 0.02, k, { ry: 0.15 });
  box(parent, 0.4, 0.3, 0.4, x - 0.05, 0.45, z - 0.05, t, { ry: -0.2 });
}

/* ---------------- room shell ---------------- */
const WALL_H = 2.4, FLOOR_H = 0.14;
function roomShell(root, def, ctx) {
  const g = new THREE.Group(); g.position.set(def.x, FLOOR_H, def.z); root.add(g);
  const { w, d } = def;
  const c = col(def.color);
  // floor slab (colored) + inner plank/carpet
  const slab = new THREE.Mesh(rboxG(w, FLOOR_H, d, 0.05), M(hex(mix(def.color, '#0b1020', 0.55)), { r: .6 }));
  slab.position.y = -FLOOR_H / 2; slab.receiveShadow = true; g.add(slab);
  const floorMat = new THREE.MeshStandardMaterial({ map: plankTexture(def.floorTone ? def.floorTone : hex(mix(def.color, '#cfc8bd', def.floorMix ?? 0.2))), roughness: .55 });
  floorMat.map.repeat.set(w / 3, d / 3);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, d - 0.1), floorMat);
  fl.rotation.x = -Math.PI / 2; fl.position.y = 0.002; fl.receiveShadow = true; g.add(fl);
  // glowing edge strip on the two front edges
  const glow = B(def.color, { boost: 2.2 });
  const s1 = new THREE.Mesh(boxG(w, 0.035, 0.035), glow); s1.position.set(0, -0.02, d / 2 + 0.01); g.add(s1);
  const s2 = new THREE.Mesh(boxG(0.035, 0.035, d), glow); s2.position.set(w / 2 + 0.01, -0.02, 0); g.add(s2);

  const wallMat = M(hex(mix(def.color, '#1a2030', def.wallMix ?? 0.38)), { r: .85 });
  const trim = M(hex(mix(def.color, '#0b1020', 0.6)), { r: .6 });
  const hx = -w / 2, hz = -d / 2;
  if (def.walls !== 'glass') {
    // back (-z) wall with windows
    box(g, w, WALL_H, 0.14, 0, 0, hz + 0.07, wallMat);
    box(g, 0.14, WALL_H, d, hx + 0.07, 0, 0, wallMat);
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
function glassRun(g, x0, z0, x1, z1, h, gaps = [], tint = '#bfe9ff', op = 0.16) {
  // glass panels from (x0,z0) to (x1,z1) with door gaps given as [t0,t1] fractions
  const glass = M(tint, { r: .05, m: .1, op });
  const frame = M('#9aa6b8', { m: .7, r: .35 });
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
  const pane = B('#1d3b6e'), mull = M('#0f172a', { r: .4 });
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
    `<div class="ic">${def.icon}</div><div><div class="nm">${def.label}</div><div class="st"><i class="dot idle"></i><span>空闲</span></div></div>`;
  return el;
}

/* ---------------- build ---------------- */
export const LAYOUT = {
  market:   { x: -13.5, z: -12, w: 10, d: 8.5, icon: '市', sign: '市场部', signSub: 'MARKETING & RESEARCH' },
  legal:    { x: 0,     z: -12, w: 11, d: 8.5, icon: '法', sign: '法务部', signSub: 'LEGAL' },
  proposal: { x: 13.5,  z: -12, w: 10, d: 8.5, icon: '策', sign: '策划部', signSub: 'PLANNING & PROPOSALS' },
  invest:   { x: -13.5, z: 0,   w: 10, d: 8.5, icon: '投', sign: '投资部', signSub: 'INVESTMENT' },
  ed:       { x: 0,     z: 0,   w: 11, d: 9,   icon: 'ED', walls: 'glass', floorTone: '#1b3a4a', sign: 'ED 中央指挥室', signSub: 'COMMAND CENTER' },
  info:     { x: 13.5,  z: 0,   w: 10, d: 8.5, icon: '信', sign: '信息部', signSub: 'AI NEWS & INFO' },
  corpfin:  { x: -13.5, z: 12,  w: 10, d: 8.5, icon: '财', sign: '财务部', signSub: 'FINANCE' },
  logistics:{ x: 0,     z: 12,  w: 11, d: 8.5, icon: '物', sign: '物流部', signSub: 'LOGISTICS' },
  privfin:  { x: 13.5,  z: 12,  w: 10, d: 8.5, icon: '🔒', walls: 'glass', private: true, floorTone: '#5b3d8f', sign: '私人助理', signSub: 'PRIVATE · 仅 EDWARD' },
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
  const edge = B('#22d3ee', { op: .8, boost: 2 });
  for (const [w, d, x, z] of [[43.5, .05, 0, 20], [43.5, .05, 0, -20], [.05, 40, 21.75, 0], [.05, 40, -21.75, 0]]) {
    const e = new THREE.Mesh(boxG(w, .04, d), edge); e.position.set(x, 0.02, z); root.add(e);
  }
  // corridors: dark aisles with dashed glowing lines
  const aisle = M('#0e1322', { r: .5, m: .1 });
  const dashM = B('#7dd3fc', { op: .7, boost: 1.4 });
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
    const lo = new CSS2DObject(el); lo.position.set(def.x, def.minor ? 2.9 : 3.55, def.z - def.d * 0.1); lo.center.set(0.5, 1); root.add(lo); R.label = lo;
    // status lamp
    if (!def.minor) {
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
  const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshBasicMaterial({ color: '#67e8f9', wireframe: true, transparent: true, opacity: .8, toneMapped: false }));
  ico.position.y = 2.05; holo.add(ico);
  const coreS = new THREE.Mesh(sphG(0.28, 16, 12), B('#a5f3fc', { op: .7, add: true, boost: 1.6 })); coreS.position.y = 2.05; holo.add(coreS);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.85 + i * 0.22, 0.012, 6, 64), B('#22d3ee', { op: .7, add: true, boost: 2.5 }));
    r.position.y = 2.05; r.rotation.x = Math.PI / 2 + (i - 1) * 0.5; holo.add(r); rings.push(r);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 1.25, 24, 1, true), B('#22d3ee', { op: .12, add: true }));
  beam.position.y = 1.4; holo.add(beam);
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.42, 64), B('#22d3ee', { op: .55, add: true, boost: 2.5 }));
  floorRing.rotation.x = -Math.PI / 2; floorRing.position.y = 0.015; holo.add(floorRing);
  const floorRing2 = new THREE.Mesh(new THREE.RingGeometry(3.7, 3.74, 64), B('#22d3ee', { op: .3, add: true }));
  floorRing2.rotation.x = -Math.PI / 2; floorRing2.position.y = 0.015; holo.add(floorRing2);
  const holoLight = new THREE.PointLight('#22d3ee', 2.5, 8, 1.6); holoLight.position.set(0, 3.2, 0); holo.add(holoLight);

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
  for (const id of ['market', 'legal', 'proposal', 'corpfin', 'logistics', 'privfin', 'invest', 'info']) {
    const R = rooms[id];
    const pl = new THREE.PointLight(R.def.color, 2.0, 11, 1.6); pl.position.set(R.def.x + 1, 3.4, R.def.z + 1); root.add(pl);
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
    floorRing.material.opacity = 0.4 + Math.sin(t * 1.5) * 0.15;
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
      const c = st === 'busy' ? '#f59e0b' : st === 'confirm' ? '#f43f5e' : '#22c55e';
      R.lamp.core.material.color.set(c).multiplyScalar(2.4); R.lamp.ring.material.color.set(c).multiplyScalar(2); R.lamp.halo.material.color.set(c);
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
    if (rooms.ed.boss) { const b = rooms.ed.boss; b.userData.gesture = Math.sin(t * 0.7) > 0.6; animateAgent(b, t, dt); b.userData.dot.material.color.set(state.status.ed === 'confirm' ? '#f43f5e' : state.status.ed === 'busy' ? '#f59e0b' : '#22c55e'); }
    // walkers
    for (const w of walkers) {
      const st = state.status[w.team];
      const a = w.agent, u = a.userData;
      u.dot.material.color.set(st === 'busy' ? '#f59e0b' : st === 'confirm' ? '#f43f5e' : '#22c55e');
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
    // server LEDs
    if (rooms.info?.leds) rooms.info.leds.forEach((o, i) => { o.m.color.copy(o.base).multiplyScalar((Math.sin(t * (3 + i * 1.7) + i) > 0.2) ? 1.4 : 0.35); });
    // screens subtle scroll
    for (const m of screenMats.values()) { if (m.map) m.map.offset.y = (Math.floor(t * 2) % 8) * 0.004; }
  }
  return { rooms, update, walkers, root };
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
    // big display stand at back
    const scr = new THREE.Group(); scr.position.set(0, 0, bz + 0.6); g.add(scr);
    box(scr, 0.12, 1.2, 0.12, -1.4, 0, 0, M('#111827', { m: .5 })); box(scr, 0.12, 1.2, 0.12, 1.4, 0, 0, M('#111827', { m: .5 }));
    box(scr, 3.3, 1.4, 0.08, 0, 1.05, 0, M('#0b0f19', { r: .3 }));
    const big = new THREE.Mesh(new THREE.PlaneGeometry(3.15, 1.25), screenMat('dash', '#22d3ee', false)); big.position.set(0, 1.75, 0.045); scr.add(big);
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
    bookshelf(g, 1.4, bz + 0.35, 0, 1.6, 2.0, ['#7f1d1d', '#1e3a8a']); bookshelf(g, 3.1, bz + 0.35, 0, 1.6, 2.0, ['#7f1d1d']);
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
    const ledMats = [0, 1, 2, 3].map(i => { const m = new THREE.MeshBasicMaterial({ color: ['#22d3ee', '#22c55e', '#38bdf8', '#a78bfa'][i], toneMapped: false }); R.leds.push({ m, base: m.color.clone() }); return m; });
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
    box(g, 0.14, WALL_H, D, bx + 0.07, 0, 0, M(hex(mix(def.color, '#20263a', 0.5)), { r: .85 }));
    box(g, W, WALL_H, 0.14, 0, 0, bz + 0.07, M(hex(mix(def.color, '#20263a', 0.5)), { r: .85 }));
    desks.push(deskSet(g, -1.0, bz + 1.1, 0, t, { kinds: ['dash', 'chart'], chair: accentChair, dim: true, monitors: 2 }));
    box(g, 0.7, 0.9, 0.6, 2.2, 0, bz + 0.5, M('#374151', { m: .6, r: .35 }), { round: 0.04 });
    cabinet(g, bx + 0.45, 0.2, Math.PI / 2, 0.55, 1.3); plant(g, 3.8, 2.8, 1.2, 2); plant(g, bx + 0.6, 3.0, 1, 0);
    // sofa
    box(g, 1.8, 0.42, 0.8, 2.6, 0, 0.8, M('#4c1d95', { r: .9 }), { round: 0.08 }); box(g, 1.8, 0.5, 0.2, 2.6, 0.35, 0.5, M('#5b21b6', { r: .9 }), { round: 0.08 });
    glassRun(g, -W / 2, D / 2, W / 2, D / 2, WALL_H, [[0.62, 0.76]], '#c4b5fd', 0.32);
    glassRun(g, W / 2, -D / 2, W / 2, D / 2, WALL_H, [], '#c4b5fd', 0.32);
    // closed glass door + frosted band
    const door = new THREE.Mesh(boxG(W * 0.14, WALL_H, 0.04), M('#a78bfa', { r: .1, op: .45 })); door.position.set(-W / 2 + W * 0.69, WALL_H / 2, D / 2); g.add(door);
    const band = new THREE.Mesh(boxG(W, 0.5, 0.035), M('#ede9fe', { r: .9, op: .55 })); band.position.set(0, 1.25, D / 2 + 0.01); g.add(band);
    const band2 = new THREE.Mesh(boxG(0.035, 0.5, D), M('#ede9fe', { r: .9, op: .55 })); band2.position.set(W / 2 + 0.01, 1.25, 0); g.add(band2);
    // padlock icon (3D) above door
    const lk = new THREE.Group(); lk.position.set(-W / 2 + W * 0.69, 2.75, D / 2 + 0.05); g.add(lk);
    const lkb = new THREE.Mesh(rboxG(0.42, 0.34, 0.12, 0.05), M('#fbbf24', { m: .7, r: .3, e: '#f59e0b', ei: .45 })); lkb.userData.keep = true; lk.add(lkb);
    const sh = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 8, 16, Math.PI), M('#e5e7eb', { m: .9, r: .2 })); sh.position.y = 0.17; sh.userData.keep = true; lk.add(sh);
    const kh = new THREE.Mesh(boxG(0.06, 0.12, 0.02), M('#1f2937')); kh.position.z = 0.065; kh.userData.keep = true; lk.add(kh);
    R.lock = lk;
  }
  // front glass partitions for open team rooms
  if (def.walls !== 'glass') {
    const doorFrac = id === 'market' ? [[0.74, 0.88]] : id === 'legal' ? [[0.60, 0.73]] : id === 'proposal' ? [[0.05, 0.19]] : [[0.4, 0.54]];
    const doorSide = (def.z < 0);
    glassRun(g, -W / 2, D / 2, W / 2, D / 2, 1.05, doorFrac);
    glassRun(g, W / 2, -D / 2, W / 2, D / 2, 1.05, def.z > 0 ? [[0.1, 0.26]] : []);
  }
  const shirts = [shirtA, shirtB, '#e2e8f0'];
  const n = Math.min(desks.length, t.agents ?? desks.length);
  for (let i = 0; i < desks.length; i++) {
    if (i < n) seat(desks[i], shirts[i % 3]);
  }
}
