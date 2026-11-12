// Build-time constants contain public, generated shell assets only.
declare const CACHE_NAME: string;
declare const PRECACHE: string[];
const worker = globalThis as unknown as ServiceWorkerGlobalScope;
const assetPaths = new Set(PRECACHE);

worker.addEventListener('install', event => {
  // A failed download rejects installation; the previous worker stays usable.
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE.map(path => new Request(path, { cache: 'reload' })));
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
  // Do not skip waiting: active forms and exams must not refresh on their own.
});

worker.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('almas-shell-') && key !== CACHE_NAME) await caches.delete(key);
    }
    await worker.clients.claim();
  })());
});

worker.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(worker.skipWaiting());
});

worker.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== worker.location.origin) return;
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!assetPaths.has(pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(pathname)) ?? fetch(request);
  })());
});
