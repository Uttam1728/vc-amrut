// POST /api/feedback — saves one feedback message to D1 (Cloudflare Pages Function).
// Minimal local types so the web app needs no extra dependency.
type D1 = { prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<unknown>; first<T>(): Promise<T | null> } } }
type Ctx = { request: Request; env: { DB: D1 } }

const KINDS = ["mistake", "suggestion", "other"]
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n)

async function hash(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16)
}

export async function onRequestPost({ request, env }: Ctx) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return json({ error: "bad request" }, 400)
  }
  if (body.website) return json({ ok: true }) // honeypot: bots fill hidden fields, people don't

  const message = clip(body.message, 2000)
  if (message.length < 3) return json({ error: "message too short" }, 400)

  // At most 5 messages per device per 10 minutes. Only a salted hash of the IP is stored.
  const ipHash = await hash(`vq-feedback|${request.headers.get("CF-Connecting-IP") ?? ""}`)
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM feedback WHERE ip_hash = ? AND created_at > datetime('now', '-10 minutes')",
  ).bind(ipHash).first<{ n: number }>()
  if ((recent?.n ?? 0) >= 5) return json({ error: "too many" }, 429)

  await env.DB.prepare(
    "INSERT INTO feedback (kind, message, name, quote, page, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    KINDS.includes(String(body.kind)) ? String(body.kind) : "other",
    message,
    clip(body.name, 100) || null,
    clip(body.quote, 500) || null,
    clip(body.page, 500) || null,
    ipHash,
    clip(request.headers.get("user-agent"), 300),
  ).run()

  return json({ ok: true })
}
