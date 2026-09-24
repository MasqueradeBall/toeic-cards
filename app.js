/* TOEIC 800+ 単語カード 本体
 * 右スワイプ：わかった ／ 左スワイプ：まだ ／ 上スワイプ：マーカー ／ タップ：めくる
 */
const WORDS = WORDS_DATA.map(([w, pos, ja, ex, exja]) => ({ id: w, w, pos, ja, ex, exja }));
const MASTER = 3;          // 3回連続「わかった」で習得
const SWIPE_X = 110;       // 判定に必要な横移動量(px)
const SWIPE_UP = 120;      // マーカー判定に必要な上移動量(px)

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- 出題キュー ---------- */
let filter = "all", queue = [], cur = null, flipped = false, busy = false, history = [];

function inFilter(w) {
  const r = Store.peek(w.id);
  if (filter === "new") return !r || r.s < MASTER;
  if (filter === "weak") return r && r.x > 0 && r.s < MASTER && r.x >= r.c;
  if (filter === "marked") return r && r.k;
  return true;
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function buildQueue() { queue = shuffle(WORDS.filter(inFilter)); history = []; nextCard(); }
function nextCard() { cur = queue.shift() || null; flipped = false; renderStudy(); }

/* ---------- 学習画面の描画 ---------- */
function cardFront(w, marked) {
  return `<div class="face front">
      <span class="hole"></span>
      <p class="word ${marked ? "marked" : ""}">${esc(w.w)}</p>
      <p class="pos">${esc(w.pos)}</p>
      <span class="tapHint">タップして意味を見る</span>
    </div>`;
}

function renderStudy() {
  const el = $("studyArea");
  if (!cur) {
    const pool = WORDS.filter(inFilter).length;
    const msg = {
      all: ["一周しました", "もう一度シャッフルして始められます。"],
      new: ["未習得の単語はありません", "すべて3回連続で正解しています。"],
      weak: ["苦手な単語はありません", "左にスワイプした単語がここに集まります。"],
      marked: ["マーカーを引いた単語はありません", "カードを上にスワイプするとマーカーが引けます。"]
    }[filter];
    const done = pool && filter !== "all";
    el.innerHTML = `<div class="empty"><strong>${done ? "この範囲を一周しました" : msg[0]}</strong>${done ? "もう一度シャッフルして始められます。" : msg[1]}</div>
      ${pool ? `<button class="wide" id="again">もう一度始める</button>` : ""}`;
    if ($("again")) $("again").onclick = buildQueue;
    return;
  }

  const r = Store.get(cur.id);
  const next = queue[0];
  el.innerHTML = `
    <div class="deck">
      ${next ? `<div class="swipe behind"><div class="flip">${cardFront(next, Store.peek(next.id)?.k)}</div></div>` : ""}
      <div class="swipe" id="top" tabindex="0" aria-label="${esc(cur.w)}。タップでめくる、左右にスワイプで採点">
        <span class="stamp ok" id="stOk">わかった</span>
        <span class="stamp ng" id="stNg">まだ</span>
        <span class="stamp mk" id="stMk">マーカー</span>
        <div class="flip ${flipped ? "flipped" : ""}" id="flip">
          ${cardFront(cur, r.k)}
          <div class="face back">
            <span class="hole"></span>
            <button class="speak" id="speak" aria-label="発音を聞く">🔊</button>
            <p class="bword">${esc(cur.w)} <small>${esc(cur.pos)}</small></p>
            <p class="meaning">${esc(cur.ja)}</p>
            <p class="ex">${esc(cur.ex)}</p>
            <p class="exja">${esc(cur.exja)}</p>
            <p class="rec">わかった ${r.c}回 ／ まだ ${r.x}回${r.s >= MASTER ? " ／ 習得済み" : ""}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="actions">
      <button class="act sm" id="undo" aria-label="1枚戻す" ${history.length ? "" : "disabled"}>↶</button>
      <button class="act lg ng" id="btnNg" aria-label="まだ">✕</button>
      <button class="act lg ok" id="btnOk" aria-label="わかった">✓</button>
      <button class="act sm mk" id="btnMk" aria-label="マーカー" aria-pressed="${r.k ? "true" : "false"}">🖍</button>
    </div>
    <p class="guide">← まだ　　↑ マーカー　　わかった →</p>`;

  const top = $("top");
  attachSwipe(top);
  $("speak").addEventListener("pointerdown", e => e.stopPropagation());
  $("speak").onclick = e => { e.stopPropagation(); speak(cur.w); };
  $("btnOk").onclick = () => judge("ok");
  $("btnNg").onclick = () => judge("ng");
  $("btnMk").onclick = () => toggleMark();
  $("undo").onclick = undo;
}

/* ---------- スワイプ操作 ---------- */
function setStamps(dx, dy) {
  $("stOk").style.opacity = Math.max(0, Math.min(1, dx / SWIPE_X));
  $("stNg").style.opacity = Math.max(0, Math.min(1, -dx / SWIPE_X));
  $("stMk").style.opacity = Math.abs(dy) > Math.abs(dx) ? Math.max(0, Math.min(1, -dy / SWIPE_UP)) : 0;
}
function snapBack(el) {
  el.classList.add("animating");
  el.style.transform = "";
  setStamps(0, 0);
}

function attachSwipe(el) {
  let sx = 0, sy = 0, dx = 0, dy = 0, t0 = 0, pid = null;

  el.addEventListener("pointerdown", e => {
    if (busy) return;
    pid = e.pointerId; el.setPointerCapture(pid);
    sx = e.clientX; sy = e.clientY; dx = dy = 0; t0 = Date.now();
    el.classList.remove("animating");
  });
  el.addEventListener("pointermove", e => {
    if (e.pointerId !== pid) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.05}deg)`;
    setStamps(dx, dy);
  });
  el.addEventListener("pointerup", e => {
    if (e.pointerId !== pid) return;
    pid = null;
    const speed = Math.abs(dx) / Math.max(1, Date.now() - t0);
    if (Math.hypot(dx, dy) < 8) { snapBack(el); flip(); return; }
    if (Math.abs(dx) > SWIPE_X || (speed > 0.6 && Math.abs(dx) > 40)) { judge(dx > 0 ? "ok" : "ng"); return; }
    if (-dy > SWIPE_UP && Math.abs(dy) > Math.abs(dx)) { snapBack(el); toggleMark(); return; }
    snapBack(el);
  });
  el.addEventListener("pointercancel", () => { pid = null; snapBack(el); });
}

function flip() {
  flipped = !flipped;
  $("flip").classList.toggle("flipped", flipped);
}

/* ---------- 採点・マーカー・戻す ---------- */
function judge(dir) {
  if (busy || !cur) return;
  busy = true;
  const el = $("top");
  const x = (dir === "ok" ? 1 : -1) * window.innerWidth * 1.5;
  $(dir === "ok" ? "stOk" : "stNg").style.opacity = 1;
  el.classList.add("animating");
  el.style.transform = `translate(${x}px, 40px) rotate(${dir === "ok" ? 24 : -24}deg)`;

  setTimeout(() => {
    const prev = Store.has(cur.id) ? { ...Store.peek(cur.id) } : null;
    history.push({ word: cur, prev });
    if (history.length > 50) history.shift();
    const r = Store.get(cur.id);
    if (dir === "ok") { r.c++; r.s++; }
    else { r.x++; r.s = 0; queue.push(cur); }   // 「まだ」の単語はこの周の最後にもう一度
    Store.touch(cur.id);
    busy = false;
    updateHead();
    nextCard();
  }, 260);
}

function toggleMark() {
  if (!cur) return;
  const r = Store.get(cur.id);
  r.k = r.k ? 0 : 1;
  Store.touch(cur.id);
  document.querySelectorAll("#top .word").forEach(n => n.classList.toggle("marked", !!r.k));
  $("btnMk").setAttribute("aria-pressed", r.k ? "true" : "false");
  const st = $("stMk");
  st.textContent = r.k ? "マーカー" : "マーカー解除";
  st.style.opacity = 1;
  setTimeout(() => { if ($("stMk")) $("stMk").style.opacity = 0; }, 600);
  renderBadge();
}

function undo() {
  if (busy || !history.length) return;
  const h = history.pop();
  Store.set(h.word.id, h.prev);
  queue = queue.filter(w => w !== h.word);
  if (cur) queue.unshift(cur);
  cur = h.word; flipped = false;
  updateHead(); renderBadge(); renderStudy();
}

function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = 0.9;
    speechSynthesis.speak(u);
  } catch (e) {}
}

/* ---------- チェックリスト ---------- */
const markedWords = () => WORDS.filter(w => Store.peek(w.id)?.k);

function renderList() {
  const list = markedWords();
  $("listInfo").textContent = list.length ? `マーカーを引いた単語 ${list.length}語` : "";
  $("pdfBtn").disabled = !list.length;
  const el = $("listArea");
  if (!list.length) {
    el.innerHTML = `<div class="empty"><strong>まだ単語がありません</strong>学習中にカードを上にスワイプするか🖍を押すと、ここに表としてまとまります。</div>`;
    return;
  }
  el.innerHTML = `<div class="tablewrap"><table>
    <thead><tr><th>英単語</th><th>意味</th><th>正解</th><th></th></tr></thead>
    <tbody>${list.map(w => {
      const r = Store.peek(w.id);
      return `<tr>
        <td class="w">${esc(w.w)}</td>
        <td>${esc(w.ja)}<br><span style="color:var(--sub);font-size:12px">${esc(w.pos)}</span></td>
        <td class="n">${r.c}/${r.c + r.x}</td>
        <td><button class="unmark" data-id="${esc(w.id)}" aria-label="${esc(w.w)}のマーカーを外す">×</button></td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
  el.querySelectorAll(".unmark").forEach(b => b.onclick = () => {
    Store.get(b.dataset.id).k = 0; Store.touch(b.dataset.id);
    renderList(); renderBadge();
  });
}

$("pdfBtn").onclick = async () => {
  const btn = $("pdfBtn"), st = $("pdfStatus");
  btn.disabled = true;
  try { await Pdf.save(markedWords(), msg => st.textContent = msg); }
  catch (e) { st.textContent = "PDFを作成できませんでした。もう一度お試しください。"; }
  btn.disabled = false;
};

/* ---------- 記録 ---------- */
function renderStats() {
  let ans = 0, ok = 0, mastered = 0, seen = 0;
  WORDS.forEach(w => {
    const r = Store.peek(w.id); if (!r) return;
    ans += r.c + r.x; ok += r.c;
    if (r.c + r.x) seen++;
    if (r.s >= MASTER) mastered++;
  });
  const acc = ans ? Math.round(ok / ans * 100) : 0;
  const weak = WORDS.filter(w => Store.peek(w.id)?.x > 0)
    .sort((a, b) => (Store.peek(b.id).x - Store.peek(b.id).c) - (Store.peek(a.id).x - Store.peek(a.id).c))
    .slice(0, 10);

  $("statsArea").innerHTML = `
    <div class="stats">
      <div class="stat"><b>${mastered}</b><span>習得 / ${WORDS.length}語</span></div>
      <div class="stat"><b>${acc}<small style="font-size:14px">%</small></b><span>正答率</span></div>
      <div class="stat"><b>${ans}</b><span>回答数</span></div>
    </div>
    <h2>習得の進み具合</h2>
    <div class="bar"><i style="width:${mastered / WORDS.length * 100}%"></i></div>
    <h2>「まだ」が多い単語</h2>
    ${weak.length
      ? `<div class="tablewrap"><table><tbody>${weak.map(w => `<tr><td class="w">${esc(w.w)}</td><td>${esc(w.ja)}</td><td class="n">まだ ${Store.peek(w.id).x}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty">まだ記録がありません。学習タブでカードをスワイプしてみましょう。</div>`}
    <p class="note">3回連続で「わかった」にすると習得になります。${seen}語に回答済み。記録はこの端末のブラウザに保存されます。</p>
    <div class="backup">
      <button id="exportBtn">記録を書き出す</button>
      <button id="importBtn">記録を読み込む</button>
      <button class="danger" id="resetBtn">記録をすべて消す</button>
    </div>`;

  $("exportBtn").onclick = () => {
    const blob = new Blob([Store.exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "toeic800_backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("importBtn").onclick = () => $("importFile").click();
  $("resetBtn").onclick = () => {
    if (!confirm("正解の記録とマーカーをすべて消去します。よろしいですか？")) return;
    Store.reset(); renderAll(); buildQueue();
  };
}

$("importFile").onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    Store.importJson(await f.text());
    alert("記録を読み込みました。");
    renderAll(); buildQueue();
  } catch (err) {
    alert("このファイルは読み込めませんでした。書き出したバックアップファイルを選んでください。");
  }
  e.target.value = "";
};

/* ---------- 共通 ---------- */
function updateHead() {
  const m = WORDS.filter(w => Store.peek(w.id)?.s >= MASTER).length;
  $("headCount").textContent = `習得 ${m} / ${WORDS.length}`;
}
function renderBadge() {
  const n = markedWords().length, b = $("markBadge");
  b.hidden = !n; b.textContent = n;
}

let view = "study";
function renderAll() {
  updateHead(); renderBadge();
  if (view === "list") renderList();
  if (view === "stats") renderStats();
}

document.querySelectorAll(".filters button").forEach(b => b.onclick = () => {
  filter = b.dataset.f;
  document.querySelectorAll(".filters button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  buildQueue();
});

document.querySelectorAll("nav.tabs button").forEach(b => b.onclick = () => {
  view = b.dataset.v;
  document.querySelectorAll("nav.tabs button").forEach(x => x.setAttribute("aria-selected", x === b ? "true" : "false"));
  ["study", "list", "stats"].forEach(v => $("view-" + v).hidden = v !== view);
  $("pdfStatus").textContent = "";
  if (view === "study") renderStudy();
  renderAll();
  window.scrollTo(0, 0);
});

/* PCで試すとき用のキーボード操作 */
document.addEventListener("keydown", e => {
  if (view !== "study" || !cur) return;
  if (e.key === "ArrowRight") judge("ok");
  else if (e.key === "ArrowLeft") judge("ng");
  else if (e.key === "ArrowUp") { e.preventDefault(); toggleMark(); }
  else if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
  else if (e.key === "Backspace" || e.key === "z") undo();
});

updateHead();
renderBadge();
buildQueue();
