/* チェックリストのPDF出力
 * 表をHTMLで組み、html2canvasで画像化してjsPDFに貼り付けます。
 * 日本語フォントをPDFに埋め込む必要がないので、文字化けしません。
 */
const Pdf = (() => {
  const ROWS_PER_PAGE = 22;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  function pageHtml(list, chunk, p, pages) {
    return `<div class="pdfpage">
      ${p === 0 ? `<h3>TOEIC 800+ チェックリスト</h3><p class="meta">${today()} 作成 ／ ${list.length}語</p>` : ""}
      <table>
        <thead><tr>
          <th style="width:36px">No.</th><th>英単語</th><th style="width:44px">品詞</th><th>意味</th><th style="width:64px">正解/回答</th>
        </tr></thead>
        <tbody>${chunk.map((w, i) => {
          const r = Store.peek(w.id);
          return `<tr><td class="n">${p * ROWS_PER_PAGE + i + 1}</td><td class="w">${esc(w.w)}</td><td>${esc(w.pos)}</td><td>${esc(w.ja)}</td><td class="n">${r.c}/${r.c + r.x}</td></tr>`;
        }).join("")}</tbody>
      </table>
      <p class="foot">${p + 1} / ${pages}</p>
    </div>`;
  }

  async function save(list, onStatus) {
    if (!list.length) return;
    // ライブラリが読み込めなかった場合はブラウザの印刷機能に切り替える
    if (!window.jspdf || !window.html2canvas) {
      onStatus("印刷画面を開きます。「PDFとして保存」を選んでください。");
      setTimeout(() => window.print(), 400);
      return;
    }
    onStatus("PDFを作成しています…");
    const area = document.getElementById("pdfArea");
    const pdf = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
    const pages = Math.ceil(list.length / ROWS_PER_PAGE);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    for (let p = 0; p < pages; p++) {
      const chunk = list.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
      area.innerHTML = pageHtml(list, chunk, p, pages);
      const canvas = await html2canvas(area.firstElementChild, { scale: 2, backgroundColor: "#ffffff" });
      if (p > 0) pdf.addPage();
      const W = pdf.internal.pageSize.getWidth();
      const H = Math.min(W * canvas.height / canvas.width, pdf.internal.pageSize.getHeight());
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, W, H);
    }
    area.innerHTML = "";
    pdf.save(`TOEIC800_checklist_${today()}.pdf`);
    onStatus("PDFを保存しました。");
  }

  return { save };
})();
