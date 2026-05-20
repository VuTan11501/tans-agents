const CACHE = "tans-agent-v1"
const APP_SHELL = ["/", "/manifest.json", "/icon.svg"]

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)
  // Never cache API or non-GET
  if (e.request.method !== "GET" || url.pathname.startsWith("/api/")) return
  // Network-first for navigations; cache-first for static assets
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).then((r) => {
        const copy = r.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copy))
        return r
      }).catch(() => caches.match(e.request).then((r) => r || caches.match("/")))
    )
  } else if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)) }
        return res
      }))
    )
  }
})
