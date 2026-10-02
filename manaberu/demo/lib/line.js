// LIFF から届いた ID トークンを LINE に問い合わせて、本物か確かめる。
// ページから送られてきた「ユーザーID」をそのまま信じると、なりすましができてしまうため。

export async function verifyLineIdToken(env, idToken, fetchImpl = fetch) {
  if (!idToken || !env.LINE_CHANNEL_ID) return null;
  const res = await fetchImpl("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: env.LINE_CHANNEL_ID }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.sub ? { userId: data.sub, displayName: data.name ?? "" } : null;
}
