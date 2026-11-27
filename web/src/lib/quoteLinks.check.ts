// Run: node src/lib/quoteLinks.check.ts
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createQuoteLinks, quoteCode, subtopicCode, topicCode, type QuoteData } from "./quoteLinks.ts"

// Published codes must survive future refactors of the encoder.
assert.equal(topicCode("વિષય"), "1ldq6u6")
assert.equal(subtopicCode("વિષય", "પેટા વિષય"), "1o5fvbw")
assert.equal(quoteCode({ no: 1, vach: "", vachno: 1, text: "પરીક્ષણ" }), "139mul8")

const data: QuoteData = JSON.parse(readFileSync(new URL("../../public/subtopics.json", import.meta.url), "utf8"))
const { routes, shorten } = createQuoteLinks(data, { today: "આજ", saved: "સાચવેલાં" })
const identities = new Map<string, string>()
const register = (code: string, identity: string) => {
  assert.match(code, /^[a-z0-9]{6,7}$/)
  assert.ok(!identities.has(code) || identities.get(code) === identity, `Code collision: ${code}`)
  identities.set(code, identity)
}
const resolvedQuote = (index: ReturnType<typeof createQuoteLinks>, code: string) => {
  const route = index.routes.get(code)!
  assert.ok(route?.t && route.s && route.q)
  return data[route.t].find((s) => s.name === route.s)!.quotes![route.q - 1]
}
const normalize = (text: string) => {
  text = text.normalize("NFC").replace(/\s+/g, " ").trim()
  return (text.match(/["“”]/g) ?? []).length % 2 ? text.replace(/\s*["”]\s*$/, "") : text
}
let cards = 0
for (const [topic, subs] of Object.entries(data)) {
  register(topicCode(topic), JSON.stringify(["topic", topic]))
  assert.deepEqual(routes.get(topicCode(topic)), { t: topic })
  assert.deepEqual(shorten({ t: topic }), { a: topicCode(topic) })
  for (const sub of subs) {
    register(subtopicCode(topic, sub.name), JSON.stringify(["subtopic", topic, sub.name]))
    assert.deepEqual(routes.get(subtopicCode(topic, sub.name)), { t: topic, s: sub.name })
    assert.deepEqual(shorten({ t: topic, s: sub.name }), { a: subtopicCode(topic, sub.name) })
    sub.quotes?.forEach((quote, i) => {
      const code = quoteCode(quote)
      register(code, JSON.stringify(["quote", quote.vachno, normalize(quote.text)]))
      assert.equal(quoteCode(resolvedQuote({ routes, shorten }, code)), code)
      assert.deepEqual(shorten({ t: topic, s: sub.name, q: i + 1 }), { a: code })
      assert.equal(quoteCode({ ...quote, no: quote.no + 100 }), code)
      assert.equal(quoteCode({ ...quote, text: normalize(quote.text) }), code)
      cards++
    })
  }
  const all = subs.flatMap((s) => s.quotes ?? [])
  all.forEach((q, i) => assert.deepEqual(shorten({ t: topic, q: i + 1 }), { a: quoteCode(q) }))
}

// The data's topic/subtopic order cannot change a code's canonical source.
const reordered: QuoteData = Object.fromEntries(Object.entries(data).reverse().map(([t, subs]) => [t, [...subs].reverse()]))
assert.deepEqual(createQuoteLinks(reordered).routes, createQuoteLinks(data).routes)
// Reordering cards changes the resolved position, while preserving each quote's code.
const reversedQuotes: QuoteData = Object.fromEntries(Object.entries(data).map(([t, subs]) => [t, subs.map((s) => ({ ...s, quotes: s.quotes ? [...s.quotes].reverse() : undefined }))]))
for (const [code, route] of createQuoteLinks(reversedQuotes).routes) {
  if (!route.q) continue
  const q = reversedQuotes[route.t!].find((s) => s.name === route.s)!.quotes![route.q - 1]
  assert.equal(quoteCode(q), code)
  assert.equal(quoteCode(resolvedQuote({ routes, shorten }, code)), code)
}
assert.deepEqual(shorten({ t: "આજ" }), { a: "today", s: undefined, q: undefined })
assert.deepEqual(shorten({ t: "સાચવેલાં", s: "મારી યાદી", q: 2 }), { a: "saved", s: "મારી યાદી", q: 2 })
assert.deepEqual(shorten({ a: "abc123" }), { a: "abc123" })
assert.deepEqual(shorten({ t: "unknown" }), { t: "unknown" })
const example = { no: 1, vach: "", vachno: 1, text: "અ".repeat(100) }
assert.notEqual(quoteCode(example), quoteCode({ ...example, text: example.text + "બ" }))
console.log(`Short links OK: ${Object.keys(data).length} topics, ${Object.values(data).flat().length} subtopics, ${cards} cards; ${identities.size} distinct codes, no collisions.`)
