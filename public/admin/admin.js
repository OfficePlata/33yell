// 会計担当向けの管理画面
const $ = (id) => document.getElementById(id);
let key = sessionStorageGet();
let rounds = [];

function sessionStorageGet() {
  try {
    return sessionStorage.getItem("atsumeru-key") || "";
  } catch {
    return "";
  }
}

async function api(path, body) {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { "x-admin-key": key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `エラー ${res.status}`);
  return data;
}

const current = () => rounds.find((r) => r.name === $("round").value);
const yen = (n) => `${Number(n || 0).toLocaleString("ja-JP")}円`;

async function loadRounds() {
  rounds = (await api("/api/admin/rounds")).rounds;
  const sel = $("round");
  const prev = sel.value;
  sel.textContent = "";
  for (const r of [...rounds].reverse()) sel.append(new Option(`${r.name}（${r.status}）`, r.name));
  if (prev && rounds.some((r) => r.name === prev)) sel.value = prev;
  else {
    const open = [...rounds].reverse().find((r) => r.status === "案内中");
    if (open) sel.value = open.name;
  }
  await loadRound();
}

async function loadRound() {
  const r = current();
  if (!r) return;
  $("roundInfo").textContent = `${yen(r.amount)}／案内日 ${r.noticeDate || "未設定"}／締切 ${r.due || "未設定"}${r.peatixUrl ? "" : "／PeatixURL が未設定です"}`;
  const { dues } = await api(`/api/admin/round?r=${encodeURIComponent(r.name)}`);
  const count = (s) => dues.filter((d) => d.status === s).length;
  $("sPaid").textContent = count("入金済");
  $("sUnpaid").textContent = count("未入金");
  $("sFree").textContent = count("免除");
  $("sNoLine").textContent = dues.filter((d) => !d.line).length;
  const tbody = $("dues");
  tbody.textContent = "";
  dues.sort((a, b) => (a.memberNo < b.memberNo ? -1 : 1));
  for (const d of dues) {
    const tr = document.createElement("tr");
    const cls = d.status === "入金済" ? "paid" : d.status === "免除" ? "free" : "unpaid";
    tr.innerHTML = `<td></td><td></td><td><span class="tag ${cls}"></span></td><td></td><td></td><td></td>`;
    tr.children[0].textContent = d.memberNo;
    tr.children[1].textContent = d.name;
    tr.children[2].firstChild.textContent = d.status;
    tr.children[3].textContent = d.method;
    tr.children[4].textContent = d.line ? "○" : "未";
    const sel = document.createElement("select");
    for (const [v, label] of [["", "変更…"], ["入金済:現金", "現金で受領"], ["入金済:振込", "振込で受領"], ["免除", "免除"], ["未入金", "未入金に戻す"]]) sel.append(new Option(label, v));
    sel.addEventListener("change", async () => {
      if (!sel.value) return;
      const [status, method] = sel.value.split(":");
      if (!confirm(`${d.name} さんを「${sel.options[sel.selectedIndex].text}」にします`)) return (sel.value = "");
      try {
        await api("/api/admin/mark", { round: r.name, memberNo: d.memberNo, status, method });
        await loadRound();
      } catch (e) {
        alert(e.message);
      }
    });
    tr.children[5].append(sel);
    tbody.append(tr);
  }
}

/** Peatix の CSV は UTF-8 と Shift_JIS のどちらでも読めるようにする */
async function readCsvFile(file) {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("shift_jis").decode(buf);
  }
}

async function withButton(btn, msgEl, fn) {
  btn.disabled = true;
  msgEl.className = "msg";
  msgEl.textContent = "処理中です…";
  try {
    msgEl.textContent = await fn();
  } catch (e) {
    msgEl.className = "msg err";
    msgEl.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
}

$("importBtn").addEventListener("click", () =>
  withButton($("importBtn"), $("importMsg"), async () => {
    const file = $("csv").files[0];
    if (!file) throw new Error("CSV ファイルを選んでください");
    const s = await api("/api/admin/import", { round: current().name, csv: await readCsvFile(file) });
    const detail = $("importDetail");
    detail.classList.toggle("hidden", !s.unmatched.length);
    detail.textContent = s.unmatched.length
      ? "要確認（名簿と結びつかなかった申込）\n" + s.unmatched.map((u) => `・${u.name || "（名前なし）"} 番号:${u.memberNo || "なし"} 販売ID:${u.saleId} → ${u.reason}`).join("\n")
      : "";
    await loadRound();
    return `CSV ${s.rows} 行／一致 ${s.matched} 人（新しく入金済 ${s.updated} 人）／要確認 ${s.unmatched.length} 件／未入金 ${s.unpaid.length} 人`;
  })
);

for (const [id, path, label] of [
  ["noticeBtn", "/api/admin/notice", "案内"],
  ["remindBtn", "/api/admin/remind", "リマインド"],
  ["closeBtn", "/api/admin/close", "締切"],
]) {
  $(id).addEventListener("click", () => {
    if (!confirm(`「${current().name}」の${label}を実行します。よろしいですか？`)) return;
    withButton($(id), $("sendMsg"), async () => {
      const s = await api(path, { round: current().name });
      await loadRounds();
      if (path.endsWith("notice")) return `LINE で ${s.sent} 人に案内しました（LINE 未登録 ${s.noLine} 人）`;
      if (path.endsWith("remind")) return `未入金 ${s.unpaid} 人のうち、LINE で ${s.sent} 人に送りました`;
      return `締め切りました：入金済 ${s.paid} 人／未入金 ${s.unpaid} 人（Lark に通知しました）`;
    });
  });
}

$("round").addEventListener("change", () => loadRound().catch((e) => alert(e.message)));

async function open() {
  try {
    await loadRounds();
    try {
      sessionStorage.setItem("atsumeru-key", key);
    } catch {}
    $("login").classList.add("hidden");
    $("app").classList.remove("hidden");
  } catch (e) {
    $("loginMsg").textContent = e.message;
  }
}

$("loginBtn").addEventListener("click", () => {
  key = $("password").value;
  open();
});
if (key) open();
