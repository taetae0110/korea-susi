import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QuestionCard from "@/components/QuestionCard";
import { getSource, interviews, questions, sources, sourceUrl, universities } from "@/lib/data";
import { FORMATS } from "@/lib/types";

export function generateStaticParams() {
  return universities.map((u) => ({ name: u.name }));
}

function decode(name: string) {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export async function generateMetadata({ params }: PageProps<"/universities/[name]">): Promise<Metadata> {
  const { name } = await params;
  return { title: `${decode(name)} 면접 | 수시 면접 연습실` };
}

const PREVIEW = 12;

export default async function UniversityPage({ params }: PageProps<"/universities/[name]">) {
  const name = decode((await params).name);
  const uni = universities.find((u) => u.name === name);
  if (!uni) notFound();

  const ivs = interviews.filter((i) => i.university === name);
  const qs = questions.filter((q) => q.university === name);
  const docs = sources.filter((s) => s.university === name);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/universities" className="text-sm text-muted hover:text-accent">
          ← 대학 목록
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold">{name}</h1>
        <div className="mt-2 flex flex-wrap gap-1">
          {FORMATS.filter((f) => uni.formats[f]).map((f) => (
            <Link key={f} href={`/questions?university=${encodeURIComponent(name)}&format=${encodeURIComponent(f)}`} className="chip">
              {f} {uni.formats[f]}
            </Link>
          ))}
        </div>
      </div>

      {ivs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">전형별 면접 방식</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {ivs.map((iv, i) => {
              const doc = getSource(iv.source.doc);
              return (
                <div key={i} className="card space-y-2 p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold">{iv.admission ?? "전형명 미기재"}</span>
                    <span className="text-xs text-muted">{iv.year}학년도</span>
                    {iv.format && <span className="chip">{iv.format}</span>}
                  </div>
                  <dl className="grid grid-cols-[5rem_1fr] gap-x-2 gap-y-1">
                    {iv.units && (
                      <>
                        <dt className="text-muted">모집단위</dt>
                        <dd>{iv.units}</dd>
                      </>
                    )}
                    {iv.method && (
                      <>
                        <dt className="text-muted">진행 방법</dt>
                        <dd>{iv.method}</dd>
                      </>
                    )}
                    {iv.duration && (
                      <>
                        <dt className="text-muted">면접 시간</dt>
                        <dd>{iv.duration}</dd>
                      </>
                    )}
                    {iv.criteria.length > 0 && (
                      <>
                        <dt className="text-muted">평가요소</dt>
                        <dd>{iv.criteria.map((c) => (c.weight ? `${c.name}(${c.weight})` : c.name)).join(", ")}</dd>
                      </>
                    )}
                  </dl>
                  {doc && (
                    <a
                      href={sourceUrl(doc, iv.source.page)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-muted underline hover:text-accent"
                    >
                      {doc.title} {iv.source.page}쪽
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">기출 문항 {qs.length}개</h2>
          {qs.length > 0 && (
            <div className="flex gap-3 text-sm font-semibold">
              <Link href={`/practice?university=${encodeURIComponent(name)}`} className="text-accent">
                이 대학으로 모의 면접 →
              </Link>
            </div>
          )}
        </div>
        {qs.length === 0 ? (
          <p className="card p-5 text-sm text-muted">
            이 대학 보고서에는 면접 문항 원문이 실려 있지 않습니다. 위 면접 방식 정보를 참고하세요.
          </p>
        ) : (
          <div className="space-y-3">
            {qs.slice(0, PREVIEW).map((q) => (
              <QuestionCard key={q.id} q={q} showUniversity={false} />
            ))}
            {qs.length > PREVIEW && (
              <Link href={`/questions?university=${encodeURIComponent(name)}`} className="btn w-full">
                {name} 문항 전체 보기 ({qs.length}개)
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-lg font-bold">출처 문서</h2>
        <ul className="list-inside list-disc text-muted">
          {docs.map((d) => (
            <li key={d.id}>
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">
                {d.title}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
