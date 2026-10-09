#!/usr/bin/env python3
"""Normalize scraped adiga rows (WORK_DIR/rows.jsonl) into data/admissions/adiga.json.

usage: python3 scripts/admissions/normalize_adiga.py WORK_DIR
Values are kept exactly as adiga prints them (strings); "-" and empty become null.
"""
import json
import os
import re
import sys

work = sys.argv[1]
repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out_path = os.path.join(repo, "data", "admissions", "adiga.json")
TYPES = {"01": "학생부교과", "02": "학생부종합"}
CUTS = ["50", "70", "80", "90", "100"]


def val(v):
    if v is None:
        return None
    v = str(v).strip()
    return None if v in ("", "-") else v


def canonical(name):
    # "가천대학교[본교]" -> "가천대학교"; "건국대학교(글로컬)[분교]" -> "건국대학교(글로컬)"; "[제2캠퍼스]" kept as campus
    base = re.sub(r"\[(본교|분교)\]$", "", name).strip()
    m = re.match(r"^(.*)\[(제\d캠퍼스)\]$", base)
    return (m.group(1), m.group(2)) if m else (base, None)


univs, rows, files = {}, [], {}
seen_jobs = set()
for line in open(os.path.join(work, "rows.jsonl"), encoding="utf-8"):
    job = json.loads(line)
    key = (job["year"], job["unvCd"], job["type"])
    if key in seen_jobs:
        continue
    seen_jobs.add(key)
    name, campus = canonical(job["university"])
    univs[job["unvCd"]] = {"code": job["unvCd"], "adigaName": job["university"], "name": name, "campus": campus}
    if job.get("file") and job["file"].get("fileId"):
        files[f'{job["year"]}_{job["unvCd"]}'] = {**job["file"], "year": job["year"], "unvCd": job["unvCd"]}
    for r in job["rows"]:
        if r.get("unparsed"):
            continue
        row = {
            "unvCd": job["unvCd"], "year": job["year"], "type": TYPES[job["type"]],
            "period": r["period"], "admission": r["admission"], "unit": r["unit"],
            "recruit": val(r["recruit"]), "recruitInitial": val(r["recruitInitial"]), "recruitCarried": val(r["recruitCarried"]),
            "competition": val(r["competition"]), "waitlist": val(r["waitlist"]),
        }
        if r.get("withheld"):
            row["withheld"] = r["withheld"]
        else:
            g = {c: val(r.get("grade", {}).get(c)) for c in CUTS}
            s = {c: val(r.get("score", {}).get(c)) for c in CUTS}
            if any(g.values()):
                row["grade"] = g
            if any(s.values()):
                row["score"] = s
                row["scoreTotal"] = val(r.get("scoreTotal"))
        rows.append(row)

os.makedirs(os.path.dirname(out_path), exist_ok=True)
json.dump({
    "source": "대입정보포털 어디가(adiga.kr) 「전형 평가기준 및 전년도 결과공개」 입시결과 상세정보",
    "universities": sorted(univs.values(), key=lambda u: u["adigaName"]),
    "files": files,
    "rows": rows,
}, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
with_grade = [r for r in rows if r.get("grade")]
print(f"universities {len(univs)}, rows {len(rows)}, with grade cuts {len(with_grade)}, "
      f"with 90% {sum(1 for r in with_grade if r['grade'].get('90'))}, files {len(files)}")
