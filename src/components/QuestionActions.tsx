"use client";

import Link from "next/link";
import { useState } from "react";
import { useStored } from "@/lib/storage";

export default function QuestionActions({ id, question }: { id: string; question: string }) {
  const [basket, setBasket, hydrated] = useStored("basket");
  const [answers, setAnswers] = useStored("answers");
  const saved = answers[id];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inBasket = basket.includes(id);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn ${inBasket ? "btn-primary" : ""}`}
          disabled={!hydrated}
          onClick={() => setBasket((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id].slice(-30)))}
        >
          {inBasket ? "✓ 연습 목록에 담김" : "+ 연습 목록에 담기"}
        </button>
        <Link href={`/practice?ids=${id}`} className="btn">
          이 문항 바로 연습
        </Link>
        <button
          type="button"
          className="btn"
          disabled={!hydrated}
          onClick={() => {
            setDraft(saved?.answer ?? "");
            setOpen((o) => !o);
          }}
        >
          {saved ? "내 답변 수정" : "내 답변 쓰기"}
        </button>
      </div>
      {saved && !open && (
        <div className="rounded-lg bg-accent-soft/60 p-3 text-sm">
          <div className="mb-1 text-xs font-semibold text-accent">내 답변</div>
          <p className="prose-ko">{saved.answer}</p>
        </div>
      )}
      {open && (
        <div className="space-y-2">
          <textarea
            className="input min-h-32"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="답변을 적어 두면 '내 노트'에서 모아 볼 수 있어요."
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setAnswers((a) => {
                  const next = { ...a };
                  if (draft.trim()) next[id] = { questionId: id, question, answer: draft.trim(), updatedAt: Date.now() };
                  else delete next[id];
                  return next;
                });
                setOpen(false);
              }}
            >
              저장
            </button>
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
