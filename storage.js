/* 学習記録の保存（ブラウザの localStorage）
 * rec[英単語] = { c:わかった回数, x:まだ回数, s:連続正解数, k:マーカー(0/1), t:最終更新時刻 }
 */
const Store = (() => {
  const KEY = "toeic800-cards-v1";
  let rec = {};
  try { rec = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { rec = {}; }

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch (e) {}
  };

  return {
    get all() { return rec; },
    has(id) { return !!rec[id]; },
    peek(id) { return rec[id]; },
    get(id) { return rec[id] || (rec[id] = { c: 0, x: 0, s: 0, k: 0, t: 0 }); },
    set(id, value) { if (value) rec[id] = { ...value }; else delete rec[id]; save(); },
    touch(id) { this.get(id).t = Date.now(); save(); },
    reset() { rec = {}; save(); },

    /* バックアップ（JSONファイル）の書き出し・読み込み */
    exportJson() {
      return JSON.stringify({ app: "toeic800-cards", version: 1, exportedAt: new Date().toISOString(), rec }, null, 2);
    },
    importJson(text) {
      const data = JSON.parse(text);
      if (!data || typeof data.rec !== "object") throw new Error("invalid");
      rec = data.rec; save();
    }
  };
})();
