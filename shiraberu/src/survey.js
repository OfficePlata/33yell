// しらベールの業務ロジック（回答の受付・集計・配信・月次処理）

import { aggregate, withDiff } from "./aggregate.js";
import { summarize } from "./ai.js";
import { broadcastSurvey } from "./line.js";
import { respondentKey, signToken } from "./token.js";

const JST = 9 * 60 * 60 * 1000;

/** JST の日付（YYYY-MM-DD） */
export function jstDate(ms = Date.now()) {
  return new Date(ms + JST).toISOString().slice(0, 10);
}

export async function loadQuestions(lark) {
  const rows = await lark.records("questions");
  return rows
    .filter((r) => r["有効"])
    .map((r) => ({ id: r["設問ID"], text: r["設問文"], category: r["カテゴリ"], type: r["形式"], order: r["並び順"] ?? 0 }))
    .sort((a, b) => a.order - b.order);
}

export async function loadDepartments(lark) {
  const rows = await lark.records("departments");
  return rows.sort((a, b) => (a["並び順"] ?? 0) - (b["並び順"] ?? 0)).map((r) => r["部署名"]).filter(Boolean);
}

export async function loadRounds(lark) {
  const rows = await lark.records("rounds");
  return rows
    .map((r) => ({ id: r.id, name: r["回名"], start: r["開始日"], due: r["締切日"], status: r["状態"], target: r["対象人数"] ?? null, sent: !!r["配信済"] }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

async function loadAnswerRows(lark, round) {
  const rows = await lark.records("answers", [["サーベイ回", round]]);
  return rows.map((r) => ({
    key: r["回答者キー"],
    department: r["部署"],
    questionId: r["設問ID"],
    category: r["カテゴリ"],
    score: typeof r["点数"] === "number" ? r["点数"] : null,
    comment: r["自由記述"] || "",
  }));
}

/** 回答を受け付ける。identity は { channel, userId } */
export async function submitAnswer(env, lark, { round, identity, department, answers, comment }) {
  const rounds = await loadRounds(lark);
  const r = rounds.find((x) => x.name === round);
  if (!r || r.status !== "実施中") return { ok: false, error: "このアンケートは受付期間外です" };

  const questions = await loadQuestions(lark);
  const key = await respondentKey(env.ANON_SALT, round, identity.channel, identity.userId);
  const dup = await lark.records("answers", [["サーベイ回", round], ["回答者キー", key]]);
  if (dup.length) return { ok: false, error: "この回は回答済みです。ご協力ありがとうございました" };

  const departments = await loadDepartments(lark);
  const dept = departments.includes(department) ? department : "未回答";
  const now = Date.now();
  const rows = [];
  for (const q of questions) {
    if (q.type === "5段階") {
      const score = Number(answers?.[q.id]);
      if (!Number.isInteger(score) || score < 1 || score > 5) return { ok: false, error: "未回答の設問があります" };
      rows.push({ 設問ID: q.id, カテゴリ: q.category, 点数: score });
    } else if (q.type === "自由記述" && typeof comment === "string" && comment.trim()) {
      rows.push({ 設問ID: q.id, カテゴリ: q.category, 自由記述: comment.trim().slice(0, 1000) });
    }
  }
  await lark.create(
    "answers",
    rows.map((row) => ({ ...row, サーベイ回: round, 回答者キー: key, 部署: dept, 経路: identity.channel, 回答日時: now }))
  );
  return { ok: true };
}

/** 管理画面用のレポート（前回との差つき） */
export async function buildReport(lark, round) {
  const [questions, rounds] = await Promise.all([loadQuestions(lark), loadRounds(lark)]);
  const idx = rounds.findIndex((r) => r.name === round);
  if (idx < 0) return null;
  const current = aggregate(await loadAnswerRows(lark, round), questions);
  const prevRound = idx > 0 ? rounds[idx - 1].name : null;
  const previous = prevRound ? aggregate(await loadAnswerRows(lark, prevRound), questions) : null;
  const result = withDiff(current, previous);

  // 推移（直近6回）
  const trend = [];
  for (const r of rounds.slice(Math.max(0, idx - 5), idx + 1)) {
    const agg = r.name === round ? current : r.name === prevRound ? previous : aggregate(await loadAnswerRows(lark, r.name), questions);
    trend.push({ round: r.name, overall: agg.overall, categories: agg.byCategory });
  }

  const reports = await lark.records("reports", [["回名", round]]);
  const saved = reports[0] ? JSON.parse(reports[0]["AI結果JSON"] || "null") : null;
  const target = rounds[idx].target;
  return {
    round: rounds[idx],
    responseRate: target ? Math.round((current.respondents / target) * 1000) / 10 : null,
    ...result,
    trend,
    ai: saved,
  };
}

/** AI で要約し、月次レポートに保存する */
export async function createSummary(env, lark, round) {
  const report = await buildReport(lark, round);
  if (!report) throw new Error("回が見つかりません");
  if (report.respondents === 0) throw new Error("まだ回答がありません");
  const ai = await summarize(env, { round, result: report });
  const fields = {
    回名: round,
    回答数: report.respondents,
    回答率: report.responseRate,
    総合スコア: report.overall,
    前回差: report.overallDiff ?? null,
    カテゴリ別スコア: report.byCategory.map((c) => `${c.name}: ${c.score}${c.diff != null ? `（${c.diff >= 0 ? "+" : ""}${c.diff}）` : ""}`).join("\n"),
    AI要約: [ai.summary, "", "■良い点", ...ai.strengths.map((s) => `・${s}`), "", "■気になる点", ...ai.concerns.map((s) => `・${s}`)].join("\n"),
    改善アクション案: ai.actions.map((a, i) => `${i + 1}. ${a.title}（${a.category}）\n   理由：${a.why}`).join("\n"),
    AI結果JSON: JSON.stringify(ai),
    作成日時: Date.now(),
  };
  for (const k of Object.keys(fields)) if (fields[k] == null) delete fields[k];
  const existing = await lark.records("reports", [["回名", round]]);
  if (existing[0]) await lark.update("reports", existing[0].id, fields);
  else await lark.create("reports", [fields]);
  return ai;
}

export async function addAction(lark, { round, title, category }) {
  await lark.create("actions", [{ アクション: title, 回名: round, カテゴリ: category, 状態: "未着手" }]);
}

/** 回答のお願いを Lark（個人別リンク）と LINE（LIFF）で送る */
export async function distribute(env, lark, round) {
  const rounds = await loadRounds(lark);
  const r = rounds.find((x) => x.name === round);
  if (!r) throw new Error("回が見つかりません");
  const due = r.due ? jstDate(r.due) : "";
  const text = `${round} のしらベールです。1〜3分で終わります。回答は匿名で集計されます。${due ? `\n締切：${due}` : ""}`;
  const result = { lark: 0, line: false };

  if (env.LARK_SURVEY_CHAT_ID) {
    const members = await lark.chatMembers(env.LARK_SURVEY_CHAT_ID);
    for (const openId of members) {
      const t = await signToken(env.LINK_SECRET, { r: round, u: openId });
      const url = `${env.PUBLIC_URL}/a/?r=${encodeURIComponent(round)}&t=${encodeURIComponent(t)}`;
      await lark.sendCard("open_id", openId, { title: "しらベール 回答のお願い", text, buttonText: "回答する", url });
      result.lark++;
    }
  }
  if (env.LINE_CHANNEL_ACCESS_TOKEN && env.LIFF_ID) {
    await broadcastSurvey(env, { title: "しらベール 回答のお願い", text: "1〜3分・匿名で集計します", url: `https://liff.line.me/${env.LIFF_ID}?r=${encodeURIComponent(round)}` });
    result.line = true;
  }
  await lark.update("rounds", r.id, { 状態: "実施中", 配信済: true });
  return result;
}

/** 毎朝の定期処理：開始日になった回を配信、締切を過ぎた回を集計して通知 */
export async function runDaily(env, lark, now = Date.now()) {
  const today = jstDate(now);
  const log = [];
  for (const r of await loadRounds(lark)) {
    if (r.status === "予定" && r.start && jstDate(r.start) <= today) {
      log.push({ round: r.name, distributed: await distribute(env, lark, r.name) });
    } else if (r.status === "実施中" && r.due && jstDate(r.due) < today) {
      await lark.update("rounds", r.id, { 状態: "締切" });
      let ai = null;
      try {
        ai = await createSummary(env, lark, r.name);
        await lark.update("rounds", r.id, { 状態: "集計済" });
      } catch (e) {
        log.push({ round: r.name, summaryError: String(e.message || e) });
      }
      if (env.LARK_ADMIN_CHAT_ID) {
        await lark.sendCard("chat_id", env.LARK_ADMIN_CHAT_ID, {
          title: `しらベール ${r.name} の結果が出ました`,
          text: ai ? ai.summary : "集計が終わりました。管理画面で結果を確認できます。",
          buttonText: "結果を見る",
          url: `${env.PUBLIC_URL}/admin/?r=${encodeURIComponent(r.name)}`,
        });
      }
      log.push({ round: r.name, closed: true });
    }
  }
  return log;
}

