const THEMES = { inside: "院内の様子", staff: "スタッフ紹介", care: "予防・ケアの豆知識", notice: "お知らせ（休診・診療時間）" };
const MAX_IMAGES = 6;
const MAX_IMAGE_B64 = 1_500_000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

function buildPrompt({ clinic, theme, memo, count }) {
  return `あなたは日本の歯科医院のSNS担当です。添付の写真（${count}枚）と下記の情報から、医院の公式アカウント用の投稿文を媒体ごとに作ってください。

医院名: ${clinic}
今回のテーマ: ${THEMES[theme] || THEMES.inside}
院長のメモ: ${memo || "（なし）"}

守ること（医療広告ガイドライン）:
- 効果の断定（痛くない、必ず治る、100%など）、他院との比較（No.1、地域一など）、誇大・最上級表現（最高、最先端など）、患者の体験談、費用の強調（格安、今だけ割引など）は使わない
- 院長メモにそうした表現があれば、事実に沿った穏やかな言い方に言い換える
- 写真に患者の顔や個人情報らしきものが写っていれば notes で指摘する
- 写真に写っていないことは書かない。日付など不明な情報は「○月○日」のように空欄にする
- やさしく親しみやすい口調。絵文字は控えめ

媒体ごとの書き方:
- instagram: 250〜400字。改行多め。ハッシュタグは本文に入れず hashtags に5個
- facebook: 200〜350字。【見出し】から始める
- google: Googleビジネスプロフィールの投稿。120〜200字。要点だけ
- line: 友だちへの配信。80〜140字。最後に予約への一言

JSONだけを返してください（前後に文章を付けない）:
{"instagram":"…","hashtags":["#…"],"facebook":"…","google":"…","line":"…","notes":[{"phrase":"問題の言葉","reason":"理由","fix":"どう言い換えたか"}]}
notes は言い換えや指摘が無ければ空配列。`;
}

function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch {} }
  return null;
}

async function generate(request, env) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: "ai_disabled" }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400); }
  if (env.DEMO_PASSCODE && body.code !== env.DEMO_PASSCODE) return json({ error: "bad_code" }, 401);

  const clinic = String(body.clinic || "医院").slice(0, 60);
  const theme = String(body.theme || "inside");
  const memo = String(body.memo || "").slice(0, 400);
  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  const content = [];
  for (const im of images) {
    const media_type = ["image/jpeg", "image/png", "image/webp"].includes(im?.media_type) ? im.media_type : null;
    const data = typeof im?.data === "string" ? im.data : "";
    if (!media_type || !data || data.length > MAX_IMAGE_B64) return json({ error: "bad_image" }, 400);
    content.push({ type: "image", source: { type: "base64", media_type, data } });
  }
  content.push({ type: "text", text: buildPrompt({ clinic, theme, memo, count: content.length }) });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env.CLAUDE_MODEL || "claude-sonnet-5-5", max_tokens: 2500, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) {
    console.log("anthropic error", res.status, (await res.text()).slice(0, 500));
    return json({ error: res.status === 429 ? "rate_limited" : "upstream_error" }, 502);
  }
  const out = await res.json();
  const text = (out.content || []).filter(c => c.type === "text").map(c => c.text).join("");
  const r = parseJson(text);
  if (!r || typeof r.instagram !== "string") return json({ error: "invalid_json" }, 502);
  return json({
    instagram: r.instagram,
    hashtags: Array.isArray(r.hashtags) ? r.hashtags.map(String).slice(0, 10) : [],
    facebook: String(r.facebook || ""), google: String(r.google || ""), line: String(r.line || ""),
    notes: Array.isArray(r.notes) ? r.notes.filter(n => n && n.phrase).map(n => ({ phrase: String(n.phrase), reason: String(n.reason || ""), fix: String(n.fix || "") })) : [],
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/status") return json({ ai: !!env.ANTHROPIC_API_KEY, needsCode: !!env.DEMO_PASSCODE });
    if (url.pathname === "/api/generate" && request.method === "POST") return generate(request, env);
    if (url.pathname.startsWith("/api/")) return json({ error: "not_found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
