import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import QuestionCard from "@/components/QuestionCard";
import { competencies, filterQuestions, parseFilter, universities, years } from "@/lib/data";
import { FORMATS } from "@/lib/types";

export const metadata: Metadata = { title: "기출 문항 | 수시 면접 연습실" };

const PAGE_SIZE = 20;

export default function QuestionsPage({ searchParams }: PageProps<"/questions">) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">기출 문항</h1>
        <p className="mt-1 text-sm text-muted">
          대학이 공개한 면접 문항(기출 문항, 예시 문항, 사전 공개 문항)을 원문 그대로 보여 줍니다. 문항마다 출처
          문서 이름과 쪽수가 있으니 어떤 성격의 자료인지 확인하세요.
        </p>
      </div>
      <Suspense fallback={<div className="card h-40 animate-pulse" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/questions">["searchParams"] }) {
  const sp = await searchParams;
  const filter = parseFilter(sp);
  const all = filterQuestions(filter);
  const pageRaw = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const page = Number.isFinite(pageRaw) ? Math.min(Math.max(1, Math.floor(pageRaw)), pageCount) : 1;
  const items = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k !== "page" && typeof v === "string" && v) params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/questions?${s}` : "/questions";
  };

  return (
    <>
      <form action="/questions" className="card grid gap-3 p-4 sm:grid-cols-6">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-muted">대학</span>
          <select name="university" defaultValue={filter.university ?? ""} className="input">
            <option value="">전체 대학</option>
            {universities.map((u) => (
              <option key={u.name} value={u.name}>
                {u.name} ({u.questionCount})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted">면접 유형</span>
          <select name="format" defaultValue={filter.format ?? ""} className="input">
            <option value="">전체</option>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted">평가요소</span>
          <select name="competency" defaultValue={filter.competency ?? ""} className="input">
            <option value="">전체</option>
            {competencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted">학년도</span>
          <select name="year" defaultValue={filter.year ? String(filter.year) : ""} className="input">
            <option value="">전체</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted">키워드</span>
          <input name="q" defaultValue={filter.q ?? ""} placeholder="예: 의예과, 갈등" className="input" />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-4">
          <input type="checkbox" name="answer" value="1" defaultChecked={filter.hasAnswer} />
          대학 공개 예시 답안이 있는 문항만
        </label>
        <div className="flex gap-2 sm:col-span-2 sm:justify-end">
          <Link href="/questions" className="btn">
            초기화
          </Link>
          <button type="submit" className="btn btn-primary">
            검색
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {all.length.toLocaleString()}개 문항 · {page}/{pageCount}쪽
        </span>
        {all.length > 0 && (
          <Link href={practiceHref(filter)} className="font-semibold text-accent">
            이 조건으로 모의 면접 →
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center text-muted">조건에 맞는 문항이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {items.map((q) => (
            <QuestionCard key={q.id} q={q} />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-2">
          {page > 1 && (
            <Link href={hrefFor(page - 1)} className="btn">
              ← 이전
            </Link>
          )}
          <span className="px-2 text-sm text-muted">
            {page} / {pageCount}
          </span>
          {page < pageCount && (
            <Link href={hrefFor(page + 1)} className="btn">
              다음 →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

function practiceHref(f: ReturnType<typeof parseFilter>) {
  const p = new URLSearchParams();
  if (f.university) p.set("university", f.university);
  if (f.format) p.set("format", f.format);
  if (f.competency) p.set("competency", f.competency);
  const s = p.toString();
  return s ? `/practice?${s}` : "/practice";
}
