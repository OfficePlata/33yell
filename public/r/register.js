// メンバー向け画面（LIFF）：LINE と名簿の登録・支払い状況の表示
const $ = (id) => document.getElementById(id);
let idToken = null;

const show = (id) => {
  for (const x of ["loading", "register", "status", "error"]) $(x).classList.toggle("hidden", x !== id);
};
const fail = (msg) => {
  $("error").textContent = msg;
  show("error");
};

async function post(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken, ...body }) });
  return { ok: res.ok, data: await res.json() };
}

const yen = (n) => `${Number(n || 0).toLocaleString("ja-JP")}円`;

function renderStatus(data) {
  $("hello").textContent = `${data.name} さんの会費`;
  const box = $("items");
  box.textContent = "";
  if (!data.items.length) box.textContent = "まだご案内中の会費はありません。";
  for (const it of data.items) {
    const row = document.createElement("div");
    row.className = "item";
    const left = document.createElement("div");
    left.innerHTML = `<b></b><div class="small"></div>`;
    left.querySelector("b").textContent = it.round;
    left.querySelector("div").textContent = `${yen(it.amount)}${it.due ? `／締切 ${it.due}` : ""}`;
    const right = document.createElement("div");
    const tag = document.createElement("span");
    tag.className = `tag ${it.status === "入金済" ? "paid" : it.status === "免除" ? "free" : "unpaid"}`;
    tag.textContent = it.status;
    right.append(tag);
    if (it.status === "未入金" && it.open && it.peatixUrl) {
      const a = document.createElement("a");
      a.className = "btn";
      a.textContent = "Peatixで支払う";
      a.href = it.peatixUrl;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        liff.openWindow({ url: it.peatixUrl, external: true });
      });
      right.append(" ", a);
    }
    row.append(left, right);
    box.append(row);
  }
  show("status");
}

async function load() {
  const { ok, data } = await post("/api/me", {});
  if (!ok) return fail(data.error || "読み込めませんでした");
  if (!data.registered) return show("register");
  renderStatus(data);
}

$("registerBtn").addEventListener("click", async () => {
  const btn = $("registerBtn");
  btn.disabled = true;
  $("registerMsg").textContent = "";
  const { ok, data } = await post("/api/register", { memberNo: $("memberNo").value, name: $("name").value });
  btn.disabled = false;
  if (!ok) {
    $("registerMsg").textContent = data.error;
    $("registerMsg").className = "msg err";
    return;
  }
  await load();
});

(async () => {
  try {
    const config = await fetch("/api/config").then((r) => r.json());
    if (config.chapterName) $("chapter").textContent = `${config.chapterName} 会費`;
    if (!config.liffId) return fail("LINE の設定（LIFF_ID）がまだです。会計担当にお知らせください");
    await liff.init({ liffId: config.liffId });
    if (!liff.isLoggedIn()) return liff.login();
    idToken = liff.getIDToken();
    await load();
  } catch (e) {
    fail(`LINE から開いてください（${e.message}）`);
  }
})();
