import raw from "@/data/admissions.json";

/** 입시결과 한 줄 (값은 출처에 인쇄된 그대로의 문자열) */
interface RawRow {
  u: number; // universities index
  y: number; // 결과 학년도
  t: number; // types index
  p: number; // periods index
  a: number; // admissions index (-1: 없음)
  n: number; // units index
  r: string | null; // 모집인원
  c: string | null; // 경쟁률
  w: string | null; // 충원인원
  g?: (string | null)[]; // 환산등급 50/70/80/90/100% cut
  s?: (string | null)[]; // 환산점수 50/70/80/90/100% cut
  st?: string | null; // 환산점수 총점
  x?: number; // 미제출 사유 index
  f?: number; // files index (대학 추가안내자료에서 옮긴 줄)
  ref?: string; // 파일 안 위치
  m?: Record<string, string>; // 85/95/avg/min/max 등 추가 지표
  k?: number; // captions index: 파일에 적힌 지표 이름·기준 (예: "학생부 등급(90%) · 최종등록자")
}

interface RawData {
  universities: { code: string; name: string; campus: string | null; adigaName: string }[];
  types: string[];
  cuts: string[];
  admissions: string[];
  captions: string[];
  periods: string[];
  units: string[];
  withheld: string[];
  // 어디가 추가안내자료(fileId/fileSn) 또는 대학 입학처 문서(url)
  files: { id: string; year: number | null; u: number; name: string; fileId?: string; fileSn?: string; url?: string; page?: string | null }[];
  rows: RawRow[];
}

const data = raw as RawData;

export interface AdmissionRow {
  key: string;
  university: string; // 표시 이름 (캠퍼스 포함)
  universityName: string; // 앱의 대학 이름과 맞춘 이름
  code: string;
  year: number;
  type: string;
  period: string;
  admission: string;
  unit: string;
  recruit: string | null;
  competition: string | null;
  waitlist: string | null;
  grade: (string | null)[] | null; // 50/70/80/90/100
  score: (string | null)[] | null;
  scoreTotal: string | null;
  withheld: string | null;
  extra: Record<string, string> | null;
  caption: string | null;
  source: { kind: "adiga" } | { kind: "file"; site: boolean; name: string; ref: string; url: string };
}

export const CUTS = data.cuts; // ["50","70","80","90","100"]
export const ADMISSION_TYPES = data.types.filter((t) => t !== "기타");

function displayName(u: RawData["universities"][number]) {
  return u.campus ? `${u.name} (${u.campus})` : u.name;
}

export function fileUrl(f: RawData["files"][number]) {
  return f.url ?? `https://www.adiga.kr/cmm/com/file/fileDown.do?fileId=${f.fileId}&fileSn=${f.fileSn}`;
}

export const admissionRows: AdmissionRow[] = data.rows.map((r, i) => {
  const u = data.universities[r.u];
  const file = r.f != null ? data.files[r.f] : null;
  return {
    key: `${i}`,
    university: displayName(u),
    universityName: u.name,
    code: u.code,
    year: r.y,
    type: data.types[r.t] ?? "기타",
    period: data.periods[r.p] ?? "",
    admission: r.a >= 0 ? data.admissions[r.a] : "",
    unit: data.units[r.n] ?? "",
    recruit: r.r,
    competition: r.c,
    waitlist: r.w,
    grade: r.g ?? null,
    score: r.s ?? null,
    scoreTotal: r.st ?? null,
    withheld: r.x != null ? data.withheld[r.x] : null,
    extra: r.m ?? null,
    caption: r.k != null && r.k >= 0 ? data.captions[r.k] : null,
    source: file ? { kind: "file", site: Boolean(file.url), name: file.name, ref: r.ref ?? "", url: fileUrl(file) } : { kind: "adiga" },
  };
});

export const admissionYears = [...new Set(admissionRows.map((r) => r.year))].sort((a, b) => b - a);

export interface AdmissionUniversity {
  key: string; // 표시 이름
  name: string;
  rows: number;
  withGrade: number;
  with90: number;
  fromFiles: number;
}

export const admissionUniversities: AdmissionUniversity[] = (() => {
  const map = new Map<string, AdmissionUniversity>();
  for (const r of admissionRows) {
    let u = map.get(r.university);
    if (!u) {
      u = { key: r.university, name: r.universityName, rows: 0, withGrade: 0, with90: 0, fromFiles: 0 };
      map.set(r.university, u);
    }
    u.rows++;
    if (r.grade?.some(Boolean) || r.extra) u.withGrade++;
    if (r.grade?.[3]) u.with90++;
    if (r.source.kind === "file") u.fromFiles++;
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key, "ko"));
})();

export interface AdmissionFilter {
  university?: string;
  year?: number;
  type?: string;
  q?: string;
  only90?: boolean;
}

export function parseAdmissionFilter(sp: Record<string, string | string[] | undefined>): AdmissionFilter {
  const one = (k: string) => {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    return s && s.trim() ? s.trim() : undefined;
  };
  const year = Number(one("year"));
  return {
    university: one("university"),
    year: Number.isFinite(year) && year > 0 ? year : undefined,
    type: one("type"),
    q: one("q"),
    only90: one("only90") === "1",
  };
}

export function filterAdmissions(f: AdmissionFilter): AdmissionRow[] {
  const terms = f.q?.toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  return admissionRows.filter((r) => {
    if (f.university && r.university !== f.university && r.universityName !== f.university) return false;
    if (f.year && r.year !== f.year) return false;
    if (f.type && r.type !== f.type) return false;
    if (f.only90 && !r.grade?.[3]) return false;
    if (terms.length) {
      const hay = `${r.university} ${r.admission} ${r.unit}`.toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

export function admissionsFor(universityName: string) {
  return admissionRows.filter((r) => r.universityName === universityName);
}
