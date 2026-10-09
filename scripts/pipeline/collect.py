#!/usr/bin/env python3
"""Copy extraction files that pass verify.py into data/extracted/.

usage: python3 scripts/pipeline/collect.py WORK_DIR
WORK_DIR contains out/*.json (extractions) and txt/*.{raw,layout,plain}.txt (pdftotext output).
Files that fail verification are reported and NOT copied.
"""
import io, os, shutil, sys, glob, contextlib

here = os.path.dirname(os.path.abspath(__file__))
repo = os.path.dirname(os.path.dirname(here))
work = os.path.abspath(sys.argv[1])
sys.path.insert(0, here)
import verify  # noqa: E402

verify.TXT = os.path.join(work, "txt")
dest = os.path.join(repo, "data", "extracted")
os.makedirs(dest, exist_ok=True)
ok = bad = 0
for path in sorted(glob.glob(os.path.join(work, "out", "*.json"))):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        passed = verify.verify(path, quiet=True)
    if passed:
        shutil.copy(path, os.path.join(dest, os.path.basename(path)))
        ok += 1
    else:
        bad += 1
        print(buf.getvalue().strip())
print(f"copied {ok} verified files, rejected {bad}")

# Source rows for documents found on universities' own sites (WORK_DIR/sources_extra/<FILE>.tsv)
tsv = os.path.join(repo, "data", "sources.tsv")
lines = open(tsv, encoding="utf-8").read().rstrip("\n").split("\n")
known = {l.split("\t")[1] for l in lines[1:]}
added = 0
for path in sorted(glob.glob(os.path.join(work, "sources_extra", "*.tsv"))):
    for row in open(path, encoding="utf-8").read().strip().split("\n"):
        cols = row.split("\t")
        if len(cols) >= 4 and cols[1] not in known and os.path.exists(os.path.join(dest, cols[1] + ".json")):
            lines.append("\t".join(cols[:5]))
            known.add(cols[1])
            added += 1
open(tsv, "w", encoding="utf-8").write("\n".join(lines) + "\n")
print(f"added {added} source rows")
