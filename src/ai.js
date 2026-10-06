// 自由記述とスコアを Claude に読ませて、要約と改善アクション案を作る。

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const ReportSchema = z.object({
  summary: z.string().describe("経営者向けの要約。3〜5文、ですます調"),
  strengths: z.array(z.string()).describe("良い点（最大3つ）"),
  concerns: z.array(z.string()).describe("気になる点（最大3つ）"),
  actions: z
    .array(
      z.object({
        title: z.string().describe("改善アクション（1文、具体的に）"),
        category: z.string().describe("関係するカテゴリ名"),
        why: z.string().describe("そう考えた理由（スコアやコメントの根拠）"),
      })
    )
    .describe("来月までに取り組める改善アクション（3つ）"),
});

const SYSTEM = `あなたは中小企業の組織づくりを支援するアドバイザーです。
社員アンケート（しらベール）の集計結果を読み、経営者が次の1ヶ月で取り組めることを提案します。
- 個人が特定できる書き方はしない。コメントをそのまま引用しない
- 断定や煽りを避け、現場に寄り添う言葉で書く
- 改善アクションは、小さく始められて、担当と期限を決めやすいものにする
- Lark・AI・LINE を使った工夫で解決できる場合は、その案を含めてよい`;

export async function summarize(env, { round, result }) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const input = {
    回: round,
    回答者数: result.respondents,
    総合スコア: result.overall,
    前回差: result.overallDiff ?? null,
    カテゴリ別: result.byCategory,
    設問別: result.byQuestion.map(({ text, category, score }) => ({ text, category, score })),
    自由記述: result.comments,
  };
  const response = await client.messages.parse(
    {
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(ReportSchema) },
      // 安全フィルタで断られたときは、Anthropic 側で別モデルにやり直してもらう
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: `次の集計結果を読んで、要約と改善アクション案を作ってください。スコアは0〜100点です。\n\n${JSON.stringify(input, null, 2)}` }],
    },
    { headers: { "anthropic-beta": "server-side-fallback-2026-07-01" } }
  );
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("AI要約を作れませんでした。時間をおいて再実行してください");
  }
  return response.parsed_output;
}
