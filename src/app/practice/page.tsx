import type { Metadata } from "next";
import { Suspense } from "react";
import { competencies, interviews, universities } from "@/lib/data";
import PracticeClient from "./PracticeClient";

export const metadata: Metadata = { title: "모의 면접 | 수시 면접 연습실" };

// 대학별로 공개된 면접 방식 요약 (최신 학년도 우선, 최대 3건)
const interviewHints: Record<string, string[]> = {};
for (const iv of interviews) {
  const text = [iv.admission, iv.method, iv.duration].filter(Boolean).join(" · ");
  if (!text || !iv.duration) continue;
  const list = (interviewHints[iv.university] ??= []);
  if (list.length < 3 && !list.includes(`${iv.year}학년도 ${text}`)) list.push(`${iv.year}학년도 ${text}`);
}

export default function PracticePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">모의 면접</h1>
        <p className="mt-1 text-sm text-muted">
          실제 기출 문항이나 내 생기부 예상 질문으로 시간을 재며 답하고, 끝나면 답변별 AI 피드백을 받습니다.
        </p>
      </div>
      <Suspense fallback={<div className="card h-60 animate-pulse" />}>
        <PracticeClient
          universityNames={universities.filter((u) => u.questionCount > 0).map((u) => u.name)}
          competencies={competencies}
          interviewHints={interviewHints}
        />
      </Suspense>
    </div>
  );
}
