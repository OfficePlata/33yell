import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, toScore, withDiff } from "../src/aggregate.js";
import { respondentKey, signToken, verifyToken } from "../src/token.js";
import { normalize } from "../src/lark.js";
import { jstDate } from "../src/survey.js";
import { makeDemo } from "../scripts/demo-data.mjs";
import { QUESTIONS } from "../scripts/questions.mjs";

test("5段階を0〜100点に直す", () => {
  assert.equal(toScore(1), 0);
  assert.equal(toScore(5), 100);
  assert.equal(toScore(3), 50);
  assert.equal(toScore(null), null);
});

test("署名リンクは改ざんすると通らない", async () => {
  const t = await signToken("secret", { r: "2026-10", u: "ou_123" });
  assert.deepEqual(await verifyToken("secret", t), { r: "2026-10", u: "ou_123" });
  assert.equal(await verifyToken("other", t), null);
  const [body, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ r: "2026-10", u: "ou_999" })).toString("base64url");
  assert.equal(await verifyToken("secret", `${forged}.${sig}`), null);
  assert.equal(await verifyToken("secret", body), null);
});

test("回答者キーは回ごとに変わり、同じ回なら同じ", async () => {
  const a = await respondentKey("salt", "2026-10", "Lark", "ou_1");
  assert.equal(a, await respondentKey("salt", "2026-10", "Lark", "ou_1"));
  assert.notEqual(a, await respondentKey("salt", "2026-11", "Lark", "ou_1"));
  assert.notEqual(a, await respondentKey("salt", "2026-10", "LINE", "ou_1"));
});

test("5人未満の部署は数字を出さない", () => {
  const qs = [{ id: "Q1", text: "q", category: "A", type: "5段階" }];
  const rows = [];
  for (let i = 0; i < 5; i++) rows.push({ key: `a${i}`, department: "大", questionId: "Q1", category: "A", score: 5, comment: "" });
  for (let i = 0; i < 4; i++) rows.push({ key: `b${i}`, department: "小", questionId: "Q1", category: "A", score: 1, comment: i === 0 ? "コメント" : "" });
  const r = aggregate(rows, qs);
  assert.equal(r.respondents, 9);
  const big = r.byDepartment.find((d) => d.name === "大");
  const small = r.byDepartment.find((d) => d.name === "小");
  assert.equal(big.overall, 100);
  assert.deepEqual(small, { name: "小", hidden: true });
  assert.deepEqual(r.comments, ["コメント"]);
});

test("前回との差", () => {
  const cur = { overall: 60, byCategory: [{ name: "A", score: 60 }] };
  const prev = { overall: 55.5, byCategory: [{ name: "A", score: 70 }] };
  const r = withDiff(cur, prev);
  assert.equal(r.overallDiff, 4.5);
  assert.equal(r.byCategory[0].diff, -10);
});

test("Lark のテキスト配列をそろえる", () => {
  assert.deepEqual(normalize({ a: [{ type: "text", text: "こん" }, { type: "text", text: "にちは" }], b: 3 }), { a: "こんにちは", b: 3 });
});

test("JST の日付", () => {
  assert.equal(jstDate(Date.parse("2026-10-05T15:30:00Z")), "2026-10-06");
});

test("デモデータの筋書き：ツール定着が伸び、製造部の業務負荷が低い", () => {
  const demo = makeDemo();
  const rows = (round) =>
    demo.answers.filter((a) => a.サーベイ回 === round).map((a) => ({ key: a.回答者キー, department: a.部署, questionId: a.設問ID, category: a.カテゴリ, score: a.点数 ?? null, comment: a.自由記述 || "" }));
  const aug = aggregate(rows("2026-08"), QUESTIONS);
  const sep = aggregate(rows("2026-09"), QUESTIONS);
  const cat = (r, n) => r.byCategory.find((c) => c.name === n).score;
  assert.ok(cat(sep, "ツール定着") > cat(aug, "ツール定着"));
  assert.ok(cat(sep, "心理的安全性") > cat(aug, "心理的安全性"));
  const dept = (r, n) => r.byDepartment.find((d) => d.name === n);
  const mfgLoad = dept(sep, "製造部").categories.find((c) => c.name === "業務負荷").score;
  const salesLoad = dept(sep, "営業部").categories.find((c) => c.name === "業務負荷").score;
  assert.ok(mfgLoad < salesLoad);
  assert.equal(aug.respondents, 26);
  console.log("demo 2026-08", aug.overall, aug.byCategory.map((c) => `${c.name}:${c.score}`).join(" "));
  console.log("demo 2026-09", sep.overall, sep.byCategory.map((c) => `${c.name}:${c.score}`).join(" "));
});
