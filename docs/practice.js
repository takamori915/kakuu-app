/* れんしゅう機能: なぞる / みないで かく / みかえす / 書き順チェック / よみあげ / きろくの保存と読み込み
   index.html の本体スクリプトの後に読み込む(KANJI, marks, saveMarks, update, $, esc を使う)。 */
(function () {
  "use strict";
  const C = window.KakuuCheck, DATA = window.KakuuData;
  const SKEY = "kakuu-settings", RKEY = "kakuu-records";
  const LEVEL_LABEL = { easy: "やさしい", normal: "ふつう", strict: "きびしい" };
  const PRAISE = ["いいね!", "そう!", "じょうず!", "ばっちり!"];

  /* ---------- 保存 ---------- */
  const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) || fb; } catch (e) { return fb; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できない端末 */ } };
  let settings = DATA.cleanSettings(load(SKEY, {}));
  let records = {};
  try { records = DATA.parse(JSON.stringify({ app: "kakuu", version: 1, records: load(RKEY, {}) })).data.records; } catch (e) { records = {}; }
  const saveSettings = () => store(SKEY, settings);
  const saveRecords = () => store(RKEY, records);
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const rec = (k) => (records[k] = records[k] || DATA.cleanRecord({}));

  /* ---------- 線のデータ ---------- */
  let STROKES = null;
  fetch("strokes.json").then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => { STROKES = j; applyAvailability(); }).catch(() => { STROKES = null; });

  /* ---------- 画面の部品 ---------- */
  const sheetBody = document.querySelector(".sheet-body");
  const videoBox = document.querySelector(".video-box");
  const speedRow = document.querySelector(".speed");
  const facts = $("facts");

  const modes = document.createElement("div");
  modes.className = "modes"; modes.hidden = true;
  modes.setAttribute("role", "group"); modes.setAttribute("aria-label", "どうがと れんしゅう");
  modes.innerHTML = `<button class="chip" type="button" data-mode="video" aria-pressed="true">どうが</button>
    <button class="chip" type="button" data-mode="practice" aria-pressed="false">れんしゅう</button>`;
  videoBox.before(modes);

  const panel = document.createElement("div");
  panel.className = "practice"; panel.id = "practice"; panel.hidden = true;
  panel.innerHTML = `
    <div class="stages" role="group" aria-label="れんしゅうの だんかい">
      <button class="chip" type="button" data-stage="1" aria-pressed="true">① なぞる</button>
      <button class="chip" type="button" data-stage="2" aria-pressed="false">② みないで かく</button>
    </div>
    <div class="pad-wrap"><canvas class="pad" id="pad" width="900" height="900" tabindex="0"
      role="img" aria-label="かく ところ。ゆびか マウスで かきます"></canvas></div>
    <p class="pmsg" id="pmsg" aria-live="polite"></p>
    <div class="pbtns">
      <button class="pbtn" type="button" id="pPeek" hidden>👀 みかえす</button>
      <button class="pbtn" type="button" id="pHint" hidden>💡 ヒント</button>
      <button class="pbtn" type="button" id="pReset">やりなおす</button>
      <button class="pbtn primary" type="button" id="pNext" hidden></button>
      <button class="pbtn" type="button" id="pDone" hidden>おぼえた にする</button>
    </div>`;
  videoBox.after(panel);

  const sayRow = document.createElement("div");
  sayRow.className = "say-row"; sayRow.hidden = true;
  facts.after(sayRow);

  const pad = $("pad"), ctx = pad.getContext("2d"), msg = $("pmsg");
  ctx.scale(1.5, 1.5);

  /* ---------- 練習の状態 ---------- */
  let cur = null;             /* いま開いている字 */
  let mode = "video";
  const P = { stage: 1, strokes: [], done: new Set(), lines: [], n: 0, drawing: null, flash: null,
    ghostUntil: 0, hintUntil: 0, finished: false, peeks: 0, hints: 0, wrong: {}, saved: false };
  const now = () => performance.now();

  function resetPractice(stage) {
    P.stage = stage || P.stage;
    P.strokes = cur && STROKES && STROKES[cur.k] ? STROKES[cur.k].paths : [];
    Object.assign(P, { done: new Set(), lines: [], n: 0, drawing: null, flash: null, ghostUntil: 0, hintUntil: 0,
      finished: false, peeks: 0, hints: 0, wrong: {}, saved: false });
    panel.querySelectorAll("[data-stage]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.stage) === P.stage)));
    $("pPeek").hidden = $("pHint").hidden = P.stage !== 2;
    $("pNext").hidden = true; $("pDone").hidden = true;
    say_(P.stage === 1 ? "① の まるから、うすい せんを なぞってね" : "みほんを けしたよ。おもいだして かいてみよう");
    draw();
  }
  function say_(t, cls) { msg.textContent = t; msg.className = "pmsg" + (cls ? " " + cls : ""); }

  /* ---------- 描く ---------- */
  const col = (n, fb) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;
  function strokePath(pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); }
  function line(pts, w, color, alpha = 1) {
    if (!pts.length) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (pts.length === 1) pts = [pts[0], [pts[0][0] + .1, pts[0][1]]];
    strokePath(pts); ctx.stroke(); ctx.restore();
  }
  function badge(i) {
    const p = P.strokes[i] && P.strokes[i][0]; if (!p) return;
    ctx.save();
    ctx.fillStyle = col("--accent", "#0f7fc0"); ctx.beginPath(); ctx.arc(p[0], p[1], 22, 0, 7); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "700 24px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), p[0], p[1] + 1); ctx.restore();
  }
  function draw() {
    const t = now(), accent = col("--accent", "#0f7fc0"), ink = col("--ink", "#1b2230"), guide = col("--guide", "#b5d9ee"), card = col("--card", "#fff");
    ctx.clearRect(0, 0, 600, 600);
    ctx.fillStyle = card; ctx.fillRect(0, 0, 600, 600);
    ctx.save(); ctx.strokeStyle = guide; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(300, 0); ctx.lineTo(300, 600); ctx.moveTo(0, 300); ctx.lineTo(600, 300); ctx.stroke(); ctx.restore();
    if (!P.strokes.length) return;
    if (P.stage === 1 && !P.finished) {
      P.strokes.forEach((s, i) => { if (!P.done.has(i)) line(s, 46, ink, 0.1); });
      if (P.n < P.strokes.length) line(P.strokes[P.n], 46, accent, 0.28);
    }
    if (P.stage === 2 && t < P.ghostUntil) P.strokes.forEach((s) => line(s, 46, accent, 0.28));
    if (t < P.hintUntil && P.n < P.strokes.length) line(P.strokes[P.n], 46, accent, 0.4);
    P.lines.forEach((l) => line(l, 24, ink, 0.92));
    if (P.flash && t < P.flash.until) line(P.flash.pts, 24, "#e5484d", 0.9);
    if (P.drawing) line(P.drawing.pts, 24, ink, 0.8);
    if (P.finished && P.stage === 2) P.strokes.forEach((s) => line(s, 5, accent, 0.95));   /* みほんを かさねる */
    if (!P.finished && P.n < P.strokes.length && (P.stage === 1 || t < P.hintUntil)) badge(P.n);
  }
  const later = (ms) => setTimeout(draw, ms + 30);

  /* ---------- 書く ---------- */
  const toPt = (e) => { const r = pad.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 600, (e.clientY - r.top) / r.height * 600]; };
  pad.addEventListener("pointerdown", (e) => {
    if (!P.strokes.length || P.finished || P.drawing) return;
    e.preventDefault(); pad.setPointerCapture(e.pointerId);
    P.drawing = { id: e.pointerId, pts: [toPt(e)] }; draw();
  });
  pad.addEventListener("pointermove", (e) => {
    const d = P.drawing; if (!d || d.id !== e.pointerId) return;
    const p = toPt(e), q = d.pts[d.pts.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 2) { d.pts.push(p); draw(); }
  });
  const end = (e) => {
    const d = P.drawing; if (!d || d.id !== e.pointerId) return;
    P.drawing = null;
    if (e.type !== "pointercancel") judge(d.pts);
    draw();
  };
  pad.addEventListener("pointerup", end);
  pad.addEventListener("pointercancel", end);

  function judge(pts) {
    if (pts.length < 2) return;
    const r = C.judge(pts, P.strokes, P.n, P.done, settings.strictness);
    if (r.ok) {
      P.done.add(P.n); P.lines.push(pts); P.n++;
      if (P.n >= P.strokes.length) return finish();
      say_(r.shifted ? "かたちは ばっちり! いちが すこし ずれたよ" : PRAISE[P.n % PRAISE.length], "good");
      return;
    }
    P.wrong[P.n] = (P.wrong[P.n] || 0) + 1;
    P.flash = { pts, until: now() + 450 }; later(450);
    const hint = () => { P.hintUntil = now() + 1800; later(1800); };
    if (r.reason === "order") { say_(`かきじゅんが ちがうよ。いまは ${P.n + 1}かくめ だよ`, "warn"); hint(); }
    else if (r.reason === "reverse") { say_("むきが ぎゃくだよ。まるの ほうから かいてね", "warn"); hint(); }
    else if (r.reason === "start") { say_("はじまりを まるの ちかくに してね", "warn"); hint(); }
    else if (r.reason === "short") say_("もうすこし ながく、ひとふでで かいてね", "warn");
    else say_("おしい! もういっかい", "warn");
  }

  function finish() {
    P.finished = true;
    $("pPeek").hidden = $("pHint").hidden = true;
    if (cur && !P.saved) {
      P.saved = true;
      const r = rec(cur.k);
      r.practice++; r.lastDate = today(); r.peeks += P.peeks; r.hints += P.hints;
      if (P.stage === 1) r.stage1Done++; else r.stage2Done++;
      Object.keys(P.wrong).forEach((i) => { r.wrongStrokes[i] = (r.wrongStrokes[i] || 0) + P.wrong[i]; });
      saveRecords(); refreshSummary();
    }
    if (P.stage === 1) {
      say_("できた! つぎは みないで かいてみよう", "good");
      $("pNext").textContent = "② みないで かく →"; $("pNext").hidden = false; $("pNext").dataset.go = "2";
    } else {
      say_(P.peeks === 0 && P.hints === 0 ? "ひとりで かけた! すごい! あおい せんが おてほんだよ" : "できた! あおい せんが おてほんだよ。くらべてみよう", "good");
      $("pNext").textContent = "もういちど"; $("pNext").hidden = false; $("pNext").dataset.go = "again";
      $("pDone").hidden = false;
    }
    draw();
  }

  /* ---------- ボタン ---------- */
  panel.addEventListener("click", (e) => {
    const st = e.target.closest("[data-stage]");
    if (st) return resetPractice(Number(st.dataset.stage));
  });
  $("pReset").addEventListener("click", () => resetPractice());
  $("pNext").addEventListener("click", (e) => { const g = e.currentTarget.dataset.go; resetPractice(g === "2" ? 2 : P.stage); });
  $("pPeek").addEventListener("click", () => {
    if (P.finished) return;
    P.peeks++; P.ghostUntil = now() + settings.peekSeconds * 1000; later(settings.peekSeconds * 1000);
    say_(`みほんを ${settings.peekSeconds}びょう だけ みせるよ`); draw();
  });
  $("pHint").addEventListener("click", () => {
    if (P.finished) return;
    P.hints++; P.hintUntil = now() + 2500; later(2500); say_(`つぎは ${P.n + 1}かくめ。まるから はじめよう`); draw();
  });
  $("pDone").addEventListener("click", () => {
    if (!cur) return;
    marks[cur.k] = "done"; saveMarks(); update(); $("pDone").hidden = true; say_("「おぼえた」に したよ!", "good");
  });

  /* ---------- どうが / れんしゅう の切りかえ ---------- */
  function setMode(m) {
    if (m === "practice" && !(cur && STROKES && STROKES[cur.k])) m = "video";
    mode = m;
    modes.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
    videoBox.hidden = speedRow.hidden = m === "practice";
    panel.hidden = m !== "practice";
    const v = $("video");
    if (m === "practice") { v.pause(); resetPractice(); } else if (cur && v.src) v.play().catch(() => {});
  }
  modes.addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (b) setMode(b.dataset.mode); });
  function applyAvailability() { if (cur) { modes.hidden = !(STROKES && STROKES[cur.k]); if (modes.hidden && mode === "practice") setMode("video"); } }

  /* ---------- よみあげ・こえに だす ---------- */
  const canSpeak = "speechSynthesis" in window;
  function speak(text) {
    if (!settings.speech || !canSpeak || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = "ja-JP"; u.rate = 0.85;
      const v = speechSynthesis.getVoices().find((x) => /^ja/i.test(x.lang)); if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* 読み上げできない端末 */ }
  }
  const readingText = (d) => d.sub ? d.sub.split(" ")[0]
    : `${d.on.length ? "おんよみ、" + d.on.join("、") + "。" : ""}${d.kun.length ? "くんよみ、" + d.kun.join("、") + "。" : ""}`;
  let masked = false;
  function buildSayRow() {
    sayRow.hidden = !(canSpeak && settings.speech && cur);
    if (sayRow.hidden) { facts.classList.remove("masked"); return; }
    masked = false; facts.classList.remove("masked");
    const words = (cur.words || []).map(([w, r]) => `<button class="pbtn word" type="button" data-say="${esc(r)}">🔊 ${esc(w)}</button>`).join("");
    sayRow.innerHTML = `<button class="pbtn" type="button" data-act="read">🔊 よみを きく</button>
      <button class="pbtn" type="button" data-act="quiz">🗣 こえに だして よんでみよう</button>${words}`;
  }
  sayRow.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || !cur) return;
    if (b.dataset.say) return speak(b.dataset.say);
    if (b.dataset.act === "read") return speak(readingText(cur));
    if (b.dataset.act === "quiz") {
      if (!masked) { masked = true; facts.classList.add("masked"); b.textContent = "✅ こたえを きく"; }
      else { masked = false; facts.classList.remove("masked"); b.textContent = "🗣 こえに だして よんでみよう"; speak(readingText(cur)); }
    }
  });

  /* ---------- 本体との連携 ---------- */
  document.addEventListener("kakuu:show", (e) => {
    cur = e.detail.d;
    modes.hidden = !(STROKES && STROKES[cur.k]);
    buildSayRow();
    if (mode === "practice" && !modes.hidden) setMode("practice"); else setMode("video");
  });
  document.addEventListener("kakuu:close", () => { cur = null; if (canSpeak) { try { speechSynthesis.cancel(); } catch (e) { /* */ } } });
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  /* ---------- せってい・きろく ---------- */
  const set = document.createElement("div");
  set.className = "scrim"; set.id = "setScrim"; set.hidden = true;
  set.innerHTML = `<div class="sheet small" role="dialog" aria-modal="true" aria-labelledby="setTitle">
    <div class="sheet-head"><h2 id="setTitle">せってい・きろく</h2><button class="icon-btn" id="setClose" type="button" aria-label="とじる">×</button></div>
    <div class="set-body">
      <div class="set-row"><label for="setPeek">みかえす じかん</label>
        <select id="setPeek"><option value="2">2びょう</option><option value="3">3びょう</option><option value="4">4びょう</option><option value="5">5びょう</option></select></div>
      <div class="set-row"><label for="setLevel">かきじゅんの チェック</label>
        <select id="setLevel"><option value="easy">やさしい</option><option value="normal">ふつう</option><option value="strict">きびしい</option></select></div>
      <div class="set-row"><label class="check"><input type="checkbox" id="setSpeech">よみあげを つかう</label></div>
      <hr class="set-hr">
      <div class="set-row"><span class="lbl">れんしゅうの きろく</span><p class="set-note" id="setSummary"></p></div>
      <div class="set-actions">
        <button class="pbtn primary" type="button" id="setExport">きろくを かきだす</button>
        <button class="pbtn" type="button" id="setImportBtn">きろくを よみこむ</button>
        <input class="sr-only" type="file" id="setFile" accept="application/json,.json" tabindex="-1">
      </div>
      <div class="import-box" id="importBox" hidden>
        <p class="set-note" id="importInfo"></p>
        <div class="set-actions">
          <button class="pbtn primary" type="button" id="impMerge">いまの きろくに まぜる</button>
          <button class="pbtn" type="button" id="impReplace">ぜんぶ おきかえる</button>
          <button class="pbtn" type="button" id="impCancel">やめる</button>
        </div>
      </div>
      <p class="set-msg" id="setMsg" aria-live="polite"></p>
      <p class="set-note">きろくは、この ブラウザの なかに だけ のこります。きかいを かえるときは「かきだす」で ファイルに ほぞんして、あたらしい ほうで「よみこむ」を してね。</p>
    </div></div>`;
  document.body.appendChild(set);
  const foot = document.querySelector(".foot");
  const openBtn = document.createElement("button");
  openBtn.type = "button"; openBtn.className = "link-btn"; openBtn.id = "openSettings"; openBtn.textContent = "せってい・きろくの ほぞん";
  foot.appendChild(openBtn);

  const setMsg = (t, bad) => { $("setMsg").textContent = t; $("setMsg").className = "set-msg" + (bad ? " bad" : ""); };
  const state = () => ({ settings, records, marks });
  function refreshSummary() {
    const s = DATA.summary(state());
    $("setSummary").textContent = `れんしゅうした もじ ${s.practiced}こ ・ みた ${s.seen}こ ・ おぼえた ${s.done}こ`;
  }
  function openSettings() {
    $("setPeek").value = String(settings.peekSeconds); $("setLevel").value = settings.strictness; $("setSpeech").checked = settings.speech;
    setMsg(""); $("importBox").hidden = true; refreshSummary(); set.hidden = false; $("setClose").focus();
  }
  const closeSettings = () => { set.hidden = true; openBtn.focus(); };
  openBtn.addEventListener("click", openSettings);
  $("setClose").addEventListener("click", closeSettings);
  set.addEventListener("click", (e) => { if (e.target === set) closeSettings(); });
  document.addEventListener("keydown", (e) => { if (!set.hidden && e.key === "Escape") closeSettings(); });
  $("setPeek").addEventListener("change", (e) => { settings.peekSeconds = Number(e.target.value); saveSettings(); });
  $("setLevel").addEventListener("change", (e) => { settings.strictness = e.target.value; saveSettings(); });
  $("setSpeech").addEventListener("change", (e) => { settings.speech = e.target.checked; saveSettings(); if (!settings.speech && canSpeak) speechSynthesis.cancel(); });

  $("setExport").addEventListener("click", () => {
    const data = DATA.makeExport(state());
    const d = new Date(), ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `kakuu-data-${ymd}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    setMsg(`「kakuu-data-${ymd}.json」を かきだしたよ`);
  });
  let incoming = null;
  $("setImportBtn").addEventListener("click", () => $("setFile").click());
  $("setFile").addEventListener("change", (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    if (f.size > 2e6) return setMsg("ファイルが おおきすぎて よみこめません", true);
    const rd = new FileReader();
    rd.onload = () => {
      const r = DATA.parse(String(rd.result));
      if (!r.ok) { incoming = null; $("importBox").hidden = true; return setMsg("このファイルは よみこめませんでした。カクーで かきだした ファイルを えらんでね", true); }
      incoming = r.data; const s = DATA.summary(incoming);
      $("importInfo").textContent = `ファイルの なかみ: れんしゅうした もじ ${s.practiced}こ ・ みた ${s.seen}こ ・ おぼえた ${s.done}こ。どうしますか?`;
      $("importBox").hidden = false; setMsg("");
    };
    rd.onerror = () => setMsg("ファイルを よめませんでした", true);
    rd.readAsText(f);
  });
  function applyData(next) {
    settings = next.settings; records = next.records;
    Object.keys(marks).forEach((k) => delete marks[k]); Object.assign(marks, next.marks);
    saveSettings(); saveRecords(); saveMarks(); update(); refreshSummary();
    $("setPeek").value = String(settings.peekSeconds); $("setLevel").value = settings.strictness; $("setSpeech").checked = settings.speech;
    $("importBox").hidden = true; incoming = null;
  }
  $("impMerge").addEventListener("click", () => { if (!incoming) return; applyData(DATA.merge(state(), incoming)); setMsg("まぜて よみこんだよ", false); });
  $("impReplace").addEventListener("click", () => { if (!incoming) return; applyData({ settings: incoming.settings, records: incoming.records, marks: incoming.marks }); setMsg("おきかえて よみこんだよ", false); });
  $("impCancel").addEventListener("click", () => { incoming = null; $("importBox").hidden = true; setMsg("よみこみを やめたよ"); });

  window.KakuuPractice = { get settings() { return settings; }, get records() { return records; } };   /* テスト用 */
})();
