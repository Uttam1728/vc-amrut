# Collect candidate Vachanamrut / Swaminarayan images from Wikimedia Commons (openly licensed) for review.
# Saves images + a sources.json (title, licence, author, page) into images-review/. Review only — check each licence before use.
import json, re, time, urllib.parse, urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "images-review"
OUT.mkdir(exist_ok=True)
API = "https://en.wikipedia.org/w/api.php"  # commons.wikimedia.org is blocked on this network; en.wikipedia serves Commons file info too
UA = {"User-Agent": "vachanamrut-quotes-review/1.0 (personal study app; image review)"}


def api(**params):
    url = API + "?" + urllib.parse.urlencode({"format": "json", **params})
    for attempt in range(4):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30))
        except Exception as e:  # Commons resets connections now and then
            time.sleep(2 * (attempt + 1))
    raise SystemExit(f"Commons API unreachable: {url}")


titles = set()
# Known Commons files from the web search, plus every image used on the related Wikipedia articles.
titles |= {"File:Vachnamrut.jpg", "File:Mahant Swami Maharaj discoursing on the Vachanamrut.jpg",
           "File:Places of the Vachanamrut - Gujarat Map.png", "File:Vachanamrut Cover Image.jpg", "File:Vachanamrut English.jpg"}
for article in ["Vachanamrut", "Swaminarayan", "BAPS", "Gadhada", "Akshar Purushottam Upasana", "Gunatitanand Swami",
                "Swaminarayan Sampradaya", "BAPS Shri Swaminarayan Mandir Gadhada", "Swaminarayan Mandir, Gadhada", "Sarangpur, Gujarat",
                "Shikshapatri", "Swaminarayan Akshardham (New Delhi)", "Mahant Swami Maharaj", "Pramukh Swami Maharaj"]:
    r = api(action="query", titles=article, prop="images", imlimit=100, redirects=1)
    for p in r.get("query", {}).get("pages", {}).values():
        titles |= {i["title"] for i in p.get("images", [])}
    time.sleep(0.3)
titles = {t for t in titles if not re.search(r"(?i)\.svg$|icon|logo|commons-|wiki|symbol|flag|edit-|padlock|question_book|ambox", t)}

clean = lambda h: re.sub(r"<[^>]+>", "", h or "").strip()
found = []
tl = sorted(titles)
for k in range(0, len(tl), 40):
    r = api(action="query", titles="|".join(tl[k:k + 40]), prop="imageinfo", iiprop="url|size|extmetadata|mime", iiurlwidth=1600)
    for p in r.get("query", {}).get("pages", {}).values():
        ii = (p.get("imageinfo") or [None])[0]
        if not ii or not re.match(r"image/(jpeg|png|webp)", ii["mime"]):
            continue
        m = ii.get("extmetadata", {})
        found.append({
            "title": p["title"], "width": ii["width"], "height": ii["height"],
            "licence": clean(m.get("LicenseShortName", {}).get("value")),
            "author": clean(m.get("Artist", {}).get("value"))[:80],
            "description": clean(m.get("ImageDescription", {}).get("value"))[:200],
            "url": ii.get("thumburl") or ii["url"], "page": ii["descriptionurl"],
        })
    time.sleep(0.5)

for f in found:
    name = re.sub(r"[^\w.-]+", "_", f["title"].removeprefix("File:"))[:90]
    if not re.search(r"\.(jpe?g|png|webp)$", name, re.I):
        name += ".jpg"
    f["file"] = name
    if not (OUT / name).exists():
        for attempt in range(5):  # upload.wikimedia.org rate-limits (429): back off and retry
            try:
                (OUT / name).write_bytes(urllib.request.urlopen(urllib.request.Request(f["url"], headers=UA), timeout=60).read())
                break
            except Exception as e:
                f["file"] = f"FAILED: {e}"
                time.sleep(5 * (attempt + 1))
        else:
            continue
        f["file"] = name
        time.sleep(1.5)
(OUT / "candidates.json").write_text(json.dumps(found, ensure_ascii=False, indent=1))
for f in sorted(found, key=lambda f: -f["width"] * f["height"]):
    print(f'{f["width"]}x{f["height"]} | {f["licence"]} | {f["title"]} | {f["author"][:30]} | {f["description"][:90]}')
print(len(found), "candidates")
