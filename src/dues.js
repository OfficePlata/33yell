// 会費の集金：案内 → リマインド → 締切 と、Peatix CSV の照合。

import { matchPayments, normalizeKey, readPeatixRows } from "./csv.js";
import { pushButtons } from "./line.js";

const DAY = 24 * 60 * 60 * 1000;

/** 日本時間の日付（YYYY-MM-DD） */
export function jstDate(ms = Date.now()) {
  return new Date(Number(ms) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function addDays(ymd, n) {
  return jstDate(Date.parse(`${ymd}T00:00:00+09:00`) + n * DAY);
}

const yen = (n) => `${Number(n || 0).toLocaleString("ja-JP")}円`;
const mmdd = (ymd) => (ymd ? `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}` : "");

// ── BASE の読み込み ──

export async function loadMembers(lark) {
  const rows = await lark.records("members");
  return rows
    .filter((r) => r["メンバー番号"])
    .map((r) => ({
      id: r.id,
      memberNo: String(r["メンバー番号"]),
      name: r["名前"] || "",
      active: r["在籍"] !== false,
      lineUserId: r["LINEユーザーID"] || "",
    }));
}

export async function loadRounds(lark) {
  const rows = await lark.records("rounds");
  return rows
    .filter((r) => r["回名"])
    .map((r) => ({
      id: r.id,
      name: r["回名"],
      amount: Number(r["金額"] || 0),
      peatixUrl: linkUrl(r["PeatixURL"]),
      noticeDate: r["案内日"] ? jstDate(r["案内日"]) : "",
      due: r["締切日"] ? jstDate(r["締切日"]) : "",
      status: r["状態"] || "予定",
      reminded: Boolean(r["前日リマインド済"]),
    }))
    .sort((a, b) => (a.noticeDate < b.noticeDate ? -1 : 1));
}

/** BASE の URL 欄は { link, text } で返るので、文字列にそろえる */
function linkUrl(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v.link || v.text || "";
}

export async function loadDues(lark, roundName) {
  const rows = await lark.records("dues", [["集金回", roundName]]);
  return rows.map((r) => ({
    id: r.id,
    memberNo: String(r["メンバー番号"] || ""),
    name: r["名前"] || "",
    status: r["状態"] || "未入金",
    method: r["方法"] || "",
    saleId: r["Peatix販売ID"] || "",
    paidAt: r["入金確認日時"] || null,
    reminders: Number(r["リマインド回数"] || 0),
  }));
}

// ── 毎朝の処理 ──

/**
 * 今日やることを決める（通信しない）。
 * - 案内日になった「予定」の回 → 案内
 * - 締切日の前日の「案内中」の回 → 未入金の人にリマインド
 * - 締切日を過ぎた「案内中」の回 → 締切（会計担当へ未入金一覧）
 */
export function planDaily(rounds, today) {
  const plan = [];
  for (const r of rounds) {
    if (r.status === "予定" && r.noticeDate && r.noticeDate <= today) plan.push({ action: "notice", round: r });
    else if (r.status === "案内中" && r.due && today > r.due) plan.push({ action: "close", round: r });
    else if (r.status === "案内中" && r.due && !r.reminded && today >= addDays(r.due, -1)) plan.push({ action: "remind", round: r });
  }
  return plan;
}

export async function runDaily(env, lark, today = jstDate()) {
  const rounds = await loadRounds(lark);
  const log = [];
  for (const { action, round } of planDaily(rounds, today)) {
    if (action === "notice") log.push({ round: round.name, notice: await sendNotice(env, lark, round) });
    if (action === "remind") {
      log.push({ round: round.name, remind: await sendReminder(env, lark, round) });
      await lark.update("rounds", round.id, { 前日リマインド済: true });
    }
    if (action === "close") log.push({ round: round.name, close: await closeRound(env, lark, round) });
  }
  return log;
}

/** 在籍メンバー全員の「入金」行をそろえる（あとから入った人も足す） */
async function ensureDues(lark, round, members) {
  const existing = new Set((await loadDues(lark, round.name)).map((d) => d.memberNo));
  const rows = members
    .filter((m) => m.active && !existing.has(m.memberNo))
    .map((m) => ({ 集金回: round.name, メンバー番号: m.memberNo, 名前: m.name, 状態: "未入金", リマインド回数: 0 }));
  if (rows.length) await lark.create("dues", rows);
  return rows.length;
}

function liffUrl(env) {
  return env.LIFF_ID ? `https://liff.line.me/${env.LIFF_ID}` : `${env.PUBLIC_URL}/r/`;
}

function payButtons(env, round) {
  return [
    ...(round.peatixUrl ? [{ label: "Peatixで支払う", url: round.peatixUrl }] : []),
    { label: "支払い状況を見る", url: liffUrl(env) },
  ];
}

export async function sendNotice(env, lark, round) {
  const members = await loadMembers(lark);
  const created = await ensureDues(lark, round, members);
  const targets = members.filter((m) => m.active && m.lineUserId).map((m) => m.lineUserId);
  const sent = await pushButtons(env, targets, {
    title: `${round.name} 会費のご案内`,
    text: `${yen(round.amount)}／締切 ${mmdd(round.due)}。Peatixからお支払いください`,
    buttons: payButtons(env, round),
  });
  await lark.update("rounds", round.id, { 状態: "案内中" });
  const noLine = members.filter((m) => m.active && !m.lineUserId).map((m) => m.name);
  await notifyTreasurer(env, lark, {
    title: `${round.name} の会費案内を送りました`,
    text:
      `LINE で ${sent} 人に案内しました（入金表 ${created} 行を作成）。` +
      (noLine.length ? `\nLINE 未登録の方：${noLine.join("、")}（個別にご案内ください）` : ""),
  });
  return { created, sent, noLine: noLine.length };
}

export async function sendReminder(env, lark, round) {
  const [members, dues] = await Promise.all([loadMembers(lark), loadDues(lark, round.name)]);
  const unpaid = dues.filter((d) => d.status === "未入金");
  const lineOf = new Map(members.map((m) => [m.memberNo, m.lineUserId]));
  const targets = unpaid.map((d) => lineOf.get(d.memberNo)).filter(Boolean);
  const sent = await pushButtons(env, targets, {
    title: `${round.name} 会費のお願い`,
    text: `締切は ${mmdd(round.due)} です。お済みの方は行き違いご容赦ください`,
    buttons: payButtons(env, round),
  });
  for (const d of unpaid) if (lineOf.get(d.memberNo)) await lark.update("dues", d.id, { リマインド回数: d.reminders + 1 });
  return { unpaid: unpaid.length, sent };
}

export async function closeRound(env, lark, round) {
  const dues = await loadDues(lark, round.name);
  const unpaid = dues.filter((d) => d.status === "未入金");
  const paid = dues.filter((d) => d.status === "入金済");
  await lark.update("rounds", round.id, { 状態: "締切" });
  await notifyTreasurer(env, lark, {
    title: `${round.name} を締め切りました`,
    text:
      `入金済 ${paid.length} 人／未入金 ${unpaid.length} 人（${yen(paid.length * round.amount)} 見込み）` +
      (unpaid.length ? `\n未入金：${unpaid.map((d) => d.name).join("、")}` : "\n全員の入金を確認できました。"),
    buttonText: "管理画面で確認",
    url: `${env.PUBLIC_URL}/admin/`,
  });
  return { paid: paid.length, unpaid: unpaid.length };
}

async function notifyTreasurer(env, lark, card) {
  if (!env.LARK_ADMIN_CHAT_ID) return;
  try {
    await lark.sendCard("chat_id", env.LARK_ADMIN_CHAT_ID, card);
  } catch (e) {
    console.error(`Lark 通知に失敗: ${e.message}`);
  }
}

// ── Peatix CSV の照合 ──

export async function reconcile(env, lark, roundName, csvText) {
  const round = (await loadRounds(lark)).find((r) => r.name === roundName);
  if (!round) throw new Error(`集金回「${roundName}」が BASE にありません`);
  const members = await loadMembers(lark);
  await ensureDues(lark, round, members);
  const rows = readPeatixRows(csvText, env.MEMBER_NO_LABEL || "メンバー番号");
  const { matched, unmatched } = matchPayments(rows, members);

  const dues = await loadDues(lark, round.name);
  const dueOf = new Map(dues.map((d) => [d.memberNo, d]));
  let updated = 0;
  let already = 0;
  const now = Date.now();
  for (const m of matched) {
    const d = dueOf.get(m.memberNo);
    if (!d) {
      // 退会済みなど、入金表にいない人の支払い
      await lark.create("dues", [{ 集金回: round.name, メンバー番号: m.memberNo, 名前: m.name, 状態: "入金済", 方法: "Peatix", Peatix販売ID: m.saleId, 入金確認日時: now }]);
      updated++;
    } else if (d.status === "入金済" || d.status === "免除") already++;
    else {
      await lark.update("dues", d.id, { 状態: "入金済", 方法: "Peatix", Peatix販売ID: m.saleId, 入金確認日時: now });
      updated++;
    }
  }
  const unpaid = (await loadDues(lark, round.name)).filter((d) => d.status === "未入金");
  const summary = { rows: rows.length, matched: matched.length, updated, already, unmatched, unpaid: unpaid.map((d) => d.name) };

  await lark.create("imports", [
    {
      集金回: round.name,
      取込日時: now,
      CSV行数: rows.length,
      一致: matched.length,
      新しく入金済: updated,
      要確認: unmatched.length,
      要確認の内容: unmatched.map((u) => `${u.name || "（名前なし）"}／番号:${u.memberNo || "なし"}／販売ID:${u.saleId}：${u.reason}`).join("\n"),
    },
  ]);
  if (updated || unmatched.length) {
    await notifyTreasurer(env, lark, {
      title: `${round.name}：Peatix の入金を取り込みました`,
      text: `新しく入金済 ${updated} 人／要確認 ${unmatched.length} 件／未入金 ${unpaid.length} 人`,
      buttonText: "管理画面で確認",
      url: `${env.PUBLIC_URL}/admin/`,
    });
  }
  return summary;
}

/** 現金で受け取った・免除した・取り消す などを手で記録する */
export async function markDue(lark, { round, memberNo, status, method }) {
  if (!["未入金", "入金済", "免除"].includes(status)) throw new Error("状態は 未入金／入金済／免除 のどれかです");
  const d = (await loadDues(lark, round)).find((x) => x.memberNo === String(memberNo));
  if (!d) throw new Error("入金表に該当の行がありません");
  const fields = { 状態: status, 方法: status === "入金済" ? method || "現金" : null };
  fields["入金確認日時"] = status === "未入金" ? null : Date.now();
  await lark.update("dues", d.id, fields);
}

// ── メンバー向け（LIFF） ──

/** LINE と名簿をつなぐ。番号と名前の両方が合ったときだけ登録する */
export async function registerLine(lark, { lineUserId, memberNo, name }) {
  const members = await loadMembers(lark);
  const m = members.find((x) => normalizeKey(x.memberNo) === normalizeKey(memberNo));
  if (!m || normalizeKey(m.name) !== normalizeKey(name)) {
    return { ok: false, error: "メンバー番号とお名前が名簿と一致しませんでした。会計担当にご確認ください" };
  }
  const other = members.find((x) => x.lineUserId === lineUserId && x.memberNo !== m.memberNo);
  if (other) await lark.update("members", other.id, { LINEユーザーID: "" });
  await lark.update("members", m.id, { LINEユーザーID: lineUserId, LINE登録日時: Date.now() });
  return { ok: true, name: m.name };
}

/** 本人の支払い状況（案内中・締切の直近の回） */
export async function myStatus(lark, lineUserId) {
  const me = (await loadMembers(lark)).find((m) => m.lineUserId === lineUserId);
  if (!me) return { registered: false };
  const rounds = (await loadRounds(lark)).filter((r) => r.status !== "予定").slice(-6).reverse();
  const items = [];
  for (const r of rounds) {
    const d = (await lark.records("dues", [["集金回", r.name], ["メンバー番号", me.memberNo]]))[0];
    items.push({ round: r.name, amount: r.amount, due: r.due, open: r.status === "案内中", peatixUrl: r.peatixUrl, status: d?.["状態"] || "未入金" });
  }
  return { registered: true, name: me.name, items };
}
