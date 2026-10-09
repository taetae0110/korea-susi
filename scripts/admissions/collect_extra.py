#!/usr/bin/env python3
"""Copy reviewed extractions of university files into data/admissions/extra/ and record their provenance.

usage: python3 -I scripts/admissions/collect_extra.py WORK_DIR ID [ID ...]
  WORK_DIR/extra/<ID>.json   extraction (scripts/admissions/EXTRACT.md) that passed the adversarial review
  WORK_DIR/dump/<ID>.txt     the text it was verified against
  WORK_DIR/files/<ID>.*      the 어디가 추가안내자료 file, or WORK_DIR/site/<key>/<n>.* for a site document
Each extraction is verified again here; anything that fails is reported and NOT copied. Extractions with no
rows are not copied. data/admissions/sources.tsv gets one line per collected document with its sha256, so
anyone can download it again and re-run verify_extra.py on a fresh dump.
"""
import contextlib
import glob
import hashlib
import io
import json
import os
import re
import shutil
import sys

here = os.path.dirname(os.path.abspath(__file__))
repo = os.path.dirname(os.path.dirname(here))
sys.path.insert(0, here)
import verify_extra  # noqa: E402

work = os.path.abspath(sys.argv[1])
ids = sys.argv[2:]
dest = os.path.join(repo, "data", "admissions", "extra")
os.makedirs(dest, exist_ok=True)
tsv = os.path.join(repo, "data", "admissions", "sources.tsv")
HEAD = "id\tkind\tuniversity\turl\tpage_url\ttitle\tsha256\n"
rows = {}
if os.path.exists(tsv):
    for line in open(tsv, encoding="utf-8").read().splitlines()[1:]:
        rows[line.split("\t")[0]] = line


def local_file(doc_id):
    if doc_id.startswith("site_"):
        m = re.match(r"site_(.+)_(\d+)$", doc_id)
        hits = glob.glob(os.path.join(work, "site", m.group(1), m.group(2) + ".*")) if m else []
    else:
        hits = glob.glob(os.path.join(work, "files", doc_id + ".*"))
    return hits[0] if len(hits) == 1 else None


copied = rejected = empty = 0
for doc_id in ids:
    path = os.path.join(work, "extra", doc_id + ".json")
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        ok = os.path.exists(path) and verify_extra.check(os.path.join(work, "dump"), path)
    if not ok:
        rejected += 1
        print(f"REJECT {doc_id}: " + (buf.getvalue().strip() or "missing"))
        continue
    data = json.load(open(path, encoding="utf-8"))
    if not data.get("rows"):
        empty += 1
        continue
    src = data["source"]
    f = local_file(doc_id)
    if not f:
        rejected += 1
        print(f"REJECT {doc_id}: original file not found")
        continue
    sha = hashlib.sha256(open(f, "rb").read()).hexdigest()
    clean = {k: v for k, v in data.items() if k in ("source", "tables", "rows")}
    with open(os.path.join(dest, doc_id + ".json"), "w", encoding="utf-8") as out:
        json.dump(clean, out, ensure_ascii=False, indent=1)
        out.write("\n")
    if src.get("file"):
        meta = None
        for line in open(os.path.join(work, "rows.jsonl"), encoding="utf-8"):
            j = json.loads(line)
            if f"{j['year']}_{j['unvCd']}" == doc_id and j.get("file") and j["file"].get("fileId"):
                meta = j["file"] if j["file"].get("filename") or not meta else meta
        url = f"https://www.adiga.kr/cmm/com/file/fileDown.do?fileId={meta['fileId']}&fileSn={meta['fileSn']}" if meta else ""
        rows[doc_id] = "\t".join([doc_id, "adiga", doc_id.split("_")[1], url, "https://www.adiga.kr/uct/acd/ade/criteriaAndResultView.do",
                                  (meta or {}).get("filename", ""), sha])
    else:
        rows[doc_id] = "\t".join([doc_id, "site", src["site"], src["url"], src.get("page_url", ""), src.get("title", ""), sha])
    copied += 1
with open(tsv, "w", encoding="utf-8") as out:
    out.write(HEAD)
    for k in sorted(rows):
        out.write(rows[k].replace("\n", " ") + "\n")
print(f"copied {copied}, rejected {rejected}, no rows {empty}")
