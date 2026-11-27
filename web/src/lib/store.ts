// Small app-wide state kept in localStorage / the URL hash, exposed as React hooks.
import { useSyncExternalStore } from "react"

export type Quote = { no: number; vach: string; vachno: number; text: string }
export type Item = { topic: string; sub: string; quote: Quote }

function store<T>(event: string, read: () => T) {
  const subscribe = (cb: () => void) => (addEventListener(event, cb), () => removeEventListener(event, cb))
  return {
    use: () => useSyncExternalStore(subscribe, read),
    emit: () => dispatchEvent(new Event(event)),
  }
}

// ── Theme: saved choice, else dark ─────────────────────────────
const isDark = () => (localStorage.getItem("theme") ?? "dark") === "dark" // dark by default; a chosen theme is remembered
const theme = store("themechange", isDark)
function applyTheme() {
  const d = isDark()
  document.documentElement.classList.toggle("dark", d)
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", d ? "#161311" : "#fbf9f3")
  theme.emit()
}
applyTheme()
export const useDark = theme.use
/**
 * Switch theme in one clean step: per-element colour transitions are paused for the instant of the swap
 * (otherwise each fades at its own speed and the page flickers), and where supported the browser
 * cross-fades the whole page once.
 */
export function toggleTheme() {
  const pause = document.createElement("style")
  pause.textContent = "*,*::before,*::after{transition:none!important}"
  document.head.append(pause)
  const swap = () => (localStorage.setItem("theme", isDark() ? "light" : "dark"), applyTheme())
  const resume = () => requestAnimationFrame(() => requestAnimationFrame(() => pause.remove()))
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches)
    document.startViewTransition(swap).finished.finally(resume)
  else (swap(), resume())
}

// ── Quote text size ──────────────────────────────────────────────────────
// rem, so touch screens get them 12.5% larger too (default 1.125rem ≈ 20px on a phone)
export const TEXT_SIZES = [1, 1.125, 1.25, 1.4, 1.6]
const readSize = () => Math.min(Number(localStorage.getItem("textSize") ?? 1), TEXT_SIZES.length - 1)
const size = store("sizechange", readSize)
const applySize = () => document.documentElement.style.setProperty("--qs", `${TEXT_SIZES[readSize()]}rem`)
applySize()
export const useTextSize = size.use
export const setTextSize = (n: number) => {
  localStorage.setItem("textSize", String(Math.max(0, Math.min(n, TEXT_SIZES.length - 1))))
  applySize()
  size.emit()
}

// ── Saved quotes ─────────────────────────────────────────────────────────
export const quoteKey = (q: Quote) => `${q.vachno}|${q.text.slice(0, 60)}`
let saved: Item[] = JSON.parse(localStorage.getItem("saved") ?? "[]")
const savedStore = store("savedchange", () => saved)
export const useSaved = savedStore.use
export const isSaved = (item: Item) => saved.some((s) => quoteKey(s.quote) === quoteKey(item.quote))
export const reorderSaved = (items: Item[]) => (saved = items, localStorage.setItem("saved", JSON.stringify(saved)), savedStore.emit())
export function toggleSaved(item: Item) {
  const k = quoteKey(item.quote)
  saved = saved.some((s) => quoteKey(s.quote) === k) ? saved.filter((s) => quoteKey(s.quote) !== k) : [item, ...saved]
  localStorage.setItem("saved", JSON.stringify(saved))
  savedStore.emit()
}

// ── Saved Vachanamruts (by number, newest first) ─────────────────────────
let favVachs: number[] = JSON.parse(localStorage.getItem("favVachs") ?? "[]")
const favVachStore = store("favvachchange", () => favVachs)
export const useFavVachs = favVachStore.use
export function toggleFavVach(n: number) {
  favVachs = favVachs.includes(n) ? favVachs.filter((x) => x !== n) : [n, ...favVachs]
  localStorage.setItem("favVachs", JSON.stringify(favVachs))
  favVachStore.emit()
}

// ── Route in the hash: #a=<short code>, or legacy #t=<topic>&s=<subtopic>&q=<card number> ──
export type Route = { a?: string; t?: string; s?: string; q?: number }
let routeCache = { hash: "\0", route: {} as Route }
function readRoute(): Route {
  const h = location.hash.slice(1)
  if (h === routeCache.hash) return routeCache.route
  let route: Route = {}
  if (h && !h.includes("=")) route = { t: decodeURIComponent(h) } // old #<topic> links
  else if (h) {
    const p = new URLSearchParams(h)
    route = { a: p.get("a") ?? undefined, t: p.get("t") ?? undefined, s: p.get("s") ?? undefined, q: Number(p.get("q")) || undefined }
  }
  routeCache = { hash: h, route }
  return route
}
const route = store("hashchange", readRoute)
export const useRoute = route.use
export const formatRoute = (r: Route) =>
  new URLSearchParams(Object.entries(r).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()
let encodeRoute = (r: Route): Route => r
export const setRouteEncoder = (encoder: (r: Route) => Route) => { encodeRoute = encoder }
const format = (r: Route) => formatRoute(encodeRoute(r))
/** Push a new view (back button works), or quietly replace (e.g. card position while swiping). */
export function nav(r: Route, replace = false) {
  if (r.t) localStorage.setItem("last", formatRoute(r)) // "continue where you left off" on Home
  // Swiping keeps the current view (whole topic, one subtopic, Today, or Saved).
  // Share links use the quote code; a view's position stays relative to that view.
  if (replace) {
    const view = encodeRoute({ t: r.t, s: r.s })
    const hash = r.q !== undefined && !r.a ? formatRoute({ ...view, q: r.q }) : format(r)
    history.replaceState(null, "", "#" + hash)
  }
  else location.hash = format(r)
}
export const linkTo = (r: Route) => `${location.origin}${location.pathname}#${format(r)}`

// ── Your own lists (like playlists). Favorites (♥) above stay separate. ───
export type List = { name: string; items: Item[] }
let lists: List[] = JSON.parse(localStorage.getItem("lists") ?? "[]")
const listStore = store("listschange", () => lists)
export const useLists = listStore.use
const saveLists = (next: List[]) => (lists = next, localStorage.setItem("lists", JSON.stringify(lists)), listStore.emit())
export const createList = (name: string) => lists.some((l) => l.name === name) || saveLists([...lists, { name, items: [] }])
export const reorderList = (name: string, items: Item[]) => saveLists(lists.map((l) => (l.name === name ? { ...l, items } : l)))
export const deleteList = (name: string) => saveLists(lists.filter((l) => l.name !== name))
export const inList = (l: List, item: Item) => l.items.some((s) => quoteKey(s.quote) === quoteKey(item.quote))
export const toggleInList = (name: string, item: Item) =>
  saveLists(lists.map((l) => l.name !== name ? l
    : { ...l, items: inList(l, item) ? l.items.filter((s) => quoteKey(s.quote) !== quoteKey(item.quote)) : [...l.items, item] }))

// ── Share ────────────────────────────────────────────────────────────────
/** What goes with the picture card: a friendly note + the link (the card itself carries the quote). */
export const shareNote = (topic: string) => `"${topic}" વિષય પર વચનામૃતનું આ અમૃત બિંદુ મને ગમ્યું. તમે પણ અહીં વાંચી શકો 👉`
const enc = encodeURIComponent
export const shareTargets = (topic: string, url: string) => ({
  WhatsApp: `https://wa.me/?text=${enc(`${shareNote(topic)} ${url}`)}`,
  Telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(shareNote(topic))}`,
  X: `https://x.com/intent/post?text=${enc(shareNote(topic))}&url=${enc(url)}`,
})

/** Clipboard API only exists on https; plain-http (e.g. testing over Wi-Fi) falls back to the old copy command. */
export function copyText(text: string) {
  if (navigator.clipboard && isSecureContext) return void navigator.clipboard.writeText(text)
  const ta = Object.assign(document.createElement("textarea"), { value: text, readOnly: true })
  ta.style.cssText = "position:fixed;opacity:0"
  document.body.append(ta)
  ta.select()
  ta.setSelectionRange(0, text.length) // iOS
  document.execCommand("copy")
  ta.remove()
}
