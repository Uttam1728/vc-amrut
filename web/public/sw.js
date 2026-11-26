// Offline support: every same-origin GET is served from cache instantly (works with no network)
// and refreshed in the background, so the next open picks up new quotes or a new build.
// ponytail: old hashed build files stay in the cache; bump CACHE to clear them if storage ever matters.
const CACHE = "vq-v1"

self.addEventListener("install", (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/subtopics.json", "/manifest.webmanifest"])))
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// The page sends the files it loaded before this worker took control.
self.addEventListener("message", (e) => {
  if (!Array.isArray(e.data)) return
  const urls = e.data.filter((u) => typeof u === "string" && new URL(u).origin === location.origin)
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(urls.map((u) => c.add(u).catch(() => {})))))
})

self.addEventListener("fetch", (e) => {
  const req = e.request
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true })
      const fresh = fetch(req)
        .then((res) => (res.ok && cache.put(req, res.clone()), res))
        .catch(() => hit)
      return hit || fresh
    }),
  )
})
