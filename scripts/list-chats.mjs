#!/usr/bin/env node
/**
 * Bot が入っている Lark グループの一覧（名前と chat_id）を出す。LARK_ADMIN_CHAT_ID を調べる用。
 *
 *   node scripts/list-chats.mjs
 * 必要な環境変数：LARK_APP_ID, LARK_APP_SECRET（LARK_DOMAIN は任意）
 */
const DOMAIN = process.env.LARK_DOMAIN || "open.larksuite.com";

const auth = await fetch(`https://${DOMAIN}/open-apis/auth/v3/tenant_access_token/internal`, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ app_id: process.env.LARK_APP_ID, app_secret: process.env.LARK_APP_SECRET }),
}).then((r) => r.json());
if (auth.code !== 0) {
  console.error(`失敗しました: ${auth.msg}（LARK_APP_ID / LARK_APP_SECRET を確認してください）`);
  process.exit(1);
}
const res = await fetch(`https://${DOMAIN}/open-apis/im/v1/chats?page_size=100`, { headers: { Authorization: `Bearer ${auth.tenant_access_token}` } }).then((r) => r.json());
if (res.code !== 0) {
  console.error(`失敗しました: ${res.code} ${res.msg}（アプリの権限に im:chat:readonly を足してください）`);
  process.exit(1);
}
if (!res.data.items?.length) console.log("Bot が入っているグループがありません。会計担当のグループに Bot を追加してから、もう一度実行してください");
for (const c of res.data.items || []) console.log(`${c.chat_id}\t${c.name}`);
