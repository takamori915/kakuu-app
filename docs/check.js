/* 書き順チェック: 書いた1画を、見本の線(骨格)と比べて、合っているか決める。
   座標は 600×600 の空間。点は [x, y]。ブラウザでも Node でも使える。 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KakuuCheck = factory();
})(typeof self !== "undefined" ? self : this, function () {
  /* しきい値(600の空間で)。start=始点のずれ、shape=形のずれ(平均)、shift=位置がずれても許す大きさ */
  const LEVELS = {
    easy:   { start: 125, shape: 70, shift: 80 },
    normal: { start: 95,  shape: 52, shift: 55 },
    strict: { start: 65,  shape: 38, shift: 0 },
  };
  const N = 24;

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function pathLength(p) { let s = 0; for (let i = 1; i < p.length; i++) s += dist(p[i - 1], p[i]); return s; }

  /* 長さに沿って n 個の点に取り直す */
  function resample(p, n = N) {
    if (p.length === 0) return [];
    const total = pathLength(p);
    if (p.length === 1 || total === 0) return Array.from({ length: n }, () => p[0].slice());
    const cum = [0];
    for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + dist(p[i - 1], p[i]));
    const out = [];
    let j = 1;
    for (let k = 0; k < n; k++) {
      const t = (total * k) / (n - 1);
      while (j < p.length - 1 && cum[j] < t) j++;
      const seg = cum[j] - cum[j - 1] || 1;
      const r = Math.min(1, Math.max(0, (t - cum[j - 1]) / seg));
      out.push([p[j - 1][0] + (p[j][0] - p[j - 1][0]) * r, p[j - 1][1] + (p[j][1] - p[j - 1][1]) * r]);
    }
    return out;
  }

  function meanDist(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += dist(a[i], b[i]); return s / a.length; }
  function centroid(a) { let x = 0, y = 0; a.forEach((p) => { x += p[0]; y += p[1]; }); return [x / a.length, y / a.length]; }
  const tolFor = (lv, expLen) => ({
    start: Math.min(lv.start, Math.max(48, expLen * 0.7)),
    shape: Math.min(lv.shape, Math.max(30, expLen * 0.45)),
    shift: Math.min(lv.shift, Math.max(0, expLen * 0.4)),
  });

  /* 1つの見本の画と、書いた線を比べる */
  function evaluate(user, expected, level) {
    const lv = LEVELS[level] || LEVELS.easy;
    const expLen = pathLength(expected);
    const tol = tolFor(lv, expLen);
    const ulen = pathLength(user);
    if (user.length < 2 || ulen < Math.max(14, expLen * 0.3)) return { ok: false, reason: "short", d: Infinity };
    const u = resample(user), e = resample(expected);
    const d = meanDist(u, e);
    const sd = dist(u[0], e[0]);
    if (d <= tol.shape && sd <= tol.start) return { ok: true, reason: "ok", d, shifted: false };
    /* 位置が少しずれているだけなら、形が合っていれば受け入れる */
    const cu = centroid(u), ce = centroid(e);
    const off = dist(cu, ce);
    if (tol.shift > 0 && off <= tol.shift) {
      const moved = u.map((p) => [p[0] + ce[0] - cu[0], p[1] + ce[1] - cu[1]]);
      const d2 = meanDist(moved, e);
      if (d2 <= tol.shape * 0.75) return { ok: true, reason: "ok", d: d2, shifted: true };
    }
    /* 反対向きに書いた? */
    const dr = meanDist(u.slice().reverse(), e);
    if (dr <= tol.shape * 1.1 && dr < d * 0.7) return { ok: false, reason: "reverse", d };
    if (d <= tol.shape * 1.3 && sd > tol.start) return { ok: false, reason: "start", d };
    return { ok: false, reason: "shape", d };
  }

  /* いま書く画(cur)に合っているか。ほかの画に合っていたら「書き順がちがう」 */
  function judge(user, strokes, cur, done, level) {
    const here = evaluate(user, strokes[cur], level);
    let best = null;
    for (let j = 0; j < strokes.length; j++) {
      if (j === cur || done.has(j)) continue;
      const r = evaluate(user, strokes[j], level);
      if (r.ok && (!best || r.d < best.d)) best = { index: j, d: r.d };
    }
    if (here.ok && !(best && best.d < here.d - 10)) return here;
    if (best) return { ok: false, reason: "order", index: best.index, d: best.d };
    return here.ok ? { ok: false, reason: "shape", d: here.d } : here;
  }

  return { LEVELS, resample, pathLength, evaluate, judge, meanDist };
});
