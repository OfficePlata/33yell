# ささエール AI社員チーム

代表・笹原彰朗さんと一緒に働く **AI社員19人** を、Claude の「スキル」として1つにまとめたものです。組織図は [../ai-org/index.html](../ai-org/index.html)。

- **従量課金なし**：Claude の月額プラン（Pro／Max）の範囲で動きます。APIキーは使いません。
- **いつでもどこでも**：一度アップロードすれば、Claude の スマホアプリ・PCアプリ・Web のどこからでも呼べます。
- **1回のアップロードで19人全員**：`sasayell-ai-team.zip` の中に全員の指示書が入っています。

## 使えるようにする（最初の1回だけ・約5分）

1. PCのブラウザで [claude.ai](https://claude.ai) を開く
2. 設定 → **機能（Capabilities）** で「コード実行とファイル作成」をオンにする
3. **カスタマイズ → スキル** を開き、「スキルをアップロード」から `sasayell-ai-team.zip` を選ぶ
4. 一覧に `sasayell-ai-team` が出て、オンになっていれば完了

このあとは、スマホの Claude アプリでもそのまま使えます。

## 呼び方

普段どおりチャットで頼むだけです。役割名を入れると確実です。

```
提案営業として、明日相談の「T社（鹿児島のベーカリー）」の下調べとヒアリングシートを作って
```
```
CFO、今月の収支と未回収をまとめて
```
```
市場リサーチャー、鹿児島・宮崎のLark導入支援の競合と料金を調べて
```
```
EA、この打ち合わせメモを議事録にして宿題を整理して（←音声入力やメモ貼り付けでOK）
```
```
COO、今週なにを優先すべき？ 案件はこれ：…
```

複数の部門にまたがる依頼は COO が仕切ります（例：「新規のLIFF予約案件、提案から計画までチームで進めて」）。

## Lark に貯める

成果物（議事録・提案書・見積・レポートなど）を、Lark BASE「ささエール AI社員ログ」に1件ずつ貯めます。同じzip1つで、保存できる場所では自動で保存し、できない場所では「Lark保存用」ブロックを出します。

| 使う場所 | Lark への保存 | 必要な準備 |
|---|---|---|
| PC の Claude Code | 自動で保存 | 下の「PCの準備」を1回 |
| スマホ・PC の Claude アプリ「Code」（クラウド） | 自動で保存 | 下の「スマホの準備」を1回 |
| スマホ・PC の Claude アプリの普通のチャット | 保存しない（「Lark保存用」ブロックを表示） | なし。あとでPCかCodeに貼って「このログをLarkに保存して」 |

### PCの準備（Mac・約5分）

`lark-cli` に笹原さんのアカウントでログイン済みであることが前提です（ささエールの運営BASEと同じ方法）。

1. zip を解凍してできた `sasayell-ai-team` フォルダを `~/.claude/skills/` に置く
2. ターミナルで次を実行する（BASE とテーブルができ、URL が表示されます）

```bash
node ~/.claude/skills/sasayell-ai-team/scripts/lark-log.mjs setup
node ~/.claude/skills/sasayell-ai-team/scripts/lark-log.mjs check   # 「接続OK」ならOK
```

保存先は `~/.sasayell-ai-team/lark.json` に記録されます。BASE は笹原さんがオーナーです。

### スマホの準備（Claude アプリの「Code」から使う）

Claude アプリの「Code」（Claude Code のクラウド版）は月額プランの範囲で動き、スマホから指示できます。ここからアプリ（ボット）として Lark に保存します。

1. PC の準備を先に済ませ、`check` で表示された app_token と table_id を控える
2. Lark 開発者コンソールで、使うカスタムアプリに `bitable:app` の権限を付け、Lark で「ささエール AI社員ログ」の BASE を開き、… → 「ドキュメントアプリを追加」でそのアプリを追加する
3. Claude Code のクラウド環境の設定（セッションのタイトルバーの環境メニュー → Edit）で
   - 環境変数に `LARK_APP_ID`・`LARK_APP_SECRET`・`LARK_AI_LOG_BASE`（app_token）・`LARK_AI_LOG_TABLE`（table_id）を入れる
   - ネットワークで `open.larksuite.com` を許可する
4. このスキルが入ったリポジトリを選んで Code のセッションを始め、「提案営業として…」と頼む

App Secret はチャットに貼らず、必ず環境変数の欄に入れてください。

## マネーフォワードとつなぐ（CFO用）

マネーフォワード クラウド会計は公式のMCPサーバーを全プランに提供しています。

1. claude.ai の 設定 → **コネクタ** → カスタムコネクタを追加
2. マネーフォワードの開発者サイト（developers.biz.moneyforward.com/mcp/）に載っている接続URLを入れる
3. マネーフォワードにログインして許可する
4. チャットの「+」→ コネクタ で マネーフォワード をオンにして、「CFO、今月の収支を見て」と頼む

CFOの指示書で「読むだけ・仕訳の登録はしない」と決めてあります。登録までさせたくなったら、指示書を変えます。

## 指示書を直すとき

- 会社の前提（料金・サービス・トーン）：`sasayell-ai-team/company.md`
- 各AI社員：`sasayell-ai-team/roles/*.md`
- Lark への保存ルール：`sasayell-ai-team/lark.md`（保存スクリプトは `scripts/lark-log.mjs`）

直したら zip を作り直して、claude.ai のスキルを入れ替えます。

```bash
cd ai-team && rm -f sasayell-ai-team.zip && zip -r sasayell-ai-team.zip sasayell-ai-team
```

Claude Code でこのリポジトリを開いたときは、`.claude/skills/sasayell-ai-team` から同じスキルが自動で読み込まれます（Claude Code もサブスクリプションで使えます）。

## 月額プランについて

- 料金は定額ですが、プランごとに使用量の上限があります。毎日たくさん頼むなら Max プランが安心です。
- 上限に達しても追加料金はかからず、時間をおくとまた使えます（追加利用を自分でオンにしない限り）。
