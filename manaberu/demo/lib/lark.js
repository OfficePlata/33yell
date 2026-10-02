// Lark Open API の呼び出し。App Secret はこのファイルではなく Cloudflare のシークレットから受け取る。

const LARK_API = "https://open.larksuite.com/open-apis";

export async function getTenantAccessToken(env, fetchImpl = fetch) {
  const res = await fetchImpl(`${LARK_API}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Lark token error: ${data.code} ${data.msg}`);
  return data.tenant_access_token;
}

export async function createRecord(env, fields, fetchImpl = fetch) {
  const token = await getTenantAccessToken(env, fetchImpl);
  const url = `${LARK_API}/bitable/v1/apps/${env.LARK_BASE_TOKEN}/tables/${env.LARK_TABLE_ID}/records`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fields }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Lark record error: ${data.code} ${data.msg}`);
  return data.data.record.record_id;
}

// BASE の自動化で通知できない場合の代わり：グループのカスタムボットへ送る。
// （カスタムボットの「署名の検証」はオフにしておく）
export async function notifyWebhook(env, text, fetchImpl = fetch) {
  if (!env.LARK_WEBHOOK_URL) return;
  await fetchImpl(env.LARK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ msg_type: "text", content: { text } }),
  });
}
