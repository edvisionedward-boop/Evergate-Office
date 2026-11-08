/* Bump this name to drop previously cached builds on the next visit. */
const CACHE = 'evergate-office-v62';
const PRECACHE = [
  'dashboard.html',
  'dashboard.css',
  'dashboard.js',
  'dashboard-model.js',
  'vendor/chart.umd.min.js',
  'assets/dashboard-bg.jpg',
  'data.json',
  'data/progress.json',
  'data/usage.json',
  'data/exams.json',
  'data/pipeline.json',
  'data/skills.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE.map((path) => new URL(path, self.location).href));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok && new URL(req.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw err;
    }
  })());
});
