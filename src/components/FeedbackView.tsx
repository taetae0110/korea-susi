import type { Feedback } from "@/lib/storage";

export default function FeedbackView({ fb }: { fb: Feedback }) {
  const avg = fb.scores.length ? fb.scores.reduce((s, x) => s + x.score, 0) / fb.scores.length : 0;
  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-4 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">{fb.overall}</p>
        <span className="shrink-0 text-lg font-extrabold text-accent">{avg.toFixed(1)} / 5</span>
      </div>
      <ul className="space-y-1.5">
        {fb.scores.map((s, i) => (
          <li key={i} className="grid grid-cols-[7.5rem_3rem_1fr] gap-2">
            <span className="font-semibold">{s.criterion}</span>
            <span className={s.score >= 4 ? "text-good" : s.score <= 2 ? "text-bad" : "text-warn"}>
              {"●".repeat(Math.max(0, Math.min(5, s.score)))}
              <span className="text-border">{"●".repeat(Math.max(0, 5 - s.score))}</span>
            </span>
            <span className="text-muted">{s.comment}</span>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 font-semibold text-good">잘한 점</div>
          <ul className="list-inside list-disc space-y-1 text-muted">
            {fb.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 font-semibold text-warn">고칠 점</div>
          <ul className="list-inside list-disc space-y-1 text-muted">
            {fb.improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
      <details>
        <summary className="cursor-pointer font-semibold">다듬은 답변 보기</summary>
        <p className="prose-ko mt-2 text-muted">{fb.improvedAnswer}</p>
      </details>
      {fb.followUps.length > 0 && (
        <div>
          <div className="mb-1 font-semibold">예상 꼬리 질문</div>
          <ul className="list-inside list-decimal space-y-1 text-muted">
            {fb.followUps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
