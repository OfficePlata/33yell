const params = new URLSearchParams(location.search);
const state = { round: params.get("r"), t: params.get("t"), demo: params.get("demo") === "1", idToken: null, answers: {} };
const app = document.getElementById("app");
const LABELS = ["そう思わない", "あまり思わない", "どちらとも", "ややそう思う", "そう思う"];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const show = (html) => (app.innerHTML = html);

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function setupLiff(liffId) {
  await loadScript("https://static.line-scdn.net/liff/edge/2/sdk.js");
  await window.liff.init({ liffId });
  if (!window.liff.isLoggedIn()) {
    window.liff.login({ redirectUri: location.href });
    return false;
  }
  state.idToken = window.liff.getIDToken();
  // LIFF で開くと r が liff.state 経由で渡ることがある
  if (!state.round) state.round = new URLSearchParams(location.search).get("r");
  return true;
}

async function start() {
  const config = await fetch("/api/config").then((r) => r.json());
  document.getElementById("company").textContent = config.companyName || "";
  if (!state.t && !state.demo && config.liffId) {
    if (!(await setupLiff(config.liffId))) return;
  }
  if (!state.t && !state.idToken && !(state.demo && config.demo)) {
    show(`<div class="card"><h2>回答用リンクから開いてください</h2><p>Lark または LINE に届いたメッセージの「回答する」ボタンから開くと回答できます。</p></div>`);
    return;
  }
  const res = await fetch(`/api/survey${state.round ? `?r=${encodeURIComponent(state.round)}` : ""}`);
  const survey = await res.json();
  if (!res.ok) return show(`<div class="card"><h2>${esc(survey.error)}</h2></div>`);
  if (!survey.open) return show(`<div class="card"><h2>このアンケートは受付期間外です</h2></div>`);
  state.round = survey.round;
  render(survey);
}

function render(survey) {
  const scaleQs = survey.questions.filter((q) => q.type === "5段階");
  const free = survey.questions.find((q) => q.type === "自由記述");
  const due = survey.due ? new Date(survey.due).toLocaleDateString("ja-JP") : "";
  show(`
    <div class="card">
      <h2>${esc(survey.round)} のアンケート</h2>
      <p>今の職場について、感じていることをそのまま教えてください。1〜3分で終わります。</p>
      <p class="muted">回答は匿名で集計します。誰がどう答えたかは、会社には分かりません。人数が5人未満の部署は、部署別の数字を出しません。${due ? `<br>締切：${esc(due)}` : ""}</p>
    </div>
    <form id="form">
      <div class="card">
        <label class="field" for="dept">所属</label>
        <select id="dept" required>
          <option value="">選んでください</option>
          ${survey.departments.map((d) => `<option>${esc(d)}</option>`).join("")}
          <option value="未回答">答えたくない</option>
        </select>
      </div>
      <div class="card">
        ${scaleQs
          .map(
            (q, i) => `
          <div class="q" data-q="${esc(q.id)}">
            <div class="text"><span class="num">Q${i + 1}</span>${esc(q.text)}</div>
            <div class="scale" role="group" aria-label="${esc(q.text)}">
              ${LABELS.map((l, v) => `<button type="button" data-v="${v + 1}" aria-pressed="false"><b>${v + 1}</b>${l}</button>`).join("")}
            </div>
          </div>`
          )
          .join("")}
      </div>
      ${
        free
          ? `<div class="card"><label class="field" for="comment">${esc(free.text)}</label><textarea id="comment" maxlength="1000" placeholder="どんな小さなことでも大丈夫です"></textarea></div>`
          : ""
      }
      <div id="msg"></div>
      <button class="btn block" id="submit" type="submit">回答を送る</button>
    </form>`);

  app.querySelectorAll(".q").forEach((el) => {
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-v]");
      if (!b) return;
      el.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      state.answers[el.dataset.q] = Number(b.dataset.v);
    });
  });

  document.getElementById("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("msg");
    const missing = scaleQs.filter((q) => !state.answers[q.id]);
    if (missing.length) {
      msg.innerHTML = `<p class="error">まだ答えていない設問が ${missing.length} 問あります</p>`;
      return;
    }
    const btn = document.getElementById("submit");
    btn.disabled = true;
    btn.textContent = "送信中…";
    const res = await fetch("/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        round: state.round,
        t: state.t,
        idToken: state.idToken,
        demo: state.demo,
        department: document.getElementById("dept").value,
        answers: state.answers,
        comment: document.getElementById("comment")?.value || "",
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (out.ok) {
      show(`<div class="card center"><p class="big">ありがとう<br>ございました</p><p>いただいた声は、職場をよくするために使います。</p></div>`);
      if (window.liff?.isInClient?.()) setTimeout(() => window.liff.closeWindow(), 2500);
    } else {
      msg.innerHTML = `<p class="error">${esc(out.error || "送信できませんでした。時間をおいてもう一度お試しください")}</p>`;
      btn.disabled = false;
      btn.textContent = "回答を送る";
    }
  });
}

start().catch((e) => show(`<div class="card"><p class="error">読み込みに失敗しました：${esc(e.message)}</p></div>`));
