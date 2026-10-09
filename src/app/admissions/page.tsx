import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AdmissionTable from "@/components/AdmissionTable";
import {
  ADMISSION_TYPES,
  admissionUniversities,
  admissionYears,
  filterAdmissions,
  parseAdmissionFilter,
} from "@/lib/admissions";

export const metadata: Metadata = { title: "입시결과 | 수시 면접 연습실" };

const PAGE_SIZE = 200;

export default function AdmissionsPage({ searchParams }: PageProps<"/admissions">) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">수시 입시결과</h1>
        <p className="mt-1 text-sm text-muted">
          대학이 공개한 최종등록자 기준 학생부 환산등급 컷입니다. 50%·70% 컷은 대교협 「대입정보포털 어디가」 표준 공개
          자료(필수 공개)이고, 80%·90%·100% 컷은 대학이 선택해 공개했거나 대학 추가안내자료에 실린 값만 넣었습니다.
          공개되지 않은 칸은 비워 둡니다.
        </p>
      </div>
      <Suspense fallback={<div className="card h-40 animate-pulse" />}>
        <Results searchParams={searchParams} />
      </Suspense>
      <div className="card space-y-1 p-4 text-xs leading-relaxed text-muted">
        <p>· 50% 컷: 최종등록자 중 학생부 교과성적 순으로 상위 50%에 해당하는 성적(100명 중 50등). 서류·종합 순위가 아닙니다.</p>
        <p>· 대학별로 반영 교과·산출 방식이 달라 대학 간 수치를 그대로 비교할 수 없습니다.</p>
        <p>· 모집인원 3명 이하 모집단위 등은 대학이 공개하지 않아 사유만 표시합니다.</p>
      </div>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/admissions">["searchParams"] }) {
  const sp = await searchParams;
  const f = parseAdmissionFilter(sp);
  const hasQuery = Boolean(f.university || f.q || f.only90);
  const rows = hasQuery ? filterAdmissions(f) : [];
  const pageRaw = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Number.isFinite(pageRaw) ? Math.min(Math.max(1, Math.floor(pageRaw)), pageCount) : 1;
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (k !== "page" && typeof v === "string" && v) params.set(k, v);
    if (p > 1) params.set("page", String(p));
    return `/admissions?${params.toString()}`;
  };

  return (
    <>
      <form action="/admissions" className="card grid gap-3 p-4 sm:grid-cols-6">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-muted">대학</span>
          <select name="university" defaultValue={f.university ?? ""} className="input">
            <option value="">대학 선택</option>
            {admissionUniversities.map((u) => (
              <option key={u.key} value={u.key}>
                {u.key}
                {u.with90 ? " · 90%컷" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted">결과 학년도</span>
          <select name="year" defaultValue={f.year ? String(f.year) : ""} className="input">
            <option value="">전체</option>
            {admissionYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted">전형 유형</span>
          <select name="type" defaultValue={f.type ?? ""} className="input">
            <option value="">전체</option>
            {ADMISSION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-muted">모집단위·전형 키워드</span>
          <input name="q" defaultValue={f.q ?? ""} placeholder="예: 간호, 지역균형" className="input" />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-4">
          <input type="checkbox" name="only90" value="1" defaultChecked={f.only90} />
          90% 컷이 공개된 결과만
        </label>
        <div className="flex gap-2 sm:col-span-2 sm:justify-end">
          <Link href="/admissions" className="btn">
            초기화
          </Link>
          <button type="submit" className="btn btn-primary">
            검색
          </button>
        </div>
      </form>

      {!hasQuery ? (
        <section className="space-y-2">
          <p className="text-sm text-muted">
            {admissionUniversities.length}개 대학(캠퍼스 포함). 대학을 고르거나 모집단위를 검색하세요.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {admissionUniversities.map((u) => (
              <Link
                key={u.key}
                href={`/admissions?university=${encodeURIComponent(u.key)}`}
                className="card flex items-baseline justify-between gap-2 p-3 hover:border-accent"
              >
                <span className="font-semibold">{u.key}</span>
                <span className="shrink-0 text-xs text-muted">
                  {u.withGrade.toLocaleString()}행{u.with90 ? ` · 90% ${u.with90}` : ""}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center text-muted">조건에 맞는 입시결과가 없습니다.</div>
      ) : (
        <>
          <p className="text-sm text-muted">
            {rows.length.toLocaleString()}개 결과 · {page}/{pageCount}쪽
          </p>
          <AdmissionTable rows={shown} showUniversity={!f.university} />
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
      )}
    </>
  );
}
