// しらベール Worker：画面（public/）と API の入口

import { Lark } from "./lark.js";
import { verifyLiffIdToken } from "./line.js";
import { addAction, buildReport, createSummary, distribute, loadDepartments, loadQuestions, loadRounds, runDaily, submitAnswer } from "./survey.js";
import { safeEqual, verifyToken } from "./token.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

/** 回答者を確かめる：Lark の署名リンク／LINE の LIFF／デモ */
async function identify(env, body) {
  if (body.t) {
    const p = await verifyToken(env.LINK_SECRET, body.t);
    if (p && p.r === body.round && p.u) return { channel: "Lark", userId: p.u };
    return null;
  }
  if (body.idToken) {
    const sub = await verifyLiffIdToken(env, body.idToken);
    return sub ? { channel: "LINE", userId: sub } : null;
  }
  if (body.demo && env.DEMO_MODE === "true") return { channel: "デモ", userId: crypto.randomUUID() };
  return null;
}

function isAdmin(env, request) {
  const key = request.headers.get("x-admin-key") || "";
  return Boolean(env.ADMIN_PASSWORD) && safeEqual(key, env.ADMIN_PASSWORD);
}

async function handleApi(request, env, url) {
  const lark = new Lark(env);
  const path = url.pathname;

  // ── 回答する人向け ──
  if (path === "/api/config" && request.method === "GET") {
    return json({ liffId: env.LIFF_ID || null, demo: env.DEMO_MODE === "true", companyName: env.COMPANY_NAME || "" });
  }
  if (path === "/api/survey" && request.method === "GET") {
    const round = url.searchParams.get("r");
    const rounds = await loadRounds(lark);
    const r = round ? rounds.find((x) => x.name === round) : rounds.filter((x) => x.status === "実施中").at(-1);
    if (!r) return json({ error: "実施中のアンケートはありません" }, 404);
    const [questions, departments] = await Promise.all([loadQuestions(lark), loadDepartments(lark)]);
    return json({ round: r.name, open: r.status === "実施中", due: r.due, questions, departments });
  }
  if (path === "/api/answer" && request.method === "POST") {
    const body = await readJson(request);
    const identity = await identify(env, body);
    if (!identity) return json({ ok: false, error: "回答用リンクを確認できませんでした。届いたメッセージのボタンから開き直してください" }, 401);
    const result = await submitAnswer(env, lark, { ...body, identity });
    return json(result, result.ok ? 200 : 400);
  }

  // ── 管理画面向け ──
  if (path.startsWith("/api/admin/")) {
    if (!isAdmin(env, request)) return json({ error: "パスワードが違います" }, 401);
    if (path === "/api/admin/rounds") return json({ rounds: await loadRounds(lark) });
    if (path === "/api/admin/report") {
      const report = await buildReport(lark, url.searchParams.get("r"));
      return report ? json(report) : json({ error: "回が見つかりません" }, 404);
    }
    if (request.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
    const body = await readJson(request);
    if (path === "/api/admin/summarize") return json({ ai: await createSummary(env, lark, body.round) });
    if (path === "/api/admin/distribute") return json({ result: await distribute(env, lark, body.round) });
    if (path === "/api/admin/actions") {
      await addAction(lark, body);
      return json({ ok: true });
    }
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
