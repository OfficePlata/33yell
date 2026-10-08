// 講師台本の時間チェック：話す量（1分あたり250字＝講義向けのゆっくりめ）＋デモ・対話＋手を動かす時間が、予定の分数に収まるかを確かめる
// 使い方：node talk-check.js 01 > ../../lessons/01-talk-script.md
const no = process.argv[2] || "01";
const talk = require(`./talk-${no}.js`);
const RATE = 250;
const speak = (t) => t.replace(/（[^）]*）/g, "").length / RATE;

const rows = talk.map((t) => {
  const s = speak(t.talk), need = s + (t.act || 0) + t.work;
  return { ...t, speak: s, need, ok: need <= t.minutes + 0.5 };
});
const blocks = {};
for (const r of rows) {
  blocks[r.block] ??= { plan: 0, need: 0 };
  blocks[r.block].plan += r.minutes;
  blocks[r.block].need += r.need;
}
const f = (n) => n.toFixed(1);
let md = `# 第${Number(no)}回 講師台本（模擬講義）\n\n`;
md += `話す速さを1分あたり${RATE}字として、話す時間＋デモ・対話＋受講者が手を動かす時間が予定に収まるかを確かめています。（ ）内は講師の動きで、話す時間には数えていません。\n\n`;
md += `## 時間チェック\n\n| 区切り | 予定 | 見込み | 判定 |\n|---|---|---|---|\n`;
let plan = 0, need = 0;
for (const [b, v] of Object.entries(blocks)) {
  md += `| ${b} | ${v.plan}分 | ${f(v.need)}分 | ${v.need <= v.plan + 0.5 ? "○" : "△ 超過"} |\n`;
  plan += v.plan; need += v.need;
}
md += `| **合計** | **${plan}分** | **${f(need)}分** | ${need <= plan ? "○" : "△"} |\n\n`;
md += `## 台本\n\n`;
for (const r of rows) {
  md += `### ${r.slide}（予定${r.minutes}分：話す${f(r.speak)}分＋デモ・対話${r.act || 0}分＋作業${r.work}分）\n\n${r.talk}\n\n`;
}
process.stdout.write(md);
