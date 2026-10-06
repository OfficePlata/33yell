const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (v) => (v == null ? "—" : v.toFixed(1));
const fmtDiff = (d) => (d == null ? "" : `<span class="diff ${d < 0 ? "down" : "up"}">${d >= 0 ? "▲+" : "▼"}${d.toFixed(1)}</span>`);

let key = "";
try { key = sessionStorage.getItem("shiraberu-admin") || ""; } catch {}

async function api(path, body) {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: { "x-admin-key": key, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = await res.json().catch(() => ({}));
  if (res.status === 401) { login(out.error); throw new Error("unauthorized"); }
  if (!res.ok) throw new Error(out.error || res.statusText);
  return out;
}

function login(error) {
  app.innerHTML = `
    <form class="card" id="login" style="max-width:420px">
      <h2>ログイン</h2>
      ${error && key ? `<p class="error">${esc(error)}</p>` : ""}
      <label class="field" for="pw">管理パスワード</label>
      <input type="password" id="pw" autocomplete="current-password" required>
      <p style="margin-top:14px"><button class="btn" type="submit">ひらく</button></p>
    </form>`;
  document.getElementById("login").addEventListener("submit", (e) => {
    e.preventDefault();
    key = document.getElementById("pw").value;
    try { sessionStorage.setItem("shiraberu-admin", key); } catch {}
    start();
  });
}

async function start() {
  if (!key) return login();
  const { rounds } = await api("/api/admin/rounds");
  if (!rounds.length) {
    app.innerHTML = `<div class="card">まだサーベイ回がありません。Lark BASE の「サーベイ回」に行を追加してください。</div>`;
    return;
  }
  const wanted = new URLSearchParams(location.search).get("r");
  const current = rounds.find((r) => r.name === wanted) || [...rounds].reverse().find((r) => r.status !== "予定") || rounds.at(-1);
  await showRound(rounds, current.name);
}

async function showRound(rounds, name) {
  app.innerHTML = `<div class="card center">集計中です…</div>`;
  const rep = await api(`/api/admin/report?r=${encodeURIComponent(name)}`);
  const r = rep.round;
  app.innerHTML = `
    <div class="card toolbar">
      <label for="round"><b>回</b></label>
      <select id="round">${rounds.map((x) => `<option ${x.name === name ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
      <span class="muted">状態：${esc(r.status || "")}</span>
      <span style="flex:1"></span>
      ${r.status === "予定" ? `<button class="btn small" id="send">回答のお願いを配信する</button>` : ""}
    </div>

    <div class="kpis">
      <div class="kpi"><div class="label">総合スコア</div><div class="value">${fmt(rep.overall)}</div>${fmtDiff(rep.overallDiff)} <span class="muted">/100</span></div>
      <div class="kpi"><div class="label">回答数</div><div class="value">${rep.respondents}</div><span class="muted">人</span></div>
      <div class="kpi"><div class="label">回答率</div><div class="value">${rep.responseRate == null ? "—" : rep.responseRate}</div><span class="muted">%</span></div>
    </div>

    <div class="card">
      <h2>カテゴリ別（前回との差）</h2>
      ${rep.byCategory.map((c) => `
        <div class="bar-row"><span>${esc(c.name)}</span><div class="bar"><span style="width:${c.score ?? 0}%"></span></div><span>${fmt(c.score)} ${fmtDiff(c.diff)}</span></div>`).join("")}
    </div>

    <div class="card">
      <h2>総合スコアの推移</h2>
      ${trendChart(rep.trend)}
    </div>

    <div class="card" id="ai">${aiBlock(rep)}</div>

    <div class="card">
      <h2>部署別</h2>
      <table>
        <thead><tr><th>部署</th><th class="num">人数</th><th class="num">総合</th>${rep.byCategory.map((c) => `<th class="num">${esc(c.name)}</th>`).join("")}</tr></thead>
        <tbody>${rep.byDepartment.map((d) => d.hidden
          ? `<tr><td>${esc(d.name)}</td><td colspan="${rep.byCategory.length + 2}" class="muted">回答が5人未満のため表示しません</td></tr>`
          : `<tr><td>${esc(d.name)}</td><td class="num">${d.n}</td><td class="num"><b>${fmt(d.overall)}</b></td>${d.categories.map((c) => `<td class="num">${fmt(c.score)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>

    <div class="card">
      <h2>設問別</h2>
      <table><tbody>${rep.byQuestion.map((q) => `<tr><td>${esc(q.text)}<br><span class="muted">${esc(q.category)}</span></td><td class="num"><b>${fmt(q.score)}</b></td></tr>`).join("")}</tbody></table>
    </div>

    <div class="card">
      <h2>自由記述（${rep.comments.length}件・順不同）</h2>
      <ul class="comments">${rep.comments.map((c) => `<li>${esc(c)}</li>`).join("") || "<li class='muted'>まだありません</li>"}</ul>
    </div>`;

  document.getElementById("round").addEventListener("change", (e) => {
    history.replaceState(null, "", `?r=${encodeURIComponent(e.target.value)}`);
    showRound(rounds, e.target.value);
  });
  document.getElementById("send")?.addEventListener("click", async (e) => {
    if (!confirm(`${name} の回答のお願いを、Lark と LINE に配信します。よろしいですか？`)) return;
    e.target.disabled = true;
    try {
      const { result } = await api("/api/admin/distribute", { round: name });
      alert(`配信しました（Lark ${result.lark}人${result.line ? "・LINE 一斉配信" : ""}）`);
      start();
    } catch (err) { alert(err.message); e.target.disabled = false; }
  });
  bindAi(rep, name);
}

function aiBlock(rep) {
  const ai = rep.ai;
  if (!ai) {
    return `<h2>AI の読み取りと改善アクション案</h2>
      <p class="muted">締切の翌朝に自動で作られます。今すぐ作ることもできます。</p>
      <button class="btn small" id="gen" ${rep.respondents ? "" : "disabled"}>AI で要約する</button>`;
  }
  return `<h2>AI の読み取りと改善アクション案</h2>
    <p>${esc(ai.summary)}</p>
    <div class="kpis">
      <div><b>良い点</b><ul>${ai.strengths.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
      <div><b>気になる点</b><ul>${ai.concerns.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
    </div>
    ${ai.actions.map((a, i) => `
      <div class="action">
        <div class="t">${i + 1}. ${esc(a.title)}</div>
        <div class="muted">${esc(a.category)}｜${esc(a.why)}</div>
        <p style="margin:8px 0 0"><button class="btn small light" data-action="${i}">改善アクションに登録</button></p>
      </div>`).join("")}
    <p><button class="btn small light" id="gen">作り直す</button></p>`;
}

function bindAi(rep, name) {
  document.getElementById("gen")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    e.target.textContent = "AI が読んでいます…（30秒ほど）";
    try {
      const { ai } = await api("/api/admin/summarize", { round: name });
      rep.ai = ai;
      document.getElementById("ai").innerHTML = aiBlock(rep);
      bindAi(rep, name);
    } catch (err) { alert(err.message); e.target.disabled = false; e.target.textContent = "AI で要約する"; }
  });
  document.querySelectorAll("[data-action]").forEach((b) =>
    b.addEventListener("click", async () => {
      const a = rep.ai.actions[Number(b.dataset.action)];
      b.disabled = true;
      try {
        await api("/api/admin/actions", { round: name, title: a.title, category: a.category });
        b.textContent = "登録しました（Lark BASE「改善アクション」）";
      } catch (err) { alert(err.message); b.disabled = false; }
    })
  );
}

function trendChart(trend) {
  const pts = trend.filter((t) => t.overall != null);
  if (pts.length < 2) return `<p class="muted">2回分以上たまると推移が出ます。</p>`;
  const W = 640, H = 220, P = 36;
  const xs = (i) => P + (i * (W - P * 2)) / (pts.length - 1);
  const min = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.overall)) / 10) * 10 - 10);
  const max = Math.min(100, Math.ceil(Math.max(...pts.map((p) => p.overall)) / 10) * 10 + 10);
  const ys = (v) => H - P - ((v - min) / (max - min)) * (H - P * 2);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${xs(i)},${ys(p.overall)}`).join(" ");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="総合スコアの推移">
    <line x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}" stroke="#1A1A1A" stroke-width="2"/>
    <path d="${line}" fill="none" stroke="#DD6420" stroke-width="4" stroke-linejoin="round"/>
    ${pts.map((p, i) => `
      <circle cx="${xs(i)}" cy="${ys(p.overall)}" r="7" fill="#FFD600" stroke="#1A1A1A" stroke-width="3"/>
      <text x="${xs(i)}" y="${ys(p.overall) - 14}" text-anchor="middle" font-size="14" font-weight="700">${p.overall.toFixed(1)}</text>
      <text x="${xs(i)}" y="${H - P + 22}" text-anchor="middle" font-size="13">${esc(p.round)}</text>`).join("")}
  </svg>`;
}

start().catch((e) => { if (e.message !== "unauthorized") app.innerHTML = `<div class="card"><p class="error">${esc(e.message)}</p></div>`; });
