import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';

const sw = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
if (!sw.includes("const CACHE = 'evergate-office-v74'")) throw new Error('cache is not v74');
if (!sw.includes('index.html')) throw new Error('index.html missing from precache');
if (!sw.includes('manifest.webmanifest')) throw new Error('manifest missing from precache');

const port = 4219;
const base = `http://127.0.0.1:${port}/Evergate-Office/`;
const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'ignore',
});
function waitPort() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.on('connect', () => { socket.end(); resolve(); });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - started > 20000) reject(new Error('preview did not start'));
        else setTimeout(tick, 200);
      });
    };
    tick();
  });
}
await waitPort();
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ serviceWorkers: 'allow' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => navigator.serviceWorker.ready.then((reg) => !!(reg && reg.active)), null, { timeout: 20000 });
const dash = await ctx.newPage();
await dash.goto(base + 'dashboard.html', { waitUntil: 'load' });
await dash.waitForFunction(() => {
  if (!window.Chart) return false;
  return [...document.querySelectorAll('canvas')].some((canvas) => Chart.getChart(canvas));
}, null, { timeout: 20000 });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });
await ctx.setOffline(true);
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
const manifest = await page.evaluate(async () => {
  const res = await fetch(new URL('manifest.webmanifest', location.href));
  if (!res.ok) throw new Error('manifest ' + res.status);
  const json = await res.json();
  if (!json || typeof json.name !== 'string' || !json.icons) throw new Error('manifest did not parse');
  return json.name;
});
await dash.reload({ waitUntil: 'load' });
await dash.waitForFunction(() => {
  if (!window.Chart) return false;
  return [...document.querySelectorAll('canvas')].some((canvas) => Chart.getChart(canvas));
}, null, { timeout: 20000 });
await browser.close();
preview.kill('SIGTERM');
console.log(JSON.stringify({ ok: true, cache: 'evergate-office-v74', offline: { ready: true, manifest, chart: true }, errors }));
