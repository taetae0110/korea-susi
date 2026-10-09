"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import FeedbackView from "@/components/FeedbackView";
import { speak, stopSpeaking, useSpeechRecognition, useSpeechSupport } from "@/lib/speech";
import { newId, useStored, type Feedback, type PracticeItem, type PracticeSession } from "@/lib/storage";
import { FORMATS, type InterviewFormat } from "@/lib/types";

type SourceKind = "bank" | "basket" | "generated";

interface ApiQuestion {
  id: string;
  university: string;
  years: number[];
  admission: string | null;
  unit: string | null;
  passage: string | null;
  prompts: string[];
}

interface Settings {
  kind: SourceKind;
  university: string;
  format: "" | InterviewFormat;
  competency: string;
  count: number;
  answerSec: number;
  prepSec: number;
  tts: boolean;
}

export default function PracticeClient({
  universityNames,
  competencies,
}: {
  universityNames: string[];
  competencies: string[];
}) {
  const sp = useSearchParams();
  const presetIds = (sp.get("ids") ?? "").split(",").filter(Boolean);
  const [basket] = useStored("basket");
  const [generated] = useStored("generated");
  const [profile, setProfile] = useStored("profile");
  const [, setSessions] = useStored("sessions");

  const [settings, setSettings] = useState<Settings>(() => ({
    kind: "bank",
    university: sp.get("university") ?? "",
    format: (FORMATS as readonly string[]).includes(sp.get("format") ?? "") ? (sp.get("format") as InterviewFormat) : "",
    competency: sp.get("competency") ?? "",
    count: 5,
    answerSec: 90,
    prepSec: 0,
    tts: true,
  }));
  const [stage, setStage] = useState<"setup" | "run" | "done">("setup");
  const [items, setItems] = useState<PracticeItem[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  async function begin(ids?: string[]) {
    setError(null);
    let next: PracticeItem[] = [];
    if (!ids && settings.kind === "generated") {
      next = [...generated]
        .sort(() => Math.random() - 0.5)
        .slice(0, settings.count)
        .map((g) => ({ question: g.question, source: `내 생기부 예상 질문 (AI 생성) · ${g.competency}`, answer: "", seconds: 0 }));
    } else {
      setLoading(true);
      try {
        const pickedIds = ids ?? (settings.kind === "basket" ? basket : null);
        const body = pickedIds
          ? { ids: pickedIds }
          : {
              university: settings.university || undefined,
              format: settings.format || undefined,
              competency: settings.competency || undefined,
              count: settings.count,
            };
        const res = await fetch("/api/practice-set", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { questions?: ApiQuestion[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "문항을 불러오지 못했습니다.");
        next = (data.questions ?? []).map((q) => ({
          questionId: q.id,
          question: q.prompts.join("\n"),
          passage: q.passage,
          source: [q.university, `${q.years.join("·")}학년도`, q.admission, q.unit].filter(Boolean).join(" · "),
          answer: "",
          seconds: 0,
        }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return;
      } finally {
        setLoading(false);
      }
    }
    if (next.length === 0) {
      setError("조건에 맞는 문항이 없습니다.");
      return;
    }
    setItems(next);
    setSessionId(newId());
    setStage("run");
  }

  const finish = useCallback(
    (done: PracticeItem[]) => {
      stopSpeaking();
      setItems(done);
      setStage("done");
      const session: PracticeSession = {
        id: sessionId,
        startedAt: Date.now(),
        target: [profile.university, profile.major].filter(Boolean).join(" "),
        items: done,
      };
      setSessions((all) => [session, ...all.filter((s) => s.id !== session.id)].slice(0, 50));
    },
    [sessionId, profile.university, profile.major, setSessions],
  );

  if (stage === "run") {
    return (
      <Runner
        items={items}
        answerSec={settings.answerSec}
        prepSec={settings.prepSec}
        tts={settings.tts}
        onFinish={finish}
        onQuit={() => {
          stopSpeaking();
          setStage("setup");
        }}
      />
    );
  }

  if (stage === "done") {
    return (
      <Results
        items={items}
        target={[profile.university, profile.major].filter(Boolean).join(" ")}
        record={profile.record}
        onUpdate={(next) => {
          setItems(next);
          setSessions((all) => all.map((s) => (s.id === sessionId ? { ...s, items: next } : s)));
        }}
        onRestart={() => setStage("setup")}
      />
    );
  }

  return (
    <div className="space-y-4">
      {presetIds.length > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-accent p-4">
          <span className="text-sm">선택한 기출 문항 {presetIds.length}개로 바로 연습할 수 있어요.</span>
          <button type="button" className="btn btn-primary" disabled={loading} onClick={() => begin(presetIds)}>
            선택한 문항으로 시작
          </button>
        </div>
      )}

      <section className="card space-y-4 p-4 sm:p-5">
        <h2 className="font-bold">1. 문항 고르기</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <SourceOption
            active={settings.kind === "bank"}
            onClick={() => set("kind", "bank")}
            title="기출 문항 무작위"
            desc="조건에 맞는 공개 기출 중에서"
          />
          <SourceOption
            active={settings.kind === "basket"}
            onClick={() => set("kind", "basket")}
            title={`연습 목록 (${basket.length})`}
            desc="기출 문항 페이지에서 담은 문항"
            disabled={basket.length === 0}
          />
          <SourceOption
            active={settings.kind === "generated"}
            onClick={() => set("kind", "generated")}
            title={`내 예상 질문 (${generated.length})`}
            desc="생기부로 만든 AI 예상 질문"
            disabled={generated.length === 0}
          />
        </div>

        {settings.kind === "bank" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className="mb-1 block text-xs font-semibold text-muted">대학</span>
              <select className="input" value={settings.university} onChange={(e) => set("university", e.target.value)}>
                <option value="">전체 대학</option>
                {universityNames.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-muted">면접 유형</span>
              <select className="input" value={settings.format} onChange={(e) => set("format", e.target.value as Settings["format"])}>
                <option value="">전체</option>
                {FORMATS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-muted">평가요소</span>
              <select className="input" value={settings.competency} onChange={(e) => set("competency", e.target.value)}>
                <option value="">전체</option>
                {competencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        {settings.kind === "basket" && basket.length === 0 && (
          <p className="text-sm text-muted">
            <Link href="/questions" className="text-accent underline">
              기출 문항
            </Link>
            에서 &lsquo;연습 목록에 담기&rsquo;를 눌러 문항을 모아 주세요.
          </p>
        )}
        {settings.kind === "generated" && generated.length === 0 && (
          <p className="text-sm text-muted">
            <Link href="/record" className="text-accent underline">
              생기부 예상 질문
            </Link>
            에서 먼저 질문을 만들어 주세요.
          </p>
        )}
      </section>

      <section className="card space-y-4 p-4 sm:p-5">
        <h2 className="font-bold">2. 진행 방식</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {settings.kind !== "basket" && (
            <label>
              <span className="mb-1 block text-xs font-semibold text-muted">문항 수</span>
              <select className="input" value={settings.count} onChange={(e) => set("count", Number(e.target.value))}>
                {[3, 5, 7, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}개
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">문항당 답변 시간</span>
            <select className="input" value={settings.answerSec} onChange={(e) => set("answerSec", Number(e.target.value))}>
              {[60, 90, 120, 180, 300].map((n) => (
                <option key={n} value={n}>
                  {n >= 120 ? `${n / 60}분` : `${n}초`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">제시문 준비 시간</span>
            <select className="input" value={settings.prepSec} onChange={(e) => set("prepSec", Number(e.target.value))}>
              {[0, 60, 180, 300, 600].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "없음" : `${n / 60}분`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.tts} onChange={(e) => set("tts", e.target.checked)} />
          질문을 소리로 읽어 주기
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">지원 대학 (피드백 참고용, 선택)</span>
            <input
              className="input"
              value={profile.university}
              onChange={(e) => setProfile((p) => ({ ...p, university: e.target.value }))}
              placeholder="예: OO대학교"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted">지원 학과 (선택)</span>
            <input
              className="input"
              value={profile.major}
              onChange={(e) => setProfile((p) => ({ ...p, major: e.target.value }))}
              placeholder="예: 화학공학과"
            />
          </label>
        </div>
      </section>

      {error && <p className="text-sm font-semibold text-bad">{error}</p>}
      <button
        type="button"
        className="btn btn-primary w-full py-3 text-base"
        disabled={loading || (settings.kind === "basket" && basket.length === 0) || (settings.kind === "generated" && generated.length === 0)}
        onClick={() => begin()}
      >
        {loading ? "문항 불러오는 중…" : "모의 면접 시작"}
      </button>
    </div>
  );
}

function SourceOption(props: { active: boolean; onClick: () => void; title: string; desc: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`rounded-xl border p-3 text-left transition-colors disabled:opacity-50 ${
        props.active ? "border-accent bg-accent-soft" : "border-border hover:border-accent"
      }`}
    >
      <div className="font-semibold">{props.title}</div>
      <div className="text-xs text-muted">{props.desc}</div>
    </button>
  );
}

function fmt(sec: number) {
  const s = Math.abs(Math.round(sec));
  return `${sec < 0 ? "+" : ""}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Runner({
  items,
  answerSec,
  prepSec,
  tts,
  onFinish,
  onQuit,
}: {
  items: PracticeItem[];
  answerSec: number;
  prepSec: number;
  tts: boolean;
  onFinish: (items: PracticeItem[]) => void;
  onQuit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => items.map(() => ""));
  const [seconds, setSeconds] = useState<number[]>(() => items.map(() => 0));
  const current = items[index];
  const hasPrep = Boolean(current.passage) && prepSec > 0;
  // prepUntil: 준비 시간이 끝나는 시각 (준비 없으면 0). 답변 시간은 그 이후부터 잰다.
  const [prepUntil, setPrepUntil] = useState(() => (hasPrep ? Date.now() + prepSec * 1000 : 0));
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const phase: "prep" | "answer" = now < prepUntil ? "prep" : "answer";
  const answerStart = Math.max(startedAt, prepUntil);
  const support = useSpeechSupport();
  const { listening, interim, error: micError, start, stop } = useSpeechRecognition(
    useCallback(
      (text: string) =>
        setAnswers((a) => a.map((v, i) => (i === index ? (v ? `${v} ${text}` : text) : v))),
      [index],
    ),
  );
  const spokenRef = useRef(-1);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (phase === "answer" && tts && spokenRef.current !== index) {
      spokenRef.current = index;
      speak(current.question);
    }
  }, [phase, tts, index, current.question]);

  const remaining = phase === "prep" ? (prepUntil - now) / 1000 : answerSec - (now - answerStart) / 1000;

  function skipPrep() {
    const t = Date.now();
    setPrepUntil(0);
    setStartedAt(t);
    setNow(t);
  }

  function next() {
    stop();
    stopSpeaking();
    const t = Date.now();
    const used = phase === "answer" ? Math.round((t - answerStart) / 1000) : 0;
    const secs = seconds.map((s, i) => (i === index ? used : s));
    setSeconds(secs);
    if (index + 1 >= items.length) {
      onFinish(items.map((it, i) => ({ ...it, answer: answers[i].trim(), seconds: secs[i] })));
      return;
    }
    const n = items[index + 1];
    setIndex(index + 1);
    setPrepUntil(n.passage && prepSec > 0 ? t + prepSec * 1000 : 0);
    setStartedAt(t);
    setNow(t);
  }

  const over = phase === "answer" && remaining < 0;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-background/95 px-4 py-2 backdrop-blur sm:top-[57px]">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold">
            {index + 1} / {items.length}
          </span>
          <span
            className={`rounded-lg px-3 py-0.5 font-mono text-xl font-bold tabular-nums ${
              over ? "bg-bad/10 text-bad" : remaining < 15 ? "text-warn" : "text-foreground"
            }`}
            aria-live="polite"
          >
            {phase === "prep" ? "준비 " : ""}
            {fmt(remaining)}
          </span>
          <button type="button" className="text-muted hover:text-bad" onClick={onQuit}>
            그만하기
          </button>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div className="h-full bg-accent transition-all" style={{ width: `${(index / items.length) * 100}%` }} />
        </div>
      </div>

      <section className="card space-y-4 p-5">
        <div className="text-xs text-muted">{current.source}</div>

        {current.passage && (
          <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-border bg-background p-4">
            <div className="mb-2 text-xs font-semibold text-muted">제시문</div>
            <p className="prose-ko text-[0.9375rem]">{current.passage}</p>
          </div>
        )}

        {phase === "prep" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-muted">제시문을 읽고 답변을 준비하세요. 시간이 끝나면 질문이 나옵니다.</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={skipPrep}
            >
              준비 완료, 질문 보기
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <p className="prose-ko flex-1 text-lg font-bold leading-relaxed">{current.question}</p>
              {support.synthesis && (
                <button type="button" className="btn shrink-0 px-2.5" onClick={() => speak(current.question)} title="다시 듣기">
                  🔊
                </button>
              )}
            </div>
            <textarea
              className="input min-h-44 text-[0.9375rem] leading-relaxed"
              value={answers[index] + (interim ? (answers[index] ? " " : "") + interim : "")}
              onChange={(e) => setAnswers((a) => a.map((v, i) => (i === index ? e.target.value : v)))}
              placeholder={support.recognition ? "마이크를 켜고 말하거나 직접 입력하세요." : "답변을 입력하세요."}
              readOnly={listening}
            />
            {micError && <p className="text-sm text-bad">{micError}</p>}
            {over && <p className="text-sm font-semibold text-bad">답변 시간이 지났습니다. 실제 면접이라면 마무리할 시점이에요.</p>}
            <div className="flex flex-wrap gap-2">
              {support.recognition && (
                <button type="button" className={`btn ${listening ? "border-bad text-bad" : ""}`} onClick={listening ? stop : start}>
                  {listening ? "■ 말하기 멈춤" : "🎤 말하며 답하기"}
                </button>
              )}
              <button type="button" className="btn btn-primary ml-auto" onClick={next}>
                {index + 1 >= items.length ? "면접 마치기" : "다음 질문"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Results({
  items,
  target,
  record,
  onUpdate,
  onRestart,
}: {
  items: PracticeItem[];
  target: string;
  record: string;
  onUpdate: (items: PracticeItem[]) => void;
  onRestart: () => void;
}) {
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [sendRecord, setSendRecord] = useState(false);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  async function requestFeedback(i: number) {
    const it = itemsRef.current[i];
    if (!it.answer) return;
    setBusy((b) => ({ ...b, [i]: true }));
    setErrors((e) => ({ ...e, [i]: "" }));
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId: it.questionId,
          question: it.question,
          passage: it.passage ?? undefined,
          answer: it.answer,
          target: target || undefined,
          record: sendRecord && record ? record : undefined,
          seconds: it.seconds,
        }),
      });
      const data = (await res.json()) as Feedback & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "피드백을 받지 못했습니다.");
      const next = itemsRef.current.map((x, j) => (j === i ? { ...x, feedback: data } : x));
      itemsRef.current = next;
      onUpdate(next);
    } catch (e) {
      setErrors((er) => ({ ...er, [i]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy((b) => ({ ...b, [i]: false }));
    }
  }

  async function requestAll() {
    for (let i = 0; i < itemsRef.current.length; i++) {
      if (itemsRef.current[i].answer && !itemsRef.current[i].feedback) await requestFeedback(i);
    }
  }

  const answered = items.filter((i) => i.answer).length;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="font-bold">면접 종료</div>
          <div className="text-sm text-muted">
            {items.length}문항 중 {answered}문항 답변 · 기록은 &lsquo;내 노트&rsquo;에 저장됐어요.
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={onRestart}>
            다시 하기
          </button>
          <button type="button" className="btn btn-primary" disabled={answered === 0} onClick={requestAll}>
            전체 AI 피드백
          </button>
        </div>
      </div>
      {record && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={sendRecord} onChange={(e) => setSendRecord(e.target.checked)} />
          저장해 둔 내 생기부 내용도 함께 보내 더 정확한 피드백 받기
        </label>
      )}
      {items.map((it, i) => (
        <section key={i} className="card space-y-3 p-4 sm:p-5">
          <div className="text-xs text-muted">
            {i + 1}. {it.source} · 답변 {it.seconds}초
          </div>
          <p className="prose-ko font-bold">{it.question}</p>
          <p className={`prose-ko rounded-lg bg-background p-3 text-sm ${it.answer ? "" : "text-muted"}`}>
            {it.answer || "(답변 없음)"}
          </p>
          {it.feedback ? (
            <FeedbackView fb={it.feedback} />
          ) : (
            it.answer && (
              <button type="button" className="btn" disabled={busy[i]} onClick={() => requestFeedback(i)}>
                {busy[i] ? "분석 중… (최대 1분)" : "AI 피드백 받기"}
              </button>
            )
          )}
          {errors[i] && <p className="text-sm text-bad">{errors[i]}</p>}
        </section>
      ))}
    </div>
  );
}
