# Slow retry for the most relevant images that hit Wikimedia's rate limit (429). One request every 20 s.
import json, re, time, urllib.parse, urllib.request
from pathlib import Path

DIR = Path(__file__).with_name("images-review")
UA = {"User-Agent": "vachanamrut-quotes-review/1.0 (personal study app; image review)"}
KEY = ["Courtyard of Dada Khachar", "Vachanamrut Cover Image", "Places of the Vachanamrut", "discoursing on the Vachanamrut",
       "Swaminarayan Temple, Gadhada - panoramio", "Nilkanth Varni", "Vachanamrut English", "Gopinathji Maharaj Gadhada",
       "Swaminarayan Temple, Sarangpur", "Akshar Purshottam - BAPS Mandir Bochasan"]

cands = json.loads((DIR / "candidates.json").read_text())
todo = [c for c in cands if any(k in c["title"] for k in KEY)]
# Wikimedia only serves standard thumbnail widths (https://w.wiki/GHai): ask for 1280 px, drop the tracking params.
q = urllib.parse.urlencode({"action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url", "iiurlwidth": 1280,
                            "titles": "|".join(c["title"] for c in todo)})
info = json.load(urllib.request.urlopen(urllib.request.Request("https://en.wikipedia.org/w/api.php?" + q, headers=UA), timeout=30))
urls = {p["title"]: p["imageinfo"][0] for p in info["query"]["pages"].values() if p.get("imageinfo")}
for c in todo:
    ii = urls.get(c["title"], {})
    c["url"] = re.sub(r"\?.*$", "", ii.get("thumburl") if ii.get("thumbwidth", 0) < ii.get("width", 1e9) else ii.get("url", c["url"]))
for c in todo:
    name = c["title"].removeprefix("File:").replace(" ", "_").replace(",", "").replace("'", "")
    if (DIR / name).exists():
        continue
    for attempt in range(6):
        try:
            (DIR / name).write_bytes(urllib.request.urlopen(urllib.request.Request(c["url"], headers=UA), timeout=60).read())
            print("ok", name, flush=True)
            break
        except Exception as e:
            print("wait", name, e, flush=True)
            time.sleep(60)
    time.sleep(20)
print("done")
