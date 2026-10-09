import { citation } from "@/lib/data";
import type { Question } from "@/lib/types";
import QuestionActions from "./QuestionActions";

export default function QuestionCard({ q, showUniversity = true }: { q: Question; showUniversity?: boolean }) {
  const cites = citation(q);
  const oral = q.prompts.length === 0;
  return (
    <article className="card space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {showUniversity && <span className="font-bold text-foreground">{q.university}</span>}
        <span className="chip">{q.format}</span>
        {q.competency && <span className="chip chip-muted">{q.competency}</span>}
        {q.admission && <span className="chip chip-muted">{q.admission}</span>}
        {q.unit && <span className="chip chip-muted">{q.unit}</span>}
        <span className="text-muted">{q.years.join("·")}학년도</span>
      </div>

      {q.passage && oral && (
        <div className="rounded-lg border border-border p-3 text-sm">
          <div className="mb-2 font-semibold">제시문</div>
          <p className="prose-ko max-h-80 overflow-y-auto text-[0.9375rem]">{q.passage}</p>
        </div>
      )}
      {q.passage && !oral && (
        <details className="rounded-lg border border-border p-3 text-sm">
          <summary className="cursor-pointer font-semibold">제시문 보기</summary>
          <p className="prose-ko mt-2 text-[0.9375rem]">{q.passage}</p>
        </details>
      )}
      {oral && (
        <p className="text-sm text-muted">
          질문은 면접 현장에서 면접관이 구두로 제시했으며, 대학이 질문 문장은 공개하지 않았습니다.
        </p>
      )}

      <ol className="space-y-2">
        {q.prompts.map((p, i) => (
          <li key={i} className="flex gap-2 leading-relaxed">
            {q.prompts.length > 1 && <span className="font-bold text-accent">{i + 1}.</span>}
            <span className="prose-ko font-medium">{p}</span>
          </li>
        ))}
      </ol>

      {(q.intent || q.sampleAnswer) && (
        <div className="space-y-2 text-sm">
          {q.intent && (
            <details className="rounded-lg bg-background p-3">
              <summary className="cursor-pointer font-semibold">출제 의도·해설 (대학 공개)</summary>
              <p className="prose-ko mt-2 text-muted">{q.intent}</p>
            </details>
          )}
          {q.sampleAnswer && (
            <details className="rounded-lg bg-background p-3">
              <summary className="cursor-pointer font-semibold">예시 답안 (대학 공개)</summary>
              <p className="prose-ko mt-2 text-muted">{q.sampleAnswer}</p>
            </details>
          )}
        </div>
      )}

      <QuestionActions id={q.id} question={oral ? `[제시문] ${q.passage?.slice(0, 80) ?? ""}…` : q.prompts.join("\n")} />

      <div className="border-t border-border pt-2 text-xs text-muted">
        출처:{" "}
        {cites.map((c, i) => (
          <span key={i}>
            {i > 0 && " · "}
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">
                {c.label}
              </a>
            ) : (
              c.label
            )}
          </span>
        ))}
      </div>
    </article>
  );
}
