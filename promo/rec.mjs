// High-res recorder: drives the headless Chrome on :9222 over CDP, emulates a 412×732 phone at 3×,
// runs the choreography (.run.js) and saves every screencast frame with its timestamp.
// Usage: node rec.mjs <url>   → frames/ + frames.txt (ffconcat with durations) + start.txt (seconds into the video)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"

const url = process.argv[2] ?? "http://localhost:5174/#"
const dir = new URL("./frames/", import.meta.url).pathname
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir)

const target = await (await fetch("http://localhost:9222/json/new?about:blank", { method: "PUT" })).json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener("open", r, { once: true }))
let id = 0
const pending = new Map(), handlers = []
ws.addEventListener("message", ({ data }) => {
  const m = JSON.parse(data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } else handlers.forEach((h) => h(m))
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })

await send("Page.enable"); await send("Runtime.enable")
await send("Emulation.setDeviceMetricsOverride", { width: 412, height: 732, deviceScaleFactor: 3, mobile: true })
await send("Emulation.setTouchEmulationEnabled", { enabled: true })
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] })
await send("Page.navigate", { url })
await new Promise((r) => setTimeout(r, 2000))
// a clean first visit: dark theme, default text size, nothing saved, no install hint
await send("Runtime.evaluate", { expression: `localStorage.clear(); localStorage.setItem("theme","dark"); localStorage.setItem("installHint","1"); location.reload()` })
await new Promise((r) => setTimeout(r, 4000)) // data + fonts + images

const frames = [] // [file, timestamp seconds]
let start = null
handlers.push((m) => {
  if (m.method === "Page.screencastFrame") {
    const f = `${String(frames.length).padStart(5, "0")}.jpg`
    writeFileSync(dir + f, Buffer.from(m.params.data, "base64"))
    frames.push([f, m.params.metadata.timestamp])
    send("Page.screencastFrameAck", { sessionId: m.params.sessionId })
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.args[0]?.value === "PROMO_START") start = m.params.timestamp / 1000
})
await send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1236, maxHeight: 2196, everyNthFrame: 1 })
await new Promise((r) => setTimeout(r, 500))
const src = readFileSync(new URL("./.run.js", import.meta.url), "utf8")
const res = await send("Runtime.evaluate", { expression: `(${src})()`, awaitPromise: true, userGesture: true })
await new Promise((r) => setTimeout(r, 300))
await send("Page.stopScreencast")
await new Promise((r) => setTimeout(r, 300))

// ffconcat: each frame shown until the next one arrives
const t0 = frames[0][1]
let list = "ffconcat version 1.0\n"
frames.forEach(([f, t], k) => {
  const next = frames[k + 1]?.[1] ?? t + 0.3
  list += `file 'frames/${f}'\nduration ${(next - t).toFixed(4)}\n`
})
list += `file 'frames/${frames.at(-1)[0]}'\n`
writeFileSync(new URL("./frames.txt", import.meta.url), list)
writeFileSync(new URL("./start.txt", import.meta.url), String(start ? start - t0 : 0))
console.log(JSON.stringify({ result: res.result?.result?.value ?? res.result?.exceptionDetails?.text, frames: frames.length, seconds: (frames.at(-1)[1] - t0).toFixed(2), start: start ? (start - t0).toFixed(3) : null }))
await fetch(`http://localhost:9222/json/close/${target.id}`)
ws.close()
