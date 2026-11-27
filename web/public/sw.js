// Pages use the latest HTML online, with the saved version as an offline fallback.
// Other resources load from cache while refreshing in the background.
const CACHE = "vq-v2"

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(["/", "/subtopics.json", "/manifest.webmanifest"]))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("vq-") && k !== CACHE).map((k) => caches.delete(k))))
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
  const navigation = req.mode === "navigate"
  const ready = caches.open(CACHE)
  const fresh = ready.then(async (cache) => {
    const res = await fetch(req, navigation ? { cache: "no-cache" } : undefined)
    if (res.ok) await cache.put(req, res.clone()).catch(() => {})
    return res
  })
  // Keep background refreshes alive even when the cached response is returned immediately.
  e.waitUntil(fresh.then(() => {}, () => {}))
  e.respondWith(ready.then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: navigation })
    if (navigation) {
      return fresh.then((res) => res.ok ? res : hit || res)
        .catch(() => hit || Response.error())
    }
    return hit || fresh.catch(() => Response.error())
  }))
})
