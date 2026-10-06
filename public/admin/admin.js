// 会計担当・ビジターホスト向けの管理画面
const $ = (id) => document.getElementById(id);
let key = sessionStorageGet();
let rounds = [];
let lineOn = false;

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
  const data = await api("/api/admin/rounds");
  rounds = data.rounds;
  lineOn = data.line;
  const sel = $("round");
  const prev = sel.value;
  sel.textContent = "";
  for (const r of [...rounds].reverse()) sel.append(new Option(`${r.kind === "ビジター" ? "［ビジター］" : "［会費］"}${r.name}（${r.status}）`, r.name));
  if (prev && rounds.some((r) => r.name === prev)) sel.value = prev;
  else {
    const open = [...rounds].reverse().find((r) => r.status === "案内中");
    if (open) sel.value = open.name;
  }
  await loadRound();
}

function stat(label, value) {
  const d = document.createElement("div");
  d.className = "stat";
  d.textContent = label;
  const b = document.createElement("b");
  b.textContent = value;
  d.append(b);
  return d;
}

function tagClass(status) {
  return status === "入金済" || status === "当日現金" ? "paid" : status === "免除" || status === "キャンセル" ? "free" : "unpaid";
}

/** 1行分の「手で記録」プルダウン */
function actionSelect(options, onPick) {
  const sel = document.createElement("select");
  for (const [v, label] of [["", "変更…"], ...options]) sel.append(new Option(label, v));
  sel.addEventListener("change", async () => {
    if (!sel.value) return;
    const label = sel.options[sel.selectedIndex].text;
    if (!confirm(`「${label}」にします`)) return (sel.value = "");
    try {
      await onPick(sel.value);
      await loadRound();
    } catch (e) {
      alert(e.message);
      sel.value = "";
    }
  });
  return sel;
}

function row(cells, status, action) {
  const tr = document.createElement("tr");
  for (const c of cells) {
    const td = document.createElement("td");
    td.textContent = c;
    tr.append(td);
  }
  const tagTd = document.createElement("td");
  const tag = document.createElement("span");
  tag.className = `tag ${tagClass(status)}`;
  tag.textContent = status;
  tagTd.append(tag);
  tr.insertBefore(tagTd, tr.children[2] || null);
  const actTd = document.createElement("td");
  actTd.append(action);
  tr.append(actTd);
  return tr;
}

function setHead(labels) {
  const tr = document.createElement("tr");
  for (const l of labels) {
    const th = document.createElement("th");
    th.textContent = l;
    tr.append(th);
  }
  $("listHead").replaceChildren(tr);
}

function renderMessages(messages) {
  const box = $("messages");
  box.textContent = "";
  for (const [k, label] of [["notice", "案内文"], ["remind", "リマインド文（未入金の方あて）"]]) {
    if (!messages[k]) continue;
    const h = document.createElement("p");
    h.className = "small";
    h.innerHTML = "<b></b>";
    h.firstChild.textContent = label;
    const pre = document.createElement("pre");
    pre.textContent = messages[k];
    const btn = document.createElement("button");
    btn.className = "sub";
    btn.textContent = "コピー";
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(messages[k]);
        btn.textContent = "コピーしました";
      } catch {
        getSelection().selectAllChildren(pre);
        btn.textContent = "選択しました（コピーしてください）";
      }
      setTimeout(() => (btn.textContent = "コピー"), 2000);
    });
    box.append(h, pre, btn);
  }
}

async function loadRound() {
  const r = current();
  if (!r) return;
  const visitor = r.kind === "ビジター";
  $("roundInfo").textContent = `${yen(r.amount)}／案内日 ${r.noticeDate || "未設定"}／${visitor ? "例会日" : "締切"} ${r.due || "未設定"}${r.peatixUrl ? "" : "／PeatixURL が未設定です"}${lineOn ? "" : "／LINE は使わない設定です"}`;
  const data = await api(`/api/admin/round?r=${encodeURIComponent(r.name)}`);
  const tbody = $("dues");
  tbody.textContent = "";
  $("walkin").classList.toggle("hidden", !visitor);
  $("remindBtn").textContent = visitor ? "前日のビジター一覧を Lark に送る" : lineOn ? "未入金の人にリマインド" : "リマインド文を Lark に送る";
  $("noticeBtn").textContent = visitor ? "ビジター受付を始める" : lineOn ? "LINE で案内を送る" : "案内を始める（文面を Lark に送る）";

  if (visitor) {
    const s = data.summary;
    $("stats").replaceChildren(stat("申込", s.total), stat("Peatix入金済", s.paid), stat("当日現金", s.cash), stat("未入金", s.unpaid), stat("合計", yen(s.amount)));
    $("listTitle").textContent = "② ビジター受付リスト";
    setHead(["名前", "会社名", "状態", "業種", "紹介者", "手で記録"]);
    for (const v of data.visitors) {
      const act = actionSelect(
        [["当日現金", "当日現金で受領"], ["入金済", "入金済にする"], ["未入金", "未入金に戻す"], ["キャンセル", "キャンセル"]],
        (status) => api("/api/admin/visitor", { round: r.name, id: v.id, status })
      );
      tbody.append(row([v.name, v.company, v.category, v.referrer], v.status, act));
    }
  } else {
    const count = (s) => data.dues.filter((d) => d.status === s).length;
    const stats = [stat("入金済", count("入金済")), stat("未入金", count("未入金")), stat("免除", count("免除"))];
    if (lineOn) stats.push(stat("LINE未登録", data.dues.filter((d) => !d.line).length));
    $("stats").replaceChildren(...stats);
    $("listTitle").textContent = "② 入金表";
    setHead(lineOn ? ["番号", "名前", "状態", "方法", "LINE", "手で記録"] : ["番号", "名前", "状態", "方法", "手で記録"]);
    data.dues.sort((a, b) => (a.memberNo < b.memberNo ? -1 : 1));
    for (const d of data.dues) {
      const act = actionSelect(
        [["入金済:現金", "現金で受領"], ["入金済:振込", "振込で受領"], ["免除", "免除"], ["未入金", "未入金に戻す"]],
        (value) => {
          const [status, method] = value.split(":");
          return api("/api/admin/mark", { round: r.name, memberNo: d.memberNo, status, method });
        }
      );
      const cells = [d.memberNo, d.name, d.method];
      if (lineOn) cells.push(d.line ? "○" : "未");
      tbody.append(row(cells, d.status, act));
    }
  }
  renderMessages(data.messages || {});
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
    await loadRound();
    if (s.kind === "ビジター") {
      detail.classList.add("hidden");
      return `CSV ${s.rows} 行／新しい申込 ${s.added} 名／状態の変更 ${s.updated} 件（合計 ${s.total} 名・入金済 ${s.paid} 名）`;
    }
    detail.classList.toggle("hidden", !s.unmatched.length);
    detail.textContent = s.unmatched.length
      ? "要確認（名簿と結びつかなかった申込）\n" + s.unmatched.map((u) => `・${u.name || "（名前なし）"} 番号:${u.memberNo || "なし"} 販売ID:${u.saleId} → ${u.reason}`).join("\n")
      : "";
    return `CSV ${s.rows} 行／一致 ${s.matched} 人（新しく入金済 ${s.updated} 人）／要確認 ${s.unmatched.length} 件／未入金 ${s.unpaid.length} 人`;
  })
);

$("walkinBtn").addEventListener("click", () =>
  withButton($("walkinBtn"), $("walkinMsg"), async () => {
    const name = $("wName").value;
    await api("/api/admin/visitor/add", { round: current().name, name, company: $("wCompany").value, category: $("wCategory").value, referrer: $("wReferrer").value });
    for (const id of ["wName", "wCompany", "wCategory", "wReferrer"]) $(id).value = "";
    await loadRound();
    return `${name} さんを当日現金で追加しました`;
  })
);

for (const [id, path] of [
  ["noticeBtn", "/api/admin/notice"],
  ["remindBtn", "/api/admin/remind"],
  ["closeBtn", "/api/admin/close"],
]) {
  $(id).addEventListener("click", () => {
    if (!confirm(`「${current().name}」で「${$(id).textContent}」を実行します。よろしいですか？`)) return;
    withButton($(id), $("sendMsg"), async () => {
      const s = await api(path, { round: current().name });
      await loadRounds();
      if (path.endsWith("notice")) return s.sent ? `LINE で ${s.sent} 人に送りました。Lark にも文面を送りました` : "始めました。Lark に貼れる文面を送りました";
      if (path.endsWith("remind")) return "visitors" in s ? `明日のビジター ${s.visitors} 名の一覧を Lark に送りました` : `未入金 ${s.unpaid} 人（LINE で ${s.sent} 人に送信、文面で ${s.byHand} 人分を Lark に送信）`;
      return "paid" in s && "cash" in s ? `締めました：Peatix ${s.paid} 名／当日現金 ${s.cash} 名／未入金 ${s.unpaid} 名` : `締め切りました：入金済 ${s.paid} 人／未入金 ${s.unpaid} 人`;
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
