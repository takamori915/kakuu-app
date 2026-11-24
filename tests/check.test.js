const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const C = require("../docs/check.js");
const S = JSON.parse(fs.readFileSync(path.join(__dirname, "../docs/strokes.json"), "utf8"));

/* 見本の線に、ゆれ(ノイズ)を足して「子どもが書いた線」を作る */
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
function human(p, { wobble = 8, dx = 0, dy = 0, scale = 1 } = {}) {
  const pts = C.resample(p, 40);
  const cx = 300, cy = 300;
  return pts.map(([x, y]) => [cx + (x - cx) * scale + dx + rnd() * wobble, cy + (y - cy) * scale + dy + rnd() * wobble]);
}

test("resample: 点の数と端点", () => {
  const r = C.resample([[0, 0], [100, 0]], 5);
  assert.strictEqual(r.length, 5);
  assert.deepStrictEqual(r[0], [0, 0]);
  assert.deepStrictEqual(r[4], [100, 0]);
  assert.ok(Math.abs(r[2][0] - 50) < 1e-9);
});

test("見本どおりに少しゆれて書いた線は、どの字でも合格(やさしい・ふつう)", () => {
  for (const level of ["easy", "normal"]) {
    for (const ch of Object.keys(S)) {
      const strokes = S[ch].paths;
      const done = new Set();
      strokes.forEach((p, i) => {
        const r = C.judge(human(p), strokes, i, done, level);
        assert.ok(r.ok, `${ch} ${i + 1}画目 (${level}): ${r.reason}`);
        done.add(i);
      });
    }
  }
});

test("反対向きに書くと『むき』のエラー", () => {
  const strokes = S["一"].paths;
  const r = C.judge(human(strokes[0]).reverse(), strokes, 0, new Set(), "easy");
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, "reverse");
});

test("三: 2本目を先に書くと『書き順がちがう』(順番のエラー)", () => {
  const strokes = S["三"].paths;
  const r = C.judge(human(strokes[1]), strokes, 0, new Set(), "easy");
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, "order");
  assert.strictEqual(r.index, 1);
});

test("十: たてを先に書くと順番のエラー", () => {
  const strokes = S["十"].paths;
  const r = C.judge(human(strokes[1]), strokes, 0, new Set(), "easy");
  assert.strictEqual(r.ok, false);
  assert.ok(r.reason === "order" || r.reason === "shape");
});

test("ぐちゃぐちゃな線・ごく短い線は不合格", () => {
  const strokes = S["大"].paths;
  const scribble = [[100, 100], [500, 120], [120, 480], [480, 500], [300, 300]];
  assert.strictEqual(C.judge(scribble, strokes, 0, new Set(), "easy").ok, false);
  assert.strictEqual(C.judge([[300, 300], [303, 301]], strokes, 0, new Set(), "easy").reason, "short");
});

test("位置が少しずれても(やさしい)形が合っていれば合格、大きくずれたら不合格", () => {
  const strokes = S["一"].paths;
  const near = C.judge(human(strokes[0], { dy: 60, wobble: 4 }), strokes, 0, new Set(), "easy");
  assert.ok(near.ok, near.reason);
  const far = C.judge(human(strokes[0], { dy: 220, wobble: 4 }), strokes, 0, new Set(), "easy");
  assert.strictEqual(far.ok, false);
});

test("きびしいは、位置のずれを許さない", () => {
  const strokes = S["一"].paths;
  const r = C.judge(human(strokes[0], { dy: 90, wobble: 2 }), strokes, 0, new Set(), "strict");
  assert.strictEqual(r.ok, false);
});

test("書き終えた画は、次の画の判定で無視される", () => {
  const strokes = S["二"].paths;
  const r = C.judge(human(strokes[0]), strokes, 1, new Set([0]), "easy");
  assert.strictEqual(r.ok, false);
});
