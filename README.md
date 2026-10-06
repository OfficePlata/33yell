# あつめール【仮】（BNI チャプターの会費・ビジター参加費の集金）

支払いは **Peatix**、案内とリマインドは **LINE**（なくても可）、入金表と通知は **Lark** に任せる集金の仕組みです。会計担当がやるのは「集金回を1行足す」「ときどき Peatix の CSV を管理画面に入れる」の2つだけです。

> BNI 本部に払う年会費ではなく、チャプター単位で集めるお金（会費・会場費・朝食代、例会のビジター参加費など）を想定しています。

## 2つの種別と、LINE なし版

| | 会費（種別＝会費） | ビジター参加費（種別＝ビジター） |
|---|---|---|
| 集金回1行 | 1ヶ月分など | 例会1回（締切日＝例会日） |
| 誰から | 名簿の在籍メンバー全員 | Peatix で申し込んだビジター |
| CSV を入れると | メンバー番号で照合して「入金済」 | 申込がそのまま受付リストに並ぶ（会社名・業種・紹介者つき） |
| 案内日 | メンバーへ支払いの案内 | ビジターを誘うメンバーへ、申込ページの文面 |
| 前日 | 未入金の人へリマインド | 「明日のビジター○名」の一覧を Lark へ |
| 翌日 | 入金済／未入金を Lark へ | Peatix／当日現金／未入金と合計額を Lark へ |
| 当日 | 現金・免除を手で記録 | 当日現金・キャンセル・飛び込みのビジターを記録 |

**LINE なし版**：`LINE_CHANNEL_ACCESS_TOKEN` を設定しなければ、LINE には何も送りません。そのかわり案内日・締切前日に、Lark の会計グループへ「そのまま貼れる文面」（Peatix の URL・金額・締切・未入金の人の名前）が届きます。管理画面の「そのまま貼れる文面」からもコピーできます。Facebook グループやメールなど、チャプターがいつも使う連絡手段に貼って使います。

## 構成（ささエールのいつもの型）

```
会計担当 ─ Lark BASE「集金回」に1行（回名・金額・PeatixURL・案内日・締切日）
              │
毎朝9時の定期処理（Cloudflare Workers）
  ├ 案内日   → LINE で在籍メンバーに「Peatixで支払う」ボタンつき案内
  ├ 締切前日 → 未入金の人だけにリマインド
  └ 締切翌日 → Lark Bot で会計担当に「入金済○人／未入金○人：名前」
              │
メンバー ─ Peatix で支払う（カード・コンビニ・銀行振込など。決済と入金は Peatix）
              │
会計担当 ─ Peatix の参加者 CSV を管理画面へ → 申込フォームの「メンバー番号」で自動照合 → BASE「入金」が入金済に
```

| 画面 | パス | 使う人 |
|---|---|---|
| 支払い状況・LINE 登録 | `/r/`（LIFF のエンドポイントもここ） | メンバー |
| 管理画面 | `/admin/` | 会計担当 |

## Lark BASE（5テーブル）
メンバー／集金回／入金／照合ログ／ビジター。`node scripts/setup-lark.mjs` で作成し、作成直後にオーナーを移します（アプリはフルアクセスで残る）。前の版で作った BASE は `node scripts/setup-lark.mjs --upgrade <app_token>` で、足りないテーブルと列だけを足せます。

```bash
# ささエールの Lark で作るとき
node scripts/setup-lark.mjs --name "BNI ○○チャプター 会費" --owner a-sasahala@officeplata.com --demo
# チャプターの Lark で作るとき（チャプターのアプリの ID/Secret で実行。名簿は「メンバー番号,名前」の CSV）
node scripts/setup-lark.mjs --name "BNI ○○チャプター 会費" --owner 会計担当@example.com --members members.csv
```

## Peatix 側の決まりごと
- 集金回ごとに有料イベントを1つ（例「11月度 チャプター会費」）。公開範囲は限定公開にする
- 申込フォームに質問「メンバー番号」（必須）を足す。列名に `MEMBER_NO_LABEL` の文字が入っていれば照合できる
- 番号が空・違うときは、名前が名簿の1人だけに一致すれば拾う。それでも決まらない申込は「要確認」として管理画面と照合ログに出す
- 同じ CSV を何回入れても二重には付かない（入金済の人は飛ばす）
- Peatix の売上はイベント終了後に振り込まれるので、イベントの日時は締切日にしておく
- ビジター用は例会ごとに有料イベントを1つ。申込フォームに「会社名」「業種」「紹介者」を足す（見出しは `VISITOR_*_LABEL` で変えられる）
- コンビニ・銀行振込でまだ払っていない申込は「未入金」として扱い、払ったあとの CSV を入れ直すと「入金済」になる

## 設定

| 種類 | 名前 | 中身 |
|---|---|---|
| vars | `CHAPTER_NAME` `PUBLIC_URL` `MEMBER_NO_LABEL` | 表示名・公開 URL・Peatix の質問の見出し |
| vars | `VISITOR_COMPANY_LABEL` `VISITOR_CATEGORY_LABEL` `VISITOR_REFERRER_LABEL` | ビジター用の質問の見出し（既定：会社名・業種・紹介者） |
| vars | `LARK_BASE_TOKEN` | setup-lark.mjs が出力する app_token |
| vars | `LARK_ADMIN_CHAT_ID` | 会計担当がいる Lark グループ（通知先）。`node scripts/list-chats.mjs` で調べられる |
| vars | `LIFF_ID` `LINE_LOGIN_CHANNEL_ID` | LINE を使うときだけ。LIFF（エンドポイント = `PUBLIC_URL/r/`、scope は openid と profile） |
| secret | `LARK_APP_ID` `LARK_APP_SECRET` | Lark アプリ（権限：bitable:app、im:message、im:chat:readonly。BASE 作成時は drive:drive も） |
| secret | `LINE_CHANNEL_ACCESS_TOKEN` | LINE を使うときだけ。チャプターの LINE 公式アカウント（Messaging API）。なければ LINE なし版 |
| secret | `ADMIN_PASSWORD` | 管理画面のパスワード（長いランダムな文字列） |

秘密情報は `npx wrangler secret put 名前` で登録し、コードやリポジトリには書きません。管理画面の前に Cloudflare Access（50人まで無料）を置くと、さらに安全です。

## 開発

```bash
npm install
npm test                         # CSV 照合・日程判定・会費／ビジター／LINE なしの通しのテスト
cp .dev.vars.example .dev.vars   # 値を入れる
npx wrangler dev
npx wrangler deploy              # 公開（確認後）
```

## 月額費用の目安【仮・要確認】
- Cloudflare Workers：無料枠内（1日1回の定期処理＋数十人の利用）
- LINE 公式アカウント：無料のコミュニケーションプランは月200通まで。40人チャプターで「案内1通＋未入金リマインド」なら月50〜80通程度。LINE なし版なら不要
- Lark：チャプターの既存契約、または無料プラン
- Peatix：主催者側の販売手数料が売上から差し引かれる（料率は Peatix の最新の料金ページで確認）
