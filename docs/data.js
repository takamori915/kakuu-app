/* 学習データの書き出し・読み込み(ブラウザでも Node でも使える) */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KakuuData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const VERSION = 1;
  const DEFAULT_SETTINGS = { peekSeconds: 3, strictness: "easy", speech: true };
  const MARKS = ["practice", "done"];
  const int = (v) => (Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), 1e6) : 0);
  const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

  function cleanSettings(s) {
    s = s && typeof s === "object" ? s : {};
    const out = Object.assign({}, DEFAULT_SETTINGS);
    if ([2, 3, 4, 5].includes(Number(s.peekSeconds))) out.peekSeconds = Number(s.peekSeconds);
    if (["easy", "normal", "strict"].includes(s.strictness)) out.strictness = s.strictness;
    if (typeof s.speech === "boolean") out.speech = s.speech;
    return out;
  }
  function cleanRecord(r) {
    r = r && typeof r === "object" ? r : {};
    const w = {};
    if (r.wrongStrokes && typeof r.wrongStrokes === "object") {
      Object.keys(r.wrongStrokes).forEach((k) => { if (/^\d{1,2}$/.test(k)) w[k] = int(r.wrongStrokes[k]); });
    }
    return { practice: int(r.practice), stage1Done: int(r.stage1Done), stage2Done: int(r.stage2Done),
      peeks: int(r.peeks), hints: int(r.hints), lastDate: isDate(r.lastDate) ? r.lastDate : "", wrongStrokes: w };
  }
  function cleanRecords(rs) {
    const out = {};
    if (rs && typeof rs === "object") Object.keys(rs).forEach((k) => { if (k.length <= 2) out[k] = cleanRecord(rs[k]); });
    return out;
  }
  function cleanMarks(ms) {
    const out = {};
    if (ms && typeof ms === "object") Object.keys(ms).forEach((k) => { if (k.length <= 2 && MARKS.includes(ms[k])) out[k] = ms[k]; });
    return out;
  }

  function makeExport(state, now = new Date()) {
    return { app: "kakuu", version: VERSION, exportedAt: now.toISOString(),
      settings: cleanSettings(state.settings), records: cleanRecords(state.records), marks: cleanMarks(state.marks) };
  }
  /* 読み込んだ中身をたしかめる。だめなら { ok:false, error } */
  function parse(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: "json" }; }
    if (!obj || obj.app !== "kakuu") return { ok: false, error: "app" };
    if (obj.version !== VERSION) return { ok: false, error: "version" };
    if (typeof obj.records !== "object" || obj.records === null) return { ok: false, error: "records" };
    return { ok: true, data: { settings: cleanSettings(obj.settings), records: cleanRecords(obj.records),
      marks: cleanMarks(obj.marks), exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "" } };
  }
  const better = (a, b) => (a.practice !== b.practice ? (a.practice > b.practice ? a : b) : (a.lastDate >= b.lastDate ? a : b));
  /* まぜる: 同じ漢字は、れんしゅうの回数が多いほうを残す。しるしは「おぼえた」を優先 */
  function merge(cur, inc) {
    const records = Object.assign({}, cleanRecords(cur.records));
    const incR = cleanRecords(inc.records);
    Object.keys(incR).forEach((k) => { records[k] = records[k] ? better(records[k], incR[k]) : incR[k]; });
    const marks = Object.assign({}, cleanMarks(cur.marks));
    const incM = cleanMarks(inc.marks);
    Object.keys(incM).forEach((k) => { if (marks[k] !== "done") marks[k] = incM[k]; });
    return { settings: cleanSettings(cur.settings), records, marks };
  }
  function summary(data) {
    const rec = Object.keys(data.records).filter((k) => data.records[k].practice > 0).length;
    const m = Object.values(data.marks);
    return { practiced: rec, seen: m.filter((v) => v === "practice").length, done: m.filter((v) => v === "done").length };
  }
  return { VERSION, DEFAULT_SETTINGS, cleanSettings, cleanRecord, makeExport, parse, merge, summary };
});
