import questionsJson from "@/data/questions.json";
import interviewsJson from "@/data/interviews.json";
import sourcesJson from "@/data/sources.json";
import {
  FORMATS,
  type InterviewFormat,
  type InterviewInfo,
  type Question,
  type SourceDoc,
  type UniversitySummary,
} from "./types";

export const questions = questionsJson as Question[];
export const interviews = interviewsJson as InterviewInfo[];
export const sources = sourcesJson as SourceDoc[];

const sourceMap = new Map(sources.map((s) => [s.id, s]));
const questionMap = new Map(questions.map((q) => [q.id, q]));

export function getSource(id: string): SourceDoc | undefined {
  return sourceMap.get(id);
}

export function getQuestion(id: string): Question | undefined {
  return questionMap.get(id);
}

export const universities: UniversitySummary[] = (() => {
  const byName = new Map<string, UniversitySummary>();
  const get = (name: string) => {
    let u = byName.get(name);
    if (!u) {
      u = { name, questionCount: 0, formats: {}, years: [], interviewCount: 0 };
      byName.set(name, u);
    }
    return u;
  };
  for (const q of questions) {
    const u = get(q.university);
    u.questionCount++;
    u.formats[q.format] = (u.formats[q.format] ?? 0) + 1;
    for (const y of q.years) if (!u.years.includes(y)) u.years.push(y);
  }
  for (const iv of interviews) {
    const u = get(iv.university);
    u.interviewCount++;
    if (!u.years.includes(iv.year)) u.years.push(iv.year);
  }
  for (const u of byName.values()) u.years.sort((a, b) => b - a);
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
})();

export const competencies: string[] = (() => {
  const counts = new Map<string, number>();
  for (const q of questions) if (q.competency) counts.set(q.competency, (counts.get(q.competency) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);
})();

export const years: number[] = [...new Set(sources.map((s) => s.year))].sort((a, b) => b - a);

export interface QuestionFilter {
  university?: string;
  format?: InterviewFormat;
  competency?: string;
  year?: number;
  q?: string;
  hasAnswer?: boolean;
}

export function parseFilter(sp: Record<string, string | string[] | undefined>): QuestionFilter {
  const one = (k: string) => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() ? s.trim() : undefined;
  };
  const format = one("format");
  const year = Number(one("year"));
  return {
    university: one("university"),
    format: FORMATS.includes(format as InterviewFormat) ? (format as InterviewFormat) : undefined,
    competency: one("competency"),
    year: Number.isFinite(year) && year > 0 ? year : undefined,
    q: one("q"),
    hasAnswer: one("answer") === "1",
  };
}

export function filterQuestions(f: QuestionFilter): Question[] {
  const terms = f.q?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  return questions.filter((q) => {
    if (f.university && q.university !== f.university) return false;
    if (f.format && q.format !== f.format) return false;
    if (f.competency && q.competency !== f.competency) return false;
    if (f.year && !q.years.includes(f.year)) return false;
    if (f.hasAnswer && !q.sampleAnswer) return false;
    if (terms.length) {
      const hay = [q.university, q.admission, q.unit, q.competency, q.passage, ...q.prompts]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

/** PDF 링크면 해당 쪽으로 바로 열리도록 #page를 붙인다 */
export function sourceUrl(doc: SourceDoc, page: number): string {
  return /\.pdf$/i.test(doc.url) && page > 0 ? `${doc.url}#page=${page}` : doc.url;
}

export function citation(q: Question): { label: string; url: string | null }[] {
  return q.sources.map((ref) => {
    const doc = sourceMap.get(ref.doc);
    return {
      label: doc ? `${doc.title} ${ref.page}쪽` : `${ref.doc} ${ref.page}쪽`,
      url: doc ? sourceUrl(doc, ref.page) : null,
    };
  });
}
