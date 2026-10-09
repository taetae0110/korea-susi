"use client";

import Link from "next/link";
import { useState } from "react";
import FeedbackView from "@/components/FeedbackView";
import { GeneratedCard } from "@/app/record/RecordClient";
import { useStored } from "@/lib/storage";

type Tab = "answers" | "sessions" | "generated";

export default function NotesClient() {
  const [answers, setAnswers, hydrated] = useStored("answers");
  const [sessions, setSessions] = useStored("sessions");
  const [generated, setGenerated] = useStored("generated");
  const [basket] = useStored("basket");
  const [tab, setTab] = useState<Tab>("answers");

  const answerList = Object.entries(answers).sort((a, b) => b[1].updatedAt - a[1].updatedAt);

  function exportText() {
    const lines: string[] = ["# 수시 면접 연습실 - 내 노트", ""];
    lines.push("## 내 답변", "");
    for (const [, a] of answerList) lines.push(`Q. ${a.question}`, `A. ${a.answer}`, "");
    lines.push("## 모의 면접 기록", "");
    for (const s of sessions) {
      lines.push(`### ${new Date(s.startedAt).toLocaleString("ko-KR")} ${s.target}`);
      for (const it of s.items) {
        lines.push(`Q. ${it.question}`, `A. ${it.answer || "(답변 없음)"} (${it.seconds}초)`);
        if (it.feedback) {
          lines.push(`- 총평: ${it.feedback.overall}`);
          for (const x of it.feedback.improvements) lines.push(`- 고칠 점: ${x}`);
          lines.push(`- 다듬은 답변: ${it.feedback.improvedAnswer}`);
        }
        lines.push("");
      }
    }
    lines.push("## 생기부 예상 질문 (AI 생성)", "");
    for (const g of generated) lines.push(`Q. ${g.question}`, `근거: ${g.basis}`, "");
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `면접노트_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!hydrated) return <div className="card h-40 animate-pulse" />;

  const tabs: { key: Tab; label: string; n: number }[] = [
    { key: "answers", label: "내 답변", n: answerList.length },
    { key: "sessions", label: "모의 면접 기록", n: sessions.length },
    { key: "generated", label: "예상 질문", n: generated.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                tab === t.key ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {t.label} {t.n}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm">
          {basket.length > 0 && (
            <Link href="/practice" className="text-accent">
              연습 목록 {basket.length}개 →
            </Link>
          )}
          <button type="button" className="btn" onClick={exportText}>
            텍스트로 내보내기
          </button>
        </div>
      </div>

      {tab === "answers" &&
        (answerList.length === 0 ? (
          <Empty>
            <Link href="/questions" className="text-accent underline">
              기출 문항
            </Link>
            에서 &lsquo;내 답변 쓰기&rsquo;로 답변을 정리해 보세요.
          </Empty>
        ) : (
          answerList.map(([id, a]) => (
            <article key={id} className="card space-y-2 p-4 text-sm">
              <p className="prose-ko font-bold">{a.question}</p>
              <p className="prose-ko text-muted">{a.answer}</p>
              <div className="flex gap-3 text-xs text-muted">
                <span>{new Date(a.updatedAt).toLocaleDateString("ko-KR")}</span>
                <Link href={`/practice?ids=${id}`} className="text-accent">
                  이 문항 연습
                </Link>
                <button
                  type="button"
                  className="hover:text-bad"
                  onClick={() =>
                    setAnswers((all) => {
                      const next = { ...all };
                      delete next[id];
                      return next;
                    })
                  }
                >
                  삭제
                </button>
              </div>
            </article>
          ))
        ))}

      {tab === "sessions" &&
        (sessions.length === 0 ? (
          <Empty>
            <Link href="/practice" className="text-accent underline">
              모의 면접
            </Link>
            을 마치면 기록이 여기에 쌓입니다.
          </Empty>
        ) : (
          sessions.map((s) => (
            <details key={s.id} className="card p-4 text-sm">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <span className="font-bold">{new Date(s.startedAt).toLocaleString("ko-KR")}</span>
                <span className="text-muted">
                  {s.items.length}문항 · 피드백 {s.items.filter((i) => i.feedback).length}개 {s.target && `· ${s.target}`}
                </span>
                <button
                  type="button"
                  className="ml-auto text-xs text-muted hover:text-bad"
                  onClick={(e) => {
                    e.preventDefault();
                    setSessions((all) => all.filter((x) => x.id !== s.id));
                  }}
                >
                  삭제
                </button>
              </summary>
              <div className="mt-3 space-y-4">
                {s.items.map((it, i) => (
                  <div key={i} className="space-y-2 border-t border-border pt-3">
                    <div className="text-xs text-muted">
                      {it.source} · {it.seconds}초
                    </div>
                    <p className="prose-ko font-semibold">{it.question}</p>
                    <p className="prose-ko text-muted">{it.answer || "(답변 없음)"}</p>
                    {it.feedback && <FeedbackView fb={it.feedback} />}
                  </div>
                ))}
              </div>
            </details>
          ))
        ))}

      {tab === "generated" &&
        (generated.length === 0 ? (
          <Empty>
            <Link href="/record" className="text-accent underline">
              생기부 예상 질문
            </Link>
            에서 내 생기부로 질문을 만들어 보세요.
          </Empty>
        ) : (
          generated.map((g) => (
            <GeneratedCard key={g.id} q={g} onDelete={() => setGenerated((all) => all.filter((x) => x.id !== g.id))} />
          ))
        ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-8 text-center text-sm text-muted">{children}</div>;
}
