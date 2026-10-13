// GET /api/config：ページに渡してよい設定だけを返す（LIFF ID は秘密情報ではない）。
export function onRequestGet({ env }) {
  return Response.json({ liffId: env.LIFF_ID ?? "" });
}
