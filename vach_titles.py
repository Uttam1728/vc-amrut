# Fetch each Vachanamrut's title (e.g. 198 → "અખતરડાહ્યાનું") for every vachno the quotes cite.
# Saves after each fetch and skips ones already saved, so it can be stopped and re-run.
import json, re, time, urllib.request
from html import unescape
from pathlib import Path

OUT = Path(__file__).with_name("web") / "public" / "vach.json"
data = json.loads(Path(__file__).with_name("subtopics.json").read_text())
nos = sorted({q["vachno"] for subs in data.values() for s in subs for q in s.get("quotes") or []})
titles = json.loads(OUT.read_text()) if OUT.exists() else {}

for n in nos:
    if str(n) in titles:
        continue
    url = f"https://www.anirdesh.com/vachanamrut/index.php?format=gu&vachno={n}"
    html = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "vachanamrut-quotes"}), timeout=30).read().decode()
    m = re.search(r"<title>(.*?)::", html, re.S)
    titles[str(n)] = unescape(m.group(1)).split(":", 1)[1].strip() if m else ""
    OUT.write_text(json.dumps(titles, ensure_ascii=False))
    print(n, titles[str(n)], flush=True)
    time.sleep(0.3)

print(f"{len(titles)} titles, {sum(1 for t in titles.values() if not t)} missing")
