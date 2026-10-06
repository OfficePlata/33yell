// LINE（LIFF の本人確認と、公式アカウントからの個別配信）

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

/**
 * 登録済みのメンバーだけに、ボタンつきのメッセージを送る（multicast は1回500人まで）。
 * buttons: [{ label, url }]（4つまで）
 */
export async function pushButtons(env, userIds, { title, text, buttons }) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN || !userIds.length) return 0;
  const message = {
    type: "template",
    altText: `${title}\n${text}`.slice(0, 400),
    template: {
      type: "buttons",
      title: title.slice(0, 40),
      text: text.slice(0, 60),
      actions: buttons.slice(0, 4).map((b) => ({ type: "uri", label: b.label.slice(0, 20), uri: b.url })),
    },
  };
  for (let i = 0; i < userIds.length; i += 500) {
    const res = await fetch("https://api.line.me/v2/bot/message/multicast", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: userIds.slice(i, i + 500), messages: [message] }),
    });
    if (!res.ok) throw new Error(`LINE multicast: ${res.status} ${await res.text()}`);
  }
  return userIds.length;
}
