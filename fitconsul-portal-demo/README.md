# F-IT CONSUL 業務ポータル（Notion 連携デモ）

株式会社F－ITコンサル（フィットコンサル）様向けの提案デモです。受発注・人件費の原価管理・プロジェクト管理を **Notion をデータ基盤** にして、1つのポータルから扱えるようにしたイメージです。
プリコム社内ポータル（`OfficePlata/pricom-portal`、Lark 版）の画面構成・デザインをベースに、データ基盤を Notion に置き換える前提で作っています。

> 表示している会社名・人名・金額はすべて架空のデモデータです。操作内容はブラウザ（localStorage）にだけ保存されます。

## デザイン・演出

Immersive Garden（immersive-g.com）の空気感を参考に、F-ITコンサル様のブランドカラーでまとめています（サウンドなし）。

- 配色：ロゴの 4 色（空色 #00B0E8／青 #0078C0／黄 #F8E000／橙 #F08000）＋公式サイトの紺をベースに、`public/index.html` の THEME にある `:root` 変数で一括管理
- ロゴ：`public/img/mark.png`（公式サイトのサイトアイコン）。社名表記は正式名称の「F-IT Consul」

- 起動時のイントロ：ロゴマークと社名が 1 文字ずつ浮かび上がり、幕が上がるように画面が現れる
- 画面遷移やスクロールに合わせて、カード・表・見出しがぼかしから「ふわっ」と浮き出る（`public/fx.js`）
- ヒーロー：光の粒が球体からロゴ（F マーク）の形へ集まり、ふわっと浮遊しながら揺れる（マウスに少し追従）
- 背景を漂う霧とフィルムグレイン、カーソルを追う光、数値のカウントアップ
- 視差効果を減らす設定（prefers-reduced-motion）の端末では、演出を止めて即時表示

## 見せ方

`public/index.html` をブラウザで開くだけで動きます（サーバー不要）。

### Cloudflare Workers へのデプロイ

`public/` を Workers の静的アセットとして配信します（設定は `wrangler.jsonc`）。

- **自動**：`fitconsul-portal-demo/` に変更を push すると GitHub Actions（`.github/workflows/deploy-fitconsul-demo.yml`）でデプロイされます。リポジトリの Actions シークレットに `CLOUDFLARE_API_TOKEN` の登録が必要です。
- **手動**：`cd fitconsul-portal-demo && npx wrangler deploy`

公開URLは `https://fitconsul-portal-demo.<アカウントのサブドメイン>.workers.dev` になります。

### デモで見せるポイント

| 画面 | 見せるところ |
|---|---|
| ホーム | 今月の請求予定・受注残・見込み、今日のやること（原価超過アラート・請求待ち） |
| 受発注 | 見積→受注確定→納品・検収→請求→入金のカンバン（ドラッグで移動できる）。新規見積の登録、外注の発注管理 |
| 案件管理 | 案件一覧 → 詳細（Notion ページ風のプロパティ、予算と原価、メンバー別の原価、マイルストーン） |
| 原価・収支 | 工数×原価単価＋外注費で案件別に原価を自動集計。着地見込・粗利率・超過リスクを判定 |
| 工数入力 | 週単位のグリッドで入力 → 原価にすぐ反映（メンバービューで試せる） |
| 稼働・アサイン | メンバー×月の稼働率ヒートマップ、来月の空き |
| Notion構成 | 裏側の Notion データベース設計、Notion 単体で運用する場合との違い、本番の構成 |

右上のロール切替（経営者 / PM / メンバー）で、権限による表示の違いを見せられます。
- メンバーには受発注・原価の金額を表示しない
- 個人の原価単価は経営者だけが見られる

## 本番化する場合（案）

pricom-portal と同じ構成で、`lib/lark.js` を `lib/notion.js`（Notion API クライアント）に置き換えます。

- 配信：Cloudflare Pages ＋ Pages Functions（API と権限チェック）
- ログイン：Google / Microsoft SSO、または Cloudflare Access
- データ：Notion の 7 データベース（顧客・案件・受注・発注・工数・メンバー・お知らせ）をリレーションで連結
- 集計：工数DB の「原価（時間×単価）」を案件DB でロールアップし、着地見込は API 側で計算

## ファイル

- `public/index.html` … 画面とスタイル
- `public/data.js` … デモ用の架空データ（本番では Notion API から取得）
- `public/app.js` … 画面の描画、集計、デモ用の状態保存
- `public/fx.js` … 演出（イントロ・リビール・球体・背景）
- `public/_headers` … 検索エンジンに載せない設定など
- `wrangler.jsonc` … Cloudflare Workers の設定
