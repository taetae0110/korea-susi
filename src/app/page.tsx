import Link from "next/link";
import { interviews, questions, sources, universities, years } from "@/lib/data";
import { FORMATS } from "@/lib/types";

const FORMAT_DESC: Record<(typeof FORMATS)[number], string> = {
  서류기반: "학생부·제출서류 내용을 확인하는 질문",
  제시문기반: "제시문·자료를 읽고 답하는 구술 문항",
  MMI: "의약학 계열 다중미니면접·상황면접",
  인성: "가치관·태도·소양을 묻는 질문",
};

export default function Home() {
  const byFormat = Object.fromEntries(FORMATS.map((f) => [f, questions.filter((q) => q.format === f).length]));
  const withAnswer = questions.filter((q) => q.sampleAnswer).length;

  return (
    <div className="space-y-10">
      <section className="space-y-4 pt-2">
        <h1 className="text-2xl font-extrabold leading-snug sm:text-3xl">
          대학이 직접 공개한 면접 문항으로
          <br />
          수시 면접을 준비하세요
        </h1>
        <p className="max-w-2xl text-muted">
          {universities.length}개 대학이 공개한 {Math.min(...years)}~{Math.max(...years)}학년도 자료에서 면접 문항{" "}
          {questions.length.toLocaleString()}개와 전형별 면접 방식 {interviews.length}건을 원문 그대로
          모았습니다. 실제 문항으로 모의 면접을 하고, 내 생활기록부로 예상 질문을 뽑고, 답변에 AI 피드백을
          받아 보세요.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/practice" className="btn btn-primary">
            모의 면접 시작
          </Link>
          <Link href="/questions" className="btn">
            기출 문항 보기
          </Link>
          <Link href="/record" className="btn">
            생기부로 예상 질문 만들기
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FORMATS.map((f) => (
          <Link key={f} href={`/questions?format=${encodeURIComponent(f)}`} className="card p-4 hover:border-accent">
            <div className="text-2xl font-extrabold">{byFormat[f].toLocaleString()}</div>
            <div className="mt-1 font-semibold">{f} 면접</div>
            <div className="mt-1 text-xs text-muted">{FORMAT_DESC[f]}</div>
          </Link>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Feature
          href="/questions"
          title="기출 문항 검색"
          body={`대학·면접 유형·평가요소·키워드로 찾고, 출제 의도와 대학 공개 예시 답안(${withAnswer}개 문항)까지 확인합니다.`}
        />
        <Feature
          href="/practice"
          title="실전 모의 면접"
          body="질문을 소리로 들려주고 제한 시간 안에 말하거나 써서 답합니다. 끝나면 답변별 AI 피드백과 꼬리 질문을 받습니다."
        />
        <Feature
          href="/record"
          title="생기부 기반 예상 질문"
          body="내 생활기록부 내용을 붙여넣으면 근거 문장을 인용한 예상 질문을 만들고, 바로 모의 면접에 넣을 수 있습니다."
        />
      </section>

      <section className="card space-y-3 p-5 text-sm leading-relaxed">
        <h2 className="text-base font-bold">데이터는 어디서 왔나요?</h2>
        <p className="text-muted">
          대학별고사(논술·면접 등)를 치르는 대학은 법에 따라 매년 「선행학습 영향평가 자체평가 보고서」를 공개하고,
          여기에 실제 출제한 면접 문항, 출제 의도, 예시 답안을 싣습니다. 서울대학교처럼 면접·구술고사 문항을 입학본부
          자료실에 따로 공개하는 대학은 그 원본도 함께 썼습니다. 이 사이트의 기출 문항은 모두 이런 공식 문서{" "}
          {sources.length}건에서 옮긴 것이며, 옮긴 문장은 원문 텍스트와 한 문장씩 대조해 일치하는 것만 남겼습니다.
          예시·가상 데이터는 넣지 않았습니다.
        </p>
        <Link href="/universities" className="font-semibold text-accent">
          수록 대학과 출처 문서 보기 →
        </Link>
      </section>
    </div>
  );
}

function Feature({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="card block p-5 hover:border-accent">
      <h3 className="font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </Link>
  );
}
