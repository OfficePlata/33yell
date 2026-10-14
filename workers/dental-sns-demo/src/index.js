import Anthropic from "@anthropic-ai/sdk";

const THEMES = { inside: "院内の様子", staff: "スタッフ紹介", care: "予防・ケアの豆知識", notice: "お知らせ（休診・診療時間）" };
const MAX_IMAGES = 6;

const MENUS = ["定期検診・クリーニング", "歯の痛み・気になるところ", "初めての相談", "お子さまの歯科"];
const DAYNAMES = "日月火水木金土";

// 日本時間の今日（YYYY-MM-DD）と今の時刻（HH:MM）
function nowJST() {
  const d = new Date(Date.now() + 9 * 3600e3).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
}
function reserveUrlOf(origin, slug) { return `${origin}/c/${slug}/yoyaku`; }
async function getTenant(env, slug) {
  if (!/^[a-z0-9-]{1,40}$/.test(slug || "")) return null;
  return env.DB.prepare("SELECT slug, name, open_days, am, pm, slot_min, capacity FROM tenants WHERE slug = ?").bind(slug).first();
}
function publicTenant(t, origin) {
  return { slug: t.slug, name: t.name, reserveUrl: reserveUrlOf(origin, t.slug), openDays: t.open_days.split(",").map(Number), am: t.am, pm: t.pm };
}
function slotTimes(t) {
  const out = [];
  for (const range of [t.am, t.pm]) {
    if (!range) continue;
    const [a, b] = range.split("-").map(x => { const [h, m] = x.split(":").map(Number); return h * 60 + m; });
    for (let m = a; m + t.slot_min <= b; m += t.slot_min) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}
function isOpenDay(t, date) {
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  return t.open_days.split(",").map(Number).includes(dow);
}
async function slotsFor(env, t, date) {
  const now = nowJST();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < now.date || !isOpenDay(t, date)) return [];
  const { results } = await env.DB.prepare("SELECT time, COUNT(*) AS n FROM reservations WHERE tenant = ? AND date = ? AND status != 'キャンセル' GROUP BY time").bind(t.slug, date).all();
  const used = Object.fromEntries(results.map(r => [r.time, r.n]));
  return slotTimes(t).filter(x => date > now.date || x > now.time).map(x => ({ time: x, left: Math.max(0, t.capacity - (used[x] || 0)) }));
}

const MAX_IMAGE_B64 = 1_500_000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

function buildPrompt({ clinic, theme, memo, count, reserveUrl }) {
  return `あなたは日本の歯科医院のSNS担当です。添付の写真（${count}枚）と下記の情報から、医院の公式アカウント用の投稿文を媒体ごとに作ってください。

医院名: ${clinic}
今回のテーマ: ${THEMES[theme] || THEMES.inside}
院長のメモ: ${memo || "（なし）"}
予約ページのURL: ${reserveUrl || "（なし）"}

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
- line: 友だちへの配信。80〜140字。最後に予約への一言（予約ページのURLがあれば「ご予約はこちら▶ URL」で入れる）
- google と facebook にも、予約ページのURLがあれば最後に「ご予約：URL」を入れる。instagram はURLを本文に入れず「ご予約はプロフィールのリンクから」とする

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

  const tenant = body.tenant ? await getTenant(env, String(body.tenant)) : null;
  const clinic = tenant ? tenant.name : String(body.clinic || "医院").slice(0, 60);
  const reserveUrl = tenant ? reserveUrlOf(new URL(request.url).origin, tenant.slug) : (/^https?:\/\/\S+$/.test(String(body.reserveUrl || "")) ? String(body.reserveUrl).slice(0, 300) : "");
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
  content.push({ type: "text", text: buildPrompt({ clinic, theme, memo, count: content.length, reserveUrl }) });

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });
  let response;
  try {
    response = await client.beta.messages.create({
      model: env.CLAUDE_MODEL || "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: env.CLAUDE_EFFORT || "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "rate_limited" }, 502);
    if (e instanceof Anthropic.APIError) { console.log("anthropic error", e.status, e.message); return json({ error: "upstream_error" }, 502); }
    console.log("anthropic connection error", String(e));
    return json({ error: "upstream_error" }, 502);
  }
  if (response.stop_reason === "refusal") return json({ error: "refused" }, 502);
  console.log("usage", JSON.stringify(response.usage));
  const text = response.content.filter(c => c.type === "text").map(c => c.text).join("");
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
    if (url.pathname.startsWith("/api/tenants")) return tenantApi(request, env, url);
    if (url.pathname.startsWith("/api/")) return json({ error: "not_found" }, 404);
    if (/^\/c\/[a-z0-9-]+\/yoyaku\/?$/.test(url.pathname)) return env.ASSETS.fetch(new Request(new URL("/booking", url), request));
    if (/^\/c\/[a-z0-9-]+\/?$/.test(url.pathname)) return env.ASSETS.fetch(new Request(new URL("/clinic", url), request));
    return env.ASSETS.fetch(request);
  },
};

async function readJson(request) { try { return await request.json(); } catch { return null; } }

async function tenantApi(request, env, url) {
  const origin = url.origin;
  const parts = url.pathname.split("/").filter(Boolean); // api, tenants, slug, sub, id
  if (parts.length === 2) {
    const { results } = await env.DB.prepare("SELECT slug, name, open_days, am, pm, slot_min, capacity FROM tenants ORDER BY created_at").all();
    return json({ tenants: results.map(t => publicTenant(t, origin)) });
  }
  const t = await getTenant(env, parts[2]);
  if (!t) return json({ error: "not_found" }, 404);
  const sub = parts[3];

  if (!sub) return json({ ...publicTenant(t, origin), menus: MENUS });

  if (sub === "slots") return json({ date: url.searchParams.get("date"), slots: await slotsFor(env, t, url.searchParams.get("date") || "") });

  if (sub === "days") {
    // 今日から14日分の、受付できる日と空き枠数
    const out = [];
    const base = new Date(nowJST().date + "T00:00:00Z");
    for (let i = 0; i < 14; i++) {
      const d = new Date(base.getTime() + i * 864e5).toISOString().slice(0, 10);
      const open = isOpenDay(t, d);
      const slots = open ? await slotsFor(env, t, d) : [];
      out.push({ date: d, dow: DAYNAMES[new Date(d + "T00:00:00Z").getUTCDay()], open, left: slots.reduce((a, s) => a + s.left, 0) });
    }
    return json({ days: out });
  }

  if (sub === "reservations" && request.method === "POST") {
    const b = await readJson(request);
    if (!b) return json({ error: "bad_request" }, 400);
    const date = String(b.date || ""), time = String(b.time || "");
    const menu = MENUS.includes(b.menu) ? b.menu : null;
    const name = String(b.name || "").trim().slice(0, 40);
    const phone = String(b.phone || "").replace(/[^\d-]/g, "").slice(0, 20);
    const visit = b.visit === "再診" ? "再診" : "初診";
    const note = String(b.note || "").slice(0, 200);
    if (!menu || !name || phone.replace(/-/g, "").length < 10) return json({ error: "invalid", message: "メニュー・お名前・電話番号を確認してください" }, 400);
    const slot = (await slotsFor(env, t, date)).find(x => x.time === time);
    if (!slot || slot.left < 1) return json({ error: "full", message: "その時間は埋まってしまいました。別の時間を選んでください" }, 409);
    const r = await env.DB.prepare("INSERT INTO reservations (tenant, date, time, menu, name, phone, visit, note) VALUES (?,?,?,?,?,?,?,?)").bind(t.slug, date, time, menu, name, phone, visit, note).run();
    return json({ ok: true, id: r.meta.last_row_id, date, time, menu });
  }

  // ここから下は医院側の画面用。本番では医院ごとのログインが必要（デモは認証なし）
  if (sub === "reservations" && request.method === "GET") {
    const from = url.searchParams.get("from") || nowJST().date;
    const { results } = await env.DB.prepare("SELECT id, date, time, menu, name, phone, visit, note, status FROM reservations WHERE tenant = ? AND date >= ? ORDER BY date, time LIMIT 200").bind(t.slug, from).all();
    return json({ reservations: results });
  }
  if (sub === "reservations" && request.method === "PATCH" && parts[4]) {
    const b = await readJson(request);
    const status = ["予約", "来院済み", "キャンセル"].includes(b?.status) ? b.status : null;
    if (!status) return json({ error: "bad_request" }, 400);
    await env.DB.prepare("UPDATE reservations SET status = ? WHERE tenant = ? AND id = ?").bind(status, t.slug, Number(parts[4])).run();
    return json({ ok: true });
  }
  if (sub === "posts" && request.method === "POST") {
    const b = await readJson(request);
    const theme = String(b?.theme || "").slice(0, 40);
    const media = Array.isArray(b?.media) ? b.media.map(String).slice(0, 6) : [];
    if (!theme || !media.length) return json({ error: "bad_request" }, 400);
    const source = b.source === "ai" ? "ai" : "example";
    const stmt = env.DB.prepare("INSERT INTO posts (tenant, theme, media, source) VALUES (?,?,?,?)");
    await env.DB.batch(media.map(m => stmt.bind(t.slug, theme, m, source)));
    return json({ ok: true });
  }
  if (sub === "posts" && request.method === "GET") {
    const { results } = await env.DB.prepare("SELECT theme, media, source, created_at FROM posts WHERE tenant = ? ORDER BY id DESC LIMIT 50").bind(t.slug).all();
    return json({ posts: results });
  }
  return json({ error: "not_found" }, 404);
}
