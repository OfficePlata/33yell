// LINE（LIFF の本人確認と、公式アカウントからの一斉配信）

/** LIFF の ID トークンを LINE に確認してもらい、ユーザーID（sub）を返す */
export async function verifyLiffIdToken(env, idToken) {
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: env.LINE_LOGIN_CHANNEL_ID }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.sub || null;
}

/** 友だち全員に、回答ボタンつきのメッセージを送る */
export async function broadcastSurvey(env, { title, text, url }) {
  const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          type: "template",
          altText: title,
          template: { type: "buttons", title: title.slice(0, 40), text: text.slice(0, 60), actions: [{ type: "uri", label: "回答する", uri: url }] },
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LINE broadcast: ${res.status} ${await res.text()}`);
}
