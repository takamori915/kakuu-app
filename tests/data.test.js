const test = require("node:test");
const assert = require("node:assert");
const D = require("../docs/data.js");

const rec = (practice, lastDate = "2026-11-01") => ({ practice, stage1Done: practice, stage2Done: 0, peeks: 0, hints: 0, lastDate, wrongStrokes: {} });

test("書き出して、そのまま読み込める", () => {
  const state = { settings: { peekSeconds: 4, strictness: "normal", speech: false }, records: { 雨: rec(3) }, marks: { 雨: "done" } };
  const out = D.makeExport(state, new Date("2026-11-24T07:00:00Z"));
  assert.strictEqual(out.app, "kakuu");
  const r = D.parse(JSON.stringify(out));
  assert.ok(r.ok);
  assert.deepStrictEqual(r.data.records["雨"].practice, 3);
  assert.strictEqual(r.data.settings.peekSeconds, 4);
  assert.strictEqual(r.data.marks["雨"], "done");
});

test("ちがうファイルは読み込まない", () => {
  assert.strictEqual(D.parse("これはJSONではない").error, "json");
  assert.strictEqual(D.parse(JSON.stringify({ app: "other" })).error, "app");
  assert.strictEqual(D.parse(JSON.stringify({ app: "kakuu", version: 99, records: {} })).error, "version");
  assert.strictEqual(D.parse(JSON.stringify({ app: "kakuu", version: 1 })).error, "records");
});

test("へんな値は直す・捨てる", () => {
  const r = D.parse(JSON.stringify({ app: "kakuu", version: 1,
    settings: { peekSeconds: 99, strictness: "x", speech: "yes" },
    records: { 雨: { practice: -5, peeks: "a", lastDate: "昨日", wrongStrokes: { 2: 3, abc: 1 } }, 長すぎるキー: rec(1) },
    marks: { 雨: "done", 水: "hacked" } }));
  assert.ok(r.ok);
  assert.deepStrictEqual(r.data.settings, D.DEFAULT_SETTINGS);
  assert.strictEqual(r.data.records["雨"].practice, 0);
  assert.strictEqual(r.data.records["雨"].lastDate, "");
  assert.deepStrictEqual(r.data.records["雨"].wrongStrokes, { 2: 3 });
  assert.strictEqual(r.data.records["長すぎるキー"], undefined);
  assert.deepStrictEqual(r.data.marks, { 雨: "done" });
});

test("まぜる: れんしゅうの回数が多いほうを残し、おぼえたを優先する", () => {
  const cur = { settings: {}, records: { 雨: rec(2), 水: rec(5) }, marks: { 雨: "practice", 水: "done" } };
  const inc = { settings: {}, records: { 雨: rec(4), 水: rec(1), 大: rec(1) }, marks: { 雨: "done", 水: "practice", 大: "practice" } };
  const m = D.merge(cur, inc);
  assert.strictEqual(m.records["雨"].practice, 4);
  assert.strictEqual(m.records["水"].practice, 5);
  assert.strictEqual(m.records["大"].practice, 1);
  assert.deepStrictEqual(m.marks, { 雨: "done", 水: "done", 大: "practice" });
});

test("回数が同じときは、新しい日付を残す", () => {
  const m = D.merge({ records: { 雨: rec(2, "2026-11-01") } }, { records: { 雨: rec(2, "2026-11-20") } });
  assert.strictEqual(m.records["雨"].lastDate, "2026-11-20");
});

test("summary", () => {
  const s = D.summary({ records: { 雨: rec(2), 水: rec(0) }, marks: { 雨: "done", 水: "practice", 大: "practice" } });
  assert.deepStrictEqual(s, { practiced: 1, seen: 2, done: 1 });
});
