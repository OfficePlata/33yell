// 集金：案内 → リマインド → 締切 と、Peatix CSV の照合。
// 集金回の種別は「会費」（名簿のメンバーから集める）と「ビジター」（例会のビジター参加費）の2つ。
// LINE の設定がなければ LINE には送らず、そのまま貼れる案内文を Lark で会計担当に渡す。

import { CANCELLED, matchPayments, normalizeKey, PENDING, readPeatixRows } from "./csv.js";
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
      kind: r["種別"] === "ビジター" ? "ビジター" : "会費",
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

export const lineEnabled = (env) => Boolean(env.LINE_CHANNEL_ACCESS_TOKEN);

// ── そのまま貼れる文面（LINE を使わないチャプター、LINE 未登録の人、ビジターの紹介者向け） ──

export function noticeMessage(round) {
  if (round.kind === "ビジター") {
    return [
      `【${round.name} ビジター参加のご案内】`,
      `参加費：${yen(round.amount)}`,
      round.due ? `例会日：${mmdd(round.due)}` : "",
      `お申し込みとお支払いはこちら（Peatix）：${round.peatixUrl || "（URL 未設定）"}`,
      "申込フォームに、会社名・業種・紹介者のお名前をご記入ください。",
    ].filter(Boolean).join("\n");
  }
  return [
    `【${round.name} 会費のご案内】`,
    `金額：${yen(round.amount)}`,
    round.due ? `締切：${mmdd(round.due)}` : "",
    `お支払いはこちら（Peatix）：${round.peatixUrl || "（URL 未設定）"}`,
    "申込フォームの「メンバー番号」を必ずご記入ください。",
  ].filter(Boolean).join("\n");
}

export function reminderMessage(round, names = []) {
  return [
    `【${round.name} 会費のお願い】`,
    names.length ? `${names.map((n) => `${n}さん`).join("、")}` : "",
    `締切は ${mmdd(round.due)} です。まだの方はこちらからお願いします：${round.peatixUrl || "（URL 未設定）"}`,
    "お済みの方は、行き違いご容赦ください。",
  ].filter(Boolean).join("\n");
}

const pasteBlock = (text) => `\n\n▼ そのまま貼れる文面\n${text}`;

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
  if (round.kind === "ビジター") return sendVisitorNotice(env, lark, round);
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
  if (!lineEnabled(env)) {
    await notifyTreasurer(env, lark, {
      title: `${round.name} の会費案内を始めました`,
      text: `入金表 ${created} 行を作成しました。チャプターのグループやメールで、下の文面を送ってください。${pasteBlock(noticeMessage(round))}`,
    });
    return { created, sent: 0, noLine: noLine.length, line: false };
  }
  await notifyTreasurer(env, lark, {
    title: `${round.name} の会費案内を送りました`,
    text:
      `LINE で ${sent} 人に案内しました（入金表 ${created} 行を作成）。` +
      (noLine.length ? `\nLINE 未登録の方：${noLine.join("、")}（下の文面を個別に送ってください）${pasteBlock(noticeMessage(round))}` : ""),
  });
  return { created, sent, noLine: noLine.length, line: true };
}

export async function sendReminder(env, lark, round) {
  if (round.kind === "ビジター") return sendVisitorDayBefore(env, lark, round);
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
  // LINE で届かない人（LINE なしのチャプター・未登録の人）は、会計担当に文面を渡す
  const byHand = unpaid.filter((d) => !lineEnabled(env) || !lineOf.get(d.memberNo)).map((d) => d.name);
  if (byHand.length) {
    await notifyTreasurer(env, lark, {
      title: `${round.name}：締切前日です（未入金 ${unpaid.length} 人）`,
      text: `${lineEnabled(env) ? "LINE で届かない" : "未入金の"}方：${byHand.join("、")}${pasteBlock(reminderMessage(round))}`,
    });
  }
  return { unpaid: unpaid.length, sent, byHand: byHand.length };
}

export async function closeRound(env, lark, round) {
  if (round.kind === "ビジター") return closeVisitorRound(env, lark, round);
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
  if (round.kind === "ビジター") return importVisitors(env, lark, round, csvText);
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
  const rounds = (await loadRounds(lark)).filter((r) => r.kind === "会費" && r.status !== "予定").slice(-6).reverse();
  const items = [];
  for (const r of rounds) {
    const d = (await lark.records("dues", [["集金回", r.name], ["メンバー番号", me.memberNo]]))[0];
    items.push({ round: r.name, amount: r.amount, due: r.due, open: r.status === "案内中", peatixUrl: r.peatixUrl, status: d?.["状態"] || "未入金" });
  }
  return { registered: true, name: me.name, items };
}

// ── ビジター参加費 ──
// 集金回（種別＝ビジター）1行 = 例会1回。案内日に紹介用の文面を配り、締切日（＝例会日）の前日に
// ビジター一覧を、翌日に集計を Lark で会計担当に届ける。ビジターは Peatix の CSV から自動で並ぶ。

const VISITOR_STATUSES = ["入金済", "未入金", "当日現金", "キャンセル"];

export async function loadVisitors(lark, roundName) {
  const rows = await lark.records("visitors", [["集金回", roundName]]);
  return rows.map((r) => ({
    id: r.id,
    name: r["名前"] || "",
    company: r["会社名"] || "",
    category: r["業種"] || "",
    referrer: r["紹介者"] || "",
    status: r["状態"] || "未入金",
    method: r["方法"] || "",
    saleId: r["Peatix販売ID"] || "",
  }));
}

/** 例会の集計（通信しない） */
export function visitorSummary(visitors, amount) {
  const active = visitors.filter((v) => v.status !== "キャンセル");
  const count = (s) => active.filter((v) => v.status === s).length;
  const paid = count("入金済");
  const cash = count("当日現金");
  return { total: active.length, paid, cash, unpaid: count("未入金"), amount: (paid + cash) * amount };
}

const visitorLine = (v) => `・${v.name}${v.company ? `（${v.company}${v.category ? `／${v.category}` : ""}）` : ""}${v.referrer ? ` 紹介：${v.referrer}` : ""}　${v.status}`;

async function sendVisitorNotice(env, lark, round) {
  const members = await loadMembers(lark);
  const targets = members.filter((m) => m.active && m.lineUserId).map((m) => m.lineUserId);
  const sent = lineEnabled(env)
    ? await pushButtons(env, targets, {
        title: `${round.name} ビジターのお誘い`,
        text: `ビジター参加費 ${yen(round.amount)}。お誘いする方に申込ページを送ってください`,
        buttons: round.peatixUrl ? [{ label: "申込ページを開く", url: round.peatixUrl }] : [],
      })
    : 0;
  await lark.update("rounds", round.id, { 状態: "案内中" });
  await notifyTreasurer(env, lark, {
    title: `${round.name} のビジター受付を始めました`,
    text: `${sent ? `LINE でメンバー ${sent} 人に申込ページを送りました。` : ""}ビジターをお誘いするメンバーに、下の文面を渡してください。${pasteBlock(noticeMessage(round))}`,
  });
  return { sent, line: lineEnabled(env) };
}

async function sendVisitorDayBefore(env, lark, round) {
  const visitors = (await loadVisitors(lark, round.name)).filter((v) => v.status !== "キャンセル");
  const s = visitorSummary(visitors, round.amount);
  await notifyTreasurer(env, lark, {
    title: `明日（${mmdd(round.due)}）のビジター ${s.total} 名`,
    text:
      `入金済 ${s.paid} 名／未入金 ${s.unpaid} 名` +
      (visitors.length ? `\n${visitors.map(visitorLine).join("\n")}` : "\nまだ申込はありません。") +
      (s.unpaid ? "\n未入金の方は、当日受付で参加費をお受け取りください。" : ""),
    buttonText: "受付リストを開く",
    url: `${env.PUBLIC_URL}/admin/`,
  });
  return { visitors: s.total, unpaid: s.unpaid, sent: 0 };
}

async function closeVisitorRound(env, lark, round) {
  const visitors = await loadVisitors(lark, round.name);
  const s = visitorSummary(visitors, round.amount);
  await lark.update("rounds", round.id, { 状態: "締切" });
  const unpaid = visitors.filter((v) => v.status === "未入金");
  await notifyTreasurer(env, lark, {
    title: `${round.name} のビジター参加費を締めました`,
    text:
      `ビジター ${s.total} 名：Peatix ${s.paid} 名／当日現金 ${s.cash} 名／未入金 ${s.unpaid} 名（${yen(s.amount)}）` +
      (unpaid.length ? `\n未入金：${unpaid.map((v) => `${v.name}${v.referrer ? `（紹介：${v.referrer}）` : ""}`).join("、")}` : ""),
    buttonText: "管理画面で確認",
    url: `${env.PUBLIC_URL}/admin/`,
  });
  return { paid: s.paid, cash: s.cash, unpaid: s.unpaid };
}

/** Peatix の CSV からビジターを並べる。販売ID で見分けるので、何回入れても二重にならない */
export async function importVisitors(env, lark, round, csvText) {
  const rows = readPeatixRows(csvText, {
    company: env.VISITOR_COMPANY_LABEL || "会社名",
    category: env.VISITOR_CATEGORY_LABEL || "業種",
    referrer: env.VISITOR_REFERRER_LABEL || "紹介者",
  });
  const existing = new Map((await loadVisitors(lark, round.name)).map((v) => [v.saleId, v]));
  const now = Date.now();
  const added = [];
  let updated = 0;
  for (const row of rows) {
    if (!row.saleId) continue;
    const status = CANCELLED.test(row.status) ? "キャンセル" : PENDING.test(row.status) ? "未入金" : "入金済";
    const v = existing.get(row.saleId);
    if (!v) {
      if (status === "キャンセル") continue;
      const fields = { 集金回: round.name, 名前: row.name, 会社名: row.company, 業種: row.category, 紹介者: row.referrer, 状態: status, 方法: "Peatix", Peatix販売ID: row.saleId, 取込日時: now };
      await lark.create("visitors", [fields]);
      existing.set(row.saleId, { status });
      added.push({ name: row.name, company: row.company, category: row.category, referrer: row.referrer, status });
    } else if (v.status !== status && v.method === "Peatix") {
      await lark.update("visitors", v.id, { 状態: status, 取込日時: now });
      updated++;
    }
  }
  const s = visitorSummary(await loadVisitors(lark, round.name), round.amount);
  await lark.create("imports", [{ 集金回: round.name, 取込日時: now, CSV行数: rows.length, 一致: added.length, 新しく入金済: added.filter((a) => a.status === "入金済").length + updated, 要確認: 0, 要確認の内容: "" }]);
  if (added.length || updated) {
    await notifyTreasurer(env, lark, {
      title: `${round.name}：ビジターの申込を取り込みました`,
      text: `新しい申込 ${added.length} 名${updated ? `／状態の変更 ${updated} 件` : ""}（合計 ${s.total} 名・入金済 ${s.paid} 名）` + (added.length ? `\n${added.map(visitorLine).join("\n")}` : ""),
      buttonText: "受付リストを開く",
      url: `${env.PUBLIC_URL}/admin/`,
    });
  }
  return { kind: "ビジター", rows: rows.length, added: added.length, updated, ...s };
}

/** 当日受付：現金で受け取った・キャンセルになった などを記録する */
export async function markVisitor(lark, { round, id, status }) {
  if (!VISITOR_STATUSES.includes(status)) throw new Error(`状態は ${VISITOR_STATUSES.join("／")} のどれかです`);
  const v = (await loadVisitors(lark, round)).find((x) => x.id === id);
  if (!v) throw new Error("この例会のビジターに該当の行がありません");
  await lark.update("visitors", id, { 状態: status, 方法: status === "当日現金" ? "現金" : v.method || null });
}

/** 当日飛び込みのビジターを足す */
export async function addVisitor(lark, { round, name, company, category, referrer, status = "当日現金" }) {
  if (!String(name || "").trim()) throw new Error("お名前を入れてください");
  if (!VISITOR_STATUSES.includes(status)) throw new Error(`状態は ${VISITOR_STATUSES.join("／")} のどれかです`);
  await lark.create("visitors", [
    { 集金回: round, 名前: name.trim(), 会社名: company || "", 業種: category || "", 紹介者: referrer || "", 状態: status, 方法: status === "当日現金" ? "現金" : null, 取込日時: Date.now() },
  ]);
}
