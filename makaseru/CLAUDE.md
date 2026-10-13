# マカセル LP — Claude Code 引き継ぎ書

OFFICE PLATA の新サービス「マカセル（Claude Code マンツーマン伴走）」の紹介ページ（LP）。
デザインは完成済み。このフォルダの `index.html` をベースに、仕上げと公開を行う。

## フォルダ構成
```
makaseru-lp/
├── index.html                    … LP本体（HTML/CSS/JS すべてインライン、1ファイル完結）
├── images/01_sasaemon_point.png  … キャラクター「ささえもん」（背景透過PNG）
├── images/02_sasahara.jpg        … 講師写真（2.jpg を顔中心で480px正方形にトリミング）
├── images/ogp.png                … OGP画像 1200×630
├── images/favicon.png            … favicon / apple-touch-icon 512px
└── CLAUDE.md                     … この引き継ぎ書
```
- 外部依存は Google Fonts（Dela Gothic One / Noto Sans JP）のみ。
- スマホ（375px）〜PC（1280px）で横スクロールなしを確認済み。

## 最初にやること：設定値の差し替え
`index.html` 末尾の `<script>` 内、`CONFIG` だけ書き換えれば全CTAに反映される。

| キー | 内容 | 現在値 |
|---|---|---|
| `LINE_URL` | LINE公式アカウントの友だち追加URL | `https://line.me/R/ti/p/@503hiemz`（OFFICE PLATA） |
| `APPLY_URL` | 単発レッスン申込フォームURL | ささエール 相談・お問い合わせフォーム（Lark） |
| `APPLY_PREFILL` | フォームへの初期入力（`?prefill_<項目名>=<値>` で付与） | 「ご相談内容（自由記入）」に【マカセル】単発レッスン申込の文言 |
| `SLOTS_TAKE` | 竹プランの残り枠 | 5 |
| `SLOTS_MATSU` | 松プランの残り枠 | 3 |

- リンクは `data-link="line"` / `data-link="apply"`、残り枠は `data-slot="take"` / `data-slot="matsu"` で紐づけている。

## 仮置き箇所（2026-09-27 すべて差し替え済み）
- 講師写真・プロフィール文・OGP画像・favicon を反映済み。
- `og:image` は https://makaseru.33l.jp/images/ogp.png（絶対URL）に設定済み。

## ページ構成（上から）
ヘッダー → ファーストビュー → こんな方に → 3つの特徴 → 比較（作ってもらう→作れるようになる）→ 料金プラン（梅・竹・松＋ご利用条件）→ 単発レッスン → ご利用の流れ → よくある質問（`<details>` アコーディオン）→ 講師紹介 → 最終CTA → フッター。
スマホ幅（820px以下）では1カラムになり、画面下に「LINEで相談する」固定ボタンが出る。

## 料金（変更時はここと整合させる）
- 単発レッスン：90分 30,000円（税別）。受講から1ヶ月以内に竹・松へ移行したら初月から差し引き
- 梅：20,000円/月｜質問し放題・返信48時間以内
- 竹（おすすめ）：50,000円/月｜返信24時間以内・月2回×60分セッション・コードレビュー・限定5枠
- 松：100,000円/月｜返信当日中・毎週×60分セッション・コードレビュー・笹原の直接修正 月2時間・限定3枠
- すべて税別、月額プランは最低3ヶ月。Claudeの利用料は受講者負担

## デザインルール（ささエール トンマナ）— 崩さないこと
- 色は5色で完結：黄 `#FFD600`（背景）／サブ `#F5A623`（ボタン）／強調 `#DD6420`（ブラシ下線・バースト、使いすぎない）／黒 `#1A1A1A`（文字・枠・帯）／白 `#FFFFFF`（カード）
- フォント：見出し Dela Gothic One、本文 Noto Sans JP（Medium/Bold/Black）。細いフォントは使わない
- 装飾：サンバースト背景・ハーフトーン・バーストマーク・オレンジのブラシ下線・太い黒枠カード＋黒ベタ影・黒リボン
- 白文字をオレンジ `#DD6420` の上に小さく載せない（コントラスト不足）。ボタンは `#F5A623` ＋黒文字
- ささえもんの使用ルール：変形しない／色を変えない／背景に埋もれさせない（白い円の上に置く）／帽子などの要素を足さない／Webでは80px以上

## 公開
**2026-09-30 変更: https://makaseru.33l.jp（Cloudflare Workers 静的アセット）が正式URL。**
- リポジトリ OfficePlata/33yell の `makaseru/`。設定は直下の `wrangler.makaseru.jsonc`、`.github/workflows/deploy-makaseru.yml` が push 時に自動デプロイ
- 手動なら：`npx wrangler deploy -c wrangler.makaseru.jsonc`
- `.assetsignore` で CLAUDE.md を公開対象から外している
- 旧URL（WordPress 固定ページ 570）は、新URLへ転送するか非公開にする

以下は WordPress 公開時の記録。
**2026-09-27 決定: WordPress 固定ページ**（ID **570** / slug `makaseru` / **2026-09-27 公開済み**）。
- 公開URL: https://officeplata.com/makaseru/ ｜ 編集: https://officeplata.com/wp-admin/post.php?post=570&action=edit
- メディア: ささえもん 567 / 講師写真 568 / OGP 569（アイキャッチに設定済み＝SNSのOGPはこれが使われる）
- 更新手順: `index.html` を直す → `python3 build-wp.py`（`wp-page.html` を生成）→
  `node ~/.claude/skills/wp-operator/scripts/wp_operator.js page update 570 <このフォルダ>/wp-page.html --raw`
- `build-wp.py` は CSS を `.mkr` 配下に閉じ込め、820px の切替を container query に変換、SWELL の h2 装飾とページタイトルを打ち消す。
  サイドバーありでも崩れない。管理画面でこのページのサイドバーを OFF にすると全幅表示になる（REST では変更不可）。

以下は当初の候補メモ。
- Cloudflare Pages：このフォルダをそのままデプロイ（例：`npx wrangler pages deploy . --project-name makaseru-lp`）
- WordPress：`images/` をメディアにアップロードして画像パスを差し替え、`<head>` 内の `<style>` と `<body>` の中身をカスタムHTMLとして貼る

## 注意
- 住所・個人の電話番号は掲載しない
- クライアント名など実績の固有名詞は出さない
- 変更後は、スマホ幅（375px）とPC幅（1280px）の両方で表示を確認し、横スクロールが出ていないことを確かめてから報告すること
