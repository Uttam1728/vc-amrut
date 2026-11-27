// Run: node scripts/sw.check.mjs
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const origin = "https://example.test"
const handlers = new Map()
const entries = new Map()
const deleted = []
let network
let options
let failWrite = false
const key = (request) => typeof request === "string" ? new URL(request, origin).href : request.url
const cache = {
  async match(request, { ignoreSearch = false } = {}) {
    const url = new URL(key(request))
    if (ignoreSearch) url.search = ""
    return entries.get(url.href)?.clone()
  },
  async put(request, response) {
    if (failWrite) throw new Error("Storage full")
    entries.set(key(request), response.clone())
  },
  async addAll() {},
}
vm.runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), {
  self: {
    addEventListener: (name, handler) => handlers.set(name, handler),
    skipWaiting() {},
    clients: { claim() {} },
  },
  location: { origin }, URL, Response,
  caches: {
    open: async () => cache,
    keys: async () => ["vq-v1", "vq-v2", "another-app"],
    delete: async (name) => deleted.push(name),
  },
  fetch: async (_request, init) => {
    options = init
    if (network instanceof Error) throw network
    return network.clone()
  },
})
async function request(mode, path = "/") {
  let result
  const pending = []
  handlers.get("fetch")({
    request: { method: "GET", mode, url: origin + path },
    waitUntil: (promise) => pending.push(promise),
    respondWith: (promise) => { result = promise },
  })
  const response = await result
  await Promise.all(pending)
  return response
}

entries.set(origin + "/", new Response("old HTML"))
network = new Response("new HTML")
assert.equal(await (await request("navigate")).text(), "new HTML")
assert.equal(options.cache, "no-cache")
assert.equal(await entries.get(origin + "/").clone().text(), "new HTML")
network = new Error("Offline")
assert.equal(await (await request("navigate", "/?open=1")).text(), "new HTML")
network = new Response("Server error", { status: 503 })
assert.equal(await (await request("navigate")).text(), "new HTML")
failWrite = true
network = new Response("latest HTML even with full storage")
assert.equal(await (await request("navigate")).text(), "latest HTML even with full storage")
failWrite = false
entries.set(origin + "/assets/app.js", new Response("cached JS"))
network = new Response("fresh JS")
assert.equal(await (await request("cors", "/assets/app.js")).text(), "cached JS")
assert.equal(await entries.get(origin + "/assets/app.js").clone().text(), "fresh JS")
network = new Error("Offline")
assert.equal(await (await request("cors", "/assets/app.js")).text(), "fresh JS")
entries.clear()
assert.equal((await request("navigate")).type, "error")
let activation
handlers.get("activate")({ waitUntil: (promise) => { activation = promise } })
await activation
assert.deepEqual(deleted, ["vq-v1"])
console.log("Service worker OK: fresh HTML online, offline fallback, asset refresh, storage failures, cache migration.")
