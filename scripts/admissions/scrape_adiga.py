#!/usr/bin/env python3
"""Scrape official 수시 admission results from 대입정보포털 어디가 (adiga.kr, 한국대학교육협의회).

The page "전형 평가기준 및 전년도 결과공개 → 입시결과 상세정보" (/ucp/cls/uni/classUnivAdmssPopup.do) is the
standardized disclosure every university submits: 모집인원, 경쟁률, 충원인원 and 학생부 환산점수/환산등급 at
50·70% (mandatory) and 80·90·100% (optional, published at each university's discretion).

usage: python3 scripts/admissions/scrape_adiga.py WORK_DIR [YEAR ...]
  WORK_DIR/raw/<year>_<unvCd>_<type>_p<n>.html   raw pages (provenance)
  WORK_DIR/files/<year>_<unvCd>.<ext>            each university's 추가안내자료 file, if any
  WORK_DIR/rows.jsonl                            parsed rows
Re-running skips pages already saved.
"""
import html as htmlmod
import json
import os
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import requests

BASE = "https://www.adiga.kr"
UA = "Mozilla/5.0 (korea-susi admission-results collector)"
TYPES = {"01": "학생부교과", "02": "학생부종합"}  # slcnTypeCd
CUTS = ["50", "70", "80", "90", "100"]

work = os.path.abspath(sys.argv[1])
years = [int(y) for y in sys.argv[2:]] or [2026, 2025]
os.makedirs(os.path.join(work, "raw"), exist_ok=True)
os.makedirs(os.path.join(work, "files"), exist_ok=True)


def new_session():
    s = requests.Session()
    s.headers["User-Agent"] = UA
    r = s.get(f"{BASE}/uct/acd/ade/criteriaAndResultView.do", timeout=60)
    r.raise_for_status()
    csrf = re.search(r'name="_csrf" value="([^"]+)"', r.text).group(1)
    return s, csrf


_local = threading.local()


def thread_session():
    if not hasattr(_local, "sess"):
        _local.sess = new_session()
    return _local.sess


def post(s, csrf, path, data, tries=4):
    for i in range(tries):
        try:
            r = s.post(BASE + path, data={**data, "_csrf": csrf}, headers={"X-CSRF-TOKEN": csrf, "Referer": BASE + "/uct/acd/ade/criteriaAndResultView.do"}, timeout=90)
            if r.status_code == 200 and len(r.text) > 500:
                return r.text
        except requests.RequestException:
            pass
        time.sleep(2 ** (i + 1))
    raise RuntimeError(f"failed {path} {data}")


def univ_list(s, csrf, year):
    # the criteria list for edition (year+1) carries the universities whose (year) results are disclosed
    t = post(s, csrf, "/uct/acd/ade/criteriaAndResultAjax.do", {
        "pagination.currentPage": "1", "pagination.cntPerPage": "400", "searchSyr": str(year + 1),
        "searchConstIndex": "0", "unvCd": "", "compUnvCd": "", "searchUnvComp": "0", "tsrdCmphSlcnArtclUpCd": "10"})
    out = {}
    for code, name in re.findall(r'fnDetailPopup\(&quot;(\d+)&quot;\)">([^<]+)</a>', t):
        out[code] = htmlmod.unescape(name).strip()
    return out


def cell_text(td):
    return re.sub(r"\s+", " ", htmlmod.unescape(re.sub(r"<[^>]+>", "", td))).strip()


def parse_rows(page):
    body = page[page.find('id="tbResult"'):]
    tb = body[body.find("<tbody"): body.find("</tbody>")]
    rows = []
    for tr in re.findall(r"(?s)<tr>(.*?)</tr>", tb):
        tds = [cell_text(x) for x in re.findall(r"(?s)<td[^>]*>(.*?)</td>", tr)]
        if len(tds) < 9:
            continue
        row = {
            "period": tds[0], "typeGroup": tds[1], "admission": tds[2], "unit": tds[3],
            "recruitInitial": tds[4], "recruitCarried": tds[5], "recruit": tds[6],
            "competition": tds[7], "waitlist": tds[8],
        }
        if len(tds) == 10 and "미제출" in tds[9]:
            row["withheld"] = re.sub(r"^미제출 사유\s*:\s*", "", tds[9])
        elif len(tds) >= 20:
            row["score"] = dict(zip(CUTS, tds[9:14]))
            row["scoreTotal"] = tds[14]
            row["grade"] = dict(zip(CUTS, tds[15:20]))
        else:
            row["unparsed"] = tds[9:]
        rows.append(row)
    return rows


def total_count(page):
    m = re.search(r'총 <strong class="prm01">([\d,]+)</strong>건', page)
    return int(m.group(1).replace(",", "")) if m else 0


def fetch_one(args):
    year, code, name, typ = args
    s, csrf = thread_session()
    raw = lambda n: os.path.join(work, "raw", f"{year}_{code}_{typ}_p{n}.html")
    params = {"searchSyr": str(year), "unvCd": code, "ruCd": "X", "slcnTypeCd": typ}
    if os.path.exists(raw(1)):
        first = open(raw(1), encoding="utf-8").read()
    else:
        first = post(s, csrf, "/ucp/cls/uni/classUnivAdmssPopup.do", params)
        open(raw(1), "w", encoding="utf-8").write(first)
        time.sleep(0.25)
    pages = [first]
    n_pages = (total_count(first) + 9) // 10
    for p in range(2, n_pages + 1):
        if os.path.exists(raw(p)):
            pages.append(open(raw(p), encoding="utf-8").read())
            continue
        t = post(s, csrf, "/ucp/cls/uni/classUnivAdmssPopupAjax.do", {**params, "rcmtMmntCd": "", "slcnGroupCd": "", "pagination.currentPage": str(p)})
        open(raw(p), "w", encoding="utf-8").write(t)
        pages.append(t)
        time.sleep(0.25)
    # 추가안내자료 (university-provided supplementary file)
    fm = re.search(r'fnFileDownOne\(&quot;(\d+)&quot;,&quot;(\d+)&quot;\)', first)
    file_ref = None
    if fm:
        file_ref = {"fileId": fm.group(1), "fileSn": fm.group(2)}
        existing = [f for f in os.listdir(os.path.join(work, "files")) if f.startswith(f"{year}_{code}.")]
        if not existing:
            try:
                r = s.get(f"{BASE}/cmm/com/file/fileDown.do", params={"fileId": fm.group(1), "fileSn": fm.group(2), "menuId": "null"}, timeout=120)
                cd = r.headers.get("Content-Disposition", "")
                fn = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", cd)
                fname = requests.utils.unquote(fn.group(1)) if fn else ""
                ext = os.path.splitext(fname)[1].lower() or ".bin"
                if r.status_code == 200 and len(r.content) > 200:
                    open(os.path.join(work, "files", f"{year}_{code}{ext}"), "wb").write(r.content)
                    file_ref["filename"] = fname
            except requests.RequestException:
                pass
    rows = []
    for page in pages:
        rows.extend(parse_rows(page))
    return {"year": year, "unvCd": code, "university": name, "type": typ, "total": total_count(first), "rows": rows, "file": file_ref}


def main():
    s, csrf = new_session()
    jobs = []
    for year in years:
        univs = univ_list(s, csrf, year)
        print(f"{year}: {len(univs)} universities", flush=True)
        json.dump(univs, open(os.path.join(work, f"univs_{year}.json"), "w"), ensure_ascii=False, indent=0)
        for code, name in univs.items():
            for typ in TYPES:
                jobs.append((year, code, name, typ))
    out = open(os.path.join(work, "rows.jsonl"), "w", encoding="utf-8")
    done = 0
    with ThreadPoolExecutor(max_workers=int(os.environ.get("ADIGA_WORKERS", "4"))) as ex:
        for res in ex.map(fetch_one, jobs):
            out.write(json.dumps(res, ensure_ascii=False) + "\n")
            done += 1
            if done % 25 == 0:
                print(f"{done}/{len(jobs)}", flush=True)
    out.close()
    print("done", done)


if __name__ == "__main__":
    main()
