# しらベール（組織サーベイ）

Lark・LINE から1〜3分で答えられる、匿名の月次パルスサーベイです。結果は Lark BASE に貯まり、管理画面と AI の改善アクション案で「次の一手」までつなげます。

## 構成（ささエールのいつもの型）

```
社員 ─ Lark（Bot が個人別リンクを配信）─┐
     └ LINE（LIFF・公式アカウントで配信）┴→ 回答フォーム ─→ Cloudflare Workers ─→ Lark BASE
                                                            │（匿名化・二重回答防止）
経営者 ← Lark Bot（結果の通知）← 毎朝9時の定期処理（配信・締切・AI要約）
       ← 管理画面（スコア推移・部署別・自由記述・改善アクション案）
```

| 画面 | パス | 使う人 |
|---|---|---|
| 回答フォーム | `/a/`（LIFF のエンドポイントもここ） | 社員 |
| 管理画面 | `/admin/` | 経営者・人事・ささエール |
| デモ回答 | `/a/?demo=1`（`DEMO_MODE=true` のときだけ） | 営業デモ |

### 匿名性のルール
- 回答者キーは `HMAC(ANON_SALT, 回名:経路:ユーザーID)`。回ごとに変わるので、月をまたいで個人を追えません。二重回答の防止にだけ使います。
- 部署別の数字は、回答者が5人未満の部署では表示しません（`src/aggregate.js` の `MIN_GROUP`）。
- 自由記述は部署などの属性を外し、順番を混ぜて表示します。AI にもコメントをそのまま引用しないよう指示しています。

## Lark BASE（6テーブル）
設問マスタ／サーベイ回／回答／月次レポート／改善アクション／部署マスタ。
`node scripts/setup-lark.mjs` で、作成からオーナーの移管までまとめて行います。

```bash
# デモ（ささエールの Lark）
node scripts/setup-lark.mjs --name "しらベール（デモ）" --owner a-sasahala@officeplata.com --demo
# 本番（導入企業の Lark。導入企業のアプリの ID/Secret で実行）
node scripts/setup-lark.mjs --name "しらベール" --owner 担当者@導入企業 --departments 営業部,製造部,総務部
```

毎月の運用は、BASE の「サーベイ回」に行（回名・開始日・締切日・状態=予定・対象人数）を足すだけです。開始日の朝に配信し、締切の翌朝に集計して AI 要約を作り、Lark で通知します。

## 導入先ごとの設定

| 種類 | 名前 | 中身 |
|---|---|---|
| vars | `COMPANY_NAME` `PUBLIC_URL` `DEMO_MODE` | 表示名・公開URL・デモ回答を許可するか（本番は `false`） |
| vars | `LARK_BASE_TOKEN` | setup-lark.mjs が出力する app_token |
| vars | `LARK_SURVEY_CHAT_ID` | 回答を依頼するメンバーがいる Lark グループ（Bot が1人ずつ DM） |
| vars | `LARK_ADMIN_CHAT_ID` | 結果を通知する経営者向けグループ |
| vars | `LIFF_ID` `LINE_LOGIN_CHANNEL_ID` | LINE で回答する場合（LIFF のエンドポイント = `PUBLIC_URL/a/`） |
| secret | `LARK_APP_ID` `LARK_APP_SECRET` | 導入企業の Lark アプリ（権限：bitable:app、im:message、im:chat:readonly） |
| secret | `LINE_CHANNEL_ACCESS_TOKEN` | 社員向け LINE 公式アカウント（友だち全員に一斉配信するため、社内用のアカウントにする） |
| secret | `ANTHROPIC_API_KEY` | AI 要約（Claude） |
| secret | `ADMIN_PASSWORD` `LINK_SECRET` `ANON_SALT` | ランダムな長い文字列。導入先ごとに別にする |

秘密情報は `npx wrangler secret put 名前` で登録し、コードやリポジトリには書きません。本番では管理画面の前に Cloudflare Access（50人まで無料）を置くことをおすすめします。

## 開発

```bash
npm install
npm test                 # 集計・署名・匿名キー・デモデータのテスト
cp .dev.vars.example .dev.vars   # 値を入れる
npx wrangler dev
npx wrangler deploy      # 公開（笹原さんの確認後）
```

## 月額費用の目安【仮】
Cloudflare Workers：無料枠内（社員100人規模）／Lark：導入企業の既存契約／LINE：配信通数しだい（Lark だけなら不要）／Claude API：月1回の要約で数十円〜数百円程度。
