export const FORMATS = ["서류기반", "제시문기반", "MMI", "인성"] as const;
export type InterviewFormat = (typeof FORMATS)[number];

/** 대학이 공개한 원문 문서(선행학습 영향평가 자체평가 보고서) */
export interface SourceDoc {
  id: string; // e.g. "2026_동덕여자대학교"
  university: string;
  year: number; // 학년도
  title: string;
  url: string;
}

/** 질문이 공개되지 않은(구두로 제시된) 제시문 문항을 연습할 때 보여 줄 안내 — 원문이 아닌 앱 안내 문구 */
export const ORAL_PROMPT =
  "제시문을 읽고 핵심 내용과 쟁점, 자신의 생각을 말해 보세요. (실제 면접에서는 면접관이 구두로 질문하며, 대학이 질문은 공개하지 않았습니다)";

export interface SourceRef {
  doc: string; // SourceDoc.id
  page: number;
}

/** 공개 보고서에서 원문 그대로 옮긴 면접 문항 */
export interface Question {
  id: string;
  university: string;
  years: number[];
  admission: string | null; // 전형명
  unit: string | null; // 모집단위/계열
  format: InterviewFormat;
  competency: string | null; // 평가요소
  passage: string | null; // 제시문
  prompts: string[]; // 질문 (비어 있으면 제시문만 공개되고 질문은 현장에서 구두로 제시된 문항)
  intent: string | null; // 출제 의도
  sampleAnswer: string | null; // 대학이 공개한 예시 답안
  sources: SourceRef[];
}

/** 전형별 면접 운영 방식 */
export interface InterviewInfo {
  university: string;
  year: number;
  admission: string | null;
  units: string | null;
  format: InterviewFormat | null;
  method: string | null;
  duration: string | null;
  criteria: { name: string; weight: string | null }[];
  source: SourceRef;
}

export interface UniversitySummary {
  name: string;
  questionCount: number;
  formats: Partial<Record<InterviewFormat, number>>;
  years: number[];
  interviewCount: number;
}
