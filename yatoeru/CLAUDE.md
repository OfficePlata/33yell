# ヤトエール LP — 引き継ぎ書

OFFICE PLATA の新サービス「ヤトエール（AI社員チームづくり）」の紹介ページ。マカセルLP（33yell.service の `makaseru/`）とトンマナを共通にしている。

## ファイル
- `index.html` … LP本体（HTML/CSS/JS インライン、1ファイル完結。外部依存は Google Fonts のみ）
- `images/01_sasaemon_point.png`・`images/02_sasahara.jpg`・`images/favicon.png` … マカセルと共通
- `images/ogp.png` … OGP 1200×630（ヤトエール用）

## 設定の差し替え
`index.html` 末尾の `CONFIG` だけ書き換えれば全CTAに反映される（LINE_URL／APPLY_URL／APPLY_PREFILL／SLOTS_HONSHA）。

## 料金（変更時はここと LP を合わせる）※ 2026-09-30 時点の提案価格
- AI社員 面接会：90分 30,000円（税別）。1ヶ月以内に採用プランを申し込むと差し引き
- パート採用（AI社員3人）：98,000円
- 正社員採用（AI社員10人・おすすめ）：298,000円
- 本社まるごと（20人まで・会計ソフト連携・3ヶ月調整）：498,000円／毎月3社まで
- 月額オプション「人事部サポート」：20,000円/月
- すべて税別。Claude の月額料金・Lark・会計ソフトの利用料はお客さま負担

## デザインルール（マカセルと同じ）
- 色は5色：黄 `#FFD600`／サブ `#F5A623`（ボタン）／強調 `#DD6420`（使いすぎない）／黒 `#1A1A1A`／白 `#FFFFFF`
- フォント：見出し Dela Gothic One、本文 Noto Sans JP（Medium/Bold/Black）
- ささえもん：変形・色変え・要素追加は禁止、白い円の上に置く、Webでは80px以上
- 白文字をオレンジの上に小さく載せない。ボタンは `#F5A623`＋黒文字

## 公開
- Cloudflare Workers（静的アセット）の Worker `yatoeru`。Pages はアカウントのプロジェクト数上限のため使っていない
- `.github/workflows/deploy-yatoeru.yml` が `yatoeru/` の変更を push したときに自動デプロイする（GitHub Secrets の `CLOUDFLARE_API_TOKEN` を使用）
- 手動なら：`npx wrangler deploy --assets yatoeru --name yatoeru --compatibility-date 2026-09-01`
- 公開URL：https://yatoeru.a-sasahala.workers.dev（独自ドメインを付けたら og:image も書き換える）
- `.assetsignore` で CLAUDE.md を公開対象から外している

## 注意
- 住所・個人の電話番号は載せない。実績の固有名詞は出さない
- 変更後は 375px と 1280px で横スクロールが出ないことを確認する
