#!/usr/bin/env node
/**
 * しらベールの Lark BASE を作る。
 *
 *   node scripts/setup-lark.mjs --name "しらベール（T社）" --owner someone@example.com [--departments 営業部,製造部] [--demo]
 *
 * - BASE と 6 つのテーブルを作り、標準の設問セットを入れる
 * - --demo を付けると、架空の部署・3ヶ月分の回答（デモ用）を入れる
 * - 最後にオーナーを --owner のメールアドレスへ移す（アプリはフルアクセスで残る）
 * 必要な環境変数：LARK_APP_ID, LARK_APP_SECRET（LARK_DOMAIN は任意）
 */
import { parseArgs } from "node:util";
import { QUESTIONS, CATEGORIES } from "./questions.mjs";
import { makeDemo } from "./demo-data.mjs";

const { values: args } = parseArgs({
  options: {
    name: { type: "string", default: "しらベール" },
    owner: { type: "string" },
    departments: { type: "string", default: "" },
    demo: { type: "boolean", default: false },
  },
});

const DOMAIN = process.env.LARK_DOMAIN || "open.larksuite.com";
let token;

async function api(method, path, body) {
  if (!token) {
    const r = await fetch(`https://${DOMAIN}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ app_id: process.env.LARK_APP_ID, app_secret: process.env.LARK_APP_SECRET }),
    }).then((r) => r.json());
    if (r.code !== 0) throw new Error(`token: ${r.msg}`);
    token = r.tenant_access_token;
  }
  const res = await fetch(`https://${DOMAIN}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`${method} ${path} → ${json.code} ${json.msg}`);
  return json.data;
}

const text = (name) => ({ field_name: name, type: 1 });
const num = (name, formatter = "0") => ({ field_name: name, type: 2, property: { formatter } });
const select = (name, options) => ({ field_name: name, type: 3, property: { options: options.map((o) => ({ name: o })) } });
const date = (name, withTime = false) => ({ field_name: name, type: 5, property: { date_formatter: withTime ? "yyyy/MM/dd HH:mm" : "yyyy/MM/dd", auto_fill: false } });
const check = (name) => ({ field_name: name, type: 7 });

const SCHEMA = [
  ["設問マスタ", [text("設問ID"), text("設問文"), select("カテゴリ", CATEGORIES), select("形式", ["5段階", "自由記述"]), num("並び順"), check("有効")]],
  ["サーベイ回", [text("回名"), date("開始日"), date("締切日"), select("状態", ["予定", "実施中", "締切", "集計済"]), num("対象人数"), check("配信済"), text("メモ")]],
  ["回答", [text("回答者キー"), text("サーベイ回"), text("部署"), select("経路", ["Lark", "LINE", "デモ"]), text("設問ID"), select("カテゴリ", CATEGORIES), num("点数"), text("自由記述"), date("回答日時", true)]],
  ["月次レポート", [text("回名"), num("回答数"), num("回答率", "0.0"), num("総合スコア", "0.0"), num("前回差", "0.0"), text("カテゴリ別スコア"), text("AI要約"), text("改善アクション案"), text("AI結果JSON"), date("作成日時", true)]],
  ["改善アクション", [text("アクション"), text("回名"), select("カテゴリ", CATEGORIES), text("担当"), date("期限"), select("状態", ["未着手", "対応中", "完了"]), text("メモ")]],
  ["部署マスタ", [text("部署名"), num("並び順")]],
];

async function addRecords(app, table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    await api("POST", `/open-apis/bitable/v1/apps/${app}/tables/${table}/records/batch_create`, { records: rows.slice(i, i + 500).map((fields) => ({ fields })) });
  }
}

async function main() {
  if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) throw new Error("LARK_APP_ID / LARK_APP_SECRET を設定してください");
  if (!args.owner) throw new Error("--owner（オーナーにする人のメールアドレス）を指定してください");

  const { app } = await api("POST", "/open-apis/bitable/v1/apps", { name: args.name, time_zone: "Asia/Tokyo" });
  const appToken = app.app_token;
  console.log(`BASE を作成しました: ${app.url}`);

  const tableIds = {};
  for (const [name, fields] of SCHEMA) {
    const data = await api("POST", `/open-apis/bitable/v1/apps/${appToken}/tables`, { table: { name, default_view_name: "すべて", fields } });
    tableIds[name] = data.table_id;
    console.log(`  テーブル「${name}」`);
  }
  // 最初から入っている空のテーブルを消す
  const { items } = await api("GET", `/open-apis/bitable/v1/apps/${appToken}/tables?page_size=100`);
  for (const t of items) if (!tableIds[t.name]) await api("DELETE", `/open-apis/bitable/v1/apps/${appToken}/tables/${t.table_id}`);

  await addRecords(appToken, tableIds["設問マスタ"], QUESTIONS.map((q) => ({ 設問ID: q.id, 設問文: q.text, カテゴリ: q.category, 形式: q.type, 並び順: q.order, 有効: true })));

  let departments = args.departments.split(",").map((s) => s.trim()).filter(Boolean);
  if (args.demo) {
    const demo = makeDemo();
    departments = demo.departments;
    await addRecords(appToken, tableIds["サーベイ回"], demo.rounds);
    await addRecords(appToken, tableIds["回答"], demo.answers);
    await addRecords(appToken, tableIds["月次レポート"], demo.reports);
    await addRecords(appToken, tableIds["改善アクション"], demo.actions);
    console.log(`  デモデータ：回 ${demo.rounds.length}・回答行 ${demo.answers.length}`);
  }
  if (departments.length) await addRecords(appToken, tableIds["部署マスタ"], departments.map((d, i) => ({ 部署名: d, 並び順: i + 1 })));

  await api(
    "POST",
    `/open-apis/drive/v1/permissions/${appToken}/members/transfer_owner?type=bitable&remove_old_owner=false&old_owner_perm=full_access`,
    { member_type: "email", member_id: args.owner }
  );
  console.log(`オーナーを ${args.owner} に移しました（アプリはフルアクセスで残ります）`);
  console.log(`\nwrangler.toml の LARK_BASE_TOKEN に設定: ${appToken}`);
  console.log(`BASE: ${app.url}`);
}

main().catch((e) => {
  console.error(`失敗しました: ${e.message}`);
  process.exit(1);
});
