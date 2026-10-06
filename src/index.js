// あつめール Worker：画面（public/）と API の入口

import { closeRound, loadDues, loadMembers, loadRounds, markDue, myStatus, reconcile, registerLine, runDaily, sendNotice, sendReminder } from "./dues.js";
import { Lark } from "./lark.js";
import { verifyLiffIdToken } from "./line.js";
import { safeEqual } from "./token.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function isAdmin(env, request) {
  const key = request.headers.get("x-admin-key") || "";
  return Boolean(env.ADMIN_PASSWORD) && safeEqual(key, env.ADMIN_PASSWORD);
}

async function handleApi(request, env, url) {
  const lark = new Lark(env);
  const path = url.pathname;

  // ── メンバー向け（LIFF） ──
  if (path === "/api/config" && request.method === "GET") {
    return json({ liffId: env.LIFF_ID || null, chapterName: env.CHAPTER_NAME || "" });
  }
  if ((path === "/api/me" || path === "/api/register") && request.method === "POST") {
    const body = await readJson(request);
    const lineUserId = body.idToken ? await verifyLiffIdToken(env, body.idToken) : null;
    if (!lineUserId) return json({ ok: false, error: "LINE の本人確認ができませんでした。LINE から開き直してください" }, 401);
    if (path === "/api/me") return json(await myStatus(lark, lineUserId));
    const result = await registerLine(lark, { lineUserId, memberNo: body.memberNo, name: body.name });
    return json(result, result.ok ? 200 : 400);
  }

  // ── 管理画面（会計担当）向け ──
  if (path.startsWith("/api/admin/")) {
    if (!isAdmin(env, request)) return json({ error: "パスワードが違います" }, 401);
    if (path === "/api/admin/rounds") return json({ rounds: await loadRounds(lark) });
    if (path === "/api/admin/round") {
      const name = url.searchParams.get("r");
      const [dues, members] = await Promise.all([loadDues(lark, name), loadMembers(lark)]);
      const line = new Set(members.filter((m) => m.lineUserId).map((m) => m.memberNo));
      return json({ dues: dues.map((d) => ({ ...d, line: line.has(d.memberNo) })) });
    }
    if (request.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
    const body = await readJson(request);
    const round = body.round ? (await loadRounds(lark)).find((r) => r.name === body.round) : null;
    if (path === "/api/admin/import") return json(await reconcile(env, lark, body.round, body.csv || ""));
    if (path === "/api/admin/mark") {
      await markDue(lark, body);
      return json({ ok: true });
    }
    if (!round) return json({ error: "集金回が見つかりません" }, 404);
    if (path === "/api/admin/notice") return json(await sendNotice(env, lark, round));
    if (path === "/api/admin/remind") return json(await sendReminder(env, lark, round));
    if (path === "/api/admin/close") return json(await closeRound(env, lark, round));
  }
  return json({ error: "Not Found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (e) {
        console.error(e);
        return json({ error: String(e.message || e) }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runDaily(env, new Lark(env)).then((log) => console.log(JSON.stringify(log))));
  },
};
