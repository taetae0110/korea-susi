#!/usr/bin/env python3
"""Write WORK/adiga/<year>_<unvCd>.tsv: the 어디가 rows of each university/year, for comparing a university file
against what 어디가 already shows (scripts/admissions/EXTRACT.md).

usage: python3 scripts/admissions/adiga_tsv.py WORK_DIR
"""
import json
import os
import sys

work = os.path.abspath(sys.argv[1])
out_dir = os.path.join(work, "adiga")
os.makedirs(out_dir, exist_ok=True)
by_file = {}
for line in open(os.path.join(work, "rows.jsonl"), encoding="utf-8"):
    j = json.loads(line)
    key = f"{j['year']}_{j['unvCd']}"
    for r in j["rows"]:
        g = r.get("grade") or {}
        by_file.setdefault(key, []).append([
            {"01": "학생부교과", "02": "학생부종합"}.get(j["type"], j["type"]), r.get("period", ""), r.get("admission", ""), r.get("unit", ""), r.get("recruit", ""),
            g.get("50", ""), g.get("70", ""), g.get("80", ""), g.get("90", ""), g.get("100", ""), r.get("withheld", ""),
        ])
for key, rows in by_file.items():
    with open(os.path.join(out_dir, key + ".tsv"), "w", encoding="utf-8") as f:
        f.write("전형유형\t모집시기\t전형명\t모집단위\t모집인원\t50%\t70%\t80%\t90%\t100%\t비공개사유\n")
        for r in rows:
            f.write("\t".join(str(x).replace("\t", " ") for x in r) + "\n")
print(f"{len(by_file)} files")
