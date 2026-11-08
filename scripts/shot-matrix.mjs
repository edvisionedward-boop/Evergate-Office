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
const dataHash = createHash('sha256').update(fs.readFileSync('/workspace/public/data.json')).digest('hex');
const rows = [];
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const browserName = await browser.version();

function klNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}:${g('second')}+08:00`;
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
    status: 'valid',
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
    document.querySelector('#scene').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 4, clientY: 4 }));
    window.__app.hidePanel?.();
    window.__app.controls.target.set(target[0], target[1], target[2]);
    window.__app.camera.position.set(pos[0], pos[1], pos[2]);
    window.__app.controls.update();
  }, { target, pos });
  await page.waitForTimeout(450);
}
async function home(page) {
  await page.evaluate(() => window.__app.closePanel?.());
  await page.evaluate(() => document.querySelector('#homeBtn')?.click());
  await settle(page);
}

const rooms = ['ed', 'market', 'legal', 'invest', 'corpfin', 'logistics', 'review', 'design', 'info', 'it', 'privfin', 'lounge', 'meeting', 'showroom', 'archive'];
const spaces = [
  ['pantry', [29.7, 1.05, 2.25], [26.4, 4.2, 0.6]],
  ['restroom-f', [34.4, 0.6, -2.7], [31.0, 7.2, -2.2]],
  ['restroom-m', [33.8, 0.7, 2.8], [28.2, 8.4, 0.6]],
  ['restroom-m-wash', [31.05, 1.05, 3.5], [33.8, 3.1, 5.6]],
  ['archive-lobby', [22.7, 0.9, -12], [18.6, 6.4, -9.0]],
  ['archive-general', [27.4, 0.8, -14.05], [23.0, 6.6, -11.0]],
  ['archive-confidential', [27.4, 0.8, -9.95], [22.0, 7.4, -7.0]],
];

async function officeSet(device, w, h, mode, now) {
  const { ctx, page } = await bootOffice(w, h, now);
  const label = mode === 'day' ? '日间' : '夜间';
  await forceLight(page, label);
  await home(page);
  await save(page, `${device}_${mode}_overview_home`, { name: 'overview', mode });
  for (const id of rooms) {
    await page.evaluate((id) => window.__app.selectRoom(id), id);
    await settle(page);
    await save(page, `${device}_${mode}_${id}_room`, { name: id, mode });
  }
  for (const [name, target, pos] of spaces) {
    await aim(page, target, pos);
    await save(page, `${device}_${mode}_${name}_space`, { name, mode });
  }
  if (device === 'iphone') {
    await home(page);
    await save(page, `${device}_${mode}_feed_collapsed`, { name: 'feed-collapsed', mode });
    await page.click('#feedToggle');
    await page.waitForTimeout(600);
    await save(page, `${device}_${mode}_feed_expanded`, { name: 'feed-expanded', mode });
    await page.click('#feedToggle');
    await page.evaluate(() => window.__app.selectRoom('ed'));
    await settle(page);
    await save(page, `${device}_${mode}_panel_collapsed`, { name: 'panel-collapsed', mode });
    await page.click('#panelExpand');
    await page.waitForTimeout(1200);
    await settle(page);
    await save(page, `${device}_${mode}_panel_expanded`, { name: 'panel-expanded', mode });
    await page.evaluate(() => { const body = document.querySelector('#panelBody'); if (body) body.scrollTop = body.scrollHeight; });
    await page.waitForTimeout(200);
    await save(page, `${device}_${mode}_panel_scrolled`, { name: 'panel-scrolled', mode });
    await page.evaluate(() => document.querySelector('#panelClose')?.click());
    await settle(page);
    await save(page, `${device}_${mode}_panel_closed`, { name: 'panel-closed', mode });
  } else {
    await page.evaluate(() => window.__app.selectRoom('ed'));
    await settle(page);
    await save(page, `${device}_${mode}_sidebar_open`, { name: 'sidebar-open', mode });
    await page.evaluate(() => { const body = document.querySelector('#panelBody'); if (body) body.scrollTop = body.scrollHeight; });
    await page.waitForTimeout(200);
    await save(page, `${device}_${mode}_sidebar_scrolled`, { name: 'sidebar-scrolled', mode });
    await page.evaluate(() => document.querySelector('#panelClose')?.click());
    await settle(page);
    await save(page, `${device}_${mode}_sidebar_closed`, { name: 'sidebar-closed', mode });
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
  clocks: { day: dayUrl, night: nightUrl },
  timezone: 'Asia/Kuala_Lumpur',
  supersedes: ['8f689da2270887d2682f0f60ae83e2698f249f1c', '06f35d9e819d85adbcce96eca0d6a0d1b64cfe32', '5b6f52b', '1e316703'],
  note: 'Shots from earlier heads are superseded. These files are the valid set for this head.',
  shots: rows,
};
fs.writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
const md = ['# Batch 1 screenshot index', '', `Head \`${sha}\`. ${rows.length} shots. Data \`${dataHash.slice(0, 12)}\`.`, '', '| File | View | Mode | Viewport |', '| --- | --- | --- | --- |',
  ...rows.map((r) => `| ${r.file} | ${r.view} | ${r.mode} | ${r.viewport.width}x${r.viewport.height} |`)];
fs.writeFileSync(`${out}/manifest.md`, md.join('\n'));
fs.mkdirSync(store, { recursive: true });
fs.cpSync(out, store, { recursive: true });
console.log(JSON.stringify({ ok: true, count: rows.length, folder: store }));
await browser.close();
