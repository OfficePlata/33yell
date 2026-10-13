// POST /api/reserve：予約を受け付けて Lark BASE の「予約」テーブルに1件追加する。

import { validateReservation } from "../../lib/validate.js";
import { createRecord, notifyWebhook } from "../../lib/lark.js";
import { verifyLineIdToken } from "../../lib/line.js";

function formatJst(time) {
  return new Date(time).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" });
}

export async function onRequestPost({ request, env }) {
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ ok: false, errors: ["送信内容を読み取れませんでした"] }, { status: 400 });
  }

  const checked = validateReservation(input);
  if (!checked.ok) return Response.json({ ok: false, errors: checked.errors }, { status: 400 });
  const { name, people, visitAt, note } = checked.value;

  const lineUser = await verifyLineIdToken(env, input.idToken);
  if (input.idToken && !lineUser) {
    return Response.json({ ok: false, errors: ["LINEの確認ができませんでした。開き直してお試しください"] }, { status: 401 });
  }

  // キーは BASE のフィールド名と1文字も違わないこと
  const fields = {
    "お名前": name,
    "来店日時": visitAt,
    "人数": people,
    "ご要望": note,
    "ステータス": "受付",
    "受付経路": lineUser ? "LINE" : "フォーム",
  };
  if (lineUser) fields["LINEユーザーID"] = lineUser.userId;

  try {
    await createRecord(env, fields);
    await notifyWebhook(env, `新しい予約（${fields["受付経路"]}）：${name} 様 ${formatJst(visitAt)} ${people}名`);
  } catch (err) {
    // 詳しいエラーはお客様には見せず、Cloudflare のログにだけ残す
    console.error(err);
    return Response.json({ ok: false, errors: ["受付に失敗しました。お手数ですがお電話でご連絡ください"] }, { status: 502 });
  }

  return Response.json({ ok: true });
}
