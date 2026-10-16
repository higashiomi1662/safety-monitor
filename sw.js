// 安全衛生モニター Service Worker
// 方針：常にサーバーの最新版を優先（network-first）。オフライン時だけキャッシュを使う。
// 新しい版を公開するときは index.html の APP_VERSION と version.json、ここの VERSION をそろえて上げる。
const VERSION = 'v178'
const CACHE_NAME = 'safety-monitor-' + VERSION

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  // 古い版のキャッシュを消す
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// 画面の「更新」ボタンから待機中の新しい版をすぐ有効にする
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  // 同じサイトの GET だけを扱う（Firebase など外部への通信はそのまま通す）
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  // 版の確認は必ずサーバーに聞く
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(req, { cache: 'no-store' }))
    return
  }
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((r) => r || caches.match('./')),
      ),
  )
})
