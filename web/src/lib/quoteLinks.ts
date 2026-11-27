import type { Quote, Route } from "./store.ts"

export type QuoteData = Record<string, { name: string; quotes?: Quote[] }[]>

// Match the display cleanup, including quotes saved before that cleanup was added.
function identity(q: Quote) {
  let text = q.text.normalize("NFC").replace(/\s+/g, " ").trim()
  if ((text.match(/["“”]/g) ?? []).length % 2) text = text.replace(/\s*["”]\s*$/, "")
  return `${q.vachno}|${text}`
}

/** FNV-1a, encoded as 6–7 ASCII characters. Keep this algorithm stable for published links. */
function codeFor(key: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 0x01000193)
  return (hash >>> 0).toString(36).padStart(6, "0")
}

// Namespaces keep topics, subtopics, and quotes distinct. Quote IDs never use their filing position.
export const topicCode = (topic: string) => codeFor(JSON.stringify(["topic", topic]))
export const subtopicCode = (topic: string, sub: string) => codeFor(JSON.stringify(["subtopic", topic, sub]))
export const quoteCode = (quote: Quote) => codeFor(JSON.stringify(["quote", identity(quote)]))

/** Build destinations from current data; duplicate quotes have a consistent source by topic/subtopic name. */
export function createQuoteLinks(data: QuoteData, pages: Record<string, string> = {}) {
  const routes = new Map<string, Route>()
  const pageCodes = new Map<string, string>()
  for (const [code, topic] of Object.entries(pages)) {
    routes.set(code, { t: topic })
    pageCodes.set(topic, code)
  }
  for (const topic of Object.keys(data).sort()) {
    routes.set(topicCode(topic), { t: topic })
    for (const sub of [...data[topic]].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      routes.set(subtopicCode(topic, sub.name), { t: topic, s: sub.name })
      sub.quotes?.forEach((quote, index) => {
        const code = quoteCode(quote)
        if (!routes.has(code)) routes.set(code, { t: topic, s: sub.name, q: index + 1 })
      })
    }
  }

  const shorten = (route: Route): Route => {
    if (route.a || !route.t) return route
    const subs = data[route.t]
    if (!subs) {
      const a = pageCodes.get(route.t)
      return a ? { a, s: route.s, q: route.q } : route
    }
    const sub = route.s ? subs.find((s) => s.name === route.s) : undefined
    if (route.s && !sub) return route
    if (route.q !== undefined) {
      const quotes = sub ? sub.quotes ?? [] : subs.flatMap((s) => s.quotes ?? [])
      const quote = quotes[route.q - 1]
      return quote ? { a: quoteCode(quote) } : route
    }
    return { a: sub ? subtopicCode(route.t, sub.name) : topicCode(route.t) }
  }
  return { routes, shorten }
}
