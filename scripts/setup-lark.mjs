#!/usr/bin/env node
/**
 * あつめールの Lark BASE を作る。
 *
 *   node scripts/setup-lark.mjs --name "BNI ○○チャプター 会費" --owner treasurer@example.com [--members members.csv] [--demo]
 *   node scripts/setup-lark.mjs --upgrade <app_token>   # 前の版で作った BASE に、足りないテーブル・列を足す
 *
 * - BASE と 5 つのテーブル（メンバー／集金回／入金／照合ログ／ビジター）を作る
 * - --members に「メンバー番号,名前」の CSV を渡すと名簿を入れる
 * - --demo を付けると、架空のメンバー5人と集金回1件を入れる（動作確認用）
 * - 最後にオーナーを --owner のメールアドレスへ移す（アプリはフルアクセスで残る）
 * 必要な環境変数：LARK_APP_ID, LARK_APP_SECRET（LARK_DOMAIN は任意）
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { parseCsv } from "../src/csv.js";

const { values: args } = parseArgs({
  options: {
    name: { type: "string", default: "あつめール（会費）" },
    owner: { type: "string" },
    upgrade: { type: "string" },
    members: { type: "string" },
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
const url = (name) => ({ field_name: name, type: 15 });

const SCHEMA = [
  ["メンバー", [text("メンバー番号"), text("名前"), text("カテゴリー"), check("在籍"), text("LINEユーザーID"), date("LINE登録日時", true), text("メモ")]],
  ["集金回", [text("回名"), select("種別", ["会費", "ビジター"]), num("金額"), url("PeatixURL"), date("案内日"), date("締切日"), select("状態", ["予定", "案内中", "締切"]), check("前日リマインド済"), text("メモ")]],
  [
    "入金",
    [text("集金回"), text("メンバー番号"), text("名前"), select("状態", ["未入金", "入金済", "免除"]), select("方法", ["Peatix", "現金", "振込", "その他"]), text("Peatix販売ID"), date("入金確認日時", true), num("リマインド回数"), text("メモ")],
  ],
  ["照合ログ", [text("集金回"), date("取込日時", true), num("CSV行数"), num("一致"), num("新しく入金済"), num("要確認"), text("要確認の内容")]],
  [
    "ビジター",
    [text("名前"), text("集金回"), text("会社名"), text("業種"), text("紹介者"), select("状態", ["入金済", "未入金", "当日現金", "キャンセル"]), select("方法", ["Peatix", "現金"]), text("Peatix販売ID"), date("取込日時", true), text("メモ")],
  ],
];

async function addRecords(app, table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    await api("POST", `/open-apis/bitable/v1/apps/${app}/tables/${table}/records/batch_create`, { records: rows.slice(i, i + 500).map((fields) => ({ fields })) });
  }
}

const DAY = 24 * 60 * 60 * 1000;

function demoData() {
  const members = [
    ["0001", "鹿児島 太郎"],
    ["0002", "宮崎 花子"],
    ["0003", "薩摩 一郎"],
    ["0004", "霧島 さくら"],
    ["0005", "桜島 健"],
  ].map(([no, name]) => ({ メンバー番号: no, 名前: name, 在籍: true }));
  const today = Date.parse(`${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)}T00:00:00+09:00`);
  const rounds = [
    { 回名: "デモ月度", 種別: "会費", 金額: 3000, 案内日: today + DAY, 締切日: today + 10 * DAY, 状態: "予定", メモ: "動作確認用。Peatix のイベント URL を入れてください" },
    { 回名: "デモ例会", 種別: "ビジター", 金額: 2000, 案内日: today + DAY, 締切日: today + 7 * DAY, 状態: "予定", メモ: "締切日＝例会日。ビジター用の Peatix イベント URL を入れてください" },
  ];
  return { members, rounds };
}

/** 前の版の BASE に、足りないテーブルと列だけを足す（既存のデータには触らない） */
async function upgrade(appToken) {
  const { items } = await api("GET", `/open-apis/bitable/v1/apps/${appToken}/tables?page_size=100`);
  const tables = Object.fromEntries(items.map((t) => [t.name, t.table_id]));
  for (const [name, fields] of SCHEMA) {
    if (!tables[name]) {
      await api("POST", `/open-apis/bitable/v1/apps/${appToken}/tables`, { table: { name, default_view_name: "すべて", fields } });
      console.log(`  テーブル「${name}」を足しました`);
      continue;
    }
    const data = await api("GET", `/open-apis/bitable/v1/apps/${appToken}/tables/${tables[name]}/fields?page_size=100`);
    const have = new Set(data.items.map((f) => f.field_name));
    for (const f of fields) {
      if (have.has(f.field_name)) continue;
      await api("POST", `/open-apis/bitable/v1/apps/${appToken}/tables/${tables[name]}/fields`, f);
      console.log(`  「${name}」に列「${f.field_name}」を足しました`);
    }
  }
  console.log("更新しました（種別が空の集金回は「会費」として扱います）");
}

async function main() {
  if (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET) throw new Error("LARK_APP_ID / LARK_APP_SECRET を設定してください");
  if (args.upgrade) return upgrade(args.upgrade);
  if (!args.owner) throw new Error("--owner（オーナーにする人のメールアドレス）を指定してください");

  const { app } = await api("POST", "/open-apis/bitable/v1/apps", { name: args.name, time_zone: "Asia/Tokyo" });
  const appToken = app.app_token;
  console.log(`BASE を作成しました: ${app.url}`);

  // 作った直後にオーナーを移す（アプリはフルアクセスで残る）
  await api(
    "POST",
    `/open-apis/drive/v1/permissions/${appToken}/members/transfer_owner?type=bitable&remove_old_owner=false&old_owner_perm=full_access`,
    { member_type: "email", member_id: args.owner }
  );
  console.log(`オーナーを ${args.owner} に移しました（アプリはフルアクセスで残ります）`);

  const tableIds = {};
  for (const [name, fields] of SCHEMA) {
    const data = await api("POST", `/open-apis/bitable/v1/apps/${appToken}/tables`, { table: { name, default_view_name: "すべて", fields } });
    tableIds[name] = data.table_id;
    console.log(`  テーブル「${name}」`);
  }
  // 最初から入っている空のテーブルを消す
  const { items } = await api("GET", `/open-apis/bitable/v1/apps/${appToken}/tables?page_size=100`);
  for (const t of items) if (!tableIds[t.name]) await api("DELETE", `/open-apis/bitable/v1/apps/${appToken}/tables/${t.table_id}`);

  if (args.members) {
    const [header, ...rows] = parseCsv(await readFile(args.members, "utf8"));
    const noCol = header.findIndex((h) => h.includes("番号"));
    const nameCol = header.findIndex((h) => h.includes("名"));
    if (noCol < 0 || nameCol < 0) throw new Error("名簿 CSV の1行目に「メンバー番号」「名前」の列を入れてください");
    const members = rows.map((r) => ({ メンバー番号: r[noCol].trim(), 名前: r[nameCol].trim(), 在籍: true })).filter((m) => m.メンバー番号);
    await addRecords(appToken, tableIds["メンバー"], members);
    console.log(`  名簿：${members.length} 人`);
  }
  if (args.demo) {
    const demo = demoData();
    await addRecords(appToken, tableIds["メンバー"], demo.members);
    await addRecords(appToken, tableIds["集金回"], demo.rounds);
    console.log(`  デモデータ：メンバー ${demo.members.length} 人・集金回 ${demo.rounds.length} 件（会費・ビジター）`);
  }

  console.log(`\nwrangler.toml の LARK_BASE_TOKEN に設定: ${appToken}`);
  console.log(`BASE: ${app.url}`);
}

main().catch((e) => {
  console.error(`失敗しました: ${e.message}`);
  process.exit(1);
});
