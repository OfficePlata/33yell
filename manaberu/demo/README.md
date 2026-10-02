# まなべ食堂 予約デモ（講師用・完成版）

講座「マナベル」第8〜10回のデモで使う完成版です。受講者には完成版のコードを渡さず、Claude Code に作らせたものと見比べる「答え合わせ」に使います。

```
お客様（ブラウザ または LINE の中＝LIFF）
   │ 予約を送信
   ▼
public/index.html ──POST /api/reserve──▶ functions/api/reserve.js（受付係）
                                          ├─ lib/validate.js  入力チェック（日本時間で解釈）
                                          ├─ lib/line.js      LINE の ID トークンを検証
                                          └─ lib/lark.js      Lark BASE に1件追加／カスタムボットに通知
```

## ファイル
| ファイル | 役割 |
|---|---|
| `public/index.html` | 予約ページ。LINE の中で開いたときだけ LIFF を使い、ブラウザでは普通のフォームとして動く |
| `functions/api/reserve.js` | 予約を受けて BASE に保存する（Cloudflare Pages Functions） |
| `functions/api/config.js` | ページに LIFF ID を渡す（秘密情報ではないもののみ） |
| `lib/` | 入力チェック・Lark・LINE の処理 |
| `test/reserve.test.mjs` | 通信を偽物に差し替えたテスト（`npm test`） |

## 講師の準備手順

### 1. Lark BASE
[../sample-project.md](../sample-project.md) の「予約テーブル」を作る。プログラムが使うフィールド名と種類は次のとおり（1文字でも違うと保存に失敗する）。

| フィールド名 | 種類 |
|---|---|
| お名前 | テキスト |
| 来店日時 | 日付（時刻あり） |
| 人数 | 数値 |
| ご要望 | テキスト |
| ステータス | 単一選択（受付／確定／来店済／キャンセル） |
| 受付経路 | 単一選択（電話／フォーム／LINE） |
| LINEユーザーID | テキスト |

### 2. Lark アプリ
第9回の手順どおり。カスタムアプリを作り、ボットを有効にし、BASE（Bitable）の権限を付けて公開し、BASE にアプリを追加する。

### 3. Cloudflare Pages
| 設定 | 値 |
|---|---|
| ルートディレクトリ | `manaberu/demo` |
| ビルドコマンド | （空） |
| ビルド出力ディレクトリ | `public` |

「変数とシークレット」に登録するもの（**値はGitHubに保存しない**）

| 名前 | 中身 | 秘密か |
|---|---|---|
| `LARK_APP_ID` | Lark アプリの App ID | ○ |
| `LARK_APP_SECRET` | Lark アプリの App Secret | ◎ 必ず暗号化 |
| `LARK_BASE_TOKEN` | BASE の URL の `/base/` の後ろ | ○ |
| `LARK_TABLE_ID` | BASE の URL の `table=` の後ろ | ○ |
| `LARK_WEBHOOK_URL` | （任意）通知先グループのカスタムボットの Webhook URL。署名の検証はオフ | ◎ 必ず暗号化 |
| `LINE_CHANNEL_ID` | （第10回）LINEログインチャネルのチャネルID | ○ |
| `LIFF_ID` | （第10回）LIFF ID | ― |

登録・変更したあとは、再デプロイしないと反映されない。

### 4. LINE（第10回）
LINEログインチャネルに LIFF アプリを追加し、エンドポイントURLを Pages の公開URL、スコープを `openid` と `profile` にする。`https://liff.line.me/（LIFF ID）` をリッチメニューのリンクにする。

## テスト
```
cd manaberu/demo
npm test
```
Lark・LINE に実際にはつながず、受付係の動き（日本時間の扱い、入力チェック、LINE の検証に失敗したら保存しない、エラー内容を外に見せない）を確かめる。

## 教えるときのポイント（このコードで見せる場所）
- **日本時間のずれ**：`lib/validate.js` の `parseJstDateTime`。Cloudflare の時計は UTC なので、そのままだと9時間ずれる
- **秘密情報の置き場所**：コードの中に Secret がなく、すべて `env` から読んでいる
- **なりすまし対策**：`lib/line.js`。ページから来たユーザーIDを信じず、LINE に問い合わせる
- **お客様に見せるエラー**：`reserve.js` の catch。詳しい理由はログにだけ残す
