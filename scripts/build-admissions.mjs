#!/usr/bin/env node
// Builds src/data/admissions.json (compact) from
//   data/admissions/adiga.json          — 대교협 어디가 표준 공개 입시결과 (scraped, values as printed)
//   data/admissions/extra/*.json         — rows taken from each university's own 추가안내자료 file,
//                                          verified cell-by-cell by scripts/admissions/verify_extra.py
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const adiga = JSON.parse(fs.readFileSync(path.join(root, "data", "admissions", "adiga.json"), "utf8"));
const extraDir = path.join(root, "data", "admissions", "extra");

const dict = () => {
  const list = [];
  const index = new Map();
  return {
    list,
    id(v) {
      if (v == null || v === "") return -1;
      if (!index.has(v)) {
        index.set(v, list.length);
        list.push(v);
      }
      return index.get(v);
    },
  };
};
const admissions = dict();
const captions = dict();
const periods = dict();
const withheld = dict();
const units = dict();

const univIndex = new Map();
const universities = [];
for (const u of adiga.universities) {
  univIndex.set(u.code, universities.length);
  universities.push({ code: u.code, name: u.name, campus: u.campus, adigaName: u.adigaName });
}

const TYPES = ["학생부교과", "학생부종합", "기타"];
const CUTS = ["50", "70", "80", "90", "100"];
const rows = [];
for (const r of adiga.rows) {
  const row = {
    u: univIndex.get(r.unvCd),
    y: r.year,
    t: TYPES.indexOf(r.type),
    p: periods.id(r.period),
    a: admissions.id(r.admission),
    n: units.id(r.unit),
    r: r.recruit,
    c: r.competition,
    w: r.waitlist,
  };
  if (r.grade) row.g = CUTS.map((k) => r.grade[k] ?? null);
  if (r.score) {
    row.s = CUTS.map((k) => r.score[k] ?? null);
    row.st = r.scoreTotal ?? null;
  }
  if (r.withheld) row.x = withheld.id(r.withheld);
  rows.push(row);
}

// university-provided files (추가안내자료)
// A file row that only repeats the 50%/70% cut 어디가 already shows for the same unit adds nothing: skip it.
const norm = (s) => String(s ?? "").replace(/[\s·ㆍ・]/g, "");
const num = (v) => (v == null || v === "" || Number.isNaN(Number(v)) ? String(v ?? "") : String(Number(v))); // "3.50" -> "3.5"
const cutKey = (code, year, unit, g50, g70) => `${code}|${year}|${norm(unit)}|${num(g50)}|${num(g70)}`;
const adigaCuts = new Set(adiga.rows.filter((r) => r.grade).map((r) => cutKey(r.unvCd, r.year, r.unit, r.grade["50"], r.grade["70"])));
const files = [];
const fileIndex = new Map();
let extraRows = 0;
let duplicateRows = 0;
if (fs.existsSync(extraDir)) {
  for (const f of fs.readdirSync(extraDir).filter((x) => x.endsWith(".json")).sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(extraDir, f), "utf8"));
    // source: {file: "<year>_<unvCd>"}               — 어디가 추가안내자료 (downloaded through adiga)
    //         {id, site: "<unvCd>", url, page_url, title} — a document on the university's own admission site
    let id, year, code, entry;
    if (data.source.file) {
      id = data.source.file;
      const meta = adiga.files[id];
      if (!meta) throw new Error(`${f}: no adiga file record for ${id}`);
      [year, code] = id.split("_");
      entry = { name: meta.filename || "추가안내자료", fileId: meta.fileId, fileSn: meta.fileSn };
    } else if (data.source.site && data.source.url) {
      id = data.source.id;
      code = data.source.site;
      year = null;
      entry = { name: data.source.title, url: data.source.url, page: data.source.page_url ?? null };
    } else throw new Error(`${f}: source needs file or site+url`);
    if (!univIndex.has(code)) throw new Error(`${f}: unknown university ${code}`);
    if (!fileIndex.has(id)) {
      fileIndex.set(id, files.length);
      files.push({ id, year: year ? Number(year) : null, u: univIndex.get(code), ...entry });
    }
    // the same file is sometimes attached for several campuses; a row may name the campus it belongs to
    const campusCodes = new Set([code, ...(data.source.also ?? [])]);
    for (const r of data.rows ?? []) {
      const v = r.values ?? {};
      const table = data.tables?.[r.table] ?? {};
      const rowCode = r.unvCd ?? code;
      if (!campusCodes.has(rowCode) || !univIndex.has(rowCode)) throw new Error(`${f}: row campus ${rowCode} is not one of ${[...campusCodes]}`);
      const y = Number(r.year ?? year);
      if (!y) throw new Error(`${f}: row ${r.row_ref} needs a year`);
      const unit = r.unit_group && !norm(r.unit).startsWith(norm(r.unit_group)) ? `${r.unit_group} ${r.unit}` : r.unit;
      const onlyMandatory = ["grade80", "grade85", "grade90", "grade95", "grade100", "gradeAvg", "gradeMin", "gradeMax"].every((k) => !v[k]);
      if (onlyMandatory && v.grade50 && v.grade70 && adigaCuts.has(cutKey(rowCode, y, r.unit, v.grade50, v.grade70))) {
        duplicateRows++;
        continue;
      }
      const row = {
        u: univIndex.get(rowCode),
        y,
        t: Math.max(0, TYPES.indexOf(r.type ?? "기타")),
        p: periods.id(r.period ?? "수시"),
        a: admissions.id(r.admission ?? null),
        n: units.id(unit),
        r: v.recruit ?? null,
        c: v.competition ?? null,
        w: v.waitlist ?? null,
        g: CUTS.map((k) => v[`grade${k}`] ?? null),
        f: fileIndex.get(id),
        ref: r.row_ref,
        k: captions.id([table.caption, table.basis].filter(Boolean).join(" · ")),
      };
      const more = {};
      for (const k of ["grade85", "grade95", "gradeAvg", "gradeMin", "gradeMax"]) if (v[k]) more[k.replace("grade", "").toLowerCase()] = v[k];
      if (Object.keys(more).length) row.m = more;
      if (row.g.every((x) => x == null)) delete row.g;
      rows.push(row);
      extraRows++;
    }
  }
}

// drop rows that carry nothing (0 모집, no cuts, no reason), then sort for display:
// university, year (new first), type, 전형, original order
const kept = rows
  .map((r, i) => ({ r, i }))
  .filter(({ r }) => !(r.r === "0" && !r.g && !r.s && r.x == null))
  .sort(
    (A, B) =>
      universities[A.r.u].adigaName.localeCompare(universities[B.r.u].adigaName, "ko") ||
      B.r.y - A.r.y ||
      A.r.t - B.r.t ||
      (A.r.f ?? -1) - (B.r.f ?? -1) ||
      (admissions.list[A.r.a] ?? "").localeCompare(admissions.list[B.r.a] ?? "", "ko") ||
      A.i - B.i,
  )
  .map(({ r }) => r);
rows.length = 0;
rows.push(...kept);

const out = {
  universities,
  types: TYPES,
  cuts: CUTS,
  admissions: admissions.list,
  captions: captions.list,
  periods: periods.list,
  units: units.list,
  withheld: withheld.list,
  files,
  rows,
};
fs.writeFileSync(path.join(root, "src", "data", "admissions.json"), JSON.stringify(out));
const with90 = rows.filter((r) => r.g && r.g[3] != null).length;
console.log(
  `admissions: ${rows.length} rows (${extraRows} from university files, ${duplicateRows} file rows skipped as 어디가 duplicates), ${universities.length} universities, ${with90} rows with 90% cut`,
);
