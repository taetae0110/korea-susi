# 수시 면접 연습실

대학이 **직접 공개한 실제 면접 문항**으로 수시 면접을 준비하는 웹앱입니다.

- **기출 문항** — 대학·면접 유형(서류기반/제시문기반/MMI/인성)·평가요소·학년도·키워드로 검색하고, 대학이 공개한 출제 의도와 예시 답안을 함께 봅니다. 모든 문항에 출처 문서와 쪽수가 붙어 있습니다.
- **대학별 면접** — 전형별 진행 방법, 면접 시간, 평가요소와 반영 비율.
- **모의 면접** — 기출 문항(무작위·조건별·직접 담은 문항)이나 내 예상 질문으로 제한 시간을 두고 연습합니다. 질문 음성 읽기(TTS), 말로 답하기(음성 인식), 제시문 준비 시간을 지원하고, 끝나면 답변마다 AI 피드백(항목별 점수, 잘한 점·고칠 점, 다듬은 답변, 꼬리 질문)을 받습니다.
- **생기부 예상 질문** — 내 학교생활기록부 내용을 붙여넣으면 근거 문장을 원문 그대로 인용한 예상 질문을 만들고, 인용이 실제 생기부 문장과 일치하는지 표시합니다.
- **내 노트** — 작성한 답변, 연습 기록, 예상 질문을 모아 보고 텍스트로 내보냅니다. 사용자 데이터는 브라우저(localStorage)에만 저장됩니다.

## 데이터 출처

예시·가상 데이터는 넣지 않았습니다. 모든 문항은 대학이 공개한 아래 문서에서 원문 그대로 옮겼습니다.
현재 105개 대학, 문항 4,366개, 전형별 면접 방식 729건, 문서 270건입니다.

1. **선행학습 영향평가 자체평가 보고서** (주로 2025·2026학년도). 대학별고사를 치르는 대학은 「공교육 정상화 촉진 및 선행교육 규제에 관한 특별법」 제10조에 따라 이 보고서를 매년 공개합니다. 보고서에는 실제 출제한 면접 문항과 출제 의도, 예시 답안이 실려 있습니다.
   - 154건은 여러 대학의 보고서를 모아 둔 공개 사본(`cdn013.negagea.net`)에서 받았습니다.
   - 나머지는 각 대학 입학처(`*.ac.kr`, `handong.edu`)에서 직접 받았습니다.
2. **대학 입학처가 따로 공개한 면접 문항**
   - 서울대: 2023~2026 「면접 및 구술고사 문항」, 「적성·인성면접 문항」, 2028 「면접 예시 문항」
   - KAIST: 수시 면접 기출문제
   - 교육대학교(서울·부산·광주·대구·진주·공주): 면접 기출 문항
   - 대구가톨릭대: 의예 MMI 기출, 학종 기출, 사전 공개 예상문제·공통인성 문제
   - 그 밖에 조선대·건양대·고신대·인제대 등의 면접 기출·공개 문항

문서마다 이름과 링크가 [`data/sources.tsv`](data/sources.tsv)에 있고, 앱의 문항마다 출처 문서와 쪽수가 표시됩니다.
어떤 대학은 문항을 공개하지 않습니다(예: 숙명여대, 청주교대 수시). 이런 대학은 면접 방식 정보만 있습니다.
질문을 구두로만 하고 제시문만 공개한 경우(예: 서울대 의대 MMI)에는 제시문만 싣고 "질문 미공개"로 표시합니다.

### 원문 대조 검증

문항은 PDF에서 텍스트를 뽑아 옮긴 뒤, [`scripts/pipeline/verify.py`](scripts/pipeline/verify.py)로 **질문·제시문·출제 의도·예시 답안의 모든 문장이 원문 텍스트에 그대로 있는지** 대조했습니다(공백·줄바꿈만 무시). 하나라도 일치하지 않는 파일은 앱 데이터에 들어가지 않습니다. 그림·표·수식처럼 텍스트로 추출되지 않는 부분은 `[그림]`, `[표]`, `[수식]`으로 표시했습니다.

파이프라인:

```
scripts/pipeline/probe.sh, dl.sh      # 보고서 PDF 위치 확인·다운로드 (대학 공식 사이트 자료는 INSTRUCTIONS_FETCH.md 절차)
pdftotext -raw / -layout / (기본)       # 세 가지 읽기 순서로 텍스트 추출
scripts/pipeline/select_pages.py      # 면접 관련 쪽 추리기
scripts/pipeline/INSTRUCTIONS.md      # 문항 추출 규칙 (원문 그대로)
scripts/pipeline/collect.py WORK_DIR  # verify.py를 통과한 추출 파일만 data/extracted/로 복사
npm run data:build                    # data/extracted → src/data/*.json (중복 문항은 학년도·출처를 합침)
```

## 입시결과 (등급 컷)

**입시결과** 메뉴는 대학이 공식 공개한 수시 입시결과(모집인원·경쟁률·충원·학생부 등급 컷)를 인쇄된 값 그대로 보여 줍니다.
추정·보간한 값은 없고, 공개되지 않은 칸은 비워 두거나 대학이 적은 비공개 사유를 표시합니다.

1. **대교협 「대입정보포털 어디가」 전년도 결과공개** — 모든 대학이 같은 양식으로 내는 자료입니다. 학생부 환산등급
   50%·70% 컷은 필수 공개이고 80%·90%·100% 컷은 대학이 고를 때만 실립니다(그래서 90% 컷은 일부 대학에만 있습니다).
   [`scripts/admissions/scrape_adiga.py`](scripts/admissions/scrape_adiga.py)로 2026·2025학년도 결과를 받아
   [`data/admissions/adiga.json`](data/admissions/adiga.json)에 그대로 담았습니다.
2. **대학이 어디가에 올린 「추가안내자료」 파일** — 90% 컷, 평균·최고·최저 등급, 어디가에서 비공개로 처리된 소수 인원
   모집단위의 결과가 여기에 있는 경우가 많습니다(예: 가천대 90% 컷, 건양대·상명대 최고·평균·최저, 경희대 합격자 평균).
   - 파일을 텍스트로 옮긴 뒤([`dump_file.py`](scripts/admissions/dump_file.py)) 규칙([`EXTRACT.md`](scripts/admissions/EXTRACT.md))대로
     값을 옮기고, [`verify_extra.py`](scripts/admissions/verify_extra.py)로 **모든 값이 그 행·그 열의 칸과 같은지,
     열 머리글이 맞는 지표(예: 90%)인지** 대조했습니다.
   - 검증기가 볼 수 없는 뜻(정말 학생부 등급인지, 최종등록자 기준인지, 학년도·전형·캠퍼스가 맞는지)은 별도 검토를 거친
     파일만 넣었습니다. 여러 학과를 묶은 통합 행처럼 한 학과로 표시하면 오해가 생기는 행은 뺐습니다.
   - 화면에는 파일에 적힌 지표 이름·기준(예: "학생부 등급(90%) · 최종등록자", "평균 · 합격자")을 함께 표시합니다.
   - 어디가와 같은 50%·70% 컷만 되풀이하는 행은 중복이라 넣지 않습니다.
   - 문서마다 주소와 sha256이 [`data/admissions/sources.tsv`](data/admissions/sources.tsv)에 있습니다.

```
python3 scripts/admissions/scrape_adiga.py WORK 2026 2025   # 어디가 결과 + 추가안내자료 파일
python3 scripts/admissions/normalize_adiga.py WORK            # → data/admissions/adiga.json
python3 -I scripts/admissions/dump_file.py FILE WORK/dump/ID.txt
python3 scripts/admissions/adiga_tsv.py WORK                   # 파일과 비교할 어디가 행
python3 -I scripts/admissions/verify_extra.py WORK/dump WORK/extra/ID.json
python3 -I scripts/admissions/collect_extra.py WORK ID ...     # 검토를 통과한 것만 data/admissions/extra/로
npm run data:admissions                                        # → src/data/admissions.json
```

## 바로 써 보기 (Artifact 버전)

`artifact/index.html`은 같은 검증 데이터(`src/data/*.json`)를 읽는 단일 페이지 버전입니다. claude.ai Artifact로
게시하면 서버나 API 키 없이 열 수 있고, AI 피드백·예상 질문은 보는 사람의 Claude 계정으로 동작합니다(`sample` 기능).
이 버전은 글로만 답할 수 있고(마이크 사용 불가), 질문 읽어 주기는 됩니다.

## 실행

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY 입력 (AI 기능용, 없어도 나머지 기능은 동작)
npm run dev
```

AI 기능(답변 피드백, 예상 질문 생성)은 Claude API(`claude-opus-5-5`)를 서버에서 호출합니다. 키가 없으면 해당 기능만 "설정되지 않았습니다" 안내를 보여 줍니다. 공개 배포 시에는 API 사용량이 키 소유자에게 청구되므로 접근 제한이나 사용량 한도를 함께 설정하세요.

```bash
npm run lint
npm run typecheck
npm run build
```
