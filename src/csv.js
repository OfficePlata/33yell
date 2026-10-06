// Peatix の参加者リスト CSV を読み、メンバーとの突き合わせをする（外部に通信しない純粋な処理）。

/** RFC 4180 の CSV を2次元配列にする（"" のエスケープ・セル内改行に対応） */
export function parseCsv(text) {
  const src = String(text).replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

/** 全角英数を半角にし、空白・記号を外して比べやすくする */
export function normalizeKey(value) {
  return String(value ?? "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s　\-ー－・.]/g, "")
    .toLowerCase();
}

// Peatix の CSV の列名（日本語・英語のどちらの画面から出しても読めるように候補を並べる）
const COLUMNS = {
  saleId: ["販売ID", "Sales ID", "注文ID", "Order ID"],
  name: ["参加者名", "Attendee name", "Attendee", "氏名", "お名前"],
  ticket: ["チケット名", "Ticket name", "Ticket"],
  status: ["ステータス", "Status"],
  orderedAt: ["注文日時", "Order date", "購入日時"],
};

function findColumn(headers, candidates) {
  const hs = headers.map((h) => normalizeKey(h));
  for (const c of candidates) {
    const i = hs.findIndex((h) => h.includes(normalizeKey(c)));
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * CSV の行を { saleId, memberNo, name, ticket, status, company, category, referrer } の配列にする。
 * labels：申込フォームの質問の見出し（文字列ならメンバー番号の見出しだけ）
 */
export function readPeatixRows(text, labels = "メンバー番号") {
  const l = typeof labels === "string" ? { memberNo: labels } : labels;
  const [headers = [], ...body] = parseCsv(text);
  const col = Object.fromEntries(Object.entries(COLUMNS).map(([k, c]) => [k, findColumn(headers, c)]));
  for (const k of ["memberNo", "company", "category", "referrer"]) col[k] = l[k] ? findColumn(headers, [l[k]]) : -1;
  if (col.saleId < 0) throw new Error("CSV に「販売ID」の列が見つかりません。Peatix の「参加者リスト CSV」を選んでください");
  if (col.memberNo < 0 && col.name < 0) throw new Error(`CSV に「${l.memberNo || "メンバー番号"}」の列も「参加者名」の列もありません`);
  const at = (r, i) => (i >= 0 ? String(r[i] ?? "").trim() : "");
  return body.map((r) => ({
    saleId: at(r, col.saleId),
    memberNo: at(r, col.memberNo),
    name: at(r, col.name),
    ticket: at(r, col.ticket),
    status: at(r, col.status),
    company: at(r, col.company),
    category: at(r, col.category),
    referrer: at(r, col.referrer),
  }));
}

export const CANCELLED = /キャンセル|払い戻し|返金|cancel|refund/i;
// コンビニ・銀行振込で、申し込んだがまだ払っていない状態
export const PENDING = /未払|未入金|支払い待ち|入金待ち|unpaid|pending|awaiting/i;

/**
 * CSV の行とメンバー名簿を突き合わせる。
 * 1. 申込フォームのメンバー番号で一致
 * 2. 番号がない・違うときは、名前（空白を除く）が1人だけ一致すればその人
 * members: [{ memberNo, name }]
 */
export function matchPayments(rows, members) {
  const byNo = new Map(members.map((m) => [normalizeKey(m.memberNo), m]));
  const byName = new Map();
  for (const m of members) {
    const k = normalizeKey(m.name);
    byName.set(k, byName.has(k) ? null : m); // 同名が2人いたら名前では決めない
  }
  const matched = [];
  const unmatched = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row.saleId) continue;
    if (CANCELLED.test(row.status) || PENDING.test(row.status)) continue;
    const member = byNo.get(normalizeKey(row.memberNo)) || (row.name ? byName.get(normalizeKey(row.name)) : null);
    if (!member) {
      unmatched.push({ ...row, reason: row.memberNo ? "メンバー番号が名簿にありません" : "メンバー番号が未入力で、名前でも特定できません" });
      continue;
    }
    if (seen.has(member.memberNo)) {
      unmatched.push({ ...row, reason: `${member.name}さんの2件目の申込です（重複の可能性）` });
      continue;
    }
    seen.add(member.memberNo);
    matched.push({ memberNo: member.memberNo, name: member.name, saleId: row.saleId });
  }
  return { matched, unmatched };
}
