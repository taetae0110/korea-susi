# 면접 기출문항 추출 지침 (verbatim extraction)

Base dir: `/tmp/claude-0/-home-user-korea-susi/8412b1b4-e757-52af-af3f-d876e60c46e8/scratchpad`

You are extracting REAL Korean university admission interview (면접/구술) questions from official
"선행학습 영향평가 자체평가 보고서" documents that universities are legally required to publish.
The data will be shown to students in an interview-practice web app. **The user forbids any demo,
sample, invented, or paraphrased data. Every string you output must be copied verbatim from the
source.** A verifier enforces this; anything that fails it will be thrown away.

## Inputs (per source file `<FILE>`, e.g. `2026_동덕여자대학교`)
- `sel/<FILE>.txt` — the pages of the report that mention 면접/구술, with `=== PAGE n ===` markers
  (n = PDF page number). Start here.
- `txt/<FILE>.raw.txt` — the full report text (pages separated by form-feed). Use it when a
  question/제시문/예시답안 continues onto a page that isn't in `sel/`.
- `txt/<FILE>.layout.txt` — same text with layout preserved; helpful to understand tables.

## Output
Write `out/<FILE>.json` (one per source file, even if it has zero questions) with this shape:

```json
{
  "source": {"university": "<canonical name given in your task>", "year": 2026, "file": "<FILE>"},
  "interviews": [
    {
      "admission": "동덕창의리더전형",
      "units": "전 모집단위",
      "format": "서류기반",
      "method": "평가위원 2인 / 개별면접",
      "duration": "10분 내외",
      "criteria": [{"name": "학업역량", "weight": "35"}, {"name": "진로역량", "weight": "40"}],
      "page": 16
    }
  ],
  "questions": [
    {
      "admission": "동덕창의리더전형",
      "unit": null,
      "format": "서류기반",
      "competency": "학업역량",
      "passage": null,
      "prompts": ["○○○활동을 계획하면서 가장 중점을 두고 준비한 부분은 무엇인가요? 예상된 어려움은 무엇이었으며, 그것을 해결하기 위해 어떤 준비를 했나요?"],
      "intent": null,
      "sample_answer": null,
      "page": 16
    }
  ]
}
```

Field rules:
- `year`: the 학년도 of the report (from the file name).
- `interviews`: one entry per 전형 (or 전형+모집단위 group) whose interview operation is described
  (진행방법, 면접시간, 출제방식, 평가요소/비율). Only fill a field if the report states it; else `null`/`[]`.
  `admission`, `method`, `duration` must be copied verbatim. `units` = 모집단위/계열 as written.
- `questions`: one entry per interview question **or** per 문항 set (one 제시문 with several 질문).
  - `prompts`: the question sentence(s), verbatim. Several 하위 질문 of one 제시문 → several strings in
    order. Join line-wrapped fragments (e.g. "어\n떤" → "어떤"); you may drop a leading bullet or
    number ("·", "-", "1)", "①", "[문항 1]"). Do NOT reword, shorten, merge, fix typos, or fill in "○○" placeholders.
  - If a 제시문 has NO printed question (the interviewer asks orally), still include it with
    `"prompts": []` and the verbatim `passage` (plus `intent` if printed). Never write a question yourself.
  - `passage`: the 제시문 text verbatim (for 제시문 기반 면접), else `null`. If part of a 제시문 is a
    figure/table/equation that did not survive text extraction, put the literal marker `[그림]`,
    `[표]`, `[그래프]` or `[수식]` in its place. Keep (가)/(나) labels as in source.
  - `intent`: the 출제 의도 text verbatim if the 문항카드 has one, else `null`.
  - `sample_answer`: the 예시 답안 / 모범 답안 text verbatim if present, else `null`.
    (Skip 채점 기준 tables.)
  - `competency`: the 평가요소/평가영역 label the source attaches to this question, verbatim
    (e.g. "학업역량", "진로역량", "공동체역량", "인성", "전공적합성", "기본소양"), else `null`.
  - `unit`: 모집단위/계열/학과 the question is for, as written (e.g. "의예과", "인문계열"), else `null`.
  - `admission`: 전형명 as written, else `null`.
  - `format` (your classification, one of):
    - `"서류기반"` — about the applicant's 학생부/제출서류, including template questions with ○○ placeholders
    - `"제시문기반"` — a 제시문/자료/문제 is given and the applicant answers about it (구술고사 included)
    - `"MMI"` — 의·치·한·약·수의·간호 등 다중미니면접, 상황(SI)/행동사건(BEI)/시뮬레이션 면접
    - `"인성"` — general attitude/values/소양 questions not tied to 서류 or a 제시문 (교대 인성면접 등)
  - `page`: PDF page number where the question starts.
- Include: every 면접/구술 question for 신입학 (수시 and 정시), including 예시 문항 in 평가요소 tables
  and full 문항카드 (면접 및 구술고사). Include questions that are written as concrete examples of
  real applicants' records (e.g. "~를 탐구했는데 …") — they are real published examples.
- Exclude: 논술고사, 선다형, 실기, 적성고사 문항; 편입학/대학원; evaluation-criteria text that is not
  a question; anything you cannot locate in the source text.

## Verify (mandatory)
After writing each file run:

    cd /tmp/claude-0/-home-user-korea-susi/8412b1b4-e757-52af-af3f-d876e60c46e8/scratchpad && python3 tools/verify.py out/<FILE>.json

It normalises whitespace and checks every sentence of every `prompts`/`passage`/`intent`/
`sample_answer` (and interview `admission`/`method`/`duration`) against `txt/<FILE>.raw.txt`.
Fix every `NOT FOUND` by re-copying the exact source text (common causes: you reworded, merged two
questions, dropped/added words, or the text came from a different column of a table). If something
truly cannot be matched (e.g. garbled extraction), delete that item. `fuzzy` lines are acceptable.
Repeat until the file prints `OK`.

## Final reply
Reply with ONE short table: file | #interviews | #questions | verify status | notes (e.g. "2025 report
is image-only", "제시문 has figures"). No other prose. Do not modify anything outside `out/`.
