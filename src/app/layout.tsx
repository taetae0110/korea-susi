import type { Metadata } from "next";
import Link from "next/link";
import NavLinks from "@/components/NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: "수시 면접 연습실",
  description:
    "대학이 공개한 실제 수시 면접 기출 문항으로 연습하고, 내 생활기록부 기반 예상 질문과 AI 답변 피드백을 받는 면접 준비 도구",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="z-20 border-b border-border bg-background/90 backdrop-blur sm:sticky sm:top-0">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="text-lg font-extrabold tracking-tight">
              수시 면접 연습실
            </Link>
            <NavLinks />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-5 text-xs leading-relaxed text-muted">
            기출 문항은 각 대학이 「공교육 정상화 촉진 및 선행교육 규제에 관한 특별법」에 따라 공개한
            「선행학습 영향평가 자체평가 보고서」에서 원문 그대로 옮겼으며, 문항마다 출처 문서와 쪽수를
            표시합니다. 내 답변·생기부·연습 기록은 이 브라우저에만 저장됩니다.
          </div>
        </footer>
      </body>
    </html>
  );
}
