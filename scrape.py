"""Scrape Vachanamrut quote topics + subtopics from anirdesh.com into JSON."""
import json, re, time, urllib.parse, urllib.request
from html import unescape
from pathlib import Path

BASE = "https://www.anirdesh.com/vachanamrut/vach-quotes.php"
OUT = Path(__file__).parent


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8")


def options(html, select_id):
    """[(name, count)] for every non-empty <option> of a <select>."""
    m = re.search(rf'<select id="{select_id}"[\s\S]*?</select>', html)
    if not m:
        return []
    out = []
    for value, label in re.findall(r'<option[^>]*value="([^"]*)"[^>]*>([^<]*)', m.group(0)):
        if value:
            count = re.search(r"\((\d+)\)\s*$", label.strip())
            out.append({"name": unescape(value).strip(), "count": int(count.group(1)) if count else None})
    return out


topics = options(get(BASE), "topic")
(OUT / "topics.json").write_text(json.dumps(topics, ensure_ascii=False, indent=2))
print(f"{len(topics)} topics saved")

ROW = re.compile(
    r'<tr>\s*<td[^>]*>(\d+)</td>\s*<td[^>]*><a[^>]*vachno=(\d+)[^>]*>([^<]*)</a></td>\s*<td[^>]*>([\s\S]*?)</td>'
)


def quotes(html):
    tbody = re.search(r"<tbody>([\s\S]*?)</tbody>", html)
    return [
        {"no": int(no), "vach": unescape(ref).strip(), "vachno": int(vno),
         "text": unescape(re.sub(r"<[^>]+>", "", text)).strip()}
        for no, vno, ref, text in ROW.findall(tbody.group(1) if tbody else "")
    ]


SUB_FILE = OUT / "subtopics.json"
subtopics = json.loads(SUB_FILE.read_text()) if SUB_FILE.exists() else {}
for t in topics:
    done = subtopics.get(t["name"])
    if done and all("quotes" in s for s in done):
        continue  # resume: already scraped in an earlier run
    q_topic = urllib.parse.quote(t["name"])
    subs = options(get(f"{BASE}?topic={q_topic}"), "subtopic")
    for s in subs:
        time.sleep(0.5)  # be polite to the site
        s["quotes"] = quotes(get(f"{BASE}?topic={q_topic}&subtopic={urllib.parse.quote(s['name'])}"))
        if len(s["quotes"]) != s["count"]:
            print(f"  <-- {t['name']} / {s['name']}: got {len(s['quotes'])} quotes, expected {s['count']}")
    subtopics[t["name"]] = subs
    total = sum(s["count"] or 0 for s in subs)
    flag = "" if total == t["count"] else f"  <-- sum {total} != {t['count']}"
    SUB_FILE.write_text(json.dumps(subtopics, ensure_ascii=False, indent=2))  # save after every topic
    print(f"{t['name']}: {len(subs)} subtopics, {sum(len(s['quotes']) for s in subs)} quotes{flag}", flush=True)

print(f"{sum(map(len, subtopics.values()))} subtopics, "
      f"{sum(len(s['quotes']) for v in subtopics.values() for s in v)} quotes saved")
