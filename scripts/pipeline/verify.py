#!/usr/bin/env python3
"""Verify that every text field in an extraction JSON appears verbatim in its source report.

usage: python3 verify.py OUT_JSON [OUT_JSON ...]
       python3 verify.py --all OUT_DIR

Each OUT_JSON's "source.file" names the report (e.g. "2026_동덕여자대학교"); the source texts are
txt/<file>.{raw,layout,plain}.txt next to this tools/ directory (three pdftotext reading orders). Text is compared after removing all whitespace
and page-number footers, so line wraps and page breaks don't matter, but any change of wording does.
"""
import json, os, re, sys, glob

ROOT = os.environ.get("PIPELINE_WORK_DIR") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TXT = os.path.join(ROOT, "txt")

ALLOWED_MARKERS = ["[그림]", "[표]", "[그래프]", "[수식]", "[이미지]", "(중략)", "…"]
QUOTES = str.maketrans({"“": '"', "”": '"', "‘": "'", "’": "'", "∙": "·", "・": "·", "ㆍ": "·", "•": "·",
                        "～": "~", "〜": "~", "－": "-", "–": "-", "—": "-", "？": "?", "！": "!", "，": ",",
                        "：": ":", "（": "(", "）": ")"})


def norm(s: str) -> str:
    s = s.translate(QUOTES)
    s = re.sub(r"[\s​ ﻿]+", "", s)
    return s


_cache = {}


def source_text(file):
    """All pdftotext extractions (raw / layout / default reading order) of the same PDF, normalised.
    A string counts as verbatim if it appears in any one of them."""
    if file not in _cache:
        parts = []
        for kind in ("raw", "layout", "plain"):
            path = os.path.join(TXT, f"{file}.{kind}.txt")
            if not os.path.exists(path):
                continue
            raw = open(path, encoding="utf-8", errors="replace").read()
            raw = re.sub(r"^\s*-\s*\d+\s*-\s*$", "", raw, flags=re.M)  # page footers like "- 31 -"
            raw = re.sub(r"^\s*\d+\s*$", "", raw, flags=re.M)  # bare page numbers
            raw = raw.replace("\f", "\n")
            parts.append(norm(raw))
        _cache[file] = "\u0000".join(parts)
    return _cache[file]


def chunks(text):
    for m in ALLOWED_MARKERS:
        text = text.replace(m, "\n")
    # split on sentence ends and newlines; drop leading list markers
    parts = re.split(r"(?<=[.?!。])\s+|\n+", text)
    out = []
    for p in parts:
        p = re.sub(r"^\s*(?:[-·•※○◦▪■□☐▶►]|\(?\d{1,2}[).]|[①-⑳]|[가-하][.)]|\([가-하]\))\s*", "", p)
        n = norm(p)
        if len(n) >= 6:
            out.append((p.strip(), n))
    return out


def ngram_cov(n, src, k=4):
    grams = [n[i:i + k] for i in range(max(1, len(n) - k + 1))]
    if not grams:
        return 1.0
    return sum(1 for g in grams if g in src) / len(grams)


def check_field(src, text):
    """returns (ok, fuzzy, failures)"""
    fails, fuzzy = [], []
    for orig, n in chunks(text):
        if n in src:
            continue
        cov = ngram_cov(n, src)
        if cov >= 0.97:
            fuzzy.append((orig, cov))
        else:
            fails.append((orig, cov))
    return fails, fuzzy


def verify(path, quiet=False):
    data = json.load(open(path, encoding="utf-8"))
    file = data["source"]["file"]
    src = source_text(file)
    n_fail = n_fuzzy = n_items = 0
    report = []
    for i, q in enumerate(data.get("questions", [])):
        n_items += 1
        fields = [("prompts[%d]" % j, p) for j, p in enumerate(q.get("prompts") or [])]
        for key in ("passage", "intent", "sample_answer"):
            if q.get(key):
                fields.append((key, q[key]))
        if not q.get("prompts"):
            report.append(f"  q{i}: EMPTY prompts")
            n_fail += 1
        for key, val in fields:
            fails, fuzzy = check_field(src, val)
            for orig, cov in fails:
                n_fail += 1
                report.append(f"  q{i} {key} NOT FOUND (cov {cov:.2f}): {orig[:120]}")
            for orig, cov in fuzzy:
                n_fuzzy += 1
                if not quiet:
                    report.append(f"  q{i} {key} fuzzy (cov {cov:.2f}): {orig[:120]}")
    for i, iv in enumerate(data.get("interviews", [])):
        for key in ("admission", "method", "duration"):
            v = iv.get(key)
            if v and norm(v) not in src and ngram_cov(norm(v), src, 3) < 0.9:
                report.append(f"  interviews[{i}].{key} not found: {v[:80]}")
                n_fail += 1
    status = "OK" if n_fail == 0 else "FAIL"
    print(f"{status} {os.path.basename(path)}: {n_items} questions, {n_fail} failures, {n_fuzzy} fuzzy")
    for r in report:
        print(r)
    return n_fail == 0


if __name__ == "__main__":
    args = sys.argv[1:]
    quiet = "--quiet" in args
    args = [a for a in args if a != "--quiet"]
    if args and args[0] == "--all":
        paths = sorted(glob.glob(os.path.join(args[1], "*.json")))
    else:
        paths = args
    ok = all([verify(p, quiet) for p in paths])
    sys.exit(0 if ok else 1)
