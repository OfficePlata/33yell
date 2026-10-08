# 第9回 Lark BASEとつなぐ（API）

## この回のゴール
- APIのしくみと、秘密情報（APIキー）の守り方がわかる
- 自分で作った受付ページから送信したデータが、Lark BASE に入る

## 説明① APIとは
たとえ：**APIは「お店の注文窓口」**
- 窓口（API）に、決まった書き方の注文書（リクエスト）を出すと、品物（データ）が返ってくる
- 窓口では「あなたは誰？」と身分証（トークン）を確かめられる
- Larkの場合の登場人物

| 登場人物 | 中身 | どこで手に入るか |
|---|---|---|
| Larkアプリ | Larkにアクセスする「代理人」 | Lark開発者コンソール（open.larksuite.com） |
| App ID / App Secret | 代理人の身分証。**Secretは絶対に秘密** | アプリの「認証情報」画面 |
| 権限（スコープ） | 代理人に許すこと（BASEを読む・書く） | アプリの「権限」画面 |
| BASEのトークン・テーブルID | どの台帳のどの1冊か | BASEのURL（`/base/` の後ろ＝BASEトークン、`table=` の後ろ＝テーブルID） |

## ハンズオン① Larkアプリを作り、BASEに招く
1. Lark開発者コンソールで「カスタムアプリ」を作る（名前：例「マナベル受付」）
2. 機能で「ボット」を有効にする
3. 権限で、BASE（Bitable）の閲覧・編集に関する権限を追加する
4. バージョンを作成して公開を申請する（会社の管理者の承認が必要な場合があります）
5. 使うBASEを開き、右上の「…」メニューから、作ったアプリを追加して編集できるようにする
6. App ID / App Secret をメモ帳ではなく **パスワード管理ツールなど安全な場所に** 控える

※ 画面の名前・場所はLarkの更新で変わることがあります。見つからないときは、画面のスクリーンショットを講師に見せてください（Secretは隠して）。

## 説明② 秘密情報の置き場所
- 公開ページ（HTML・JavaScript）は、誰でも中身を見られます。**ここにApp Secretを書くと、誰でもあなたのBASEを書き換えられます。**
- そこで、間に「受付係（サーバー側のプログラム）」を置きます。

```
お客様のスマホ ──送信──▶ 受付係（Cloudflare Pages Functions）──▶ Lark API ──▶ BASE
   公開ページ             ここだけが Secret を知っている
```

- Secret は Cloudflare の「変数とシークレット」に登録し、プログラムの中には書きません。GitHubにも保存しません。

## ハンズオン② 送信データをBASEに保存
1. Cloudflare Pages の設定で、次の名前でシークレットを登録する
   - `LARK_APP_ID` / `LARK_APP_SECRET` / `LARK_BASE_TOKEN` / `LARK_TABLE_ID`
2. Claude Code にプロンプト集「P-06 BASEへ保存」で頼む
3. できたら記録 → GitHubに保存 → 公開ページから送信し、BASEに1件入ることを確かめる
4. 第6回の自動化（新規レコードで通知）が動くかも確かめる

### 完成イメージ（参考：受付係のプログラム）
講師確認用の例です。受講者は Claude Code に作らせ、この例と見比べて「Secretがプログラムに直接書かれていないか」を確かめてください。

```js
// functions/api/reserve.js（Cloudflare Pages Functions）
export async function onRequestPost({ request, env }) {
  const input = await request.json();

  // 1. 身分証（トークン）をもらう
  const auth = await fetch(
    "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET }),
    }
  ).then((r) => r.json());
  if (auth.code !== 0) return Response.json({ ok: false }, { status: 500 });

  // 2. BASEに1件追加する（フィールド名はBASEと完全に同じにする）
  const res = await fetch(
    `https://open.larksuite.com/open-apis/bitable/v1/apps/${env.LARK_BASE_TOKEN}/tables/${env.LARK_TABLE_ID}/records`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.tenant_access_token}`,
      },
      body: JSON.stringify({
        fields: {
          "お名前": String(input.name ?? "").slice(0, 50),
          "来店日時": new Date(input.datetime).getTime(), // 日付はミリ秒の数値で渡す
          "人数": Number(input.people),
          "受付経路": "フォーム",
        },
      }),
    }
  ).then((r) => r.json());

  return Response.json({ ok: res.code === 0 }, { status: res.code === 0 ? 200 : 500 });
}
```

## よくあるつまずき
| 症状 | 見るところ |
|---|---|
| 権限エラー（code が 0 以外） | アプリの権限が公開・承認済みか、BASEにアプリを追加したか |
| フィールドが見つからない | BASEのフィールド名と、プログラムの名前が1文字でも違わないか |
| 日付が入らない | 日付をミリ秒の数値で渡しているか |
| 手元では動くが公開先で動かない | Cloudflareにシークレットを登録したか、登録後に再デプロイしたか |

## 宿題
- BASEのデータを読み出し、ページに一覧表示する機能を足す（例：今日の空き状況）。**個人情報は表示しない**こと

## チェック
- [ ] App Secret がプログラム・GitHubに書かれていない
- [ ] 公開ページから送ったデータがBASEに入った
