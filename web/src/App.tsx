import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { AnimatePresence, Reorder, animate, motion, useDragControls, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import {
  ALargeSmall, LoaderCircle, ArrowUpRight, BookOpen, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Copy,
  Dices, FileDown, GripVertical, Heart, History, House, ImageIcon, MessageSquareWarning, Minus, ListChecks, ListOrdered, ListPlus, MessageCircle, Moon, Plus, Search, Send, Share2,
  Shuffle, Sun, Trash2, X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from "@/components/ui/combobox"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { matches, translit } from "@/lib/translit"
import { quoteCard } from "@/lib/shareCard"
import { printPdf } from "@/lib/print"
import {
  type Item, type Quote, type Route, createList, reorderList, reorderSaved, setTextSize, deleteList, inList, linkTo, nav, isSaved, quoteKey, shareTargets,
  shareNote, toggleInList, toggleSaved, toggleTheme, useDark, useLists, useRoute, useSaved, useTextSize,
  TEXT_SIZES,
} from "@/lib/store"

type Subtopic = { name: string; count: number | null; quotes?: Quote[] }
type Data = Record<string, Subtopic[]>
/** A group of cards on screen. `items` is undefined while a topic hasn't been scraped yet. */
type Section = { name: string; items?: Item[] }

const HOME = "હોમ · Home"
const TOPICS = "વિષયો · Topics" // tab only: the last topic you read
const TODAY = "આજનાં વચનામૃત · Today"
const TODAY_COUNT = 5

/** Today's quotes: the same five for everyone on a given day, spread across the whole collection. */
function todays(all: Item[]) {
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5)
  const picks: Item[] = []
  // stepping by a large prime visits every quote before repeating, so the five are always different
  for (let j = 0; picks.length < Math.min(TODAY_COUNT, all.length); j++) picks.push(all[(day * 7919 + j * 104729) % all.length])
  return picks
}
const FAV = "♥ પસંદગી · Favorites"
const SAVED = "સાચવેલાં · Saved"
const ALL = "બધા પેટા વિષયો · All subtopics"

// "ગ. મ. ૬૫" → "ગઢડા મધ્ય ૬૫" — the short codes the source uses, spelled out for students.
const PLACES: Record<string, string> = {
  "ગ. પ્ર.": "ગઢડા પ્રથમ", "ગ. મ.": "ગઢડા મધ્ય", "ગ. અં.": "ગઢડા અંત્ય", "લો.": "લોયા", "વર.": "વરતાલ",
  "સા.": "સારંગપુર", "કા.": "કારિયાણી", "પં.": "પંચાળા", "અમ.": "અમદાવાદ",
}
const vachName = (v: string) => {
  const m = v.match(/^(.*?)\s*([૦-૯0-9]+)$/)
  return m && PLACES[m[1]] ? `${PLACES[m[1]]} ${m[2]}` : v
}

/** Vachanamrut titles by number, e.g. 114 → "સંગશુદ્ધિનું" (from anirdesh.com's index). */
let titles: Record<string, string> = {}

/** Which Vachanamrut a quote is from — shown on top of every card; tap to read it in full. */
function VachRef({ item, sub }: { item: Item; sub?: string }) {
  return (
    <div className="mb-4">
      <a href={vachUrl(item.quote.vachno)} target="_blank" rel="noreferrer"
        className="press text-sm leading-snug font-semibold tracking-tight text-saffron">
        વચનામૃત {vachName(item.quote.vach)}
        {titles[item.quote.vachno] && <span className="font-normal text-muted-foreground"> · {titles[item.quote.vachno]}</span>}
        <ArrowUpRight className="ml-0.5 inline size-3.5 align-[-2px] opacity-50" />
      </a>
      {sub && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{sub}</p>}
    </div>
  )
}

const vachUrl = (n: number) => `https://www.anirdesh.com/vachanamrut/index.php?format=gu&vachno=${n}`
const total = (subs: Subtopic[]) => subs.reduce((n, s) => n + (s.count ?? 0), 0)
const az = (a: string, b: string) => a.localeCompare(b, "gu")
const sortAZ = (d: Data): Data =>
  Object.fromEntries(Object.keys(d).sort(az).map((t) => [t, [...d[t]].sort((x, y) => az(x.name, y.name))]))
const sectionCount = (secs: Section[]) => secs.reduce((n, s) => n + (s.items?.length ?? 0), 0)

const desktopQuery = matchMedia("(min-width: 768px)")
const useDesktop = () =>
  useSyncExternalStore(
    (cb) => (desktopQuery.addEventListener("change", cb), () => desktopQuery.removeEventListener("change", cb)),
    () => desktopQuery.matches,
  )

// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [data, setData] = useState<Data | null>(null)
  const [query, setQuery] = useState("")
  const route = useRoute()
  const saved = useSaved()
  const lists = useLists()
  const [sideFeedback, setSideFeedback] = useState(false)

  useEffect(() => {
    Promise.all([fetch("/subtopics.json").then((r) => r.json()), fetch("/vach.json").then((r) => r.json())]).then(([d, t]: [Data, Record<string, string>]) => {
      titles = t
      // Quotes cut out of dialogue keep the speech's closing quote mark with no opening one (86 on the source) — drop it.
      for (const subs of Object.values(d))
        for (const s of subs)
          for (const q of s.quotes ?? []) if ((q.text.match(/["“”]/g) ?? []).length % 2) q.text = q.text.replace(/\s*["”]\s*$/, "")
      setData(sortAZ(d))
    })
  }, [])

  // Every quote once (some are filed under two subtopics on the source site).
  const unique = useMemo(() => {
    if (!data) return []
    const seen = new Map<string, Item>()
    for (const [topic, subs] of Object.entries(data))
      for (const s of subs) for (const quote of s.quotes ?? []) if (!seen.has(quoteKey(quote))) seen.set(quoteKey(quote), { topic, sub: s.name, quote })
    return [...seen.values()]
  }, [data])

  const topics = data ? Object.keys(data) : []
  const current = route.t && (route.t === TODAY || route.t === SAVED || route.t === TOPICS || (data && route.t in data)) ? route.t : HOME
  useEffect(() => void document.querySelector("main")?.scrollTo(0, 0), [current])
  useEffect(() => {
    if (current === HOME || current === TOPICS) return
    const here = linkTo({ ...route, t: current }).split("#")[1]
    localStorage.setItem("last", here)
    if (current !== TODAY && current !== SAVED) localStorage.setItem("lastTopic", here) // where the Topics tab returns to
  }, [route, current])

  const sections: Section[] = useMemo(() => {
    if (!data) return []
    if (current === TODAY) {
      const groups = new Map<string, Item[]>()
      for (const it of todays(unique)) groups.set(`${it.topic} › ${it.sub}`, [...(groups.get(`${it.topic} › ${it.sub}`) ?? []), it])
      return [...groups].map(([name, items]) => ({ name, items }))
    }
    // Saved: favorites first, then the student's own lists — each one shows up as a "subtopic".
    if (current === SAVED) return [{ name: FAV, items: saved }, ...lists].filter((s) => s.items.length)
    if (current === HOME || current === TOPICS) return []
    return data[current].map((s) => ({ name: s.name, items: s.quotes?.map((quote) => ({ topic: current, sub: s.name, quote })) }))
  }, [data, current, unique, saved, lists])

  const q = query.trim()
  const searching = q.length >= 2 && !/[a-z]/i.test(q) // English input filters topic names only

  const results = useMemo(() => {
    if (!data || !searching) return []
    const hits = new Map<string, Item & { where: string[] }>()
    for (const [topic, subs] of Object.entries(data))
      for (const s of subs)
        for (const quote of s.quotes ?? [])
          if (quote.text.includes(q)) {
            const k = quoteKey(quote)
            const where = `${topic} › ${s.name}`
            const hit = hits.get(k)
            if (hit) hit.where.push(where)
            else hits.set(k, { topic, sub: s.name, quote, where: [where] })
          }
    return [...hits.values()]
  }, [data, q, searching])

  const visibleTopics = q ? topics.filter((t) => matches(t, q) || results.some((r) => r.topic === t)) : topics
  const pickerItems = [TODAY, SAVED, ...topics]
  const savedCount = saved.length + lists.reduce((n, l) => n + l.items.length, 0)
  const pickerCount = (t: string) => (t === TODAY ? TODAY_COUNT : t === SAVED ? savedCount : data ? total(data[t]) : 0)

  return (
    <div className="flex h-dvh flex-col bg-background md:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="card-glow hidden w-80 shrink-0 flex-col border-r md:flex">
        <div className="space-y-4 p-5 pb-3">
          <div className="flex items-start justify-between">
            {/* app name = home link (like most apps' logo) */}
            <a href="#" onClick={() => setQuery("")} className="press rounded-md" aria-label="હોમ · Home">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Vachanamrut</p>
              <p className="mt-1 text-lg font-semibold tracking-tight">વચનામૃત અમૃત બિંદુ</p>
            </a>
            <HeaderButtons />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <SearchInput value={query} onChange={setQuery} placeholder="વિષય કે અમૃત બિંદુ શોધો…" className="h-9 pl-8" />
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <nav className="space-y-px px-3 pb-4">
            {!q && (
              <>
                <SideLink t={HOME} current={current} icon={<House className="size-4" />} label="હોમ" />
                <SideLink t={TODAY} current={current} icon={<CalendarDays className="size-4" />} label="આજનાં વચનામૃત" count={TODAY_COUNT} />
                <SideLink t={SAVED} current={current} icon={<Heart className="size-4" />} label="સાચવેલાં" count={savedCount} />
                {/* your lists, right under Saved (Favorites first) */}
                {[...(saved.length ? [{ name: FAV, n: saved.length }] : []), ...lists.map((l) => ({ name: l.name, n: l.items.length }))].map((l) => {
                  const on = current === SAVED && route.s === l.name
                  return (
                    <a key={l.name} href={"#" + new URLSearchParams({ t: SAVED, s: l.name })}
                      className={cn("press ml-5 flex items-center gap-2 rounded-md border-l px-2.5 py-1.5 text-sm",
                        on ? "border-saffron font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
                      {l.name === FAV ? <Heart className="size-3.5" /> : <ListChecks className="size-3.5" />}
                      <span className="flex-1 truncate">{l.name === FAV ? "પસંદગી · Favorites" : l.name}</span>
                      <span className="text-xs tabular-nums opacity-60">{l.n}</span>
                    </a>
                  )
                })}
                <div className="mx-2.5 my-2 border-t" />
              </>
            )}
            {visibleTopics.map((t) => (
              <SideLink key={t} t={t} current={searching ? "" : current} label={t} count={data ? total(data[t]) : 0} onClick={() => setQuery("")} />
            ))}
            {q && visibleTopics.length === 0 && <p className="px-2.5 py-6 text-sm text-muted-foreground">કંઈ મળ્યું નહીં</p>}
          </nav>
        </ScrollArea>
        <div className="border-t px-5 py-3 text-xs text-muted-foreground">
          <button className="press hover:text-foreground" onClick={() => setSideFeedback(true)}>સૂચન / ભૂલ જણાવો</button>
          <FeedbackSheet open={sideFeedback} onOpenChange={setSideFeedback} />
        </div>
      </aside>

      {/* Main */}
      <main className="min-h-0 flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        {!data ? (
          <LoadingSkeleton />
        ) : current === TOPICS && !searching ? (
          <TopicsPage data={data} />
        ) : searching || current === HOME ? (
          <Home data={data} unique={unique} query={query} setQuery={setQuery} searching={searching} results={results} savedCount={savedCount} />
        ) : (
          <TopicView
            key={current}
            title={current}
            sections={sections}
            route={{ ...route, t: current }}
            pickerItems={pickerItems}
            pickerCount={pickerCount}
          />
        )}
      </main>
      <TabBar current={current} savedCount={savedCount} />
    </div>
  )
}

/** Grey shapes in the layout's place while the quotes download (they pulse gently; still for reduced motion). */
// Images: Wikimedia Commons, CC BY-SA 4.0, © BAPS Swaminarayan Sanstha. Credits are shown in Home's About section.
const IMAGES = {
  sabha: { src: "/img/sabha.jpg", alt: "ગઢડામાં લીમડા નીચે ભગવાન સ્વામિનારાયણ પરમહંસોને વચનામૃત કહે છે", credit: "https://commons.wikimedia.org/wiki/File:Vachanamrut_Cover_Image.jpg" },
  manuscript: { src: "/img/manuscript.jpg", alt: "વચનામૃતની મૂળ હસ્તપ્રત", credit: "https://commons.wikimedia.org/wiki/File:Manuscript.jpg" },
  mahant: { src: "/img/mahant-swami.jpg", alt: "મહંત સ્વામી મહારાજ વચનામૃતનું નિરૂપણ કરે છે", credit: "https://commons.wikimedia.org/wiki/File:Mahant_Swami_Maharaj_discoursing_on_the_Vachanamrut.jpg" },
}

function LoadingSkeleton() {
  return (
    <div aria-busy="true" className="relative grid h-full min-h-[60dvh] place-items-center overflow-hidden">
      <img src={IMAGES.manuscript.src} alt="" className="absolute inset-0 size-full scale-105 object-cover opacity-35 blur-[2px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
      <div className="relative text-center">
        <p className="font-serif text-4xl font-semibold tracking-tight md:text-5xl">વચનામૃત</p>
        <p className="mt-3 text-sm text-muted-foreground motion-safe:animate-pulse">ખૂલે છે…</p>
      </div>
    </div>
  )
}

/** Phone navigation lives at the bottom, in thumb reach. Topics count as "Home" — that's where you pick them. */
function TabBar({ current, savedCount }: { current: string; savedCount: number }) {
  // Each tab is highlighted only where it leads: Home = the home page, Topics = any topic you're reading.
  const active = current === HOME || current === TODAY || current === SAVED ? current : TOPICS
  const tabs = [
    [HOME, House, "હોમ"],
    [TOPICS, BookOpen, "વિષયો"],
    [TODAY, CalendarDays, "આજ"],
    [SAVED, Heart, "સાચવેલાં"],
  ] as const
  return (
    // Floating "liquid glass" bar: frosted, slightly saturated, with a hairline highlight on top.
    <nav className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] z-40 flex rounded-[1.75rem] border border-foreground/10 bg-background/60 p-1 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl backdrop-saturate-150 md:hidden">
      {tabs.map(([t, Icon, label]) => {
        const on = t === active
        return (
          <a
            key={t}
            href={t === HOME ? "#" : "#" + new URLSearchParams({ t })}
            aria-current={on ? "page" : undefined}
            className={cn("press relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors duration-150", on ? "text-foreground" : "text-muted-foreground")}
          >
            {on && <motion.span layoutId="tab" className="absolute inset-0 rounded-[1.4rem] bg-saffron-soft" transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }} />}
            <Icon className={cn("relative size-[22px]", on && "text-saffron", on && t === SAVED && "fill-current")} strokeWidth={on ? 2.2 : 1.8} />
            <span className="relative">{label}</span>
            <AnimatePresence>
            {t === SAVED && savedCount > 0 && (
              // springs in each time the count changes (idea: transitions.dev "Notification badge")
              <motion.span
                key={savedCount}
                initial={{ scale: 0.6, x: -3, y: 3, opacity: 0 }}
                animate={{ scale: 1, x: 0, y: 0, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.15 } }}
                transition={{ type: "spring", duration: 0.25, bounce: 0.4 }}
                className="absolute top-1.5 left-1/2 ml-2 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[0.625rem] leading-4 font-semibold text-white tabular-nums"
              >
                {savedCount}
              </motion.span>
            )}
            </AnimatePresence>
          </a>
        )
      })}
    </nav>
  )
}

function SideLink({ t, current, label, count, icon, onClick }: {
  t: string; current: string; label: string; count?: number; icon?: React.ReactNode; onClick?: () => void
}) {
  return (
    <a
      href={t === HOME ? "#" : "#" + new URLSearchParams({ t })}
      onClick={onClick}
      className={cn(
        "press flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm",
        t === current ? "bg-saffron-soft font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <motion.span key={count} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 0.6 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0.5 }} className="shrink-0 text-xs tabular-nums">
          {count}
        </motion.span>
      )}
    </a>
  )
}

function HeaderButtons() {
  const dark = useDark()
  const size = useTextSize()
  return (
    <div className="flex items-center">
      <Popover>
        <PopoverTrigger render={<Button variant="ghost" size="icon" className="press size-11 text-muted-foreground md:size-9" aria-label="અક્ષરનું કદ · Text size" data-tip="અક્ષરનું કદ" />}>
          <ALargeSmall className="size-[18px]" />
        </PopoverTrigger>
        <PopoverContent align="end" initialFocus={false} className="w-auto gap-2 p-2">
          <p className="px-1 text-xs text-muted-foreground">અક્ષરનું કદ · Text size</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="press h-11 w-14 gap-0.5" disabled={size === 0} onClick={() => setTextSize(size - 1)} aria-label="નાના અક્ષર · Smaller">
              <span className="text-sm">A</span><Minus className="size-3.5" />
            </Button>
            <div className="flex gap-1.5" aria-label={`${size + 1} / ${TEXT_SIZES.length}`}>
              {TEXT_SIZES.map((_, n) => (
                <span key={n} className={cn("size-1.5 rounded-full transition-colors duration-150", n <= size ? "bg-foreground" : "bg-muted-foreground/30")} />
              ))}
            </div>
            <Button variant="outline" className="press h-11 w-14 gap-0.5" disabled={size === TEXT_SIZES.length - 1} onClick={() => setTextSize(size + 1)} aria-label="મોટા અક્ષર · Larger">
              <span className="text-lg">A</span><Plus className="size-3.5" />
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon" className="press size-11 text-muted-foreground md:size-9" onClick={toggleTheme}
        aria-label={dark ? "લાઇટ થીમ" : "ડાર્ક થીમ"} title={dark ? "Light theme" : "Dark theme"}>
        {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </div>
  )
}

// ── Pickers: combobox on desktop, bottom sheet on phones ─────────────────────

type PickerProps = { label: string; items: string[]; value: string; onChange: (v: string) => void; count: (v: string) => number | null }

function Picker(props: PickerProps) {
  return useDesktop() ? <ComboPicker {...props} /> : <SheetPicker {...props} />
}

function ItemLabel({ item }: { item: string }) {
  const special = item === ALL || item === TODAY || item === SAVED || item === FAV
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="leading-snug">{item}</span>
      {!special && <span className="truncate text-xs text-muted-foreground">{translit(item)}</span>}
    </span>
  )
}

function ComboPicker({ label, items, value, onChange, count }: PickerProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Combobox items={items} value={value} onValueChange={(v) => v && onChange(v)} filter={(item: string, q: string) => matches(item, q)}>
        <ComboboxTrigger aria-label={label} render={<Button variant="outline" className="press h-9 w-full min-w-0 justify-between px-3 font-normal" />}>
          <span className="truncate">{value}</span>
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxInput showTrigger={false} placeholder="શોધો — ગુજરાતી કે English…" />
          <ComboboxEmpty>કંઈ મળ્યું નહીં</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item} className="py-1.5">
                <ItemLabel item={item} />
                <span className="text-xs text-muted-foreground tabular-nums">{count(item)}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}

function SheetPicker({ label, items, value, onChange, count }: PickerProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const selected = useRef<HTMLButtonElement>(null)
  const list = items.filter((i) => matches(i, q))

  useEffect(() => {
    if (open) requestAnimationFrame(() => selected.current?.scrollIntoView({ block: "center" }))
  }, [open])

  return (
    <div className="min-w-0 flex-1">
      <Drawer open={open} onOpenChange={(o) => (setOpen(o), o || setQ(""))} showSwipeHandle>
        <DrawerTrigger aria-label={label} render={<Button variant="outline" className="press h-11 w-full min-w-0 justify-start gap-2 px-3 font-normal" />}>
          <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
          <span className="min-w-0 flex-1 truncate text-left">{value}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </DrawerTrigger>
        <DrawerContent initialFocus={false} className="h-[85dvh] pb-[env(safe-area-inset-bottom,0px)]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{label}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pt-3 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="શોધો — ગુજરાતી કે English…" className="h-11 pl-9" enterKeyHint="search" />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
            {list.map((item) => (
              <button
                key={item}
                ref={item === value ? selected : undefined}
                onClick={() => (onChange(item), setOpen(false), setQ(""))}
                className={cn("press flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left", item === value && "bg-muted")}
              >
                <ItemLabel item={item} />
                <span className="text-xs text-muted-foreground tabular-nums">{count(item)}</span>
                <Check className={cn("size-4 shrink-0", item !== value && "invisible")} />
              </button>
            ))}
            {list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">કંઈ મળ્યું નહીં</p>}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

// ── Topic view ───────────────────────────────────────────────────────────────

function TopicView({ title, sections, route, pickerItems, pickerCount }: {
  title: string; sections: Section[]; route: Route; pickerItems: string[]; pickerCount: (t: string) => number | null
}) {
  const desktop = useDesktop()
  const sub = route.s && sections.some((s) => s.name === route.s) ? route.s : null
  const shown = sub ? sections.filter((s) => s.name === sub) : sections
  const ready = sections.every((s) => s.items)
  const items = shown.flatMap((s) => s.items ?? [])
  const link = (n: number) => linkTo({ t: route.t, s: sub ?? undefined, q: n + 1 })
  const heading = title === TODAY ? "આજનાં વચનામૃત" : title === SAVED ? "સાચવેલાં" : title
  const meta =
    title === TODAY ? new Date().toLocaleDateString("gu-IN", { day: "numeric", month: "long", year: "numeric" })
    : `${sections.length} પેટા વિષય · ${sectionCount(sections)} અમૃત બિંદુ`

  const empty =
    title === SAVED && !sections.length ? (
      <Empty>
        હજી કંઈ સાચવ્યું નથી. અમૃત બિંદુ પર <Heart className="inline size-4 align-[-2px]" /> દબાવો (કે કાર્ડ પર બે વાર ટૅપ કરો), અથવા{" "}
        <ListPlus className="inline size-4 align-[-2px]" /> થી તમારી પોતાની યાદી બનાવો — દા.ત. “પરીક્ષા”. બધું આ ફોનમાં જ સચવાય છે.
      </Empty>
    ) : !ready ? (
      <Empty>આ વિષયનાં અમૃત બિંદુ હજી એકઠાં થાય છે. થોડી વારમાં ફરી ખોલો.</Empty>
    ) : null

  // PDF of exactly what's selected: the whole topic, one subtopic, Favorites, or one of your lists.
  const exportPdf = () =>
    printPdf({
      title: heading,
      subtitle: sub ?? (sections.length > 1 ? (title === SAVED ? "બધી યાદીઓ" : "બધા પેટા વિષયો") : undefined),
      site: location.host,
      sections: shown.map((s) => ({
        name: shown.length > 1 ? s.name : undefined,
        quotes: (s.items ?? []).map((it) => ({
          reference: `વચનામૃત ${vachName(it.quote.vach)}`,
          title: titles[it.quote.vachno],
          where: title === SAVED || title === TODAY ? `${it.topic} › ${it.sub}` : undefined,
          text: it.quote.text,
        })),
      })),
    })
  const pdfButton = !empty && <PdfButton onExport={exportPdf} />

  const bar = (
    <div className="glow-header sticky top-0 z-10 pt-[env(safe-area-inset-top,0px)]">
      <div className="flex min-h-12 items-center justify-between pt-1.5 pr-2 pl-4 md:hidden">
        <p className="text-base font-semibold tracking-tight">વચનામૃત અમૃત બિંદુ</p>
        <div className="flex items-center">{pdfButton}<HeaderButtons /></div>
      </div>
      {title === TODAY ? (
        <p className="px-4 pt-1 pb-3 text-sm text-muted-foreground md:hidden">
          <span className="font-medium text-foreground">આજનાં વચનામૃત</span> · {new Date().toLocaleDateString("gu-IN", { day: "numeric", month: "long" })}
        </p>
      ) : (
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 pt-1 pb-3 md:flex-row md:gap-3 md:px-10 md:pt-3">
        <Picker label="વિષય" items={pickerItems} value={title} onChange={(t) => nav({ t })} count={pickerCount} />
        <Picker
          label={title === SAVED ? "યાદી" : "પેટા વિષય"}
          items={[ALL, ...sections.map((s) => s.name)]}
          value={sub ?? ALL}
          onChange={(v) => nav({ t: route.t, s: v === ALL ? undefined : v })}
          count={(n) => (n === ALL ? sectionCount(sections) : (sections.find((s) => s.name === n)?.items?.length ?? null))}
        />
      </div>
      )}
    </div>
  )

  if (!desktop)
    return (
      <div className="flex h-full flex-col">
        {bar}
        {empty ?? (
          <Deck
            key={`${sub}|${items.length}`} // reset when the deck changes size (e.g. un-saving in Saved)
            items={items}
            start={(route.q ?? 1) - 1}
            onIndex={(n) => nav({ t: route.t, s: sub ?? undefined, q: n + 1 }, true)}
            link={link}
            // Saved's second picker chooses a list, not a subtopic, so there the card always says where the quote is from.
            onReorder={title === SAVED && sub ? (next) => (sub === FAV ? reorderSaved(next) : reorderList(sub, next)) : undefined}
            label={(it) => (title === SAVED || (title === TODAY && !sub) ? `${it.topic} › ${it.sub}` : sub ? undefined : it.sub)}
          />
        )}
      </div>
    )

  // Desktop: the sidebar picks the topic, so no topic dropdown here. Heading reads topic → subtopic;
  // the right rail lists every subtopic (scroll-spy on "all", jump between them when one is open).
  const idx = sub ? sections.findIndex((s) => s.name === sub) : -1
  const subHref = (name?: string) => "#" + new URLSearchParams(name ? { t: route.t!, s: name } : { t: route.t! })
  const subLabel = title === SAVED ? "યાદી" : "પેટા વિષય"
  return (
    <div key={sub ?? ""} className="enter mx-auto flex max-w-6xl gap-14 px-10 py-12">
      <article className="max-w-3xl min-w-0 flex-1">
        <header className="mb-10">
          {sub && (
            <a href={subHref()} className="press inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="size-4" /> {heading}
            </a>
          )}
          <h2 className="mt-1 font-serif text-4xl leading-tight font-semibold tracking-tight">{sub ?? heading}</h2>
          <div className="mt-3 flex items-center gap-3">
            <p className="text-sm text-muted-foreground tabular-nums">
              {sub ? `${subLabel} ${idx + 1} / ${sections.length} · ${items.length} અમૃત બિંદુ` : meta}
            </p>
            {!empty && <PdfButton onExport={exportPdf} labelled />}
          </div>
          {sections.length > 1 && title !== TODAY && (
            <div className="mt-6 max-w-md">
              <Picker
                label={subLabel}
                items={[ALL, ...sections.map((s) => s.name)]}
                value={sub ?? ALL}
                onChange={(v) => nav({ t: route.t, s: v === ALL ? undefined : v })}
                count={(n) => (n === ALL ? sectionCount(sections) : (sections.find((s) => s.name === n)?.items?.length ?? null))}
              />
            </div>
          )}
        </header>
        {empty ?? <DesktopList sections={sections} shown={shown} target={route.q} link={link} single={!!sub || sections.length === 1} />}
        {sub && (
          <nav className="mt-16 grid grid-cols-2 gap-3 border-t pt-8">
            {[sections[idx - 1], sections[idx + 1]].map((s, n) =>
              s ? (
                <a key={s.name} href={subHref(s.name)}
                  className={cn("press group flex flex-col gap-1 rounded-2xl border p-4 transition-colors duration-150 hover:border-foreground/20", n === 1 && "col-start-2 items-end text-right")}>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {n === 0 ? <><ChevronLeft className="size-3.5" /> પાછલો</> : <>આગલો <ChevronRight className="size-3.5" /></>}
                  </span>
                  <span className="text-base font-medium">{s.name}</span>
                </a>
              ) : null,
            )}
          </nav>
        )}
      </article>
      {!empty && sections.length > 1 && <OnThisPage sections={sections} sub={sub} href={subHref} />}
    </div>
  )
}

/**
 * PDF button with visible states (ideas: transitions.dev "Text states swap" + "Success check"):
 * icon → "PDF બને છે…" with a spinner → drawn ✓ "PDF તૈયાર" when the print window closes → back to the icon.
 * The pill grows/shrinks smoothly (layout) and each state crossfades with a little blur.
 */
function PdfButton({ onExport, labelled }: { onExport: () => Promise<void>; labelled?: boolean }) {
  const [state, setState] = useState<"idle" | "making" | "done">("idle")
  const go = async () => {
    if (state !== "idle") return
    setState("making")
    await onExport()
    setState("done")
    setTimeout(() => setState("idle"), 1800)
  }
  return (
    <motion.button
      layout
      onClick={go}
      aria-label="PDF બનાવો · Save as PDF"
      data-tip={labelled ? undefined : "PDF બનાવો"}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className={cn(
        "press inline-flex items-center justify-center overflow-hidden rounded-full text-muted-foreground",
        labelled ? "h-8 border px-3 text-sm" : "h-11 min-w-11 px-2.5 md:h-9 md:min-w-9",
        state !== "idle" && "bg-saffron-soft text-foreground",
      )}
      style={{ borderRadius: 999 }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -4, filter: "blur(4px)" }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="flex items-center gap-1.5 whitespace-nowrap"
          aria-live="polite"
        >
          {state === "idle" && <><FileDown className={labelled ? "size-3.5" : "size-5"} />{labelled && "PDF"}</>}
          {state === "making" && <><LoaderCircle className="size-4 animate-spin text-saffron" /><span className="text-sm">PDF બને છે…</span></>}
          {state === "done" && (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-4 text-saffron" aria-hidden>
                <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }} />
              </svg>
              <span className="text-sm">PDF તૈયાર</span>
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="m-4 rounded-2xl border border-dashed p-6 text-sm leading-relaxed text-muted-foreground md:m-0">{children}</p>
}

function DesktopList({ sections, shown, target, link, single }: { sections: Section[]; shown: Section[]; target?: number; link: (n: number) => string; single: boolean }) {
  const [flash, setFlash] = useState<number | undefined>(target)

  // Deep link to a card: bring it into view and briefly ring it so the eye finds it.
  useEffect(() => {
    if (!target) return
    document.getElementById(`c${target}`)?.scrollIntoView({ block: "center" })
    const t = setTimeout(() => setFlash(undefined), 1600)
    return () => clearTimeout(t)
  }, [target])

  let n = 0
  return (
    <div className="space-y-16">
      {shown.map((s) => {
        const i = sections.indexOf(s)
        return (
          <section key={s.name} id={`s${i}`} data-i={i} className="scroll-mt-24">
            {!single && (
              <h3 className="mb-6 flex items-baseline gap-3 text-lg font-semibold">
                <span className="text-xs font-normal text-muted-foreground tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <a href={"#" + new URLSearchParams({ t: s.items?.[0]?.topic ?? "", s: s.name })} className="hover:underline">{s.name}</a>
              </h3>
            )}
            <div className="space-y-4">
              {s.items!.map((it) => {
                const k = n++
                return <QuoteCard key={quoteKey(it.quote)} id={`c${k + 1}`} item={it} url={link(k)} flash={flash === k + 1} />
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** Desktop rail. The marker slides to the subtopic being read (scroll-spy). */
function OnThisPage({ sections, sub, href }: { sections: Section[]; sub: string | null; href: (s: string) => string }) {
  const [spy, setActive] = useState(0)
  const active = sub ? sections.findIndex((s) => s.name === sub) : spy
  const [mark, setMark] = useState({ top: 0, height: 0 })
  const lis = useRef<(HTMLLIElement | null)[]>([])

  useEffect(() => {
    if (sub) return
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.i))
        if (hit.length) setActive(Math.min(...hit))
      },
      { root: document.querySelector("main"), rootMargin: "-96px 0px -70% 0px" },
    )
    document.querySelectorAll("section[data-i]").forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [sections, sub])

  useLayoutEffect(() => {
    const li = lis.current[active]
    if (li) setMark({ top: li.offsetTop, height: li.offsetHeight })
  }, [active])

  return (
    <aside className="sticky top-28 hidden max-h-[calc(100dvh-8rem)] w-56 shrink-0 self-start overflow-y-auto xl:block">
      <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{sub ? "બધા પેટા વિષયો" : "આ પાના પર"}</p>
      <ul className="relative space-y-2 border-l text-sm">
        <span
          aria-hidden
          className="absolute top-0 -left-px w-px bg-saffron transition-[transform,height] duration-200 ease-(--ease-out)"
          style={{ transform: `translateY(${mark.top}px)`, height: mark.height }}
        />
        {sections.map((s, i) => (
          <li key={s.name} ref={(el) => void (lis.current[i] = el)}>
            <a
              href={sub ? href(s.name) : `#s${i}`}
              onClick={sub ? undefined : (e) => (e.preventDefault(), document.getElementById(`s${i}`)?.scrollIntoView({ behavior: "smooth" }))}
              className={cn(
                "block pl-3 leading-snug transition-colors duration-150",
                i === active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.name}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  )
}

// ── Quote card + actions ─────────────────────────────────────────────────────

function QuoteCard({ id, item, url, flash, where, q }: { id?: string; item: Item; url: string; flash?: boolean; where?: string[]; q?: string }) {
  const [burst, setBurst] = useState(0)
  const lastTap = useRef(0)
  // Two taps/clicks within 320 ms = like (mouse, touch and pen alike). Adds to favorites, never removes.
  const tap = (e: React.MouseEvent) => {
    if ((e.target as Element).closest("button,a")) return
    const now = Date.now()
    if (now - lastTap.current > 320) return void (lastTap.current = now)
    lastTap.current = 0
    window.getSelection()?.removeAllRanges() // a double-click would otherwise select a word
    if (!isSaved(item)) toggleSaved(item)
    setBurst((b) => b + 1)
    navigator.vibrate?.(10)
  }
  return (
    <figure
      id={id}
      onClick={tap}
      className={cn(
        "card-glow relative scroll-mt-28 rounded-xl border bg-card p-6 transition-[border-color,box-shadow] duration-500 hover:border-foreground/15",
        flash && "border-foreground/30 shadow-[0_0_0_4px_color-mix(in_oklch,var(--foreground)_8%,transparent)]",
      )}
    >
      <VachRef item={item} sub={where?.join("  ·  ")} />
      <blockquote className="font-serif text-(length:--qs) leading-[1.95] text-card-foreground">
        {q ? <Highlight text={item.quote.text} q={q} /> : item.quote.text}
      </blockquote>
      <figcaption className="mt-4">
        <QuoteActions item={item} url={url} />
      </figcaption>
      {burst > 0 && (
        <motion.div key={burst} aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center"
          initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.15, 1, 1.1] }}
          transition={{ duration: 0.85, times: [0, 0.25, 0.65, 1], ease: "easeOut" }}>
          <Heart className="size-20 fill-rose-500 text-rose-500 drop-shadow-[0_8px_24px_rgba(244,63,94,0.45)]" />
        </motion.div>
      )}
    </figure>
  )
}

function QuoteActions({ item, url }: { item: Item; url: string }) {
  const [report, setReport] = useState(false)
  const saved = useSaved()
  const on = saved.some((s) => quoteKey(s.quote) === quoteKey(item.quote))
  return (
    <div className="-ml-2 flex items-center gap-0.5">
      <Button variant="ghost" size="icon" className="press size-10 text-muted-foreground" aria-pressed={on}
        aria-label={on ? "પસંદગીમાંથી દૂર કરો" : "પસંદગીમાં ઉમેરો"} data-tip={on ? "પસંદગીમાંથી દૂર કરો" : "પસંદગીમાં ઉમેરો"} onClick={() => toggleSaved(item)}>
        <motion.span className="relative grid place-items-center" initial={false} animate={{ scale: on ? [1, 1.35, 0.92, 1] : 1 }} transition={{ duration: 0.45, ease: "easeOut" }}>
          <Heart className={cn("size-[18px] transition-[color,fill] duration-150", on && "fill-rose-500 text-rose-500")} />
          <AnimatePresence initial={false}>
            {on && (
              <motion.span key="ring" aria-hidden className="absolute inset-[-6px] rounded-full border-2 border-rose-500"
                initial={{ scale: 0.4, opacity: 0.7 }} animate={{ scale: 1.5, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} />
            )}
          </AnimatePresence>
        </motion.span>
      </Button>
      <ListMenu item={item} />
      <ShareMenu item={item} url={url} onReport={() => setReport(true)} />
      <FeedbackSheet open={report} onOpenChange={setReport} item={item} />
      <span className="flex-1" />
      <Badge
        variant="outline"
        render={<a href={vachUrl(item.quote.vachno)} target="_blank" rel="noreferrer" />}
        className="press h-7 gap-1 px-2.5 font-normal text-muted-foreground hover:text-foreground"
      >
        પૂરું વાંચો
        <ArrowUpRight className="size-3 opacity-60" />
      </Badge>
    </div>
  )
}

/** ✓ that draws its stroke in (idea: transitions.dev "Success check"). */
function DrawnCheck({ on, className }: { on: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={false}
        animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={{ duration: on ? 0.3 : 0.15, ease: [0.23, 1, 0.32, 1] }} />
    </svg>
  )
}

const menuRow = "press flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
const brand = {
  WhatsApp: ["bg-[#25D366]", <MessageCircle key="w" className="size-3.5" />],
  Telegram: ["bg-[#229ED9]", <Send key="t" className="size-3.5 -translate-x-px" />],
  X: ["bg-black ring-1 ring-white/20", <span key="x" className="text-[0.8125rem] leading-none font-semibold">𝕏</span>],
} as const

/** Can this browser hand a picture to the share sheet (phones on https)? Checked once. */
const canShareFiles = (() => {
  try { return !!navigator.canShare?.({ files: [new File([""], "x.jpg", { type: "image/jpeg" })] }) } catch { return false }
})()

/**
 * Every option sends the picture card + a short note with the link.
 * Phones: the share sheet with the picture attached (WhatsApp/Telegram/X links can't carry images).
 * Desktop: picture copied to the clipboard, and the app opens with the note filled in — paste with ⌘V / Ctrl+V.
 */
function ShareMenu({ item, url, onReport }: { item: Item; url: string; onReport: () => void }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => (setDone(null), setOpen(false)), 1600)
    return () => clearTimeout(t)
  }, [done])

  const card = (type: "image/jpeg" | "image/png" = "image/jpeg") => quoteCard({
    text: item.quote.text, reference: `વચનામૃત ${vachName(item.quote.vach)}`, title: titles[item.quote.vachno],
    topic: `${item.topic} › ${item.sub}`, app: "વચનામૃત અમૃત બિંદુ", site: location.host, type,
  })
  const name = `vachanamrut-${item.quote.vachno}`
  // Draw the picture as soon as the menu opens: Safari only allows the share sheet right after a tap,
  // so it must be ready by the time WhatsApp/Telegram/X is tapped.
  const ready = useRef<Promise<Blob> | null>(null)
  useEffect(() => {
    if (open && canShareFiles && !ready.current) ready.current = card()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const download = async () => {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(await card()), download: `${name}.jpg` })
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    setDone("ચિત્ર ડાઉનલોડ થયું")
  }
  // Must start inside the click (browsers require it): the picture is drawn while the clipboard waits for it.
  const copyImage = () => {
    // Browsers only allow copying pictures on https (or localhost); elsewhere save it instead and say why.
    if (!(isSecureContext && "ClipboardItem" in window && navigator.clipboard?.write))
      return void download().then(() => setDone("આ સરનામે કૉપિની મંજૂરી નથી (https જોઈએ) · ચિત્ર ડાઉનલોડ કર્યું"))
    navigator.clipboard.write([new ClipboardItem({ "image/png": card("image/png") })])
      .then(() => setDone("ચિત્ર કૉપિ થયું · ⌘V / Ctrl+V થી પેસ્ટ કરો"), () => download())
  }
  const sendTo = async (href: string) => {
    if (canShareFiles) {
      // Phones: picture + note go through the share sheet (apps can't be opened with a picture directly).
      // Some apps (WhatsApp on iPhone) drop the text when a picture is attached — keep it on the clipboard too.
      const note = `${shareNote(item.topic)} ${url}`
      navigator.clipboard?.writeText(note).catch(() => {})
      const file = new File([await (ready.current ??= card())], `${name}.jpg`, { type: "image/jpeg" })
      await navigator.share({ files: [file], text: note }).catch(() => {})
      return setOpen(false)
    }
    copyImage()
    window.open(href, "_blank", "noopener")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className="press size-10 text-muted-foreground" aria-label="શેર કરો" data-tip="શેર કરો · Share" />}>
        <Share2 className="size-[18px]" />
      </PopoverTrigger>
      <PopoverContent align="start" side="top" initialFocus={false} className="w-60 gap-0 p-1.5">
        <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">ચિત્ર સાથે મોકલો · Share as picture</p>
        {Object.entries(shareTargets(item.topic, url)).map(([app, href]) => {
          const [bg, icon] = brand[app as keyof typeof brand]
          return (
            <button key={app} className={menuRow} onClick={() => sendTo(href)}>
              <span className={cn("grid size-7 place-items-center rounded-full text-white", bg)}>{icon}</span>
              {app}
            </button>
          )
        })}
        <button className={menuRow} onClick={copyImage}>
          <span className="relative grid size-7 place-items-center rounded-full bg-muted">
            <Copy className={cn("swap size-3.5", done && "swap-out")} />
            <DrawnCheck on={!!done} className="absolute size-3.5 text-emerald-600 dark:text-emerald-400" />
          </span>
          ચિત્ર કૉપિ કરો · Copy
        </button>
        <button className={menuRow} onClick={download}>
          <span className="grid size-7 place-items-center rounded-full bg-muted"><ImageIcon className="size-3.5" /></span>
          ડાઉનલોડ · Download
        </button>
        <div className="my-1 border-t" />
        <button className={menuRow} onClick={() => (setOpen(false), onReport())}>
          <span className="grid size-7 place-items-center rounded-full bg-muted"><MessageSquareWarning className="size-3.5" /></span>
          ભૂલ જણાવો · Report
        </button>
        <p aria-live="polite" className={cn("px-2 pt-1 text-xs text-emerald-700 transition-opacity duration-150 dark:text-emerald-400", !done && "h-0 opacity-0")}>{done}</p>
      </PopoverContent>
    </Popover>
  )
}

const KINDS = [["mistake", "ભૂલ"], ["suggestion", "સૂચન"], ["other", "અન્ય"]] as const

/**
 * Feedback form in a bottom sheet → POST /api/feedback (Cloudflare Pages Function) → D1 table `feedback`.
 * Opened from a card it carries that amrut bindu, so a reported mistake points straight at the quote.
 */
function FeedbackSheet({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item?: Item }) {
  const [kind, setKind] = useState<string>(item ? "mistake" : "suggestion")
  const [message, setMessage] = useState("")
  const [name, setName] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const quote = item && `${item.quote.vach} · ${item.topic} › ${item.sub} · “${item.quote.text.slice(0, 80)}…”`
  useEffect(() => {
    if (open) setState("idle")
  }, [open])

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setState("sending")
    const website = (e.currentTarget.elements.namedItem("website") as HTMLInputElement).value
    try {
      const r = await fetch("/api/feedback", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, message, name, quote, page: location.href, website }),
      })
      if (!r.ok) throw new Error(String(r.status))
      setState("sent")
      setMessage("")
      setTimeout(() => onOpenChange(false), 1600)
    } catch {
      setState("error")
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="pb-[env(safe-area-inset-bottom,0px)] md:mx-auto md:max-w-lg">
        <DrawerHeader className="text-left">
          <DrawerTitle>{item ? "ભૂલ કે સૂચન જણાવો" : "સૂચન / ભૂલ જણાવો · Feedback"}</DrawerTitle>
        </DrawerHeader>
        {state === "sent" ? (
          <div className="grid place-items-center gap-3 px-4 pt-6 pb-12 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-saffron-soft text-saffron"><DrawnCheck on className="size-7" /></span>
            <p className="text-lg font-semibold">આભાર! 🙏</p>
            <p className="text-sm text-muted-foreground">તમારો સંદેશો મળી ગયો છે.</p>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-4 px-4 pt-2 pb-6">
            {quote && <p className="rounded-xl bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">{quote}</p>}
            <div className="flex gap-2" role="radiogroup" aria-label="પ્રકાર">
              {KINDS.map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                  className={cn("press rounded-full border px-4 py-1.5 text-sm transition-colors duration-150",
                    kind === k ? "border-saffron bg-saffron-soft font-medium text-foreground" : "text-muted-foreground")}>
                  {label}
                </button>
              ))}
            </div>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} required minLength={3} maxLength={2000} rows={4}
              placeholder={kind === "mistake" ? "શું ખોટું લાગે છે? (દા.ત. વચનામૃતનો નંબર, શબ્દ…)" : "તમારો સંદેશો લખો…"} className="text-base" />
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="તમારું નામ (મરજિયાત)" className="h-11" />
            {/* honeypot — hidden from people, bots fill it */}
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
            {state === "error" && <p className="text-sm text-destructive">મોકલી ન શકાયું — ઇન્ટરનેટ તપાસીને ફરી પ્રયાસ કરો.</p>}
            <Button type="submit" disabled={state === "sending" || message.trim().length < 3} className="press h-11 w-full rounded-xl bg-saffron text-white hover:bg-saffron/90">
              {state === "sending" ? "મોકલાય છે…" : "મોકલો · Send"}
            </Button>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}

/** Add a quote to the student's own lists (like playlists) — or start a new one right here. */
function ListMenu({ item }: { item: Item }) {
  const lists = useLists()
  const [name, setName] = useState("")
  const inAny = lists.some((l) => inList(l, item))
  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n || n === FAV) return
    createList(n)
    toggleInList(n, item)
    setName("")
  }
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" className={cn("press size-10", inAny ? "text-foreground" : "text-muted-foreground")} aria-label="યાદીમાં ઉમેરો" data-tip="યાદીમાં ઉમેરો · Add to list" />}>
        {inAny ? <ListChecks className="size-[18px]" /> : <ListPlus className="size-[18px]" />}
      </PopoverTrigger>
      <PopoverContent align="start" side="top" initialFocus={false} className="w-64 gap-1 p-1.5">
        <p className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">મારી યાદીઓ · My lists</p>
        <div className="max-h-56 overflow-y-auto">
          {lists.map((l) => {
            const on = inList(l, item)
            return (
              <div key={l.name} className="group flex items-center">
                <button className={cn(menuRow, "flex-1")} onClick={() => toggleInList(l.name, item)} aria-pressed={on}>
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border transition-colors duration-150", on && "border-saffron bg-saffron text-white")}>
                    <DrawnCheck on={on} className="size-3.5" />
                  </span>
                  <span className="flex-1 truncate">{l.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{l.items.length}</span>
                </button>
                <Button variant="ghost" size="icon" className="press size-8 text-muted-foreground" aria-label={`“${l.name}” યાદી કાઢી નાખો`}
                  onClick={() => confirm(`“${l.name}” યાદી કાઢી નાખવી છે?`) && deleteList(l.name)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )
          })}
          {!lists.length && <p className="px-2 pb-2 text-xs leading-relaxed text-muted-foreground">YouTube playlist જેવી તમારી પોતાની યાદી બનાવો.</p>}
        </div>
        <form onSubmit={add} className="flex gap-1.5 border-t p-1 pt-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="નવી યાદી — દા.ત. પરીક્ષા" className="h-9" enterKeyHint="done" />
          <Button type="submit" size="icon" className="press size-9 shrink-0" disabled={!name.trim()} aria-label="યાદી બનાવો">
            <Plus className="size-4" />
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

function Highlight({ text, q }: { text: string; q: string }) {
  const parts = text.split(q)
  return parts.map((p, i) => (
    <span key={i}>
      {p}
      {i < parts.length - 1 && <mark className="rounded-sm bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-400/30">{q}</mark>}
    </span>
  ))
}

// ── Home ─────────────────────────────────────────────────────────────────────

function Home({ data, unique, query, setQuery, searching, results, savedCount }: {
  data: Data; unique: Item[]; query: string; setQuery: (q: string) => void; searching: boolean
  results: (Item & { where: string[] })[]; savedCount: number
}) {
  const q = query.trim()
  const topics = Object.keys(data).filter((t) => !q || matches(t, q) || results.some((r) => r.topic === t))
  const today = unique.length ? todays(unique)[0] : null
  const [picks] = useState(() => [...Object.keys(data)].sort(() => Math.random() - 0.5).slice(0, 4))
  const [feedback, setFeedback] = useState(false)
  const last = new URLSearchParams(localStorage.getItem("last") ?? "")
  const lastTopic = last.get("t")
  const random = () => {
    const it = unique[Math.floor(Math.random() * unique.length)]
    const quotes = data[it.topic].find((s) => s.name === it.sub)!.quotes!
    nav({ t: it.topic, s: it.sub, q: quotes.findIndex((x) => quoteKey(x) === quoteKey(it.quote)) + 1 })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 md:px-10 md:py-10">
      {/* banner: the Vachanamrut being spoken — tells a first-time reader what this is */}
      <header className="relative -mx-4 overflow-hidden rounded-b-3xl md:mx-0 md:rounded-3xl">
        <img src={IMAGES.sabha.src} alt={IMAGES.sabha.alt} title="© BAPS Swaminarayan Sanstha · CC BY-SA 4.0 · Wikimedia Commons" className="h-64 w-full object-cover object-[65%_35%] md:h-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className="absolute right-2 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] rounded-full bg-background/60 backdrop-blur-md md:hidden">
          <HeaderButtons />
        </div>
        <div className="absolute inset-x-4 bottom-2 md:inset-x-8 md:bottom-6">
          <p className="text-xs font-medium text-white/80">જય સ્વામિનારાયણ · {new Date().toLocaleDateString("gu-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-white md:text-5xl">વચનામૃત અમૃત બિંદુ</h1>
          <p className="mt-1 hidden text-sm text-white/75 tabular-nums md:block">{Object.keys(data).length} વિષય · {unique.length} અમૃત બિંદુ</p>
        </div>
      </header>

      {/* phone search (desktop has it in the sidebar) */}
      <div className="glow-header sticky top-0 z-10 -mx-4 px-4 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] pb-3 md:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <SearchInput value={query} onChange={setQuery} placeholder="વિષય કે અમૃત બિંદુ શોધો… / English" className="h-11 rounded-xl pl-9" />
        </div>
      </div>

      {!q && (
        <div className="enter">
          {today && (
            <a href={"#" + new URLSearchParams({ t: TODAY })}
              className="card-glow press group relative mt-3 block overflow-hidden rounded-3xl border bg-card p-5 pt-[5.5rem] md:mt-8 md:pt-28 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.14)] transition-shadow duration-200 md:mt-0 md:p-7 hover:shadow-[0_1px_2px_rgba(0,0,0,0.05),0_20px_40px_-14px_rgba(0,0,0,0.2)]">
              <img src={IMAGES.manuscript.src} alt="" aria-hidden title="© BAPS Swaminarayan Sanstha · CC BY-SA 4.0 · Wikimedia Commons" className="absolute inset-x-0 top-0 h-20 w-full object-cover object-[50%_30%] opacity-90 dark:opacity-50 [mask-image:linear-gradient(to_bottom,black_40%,transparent)] md:h-24" />
              <p className="relative flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarDays className="size-3.5 text-saffron" /> આજનાં વચનામૃત · {new Date().toLocaleDateString("gu-IN", { day: "numeric", month: "long" })}
                <span className="ml-auto rounded-full bg-saffron-soft px-2 py-0.5 font-medium text-saffron tabular-nums">1 / {TODAY_COUNT}</span>
              </p>
              <blockquote className="mt-3 line-clamp-5 font-serif text-(length:--qs) leading-[1.9]">
                {/* words fade up one after another (idea: transitions.dev "Texts reveal"); capped so long quotes don't drag */}
                {today.quote.text.split(" ").map((w, k) => (
                  <Fragment key={k}><span className="reveal-word" style={{ animationDelay: `${Math.min(k * 25, 700)}ms` }}>{w}</span> </Fragment>
                ))}
              </blockquote>
              <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                {today.topic} › {today.sub} · {today.quote.vach}
                <ChevronRight className="size-3.5 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5" />
              </p>
            </a>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2 md:mt-4 md:gap-3">
            {lastTopic && (lastTopic === SAVED || lastTopic === TODAY || lastTopic in data) ? (
              <QuickLink href={"#" + last} icon={<History className="size-[18px]" />} label="આગળ વાંચો" sub={lastTopic.split(" · ")[0]} />
            ) : (
              <QuickLink href={"#" + new URLSearchParams({ t: TOPICS })} icon={<History className="size-[18px]" />} label="વાંચવાનું શરૂ કરો" sub={`${Object.keys(data).length} વિષય`} />
            )}
            <QuickLink onClick={random} icon={<Dices className="size-[18px]" />} label="આજે શું વાંચું?" sub="એક અમૃત બિંદુ" />
            <QuickLink href={"#" + new URLSearchParams({ t: SAVED })} icon={<Heart className="size-[18px]" />} label="સાચવેલાં" sub={`${savedCount} અમૃત બિંદુ`} />
          </div>
        </div>
      )}

      {topics.length > 0 && (
        <>
          <h3 className="mt-10 mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {q ? "વિષયો" : "આજે વાંચવા જેવા વિષયો"}
          </h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            {(q ? topics : picks).map((t, n) => (
              <a key={t} href={"#" + new URLSearchParams({ t })} onClick={() => setQuery("")}
                style={{ animationDelay: `${Math.min(n * 12, 240)}ms` }}
                className="press enter flex min-h-20 flex-col justify-between gap-2 rounded-2xl border bg-card p-3.5 transition-colors duration-150 hover:border-saffron/40">
                <span className="text-base leading-snug font-medium">{t}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{data[t].length} પેટા વિષય</span>
              </a>
            ))}
          </div>
          {!q && (
            <a href={"#" + new URLSearchParams({ t: TOPICS })}
              className="press group mt-3 flex items-center justify-center gap-1.5 rounded-2xl border border-dashed py-3.5 text-sm font-medium text-saffron transition-colors duration-150 hover:border-saffron/50">
              બધા {Object.keys(data).length} વિષયો જુઓ · Explore more
              <ChevronRight className="size-4 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5" />
            </a>
          )}
        </>
      )}

      {searching && <SearchResults q={q} results={results} />}
      {q && !searching && !topics.length && <p className="py-16 text-center text-sm text-muted-foreground">કંઈ મળ્યું નહીં</p>}

      {!q && (
        <section className="mt-12 overflow-hidden rounded-3xl border bg-card md:grid md:grid-cols-[2fr_3fr]">
          <img src={IMAGES.mahant.src} alt={IMAGES.mahant.alt} title="© BAPS Swaminarayan Sanstha · CC BY-SA 4.0 · Wikimedia Commons" loading="lazy" className="h-60 w-full object-cover object-[62%_35%] md:h-full" />
          <div className="card-glow p-5 md:p-8">
            <p className="text-xs font-medium tracking-wide text-saffron">વચનામૃત વિશે · About</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight">ભગવાન સ્વામિનારાયણની વાણી</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              સંવત ૧૮૭૬ થી ૧૮૮૬ (ઈ.સ. ૧૮૧૯–૧૮૨૯) દરમિયાન ગઢડા, સારંગપુર, કારિયાણી, લોયા, પંચાળા, વરતાલ, અમદાવાદ વગેરે સ્થળે
              ભગવાન સ્વામિનારાયણે આપેલા ૨૭૩ ઉપદેશો એટલે વચનામૃત. અહીં તેમાંથી {unique.length} અમૃત બિંદુ {Object.keys(data).length} વિષયોમાં ગોઠવેલાં છે.
            </p>
            <a href={"#" + new URLSearchParams({ t: TOPICS })}
              className="press mt-5 inline-flex items-center gap-1 rounded-full bg-saffron px-4 py-2 text-sm font-medium text-white">
              વાંચવાનું શરૂ કરો <ChevronRight className="size-4" />
            </a>
            <div className="mt-6 border-t pt-4">
              <Button variant="outline" className="press rounded-full" onClick={() => setFeedback(true)}>
                <MessageSquareWarning className="size-4" /> સૂચન / ભૂલ જણાવો
              </Button>
            </div>
            <FeedbackSheet open={feedback} onOpenChange={setFeedback} />

          </div>
        </section>
      )}
    </div>
  )
}

/** Search box with a ✕ that dissolves the text away (idea: transitions.dev "Input clear with dissolve"). */
function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  const [clearing, setClearing] = useState(false)
  const clear = () => {
    setClearing(true)
    setTimeout(() => (onChange(""), setClearing(false)), 150)
  }
  return (
    <>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} enterKeyHint="search"
        className={cn(className, "pr-9 transition-[opacity,filter] duration-(--duration-quick)", clearing && "opacity-0 blur-[3px]")} />
      <AnimatePresence>
        {value && !clearing && (
          <motion.button
            key="clear" type="button" aria-label="શોધ સાફ કરો · Clear" onClick={clear}
            initial={{ opacity: 0, scale: 0.6, filter: "blur(2px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.6, filter: "blur(2px)" }} transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-1/2 right-1.5 -mt-4 grid size-8 place-items-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}

/** Topics grouped by theme — students look for "something on anger", not for an alphabetical position. */
const TOPIC_GROUPS: [string, string[]][] = [
  ["ભગવાન", ["ભગવાનનું સ્વરૂપ તથા મહિમા", "ભગવાનનો નિશ્ચય", "ભગવાનનો આશ્રય", "ભગવાનની કૃપા", "ભગવાનનો રાજીપો",
    "ભગવાનનો સંબંધ તથા નિવાસ", "ભગવાનનાં ચરિત્ર", "ભગવાનનો દ્રોહ", "પ્રગટ ભગવાન અને પ્રગટ સંત", "ઉપાસના",
    "ઉપાસના - અવતારના અવતારી, સર્વોપરી (સ્વરૂપનિષ્ઠા)", "ઉપાસના - સાકાર નિષ્ઠા"]],
  ["ભક્તિ અને સાધના", ["ભક્તિ", "ભગવાનમાં પ્રીતિ", "ભગવાનનું ધ્યાન", "ભગવાનના સ્વરૂપમાં વૃત્તિ", "સેવા", "આત્મનિષ્ઠા",
    "આત્મનિષ્ઠા ને ભગવાનનું માહાત્મ્ય", "આત્મનિષ્ઠા ને વૈરાગ્ય", "વૈરાગ્ય", "સ્વધર્મ", "સ્વધર્મ - આજ્ઞા", "સ્વધર્મ - નિયમ",
    "સ્વધર્મ - નિષ્કામ", "પુરૂષ પ્રયત્ન", "એકાંતિક ભક્ત", "પૂર્ણકામપણું"]],
  ["સંત અને સત્સંગ", ["સંત સમાગમ", "સંતનો મહિમા", "મોટા પુરુષ", "સત્સંગ", "સત્સંગી", "ભક્તનો મહિમા", "ભગવાનનો ભક્ત",
    "પક્ષ", "ગુણ ગ્રહણ", "ત્યાગી (સાધુ)", "ગૃહસ્થ"]],
  ["દોષો અને ઉપાય", ["ક્રોધ", "માન", "ઈર્ષ્યા", "મત્સર", "લોભ", "મોહ", "કામ", "કામાદિક દોષો", "વાસના", "કપટ", "દંભ",
    "અવગુણ ગ્રહણ", "દ્રોહ", "કુસંગ", "સ્ત્રી પ્રસંગ", "માયિક પંચવિષય", "ઘાટ - સંકલ્પ", "સ્વભાવ (પ્રકૃતિ)", "દેહ અને દેહનાં સંબંધી"]],
  ["જીવન અને જ્ઞાન", ["કલ્યાણ", "આત્યંતિક કલ્યાણ (મોક્ષ)", "કર્મ (ને તેનું ફળ)", "પ્રારબ્ધ (પૂર્વસંસ્કાર)",
    "દેશકાળાદિક આઠ", "શાસ્ત્ર", "વિધિનિષેધ"]],
]

/**
 * Topics tab: themes as a sliding tab bar (idea: transitions.dev "Tabs sliding") over pill groups.
 * Tapping a tab scrolls to its group; scrolling moves the saffron pill. A topic pill opens that topic with all subtopics.
 */
function TopicsPage({ data }: { data: Data }) {
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const query = q.trim()
  const placed = new Set(TOPIC_GROUPS.flatMap(([, ts]) => ts))
  const others = Object.keys(data).filter((t) => !placed.has(t)) // safety net if the data gains a topic
  const groups = [...TOPIC_GROUPS, ...(others.length ? [["અન્ય", others] as [string, string[]]] : [])]
    .map(([name, ts]) => [name, ts.filter((t) => t in data && (!query || matches(t, query)))] as const)
    .filter(([, ts]) => ts.length)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])

  // Scroll-spy: the active theme is the last section whose heading has passed under the sticky header.
  useEffect(() => {
    const main = document.querySelector("main")!
    const update = () => {
      const secs = Array.from(document.querySelectorAll<HTMLElement>("section[data-g]"))
      let g = 0
      for (const el of secs) if (el.getBoundingClientRect().top < 220) g = Number(el.dataset.g)
      // the last group is short and can never reach the top — at the very bottom, it's the one being read
      if (main.scrollTop + main.clientHeight >= main.scrollHeight - 8) g = secs.length - 1
      setActive(g)
    }
    update()
    main.addEventListener("scroll", update, { passive: true })
    return () => main.removeEventListener("scroll", update)
  }, [query])
  // braces matter: newer browsers return a Promise from scrollIntoView, and React would take it for a cleanup function
  useEffect(() => {
    tabs.current[active]?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" })
  }, [active])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 md:px-10 md:pb-12">
      <div className="glow-header sticky top-0 z-10 -mx-4 px-4 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] pb-2 md:-mx-10 md:px-10 md:pt-8">
        <div className="flex min-h-12 items-center justify-between">
          <h1 className="text-base font-semibold tracking-tight md:font-serif md:text-3xl">બધા વિષયો</h1>
          <div className="md:hidden"><HeaderButtons /></div>
        </div>
        <div className="relative mt-1 md:mt-4 md:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <SearchInput value={q} onChange={setQ} placeholder="વિષય શોધો… / English" className="h-11 rounded-xl pl-9" />
        </div>
        {/* theme tabs — the saffron pill slides between them */}
        <div className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0" role="tablist">
          {groups.map(([name], g) => (
            <button key={name} ref={(el) => void (tabs.current[g] = el)} role="tab" aria-selected={g === active}
              onClick={() => (setActive(g), document.getElementById(`g${g}`)?.scrollIntoView({ behavior: "smooth", block: "start" }))}
              className={cn("press relative shrink-0 rounded-full px-3.5 py-2 text-sm whitespace-nowrap transition-colors duration-150",
                g === active ? "font-medium text-foreground" : "text-muted-foreground")}>
              {g === active && <motion.span layoutId="topic-tab" className="absolute inset-0 rounded-full bg-saffron-soft" transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }} />}
              <span className="relative">{name}</span>
            </button>
          ))}
        </div>
      </div>

      {groups.map(([name, ts], g) => (
        <section key={name} id={`g${g}`} data-g={g} className="scroll-mt-48 pt-5">
          <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold">
            {name} <span className="text-xs font-normal text-muted-foreground tabular-nums">{ts.length}</span>
          </h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {ts.map((t) => (
              <a key={t} href={"#" + new URLSearchParams({ t })}
                className="press flex min-h-24 flex-col justify-between gap-2 rounded-2xl border bg-card p-3.5 transition-colors duration-150 hover:border-saffron/50 hover:bg-saffron-soft">
                <span className="text-sm leading-snug font-medium">{t}</span>
                <span className="text-xs leading-relaxed text-muted-foreground tabular-nums">
                  {data[t].length} પેટા વિષય<br />{total(data[t])} અમૃત બિંદુ
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
      {!groups.length && <p className="py-16 text-center text-sm text-muted-foreground">કંઈ મળ્યું નહીં</p>}
    </div>
  )
}

function QuickLink({ href, onClick, icon, label, sub }: { href?: string; onClick?: () => void; icon: React.ReactNode; label: string; sub: string }) {
  const cls = "press flex min-w-0 flex-col items-start gap-2 overflow-hidden rounded-2xl border bg-card p-3 text-left transition-colors duration-150 hover:border-foreground/20 md:flex-row md:items-center md:gap-3 md:p-4"
  const body = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted">{icon}</span>
      <span className="w-full min-w-0">
        <span className="block text-base leading-snug font-semibold">{label}</span>
        <span className="mt-0.5 block truncate text-xs leading-snug text-muted-foreground">{sub}</span>
      </span>
    </>
  )
  return href ? <a href={href} className={cls}>{body}</a> : <button onClick={onClick} className={cls}>{body}</button>
}

function SearchResults({ q, results }: { q: string; results: (Item & { where: string[] })[] }) {
  const [limit, setLimit] = useState(50)
  useEffect(() => setLimit(50), [q])
  const shown = results.slice(0, limit)
  return (
    <div className="mt-10 max-w-2xl">
      <h3 className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase tabular-nums">
        “{q}” · {results.length} અમૃત બિંદુ
      </h3>
      <div className="space-y-3 md:space-y-4">
        {shown.map((r) => (
          <QuoteCard key={quoteKey(r.quote)} item={r} url={linkTo({ t: r.topic, s: r.sub })} where={r.where} q={q} />
        ))}
      </div>
      {results.length > limit && (
        <Button variant="outline" className="press mt-8 w-full" onClick={() => setLimit(limit + 50)}>
          વધુ બતાવો · {results.length - limit} બાકી
        </Button>
      )}
    </div>
  )
}

// ── Mobile flashcard deck ────────────────────────────────────────────────────


/**
 * Two modes: ↔ cards (toss left or right, like a deck) and ↕ reels (up = next, down = previous).
 * The top card tracks the finger 1:1 via a motion value (no React state per move); it lifts — bigger
 * shadow — as it travels, and the card beneath grows into place from the same value so they never drift.
 */
/** `label`: the line under the Vachanamrut reference — topic › subtopic, just the subtopic, or nothing when it's already picked above. */
function Deck({ items, start, onIndex, link, label, onReorder }: {
  items: Item[]; start: number; onIndex: (n: number) => void; link: (n: number) => string; label: (it: Item) => string | undefined
  onReorder?: (items: Item[]) => void
}) {
  const textSize = useTextSize()
  const identity = () => items.map((_, k) => k)
  const [order] = useState(identity)
  const [i, setI] = useState(() => Math.min(Math.max(start, 0), items.length - 1))
  const [jump, setJump] = useState({ key: 0, shuffle: false })
  const [sheet, setSheet] = useState(false)
  const [pill, setPill] = useState<string | null>(null)
  const [burst, setBurst] = useState(0)
  const [topLong, setTopLong] = useState(false)
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const reduce = useReducedMotion()
  const topQuote = useRef<HTMLQuoteElement>(null)
  const lastTap = useRef(0)
  // Which card waits underneath: the next one, or — while dragging right/down — the previous one.
  const [under, setUnder] = useState<"next" | "prev">("next")
  const busy = useRef(false)
  const n = items.length
  const mv = (axis: "x" | "y") => (axis === "x" ? px : py)

  const away = (axis: "x" | "y") => (axis === "y" ? Math.max(innerHeight, 600) : Math.max(innerWidth, 400)) * 1.2
  const rotate = useTransform(px, [-300, 0, 300], [-10, 0, 10])
  const progress = useTransform([px, py], ([a, b]: number[]) => Math.min(Math.max(Math.abs(a), Math.abs(b)) / 200, 1))
  const scale1 = useTransform(progress, [0, 1], [0.95, 1])
  const y1 = useTransform(progress, [0, 1], [14, 0])

  const say = (text: string) => setPill(text)
  useEffect(() => {
    if (!pill) return
    const t = setTimeout(() => setPill(null), 2200)
    return () => clearTimeout(t)
  }, [pill])

  useEffect(() => onIndex(order[i]), [i, order]) // eslint-disable-line react-hooks/exhaustive-deps

  // After the top card changes: the new top starts centred.
  useLayoutEffect(() => {
    px.set(0)
    py.set(0)
    busy.current = false
  }, [i, jump.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Long quotes scroll inside the card: there an up/down drag scrolls the text, and the card moves
  // up/down only when dragged by its header or footer. Sideways works anywhere.
  useLayoutEffect(() => {
    const el = topQuote.current
    setTopLong(!!el && el.scrollHeight > el.clientHeight + 1)
  }, [i, order, jump.key, textSize])

  // First visit only: nudge the top card so the swipe is discoverable.
  useEffect(() => {
    if (items.length < 2 || localStorage.getItem("swipeHint")) return
    say("← ↑ સ્વાઇપ કરો ↓ →")
    const nudge = setTimeout(async () => {
      if (reduce) return
      await animate(px, -56, { type: "spring", duration: 0.45, bounce: 0 })
      await animate(px, 0, { type: "spring", duration: 0.6, bounce: 0.35 })
    }, 700)
    localStorage.setItem("swipeHint", "1")
    return () => clearTimeout(nudge)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Throw the top card off-screen: dir -1 (left/up) → next card, dir +1 (right/down) → previous card.
  // Either way the card underneath is already the right one, so it simply grows into place. Endless both ways.
  const toss = (dir: number, axis: "x" | "y" = "x", velocity = 0) => {
    if (busy.current || n < 2) return false
    busy.current = true
    setUnder(dir < 0 ? "next" : "prev")
    navigator.vibrate?.(6)
    const done = () => (setI((i - dir + n) % n), setUnder("next"))
    if (reduce) return done(), true
    const edge = (axis === "y" ? innerHeight : innerWidth) * 0.8
    const fly = animate(mv(axis), dir * away(axis), {
      type: "spring", velocity, stiffness: 320, damping: 34,
      onUpdate: (v) => Math.abs(v) > edge && (fly.stop(), done()),
    })
    return true
  }
  const jumpTo = (original: number) => {
    setI(order.indexOf(original))
    setJump({ key: jump.key + 1, shuffle: false })
    setSheet(false)
  }
  // Shuffle = jump to a random card of this deck (never the current one); the deck keeps its order.
  const randomCard = () => {
    if (n < 2) return
    const r = (i + 1 + Math.floor(Math.random() * (n - 1))) % n
    setI(r)
    setJump({ key: jump.key + 1, shuffle: true })
    navigator.vibrate?.([8, 40, 8])
  }

  // One hand-rolled gesture for the whole card (the browser never gets to scroll it, so it can't steal swipes):
  //  · sideways anywhere → left = next, right = previous
  //  · up/down → scrolls a long quote's text first; past its end (or on a short quote) up = next, down = previous
  // A swipe counts if it went 50px, was fast, or was a quick 20px flick.
  type Gesture = { x0: number; y0: number; t0: number; axis?: "x" | "y"; s0: number; pts: { x: number; y: number; t: number }[] }
  const g = useRef<Gesture | null>(null)
  const inertia = useRef<{ stop: () => void } | null>(null)

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as Element).closest("button,a,input") || busy.current) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not a live pointer (e.g. synthetic) — bubbling still delivers moves */ }
    inertia.current?.stop()
    g.current = { x0: e.clientX, y0: e.clientY, t0: performance.now(), s0: topQuote.current?.scrollTop ?? 0, pts: [] }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const s = g.current
    if (!s) return
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0
    if (!s.axis) {
      if (Math.hypot(dx, dy) < 8) return
      s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
    }
    s.pts = [...s.pts.filter((p) => performance.now() - p.t < 100), { x: e.clientX, y: e.clientY, t: performance.now() }]
    const give = n < 2 ? 0.15 : 1 // a lone card only gives a little
    if (s.axis === "x") {
      setUnder(dx > 0 ? "prev" : "next")
      return px.set(dx * give)
    }
    const bq = topQuote.current
    const max = bq ? bq.scrollHeight - bq.clientHeight : 0
    if (!bq || max < 1) {
      setUnder(dy > 0 ? "prev" : "next")
      return py.set(dy * give)
    }
    const want = s.s0 - dy // text scrolls first; whatever is left over moves the card
    bq.scrollTop = Math.max(0, Math.min(want, max))
    const card = want < 0 ? -want * give : want > max ? -(want - max) * give : 0
    if (card) setUnder(card > 0 ? "prev" : "next")
    py.set(card)
  }

  const onPointerUp = () => {
    const s = g.current
    g.current = null
    if (!s) return
    if (!s.axis) return onTap()
    const [a, b] = [s.pts[0], s.pts[s.pts.length - 1]]
    const dt = a && b && b.t > a.t ? (b.t - a.t) / 1000 : 0
    const vel = dt ? (s.axis === "x" ? b.x - a.x : b.y - a.y) / dt : 0
    const off = s.axis === "x" ? px.get() : py.get()
    const bq = topQuote.current
    if (s.axis === "y" && Math.abs(off) < 1 && bq) {
      // was scrolling the text: let it glide
      const max = bq.scrollHeight - bq.clientHeight
      inertia.current = reduce ? null : animate(bq.scrollTop, 0, {
        type: "inertia", velocity: -vel, min: 0, max, power: 0.6, timeConstant: 300,
        onUpdate: (v) => (bq.scrollTop = v),
      })
      return
    }
    const dir = Math.sign(off || vel)
    const quick = performance.now() - s.t0 < 350 && Math.abs(off) > 20
    if (Math.abs(off) > 50 || Math.abs(vel) > 250 || quick) {
      if (dir && toss(dir, s.axis, vel)) return
    }
    const snap = reduce ? { duration: 0 } : ({ type: "spring", duration: 0.3, bounce: 0 } as const) // straight back
    animate(px, 0, snap)
    animate(py, 0, snap)
  }

  // Double-tap a card to add it to favorites (never removes — a second double-tap just replays the heart).
  const onTap = () => {
    const now = Date.now()
    if (now - lastTap.current < 320) {
      const it = items[order[i]]
      if (!isSaved(it)) toggleSaved(it)
      setBurst((b) => b + 1)
      navigator.vibrate?.(10)
      lastTap.current = 0
    } else lastTap.current = now
  }

  const step = under === "prev" ? -1 : 1
  const visible = [...new Set([0, 1, 2].map((d) => order[(((i + d * step) % n) + n) % n]))]
  const enterFrom = { opacity: 0, scale: 0.98 }

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-1">
      {/* progress */}
      <div className={cn("mx-5 mt-3 h-0.5 overflow-hidden rounded-full bg-muted", items.length < 2 && "invisible")}>
        <div
          className="h-full origin-left bg-saffron transition-transform duration-200 ease-(--ease-out)"
          style={{ transform: `scaleX(${(i + 1) / items.length})` }}
        />
      </div>

      <motion.div
        key={jump.key}
        initial={jump.key && !reduce ? enterFrom : false}
        animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className="relative mx-5 mt-4 mb-7 min-h-0 flex-1"
      >
        {visible
          .map((k, depth) => {
            const it = items[k]
            const top = depth === 0
            return (
              <motion.figure
                key={quoteKey(it.quote) + k}
                aria-hidden={!top}
                onPointerDown={top ? onPointerDown : undefined}
                onPointerMove={top ? onPointerMove : undefined}
                onPointerUp={top ? onPointerUp : undefined}
                onPointerCancel={top ? onPointerUp : undefined}
                style={
                  top ? { x: px, y: py, rotate, zIndex: 3 }
                  : depth === 1 ? { scale: scale1, y: y1, zIndex: 2 } : { scale: 0.9, y: 28, zIndex: 1 }
                }
                className={cn(
                  "card-glow absolute inset-0 flex origin-bottom flex-col rounded-3xl border bg-card p-6 pb-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.12)] select-none will-change-transform",
                  !top && "pointer-events-none",
                  top && "touch-none",
                )}
              >
                <motion.div className="flex min-h-0 flex-1 flex-col" style={{ opacity: top ? 1 : depth === 1 ? progress : 0 }}>
                  <div>
                    <VachRef item={it} sub={label(it)} />
                  </div>
                  <blockquote
                    ref={top ? topQuote : undefined}
                    className={cn(
                      "min-h-0 flex-1 touch-none overflow-hidden font-serif text-(length:--qs) leading-[1.9] text-card-foreground",
                      top && topLong && "[mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)] pb-6",
                    )}
                  >
                    {it.quote.text}
                  </blockquote>
                  <figcaption className="mt-3">
                    <QuoteActions item={it} url={link(k)} />
                  </figcaption>
                </motion.div>
              </motion.figure>
            )
          })
          .reverse()}

        {/* double-tap heart */}
        {burst > 0 && (
          <motion.div
            key={burst}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.15, 1, 1.1] }}
            transition={{ duration: 0.85, times: [0, 0.25, 0.65, 1], ease: "easeOut" }}
          >
            <Heart className="size-24 fill-rose-500 text-rose-500 drop-shadow-[0_8px_24px_rgba(244,63,94,0.45)]" />
          </motion.div>
        )}

        {/* hints + confirmations: a toast that springs in and morphs between messages */}
        <div aria-live="polite" className="pointer-events-none absolute inset-x-0 -bottom-6 z-30 flex justify-center">
          <AnimatePresence mode="popLayout">
            {pill && (
              <motion.span
                key={pill}
                layout
                initial={reduce ? false : { opacity: 0, y: 10, scale: 0.9, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.95, filter: "blur(4px)" }}
                transition={{ type: "spring", duration: 0.4, bounce: 0.25 }}
                className="rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background shadow-lg"
              >
                {pill}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* controls */}
      <div className={cn("flex items-center justify-between px-2", items.length < 2 && "hidden")}>
        <Button variant="ghost" size="icon" className="press size-11 text-muted-foreground" aria-label="કોઈ પણ એક · Random quote" onClick={randomCard}>
          <Shuffle className="size-[18px]" />
        </Button>
        <Button variant="ghost" size="icon" className="press size-11" onClick={() => toss(1)} aria-label="પાછલું અમૃત બિંદુ">
          <ChevronLeft className="size-5" />
        </Button>
        <Drawer open={sheet} onOpenChange={setSheet} showSwipeHandle>
          <DrawerTrigger render={<Button variant="ghost" className="press h-11 min-w-20 gap-1.5 px-3 text-sm font-normal tabular-nums" aria-label="અમૃત બિંદુ પર જાઓ" />}>
            <RollingNumber value={i + 1} /> <span className="text-muted-foreground">/ {items.length}</span>
          </DrawerTrigger>
          <JumpSheet items={items} current={order[i]} onJump={jumpTo} onReorder={onReorder} />
        </Drawer>
        <Button variant="ghost" size="icon" className="press size-11" onClick={() => toss(-1)} aria-label="આગલું અમૃત બિંદુ">
          <ChevronRight className="size-5" />
        </Button>
        <Button variant="ghost" size="icon" className="press size-11 text-muted-foreground" onClick={() => setSheet(true)} aria-label="બધાં અમૃત બિંદુઓની યાદી">
          <ListOrdered className="size-[18px]" />
        </Button>
      </div>
    </div>
  )
}

/** Digits roll on a drum to their new value, with a small overshoot (idea: transitions.dev "Number pop-in"). */
function RollingNumber({ value }: { value: number }) {
  const digits = String(value).split("")
  return (
    <span className="inline-flex leading-none tabular-nums" aria-label={String(value)}>
      {digits.map((d, k) => (
        // keyed from the right, so the ones column keeps its place when 9 → 10
        <span key={digits.length - k} aria-hidden className="relative inline-block h-[1em] w-[1ch] overflow-hidden">
          <span className="drum absolute inset-x-0 top-0 flex flex-col" style={{ transform: `translateY(${-Number(d)}em)` }}>
            {"0123456789".split("").map((x) => <span key={x} className="h-[1em] text-center">{x}</span>)}
          </span>
        </span>
      ))}
    </span>
  )
}

/** Bottom sheet listing every card in the deck, grouped by subtopic. Tap to jump straight there. */
function JumpSheet({ items, current, onJump, onReorder }: { items: Item[]; current: number; onJump: (k: number) => void; onReorder?: (items: Item[]) => void }) {
  const currentRow = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    requestAnimationFrame(() => currentRow.current?.scrollIntoView({ block: "center" }))
  }, [])
  return (
    <DrawerContent initialFocus={false} className="h-[85dvh] pb-[env(safe-area-inset-bottom,0px)]">
      <DrawerHeader className="text-left">
        <DrawerTitle>અમૃત બિંદુ પર જાઓ</DrawerTitle>
        {onReorder && <p className="text-xs text-muted-foreground">ક્રમ બદલવા <GripVertical className="inline size-3.5 align-[-2px]" /> પકડીને ખેંચો</p>}
      </DrawerHeader>
      {onReorder ? (
        // Your own list: drag the grip to reorder (idea: transitions.dev "To-do reorder"); rows make room as you drag.
        <Reorder.Group axis="y" values={items} onReorder={onReorder} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-2 pb-4">
          {items.map((it, k) => <ReorderRow key={quoteKey(it.quote)} item={it} n={k} current={k === current} onJump={() => onJump(k)} />)}
        </Reorder.Group>
      ) : (
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-2 pb-4">
        {items.map((it, k) => (
          <div key={quoteKey(it.quote) + k}>
            {(k === 0 || items[k - 1].sub !== it.sub) && (
              <p className="sticky top-0 z-10 bg-popover/95 px-3 pt-4 pb-2 text-xs font-medium text-muted-foreground backdrop-blur-sm">{it.sub}</p>
            )}
            {k > 0 && items[k - 1].sub === it.sub && <div aria-hidden className="mr-3 ml-[3.25rem] border-t" />}
            <button
              ref={k === current ? currentRow : undefined}
              onClick={() => onJump(k)}
              className={cn("press my-0.5 flex w-full items-baseline gap-3 rounded-xl px-3 py-3 text-left", k === current && "bg-muted")}
            >
              <span className="w-7 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{k + 1}</span>
              <span className="line-clamp-2 font-serif text-base leading-relaxed">{it.quote.text}</span>
            </button>
          </div>
        ))}
      </div>
      )}
    </DrawerContent>
  )
}

function ReorderRow({ item, n, current, onJump }: { item: Item; n: number; current: boolean; onJump: () => void }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={item} dragListener={false} dragControls={controls}
      whileDrag={{ scale: 1.02, boxShadow: "0 12px 28px -10px rgba(0,0,0,0.35)" }}
      className={cn("relative my-0.5 flex items-center gap-1 rounded-xl bg-popover", current && "bg-muted")}>
      <button onClick={onJump} className="press flex min-w-0 flex-1 items-baseline gap-3 px-3 py-3 text-left">
        <span className="w-7 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{n + 1}</span>
        <span className="line-clamp-2 font-serif text-base leading-relaxed">{item.quote.text}</span>
      </button>
      <span onPointerDown={(e) => controls.start(e)} aria-label="ખેંચીને ક્રમ બદલો" className="grid size-11 shrink-0 cursor-grab touch-none place-items-center text-muted-foreground active:cursor-grabbing">
        <GripVertical className="size-4" />
      </span>
    </Reorder.Item>
  )
}
