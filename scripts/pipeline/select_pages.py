import sys, os, re, glob, json
src = sys.argv[1]; dst = sys.argv[2]
stats = []
for f in sorted(glob.glob(os.path.join(src, "*.raw.txt"))):
    base = os.path.basename(f)[:-len(".raw.txt")]
    pages = open(f, encoding="utf-8", errors="replace").read().split("\f")
    keep = []
    for i, p in enumerate(pages):
        has_interview = re.search(r"면접|구술", p)
        is_nonsul_card = re.search(r"☑\s*논술고사|■\s*논술고사|☑\s*선다형|■\s*선다형", p)
        is_interview_card = re.search(r"[☑■▣√✔✓]\s*면접", p)
        qlike = len(re.findall(r"[?？]", p))
        if is_interview_card or (has_interview and not is_nonsul_card and (qlike or re.search(r"문항|질문|평가요소|제시문|예시", p))):
            keep.append(i)
    # include following pages of interview cards (continuations) until a nonsul card appears
    ext = set(keep)
    for i in keep:
        if re.search(r"[☑■▣√✔✓]\s*면접", pages[i]):
            j = i + 1
            while j < len(pages) and j < i + 12:
                if re.search(r"☑\s*논술고사|■\s*논술고사|문항정보|문항카드", pages[j]) and not re.search(r"[☑■▣√✔✓]\s*면접", pages[j]):
                    break
                ext.add(j); j += 1
    keep = sorted(ext)
    out = []
    for i in keep:
        out.append(f"=== PAGE {i+1} ===\n{pages[i].strip()}\n")
    text = "\n".join(out)
    with open(os.path.join(dst, base + ".txt"), "w", encoding="utf-8") as w:
        w.write(text)
    stats.append((base, len(pages), len(keep), len(text)))
for s in stats: print("\t".join(map(str, s)))
print("TOTAL_CHARS", sum(s[3] for s in stats))
