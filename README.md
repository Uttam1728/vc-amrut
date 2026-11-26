# વચનામૃત અમૃત બિંદુ · Vachanamrut Amrut Bindu

Quotes from the Vachanamrut, by topic, as swipeable cards — for students.
Live: **https://vachanamrut-amrutbindu.pages.dev**

- 65 topics · 862 subtopics · 1,635 amrut bindu, each linked to its Vachanamrut
- Swipe cards (phone), list + sidebar (desktop), search in Gujarati or English
- Today's 5 Vachanamrut, save ♥, your own lists, share as a picture card
- Works offline and installs to the home screen

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

- `scrape.py` → `topics.json`, `subtopics.json` (quotes per topic/subtopic) from
  [anirdesh.com](https://www.anirdesh.com/vachanamrut/vach-quotes.php). Re-run to refresh; it resumes where it stopped.
- `web/public/vach.json` — Vachanamrut titles by number.
- `feelings.txt` → `python3 feelings.py` → `web/public/feelings.json` (work in progress, not used by the app yet).

## Credits

Quotes: anirdesh.com. Images: Wikimedia Commons, © BAPS Swaminarayan Sanstha, CC BY-SA 4.0 (credited in the app's About section).
