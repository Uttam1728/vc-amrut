# વચનામૃત અમૃત બિંદુ · Vachanamrut Amrut Bindu

Quotes from the Vachanamrut, by topic, as swipeable cards — for students.
Live: **https://vachanamrut-amrutbindu.pages.dev**

- 65 topics · 862 subtopics · 1,635 amrut bindu, each linked to its Vachanamrut
- Browse by topic or by Vachanamrut (all 273, by section); swipe cards on phone, list + sidebar on desktop
- Search in Gujarati or English · today's 5 amrut bindu · save ♥ cards and Vachanamruts · your own lists
- Share as a picture card · PDF of any list · light/dark and text size
- Works offline and installs to the home screen

## Layout

```
web/              the app (Vite + React + Tailwind) — deployed to Cloudflare Pages
  public/         subtopics.json + vach.json (the data the app loads), images, service worker
  functions/      /api/feedback → Cloudflare D1
data/             scraped data: topics.json, subtopics.json
scripts/          scrape.py (quotes), vach_titles.py (titles), fetch_*images.py (image candidates)
parked/feelings/  "how are you feeling?" mapping — paused, not used by the app
```

## Run

```bash
cd web
npm install
npm run dev          # http://localhost:5173
npm run dev:https    # https on your Wi-Fi (needed to test copy/share on a phone)
npm run build        # → web/dist
```

## Deploy (Cloudflare Pages)

```bash
cd web && npm run build
npx wrangler pages deploy dist --project-name vachanamrut-amrutbindu --branch main
```

## Data

- `python3 scripts/scrape.py` → `data/topics.json`, `data/subtopics.json` (quotes per topic/subtopic) from
  [anirdesh.com](https://www.anirdesh.com/vachanamrut/vach-quotes.php). Re-run to refresh; it resumes where it stopped.
  The app reads it through a link: `web/public/subtopics.json → ../../data/subtopics.json`.
- `python3 scripts/vach_titles.py` → `web/public/vach.json` — Vachanamrut titles by number.
- `parked/feelings/` — `feelings.txt` → `python3 parked/feelings/feelings.py` → `feelings.json` (paused).

## Credits

Quotes: anirdesh.com. Images: Wikimedia Commons, © BAPS Swaminarayan Sanstha, CC BY-SA 4.0 (credited in the app's About section).
