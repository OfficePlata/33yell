// 受付フォームの入力チェック。ページ側のチェックは迂回できるので、サーバー側でも必ず確かめる。

const JST_OFFSET = "+09:00";

// <input type="datetime-local"> の値（例：2026-10-10T12:00）はタイムゾーンを持たない。
// Cloudflare 上の時計は UTC なので、日本時間として解釈しないと9時間ずれる。
export function parseJstDateTime(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return null;
  }
  const time = new Date(value + JST_OFFSET).getTime();
  return Number.isNaN(time) ? null : time;
}

export function validateReservation(input, now = Date.now()) {
  const errors = [];
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const note = typeof input?.note === "string" ? input.note.trim() : "";
  const people = Number(input?.people);
  const visitAt = parseJstDateTime(input?.datetime);

  if (name.length < 1 || name.length > 50) errors.push("お名前は1〜50文字で入力してください");
  if (!Number.isInteger(people) || people < 1 || people > 20) errors.push("人数は1〜20名で入力してください");
  if (visitAt === null) errors.push("来店日時を正しく入力してください");
  else if (visitAt < now) errors.push("来店日時は今より後の日時を入力してください");
  if (note.length > 200) errors.push("ご要望は200文字以内で入力してください");

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: { name, people, visitAt, note } };
}
