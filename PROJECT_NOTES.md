# વચનામૃત અમૃત બિંદુ — project notes

Living record of what we built, what was decided and why, and what's open. Read this first in a new session.

- **Live:** https://vachanamrut-amrutbindu.pages.dev (Cloudflare Pages, account ushankradadiya1728@gmail.com)
- **Repo:** https://github.com/Uttam1728/vc-amrut (branch `main`; pushed as `ushank-r`)
- **Audience:** young students (BAPS) — modern-app feel, Gujarati first, phone first.

## Working rules (from the user)

- **Never deploy until the user says "deploy".** Work locally, show it, wait. (Also in Claude memory.)
- On "deploy": run checks → build → deploy → commit → push (see commands below).
- Prefer showing screenshots / testing in the emulator before reporting.
- Keep one accent colour (**saffron**); ♥ stays rose. No red, green, blue elsewhere.
- Ask before big design choices; give a recommendation with 2–4 options.

## Data

- Source: anirdesh.com vach-quotes. `scripts/scrape.py` → `data/topics.json` (65 topics), `data/subtopics.json`
  (862 subtopics, 2117 quotes, 1635 unique). Resumable; saves after each topic.
- `web/public/subtopics.json` is what the app loads (~3 MB raw, ~0.5 MB over the wire with Cloudflare compression).
- `web/public/vach.json` — Vachanamrut titles by number (273), extracted from a saved anirdesh index page.
- Known source issues: some quotes cite the wrong Vachanamrut (e.g. a quote tagged Loya 6 isn't in Loya 6);
  86 quotes had a stray closing `"` — stripped at load time in the app.
- Same quote can sit under two subtopics on the source (kept; search de-duplicates).

## Repo layout

`web/` app · `data/` raw scraped JSON · `scripts/` scrapers · `promo/` video · `parked/feelings/` paused idea (see README).

## Stack

Vite + React + TypeScript + Tailwind v4 + shadcn (Base UI) + Motion. Fonts: Geist, Noto Sans/Serif Gujarati.
Main code: `web/src/App.tsx` (single large file), `web/src/lib/store.ts` (localStorage/hash state),
`web/src/lib/shareCard.ts` (share pictures), `web/src/lib/print.ts` (PDF), `web/src/lib/quoteLinks.ts`
(short links, by Codex), `web/src/lib/translit.ts` (English↔Gujarati search), `web/public/sw.js` (offline).
Feedback backend: `web/functions/api/feedback.ts` → Cloudflare D1 `vachanamrut-feedback` (`schema.sql`, `wrangler.toml`).

## What's built (current state)

**Navigation (phone):** floating glass tab bar — હોમ · વિષયો · વચનામૃત · સાચવેલાં 🔖 (no badge). Today left the bar
(it's the Home carousel; Home stays lit on the Today page). Desktop: sidebar (Home, Vachanamrut, Today, Saved + your
lists, all topics; footer: share app, feedback).

**Home:** sabha painting banner (dark fade, white title) · phone search · iPhone-Safari "Add to Home Screen" hint
(once) · **Today's 5 amrut bindu as an endless swipe carousel** (phone: 1 per view; desktop: 2 + arrows; dots) ·
quick links (આગળ વાંચો / આજે શું વાંચું? / સાચવેલાં) · 4 random topics + "Explore more" ·
6 random Vachanamruts (≥3 amrut bindu; code + title + count) + "બધાં 273 વચનામૃત જુઓ" · About section
(Mahant Swami photo, intro, start reading, share app, feedback). No credits paragraph (credits in image tooltips + README).

**Topics tab:** themed groups (ભગવાન, ભક્તિ અને સાધના, સંત અને સત્સંગ, દોષો અને ઉપાય, જીવન અને જ્ઞાન) with
sliding theme tabs + scroll-spy; 2-per-row boxes showing "N પેટા વિષય / N અમૃત બિંદુ". Tap → topic with all subtopics.

**Vachanamrut tab:** book sections (ગઢડા પ્રથમ … ગઢડા અંત્ય, વધારાનાં) with the same sliding tabs + scroll-spy
(shared `GroupedPage`, `banner` + `list` props). Each section opens with a painting banner (sabha / manuscript
alternating, varied crop) with name + "N વચનામૃત · N અમૃત બિંદુ", then contents rows: saffron number badge, title,
count, ›. 273 rows; the 17 with no amrut bindu (incl. all 11 extra ones) are greyed with "—". Tapping a section tab
jumps (instant if far, smooth if near). ‹ back on a Vachanamrut returns to its row. User found the first
number-tile grid boring → chose banners + list. Search by number or name ("લોયા 6" works). Tap → one Vachanamrut
(route `#t=v<anirdesh no.>`, e.g. v250 = ગ. અં. ૨૭): its amrut bindu as a deck, de-duplicated; second pill = topic
filter ("વિષય · બધા"); 📖 button opens the full text on anirdesh. The reference on every card opens this view.

**Topic screen (phone):** header = topic name as glass pill (▾ opens topic sheet) + PDF + ⚙ settings;
one subtopic pill ("પેટા વિષય · બધા"); hidden if only one subtopic. Card deck below.
**Desktop:** big heading, subtopic picker, list of cards, right rail (scroll-spy / subtopic links), prev/next subtopic.

**Today screen:** title "આજનાં અમૃત બિંદુ · date", no dropdowns, 5 cards (same for everyone per day; rotate daily,
first card repeats only after 1635 days).

**Card deck:** swipe any direction (left/up next, right/down previous), endless loop, custom pointer gesture
(long quotes scroll inside), double-tap = ♥ with heart burst, shuffle = jump to a random card (no toast),
rolling counter, jump sheet (tap counter or list icon), card shows Vachanamrut reference + title (saffron, opens
that Vachanamrut's view), subtopic line only when "all" is selected (Today/Saved show topic › subtopic). Crystal edge on cards.

**Card actions:** ♥ favourite (like-pop) · add to list (playlists; create/delete in-menu, saffron confirm, no browser
pop-up) · share menu · પૂરું વાંચો.

**Share:** every option sends the **picture card + note** ("<topic>" વિષય પર … તમે પણ અહીં વાંચી શકો 👉 link).
Phone: share sheet with image(s) + note (note also copied — WhatsApp iPhone drops captions). Desktop: copies image
and opens WhatsApp/Telegram/X with the note. Copy = image only. Download. Report (feedback with quote attached).
Picture card: painting, topic › subtopic, quote, reference, title, site. Long quotes → taller card (up to 1080×1920);
very long → split into up to 4 parts ("ભાગ 1/4", "આગળ ભાગ 2 માં →"), all parts shared together.
Short links: `#a=<code>` (ASCII) for cards/topics/subtopics.

**PDF:** current topic / subtopic / favourites / list → print layout → browser "Save as PDF" (correct Gujarati
shaping). Button shows "PDF બને છે…" → ✓ "PDF તૈયાર".

**Saved:** (tab icon 🔖 Bookmark) favourites (♥) + your own lists + saved Vachanamruts as the picker; saved
Vachanamruts (♡ on each row of the Vachanamrut tab, localStorage `favVachs`; also a "સાચવેલાં" group at the top of
that tab) open their cards and are never mixed into "બધા" (hidden when only Vachanamruts are saved); drag-reorder in jump sheet for own lists.
Stored only in the device's browser (no account).

**Feedback:** in-app form (ભૂલ / સૂચન / અન્ય, message, optional name) → D1. Honeypot, 5 per device per 10 min,
hashed IP only. Read in Cloudflare dashboard → D1 → vachanamrut-feedback → `feedback`.

**Settings (⚙):** text size (5 steps, default **2nd**), theme (default **dark**; choice remembered). Only on
screens with cards (+ desktop sidebar); Home / વિષયો / વચનામૃત list show a one-tap ☀/🌙 theme button instead.

**Look:** warm ivory / warm near-black, saffron accent, X-style glow in headers and card corners, liquid glass on
floating surfaces (menus, sheets, pills, toast, tab bar) with Reduce-Transparency fallback. Consistent type scale.
Wording: "અમૃત બિંદુ" (not અવતરણ), "આજનાં અમૃત બિંદુ", "બધા".

**PWA:** installable, offline after first visit, Android app-icon shortcuts (Today, random, Saved), theme applied
before first paint (iPhone status bar matches theme).

## Decisions & reasons (short)

- Floating tab bar kept (user likes it) but slimmed; card height prioritised everywhere.
- No liquid-glass blur on quote cards (swipe jank + readability) — crystal edge instead.
- Feelings feature ("આજે કેવું લાગે છે?") **parked** by user; files in `parked/feelings/` (feelings.txt,
  feelings.py, all-subtopics.txt, feelings.json); `parked/feelings/subject-index.json` (anirdesh "વિષયવાર વચનામૃતોની નોંધ").
- Liquid-glass repo (amanbairagi30) not used: no licence; built our own.
- Images: only Wikimedia Commons CC BY-SA (sabha painting, manuscript, Mahant Swami photo). BAPS site photos not used (copyright).
- Topic mind-map / graph (colleague's idea) rejected: 65 topics share Vachanamruts in 1,363 pairs → hairball,
  hard to tap on phones. Built the Vachanamrut tab instead; "related topics" pills remain an idea.
- Real Android widget needs a native app → not done; shortcuts instead. Daily notification = possible next step.
- Author credit removed at user's request.

## Commands

```bash
cd web
npm run dev -- --host --port 5174      # local (http); phone: http://192.168.1.103:5174
npm run dev:https                      # https on Wi-Fi (needed to test copy/share on a phone)
node src/lib/quoteLinks.check.ts       # short-link self-check
node src/lib/translit.check.ts         # search transliteration check
node scripts/sw.check.mjs              # service worker check
npm run build
npx wrangler pages deploy dist --project-name vachanamrut-amrutbindu --branch main --commit-dirty=true
cd .. && git add -A && git commit -m "…" && git push
```
Pull feedback: `npx wrangler d1 execute vachanamrut-feedback --remote --command "SELECT * FROM feedback ORDER BY id DESC"`

## Promo video (`promo/`)

`vachanamrut-promo.mp4` — 36 s, 1080×1920, Gujarati captions + male neural voice (Microsoft edge-tts
`gu-IN-NiranjanNeural`, installed in a job venv — `pip install edge-tts` to redo). Lines in `script.txt`, voice in `voice/`,
shot choreography in `record.js` (timed from `timing.json`). Re-record: start the dev server and headless Chrome
(`--remote-debugging-port=9222`), rebuild `.run.js` (record.js with timing.json inlined), `node rec.mjs http://localhost:5174/#`,
then the ffmpeg assemble step (concat frames.txt, trim at start.txt, voice lines delayed to each slot). No music (copyright) —
add from Instagram/YouTube's library on upload.

## Open / ideas

- Related topics ("સંબંધિત વિષયો") at the end of a topic, ranked by shared Vachanamruts.

- Feelings pills (parked; mapping needs a teacher's review).
- Daily notification of today's amrut bindu (Android).
- Custom domain (e.g. amrutbindu.in) — Cloudflare → Custom domains.
- Verify all quotes against their Vachanamrut text and list mismatches.
- Gujarati vs English digits are mixed (૬૩ vs 1/182) — left as is unless the user asks.
- Commit author email is the work email (public repo) — user may want it changed.
