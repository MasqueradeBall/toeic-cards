# TOEIC 800+ 単語カード

TOEIC 800〜990点レベルの単語339語を、スワイプで覚えるスマホ向けWebアプリです。
サーバー不要の静的サイトなので、GitHub Pagesでそのまま公開できます。

## 操作

| 操作 | 動作 |
| --- | --- |
| タップ | カードをめくって意味・例文を見る |
| 右スワイプ / ✓ | わかった |
| 左スワイプ / ✕ | まだ（その周の最後にもう一度出題） |
| 上スワイプ / 🖍 | マーカー（チェックリストに追加・解除） |
| ↶ | 直前の1枚を取り消す |

3回連続で「わかった」にすると習得扱いになります。
チェックリストタブでは、マーカーを引いた単語を表にしてPDFで保存できます。

## ファイル構成

```
index.html   画面の骨組み
style.css    デザイン
words.js     単語データ
storage.js   学習記録の保存（localStorage）
pdf.js       PDF出力（html2canvas + jsPDF）
app.js       スワイプ・出題・画面切り替え
```

## GitHub Pagesで公開する

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/MasqueradeBall/toeic-cards.git
git push -u origin main
```

GitHubのリポジトリで Settings → Pages を開き、Source を「Deploy from a branch」、Branch を `main` / `(root)` にして保存します。
数分後に `https://MasqueradeBall.github.io/toeic-cards/` で開けます。
スマホのSafariやChromeで開き、共有メニューから「ホーム画面に追加」するとアプリのように使えます。

## 単語を追加する

`words.js` の配列に1行ずつ足します。

```js
["英単語", "品詞", "意味", "例文", "例文訳"],
```

品詞は「名・動・形・副・前」で表記しています。

## 学習記録について

記録はブラウザの localStorage に保存されるため、端末やブラウザごとに別々です。
ブラウザのデータを消すと記録も消えるので、記録タブの「記録を書き出す」でときどきバックアップを取ってください。

## 使用ライブラリ

- [html2canvas](https://html2canvas.hertzen.com/) 1.4.1（MIT）
- [jsPDF](https://github.com/parallax/jsPDF) 2.5.1（MIT）
- Google Fonts: Zen Kaku Gothic New / Source Serif 4（SIL OFL）

単語の選定と例文はこのリポジトリのために独自に作成したものです。
