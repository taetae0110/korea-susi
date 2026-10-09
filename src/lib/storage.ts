"use client";

import { useCallback, useSyncExternalStore } from "react";

/** 브라우저에만 저장되는 사용자 데이터 (서버로 전송되지 않음) */
export interface SavedAnswer {
  questionId?: string;
  question: string;
  answer: string;
  updatedAt: number;
}

export interface GeneratedQuestion {
  id: string;
  question: string;
  basis: string;
  basisVerified: boolean;
  competency: string;
  intent: string;
  followUps: string[];
  target: string;
  createdAt: number;
}

export interface Feedback {
  overall: string;
  scores: { criterion: string; score: number; comment: string }[];
  strengths: string[];
  improvements: string[];
  improvedAnswer: string;
  followUps: string[];
}

export interface PracticeItem {
  questionId?: string;
  question: string;
  passage?: string | null;
  source?: string;
  answer: string;
  seconds: number;
  feedback?: Feedback;
}

export interface PracticeSession {
  id: string;
  startedAt: number;
  target: string;
  items: PracticeItem[];
}

export interface Profile {
  university: string;
  major: string;
  record: string;
}

const KEYS = {
  answers: "susi.answers.v1",
  generated: "susi.generated.v1",
  sessions: "susi.sessions.v1",
  profile: "susi.profile.v1",
  basket: "susi.basket.v1",
} as const;
type Key = keyof typeof KEYS;

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function read<T>(key: Key, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEYS[key]);
  } catch {
    raw = null;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  if (raw) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

function write<T>(key: Key, value: T) {
  try {
    window.localStorage.setItem(KEYS[key], JSON.stringify(value));
  } catch {
    // storage unavailable (private mode / quota) — keep in memory only for this page view
    cache.set(key, { raw: null, value });
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = () => cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY = {
  answers: {} as Record<string, SavedAnswer>,
  generated: [] as GeneratedQuestion[],
  sessions: [] as PracticeSession[],
  profile: { university: "", major: "", record: "" } as Profile,
  basket: [] as string[], // 모의 면접에 담은 기출 문항 id
};
type Shape = typeof EMPTY;

export function useStored<K extends Key>(key: K): [Shape[K], (next: Shape[K] | ((prev: Shape[K]) => Shape[K])) => void, boolean] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, EMPTY[key]),
    () => EMPTY[key],
  );
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const set = useCallback(
    (next: Shape[K] | ((prev: Shape[K]) => Shape[K])) => {
      const prev = read(key, EMPTY[key]);
      const value = typeof next === "function" ? (next as (p: Shape[K]) => Shape[K])(prev) : next;
      write(key, value);
    },
    [key],
  );
  return [value, set, hydrated];
}

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
