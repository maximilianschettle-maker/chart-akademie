// ChartAkademie Service Worker — Offline für App-Shell, Assets und Übungsdaten.
// Kursdaten von Binance/Bybit (Fremd-Origin) laufen bewusst NICHT durch den Cache;
// die liegen ohnehin im IndexedDB-Cache der App.
const VERSION = 'ca-v1'
const SHELL = ['./', './index.html', './manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Navigation (index.html): erst Netz, sonst Cache — so kommen Updates zuverlässig an.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const kopie = res.clone()
          caches.open(VERSION).then((c) => c.put('./index.html', kopie))
          return res
        })
        .catch(() => caches.match('./index.html')),
    )
    return
  }

  // Gehashte Assets, Szenarien, Icons: Cache zuerst, sonst Netz + nachcachen.
  event.respondWith(
    caches.match(req).then(
      (treffer) =>
        treffer ||
        fetch(req).then((res) => {
          if (res.ok) {
            const kopie = res.clone()
            caches.open(VERSION).then((c) => c.put(req, kopie))
          }
          return res
        }),
    ),
  )
})
