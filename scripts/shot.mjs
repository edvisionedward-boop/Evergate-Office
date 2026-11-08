import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://127.0.0.1:8080/';
const out = process.argv[3] || 'screens';
const which = (process.argv[4] || 'desk,phone').split(',');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const shots = [];
async function run(name, ctxOpts, actions) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(name, m.type(), m.text().slice(0, 200)); });
  page.on('pageerror', e => console.log(name, 'PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__app.popBubble(); });
  await page.waitForTimeout(800);
  for (const [n, fn] of actions) { if (fn) await fn(page); await page.screenshot({ path: `${out}/${name}-${n}.png` }); console.log('shot', `${out}/${name}-${n}.png`); }
  const fps = await page.evaluate(() => new Promise(r => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
  console.log(name, 'fps(swiftshader)', fps, 'calls', await page.evaluate(() => window.__app.renderer.info.render.calls));
  await ctx.close();
}
if (which.includes('desk')) await run('desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, [
  ['home', null],
  ['ed', async p => { await p.evaluate(() => { const A = window.__app; A.closePanel?.(); A.controls.target.set(0, 0, 0); A.camera.position.set(9, 10, 11); for (let i = 0; i < 4; i++) A.popBubble(); }); await p.waitForTimeout(1200); }],
  ['legal', async p => { await p.evaluate(() => window.__app.selectRoom('legal')); await p.waitForTimeout(2500); }],
  ['board', async p => { await p.evaluate(() => { window.__app.closePanel(); document.querySelector('[data-view=board]').click(); }); await p.waitForTimeout(1500); }],
]);
if (which.includes('phone')) await run('iphone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }, [
  ['home', null],
  ['privfin', async p => { await p.evaluate(() => window.__app.selectRoom('privfin')); await p.waitForTimeout(2500); }],
  ['it', async p => { await p.evaluate(() => window.__app.selectRoom('it')); await p.waitForTimeout(2500); }],
  ['showroom', async p => { await p.evaluate(() => window.__app.selectRoom('showroom')); await p.waitForTimeout(2500); }],
  ['board', async p => { await p.evaluate(() => { window.__app.closePanel(); document.querySelector('[data-view=board]').click(); }); await p.waitForTimeout(1500); }],
]);
await browser.close();
