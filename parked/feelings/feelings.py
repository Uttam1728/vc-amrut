# Reads feelings.txt (human-editable: "topic › subtopic" per line) and writes:
#   feelings.json             — what the app would use (copy to web/public/ if the feature returns)
#   feelings-review.md        — the same list with amrut bindu counts, for reviewing
# Any line that doesn't match a real subtopic is reported and skipped (usually a typo).
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
data = json.loads((ROOT / "data" / "subtopics.json").read_text())
count = {(t, s["name"]): len(s.get("quotes") or []) for t, subs in data.items() for s in subs}

feelings, problems = [], []
for n, raw in enumerate((HERE / "feelings.txt").read_text().splitlines(), 1):
    line = raw.strip()
    if not line or (line.startswith("#") and not line.startswith("##")):
        continue
    if line.startswith("##"):
        head, en, key = [p.strip() for p in line[2:].split("|")]
        emoji, label = head.split(" ", 1)
        feelings.append({"key": key, "emoji": emoji, "label": label, "en": en, "subtopics": []})
        continue
    topic, _, sub = (p.strip() for p in line.partition("›"))
    if not feelings:
        problems.append(f"line {n}: subtopic before any '## feeling' heading")
    elif (topic, sub) not in count:
        problems.append(f"line {n}: not found → {line}")
    elif [topic, sub] in feelings[-1]["subtopics"]:
        problems.append(f"line {n}: listed twice → {line}")
    else:
        feelings[-1]["subtopics"].append([topic, sub])

(HERE / "feelings.json").write_text(json.dumps(feelings, ensure_ascii=False, indent=1))

md = ["# Feelings → subtopics (generated from feelings.txt — edit that file, not this one)\n"]
for f in feelings:
    total = sum(count[tuple(x)] for x in f["subtopics"])
    md.append(f"\n## {f['emoji']} {f['label']} · {f['en']} — {len(f['subtopics'])} subtopics, {total} amrut bindu\n")
    md.append("| Topic | Subtopic | Amrut bindu |\n|---|---|---|")
    md += [f"| {t} | {s} | {count[(t, s)]} |" for t, s in f["subtopics"]]
(HERE / "feelings-review.md").write_text("\n".join(md) + "\n")

for f in feelings:
    print(f"{f['emoji']} {f['label']}: {len(f['subtopics'])} subtopics, {sum(count[tuple(x)] for x in f['subtopics'])} amrut bindu")
print("\n".join(problems) if problems else "all lines matched ✓")
