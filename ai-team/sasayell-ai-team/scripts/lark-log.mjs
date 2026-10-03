#!/usr/bin/env node
/**
 * AI社員の成果物を Lark BASE「ささエール AI社員ログ」に保存する。
 *
 * 接続方法（自動で選ぶ）:
 *   - LARK_APP_ID と LARK_APP_SECRET があれば、アプリ（ボット）として API を直接呼ぶ（クラウド／スマホ向け）
 *   - なければ lark-cli の user token を使う（PC向け。笹原さんがオーナーになる）
 *
 * 使い方:
 *   node lark-log.mjs check                 … 接続先と保存先を確認
 *   node lark-log.mjs setup                 … BASE と「業務ログ」テーブルを作る（PC・lark-cli で1回だけ）
 *   node lark-log.mjs add <record.json>     … 1件保存（--dry-run で送信せず内容だけ表示）
 *
 * 保存先の指定（どちらか）:
 *   - 環境変数 LARK_AI_LOG_BASE（app_token）と LARK_AI_LOG_TABLE（table_id）
 *   - setup が書き出す ~/.sasayell-ai-team/lark.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const STATE_DIR = join(homedir(), ".sasayell-ai-team");
const STATE_FILE = join(STATE_DIR, "lark.json");
const DOMAIN = process.env.LARK_DOMAIN || "open.larksuite.com";
const APP_MODE = Boolean(process.env.LARK_APP_ID && process.env.LARK_APP_SECRET);

const EMPLOYEES = [
  "EA 秘書", "CFO 財務・見積", "COO 事業統括", "集客・営業統括", "マーケター", "提案営業",
  "市場リサーチャー", "パートナー担当", "伴走デリバリー統括", "業務アナリスト", "Larkアーキテクト",
  "AI活用コーチ", "LINE導線デザイナー", "システム開発エンジニア", "研修・マニュアル担当",
  "顧客成功統括", "顧客担当", "ナレッジ管理", "マカセル講師アシスタント",
];
const KINDS = ["議事録", "提案書", "見積", "レポート", "調査", "配信文", "設計書", "マニュアル", "返信案", "計画", "その他"];

const TABLE_NAME = "業務ログ";
const FIELDS = [
  { name: "タイトル", type: "text" },
  { name: "AI社員", type: "select", options: EMPLOYEES.map((name) => ({ name })) },
  { name: "種別", type: "select", options: KINDS.map((name) => ({ name })) },
  { name: "顧客・案件", type: "text" },
  { name: "依頼内容", type: "text" },
  { name: "成果物", type: "text" },
  { name: "要判断", type: "checkbox" },
  { name: "判断事項", type: "text" },
  { name: "ステータス", type: "select", options: [{ name: "下書き" }, { name: "確認待ち" }, { name: "確定" }] },
  { name: "記録元", type: "select", options: [{ name: "PC" }, { name: "スマホ" }] },
  { name: "作成日", type: "created_at" },
];

// ── API 呼び出し ──
let tenantToken = null;
async function getTenantToken() {
  if (tenantToken) return tenantToken;
  const res = await fetch(`https://${DOMAIN}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: process.env.LARK_APP_ID, app_secret: process.env.LARK_APP_SECRET }),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`トークン取得に失敗: ${json.msg}`);
  tenantToken = json.tenant_access_token;
  return tenantToken;
}

async function api(method, path, data = null) {
  if (APP_MODE) {
    const res = await fetch(`https://${DOMAIN}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await getTenantToken()}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: data === null ? undefined : JSON.stringify(data),
    });
    const json = await res.json();
    if (json.code !== 0) throw new Error(`${method} ${path} → ${json.code} ${json.msg}`);
    return json.data;
  }
  const args = ["api", method, path, "--as", "user", "--format", "json"];
  if (data !== null) args.push("--data", JSON.stringify(data));
  const out = execFileSync("lark-cli", args, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
  const parsed = JSON.parse(out);
  if (parsed.ok === false || (parsed.code !== undefined && parsed.code !== 0)) {
    throw new Error(`${method} ${path} → ${JSON.stringify(parsed.error || parsed)}`);
  }
  return parsed.data;
}

// ── 保存先 ──
function loadTarget() {
  const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf-8")) : {};
  return {
    base: process.env.LARK_AI_LOG_BASE || state.app_token,
    table: process.env.LARK_AI_LOG_TABLE || state.table_id,
    url: process.env.LARK_AI_LOG_URL || state.url || "",
  };
}

async function setup() {
  if (APP_MODE) {
    throw new Error(
      "setup は PC の lark-cli（笹原さんの user token）で実行してください。アプリで作ると笹原さんから見えない BASE になります。"
    );
  }
  let state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf-8")) : {};
  if (!state.app_token) {
    const data = await api("POST", "/open-apis/bitable/v1/apps", { name: "ささエール AI社員ログ" });
    state = { app_token: data.app.app_token, url: data.app.url, created_at: new Date().toISOString() };
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`✓ BASE を作成: ${state.url}`);
  } else {
    console.log(`- 既存の BASE を使用: ${state.url}`);
  }
  if (!state.table_id) {
    const res = await api("POST", `/open-apis/base/v3/bases/${state.app_token}/tables`, { name: TABLE_NAME });
    state.table_id = res.table_id || res.id || res.table?.id;
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`✓ テーブル「${TABLE_NAME}」: ${state.table_id}`);
  }
  const existing = new Set(
    ((await api("GET", `/open-apis/base/v3/bases/${state.app_token}/tables/${state.table_id}/fields`)).fields || []).map(
      (f) => f.name
    )
  );
  for (const f of FIELDS) {
    if (existing.has(f.name)) continue;
    const body = { name: f.name, type: f.type };
    if (f.options) body.options = f.options;
    try {
      await api("POST", `/open-apis/base/v3/bases/${state.app_token}/tables/${state.table_id}/fields`, body);
      console.log(`  + ${f.name}`);
    } catch (e) {
      console.error(`  ✗ ${f.name}: ${e.message.split("\n")[0]}`);
    }
  }
  console.log(`\n✅ 準備完了\nBASE: ${state.url}\napp_token: ${state.app_token}\ntable_id: ${state.table_id}\n設定ファイル: ${STATE_FILE}`);
}

function buildFields(rec) {
  const fields = {};
  for (const key of ["タイトル", "AI社員", "種別", "顧客・案件", "依頼内容", "成果物", "判断事項", "ステータス", "記録元"]) {
    if (rec[key] !== undefined && rec[key] !== null && rec[key] !== "") fields[key] = String(rec[key]);
  }
  if (rec["要判断"] !== undefined) fields["要判断"] = Boolean(rec["要判断"]);
  if (!fields["タイトル"]) throw new Error("「タイトル」は必須です");
  if (fields["AI社員"] && !EMPLOYEES.includes(fields["AI社員"])) throw new Error(`AI社員名が名簿にありません: ${fields["AI社員"]}`);
  if (fields["種別"] && !KINDS.includes(fields["種別"])) fields["種別"] = "その他";
  fields["ステータス"] ||= fields["要判断"] ? "確認待ち" : "下書き";
  fields["記録元"] ||= APP_MODE ? "スマホ" : "PC";
  return fields;
}

async function add(file, dryRun) {
  const fields = buildFields(JSON.parse(readFileSync(file, "utf-8")));
  const { base, table, url } = loadTarget();
  if (dryRun) {
    console.log(JSON.stringify({ base, table, fields }, null, 2));
    return;
  }
  if (!base || !table) throw new Error("保存先がありません。PC で `setup` を実行するか、LARK_AI_LOG_BASE / LARK_AI_LOG_TABLE を設定してください。");
  const data = await api("POST", `/open-apis/bitable/v1/apps/${base}/tables/${table}/records`, { fields });
  console.log(`✓ Lark に保存しました（record_id: ${data.record?.record_id ?? "?"}）${url ? `\n${url}` : ""}`);
}

async function check() {
  const { base, table, url } = loadTarget();
  console.log(`接続方法: ${APP_MODE ? "アプリ（LARK_APP_ID）" : "lark-cli（user token）"}`);
  console.log(`保存先: ${base && table ? `${base} / ${table}` : "未設定"}${url ? `\n${url}` : ""}`);
  if (!APP_MODE) {
    try {
      execFileSync("lark-cli", ["--version"], { stdio: "ignore" });
    } catch {
      console.log("lark-cli が見つかりません");
      process.exitCode = 1;
      return;
    }
  }
  if (base && table) {
    const res = await api("GET", `/open-apis/bitable/v1/apps/${base}/tables/${table}/fields?page_size=100`);
    console.log(`✓ 接続OK（フィールド ${res.items?.length ?? "?"} 個）`);
  }
}

const [cmd, arg] = process.argv.slice(2);
const dryRun = process.argv.includes("--dry-run");
try {
  if (cmd === "setup") await setup();
  else if (cmd === "add" && arg) await add(arg, dryRun);
  else if (cmd === "check") await check();
  else {
    console.log("使い方: node lark-log.mjs check | setup | add <record.json> [--dry-run]");
    process.exitCode = 1;
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exitCode = 1;
}
