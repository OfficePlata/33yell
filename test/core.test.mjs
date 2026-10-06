import assert from "node:assert/strict";
import { test } from "node:test";
import { matchPayments, normalizeKey, parseCsv, readPeatixRows } from "../src/csv.js";
import { addVisitor, jstDate, loadVisitors, markDue, markVisitor, myStatus, noticeMessage, planDaily, reconcile, registerLine, runDaily } from "../src/dues.js";

// Peatix の参加者リスト CSV に近い形（申込フォームの質問「メンバー番号」つき）
const PEATIX_CSV =
  "﻿販売ID,ユーザーID,参加者名,アカウント名,注文日時,チケット名,枚数,チケットID,ステータス,割引コード,メンバー番号（4桁）\r\n" +
  "S-1001,u1,鹿児島 太郎,taro,2026/11/01 09:10,11月度 会費,1,T1,支払済,,0001\r\n" +
  "S-1002,u2,宮崎　花子,hana,2026/11/01 10:00,11月度 会費,1,T2,支払済,,０００２\r\n" +
  'S-1003,u3,薩摩 一郎,ichi,2026/11/02 08:00,11月度 会費,1,T3,支払済,,"3"\r\n' +
  "S-1004,u4,霧島 さくら,saku,2026/11/02 09:00,11月度 会費,1,T4,支払済,,\r\n" +
  "S-1005,u5,知らない 人,x,2026/11/02 09:00,11月度 会費,1,T5,支払済,,9999\r\n";

const MEMBERS = [
  { memberNo: "0001", name: "鹿児島 太郎" },
  { memberNo: "0002", name: "宮崎 花子" },
  { memberNo: "0003", name: "薩摩 一郎" },
  { memberNo: "0004", name: "霧島 さくら" },
  { memberNo: "0005", name: "桜島 健" },
];

test("parseCsv：引用符・改行・BOM", () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x,1","he said ""hi"""\n"multi\nline",z\n\n'), [
    ["a", "b"],
    ["x,1", 'he said "hi"'],
    ["multi\nline", "z"],
  ]);
});

test("normalizeKey：全角・空白をそろえる", () => {
  assert.equal(normalizeKey("０００２"), "0002");
  assert.equal(normalizeKey("宮崎　花子"), normalizeKey("宮崎 花子"));
});

test("readPeatixRows：列名からメンバー番号の列を見つける", () => {
  const rows = readPeatixRows(PEATIX_CSV);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[1], { saleId: "S-1002", memberNo: "０００２", name: "宮崎　花子", ticket: "11月度 会費", status: "支払済", company: "", category: "", referrer: "" });
  assert.throws(() => readPeatixRows("名前,金額\nA,1"), /販売ID/);
});

test("matchPayments：番号 → 名前の順で突き合わせ、わからないものは要確認", () => {
  const { matched, unmatched } = matchPayments(readPeatixRows(PEATIX_CSV), MEMBERS);
  assert.deepEqual(
    matched.map((m) => m.memberNo),
    ["0001", "0002", "0003", "0004"] // 0003 は番号違い・0004 は番号なしだが、名前で特定できる
  );
  assert.equal(unmatched.length, 1);
  assert.equal(unmatched.find((u) => u.saleId === "S-1005").reason, "メンバー番号が名簿にありません");
});

test("matchPayments：番号が違っても名前が1人だけ一致すれば拾う／同名2人なら拾わない／重複は要確認", () => {
  const rows = [
    { saleId: "A", memberNo: "3", name: "薩摩 一郎", status: "" },
    { saleId: "B", memberNo: "", name: "山田 花", status: "" },
    { saleId: "C", memberNo: "0001", name: "", status: "" },
    { saleId: "D", memberNo: "0001", name: "", status: "" },
    { saleId: "E", memberNo: "0005", name: "", status: "キャンセル" },
  ];
  const members = [...MEMBERS, { memberNo: "0010", name: "山田 花" }, { memberNo: "0011", name: "山田　花" }];
  const { matched, unmatched } = matchPayments(rows, members);
  assert.deepEqual(
    matched.map((m) => [m.saleId, m.memberNo]),
    [
      ["A", "0003"],
      ["C", "0001"],
    ]
  );
  assert.deepEqual(
    unmatched.map((u) => u.saleId),
    ["B", "D"]
  );
});

test("planDaily：案内日・前日リマインド・締切", () => {
  const rounds = [
    { name: "10月度", status: "案内中", noticeDate: "2026-10-01", due: "2026-10-10", reminded: true },
    { name: "11月度", status: "予定", noticeDate: "2026-11-01", due: "2026-11-10", reminded: false },
  ];
  assert.deepEqual(planDaily(rounds, "2026-10-09"), []);
  assert.deepEqual(planDaily(rounds, "2026-10-11").map((p) => [p.action, p.round.name]), [["close", "10月度"]]);
  assert.deepEqual(planDaily(rounds, "2026-11-01").map((p) => p.action), ["close", "notice"]);
  const open = [{ name: "11月度", status: "案内中", noticeDate: "2026-11-01", due: "2026-11-10", reminded: false }];
  assert.deepEqual(planDaily(open, "2026-11-08"), []);
  assert.deepEqual(planDaily(open, "2026-11-09").map((p) => p.action), ["remind"]);
  assert.deepEqual(planDaily(open, "2026-11-10").map((p) => p.action), ["remind"]);
});

test("jstDate：日本時間の日付", () => {
  assert.equal(jstDate(Date.parse("2026-10-31T15:30:00Z")), "2026-11-01");
});

// ── BASE を置き換えた通し確認 ──

class FakeLark {
  constructor(seed) {
    this.tables = { members: [], rounds: [], dues: [], imports: [], visitors: [], ...structuredClone(seed) };
    this.seq = 0;
    for (const rows of Object.values(this.tables)) for (const r of rows) r.id ??= `rec${++this.seq}`;
    this.cards = [];
  }
  async records(key, conditions = []) {
    return this.tables[key].filter((r) => conditions.every(([f, v]) => String(r[f] ?? "") === String(v))).map((r) => ({ ...r }));
  }
  async create(key, rows) {
    for (const r of rows) this.tables[key].push({ id: `rec${++this.seq}`, ...r });
  }
  async update(key, id, fields) {
    Object.assign(this.tables[key].find((r) => r.id === id), fields);
  }
  async sendCard(_type, _id, card) {
    this.cards.push(card);
  }
}

const SEED = {
  members: MEMBERS.map((m, i) => ({ メンバー番号: m.memberNo, 名前: m.name, 在籍: true, LINEユーザーID: i < 3 ? `U${i}` : "" })),
  rounds: [
    {
      回名: "11月度",
      金額: 3000,
      PeatixURL: { link: "https://peatix.com/event/123", text: "Peatix" },
      案内日: Date.parse("2026-11-01T00:00:00+09:00"),
      締切日: Date.parse("2026-11-10T00:00:00+09:00"),
      状態: "予定",
    },
  ],
};

function withFetch(fn) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response("{}", { status: 200 });
  };
  return fn(calls).finally(() => (globalThis.fetch = original));
}

const ENV = { LINE_CHANNEL_ACCESS_TOKEN: "x", LIFF_ID: "liff-1", LARK_ADMIN_CHAT_ID: "oc_1", PUBLIC_URL: "https://example.test" };

test("通し：案内 → CSV照合（2回入れても二重にならない）→ 前日リマインド → 締切", () =>
  withFetch(async (calls) => {
    const lark = new FakeLark(SEED);

    await runDaily(ENV, lark, "2026-11-01");
    assert.equal(lark.tables.rounds[0]["状態"], "案内中");
    assert.equal(lark.tables.dues.length, 5);
    assert.deepEqual(calls[0].body.to, ["U0", "U1", "U2"]);
    assert.equal(calls[0].body.messages[0].template.actions[0].uri, "https://peatix.com/event/123");
    assert.match(lark.cards[0].text, /LINE 未登録の方：霧島 さくら、桜島 健/);

    const first = await reconcile(ENV, lark, "11月度", PEATIX_CSV);
    assert.equal(first.updated, 4);
    assert.equal(first.unmatched.length, 1);
    const again = await reconcile(ENV, lark, "11月度", PEATIX_CSV);
    assert.equal(again.updated, 0);
    assert.equal(again.already, 4);
    assert.equal(lark.tables.imports.length, 2);

    // 取り消し（未入金に戻す）と、現金での受領
    await markDue(lark, { round: "11月度", memberNo: "0002", status: "未入金" });
    assert.equal(lark.tables.dues.find((d) => d["メンバー番号"] === "0002")["入金確認日時"], null);

    calls.length = 0;
    await runDaily(ENV, lark, "2026-11-09");
    assert.deepEqual(calls[0].body.to, ["U1"]); // 未入金は 0002 と 0005。0005 は LINE 未登録
    await runDaily(ENV, lark, "2026-11-09");
    assert.equal(calls.length, 1, "前日リマインドは1回だけ");

    await runDaily(ENV, lark, "2026-11-11");
    assert.equal(lark.tables.rounds[0]["状態"], "締切");
    assert.match(lark.cards.at(-1).text, /入金済 3 人／未入金 2 人（9,000円 見込み）\n未入金：宮崎 花子、桜島 健/);
  }));

test("LINE 登録：番号と名前が両方合ったときだけ。支払い状況が見られる", async () => {
  const lark = new FakeLark(SEED);
  assert.equal((await registerLine(lark, { lineUserId: "Unew", memberNo: "0004", name: "霧島 花" })).ok, false);
  assert.equal((await registerLine(lark, { lineUserId: "Unew", memberNo: "０００４", name: "霧島　さくら" })).ok, true);
  lark.tables.rounds[0]["状態"] = "案内中";
  const me = await myStatus(lark, "Unew");
  assert.equal(me.name, "霧島 さくら");
  assert.deepEqual(me.items[0], { round: "11月度", amount: 3000, due: "2026-11-10", open: true, peatixUrl: "https://peatix.com/event/123", status: "未入金" });
  assert.deepEqual(await myStatus(lark, "Unknown"), { registered: false });
});

test("LINE なし：LINE には送らず、そのまま貼れる文面が Lark に届く", () =>
  withFetch(async (calls) => {
    const lark = new FakeLark(SEED);
    const env = { LARK_ADMIN_CHAT_ID: "oc_1", PUBLIC_URL: "https://example.test" }; // LINE の設定なし
    await runDaily(env, lark, "2026-11-01");
    assert.equal(calls.length, 0, "LINE には何も送らない");
    assert.equal(lark.tables.dues.length, 5);
    assert.match(lark.cards[0].text, /そのまま貼れる文面\n【11月度 会費のご案内】\n金額：3,000円\n締切：11\/10\nお支払いはこちら（Peatix）：https:\/\/peatix.com\/event\/123/);

    await reconcile(env, lark, "11月度", PEATIX_CSV);
    await runDaily(env, lark, "2026-11-09");
    const remind = lark.cards.find((c) => c.title.includes("締切前日"));
    assert.match(remind.text, /未入金の方：桜島 健/);
    assert.match(remind.text, /【11月度 会費のお願い】/);
    assert.equal(calls.length, 0);
  }));

const VISITOR_CSV =
  "販売ID,参加者名,注文日時,チケット名,ステータス,会社名,業種,ご紹介者のお名前\n" +
  "V-1,桜井 一,2026/11/01,ビジター参加,支払済,桜井工務店,工務店,鹿児島 太郎\n" +
  "V-2,大隅 花,2026/11/02,ビジター参加,未払い,大隅デザイン,デザイン,宮崎 花子\n" +
  "V-3,指宿 健,2026/11/02,ビジター参加,キャンセル,,,\n";

test("ビジター：CSV から受付リスト → 何回入れても二重にならない → 当日現金・飛び込み → 前日一覧 → 締め", () =>
  withFetch(async (calls) => {
    const seed = structuredClone(SEED);
    seed.rounds = [
      { 回名: "11/12 例会", 種別: "ビジター", 金額: 2000, PeatixURL: "https://peatix.com/event/999", 案内日: Date.parse("2026-11-01T00:00:00+09:00"), 締切日: Date.parse("2026-11-12T00:00:00+09:00"), 状態: "予定" },
    ];
    const lark = new FakeLark(seed);
    const env = { LARK_ADMIN_CHAT_ID: "oc_1", PUBLIC_URL: "https://example.test", VISITOR_REFERRER_LABEL: "紹介者" };

    await runDaily(env, lark, "2026-11-01");
    assert.equal(lark.tables.dues.length, 0, "ビジターの回ではメンバーの入金表を作らない");
    assert.match(lark.cards[0].text, /【11\/12 例会 ビジター参加のご案内】\n参加費：2,000円\n例会日：11\/12/);

    const first = await reconcile(env, lark, "11/12 例会", VISITOR_CSV);
    assert.deepEqual([first.added, first.total, first.paid, first.unpaid], [2, 2, 1, 1]);
    const again = await reconcile(env, lark, "11/12 例会", VISITOR_CSV);
    assert.deepEqual([again.added, again.updated], [0, 0]);
    const v = await loadVisitors(lark, "11/12 例会");
    assert.deepEqual(v.map((x) => [x.name, x.company, x.referrer, x.status]), [
      ["桜井 一", "桜井工務店", "鹿児島 太郎", "入金済"],
      ["大隅 花", "大隅デザイン", "宮崎 花子", "未入金"],
    ]);

    // コンビニ払いが済んだ CSV を入れ直すと入金済になる
    const later = await reconcile(env, lark, "11/12 例会", VISITOR_CSV.replace("未払い", "支払済"));
    assert.equal(later.updated, 1);
    await markVisitor(lark, { round: "11/12 例会", id: v[1].id, status: "キャンセル" });
    await addVisitor(lark, { round: "11/12 例会", name: "飛込 太", company: "飛込商店", referrer: "薩摩 一郎" });

    await runDaily(env, lark, "2026-11-11");
    const dayBefore = lark.cards.at(-1);
    assert.equal(dayBefore.title, "明日（11/12）のビジター 2 名");
    assert.match(dayBefore.text, /・桜井 一（桜井工務店／工務店） 紹介：鹿児島 太郎　入金済/);
    assert.doesNotMatch(dayBefore.text, /大隅/);

    await runDaily(env, lark, "2026-11-13");
    assert.equal(lark.tables.rounds[0]["状態"], "締切");
    assert.match(lark.cards.at(-1).text, /ビジター 2 名：Peatix 1 名／当日現金 1 名／未入金 0 名（4,000円）/);
    assert.equal(calls.length, 0);
  }));

test("文面：PeatixURL がないときは未設定と出す", () => {
  assert.match(noticeMessage({ name: "12月度", kind: "会費", amount: 3000, due: "", peatixUrl: "" }), /（URL 未設定）/);
});
