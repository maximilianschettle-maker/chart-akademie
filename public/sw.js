// ChartAkademie Service Worker — Offline für App-Shell, Assets und Übungsdaten, Web Push.
// Kursdaten von Binance/Bybit (Fremd-Origin) laufen bewusst NICHT durch den Cache;
// die liegen ohnehin im IndexedDB-Cache der App.
// data/ (Makro-Daten der GitHub Action) wird netz-zuerst geholt, sonst würde der Stand
// im Cache nie frischer; ohne Netz kommt die letzte gecachte Fassung.
const VERSION = 'ca-v2'
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

function netzZuerst(req) {
  return fetch(req)
    .then((res) => {
      if (res.ok) {
        const kopie = res.clone()
        caches.open(VERSION).then((c) => c.put(req, kopie))
      }
      return res
    })
    .catch(() => caches.match(req).then((treffer) => treffer || Response.error()))
}

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

  // Makro-Daten (macro.json, ICS): netz-zuerst, Cache nur als Offline-Fallback
  if (url.pathname.includes('/data/')) {
    event.respondWith(netzZuerst(req))
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

// ── Web Push (verschickt von der GitHub Action, Payload: {titel, text, url, tag}) ──
self.addEventListener('push', (event) => {
  let daten = {}
  try {
    daten = event.data ? event.data.json() : {}
  } catch {
    daten = { text: event.data ? event.data.text() : '' }
  }
  const titel = daten.titel || 'ChartAkademie'
  const optionen = {
    body: daten.text || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: daten.tag || undefined,
    renotify: Boolean(daten.tag),
    data: { url: daten.url || self.registration.scope + '#/makro' },
  }
  event.waitUntil(self.registration.showNotification(titel, optionen))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const ziel = (event.notification.data && event.notification.data.url) || self.registration.scope + '#/makro'
  const intern = ziel.startsWith(self.registration.scope)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenster) => {
      if (intern) {
        const offen = fenster.find((f) => f.url.startsWith(self.registration.scope))
        if (offen) {
          return offen.focus().then((f) => (f && 'navigate' in f ? f.navigate(ziel) : f))
        }
      }
      return self.clients.openWindow(ziel)
    }),
  )
})
