// 営業デモ用の架空データ（31人の会社・3ヶ月分）。実在の会社・人物とは関係ありません。
import { QUESTIONS } from "./questions.mjs";

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEPTS = [["営業部", 8], ["製造部", 10], ["店舗スタッフ", 9], ["総務部", 4]];

const ROUNDS = [
  { name: "2026-08", start: "2026-08-03", due: "2026-08-12", status: "集計済", answered: 26 },
  { name: "2026-09", start: "2026-09-01", due: "2026-09-10", status: "集計済", answered: 27 },
  { name: "2026-10", start: "2026-10-01", due: "2026-10-12", status: "実施中", answered: 19 },
  { name: "2026-11", start: "2026-11-02", due: "2026-11-11", status: "予定", answered: 0 },
];

// カテゴリごとの平均（1〜5）。ツール定着が伸び、業務負荷は製造部で重い、という筋書き
const MEANS = {
  エンゲージメント: [3.4, 3.5, 3.6],
  心理的安全性: [3.0, 3.4, 3.7],
  業務負荷: [3.0, 3.0, 2.9],
  "成長・評価": [3.1, 3.2, 3.3],
  "チーム・上司": [3.3, 3.4, 3.5],
  ツール定着: [2.9, 3.4, 3.8],
};
const DEPT_SHIFT = { 製造部: { 業務負荷: -0.7 }, 店舗スタッフ: { "チーム・上司": -0.3 }, 営業部: { ツール定着: 0.3 } };

const COMMENTS = [
  ["繁忙期の残業が続いていて、少し疲れています", "店舗の連絡がLINEとLarkに分かれていて見落としがあります", "新人の教え方が人によって違うので、手順書があると助かります", "評価の基準がよく分かりません", "朝礼の情報共有はとても役に立っています", "製造の段取りが前日夜に変わることがあり、準備が大変です", "休憩がとりにくい日があります", "上司が相談に乗ってくれるので安心して働けています"],
  ["Larkのタスク管理を使い始めて、抜け漏れが減りました", "製造部の人手が足りない日が多いです", "AIで日報の下書きを作れるようになって時間が浮きました", "ほかの部署が何をしているか分かると嬉しいです", "シフトの希望が通りやすくなりました", "評価面談の回数を増やしてほしいです", "夜間のチャット連絡は控えてもらえると助かります", "店長とゆっくり話す時間がほしいです"],
  ["Larkのおかげで店舗間の連絡が楽になりました", "製造部の繁忙が続いていて、人員の補充を検討してほしいです", "AIの使い方をもう少し教えてほしいです", "失敗を共有する会がよかったです。続けてほしい", "手順書が整ってきて新人さんが早く慣れています", "勤務時間外の連絡がまだたまにあります"],
];

const day = (s) => new Date(`${s}T09:00:00+09:00`).getTime();
const clamp = (v) => Math.min(5, Math.max(1, Math.round(v)));

export function makeDemo() {
  const rand = rng(20261006);
  const noise = (w) => (rand() + rand() + rand() - 1.5) * w;
  const people = DEPTS.flatMap(([d, n]) => Array.from({ length: n }, (_, i) => ({ id: `${d}-${i}`, dept: d, mood: noise(0.9) })));

  const answers = [];
  ROUNDS.forEach((round, ri) => {
    if (!round.answered) return;
    const pool = [...people].sort(() => rand() - 0.5).slice(0, round.answered);
    pool.forEach((p, pi) => {
      const key = `demo-${round.name}-${pi}`;
      const at = day(round.start) + Math.floor(rand() * 6) * 86400000 + Math.floor(rand() * 9) * 3600000;
      for (const q of QUESTIONS) {
        const base = { 回答者キー: key, サーベイ回: round.name, 部署: p.dept, 経路: rand() < 0.6 ? "Lark" : "LINE", 設問ID: q.id, カテゴリ: q.category, 回答日時: at };
        if (q.type === "5段階") {
          const m = MEANS[q.category][ri] + (DEPT_SHIFT[p.dept]?.[q.category] ?? 0) + p.mood + noise(0.8);
          answers.push({ ...base, 点数: clamp(m) });
        } else if (rand() < 0.35) {
          const list = COMMENTS[ri];
          answers.push({ ...base, 自由記述: list[Math.floor(rand() * list.length)] });
        }
      }
    });
  });

  const target = people.length;
  const rounds = ROUNDS.map((r) => ({
    回名: r.name,
    開始日: day(r.start),
    締切日: day(r.due),
    状態: r.status,
    対象人数: target,
    配信済: r.status !== "予定",
    メモ: "デモ用の架空データ",
  }));

  const reports = [
    {
      回名: "2026-09",
      AI結果JSON: JSON.stringify({
        summary: "【デモ用サンプル】前回よりツール定着と心理的安全性が上がり、全体として良い方向に動いています。一方で、製造部の業務負荷が他部署より低い状態が続いており、勤務時間外の連絡を気にする声もあります。",
        strengths: ["Lark のタスク管理で抜け漏れが減ったという声が増えています", "AI で日報の下書きを作るなど、小さな効率化が始まっています"],
        concerns: ["製造部の業務負荷のスコアが低いままです", "勤務時間外のチャット連絡を負担に感じる声があります", "評価の基準や面談の機会を求める声があります"],
        actions: [
          { title: "Lark で「20時以降は通知オフ・翌朝送信」のルールを決めて周知する", category: "業務負荷", why: "時間外連絡に関するコメントが複数あり、業務負荷のスコアも低いため" },
          { title: "製造部の段取り変更を前日17時までに Lark で共有する流れを作る", category: "業務負荷", why: "製造部の業務負荷が他部署より低く、前日夜の変更が負担という声があるため" },
          { title: "店長と店舗スタッフの15分面談を月1回、Lark カレンダーで予約できるようにする", category: "チーム・上司", why: "店舗スタッフのチーム・上司スコアがやや低く、話す時間を求める声があるため" },
        ],
      }),
      AI要約: "【デモ用サンプル】管理画面で確認してください",
      作成日時: day("2026-09-11"),
    },
  ];

  const actions = [
    { アクション: "Lark で「20時以降は通知オフ・翌朝送信」のルールを決めて周知する", 回名: "2026-09", カテゴリ: "業務負荷", 担当: "総務部", 期限: day("2026-09-30"), 状態: "完了" },
    { アクション: "製造部の段取り変更を前日17時までに Lark で共有する流れを作る", 回名: "2026-09", カテゴリ: "業務負荷", 担当: "製造部長", 期限: day("2026-10-15"), 状態: "対応中" },
  ];

  return { departments: DEPTS.map(([d]) => d), rounds, answers, reports, actions };
}
