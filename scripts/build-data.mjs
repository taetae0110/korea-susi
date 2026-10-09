#!/usr/bin/env node
// Builds the app dataset (src/data/*.json) from the verified extraction files in data/extracted/.
// Every extracted string was checked verbatim against the source report by scripts/pipeline/verify.py.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const extractedDir = path.join(root, "data", "extracted");
const outDir = path.join(root, "src", "data");
const FORMATS = new Set(["서류기반", "제시문기반", "MMI", "인성"]);

const sources = fs
  .readFileSync(path.join(root, "data", "sources.tsv"), "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [year, id, university, url, title] = line.split("\t");
    return {
      id,
      university,
      year: Number(year),
      title: title || `${university} ${year}학년도 선행학습 영향평가 자체평가 보고서`,
      url,
    };
  });
const sourceById = new Map(sources.map((s) => [s.id, s]));

const norm = (s) => (s ?? "").replace(/\s+/g, "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
const clean = (s) => {
  if (s == null) return null;
  const t = String(s).replace(/[ \t]+\n/g, "\n").trim();
  return t.length ? t : null;
};

const questions = new Map();
const interviews = [];
const usedDocs = new Set();

for (const file of fs.readdirSync(extractedDir).filter((f) => f.endsWith(".json")).sort()) {
  const data = JSON.parse(fs.readFileSync(path.join(extractedDir, file), "utf8"));
  const docId = data.source.file;
  const doc = sourceById.get(docId);
  if (!doc) throw new Error(`${file}: unknown source ${docId}`);
  const university = doc.university;

  for (const iv of data.interviews ?? []) {
    interviews.push({
      university,
      year: doc.year,
      admission: clean(iv.admission),
      units: clean(iv.units),
      format: FORMATS.has(iv.format) ? iv.format : null,
      method: clean(iv.method),
      duration: clean(iv.duration),
      criteria: (iv.criteria ?? [])
        .filter((c) => c && c.name)
        .map((c) => ({ name: String(c.name).trim(), weight: c.weight == null ? null : String(c.weight).trim() })),
      source: { doc: docId, page: Number(iv.page) || 0 },
    });
    usedDocs.add(docId);
  }

  for (const q of data.questions ?? []) {
    // A page header inside a sentence leaves a line break mid-word ("…함\n께"); rejoin Hangul–Hangul breaks.
    const prompts = (q.prompts ?? [])
      .map((p) => clean(p)?.replace(/([가-힣])\n+([가-힣])/g, "$1$2") ?? null)
      .filter(Boolean);
    if (!prompts.length) continue;
    if (!FORMATS.has(q.format)) throw new Error(`${file}: bad format ${q.format}`);
    const passage = clean(q.passage);
    const key = [university, norm(prompts.join("|")), norm(passage)].join("#");
    const ref = { doc: docId, page: Number(q.page) || 0 };
    const existing = questions.get(key);
    if (existing) {
      if (!existing.years.includes(doc.year)) existing.years.push(doc.year);
      if (!existing.sources.some((s) => s.doc === ref.doc && s.page === ref.page)) existing.sources.push(ref);
      existing.intent ??= clean(q.intent);
      existing.sampleAnswer ??= clean(q.sample_answer);
      existing.admission ??= clean(q.admission);
      existing.unit ??= clean(q.unit);
      existing.competency ??= clean(q.competency);
    } else {
      questions.set(key, {
        id: crypto.createHash("sha1").update(key).digest("hex").slice(0, 12),
        university,
        years: [doc.year],
        admission: clean(q.admission),
        unit: clean(q.unit),
        format: q.format,
        competency: clean(q.competency),
        passage,
        prompts,
        intent: clean(q.intent),
        sampleAnswer: clean(q.sample_answer),
        sources: [ref],
      });
    }
    usedDocs.add(docId);
  }
}

const ko = (a, b) => a.localeCompare(b, "ko");
const list = [...questions.values()];
for (const q of list) {
  q.years.sort((a, b) => b - a);
  q.sources.sort((a, b) => ko(b.doc, a.doc) || a.page - b.page);
}
list.sort((a, b) => ko(a.university, b.university) || b.years[0] - a.years[0] || a.sources[0].page - b.sources[0].page);
interviews.sort((a, b) => ko(a.university, b.university) || b.year - a.year || a.source.page - b.source.page);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "questions.json"), JSON.stringify(list));
fs.writeFileSync(path.join(outDir, "interviews.json"), JSON.stringify(interviews));
fs.writeFileSync(
  path.join(outDir, "sources.json"),
  JSON.stringify(sources.filter((s) => usedDocs.has(s.id)).sort((a, b) => ko(a.university, b.university) || b.year - a.year)),
);
console.log(`questions: ${list.length}, interviews: ${interviews.length}, sources: ${usedDocs.size}`);
