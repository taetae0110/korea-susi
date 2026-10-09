#!/usr/bin/env python3
"""Check an extraction from a university's 입시결과 file against the dumped rows, cell by cell.

usage: python3 verify_extra.py DUMP_DIR OUT_JSON [OUT_JSON ...]

Each OUT_JSON:
{
  "source": {"file": "<year>_<unvCd>"},
  "tables": {"t1": {"caption": "학생부 등급(90%)",            # verbatim words from the file naming the metric
                    "basis": "최종등록자",                     # optional, verbatim: whose grades these are
                    "header_refs": ["S1R3"],
                    "cols": {"unit": 2, "recruit": 3, "competition": 4, "grade50": 5, "grade70": 6, "grade90": 7},
                    "col_headers": {"grade90": "S1R3#7"}}},  # optional: the header cell for a field, when the
                                                              # header line does not line up with the data lines
  "rows": [ {"table": "t1", "row_ref": "S1R5", "year": 2026, "type": "학생부종합", "period": "수시",
             "admission": "가천의약학", "unit_group": "약학대학", "unit": "약학과",
             "values": {"recruit": "12", "competition": "48.17", "grade50": "2.39", "grade70": "2.69", "grade90": "3.63"},
             "shift": -1,     # optional: this line has N fewer (negative) / more cells before the values (merged cells)
             "cols": {...}}]  # optional per-row column override
}
Cells are the " | "-separated parts of the dumped line (index from 0, after the "S1R5:" prefix).
A row passes only if the unit name is in the line and every value equals the cell at its column, and every
mapped column's header cell (in any of the table's header rows, or the col_headers cell) carries the matching
label (e.g. "90" for grade90). caption, basis, admission, unit_group and year must appear in the file's text.
Grade values must be numbers between 1 and 9.
"""
import json
import os
import re
import sys

ALLOWED_FIELDS = {"recruit", "applicants", "competition", "waitlist", "grade50", "grade70", "grade80", "grade85",
                  "grade90", "grade95", "grade100", "gradeAvg", "gradeMin", "gradeMax", "unit"}
TYPES = {"학생부교과", "학생부종합", "기타"}


HEADER_LABELS = {
    "grade50": ["50"], "grade70": ["70"], "grade80": ["80"], "grade85": ["85"], "grade90": ["90"], "grade95": ["95"],
    "grade100": ["100", "최저", "최종", "최하"], "gradeAvg": ["평균"], "gradeMin": ["최저", "최소", "최하", "100"],
    "gradeMax": ["최고", "최대", "최상"], "score50": ["50"], "score70": ["70"], "score80": ["80"], "score90": ["90"],
    "score100": ["100", "최저"], "scoreAvg": ["평균"], "competition": ["경쟁"], "recruit": ["모집", "인원", "정원"],
    "applicants": ["지원"], "waitlist": ["충원", "추가", "예비", "추합"], "unit": ["모집단위", "학과", "학부", "전공", "단위"],
}


OTHER_METRICS = ["논술", "수능", "실기", "면접", "서류"]


def header_problems(where, field, col, header_rows, override=None):
    if field not in ALLOWED_FIELDS:
        return [f"{where}: unknown field {field}"]
    labels = override if override is not None else " ".join(r[col] for r in header_rows if col < len(r))
    probs = []
    if not any(k in labels for k in HEADER_LABELS.get(field, [])):
        probs.append(f"{where}: column {col} for {field} has header '{labels}' (needs one of {HEADER_LABELS.get(field)})")
    if field.startswith(("grade", "score")) and any(k in labels for k in OTHER_METRICS):
        probs.append(f"{where}: column {col} for {field} is a different metric: '{labels}'")
    return probs


def norm(s):
    return re.sub(r"\s+", "", str(s)).replace("·", "").replace("・", "").replace("ㆍ", "")


def same_value(a, b):
    a, b = str(a).strip(), str(b).strip()
    if a == b:
        return True
    try:
        return abs(float(a) - float(b)) < 1e-9
    except ValueError:
        return norm(a) == norm(b)


def load_dump(dump_dir, file):
    lines = {}
    for line in open(os.path.join(dump_dir, file + ".txt"), encoding="utf-8"):
        m = re.match(r"^([A-Z]\d+(?:[A-Z]\d+)*): ?(.*)$", line.rstrip("\n"))
        if m:
            lines[m.group(1)] = m.group(2)
    return lines


def header_cell(lines, spec):
    """'S1R3#7' -> text of cell 7 of line S1R3 (None if missing)"""
    ref, _, idx = str(spec).partition("#")
    if ref not in lines or not idx.isdigit():
        return None
    cells = [c.strip() for c in lines[ref].split(" | ")]
    i = int(idx)
    return cells[i] if i < len(cells) else None


def check(dump_dir, path):
    data = json.load(open(path, encoding="utf-8"))
    src = data["source"]
    # 어디가 추가안내자료: {"file": "<year>_<unvCd>"}; university site document: {"id": ..., "site": "<unvCd>", "url": ...}
    file = src.get("file") or src.get("id")
    if not file:
        print(f"FAIL {os.path.basename(path)}: source needs file, or id+site+url")
        return False
    if not src.get("file") and not (src.get("site") and str(src.get("url", "")).startswith("http")):
        print(f"FAIL {os.path.basename(path)}: a site source needs site (university code) and url")
        return False
    own_code = src.get("site") or file.split("_")[1]
    lines = load_dump(dump_dir, file)
    alltext = norm(" ".join(lines.values()))
    in_file = lambda v: norm(v) in alltext
    tables = data.get("tables", {})
    bad = []
    for name, t in tables.items():
        if not t.get("caption"):
            bad.append(f"table {name}: caption missing")
        elif not in_file(t["caption"]):
            bad.append(f"table {name}: caption '{t['caption']}' not in the file")
        if t.get("basis") and not in_file(t["basis"]):
            bad.append(f"table {name}: basis '{t['basis']}' not in the file")
        refs = t.get("header_refs") or ([t["header_ref"]] if t.get("header_ref") else [])
        if not refs:
            bad.append(f"table {name}: no header_refs")
        header_rows = []
        for h in refs:
            if h not in lines:
                bad.append(f"table {name}: header_ref {h} not in dump")
            else:
                header_rows.append([c.strip() for c in lines[h].split(" | ")])
        t["_header_rows"] = header_rows
        overrides = t.get("col_headers") or {}
        for f, spec in overrides.items():
            if header_cell(lines, spec) is None:
                bad.append(f"table {name}: col_headers {f}={spec} is not a cell in the dump")
        t["_overrides"] = overrides
        for f, c in t.get("cols", {}).items():
            ov = header_cell(lines, overrides[f]) if f in overrides else None
            bad.extend(header_problems(f"table {name}", f, c, header_rows, ov if f in overrides else None))
    for i, r in enumerate(data.get("rows", [])):
        ref = r.get("row_ref", "")
        if ref not in lines:
            bad.append(f"r{i}: row_ref {ref} not in dump")
            continue
        text = lines[ref]
        cells = [c.strip() for c in text.split(" | ")]
        if r.get("table") not in tables:
            bad.append(f"r{i}: unknown table {r.get('table')}")
        table = tables.get(r.get("table", ""), {})
        for f, c in (r.get("cols") or {}).items():
            ov = table.get("_overrides", {}).get(f)
            bad.extend(header_problems(f"r{i} override", f, c, table.get("_header_rows", []), header_cell(lines, ov) if ov else None))
        shift = int(r.get("shift") or 0)
        cols = {**{k: v + shift for k, v in table.get("cols", {}).items()}, **(r.get("cols") or {})}
        if not r.get("unit") or norm(r["unit"]) not in norm(text):
            bad.append(f"r{i}: unit '{r.get('unit')}' not in {ref}")
        for k in ("admission", "unit_group"):
            if r.get(k) and not in_file(r[k]):
                bad.append(f"r{i}: {k} '{r[k]}' not in the file")
        if r.get("year") is not None and (not isinstance(r["year"], int) or str(r["year"]) not in alltext):
            bad.append(f"r{i}: year {r['year']!r} must be a number that appears in the file")
        if r.get("type") is not None and r["type"] not in TYPES:
            bad.append(f"r{i}: type must be one of {sorted(TYPES)}")
        if not src.get("file") and r.get("year") is None:
            bad.append(f"r{i}: year is required for a site document")
        if r.get("unvCd") is not None and r["unvCd"] not in (src.get("also") or []) + [own_code]:
            bad.append(f"r{i}: unvCd {r['unvCd']} is not this file's university or one in source.also")
        if r.get("period") is not None and r["period"] not in ("수시", "정시"):
            bad.append(f"r{i}: period must be 수시 or 정시")
        for k, v in (r.get("values") or {}).items():
            if k not in ALLOWED_FIELDS:
                bad.append(f"r{i}: unknown field {k}")
                continue
            if v in (None, ""):
                continue
            c = cols.get(k)
            if c is None or c >= len(cells):
                bad.append(f"r{i}: no column for {k} in {ref}")
            elif not same_value(cells[c], v):
                bad.append(f"r{i}: {k}={v} but cell[{c}]='{cells[c]}' in {ref}: {text[:120]}")
            elif k.startswith("grade"):
                try:
                    ok = 1 <= float(str(v).strip()) <= 9
                except ValueError:
                    ok = False
                if not ok:
                    bad.append(f"r{i}: {k}={v} is not a 1-9 grade")
    status = "OK" if not bad else "FAIL"
    print(f"{status} {os.path.basename(path)}: {len(data.get('rows', []))} rows, {len(bad)} problems")
    for b in bad[:40]:
        print("  " + b)
    return not bad


if __name__ == "__main__":
    d = sys.argv[1]
    ok = all([check(d, p) for p in sys.argv[2:]])
    sys.exit(0 if ok else 1)
