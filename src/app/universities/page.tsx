import type { Metadata } from "next";
import Link from "next/link";
import { sources, universities } from "@/lib/data";
import { FORMATS } from "@/lib/types";

export const metadata: Metadata = { title: "대학별 면접 | 수시 면접 연습실" };

export default function UniversitiesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">대학별 면접</h1>
        <p className="mt-1 text-sm text-muted">
          {universities.length}개 대학 · 출처 보고서 {sources.length}건. 대학을 누르면 전형별 면접 방식(진행 방법, 시간,
          평가요소)과 기출 문항을 볼 수 있습니다.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {universities.map((u) => (
          <Link
            key={u.name}
            href={`/universities/${encodeURIComponent(u.name)}`}
            className="card flex flex-col gap-2 p-4 hover:border-accent"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold">{u.name}</span>
              <span className="text-xs text-muted">{u.years.join("·")}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {FORMATS.filter((f) => u.formats[f]).map((f) => (
                <span key={f} className="chip">
                  {f} {u.formats[f]}
                </span>
              ))}
              {u.questionCount === 0 && <span className="chip chip-muted">문항 비공개 · 면접 방식만</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
