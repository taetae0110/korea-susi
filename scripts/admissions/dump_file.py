#!/usr/bin/env python3
"""Dump a university's 입시결과 file to numbered text rows, so extracted numbers can be checked against a row.

usage: python3 dump_file.py FILE OUT_TXT
  .xlsx/.xlsm  every sheet, one line per row: "S<sheet>R<row>: v1 | v2 | ..." (cell values as Excel shows them)
  .pdf         pdftotext -layout, one line per text line: "P<page>L<line>: text"
  .hwpx        paragraph/table-cell text from the OOXML-like package, one line per table row
  .hwp         HWP 5 binary: "T<table>R<row>: cells at their column index" and paragraphs "H<n>:"
  .xls         converted to .xlsx with LibreOffice, then as .xlsx
  .html/.htm   every <table> laid out on a grid (colspan/rowspan cells occupy their first slot, the rest stay
               empty): "T<table>R<row>: ..."; other text blocks "H<n>: ..."
Lines are prefixed with a stable reference the extractor cites (row_ref).
"""
import os
import re
import subprocess
import sys
import zipfile

# olefile is vendored next to this script (pip install --target scripts/admissions/.vendor olefile)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".vendor"))


def fmt(v):
    if v is None:
        return ""
    if isinstance(v, float):
        if v.is_integer():
            return str(int(v))
        return ("%.4f" % v).rstrip("0").rstrip(".")
    return re.sub(r"\s+", " ", str(v)).strip()


def dump_xlsx(path, out):
    import openpyxl

    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    for si, ws in enumerate(wb.worksheets, 1):
        out.write(f"## sheet {si}: {ws.title}\n")
        for ri, row in enumerate(ws.iter_rows(values_only=True), 1):
            cells = [fmt(c) for c in row]
            while cells and cells[-1] == "":
                cells.pop()
            if any(cells):
                out.write(f"S{si}R{ri}: " + " | ".join(cells) + "\n")


def dump_pdf(path, out):
    txt = subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True, text=True).stdout
    for pi, page in enumerate(txt.split("\f"), 1):
        for li, line in enumerate(page.split("\n"), 1):
            if line.strip():
                out.write(f"P{pi}L{li}: {re.sub(r'  +', ' | ', line.strip())}\n")


def dump_hwpx(path, out):
    z = zipfile.ZipFile(path)
    sections = sorted(n for n in z.namelist() if re.match(r"Contents/section\d+\.xml", n))
    n = 0
    for sec in sections:
        xml = z.read(sec).decode("utf-8", "replace")
        # table rows -> cells -> text runs
        for tr in re.findall(r"(?s)<hp:tr[^>]*>(.*?)</hp:tr>", xml):
            cells = []
            for tc in re.findall(r"(?s)<hp:tc[^>]*>(.*?)</hp:tc>", tr):
                cells.append(re.sub(r"\s+", " ", " ".join(re.findall(r"(?s)<hp:t[^>]*>(.*?)</hp:t>", tc))).strip())
            if any(cells):
                n += 1
                out.write(f"T{n}: " + " | ".join(cells) + "\n")
        body = re.sub(r"(?s)<hp:tbl.*?</hp:tbl>", "", xml)
        for p in re.findall(r"(?s)<hp:p[ >].*?</hp:p>", body):
            t = re.sub(r"\s+", " ", " ".join(re.findall(r"(?s)<hp:t[^>]*>(.*?)</hp:t>", p))).strip()
            if t:
                n += 1
                out.write(f"T{n}: {t}\n")


def _hwp_records(data):
    pos = 0
    while pos + 4 <= len(data):
        hdr = int.from_bytes(data[pos:pos + 4], "little")
        tag, level, size = hdr & 0x3FF, (hdr >> 10) & 0x3FF, (hdr >> 20) & 0xFFF
        pos += 4
        if size == 0xFFF:
            size = int.from_bytes(data[pos:pos + 4], "little")
            pos += 4
        yield tag, level, data[pos:pos + size]
        pos += size


def _hwp_text(payload):
    """PARA_TEXT (UTF-16LE) without control characters."""
    out, i = [], 0
    n = len(payload) // 2
    while i < n:
        ch = int.from_bytes(payload[2 * i:2 * i + 2], "little")
        if ch < 32:
            if ch in (1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23):
                i += 8  # inline/extended control occupies 8 WCHARs
                continue
            if ch in (10, 13):
                out.append(" ")
            i += 1
            continue
        out.append(chr(ch))
        i += 1
    return "".join(out)


def dump_hwp(path, out):
    """HWP 5 binary: BodyText sections; tables rebuilt from each cell's (row, col) address."""
    import olefile
    import zlib

    ole = olefile.OleFileIO(path)
    header = ole.openstream("FileHeader").read()
    compressed = bool(int.from_bytes(header[36:40], "little") & 1)
    sections = sorted((s for s in ole.listdir() if s[0] == "BodyText"), key=lambda s: int(s[1].replace("Section", "")))
    PARA_TEXT, LIST_HEADER, TABLE = 67, 72, 77
    tno = 0
    pno = 0
    for sec in sections:
        raw = ole.openstream(sec).read()
        data = zlib.decompress(raw, -15) if compressed else raw
        active = []  # open tables, innermost last: {"level", "cells": {(r, c): [text]}, "cell"}
        finished = []
        for tag, level, payload in _hwp_records(data):
            while active and level < active[-1]["level"]:
                finished.append(active.pop())
            if tag == TABLE:
                active.append({"level": level, "cells": {}, "cell": None})
                continue
            if tag == LIST_HEADER and active and level == active[-1]["level"] and len(payload) >= 16:
                col = int.from_bytes(payload[8:10], "little")
                row = int.from_bytes(payload[10:12], "little")
                active[-1]["cell"] = (row, col)
                active[-1]["cells"].setdefault((row, col), [])
                continue
            if tag == PARA_TEXT:
                text = re.sub(r"\s+", " ", _hwp_text(payload)).strip()
                if not text:
                    continue
                if active and active[-1]["cell"] is not None:
                    active[-1]["cells"][active[-1]["cell"]].append(text)
                else:
                    pno += 1
                    out.write(f"H{pno}: {text}\n")
        finished.extend(reversed(active))
        stack = finished
        for t in stack:
            if not t["cells"]:
                continue
            tno += 1
            nrows = max(r for r, _ in t["cells"]) + 1
            ncols = max(c for _, c in t["cells"]) + 1
            for r in range(nrows):
                cells = [" ".join(t["cells"].get((r, c), [])) for c in range(ncols)]
                if any(cells):
                    out.write(f"T{tno}R{r + 1}: " + " | ".join(cells) + "\n")
            pno += 0


def dump_xls(path, out):
    import shutil
    import tempfile

    tmp = tempfile.mkdtemp()
    try:
        subprocess.run(["soffice", "--headless", "--convert-to", "xlsx", "--outdir", tmp, path], capture_output=True, timeout=180)
        conv = [f for f in os.listdir(tmp) if f.endswith(".xlsx")]
        if conv:
            dump_xlsx(os.path.join(tmp, conv[0]), out)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def dump_html(path, out):
    from bs4 import BeautifulSoup

    raw = open(path, "rb").read()
    soup = BeautifulSoup(raw, "lxml")
    for bad in soup(["script", "style", "noscript"]):
        bad.decompose()
    text = lambda el: re.sub(r"\s+", " ", el.get_text(" ")).strip()
    tables = soup.find_all("table")
    # innermost tables only: a layout table that wraps data tables would repeat them
    tables = [t for t in tables if not t.find("table")]
    for ti, table in enumerate(tables, 1):
        grid = {}
        r = 0
        for tr in table.find_all("tr"):
            c = 0
            for cell in tr.find_all(["td", "th"], recursive=False):
                while (r, c) in grid:
                    c += 1
                rs = int(cell.get("rowspan") or 1) if str(cell.get("rowspan") or "1").isdigit() else 1
                cs = int(cell.get("colspan") or 1) if str(cell.get("colspan") or "1").isdigit() else 1
                grid[(r, c)] = text(cell)
                for dr in range(rs):
                    for dc in range(cs):
                        if (dr, dc) != (0, 0):
                            grid.setdefault((r + dr, c + dc), "")
                c += cs
            r += 1
        if not grid:
            continue
        nrows = max(k[0] for k in grid) + 1
        ncols = max(k[1] for k in grid) + 1
        for ri in range(nrows):
            cells = [grid.get((ri, ci), "") for ci in range(ncols)]
            while cells and cells[-1] == "":
                cells.pop()
            if any(cells):
                out.write(f"T{ti}R{ri + 1}: " + " | ".join(cells) + "\n")
        table.decompose()
    n = 0
    for el in soup.find_all(["h1", "h2", "h3", "h4", "h5", "p", "li", "caption", "div", "span"]):
        if el.find(["div", "p", "li", "h1", "h2", "h3", "h4", "h5"]):
            continue
        t = text(el)
        if t:
            n += 1
            out.write(f"H{n}: {t}\n")


def main():
    src, dst = sys.argv[1], sys.argv[2]
    ext = os.path.splitext(src)[1].lower()
    with open(dst, "w", encoding="utf-8") as out:
        if ext in (".xlsx", ".xlsm"):
            dump_xlsx(src, out)
        elif ext == ".pdf":
            dump_pdf(src, out)
        elif ext == ".hwpx":
            dump_hwpx(src, out)
        elif ext == ".hwp":
            dump_hwp(src, out)
        elif ext == ".xls":
            dump_xls(src, out)
        elif ext in (".html", ".htm"):
            dump_html(src, out)
        else:
            out.write("")


if __name__ == "__main__":
    main()
