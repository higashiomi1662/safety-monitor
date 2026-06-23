const CACHE_NAME = 'safety-monitor-v158';
const URLS = ['/safety-monitor/'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

// network-first: 常にサーバーの最新版を優先。オフライン時のみキャッシュにフォールバック
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, resClone));
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/safety-monitor/')))
  );
});
