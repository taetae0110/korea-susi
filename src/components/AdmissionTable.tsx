import type { AdmissionRow } from "@/lib/admissions";

/** 대학 → 학년도 → 전형별로 묶어 표로 보여 준다 */
export default function AdmissionTable({ rows, showUniversity = true }: { rows: AdmissionRow[]; showUniversity?: boolean }) {
  const groups: { title: string; key: string; sub: string; caption: string | null; source: AdmissionRow["source"]; rows: AdmissionRow[] }[] = [];
  for (const r of rows) {
    const title = `${showUniversity ? `${r.university} · ` : ""}${r.year}학년도 ${r.admission || r.type}`;
    const key = `${title}|${r.source.kind === "file" ? r.source.name : "adiga"}|${r.caption ?? ""}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(r);
    else
      groups.push({
        title,
        key,
        sub: `${r.type}${r.period && r.period !== "수시" ? ` · ${r.period}` : ""}`,
        caption: r.caption,
        source: r.source,
        rows: [r],
      });
  }

  return (
    <div className="space-y-4">
      {groups.map((g, gi) => {
        const hasScoreOnly = g.rows.some((r) => !r.grade && r.score);
        const extraKeys = [...new Set(g.rows.flatMap((r) => Object.keys(r.extra ?? {})))];
        return (
          <section key={gi} className="card overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <h3 className="font-bold">{g.title}</h3>
                <p className="text-xs text-muted">{g.sub}</p>
                {g.caption && <p className="text-xs text-muted">자료 표기: {g.caption}</p>}
              </div>
              <span className="text-xs text-muted">
                출처:{" "}
                {g.source.kind === "file" ? (
                  <a href={g.source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">
                    {g.source.site ? "대학 입학처" : "대학 추가안내자료"} 「{g.source.name}」
                  </a>
                ) : (
                  <a
                    href="https://www.adiga.kr/uct/acd/ade/criteriaAndResultView.do"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-accent"
                  >
                    어디가 전년도 결과공개
                  </a>
                )}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm tabular-nums">
                <thead className="bg-background text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">모집단위</th>
                    <th className="w-[8%] px-2 py-2 text-right font-semibold">모집</th>
                    <th className="w-[8%] px-2 py-2 text-right font-semibold">경쟁률</th>
                    <th className="w-[8%] px-2 py-2 text-right font-semibold">충원</th>
                    <th className="w-[8%] px-2 py-2 text-right font-semibold">50%</th>
                    <th className="w-[8%] px-2 py-2 text-right font-semibold">70%</th>
                    <th className="w-[8%] px-2 py-2 text-right font-semibold">80%</th>
                    <th className="w-[8%] px-2 py-2 text-right font-semibold text-accent">90%</th>
                    <th className="w-[8%] px-2 py-2 text-right font-semibold">100%</th>
                    {extraKeys.map((k) => (
                      <th key={k} className="w-[8%] px-2 py-2 text-right font-semibold">
                        {k === "avg" ? "평균" : k === "min" ? "최저" : k === "max" ? "최고" : `${k}%`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => {
                    const vals = r.grade ?? r.score;
                    return (
                      <tr key={r.key} className="border-t border-border">
                        <td className="px-3 py-1.5">{r.unit}</td>
                        <td className="px-2 py-1.5 text-right">{r.recruit ?? ""}</td>
                        <td className="px-2 py-1.5 text-right">{r.competition ?? ""}</td>
                        <td className="px-2 py-1.5 text-right">{r.waitlist ?? ""}</td>
                        {r.withheld ? (
                          <td colSpan={5 + extraKeys.length} className="px-2 py-1.5 text-xs text-muted">
                            비공개: {r.withheld}
                          </td>
                        ) : (
                          <>
                            {[0, 1, 2, 3, 4].map((i) => (
                              <td key={i} className={`px-2 py-1.5 text-right ${i === 3 ? "font-semibold text-accent" : ""}`}>
                                {vals?.[i] ?? ""}
                              </td>
                            ))}
                            {extraKeys.map((k) => (
                              <td key={k} className="px-2 py-1.5 text-right">
                                {r.extra?.[k] ?? ""}
                              </td>
                            ))}
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {hasScoreOnly && (
              <p className="border-t border-border px-4 py-2 text-xs text-muted">
                등급 대신 환산점수만 공개한 행은 환산점수를 표시했습니다
                {g.rows.find((r) => r.scoreTotal)?.scoreTotal ? ` (총점 ${g.rows.find((r) => r.scoreTotal)?.scoreTotal})` : ""}.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
