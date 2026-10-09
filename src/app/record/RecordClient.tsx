"use client";

import Link from "next/link";
import { useState } from "react";
import { newId, useStored, type GeneratedQuestion } from "@/lib/storage";

interface ApiResult {
  questions?: Omit<GeneratedQuestion, "id" | "target" | "createdAt">[];
  error?: string;
}

export default function RecordClient({ universityNames }: { universityNames: string[] }) {
  const [profile, setProfile, hydrated] = useStored("profile");
  const [generated, setGenerated] = useStored("generated");
  const [draft, setDraft] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);
  const [count, setCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<GeneratedQuestion[]>([]);

  const record = draft ?? profile.record;
  const target = [profile.university, profile.major].filter(Boolean).join(" ");

  async function generate() {
    setError(null);
    setLoading(true);
    if (remember) setProfile((p) => ({ ...p, record }));
    try {
      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          record,
          university: profile.university || undefined,
          major: profile.major || undefined,
          count,
        }),
      });
      const data = (await res.json()) as ApiResult;
      if (!res.ok || !data.questions) throw new Error(data.error ?? "질문을 만들지 못했습니다.");
      const now = Date.now();
      const made = data.questions.map((q) => ({ ...q, id: newId(), target, createdAt: now }));
      setLatest(made);
      setGenerated((g) => [...made, ...g].slice(0, 200));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">지원 대학</span>
            <input
              className="input"
              list="univ-list"
              value={profile.university}
              onChange={(e) => setProfile((p) => ({ ...p, university: e.target.value }))}
              placeholder="선택 또는 입력"
            />
            <datalist id="univ-list">
              {universityNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">지원 학과</span>
            <input
              className="input"
              value={profile.major}
              onChange={(e) => setProfile((p) => ({ ...p, major: e.target.value }))}
              placeholder="예: 생명과학과"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">질문 수</span>
            <select className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[5, 8, 10, 15].map((n) => (
                <option key={n} value={n}>
                  {n}개
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">
            생활기록부 내용 (진로희망, 창의적 체험활동, 과목별 세부능력 및 특기사항, 행동특성 및 종합의견 등)
          </span>
          <textarea
            className="input min-h-72 text-sm leading-relaxed"
            value={hydrated ? record : ""}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="나이스(NEIS) 생활기록부 PDF나 학교에서 받은 사본의 내용을 복사해 붙여넣으세요."
          />
          <span className="mt-1 block text-right text-xs text-muted">{record.length.toLocaleString()} / 30,000자</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          이 브라우저에 생기부 내용 저장 (모의 면접 피드백에도 활용)
        </label>
        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
        <button
          type="button"
          className="btn btn-primary w-full py-3 text-base"
          disabled={loading || record.trim().length < 50 || record.length > 30000}
          onClick={generate}
        >
          {loading ? "생기부를 읽고 질문을 만드는 중… (최대 1~2분)" : "예상 질문 만들기"}
        </button>
      </section>

      {latest.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">새로 만든 질문 {latest.length}개</h2>
            <Link href="/practice" className="text-sm font-semibold text-accent">
              모의 면접에서 &lsquo;내 예상 질문&rsquo;으로 연습 →
            </Link>
          </div>
          {latest.map((q) => (
            <GeneratedCard key={q.id} q={q} />
          ))}
        </section>
      )}

      {generated.length > 0 && latest.length === 0 && (
        <p className="text-sm text-muted">
          지금까지 만든 예상 질문 {generated.length}개는{" "}
          <Link href="/notes" className="text-accent underline">
            내 노트
          </Link>
          에서 볼 수 있어요.
        </p>
      )}
    </div>
  );
}

export function GeneratedCard({ q, onDelete }: { q: GeneratedQuestion; onDelete?: () => void }) {
  return (
    <article className="card space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="chip">{q.competency}</span>
        <span className="chip chip-muted">AI 생성</span>
        {q.target && <span className="text-muted">{q.target}</span>}
        {onDelete && (
          <button type="button" className="ml-auto text-muted hover:text-bad" onClick={onDelete}>
            삭제
          </button>
        )}
      </div>
      <p className="text-base font-bold leading-relaxed">{q.question}</p>
      <blockquote className="border-l-2 border-accent pl-3 text-muted">
        <span className={`mr-1 text-xs font-semibold ${q.basisVerified ? "text-good" : "text-warn"}`}>
          {q.basisVerified ? "생기부 원문 확인" : "근거 문장 원문 불일치 — 직접 확인 필요"}
        </span>
        {q.basis}
      </blockquote>
      <p className="text-muted">
        <span className="font-semibold text-foreground">확인하려는 것: </span>
        {q.intent}
      </p>
      {q.followUps.length > 0 && (
        <ul className="list-inside list-disc text-muted">
          {q.followUps.map((f, i) => (
            <li key={i}>꼬리 질문: {f}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
