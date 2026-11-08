import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const sha = execSync('git rev-parse HEAD', { cwd: '/workspace' }).toString().trim();
const short = sha.slice(0, 7);
const base = 'http://127.0.0.1:4194/Evergate-Office/';
const dayUrl = '2026-11-09T09:00:00+07:00';
const nightUrl = '2026-11-09T19:00:00+07:00';
const out = `/tmp/batch1-${short}`;
const store = `/cursor/stores/self/artifacts/batch1-${short}`;
fs.mkdirSync(out, { recursive: true });
const dataFiles = [
  'public/data.json',
  'public/data/usage.json',
  'public/data/progress.json',
  'public/data/exams.json',
  'public/data/pipeline.json',
  'public/data/skills.json',
];
const dataHashes = Object.fromEntries(dataFiles.map((file) => [
  file,
  createHash('sha256').update(fs.readFileSync(`/workspace/${file}`)).digest('hex'),
]));
const dataHash = dataHashes['public/data.json'];
const rows = [];
const collisions = [];
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const browserName = await browser.version();

function klNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}:${g('second')}+07:00`;
}

async function forceLight(page, label) {
  for (let i = 0; i < 4; i++) {
    if ((await page.locator('#dayToggle').innerText()).trim() === label) return label;
    await page.click('#dayToggle');
    await page.waitForTimeout(80);
  }
  return (await page.locator('#dayToggle').innerText()).trim();
}
async function settle(page) {
  await page.waitForFunction(() => window.__flying !== true, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(150);
}
async function meta(page, file, view) {
  const cam = await page.evaluate(() => {
    const A = window.__app;
    if (!A) return null;
    return {
      position: A.camera.position.toArray().map((n) => +n.toFixed(2)),
      target: A.controls.target.toArray().map((n) => +n.toFixed(2)),
      fov: A.camera.fov,
    };
  });
  const vp = page.viewportSize();
  rows.push({
    file,
    head: sha,
    url: page.url(),
    viewport: vp,
    dpr: await page.evaluate(() => window.devicePixelRatio),
    browser: browserName,
    mode: view.mode,
    capturedAt: klNow(),
    camera: cam,
    dataHash,
    status: view.status || 'valid',
    assert: view.assert || '',
    view: view.name,
  });
}
async function save(page, name, view) {
  const file = `candidate_${short}_${name}.png`;
  const path = `${out}/${file}`;
  for (let i = 0; i < 3; i++) {
    try { await page.screenshot({ path }); break; }
    catch (err) { if (i === 2) throw err; await page.waitForTimeout(200); }
  }
  await meta(page, file, view);
  console.log('shot', name);
}
async function bootOffice(w, h, now) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(90000);
  await page.goto(base + '?snap=1&now=' + encodeURIComponent(now), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
  return { ctx, page };
}
async function aim(page, target, pos) {
  await page.evaluate(({ target, pos }) => {
    const panel = document.querySelector('#panel');
    if (panel) panel.style.transition = 'none';
    window.__app.hidePanel?.();
    window.__holdCam = true;
    window.__userAimed = true;
    window.__app.controls.minDistance = 1.2;
    window.__app.controls.enableDamping = false;
    document.querySelector('#scene').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 4, clientY: 4 }));
    window.__app.controls.target.set(target[0], target[1], target[2]);
    window.__app.camera.position.set(pos[0], pos[1], pos[2]);
    window.__app.controls.update();
  }, { target, pos });
  await page.waitForTimeout(500);
  const got = await page.evaluate(({ target }) => {
    const t = window.__app.controls.target.toArray();
    const panel = document.querySelector('#panel');
    return {
      dx: Math.abs(t[0] - target[0]),
      dy: Math.abs(t[1] - target[1]),
      dz: Math.abs(t[2] - target[2]),
      hidden: panel.classList.contains('hidden'),
      opacity: getComputedStyle(panel).opacity,
    };
  }, { target });
  const ok = got.dx < 0.8 && got.dy < 0.8 && got.dz < 0.8 && got.hidden && Number(got.opacity) < 0.05;
  return { ok, assert: ok ? 'camera held, panel hidden' : `camera drift ${got.dx.toFixed(2)},${got.dy.toFixed(2)},${got.dz.toFixed(2)} hidden=${got.hidden} opacity=${got.opacity}` };
}
async function home(page) {
  await page.evaluate(() => {
    window.__holdCam = false;
    window.__app.closePanel?.();
  });
  await page.evaluate(() => document.querySelector('#homeBtn')?.click());
  await settle(page);
}
async function closeSheet(page) {
  await page.evaluate(() => {
    const panel = document.querySelector('#panel');
    panel.style.transition = 'none';
    window.__holdCam = false;
    window.__app.closePanel();
  });
  await page.waitForTimeout(350);
  await settle(page);
  const got = await page.evaluate(() => {
    const panel = document.querySelector('#panel');
    const focus = document.activeElement;
    return {
      hidden: panel.classList.contains('hidden'),
      opacity: getComputedStyle(panel).opacity,
      focusInPanel: !!(focus && panel.contains(focus)),
    };
  });
  const ok = got.hidden && Number(got.opacity) < 0.05 && !got.focusInPanel;
  return { ok, assert: ok ? 'panel hidden, focus outside' : `hidden=${got.hidden} opacity=${got.opacity} focusInPanel=${got.focusInPanel}` };
}
async function openFeed(page) {
  await page.click('#feedToggle');
  await page.waitForFunction(() => document.querySelector('.bubble'), null, { timeout: 8000 });
  await page.waitForTimeout(350);
}
async function feedState(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.bubble');
    const aria = document.querySelector('#feedToggle')?.getAttribute('aria-expanded');
    const r = el?.getBoundingClientRect();
    const onScreen = !!(r && r.width > 20 && r.height > 8 && r.left < innerWidth - 1 && r.right > 1 && r.top < innerHeight - 1 && r.bottom > 1);
    const nodes = [...document.querySelectorAll('.rlabel')].filter((node) => !node.classList.contains('packed-hide') && getComputedStyle(node).visibility !== 'hidden');
    const hits = [];
    let pairs = 0;
    const rects = nodes.map((node) => ({ id: node.dataset.room, r: node.getBoundingClientRect() })).filter((item) => item.r.width > 2);
    for (let a = 0; a < rects.length; a++) {
      for (let b = a + 1; b < rects.length; b++) {
        const A = rects[a].r;
        const B = rects[b].r;
        const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left);
        const oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
        if (ox > 0.5 && oy > 0.5) pairs += 1;
      }
    }
    if (r && r.width > 8) {
      for (const item of rects) {
        const box = item.r;
        const ox = Math.min(r.right, box.right) - Math.max(r.left, box.left);
        const oy = Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top);
        if (ox > 0.5 && oy > 0.5) hits.push(item.id);
      }
    }
    const pointer = assessPointer(rects);
    return { aria, onScreen, pairs, hits, pointerOk: pointer.ok, pointer: pointer.reason };
    function assessPointer(rects) {
  const bubble = document.querySelector('.bubble');
  if (!bubble) return { ok: true, reason: 'no bubble' };
  const poly = document.querySelector('#callouts polyline.callout');
  if (!poly) return { ok: false, reason: 'no leader' };
  const tail = getComputedStyle(bubble, '::after').content;
  if (tail && tail !== 'none') return { ok: false, reason: 'fixed tail still shown' };
  const pts = poly.getAttribute('points').trim().split(/\s+/).map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return { x, y };
  });
  const end = pts[pts.length - 1];
  const room = bubble.dataset.room;
  const label = [...document.querySelectorAll('.rlabel')].find((node) => node.dataset.room === room && !node.classList.contains('packed-hide'));
  const lr = label?.getBoundingClientRect();
  const inLabel = !!(lr && end.x >= lr.left + 0.5 && end.x <= lr.right - 0.5 && end.y >= lr.top + 0.5 && end.y <= lr.bottom - 0.5);
  let inRoom = false;
  const def = window.__app?.office?.rooms?.[room]?.def;
  const cam = window.__app?.camera;
  if (def?.w && cam) {
    const corners = [
      [def.x - def.w / 2, def.z - def.d / 2],
      [def.x + def.w / 2, def.z - def.d / 2],
      [def.x + def.w / 2, def.z + def.d / 2],
      [def.x - def.w / 2, def.z + def.d / 2],
    ].map(([x, z]) => {
      const p = cam.position.clone().set(x, 0.4, z).project(cam);
      return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
    });
    let inside = false;
    for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
      const yi = corners[i].y;
      const yj = corners[j].y;
      const hit = (yi > end.y) !== (yj > end.y) && end.x < ((corners[j].x - corners[i].x) * (end.y - yi)) / ((yj - yi) || 1e-6) + corners[i].x;
      if (hit) inside = !inside;
    }
    inRoom = inside;
  }
  if (!inLabel && !inRoom) return { ok: false, reason: `endpoint ${Math.round(end.x)},${Math.round(end.y)} outside ${room}` };
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const cuts = (a, b, c, d) => {
    const d1 = cross(c, d, a);
    const d2 = cross(c, d, b);
    const d3 = cross(a, b, c);
    const d4 = cross(a, b, d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  for (const item of rects) {
    if (item.id === room) continue;
    const box = item.r;
    const edges = [
      [{ x: box.left, y: box.top }, { x: box.right, y: box.top }],
      [{ x: box.right, y: box.top }, { x: box.right, y: box.bottom }],
      [{ x: box.right, y: box.bottom }, { x: box.left, y: box.bottom }],
      [{ x: box.left, y: box.bottom }, { x: box.left, y: box.top }],
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const inside = (p) => p.x > box.left && p.x < box.right && p.y > box.top && p.y < box.bottom;
      if (inside(a) || inside(b) || edges.some(([c, d]) => cuts(a, b, c, d))) return { ok: false, reason: `leader crosses ${item.id}` };
    }
  }
  return { ok: true, reason: inLabel ? `ends in ${room} label` : `ends in ${room}` };
    }
  });
}
async function collisionSample(page, frames = 12) {
  const rows = [];
  for (let i = 0; i < frames; i++) {
    rows.push(await feedState(page));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  const labelPairs = rows.map((row) => row.pairs);
  const bubbleHits = rows.map((row) => row.hits.length);
  const pointerMiss = rows.map((row) => (row.pointerOk ? 0 : 1));
  return {
    frames,
    labelPairs,
    bubbleHits,
    pointerMiss,
    pointer: rows.map((row) => row.pointer).filter((reason, index, all) => reason && reason !== 'no bubble' && all.indexOf(reason) === index),
    maxLabelPairs: Math.max(...labelPairs),
    maxBubbleHits: Math.max(...bubbleHits),
    maxPointerMiss: Math.max(...pointerMiss),
  };
}
async function bubbleInside(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.bubble');
    if (!el) return { ok: false, assert: 'no bubble' };
    const r = el.getBoundingClientRect();
    const ok = r.width > 20 && r.left >= -1 && r.top >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1;
    return { ok, assert: ok ? 'bubble inside the screen' : `bubble ${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)}` };
  });
}
async function campusInside(page) {
  return page.evaluate(() => {
    const cam = window.__app.camera;
    const canvas = document.querySelector('#scene canvas') || document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const top = document.querySelector('#topbar').getBoundingClientRect().bottom + 2;
    const bottom = document.querySelector('#quickbar').getBoundingClientRect().top - 2;
    const bad = [];
    for (const id of ['design', 'showroom']) {
      const d = window.__app.office.rooms[id].def;
      for (const x of [d.x - d.w / 2, d.x + d.w / 2]) {
        for (const z of [d.z - d.d / 2, d.z + d.d / 2]) {
          const p = cam.position.clone().set(x, 0.2, z).project(cam);
          const sy = (-p.y * 0.5 + 0.5) * rect.height + rect.top;
          const sx = (p.x * 0.5 + 0.5) * rect.width + rect.left;
          if (sy > bottom || sy < top || sx < 0 || sx > rect.width) bad.push(`${id}@${Math.round(sx)},${Math.round(sy)}`);
        }
      }
    }
    return { ok: bad.length === 0, assert: bad.length ? bad.join(' ') : 'design and brand hall inside the safe area' };
  });
}
async function labelAboveDrawer(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('#panel');
    const label = document.querySelector('.rlabel.sel');
    if (!label) return { ok: false, assert: 'no selected label' };
    const pr = panel.getBoundingClientRect();
    const lr = label.getBoundingClientRect();
    const ok = lr.height > 8 && lr.bottom <= pr.top + 2 && lr.top >= 0 && lr.right <= window.innerWidth && lr.left >= 0;
    return { ok, assert: ok ? 'selected room sits above the drawer' : `label ${Math.round(lr.top)}-${Math.round(lr.bottom)} drawer ${Math.round(pr.top)}` };
  });
}

const rooms = ['ed', 'market', 'legal', 'invest', 'corpfin', 'logistics', 'review', 'design', 'info', 'it', 'privfin', 'lounge', 'meeting', 'showroom', 'archive'];
const spaces = [
  ['pantry', [28.7, 1.15, 1.6], [23.4, 6.3, -0.2]],
  ['restroom-f', [34.4, 0.6, -2.7], [31.0, 7.2, -2.2]],
  ['restroom-m', [33.8, 0.7, 2.8], [28.2, 8.4, 0.6]],
  ['restroom-m-mid', [32.0, 1.15, 1.8], [30.15, 4.5, 7.5]],
  ['restroom-m-wash', [30.82, 1.12, 3.25], [30.95, 2.25, 5.55]],
  ['archive-lobby', [22.7, 0.9, -12], [18.6, 6.4, -9.0]],
  ['archive-general', [27.4, 0.8, -14.05], [23.0, 6.6, -11.0]],
  ['archive-confidential', [27.4, 0.8, -9.95], [22.0, 7.4, -7.0]],
];

async function saveFeed(page, device, mode, fileName, viewName, w, h) {
  const bubble = await bubbleInside(page);
  const state = await feedState(page);
  const sample = await collisionSample(page);
  collisions.push({ device, mode, view: viewName, viewport: `${w}x${h}`, ...sample });
  const anchor = await page.evaluate(() => document.querySelector('.bubble')?.dataset.anchor || '');
  const ok = bubble.ok && state.aria === 'true' && state.onScreen && anchor === 'visible' && sample.maxBubbleHits === 0 && sample.maxLabelPairs === 0 && sample.maxPointerMiss === 0;
  const assert = ok
    ? `bubble on screen, aria expanded, anchor visible, no label overlap, ${state.pointer}`
    : `inside=${bubble.ok} aria=${state.aria} onScreen=${state.onScreen} anchor=${anchor} hits=${state.hits.join(',') || 'none'} pairs=${sample.maxLabelPairs} bubbleHits=${sample.maxBubbleHits} pointer=${state.pointer}`;
  await save(page, `${device}_${mode}_${fileName}`, { name: viewName, mode, status: ok ? 'valid' : 'invalid', assert });
}
async function officeSet(device, w, h, mode, now) {
  const { ctx, page } = await bootOffice(w, h, now);
  const label = mode === 'day' ? '日间' : '夜间';
  await forceLight(page, label);
  await home(page);
  const framed = await campusInside(page);
  const overviewHits = await collisionSample(page);
  collisions.push({ device, mode, view: 'overview', viewport: `${w}x${h}`, ...overviewHits });
  const overviewOk = framed.ok && overviewHits.maxLabelPairs === 0 && overviewHits.maxBubbleHits === 0;
  const overviewAssert = overviewOk ? `${framed.assert}; labels ${overviewHits.maxLabelPairs}` : `${framed.assert}; labelPairs=${overviewHits.labelPairs.join(',')} bubbleHits=${overviewHits.bubbleHits.join(',')}`;
  await save(page, `${device}_${mode}_overview_home`, { name: 'overview', mode, status: overviewOk ? 'valid' : 'invalid', assert: overviewAssert });
  for (const id of rooms) {
    await page.evaluate((id) => window.__app.selectRoom(id), id);
    await settle(page);
    await save(page, `${device}_${mode}_${id}_room`, { name: id, mode });
  }
  for (const [name, target, pos] of spaces) {
    const check = await aim(page, target, pos);
    await save(page, `${device}_${mode}_${name}_space`, { name, mode, status: check.ok ? 'valid' : 'invalid', assert: check.assert });
  }
  if (device === 'iphone') {
    await home(page);
    await save(page, `${device}_${mode}_feed_collapsed`, { name: 'feed-collapsed', mode });
    await openFeed(page);
    await saveFeed(page, device, mode, 'feed_expanded', 'feed-expanded', w, h);
    await page.click('#feedToggle');
    await page.waitForTimeout(200);
    if (mode === 'night') {
      await openFeed(page);
      await saveFeed(page, device, mode, 'feed_second', 'feed-second', w, h);
      await page.click('#feedToggle');
      await page.waitForTimeout(200);
    }
    await page.evaluate(() => window.__app.selectRoom('ed'));
    await settle(page);
    const collapsedBox = await page.evaluate(() => {
      const r = document.querySelector('#panel').getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    await save(page, `${device}_${mode}_panel_collapsed`, { name: 'panel-collapsed', mode });
    await page.click('#panelExpand');
    await page.waitForTimeout(400);
    const grown = await page.evaluate((before) => {
      const r = document.querySelector('#panel').getBoundingClientRect();
      const taller = r.height >= before.h + 80;
      const wider = r.width >= before.w + 80;
      const strip = r.top >= window.innerHeight * 0.28;
      const notNarrower = r.width >= before.w - 1;
      return {
        ok: (taller || wider) && strip && notNarrower,
        assert: `collapsed ${Math.round(before.w)}x${Math.round(before.h)} expanded ${Math.round(r.width)}x${Math.round(r.height)} top ${Math.round(r.top)}`,
      };
    }, collapsedBox);
    await page.waitForTimeout(800);
    await settle(page);
    const above = await labelAboveDrawer(page);
    const drawerOk = above.ok && grown.ok;
    await save(page, `${device}_${mode}_panel_expanded`, { name: 'panel-expanded', mode, status: drawerOk ? 'valid' : 'invalid', assert: `${grown.assert}; ${above.assert}` });
    await page.evaluate(() => { const body = document.querySelector('#panelBody'); if (body) body.scrollTop = body.scrollHeight; });
    await page.waitForTimeout(200);
    await save(page, `${device}_${mode}_panel_scrolled`, { name: 'panel-scrolled', mode });
    const closed = await closeSheet(page);
    await save(page, `${device}_${mode}_panel_closed`, { name: 'panel-closed', mode, status: closed.ok ? 'valid' : 'invalid', assert: closed.assert });
  } else {
    await page.evaluate(() => window.__app.selectRoom('ed'));
    await settle(page);
    await save(page, `${device}_${mode}_sidebar_open`, { name: 'sidebar-open', mode });
    await page.evaluate(() => { const body = document.querySelector('#panelBody'); if (body) body.scrollTop = body.scrollHeight; });
    await page.waitForTimeout(200);
    await save(page, `${device}_${mode}_sidebar_scrolled`, { name: 'sidebar-scrolled', mode });
    const closed = await closeSheet(page);
    await save(page, `${device}_${mode}_sidebar_closed`, { name: 'sidebar-closed', mode, status: closed.ok ? 'valid' : 'invalid', assert: closed.assert });
    await save(page, `${device}_${mode}_feed_collapsed`, { name: 'feed-collapsed', mode });
    await openFeed(page);
    await saveFeed(page, device, mode, 'feed_expanded', 'feed-expanded', w, h);
    await page.click('#feedToggle');
    await page.waitForTimeout(200);
    if (mode === 'night') {
      await openFeed(page);
      await saveFeed(page, device, mode, 'feed_second', 'feed-second', w, h);
      await page.click('#feedToggle');
    }
  }
  await ctx.close();
}

async function dashSet(device, w, h, mode, now) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(base + 'dashboard.html?now=' + encodeURIComponent(now), { waitUntil: 'networkidle' });
  await page.waitForSelector('#overview h2');
  const sections = [
    ['header', null],
    ['rank', 'progress'],
    ['tasks', 'tasks'],
    ['people', 'people'],
    ['pipeline', 'clients'],
    ['exams', 'exams'],
    ['skills', 'skills'],
    ['usage', 'usage'],
  ];
  for (const [name, id] of sections) {
    if (id === 'people') {
      await page.evaluate(() => {
        const nav = document.querySelector('.pills-wrap');
        const link = document.querySelector('.pills a[data-sec="people"]');
        const pills = document.querySelector('.pills');
        window.scrollTo(0, 500);
        const stuck = nav.getBoundingClientRect().bottom;
        const sec = document.getElementById('people');
        const y = window.scrollY + sec.getBoundingClientRect().top - (stuck + 12);
        window.scrollTo(0, y);
        if (pills && link) pills.scrollLeft = Math.max(0, link.offsetLeft - 16);
      });
    } else if (id) {
      await page.evaluate((id) => document.getElementById(id)?.scrollIntoView(), id);
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.waitForTimeout(350);
    await save(page, `${device}_${mode}_dash-${name}`, { name: 'dash-' + name, mode });
    if (['tasks', 'people', 'skills', 'usage'].includes(name)) {
      for (let part = 2; part <= 4; part++) {
        const moved = await page.evaluate(() => {
          const before = window.scrollY;
          window.scrollBy(0, Math.round(window.innerHeight * 0.82));
          return window.scrollY > before + 30;
        });
        if (!moved) break;
        await page.waitForTimeout(200);
        await save(page, `${device}_${mode}_dash-${name}-part0${part}`, { name: `dash-${name}-part0${part}`, mode });
      }
    }
  }
  await ctx.close();
}

await officeSet('desktop', 1440, 900, 'day', dayUrl);
await officeSet('desktop', 1440, 900, 'night', nightUrl);
await officeSet('iphone', 390, 844, 'day', dayUrl);
await officeSet('iphone', 390, 844, 'night', nightUrl);
await dashSet('desktop', 1440, 900, 'day', dayUrl);
await dashSet('desktop', 1440, 900, 'night', nightUrl);
await dashSet('iphone', 390, 844, 'day', dayUrl);
await dashSet('iphone', 390, 844, 'night', nightUrl);

{
  const { ctx, page } = await bootOffice(320, 844, dayUrl);
  await forceLight(page, '日间');
  await home(page);
  await save(page, 'iphone320_day_overview_home', { name: 'overview-320', mode: 'day' });
  await ctx.close();
}
{
  const { ctx, page } = await bootOffice(390, 844, dayUrl);
  await forceLight(page, '日间');
  await home(page);
  await save(page, 'rotate_portrait_before', { name: 'rotate-portrait', mode: 'day' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(700);
  await settle(page);
  await save(page, 'rotate_landscape', { name: 'rotate-landscape', mode: 'day' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  await settle(page);
  await save(page, 'rotate_portrait_after', { name: 'rotate-portrait-return', mode: 'day' });
  await ctx.close();
}

const manifest = {
  head: sha,
  folder: store,
  dataHash,
  dataHashes,
  serviceWorker: 'blocked',
  clocks: { day: dayUrl, night: nightUrl },
  timezone: 'Asia/Bangkok',
  supersedes: ['6d4938a', '6e82a14', '950dcbff0227bb1fed0dd83ba813535496bca3bb', '8f689da2270887d2682f0f60ae83e2698f249f1c'],
  note: 'Shots from earlier heads are superseded. These files are the valid set for this head. The service worker was blocked for these captures. Times are Asia/Bangkok (UTC+7). Main has no washbasin in the male restroom; the restroom shots show the stalls, the aisle, and the existing 男洗手 sign. Collision counts are pairs whose boxes overlap by more than half a pixel.',
  collisions,
  shots: rows,
};
fs.writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
fs.writeFileSync(`${out}/collision-report.json`, JSON.stringify({
  head: sha,
  metric: 'overlap greater than 0.5px on both axes, 12 consecutive frames; a feed pointer must end inside the referenced room label or room bounds and must not cross another label',
  collisions,
}, null, 2));
const md = ['# Batch 1 screenshot index', '', `Head \`${sha}\`. ${rows.length} shots. Data \`${dataHash.slice(0, 12)}\`.`, '', '| File | View | Mode | Viewport |', '| --- | --- | --- | --- |',
  ...rows.map((r) => `| ${r.file} | ${r.view} | ${r.mode} | ${r.viewport.width}x${r.viewport.height} |`)];
fs.writeFileSync(`${out}/manifest.md`, md.join('\n'));
fs.mkdirSync(store, { recursive: true });
fs.cpSync(out, store, { recursive: true });
console.log(JSON.stringify({ ok: true, count: rows.length, folder: store }));
await browser.close();
