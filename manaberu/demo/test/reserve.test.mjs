// 実行：node --test manaberu/demo/test/
// Lark と LINE への通信は偽物（モック）に差し替えて、受付係の動きだけを確かめる。
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJstDateTime, validateReservation } from "../lib/validate.js";
import { onRequestPost } from "../functions/api/reserve.js";

const env = {
  LARK_APP_ID: "cli_test", LARK_APP_SECRET: "secret", LARK_BASE_TOKEN: "base", LARK_TABLE_ID: "tbl",
  LINE_CHANNEL_ID: "123", LARK_WEBHOOK_URL: "https://example.invalid/hook",
};
const future = "2099-01-01T12:00";

function mockFetch({ lineOk = true, recordCode = 0 } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init?.body });
    if (String(url).includes("tenant_access_token")) return Response.json({ code: 0, tenant_access_token: "t-1" });
    if (String(url).includes("/records")) return Response.json({ code: recordCode, msg: "x", data: { record: { record_id: "rec1" } } });
    if (String(url).includes("api.line.me")) return lineOk ? Response.json({ sub: "U123", name: "山田" }) : new Response("{}", { status: 400 });
    return new Response("ok");
  };
  return calls;
}
const post = (body) => new Request("https://demo/api/reserve", { method: "POST", body: JSON.stringify(body) });

test("datetime-local は日本時間として解釈する", () => {
  assert.equal(parseJstDateTime("2026-10-10T12:00"), Date.UTC(2026, 9, 10, 3, 0));
  assert.equal(parseJstDateTime("2026-10-10 12:00"), null);
});

test("入力チェック", () => {
  assert.equal(validateReservation({ name: "", datetime: future, people: 2 }).ok, false);
  assert.equal(validateReservation({ name: "山田", datetime: "2000-01-01T12:00", people: 2 }).ok, false);
  assert.equal(validateReservation({ name: "山田", datetime: future, people: 21 }).ok, false);
  assert.equal(validateReservation({ name: "山田", datetime: future, people: 2 }).ok, true);
});

test("フォームからの予約を BASE に保存し、通知する", async () => {
  const calls = mockFetch();
  const res = await onRequestPost({ request: post({ name: "山田", datetime: future, people: 2, note: "" }), env });
  assert.equal(res.status, 200);
  const fields = JSON.parse(calls.find((c) => c.url.includes("/records")).body).fields;
  assert.equal(fields["受付経路"], "フォーム");
  assert.equal(fields["LINEユーザーID"], undefined);
  assert.ok(calls.some((c) => c.url === env.LARK_WEBHOOK_URL));
});

test("LINE の ID トークンが本物なら、LINEユーザーIDを保存する", async () => {
  const calls = mockFetch();
  const res = await onRequestPost({ request: post({ name: "山田", datetime: future, people: 2, idToken: "tok" }), env });
  assert.equal(res.status, 200);
  const fields = JSON.parse(calls.find((c) => c.url.includes("/records")).body).fields;
  assert.equal(fields["受付経路"], "LINE");
  assert.equal(fields["LINEユーザーID"], "U123");
});

test("ID トークンが偽物なら保存しない", async () => {
  const calls = mockFetch({ lineOk: false });
  const res = await onRequestPost({ request: post({ name: "山田", datetime: future, people: 2, idToken: "fake" }), env });
  assert.equal(res.status, 401);
  assert.ok(!calls.some((c) => c.url.includes("/records")));
});

test("Lark がエラーを返したら、詳細を見せずに失敗を返す", async () => {
  mockFetch({ recordCode: 91403 });
  const orig = console.error; console.error = () => {};
  const res = await onRequestPost({ request: post({ name: "山田", datetime: future, people: 2 }), env });
  console.error = orig;
  assert.equal(res.status, 502);
  assert.doesNotMatch(JSON.stringify(await res.json()), /91403/);
});
