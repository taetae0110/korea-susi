import type { Metadata } from "next";
import { Suspense } from "react";
import { competencies, universities } from "@/lib/data";
import PracticeClient from "./PracticeClient";

export const metadata: Metadata = { title: "모의 면접 | 수시 면접 연습실" };

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
        />
      </Suspense>
    </div>
  );
}
