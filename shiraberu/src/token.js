// 署名つきリンクと匿名キー。Web Crypto だけで動く（Workers / Node 20+）。

const enc = new TextEncoder();

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str) {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Lark で配る個人別リンクのトークン。payload = { r: 回名, u: open_id } */
export async function signToken(secret, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = b64url(await hmac(secret, body));
  return `${body}.${sig}`;
}

export async function verifyToken(secret, token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = b64url(await hmac(secret, body));
  if (!safeEqual(sig, expected)) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromB64url(body)));
  } catch {
    return null;
  }
}

/**
 * 回答者キー。回ごとに変わるので、月をまたいで個人を追えない。
 * 同じ人の二重回答だけを防ぐ。秘密のソルトがないと元の ID に戻せない。
 */
export async function respondentKey(salt, round, channel, userId) {
  const bytes = await hmac(salt, `${round}:${channel}:${userId}`);
  return b64url(bytes).slice(0, 22);
}
