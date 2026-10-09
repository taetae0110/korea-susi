import type { Metadata } from "next";
import { universities } from "@/lib/data";
import RecordClient from "./RecordClient";

export const metadata: Metadata = { title: "생기부 예상 질문 | 수시 면접 연습실" };

export default function RecordPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">생기부 기반 예상 질문</h1>
        <p className="mt-1 text-sm text-muted">
          내 학교생활기록부(세특·창체·행특 등)를 붙여넣으면, 실제 대학 공개 문항의 문체를 참고해 근거 문장을 인용한 예상
          질문을 만듭니다. 입력한 내용은 질문 생성에만 쓰이고 서버에 저장되지 않습니다.
        </p>
      </div>
      <RecordClient universityNames={universities.map((u) => u.name)} />
    </div>
  );
}
