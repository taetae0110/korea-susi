# 공식 보고서 찾기 + 면접 문항 추출 (2차)

Base dir: `/tmp/claude-0/-home-user-korea-susi/8412b1b4-e757-52af-af3f-d876e60c46e8/scratchpad`
(all paths below are relative to it; always `cd` there first.)

For each university assigned to you:

## 1. Find the official document
Find the university's official **「2026학년도 선행학습 영향평가 자체평가 보고서」** (대학별고사 선행학습
영향평가 결과보고서) — and also the 2025학년도 one if available — as published by the university itself.
- Use WebSearch (load it with ToolSearch `select:WebSearch,WebFetch` if needed) and the university's
  입학처 site (자료실/공지사항/입시자료). Typical titles: "선행학습 영향평가 자체평가 보고서",
  "선행학습 영향평가 결과 보고서", "대학별고사 선행학습 영향평가".
- **Only official sources**: the university's own domain (`*.ac.kr`, the university's `.edu`, its
  admissions subdomain) or adiga.kr (대교협 대입정보포털). Never use blogs, cafes, 학원 sites or mirrors.
- If the university also publishes its interview questions in a separate official file (like
  서울대's 「면접 및 구술고사 문항」 or a 「면접 기출문제」 PDF on the 입학처 자료실), get that too.
- PDF only. If the only format is HWP/HWPX, skip it and say so in your report.

## 2. Download and extract text
```
cd <base>
curl -sS -L -A "Mozilla/5.0" --max-time 180 -o "pdf/<FILE>.pdf" "<url>"   # FILE = <YEAR>_<대학명>[_<suffix>]
head -c4 "pdf/<FILE>.pdf"     # must print %PDF (some sites need -e <referer> or a cookie jar: -c/-b jar.txt after visiting the post page)
pdftotext -raw "pdf/<FILE>.pdf" "txt/<FILE>.raw.txt"
pdftotext -layout "pdf/<FILE>.pdf" "txt/<FILE>.layout.txt"
pdftotext "pdf/<FILE>.pdf" "txt/<FILE>.plain.txt"
python3 tools/select_pages.py txt sel <FILE>          # writes sel/<FILE>.txt (interview-related pages)
```
`<FILE>` examples: `2026_서울교육대학교`, `2025_서울교육대학교`, `2026_계명대학교_면접문항`.
If `sel/<FILE>.txt` misses interview pages (e.g. a booklet that is all questions), read txt/ directly.
If the PDF is image-only (pdftotext returns almost nothing), skip it and report that.

Write one source row per downloaded file to `sources_extra/<FILE>.tsv` (single line, tab-separated, no header):
```
<YEAR>\t<FILE>\t<canonical university name>\t<official URL you downloaded from, or the official board post URL if the download link needs a session>\t<document title as published>
```

## 3. Extract the interview questions
Follow `tools/INSTRUCTIONS.md` exactly (same JSON shape, verbatim-only rule, and mandatory
`python3 tools/verify.py out/<FILE>.json` until it prints OK). Write `out/<FILE>.json` for every
downloaded file, even if it contains zero questions.

## Final reply
One short table: university | files (FILE names) | official URL | #interviews | #questions | verify | notes
(e.g. "only HWP published", "report not found on official site", "questions not published").
Do not modify anything outside pdf/, txt/, sel/, out/, sources_extra/.
