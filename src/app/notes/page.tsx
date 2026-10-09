import type { Metadata } from "next";
import NotesClient from "./NotesClient";

export const metadata: Metadata = { title: "내 노트 | 수시 면접 연습실" };

export default function NotesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">내 노트</h1>
        <p className="mt-1 text-sm text-muted">
          작성한 답변, 모의 면접 기록, 생기부 예상 질문을 모아 봅니다. 모두 이 브라우저에만 저장되니 필요하면 내보내기로
          백업하세요.
        </p>
      </div>
      <NotesClient />
    </div>
  );
}
