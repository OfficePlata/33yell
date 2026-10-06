// 回答の集計。Lark や Workers に依存しない純粋な関数だけを置く（テストしやすくするため）。

export const MIN_GROUP = 5; // これ未満の人数のまとまりは数字を出さない

/** 5段階の平均を 0〜100 点に直す */
export function toScore(avg) {
  if (avg == null || Number.isNaN(avg)) return null;
  return Math.round(((avg - 1) / 4) * 1000) / 10;
}

function mean(nums) {
  const v = nums.filter((n) => typeof n === "number" && !Number.isNaN(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/**
 * rows: 回答テーブルの行 { key, department, questionId, category, score, comment }
 * questions: 設問マスタ { id, text, category, type }
 */
export function aggregate(rows, questions, { minGroup = MIN_GROUP } = {}) {
  const scaleQs = questions.filter((q) => q.type === "5段階");
  const respondents = new Set(rows.map((r) => r.key));
  const n = respondents.size;

  const byQuestion = scaleQs.map((q) => {
    const scores = rows.filter((r) => r.questionId === q.id).map((r) => r.score);
    return { id: q.id, text: q.text, category: q.category, score: toScore(mean(scores)), n: scores.length };
  });

  const categoryNames = [...new Set(scaleQs.map((q) => q.category))];
  const byCategory = categoryNames.map((name) => {
    const qs = byQuestion.filter((q) => q.category === name && q.score != null);
    return { name, score: qs.length ? Math.round(mean(qs.map((q) => q.score)) * 10) / 10 : null };
  });

  const scored = byCategory.filter((c) => c.score != null);
  const overall = scored.length ? Math.round(mean(scored.map((c) => c.score)) * 10) / 10 : null;

  // 部署別：人数が少ない部署は「非表示」にして人数も出さない
  const deptKeys = new Map();
  for (const r of rows) {
    const d = r.department || "未回答";
    if (!deptKeys.has(d)) deptKeys.set(d, new Set());
    deptKeys.get(d).add(r.key);
  }
  const byDepartment = [...deptKeys.entries()].map(([name, keys]) => {
    if (keys.size < minGroup) return { name, hidden: true };
    const deptRows = rows.filter((r) => (r.department || "未回答") === name);
    const cats = categoryNames.map((c) => {
      const qs = scaleQs.filter((q) => q.category === c).map((q) =>
        toScore(mean(deptRows.filter((r) => r.questionId === q.id).map((r) => r.score)))
      );
      const v = qs.filter((s) => s != null);
      return { name: c, score: v.length ? Math.round(mean(v) * 10) / 10 : null };
    });
    const v = cats.filter((c) => c.score != null).map((c) => c.score);
    return { name, hidden: false, n: keys.size, overall: v.length ? Math.round(mean(v) * 10) / 10 : null, categories: cats };
  });

  // 自由記述は部署などの属性を外し、順番も混ぜて出す
  const comments = shuffle(rows.filter((r) => r.comment && r.comment.trim()).map((r) => r.comment.trim()));

  return { respondents: n, overall, byCategory, byQuestion, byDepartment, comments };
}

/** 前回との差を付ける */
export function withDiff(current, previous) {
  if (!previous) return current;
  const prevCat = new Map(previous.byCategory.map((c) => [c.name, c.score]));
  return {
    ...current,
    overallDiff: diff(current.overall, previous.overall),
    byCategory: current.byCategory.map((c) => ({ ...c, diff: diff(c.score, prevCat.get(c.name)) })),
  };
}

function diff(a, b) {
  return a == null || b == null ? null : Math.round((a - b) * 10) / 10;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
