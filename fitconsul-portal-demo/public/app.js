// =============================================================
// F-IT CONSUL 業務ポータル（デモ）— フロント
// プリコム社内ポータル（Lark 版）の構成をベースに、データ基盤を Notion に置き換えたデモ。
// デモではデータを data.js の架空データ＋ブラウザ保存（localStorage）で再現している。
// =============================================================

const STORE_KEY = 'fitconsul-portal-demo-v1';
const $app = document.getElementById('app');

// ---- utils ----
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = (v) => '¥' + Math.round(v).toLocaleString('ja-JP');
const man = (v) => (Math.round(v / 10000)).toLocaleString('ja-JP');
const pct = (v) => (isFinite(v) ? Math.round(v * 100) + '%' : '—');
const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (f(x) || 0), 0);
const byId = (list, id) => list.find((x) => x.id === id);
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

// 相対月（5 = 当月）→ 実際の年月
const NOW = new Date();
const CUR = 5;
function monthDate(idx) { return new Date(NOW.getFullYear(), NOW.getMonth() + (idx - CUR), 1); }
function monthLabel(idx, short = false) {
  const d = monthDate(idx);
  return short ? `${d.getMonth() + 1}月` : `${d.getFullYear()}年${d.getMonth() + 1}月`;
}
const daysInCur = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0).getDate();
const CUR_FRAC = Math.min(1, NOW.getDate() / daysInCur); // 当月の経過割合
function longDateStr() {
  return `${NOW.getFullYear()}年${NOW.getMonth() + 1}月${NOW.getDate()}日（${WEEK[NOW.getDay()]}）`;
}
function greeting() {
  const h = NOW.getHours();
  if (h < 5) return 'お疲れさまです';
  if (h < 11) return 'おはようございます';
  if (h < 18) return 'こんにちは';
  return 'お疲れさまです';
}
// 決定的な揺らぎ（毎回同じ数字になるように）
function noise(key) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return 0.86 + ((h >>> 0) % 1000) / 1000 * 0.28; // 0.86〜1.14
}

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ''), 3000);
}

const icons = {
  home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
  order: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  yen: '<path d="M6 4l6 8 6-8M12 12v8M8 13h8M8 17h8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  db: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  reset: '<path d="M4 4v6h6"/><path d="M4.5 15a8 8 0 1 0 1.9-8.3L4 10"/>',
  cal: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  status: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
const svg = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const notionLink = (label = 'Notionで開く') =>
  `<a class="n-link" href="#" data-notion><b>N</b>${esc(label)} ↗</a>`;

// =============================================================
// 状態（デモ用にブラウザへ保存）
// =============================================================
function freshState() {
  return {
    role: 'exec',
    orderStatus: {},     // 受注ID → ステータス
    purchaseStatus: {},  // 発注ID → ステータス
    newOrders: [],
    milestones: {},      // 'P1:3' → true/false
    timesheet: {},       // projectId → [月..日] の時間（今週分）
    lastSync: Date.now(),
  };
}
let S = load();
function load() {
  try { return { ...freshState(), ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; }
  catch { return freshState(); }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch {} }

const ROLES = {
  exec: { label: '経営者ビュー', user: 'm5', title: '取締役' },
  pm: { label: 'PMビュー', user: 'm1', title: 'プロジェクトマネージャー' },
  member: { label: 'メンバービュー', user: 'm3', title: 'エンジニア' },
};
const me = () => byId(MEMBERS, ROLES[S.role].user);
const canMoney = () => S.role !== 'member';   // 金額（受発注・原価）を見られるか
const canRate = () => S.role === 'exec';      // 個人の原価単価を見られるか

// =============================================================
// 集計ロジック（実運用では Notion のロールアップ＋API側で算出）
// =============================================================
const ORDER_FLOW = ['見積中', '受注確定', '納品・検収', '請求済', '入金済'];
const PURCHASE_FLOW = ['発注予定', '発注済', '納品済', '支払済'];

function allOrders() {
  const rec = [];
  RECURRING.forEach((r) => {
    const p = byId(PROJECTS, r.project);
    for (let m = p.months[0]; m <= Math.min(p.months[1], CUR + 1); m++) {
      const st = m < CUR - 1 ? '入金済' : m === CUR - 1 ? '請求済' : m === CUR ? '納品・検収' : '受注確定';
      rec.push({ id: `R-${r.project}-${m}`, no: `JU-M${String(m).padStart(2, '0')}${r.project}`, project: r.project,
                 title: `${r.label} ${monthLabel(m, true)}分`, amount: r.amount, status: st, bill: m, recurring: true });
    }
  });
  return [...ORDERS, ...rec, ...S.newOrders].map((o) => ({
    ...o,
    status: S.orderStatus[o.id] || o.status,
    client: o.client || (o.project ? byId(PROJECTS, o.project).client : null),
  }));
}
function allPurchases() {
  return PURCHASES.map((p) => ({ ...p, status: S.purchaseStatus[p.id] || p.status }));
}

// 工数：メンバー×案件×月（h）
function hours(memberId, projectId, m) {
  const p = byId(PROJECTS, projectId);
  const base = p.alloc[memberId];
  if (!base || m < p.months[0] || m > p.months[1] || m > CUR) return 0;
  let h = base * noise(`${memberId}${projectId}${m}`);
  if (m === CUR) h *= CUR_FRAC;
  if (m === CUR && memberId === ROLES.member.user) h += sum(S.timesheet[projectId] || []);
  return Math.round(h);
}
function memberMonthHours(memberId, m) { return sum(PROJECTS, (p) => hours(memberId, p.id, m)); }

function projectCost(p) {
  let labor = 0; const byMember = {}; const byMonth = {};
  MEMBERS.forEach((mb) => {
    for (let m = Math.min(0, p.months[0]); m <= CUR; m++) {
      const h = hours(mb.id, p.id, m);
      if (!h) continue;
      const c = h * mb.cost;
      labor += c;
      byMember[mb.id] = byMember[mb.id] || { h: 0, c: 0 };
      byMember[mb.id].h += h; byMember[mb.id].c += c;
      byMonth[m] = (byMonth[m] || 0) + c;
    }
  });
  const pur = allPurchases().filter((x) => x.project === p.id && x.status !== '発注予定');
  const outsource = sum(pur, (x) => x.amount);
  const actual = labor + outsource;
  const revenue = sum(allOrders().filter((o) => o.project === p.id && o.status !== '見積中' && !o.recurring), (o) => o.amount)
                + (RECURRING.find((r) => r.project === p.id)?.amount || 0) * (p.months[1] - p.months[0] + 1);
  const forecast = p.status === '完了' ? actual : p.progress > 0 ? actual / (p.progress / 100) : actual;
  return { labor, outsource, actual, revenue, forecast, byMember, byMonth,
           burn: p.budget ? actual / p.budget : 0, fcRatio: p.budget ? forecast / p.budget : 0,
           margin: revenue - forecast, marginRate: revenue ? (revenue - forecast) / revenue : 0 };
}
function riskOf(c, p) {
  if (!p.budget || p.status === '提案中') return null;
  if (p.status === '完了') return c.fcRatio > 1 ? { cls: 'p-no', label: '予算超過' } : { cls: 'p-ok', label: '予算内' };
  if (c.fcRatio > 1.1) return { cls: 'p-no', label: '原価超過リスク' };
  if (c.fcRatio > 0.95) return { cls: 'p-wait', label: '要注意' };
  return { cls: 'p-ok', label: '順調' };
}

function monthly() {
  const orders = allOrders();
  return [0, 1, 2, 3, 4, 5].map((m) => {
    const revenue = sum(orders.filter((o) => o.bill === m && o.status !== '見積中'), (o) => o.amount);
    let cost = 0;
    MEMBERS.forEach((mb) => PROJECTS.forEach((p) => (cost += hours(mb.id, p.id, m) * mb.cost)));
    cost += sum(allPurchases().filter((x) => x.month === m && x.status !== '発注予定'), (x) => x.amount);
    return { m, revenue, cost };
  });
}

const statusPill = (s) => {
  const map = {
    '見積中': 'p-gray', '受注確定': 'p-info', '納品・検収': 'p-violet', '請求済': 'p-wait', '入金済': 'p-ok',
    '発注予定': 'p-gray', '発注済': 'p-info', '納品済': 'p-wait', '支払済': 'p-ok',
    '提案中': 'p-gray', '進行中': 'p-info', '検収待ち': 'p-violet', '完了': 'p-ok',
  };
  return `<span class="pill ${map[s] || 'p-gray'}">${esc(s)}</span>`;
};
const avatar = (m, sm = true) => `<span class="av ${sm ? 'sm' : ''}" title="${esc(m.name)}">${esc(m.name[0])}</span>`;

// =============================================================
// 起動・シェル
// =============================================================
document.addEventListener('click', (e) => {
  const n = e.target.closest('[data-notion]');
  if (n) { e.preventDefault(); toast('デモ：実運用ではこのレコードの Notion ページが開きます'); }
});

function renderShell() {
  const u = me();
  $app.innerHTML = `
    <div class="demo-rib"><span>Demo</span>表示中の会社名・人名・金額はすべて架空のサンプルです。操作内容はこのブラウザにのみ保存されます。</div>
    <header class="bar">
      <div class="bar-in">
        <a class="brand" href="#/"><span class="mark" aria-hidden="true"></span><span class="name">F-IT Consul</span><span class="portal">Operations Portal</span></a>
        <div class="right">
          <button class="sync" id="sync" title="Notion と同期"><span class="n-logo">N</span><span class="dot"></span><span id="sync-t">Notion 同期済み</span></button>
          <select class="role" id="role" aria-label="表示ロール">
            ${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${k === S.role ? 'selected' : ''}>${r.label}</option>`).join('')}
          </select>
          <span class="who">${avatar(u, false)}<b>${esc(u.name)}</b></span>
        </div>
      </div>
      <nav class="nav" id="nav"></nav>
    </header>
    <main class="wrap" id="view"></main>
    <footer class="foot"><span class="foot-big">F-IT Consul</span><span>業務ポータル — Notion 連携デモ</span></footer>`;

  document.getElementById('role').addEventListener('change', (e) => {
    S.role = e.target.value; save();
    renderShell(); route();
    toast(`${ROLES[S.role].label}に切り替えました（権限により表示が変わります）`);
  });
  document.getElementById('sync').addEventListener('click', () => {
    const b = document.getElementById('sync');
    b.classList.add('busy'); document.getElementById('sync-t').textContent = '同期中…';
    setTimeout(() => {
      b.classList.remove('busy'); document.getElementById('sync-t').textContent = 'Notion 同期済み';
      S.lastSync = Date.now(); save();
      toast('Notion の 7 データベースと同期しました');
    }, 900);
  });
}

const NAV = [
  ['#/', 'home', 'ホーム', '01', 'Overview'],
  ['#/orders', 'order', '受発注', '02', 'Orders'],
  ['#/projects', 'folder', '案件管理', '03', 'Projects'],
  ['#/cost', 'yen', '原価・収支', '04', 'Cost & Margin'],
  ['#/timesheet', 'clock', '工数入力', '05', 'Timesheet'],
  ['#/resource', 'users', '稼働・アサイン', '06', 'Resources'],
  ['#/notion', 'db', 'Notion構成', '07', 'Architecture'],
];
function navItems() {
  const items = NAV;
  return items.filter(([h]) => canMoney() || !['#/orders', '#/cost'].includes(h));
}

// ページ遷移：いまの画面をふわっと沈めてから、次の画面を浮かび上がらせる
let firstRoute = true;
function route() {
  const v = view();
  if (firstRoute || FX.reduced) { firstRoute = false; return paint(); }
  v.classList.add('leaving');
  setTimeout(paint, 260);
}
function paint() {
  const hash = location.hash || '#/';
  const key = '#/' + (hash.split('/')[1] || '');
  const nav = document.getElementById('nav');
  nav.innerHTML = navItems().map(([h, ic, t, rn]) => `<a href="${h}" class="${h === key ? 'on' : ''}"><span class="rn">${rn}</span>${t}</a>`).join('');
  window.scrollTo(0, 0);
  const v = view();
  v.classList.remove('leaving');
  dispatch(hash, key);
  // 見出しの上に「番号 — 英字ラベル」を添える
  const n = NAV.find(([h]) => h === key);
  const head = v.querySelector('.head-row');
  if (n && head) head.insertAdjacentHTML('beforebegin', `<div class="eyebrow"><span>${n[3]}</span>${n[4]}</div>`);
  FX.reveal(v);
  FX.orb(v.querySelector('.orb'));
}
function dispatch(hash, key) {
  if (!canMoney() && (key === '#/orders' || key === '#/cost')) return renderDenied();
  if (hash.startsWith('#/orders')) return renderOrders();
  if (hash.startsWith('#/projects/')) return renderProject(hash.split('/')[2]);
  if (hash.startsWith('#/projects')) return renderProjects();
  if (hash.startsWith('#/cost')) return renderCost();
  if (hash.startsWith('#/timesheet')) return renderTimesheet();
  if (hash.startsWith('#/resource')) return renderResource();
  if (hash.startsWith('#/notion')) return renderNotion();
  return renderHome();
}
const view = () => document.getElementById('view');

function renderDenied() {
  view().innerHTML = `<div class="empty" style="margin-top:30px">このページは権限により表示できません。<br>（メンバーには受発注・原価の金額情報を見せない設定の例です）</div>`;
}

// =============================================================
// ホーム
// =============================================================
function renderHome() {
  const u = me();
  const orders = allOrders();
  const mon = monthly();
  const cur = mon[CUR];
  const backlog = sum(orders.filter((o) => ['受注確定', '納品・検収'].includes(o.status)), (o) => o.amount);
  const pipeline = sum(orders.filter((o) => o.status === '見積中'), (o) => o.amount * (o.prob || 50) / 100);
  const active = PROJECTS.filter((p) => ['進行中', '検収待ち'].includes(p.status));
  const costs = Object.fromEntries(PROJECTS.map((p) => [p.id, projectCost(p)]));
  const rev = sum(active, (p) => costs[p.id].revenue), mg = sum(active, (p) => costs[p.id].margin);
  const util = sum(MEMBERS, (m) => memberMonthHours(m.id, CUR)) / (MEMBERS.length * CAPACITY * CUR_FRAC);
  const myProjects = PROJECTS.filter((p) => p.alloc[u.id] && p.status !== '完了');
  const myHours = memberMonthHours(u.id, CUR);

  // やること（ロール別）
  const todos = [];
  if (canMoney()) {
    PROJECTS.forEach((p) => {
      const r = riskOf(costs[p.id], p);
      if (r && r.label === '原価超過リスク')
        todos.push({ cls: 'no', ic: '!', t: `「${p.name}」の着地原価が予算の ${pct(costs[p.id].fcRatio)}`, s: '原価・収支で内訳を確認', href: `#/projects/${p.id}` });
    });
    orders.filter((o) => o.status === '納品・検収').forEach((o) =>
      todos.push({ cls: 'wait', ic: '¥', t: `請求待ち：${o.title}`, s: `${byId(CLIENTS, o.client).name} ／ ${yen(o.amount)}`, href: '#/orders' }));
  }
  const noEntry = MEMBERS.filter((m) => memberMonthHours(m.id, CUR) < 20).length;
  if (S.role !== 'member' && noEntry) todos.push({ cls: 'info', ic: 'i', t: `今月の工数が少ないメンバーが ${noEntry} 名います`, s: '稼働・アサインで確認', href: '#/resource' });
  if (S.role === 'member') {
    const week = sum(Object.values(S.timesheet), (a) => sum(a));
    todos.push(week
      ? { cls: 'info', ic: '✓', t: `今週の工数 ${week}h を入力済み`, s: '修正は工数入力から', href: '#/timesheet' }
      : { cls: 'wait', ic: '!', t: '今週の工数が未入力です', s: '工数入力へ', href: '#/timesheet' });
  }
  NEWS.forEach((n) => todos.push({ cls: n.important ? 'no' : 'info', ic: n.important ? '!' : 'i', t: n.title, s: n.cat, href: '#/' }));

  // 自分に関係する直近の未完了マイルストーン
  const nextMs = PROJECTS.filter((p) => (S.role === 'exec' || p.alloc[u.id] || p.pm === u.id) && p.status !== '完了')
    .flatMap((p) => p.milestones.map(([t, m, done], i) => ({ p, t, m, done: `${p.id}:${i}` in S.milestones ? S.milestones[`${p.id}:${i}`] : done })))
    .filter((x) => !x.done && x.m >= CUR).sort((a, b) => a.m - b.m)[0];
  const quick = canMoney()
    ? [['#/orders', 'plus', '見積を登録'], ['#/cost', 'yen', '収支を確認'], ['#/resource', 'users', '空きリソース']]
    : [['#/timesheet', 'clock', '工数を入力'], ['#/projects', 'folder', '担当案件']];
  const heroStats = canMoney()
    ? [['今月の請求予定', man(cur.revenue), '万円'], ['受注残', man(backlog), '万円'], ['見込（確度加重）', man(pipeline), '万円']]
    : [['担当案件', myProjects.length, '件'], ['今月の工数', myHours, 'h'], ['稼働率', Math.round(myHours / (CAPACITY * CUR_FRAC) * 100), '%']];

  view().innerHTML = `
    <div class="home-top">
      <section class="hero">
        <canvas class="orb" aria-hidden="true"></canvas>
        <div class="h-eyebrow"><span>01</span>Overview</div>
        <div class="h-greet">${greeting()}、<br>${esc(u.name)} さん</div>
        <div class="h-sub">${esc(longDateStr())} ／ ${esc(ROLES[S.role].title)}</div>
        <div class="h-stats">${heroStats.map(([k, v, s]) => `<div class="h-stat"><div class="k">${k}</div><div class="v num">${v}<small>${s}</small></div></div>`).join('')}</div>
        ${nextMs ? `<div class="h-next">次のマイルストーン：<b>${esc(nextMs.p.name)}</b> ／ ${esc(nextMs.t)}（${monthLabel(nextMs.m, true)}）</div>` : ''}
        <div class="h-acts">${quick.map(([h, ic, t]) => `<a href="${h}">${svg(ic)}${t}</a>`).join('')}</div>
      </section>
      <aside class="side">
        <div class="side-head">${svg('bell')}<span class="t">今日のやること</span><span class="c">${todos.length} 件</span></div>
        <div class="todo">${todos.slice(0, 4).map((t) => `
          <a href="${t.href}"><span class="ic ${t.cls}">${t.ic}</span><span><div>${esc(t.t)}</div><div class="s">${esc(t.s)}</div></span></a>`).join('')}
        </div>
      </aside>
    </div>

    ${canMoney() ? `
    <div class="kpis">
      <div class="kpi"><div class="k">進行中案件の受注総額</div><div class="v num">${man(rev)}<small>万円</small></div><div class="d">${active.length} 案件</div></div>
      <div class="kpi"><div class="k">見込粗利率（着地ベース）</div><div class="v num">${pct(mg / rev)}</div><div class="d">見込粗利 ${man(mg)} 万円</div></div>
      <div class="kpi"><div class="k">今月の原価（労務＋外注）</div><div class="v num">${man(cur.cost)}<small>万円</small></div><div class="d">${Math.round(CUR_FRAC * 100)}% 経過時点</div></div>
      <div class="kpi"><div class="k">全体稼働率（今月）</div><div class="v num">${pct(util)}</div><div class="d">目標 80〜90%</div></div>
    </div>` : ''}

    <div class="mod-grid" id="grid"></div>`;

  const modules = [
    { h: '#/orders', icon: 'order', color: 'm-blue', title: '受発注管理', desc: '見積→受注→納品→請求→入金をカンバンで。外注発注もここで。', db: '受注DB・発注DB', money: true },
    { h: '#/projects', icon: 'folder', color: 'm-teal', title: '案件管理', desc: '進捗・マイルストーン・担当・関連する受発注を1画面に。', db: '案件DB' },
    { h: '#/cost', icon: 'yen', color: 'm-amber', title: '原価・収支', desc: '人件費×工数＋外注費で案件別の原価と着地粗利を自動計算。', db: '工数DB × メンバーDB', money: true },
    { h: '#/timesheet', icon: 'clock', color: 'm-green', title: '工数入力', desc: '週単位で案件ごとの作業時間を入力。スマホからもOK。', db: '工数DB' },
    { h: '#/resource', icon: 'users', color: 'm-violet', title: '稼働・アサイン', desc: 'メンバーごとの稼働率を月別に可視化。空き・過負荷が一目で。', db: 'メンバーDB' },
    { h: '#/notion', icon: 'db', color: 'm-ink', title: 'Notion構成', desc: 'このポータルの裏側にある Notion データベース設計。', db: '7 データベース' },
  ].filter((m) => canMoney() || !m.money);
  const grid = document.getElementById('grid');
  modules.forEach((m) => {
    const b = document.createElement('button');
    b.className = `mod ${m.color}`;
    b.innerHTML = `<span class="mod-ico">${svg(m.icon)}</span>
      <span><div class="mod-title">${m.title}</div><div class="mod-desc">${m.desc}</div>
      <div class="mod-db">${svg('db').replace('<svg', '<svg width="12" height="12"')}Notion：${m.db}</div></span>`;
    b.addEventListener('click', () => (location.hash = m.h));
    grid.appendChild(b);
  });
}

// =============================================================
// 受発注
// =============================================================
let orderTab = 'orders';
function renderOrders() {
  const orders = allOrders();
  view().innerHTML = `
    <div class="head-row">
      <h1>受発注管理</h1><span class="sub">カードをドラッグ、または「次へ」でステータス更新 → Notion に即反映</span>
      <div class="tools">
        <div class="seg" id="otab">
          <button data-v="orders" aria-pressed="${orderTab === 'orders'}">受注</button>
          <button data-v="purchases" aria-pressed="${orderTab === 'purchases'}">発注（外注・仕入）</button>
        </div>
        ${orderTab === 'orders' ? `<button class="btn btn-primary" id="new-order">${svg('plus')}新規見積</button>` : ''}
      </div>
    </div>
    <div id="obody"></div>`;
  document.querySelectorAll('#otab button').forEach((b) => b.addEventListener('click', () => { orderTab = b.dataset.v; renderOrders(); }));
  document.getElementById('new-order')?.addEventListener('click', openNewOrder);

  const body = document.getElementById('obody');
  if (orderTab === 'orders') {
    // 月額契約は直近分のみカンバンに表示
    const visible = orders.filter((o) => !o.recurring || o.bill >= CUR - 1);
    const kpi = ORDER_FLOW.map((s) => [s, visible.filter((o) => o.status === s)]);
    body.innerHTML = `
      <div class="kpis k5">
        ${kpi.map(([s, l]) => `<div class="kpi"><div class="k">${s}</div><div class="v num">${man(sum(l, (o) => o.amount))}<small>万円</small></div><div class="d">${l.length} 件</div></div>`).join('')}
      </div>
      ${kanban(visible, ORDER_FLOW, 'order')}
      <p class="muted" style="margin-top:10px">※ 保守・準委任の月額契約は毎月の受注レコードを自動生成（直近2か月分を表示）。</p>`;
  } else {
    const pur = allPurchases();
    body.innerHTML = `${kanban(pur, PURCHASE_FLOW, 'purchase')}
      <p class="muted" style="margin-top:10px">※「発注済」以降の金額は、紐づく案件の原価（外注費）に自動で計上されます。</p>`;
  }
  bindKanban();
}
function kanban(items, flow, kind) {
  return `<div class="kanban" style="grid-template-columns:repeat(${flow.length}, minmax(200px,1fr))">${flow.map((s) => {
    const list = items.filter((x) => x.status === s);
    return `<div class="col" data-status="${s}" data-kind="${kind}">
      <div class="col-h">${statusPill(s)}<span class="cnt">${list.length}</span><span class="sum num">${man(sum(list, (x) => x.amount))}万</span></div>
      ${list.map((x) => kcard(x, flow, kind)).join('') || '<div class="muted" style="padding:6px 4px;font-size:12px">なし</div>'}
    </div>`;
  }).join('')}</div>`;
}
function kcard(x, flow, kind) {
  const p = x.project ? byId(PROJECTS, x.project) : null;
  const sub = kind === 'order' ? byId(CLIENTS, x.client)?.name : x.vendor;
  const last = flow.indexOf(x.status) === flow.length - 1;
  const when = kind === 'order' ? `請求 ${monthLabel(x.bill, true)}` : monthLabel(x.month, true);
  return `<div class="kcard" draggable="true" data-id="${x.id}" data-kind="${kind}">
    <div class="kt">${esc(x.title)}</div>
    <div class="kc">${esc(sub || '')}</div>
    <div class="kc">${p ? `<a href="#/projects/${p.id}">${esc(p.code)}</a>` : '<span class="pill p-gray">案件未作成</span>'} · ${when}${x.prob ? ` · 確度${x.prob}%` : ''}</div>
    <div class="kf"><span class="t-sub">${esc(x.no)}</span><span class="ka">${yen(x.amount)}</span></div>
    ${last ? '' : `<div class="kf"><button class="next" data-next="${x.id}" data-kind="${kind}">次へ →</button></div>`}
  </div>`;
}
function setStatus(kind, id, status) {
  const flow = kind === 'order' ? ORDER_FLOW : PURCHASE_FLOW;
  if (!flow.includes(status)) return;
  if (kind === 'order') {
    const n = S.newOrders.find((o) => o.id === id);
    if (n) n.status = status; else S.orderStatus[id] = status;
  } else S.purchaseStatus[id] = status;
  save();
  toast(`ステータスを「${status}」に更新 → Notion に反映しました`);
  renderOrders();
}
function bindKanban() {
  document.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', () => {
    const kind = b.dataset.kind, id = b.dataset.next;
    const list = kind === 'order' ? allOrders() : allPurchases();
    const flow = kind === 'order' ? ORDER_FLOW : PURCHASE_FLOW;
    const cur = list.find((x) => x.id === id).status;
    setStatus(kind, id, flow[flow.indexOf(cur) + 1]);
  }));
  document.querySelectorAll('.kcard').forEach((c) => c.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: c.dataset.id, kind: c.dataset.kind }));
  }));
  document.querySelectorAll('.col').forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop'); });
    col.addEventListener('dragleave', () => col.classList.remove('drop'));
    col.addEventListener('drop', (e) => {
      e.preventDefault(); col.classList.remove('drop');
      try {
        const { id, kind } = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (kind === col.dataset.kind) setStatus(kind, id, col.dataset.status);
      } catch {}
    });
  });
}
function openNewOrder() {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="新規見積">
    <h3>新規見積を登録</h3>
    <div class="field"><label class="lbl" for="no-title">件名</label><input type="text" id="no-title" placeholder="例：在庫管理システム保守" /></div>
    <div class="field"><label class="lbl" for="no-client">顧客</label>
      <select class="in" id="no-client">${CLIENTS.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
    <div class="row3">
      <div class="field"><label class="lbl" for="no-amt">見積金額（税抜）</label><input type="number" id="no-amt" value="1200000" step="10000" /></div>
      <div class="field"><label class="lbl" for="no-prob">確度（%）</label><input type="number" id="no-prob" value="50" min="0" max="100" step="10" /></div>
      <div class="field"><label class="lbl" for="no-bill">請求予定</label>
        <select class="in" id="no-bill">${[6, 7, 8, 9].map((m) => `<option value="${m}">${monthLabel(m)}</option>`).join('')}</select></div>
    </div>
    <p class="note">登録すると Notion の「受注DB」にページが作成されます。受注確定時に「案件DB」へ自動でプロジェクトを起票する運用も可能です。</p>
    <div class="acts"><button class="btn btn-ghost" id="no-cancel">キャンセル</button><button class="btn btn-primary" id="no-save">登録</button></div>
  </div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  bg.querySelector('#no-cancel').addEventListener('click', close);
  bg.querySelector('#no-title').focus();
  bg.querySelector('#no-save').addEventListener('click', () => {
    const title = bg.querySelector('#no-title').value.trim();
    const amount = Number(bg.querySelector('#no-amt').value);
    if (!title || !amount) return toast('件名と金額を入力してください');
    const n = S.newOrders.length + 1;
    S.newOrders.push({ id: `N${Date.now()}`, no: `MI-${String(80 + n).padStart(4, '0')}`, project: null, client: bg.querySelector('#no-client').value,
      title, amount, status: '見積中', bill: Number(bg.querySelector('#no-bill').value), prob: Number(bg.querySelector('#no-prob').value) });
    save(); close(); orderTab = 'orders'; renderOrders();
    toast('見積を登録しました → Notion「受注DB」に作成');
  });
}

// =============================================================
// 案件一覧・詳細
// =============================================================
let projFilter = 'active';
function renderProjects() {
  const u = me();
  let list = PROJECTS.slice();
  if (projFilter === 'active') list = list.filter((p) => p.status !== '完了');
  if (projFilter === 'mine') list = list.filter((p) => p.alloc[u.id] || p.pm === u.id);
  const money = canMoney();
  view().innerHTML = `
    <div class="head-row"><h1>案件管理</h1><span class="sub">行をクリックで詳細（Notion のページに相当）</span>
      <div class="tools"><div class="seg" id="pf">
        ${[['active', '進行中'], ['mine', '自分の担当'], ['all', 'すべて']].map(([v, t]) => `<button data-v="${v}" aria-pressed="${projFilter === v}">${t}</button>`).join('')}
      </div></div></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>案件</th><th>顧客</th><th>種別</th><th>PM</th><th>メンバー</th><th>ステータス</th><th>進捗</th>
        ${money ? '<th class="r">受注額</th><th class="r">原価消化</th><th>判定</th>' : '<th>期間</th>'}</tr></thead>
      <tbody>${list.map((p) => {
        const c = projectCost(p), r = riskOf(c, p);
        const team = Object.keys(p.alloc).map((id) => byId(MEMBERS, id));
        return `<tr class="click" data-href="#/projects/${p.id}">
          <td><div class="t-title">${esc(p.name)}</div><div class="t-sub">${esc(p.code)}</div></td>
          <td>${esc(byId(CLIENTS, p.client).name)}</td><td>${esc(p.type)}</td>
          <td>${esc(byId(MEMBERS, p.pm).name)}</td>
          <td style="white-space:nowrap">${team.map((m) => avatar(m)).join('')}</td>
          <td>${statusPill(p.status)}</td>
          <td><div class="prog"><div class="bar-t" style="width:80px"><i style="width:${p.progress}%"></i></div><span class="pv">${p.progress}%</span></div></td>
          ${money ? `<td class="r">${c.revenue ? yen(c.revenue) : '—'}</td>
            <td class="r">${p.budget ? pct(c.burn) : '—'}</td>
            <td>${r ? `<span class="pill ${r.cls}">${r.label}</span>` : '—'}</td>`
          : `<td class="num" style="white-space:nowrap">${monthLabel(p.months[0], true)}〜${monthLabel(p.months[1], true)}</td>`}
        </tr>`;
      }).join('') || `<tr><td colspan="10"><div class="empty">該当する案件はありません</div></td></tr>`}</tbody>
    </table></div>`;
  document.querySelectorAll('#pf button').forEach((b) => b.addEventListener('click', () => { projFilter = b.dataset.v; renderProjects(); }));
  document.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => (location.hash = tr.dataset.href)));
}

function renderProject(id) {
  const p = byId(PROJECTS, id);
  if (!p) return (location.hash = '#/projects');
  const c = projectCost(p), r = riskOf(c, p), money = canMoney();
  const orders = allOrders().filter((o) => o.project === p.id);
  const purs = allPurchases().filter((x) => x.project === p.id);
  const max = Math.max(p.budget, c.forecast, c.actual) || 1;
  const w = (v) => `${Math.min(100, (v / max) * 100)}%`;

  view().innerHTML = `
    <a class="btn btn-ghost btn-sm" href="#/projects" style="margin-bottom:14px">← 案件一覧</a>
    <div class="head-row"><h1>${esc(p.name)}</h1>${statusPill(p.status)}${r && money ? `<span class="pill ${r.cls}">${r.label}</span>` : ''}
      <div class="tools">${notionLink()}</div></div>
    ${money && r && r.label === '原価超過リスク' ? `<div class="alert-row">${svg('alert').replace('<svg', '<svg width="18" height="18"')}
      現在のペースだと原価が予算を ${yen(c.forecast - p.budget)} 超過する見込みです（着地見込 ${yen(c.forecast)} ／ 予算 ${yen(p.budget)}）</div>` : ''}
    <div class="grid-32">
      <div class="stack">
        <div class="card">
          <div class="props">
            <span class="k">${svg('tag')}案件コード</span><span class="v">${esc(p.code)}</span>
            <span class="k">${svg('link')}顧客</span><span class="v">${esc(byId(CLIENTS, p.client).name)}</span>
            <span class="k">${svg('folder')}種別</span><span class="v">${esc(p.type)}</span>
            <span class="k">${svg('person')}PM</span><span class="v">${esc(byId(MEMBERS, p.pm).name)}</span>
            <span class="k">${svg('cal')}期間</span><span class="v num">${monthLabel(p.months[0])} 〜 ${monthLabel(p.months[1])}</span>
            <span class="k">${svg('status')}進捗</span><span class="v"><div class="prog"><div class="bar-t" style="width:160px"><i style="width:${p.progress}%"></i></div><span class="pv">${p.progress}%</span></div></span>
          </div>
        </div>
        ${money ? `
        <div class="card">
          <div class="card-head"><h2>予算 vs 原価</h2><span class="r legend"><span><i style="background:var(--s2)"></i>実績原価</span><span><i style="background:#f6b89c"></i>着地見込</span><span><i style="background:var(--ink);width:3px"></i>予算</span></span></div>
          <div class="bc">
            <div class="bc-row"><span class="lb">実績原価</span><div class="bc-track"><i style="width:${w(c.actual)};background:var(--s2)"></i>${p.budget ? `<span class="budget-line" style="left:${w(p.budget)}"></span>` : ''}</div><span class="val">${yen(c.actual)}</span></div>
            <div class="bc-row"><span class="lb">着地見込</span><div class="bc-track"><i style="width:${w(c.forecast)};background:#f6b89c"></i>${p.budget ? `<span class="budget-line" style="left:${w(p.budget)}"></span>` : ''}</div><span class="val">${yen(c.forecast)}</span></div>
          </div>
          <div class="pd-meta" style="margin-top:14px">
            <div><div class="k">受注額</div><div class="v num">${c.revenue ? yen(c.revenue) : '—'}</div></div>
            <div><div class="k">予算原価</div><div class="v num">${p.budget ? yen(p.budget) : '—'}</div></div>
            <div><div class="k">見込粗利</div><div class="v num">${c.revenue ? yen(c.margin) : '—'}</div></div>
            <div><div class="k">見込粗利率</div><div class="v num">${c.revenue ? pct(c.marginRate) : '—'}</div></div>
          </div>
          <p class="muted" style="margin:12px 0 0">着地見込 = 実績原価 ÷ 進捗率。実績原価 = Σ(工数 × 原価単価) ＋ 外注費（発注済以降）。</p>
        </div>` : ''}
        <div class="card">
          <h2>メンバー別 工数${money ? '・原価' : ''}</h2>
          <div class="tbl-wrap"><table class="tbl" style="min-width:0">
            <thead><tr><th>メンバー</th><th>役割</th><th class="r">累計工数</th>${canRate() ? '<th class="r">原価単価</th>' : ''}${money ? '<th class="r">労務原価</th>' : ''}</tr></thead>
            <tbody>${Object.entries(c.byMember).map(([mid, v]) => { const m = byId(MEMBERS, mid); return `<tr>
              <td class="nm-cell">${avatar(m)} ${esc(m.name)}</td><td class="nm-cell">${esc(m.role)}</td><td class="r">${v.h.toLocaleString()} h</td>
              ${canRate() ? `<td class="r">${yen(m.cost)}/h</td>` : ''}${money ? `<td class="r">${yen(v.c)}</td>` : ''}</tr>`; }).join('')}
              ${money && c.outsource ? `<tr><td colspan="${canRate() ? 4 : 3}">外注費（発注DBより）</td><td class="r">${yen(c.outsource)}</td></tr>` : ''}
            </tbody>
            ${money ? `<tfoot><tr><td colspan="${canRate() ? 4 : 3}">合計</td><td class="r">${yen(c.actual)}</td></tr></tfoot>` : ''}
          </table></div>
        </div>
      </div>
      <div class="stack">
        <div class="card">
          <h2>マイルストーン</h2>
          <ul class="ms">${p.milestones.map(([t, m, done], i) => {
            const k = `${p.id}:${i}`; const d = k in S.milestones ? S.milestones[k] : done;
            return `<li><button class="ck ${d ? 'done' : ''}" data-ms="${k}" aria-label="${esc(t)} を${d ? '未完了' : '完了'}にする" style="cursor:pointer;background:${d ? '' : 'transparent'}">${d ? '✓' : ''}</button>
              <span style="${d ? 'color:var(--muted);text-decoration:line-through' : ''}">${esc(t)}</span><span class="dt">${monthLabel(m, true)}</span></li>`;
          }).join('')}</ul>
        </div>
        ${money ? `
        <div class="card">
          <h2>関連する受注</h2>
          ${orders.filter((o) => !o.recurring || o.bill >= CUR - 1).map((o) => `<div style="display:flex;gap:8px;align-items:center;padding:7px 0;border-bottom:1px dashed var(--line);font-size:13px">
            <span style="flex:1;min-width:0">${esc(o.title)}</span>${statusPill(o.status)}<span class="num" style="font-weight:700">${yen(o.amount)}</span></div>`).join('') || '<div class="muted">なし</div>'}
        </div>
        <div class="card">
          <h2>関連する発注</h2>
          ${purs.map((x) => `<div style="display:flex;gap:8px;align-items:center;padding:7px 0;border-bottom:1px dashed var(--line);font-size:13px">
            <span style="flex:1;min-width:0">${esc(x.title)}<div class="t-sub">${esc(x.vendor)}</div></span>${statusPill(x.status)}<span class="num" style="font-weight:700">${yen(x.amount)}</span></div>`).join('') || '<div class="muted">なし</div>'}
        </div>` : ''}
      </div>
    </div>`;
  document.querySelectorAll('[data-ms]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.ms; const [pid, i] = k.split(':');
    const cur = k in S.milestones ? S.milestones[k] : byId(PROJECTS, pid).milestones[i][2];
    S.milestones[k] = !cur; save(); renderProject(pid);
    toast('マイルストーンを更新 → Notion に反映しました');
  }));
}

// =============================================================
// 原価・収支
// =============================================================
function renderCost() {
  const list = PROJECTS.filter((p) => p.status !== '提案中');
  const rows = list.map((p) => ({ p, c: projectCost(p) }));
  const tot = (f) => sum(rows, (x) => f(x.c));
  const mon = monthly();

  view().innerHTML = `
    <div class="head-row"><h1>原価・収支</h1><span class="sub">工数 × 原価単価 ＋ 外注費 を案件ごとに自動集計</span></div>
    <div class="card" style="margin-bottom:18px">
      <div class="card-head"><h2>月次 売上（請求ベース）と原価</h2>
        <span class="r legend"><span><i style="background:var(--s1)"></i>売上</span><span><i style="background:var(--s2)"></i>原価（労務＋外注）</span></span></div>
      <div class="chart" id="chart"></div>
      <details style="margin-top:10px"><summary class="muted" style="cursor:pointer">表で見る</summary>
        <div class="tbl-wrap" style="margin-top:8px"><table class="tbl" style="min-width:0">
          <thead><tr><th>月</th><th class="r">売上</th><th class="r">原価</th><th class="r">差額</th></tr></thead>
          <tbody>${mon.map((x) => `<tr><td>${monthLabel(x.m)}${x.m === CUR ? '（途中）' : ''}</td><td class="r">${yen(x.revenue)}</td><td class="r">${yen(x.cost)}</td><td class="r">${yen(x.revenue - x.cost)}</td></tr>`).join('')}</tbody>
        </table></div></details>
      <p class="muted" style="margin:8px 0 0">受託開発は検収・請求月に売上が立つため月ごとの凹凸が出ます。案件別の着地粗利で判断するのが本ポータルの狙いです。</p>
    </div>
    <div class="card">
      <div class="card-head"><h2>案件別 収支（着地見込）</h2><span class="r">${notionLink('Notion のビューで開く')}</span></div>
      <div class="tbl-wrap"><table class="tbl" style="min-width:1080px">
        <thead><tr><th style="min-width:190px">案件</th><th class="r">受注額</th><th class="r">予算原価</th><th class="r">労務原価</th><th class="r">外注費</th><th class="r">実績原価</th><th>予算消化</th><th class="r">着地見込</th><th class="r">見込粗利率</th><th>判定</th></tr></thead>
        <tbody>${rows.map(({ p, c }) => { const r = riskOf(c, p); return `<tr class="click" data-href="#/projects/${p.id}">
          <td><div class="t-title">${esc(p.name)}</div><div class="t-sub">${esc(p.code)} · ${statusPill(p.status)}</div></td>
          <td class="r">${yen(c.revenue)}</td><td class="r">${yen(p.budget)}</td><td class="r">${yen(c.labor)}</td><td class="r">${yen(c.outsource)}</td>
          <td class="r"><b>${yen(c.actual)}</b></td>
          <td><div class="prog"><div class="bar-t ${c.burn > 1 ? 'over' : c.burn > p.progress / 100 + 0.1 ? 'warn' : ''}" style="width:80px"><i style="width:${Math.min(100, c.burn * 100)}%"></i></div><span class="pv">${pct(c.burn)}</span></div>
            <div class="t-sub">進捗 ${p.progress}%</div></td>
          <td class="r">${yen(c.forecast)}</td>
          <td class="r"><b>${pct(c.marginRate)}</b></td>
          <td>${r ? `<span class="pill ${r.cls}">${r.label}</span>` : ''}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><td>合計</td><td class="r">${yen(tot((c) => c.revenue))}</td><td class="r">${yen(sum(list, (p) => p.budget))}</td>
          <td class="r">${yen(tot((c) => c.labor))}</td><td class="r">${yen(tot((c) => c.outsource))}</td><td class="r">${yen(tot((c) => c.actual))}</td><td></td>
          <td class="r">${yen(tot((c) => c.forecast))}</td><td class="r">${pct(tot((c) => c.margin) / tot((c) => c.revenue))}</td><td></td></tr></tfoot>
      </table></div>
      <p class="muted" style="margin:10px 0 0">判定：着地見込が予算の 95% 超で「要注意」、110% 超で「原価超過リスク」。しきい値は自由に設定できます。</p>
    </div>`;
  document.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => (location.hash = tr.dataset.href)));
  drawBarChart(document.getElementById('chart'), mon);
}

function drawBarChart(el, data) {
  const W = 720, H = 240, L = 52, B = 26, T = 10;
  const max = Math.max(...data.flatMap((d) => [d.revenue, d.cost])) * 1.1;
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const gw = (W - L) / data.length, bw = Math.min(26, gw / 3.2);
  let g = '';
  for (let v = 0; v <= top; v += step)
    g += `<line class="grid-l" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${man(v)}万</text>`;
  const bar = (x, v, color) => {
    const h = Math.max(0, y(0) - y(v)), r = Math.min(4, h);
    return `<path d="M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + bw - r} Q${x + bw},${y(v)} ${x + bw},${y(v) + r} V${y(0)} Z" fill="${color}"/>`;
  };
  data.forEach((d, i) => {
    const cx = L + gw * i + gw / 2;
    g += `<g class="grp" data-i="${i}">
      <rect x="${L + gw * i}" y="${T}" width="${gw}" height="${H - T - B}" fill="transparent"/>
      ${bar(cx - bw - 1, d.revenue, 'var(--s1)')}${bar(cx + 1, d.cost, 'var(--s2)')}
      <text class="ax" x="${cx}" y="${H - 8}" text-anchor="middle">${monthLabel(d.m, true)}${d.m === CUR ? '*' : ''}</text></g>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="月次の売上と原価の棒グラフ">${g}</svg><div class="tip" id="tip"></div>`;
  const tip = el.querySelector('#tip');
  el.querySelectorAll('.grp').forEach((gr) => {
    gr.addEventListener('mousemove', (e) => {
      const d = data[gr.dataset.i]; const box = el.getBoundingClientRect();
      tip.innerHTML = `<b>${monthLabel(d.m)}${d.m === CUR ? '（途中）' : ''}</b><br><i style="background:var(--s1)"></i>売上 ${yen(d.revenue)}<br><i style="background:var(--s2)"></i>原価 ${yen(d.cost)}<br>差額 ${yen(d.revenue - d.cost)}`;
      const x = e.clientX - box.left, yy = e.clientY - box.top;
      tip.style.left = Math.min(x + 14, box.width - 190) + 'px'; tip.style.top = Math.max(0, yy - 70) + 'px';
      tip.classList.add('show');
    });
    gr.addEventListener('mouseleave', () => tip.classList.remove('show'));
  });
}
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw);
}

// =============================================================
// 工数入力
// =============================================================
function renderTimesheet() {
  const u = me();
  const own = S.role === 'member';
  const mon = new Date(NOW); mon.setDate(NOW.getDate() - ((NOW.getDay() + 6) % 7));
  const days = [...Array(7)].map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  const projects = PROJECTS.filter((p) => p.alloc[ROLES.member.user] && p.status !== '完了' && p.months[1] >= CUR);
  const ts = S.timesheet;

  // 入力状況（PM/経営向け）
  const status = MEMBERS.map((m) => ({ m, h: memberMonthHours(m.id, CUR) }));

  view().innerHTML = `
    <div class="head-row"><h1>工数入力</h1><span class="sub">入力は Notion「工数DB」に 1日×案件 = 1レコードで登録されます</span></div>
    <div class="card" style="margin-bottom:18px">
      <div class="card-head"><h2>${own ? '今週の工数' : `今週の工数（${esc(byId(MEMBERS, ROLES.member.user).name)} さんの入力画面の例）`}</h2>
        <span class="r muted num">${days[0].getMonth() + 1}/${days[0].getDate()} 〜 ${days[6].getMonth() + 1}/${days[6].getDate()}</span></div>
      <div style="overflow-x:auto"><table class="ts">
        <thead><tr><th class="pj">案件</th>${days.map((d, i) => `<th class="${i > 4 ? 'we' : ''}">${d.getMonth() + 1}/${d.getDate()}<br>${WEEK[d.getDay()]}</th>`).join('')}<th>合計</th></tr></thead>
        <tbody>${projects.map((p) => `<tr><td class="pj"><div class="t-title">${esc(p.name)}</div><div class="t-sub">${esc(p.code)}</div></td>
          ${days.map((_, i) => `<td class="${i > 4 ? 'we' : ''}"><input type="number" min="0" max="24" step="0.5" data-p="${p.id}" data-d="${i}" value="${(ts[p.id] || [])[i] || ''}" aria-label="${esc(p.name)} ${WEEK[days[i].getDay()]}曜" ${own ? '' : 'disabled'} /></td>`).join('')}
          <td class="tot" data-rt="${p.id}">0</td></tr>`).join('')}</tbody>
        <tfoot><tr><td class="pj">日計</td>${days.map((_, i) => `<td class="tot" data-ct="${i}">0</td>`).join('')}<td class="tot" id="gt">0</td></tr></tfoot>
      </table></div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap">
        ${own ? `<button class="btn btn-primary" id="ts-save">Notion に登録</button><button class="btn btn-ghost" id="ts-fill">標準パターンで埋める</button>`
              : '<span class="note">右上のロールを「メンバービュー」に切り替えると入力を試せます。</span>'}
        <span class="muted" id="ts-hint"></span>
      </div>
    </div>
    ${own ? '' : `
    <div class="card">
      <div class="card-head"><h2>今月の工数入力状況</h2><span class="r muted">標準 ${Math.round(CAPACITY * CUR_FRAC)}h（本日時点）</span></div>
      <div class="tbl-wrap"><table class="tbl" style="min-width:560px">
        <thead><tr><th>メンバー</th><th>役割</th><th class="r">入力済み工数</th><th>対 標準</th><th>状態</th></tr></thead>
        <tbody>${status.map(({ m, h }) => { const r = h / (CAPACITY * CUR_FRAC); return `<tr><td>${avatar(m)} ${esc(m.name)}</td><td>${esc(m.role)}</td><td class="r">${h} h</td>
          <td><div class="prog"><div class="bar-t ${r < 0.5 ? 'warn' : ''}" style="width:120px"><i style="width:${Math.min(100, r * 100)}%"></i></div><span class="pv">${pct(r)}</span></div></td>
          <td>${r < 0.5 ? '<span class="pill p-wait">入力少なめ</span>' : '<span class="pill p-ok">OK</span>'}</td></tr>`; }).join('')}</tbody>
      </table></div>
      <p class="muted" style="margin:10px 0 0">「入力少なめ」のメンバーには LINE / Slack / メールで自動リマインドを送る運用も可能です。</p>
    </div>`}`;

  const recalc = () => {
    let gt = 0; const ct = Array(7).fill(0);
    projects.forEach((p) => {
      const vals = [...document.querySelectorAll(`input[data-p="${p.id}"]`)].map((i) => Number(i.value) || 0);
      vals.forEach((v, i) => (ct[i] += v));
      const t = sum(vals); gt += t;
      document.querySelector(`[data-rt="${p.id}"]`).textContent = t;
    });
    ct.forEach((v, i) => (document.querySelector(`[data-ct="${i}"]`).textContent = v));
    document.getElementById('gt').textContent = gt;
    const hint = document.getElementById('ts-hint');
    if (hint) hint.textContent = ct.some((v) => v > 10) ? '※ 1日10時間を超える日があります' : '';
  };
  document.querySelectorAll('.ts input').forEach((i) => i.addEventListener('input', recalc));
  recalc();
  document.getElementById('ts-fill')?.addEventListener('click', () => {
    const pat = { P1: [5, 5, 4, 5, 5, 0, 0], P2: [3, 3, 4, 3, 3, 0, 0] };
    document.querySelectorAll('.ts input').forEach((i) => (i.value = (pat[i.dataset.p] || [])[i.dataset.d] || ''));
    recalc();
  });
  document.getElementById('ts-save')?.addEventListener('click', () => {
    const next = {}; let n = 0;
    document.querySelectorAll('.ts input').forEach((i) => {
      const v = Number(i.value) || 0;
      (next[i.dataset.p] = next[i.dataset.p] || Array(7).fill(0))[i.dataset.d] = v;
      if (v) n++;
    });
    S.timesheet = next; save();
    toast(n ? `工数 ${n} 件を Notion「工数DB」に登録しました（原価に即反映）` : '工数をクリアしました');
  });
}

// =============================================================
// 稼働・アサイン
// =============================================================
function renderResource() {
  const months = [0, 1, 2, 3, 4, 5];
  // 稼働率（sequential：単色の明→暗）
  const ramp = ['#eaf1f8', '#cfe2f3', '#9cc8ea', '#5aa7dc', '#1f82c8', '#0b5a98'];
  const cell = (r) => {
    const i = r >= 1.05 ? 5 : r >= 0.9 ? 4 : r >= 0.75 ? 3 : r >= 0.5 ? 2 : r > 0 ? 1 : 0;
    return `background:${ramp[i]};color:${i >= 4 ? '#fff' : 'var(--ink)'}`;
  };
  const util = (mid, m) => memberMonthHours(mid, m) / (CAPACITY * (m === CUR ? CUR_FRAC : 1));
  // 来月の計画（アサイン計画）
  const nextPlan = (mid) => sum(PROJECTS.filter((p) => p.months[0] <= CUR + 1 && p.months[1] >= CUR + 1 && p.status !== '完了'), (p) => p.alloc[mid] || 0);

  view().innerHTML = `
    <div class="head-row"><h1>稼働・アサイン</h1><span class="sub">案件工数 ÷ 標準${CAPACITY}h。空いている人・詰まっている人が一目で分かります</span></div>
    <div class="card" style="margin-bottom:18px">
      <h2>メンバー別 稼働率（月別）</h2>
      <div style="overflow-x:auto"><table class="heat">
        <thead><tr><th class="nm">メンバー</th>${months.map((m) => `<th>${monthLabel(m, true)}${m === CUR ? '*' : ''}</th>`).join('')}<th>${monthLabel(CUR + 1, true)}（計画）</th></tr></thead>
        <tbody>${MEMBERS.map((mb) => `<tr><td class="nm">${avatar(mb)} ${esc(mb.name)} <span class="t-sub">${esc(mb.role)}</span></td>
          ${months.map((m) => { const r = util(mb.id, m); return `<td class="c" style="${cell(r)}" title="${esc(mb.name)} ${monthLabel(m)}：${memberMonthHours(mb.id, m)}h">${r ? Math.round(r * 100) + '%' : '—'}</td>`; }).join('')}
          ${(() => { const r = nextPlan(mb.id) / CAPACITY; return `<td class="c" style="${cell(r)};outline:1.5px dashed var(--line-strong);outline-offset:-2px">${r ? Math.round(r * 100) + '%' : '空き'}</td>`; })()}
        </tr>`).join('')}</tbody>
      </table></div>
      <div class="heat-legend">稼働率：${['0%', '〜50%', '50〜75%', '75〜90%', '90〜105%', '105%〜'].map((t, i) => `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:8px"><i style="background:${ramp[i]}"></i>${t}</span>`).join('')}
        <span>＊当月は本日までの経過分で換算</span></div>
    </div>
    <div class="card">
      <h2>メンバー一覧（Notion メンバーDB）</h2>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>メンバー</th><th>役割</th><th>スキル</th><th>参加中の案件</th>${canRate() ? '<th class="r">原価単価</th>' : ''}<th class="r">来月の空き</th></tr></thead>
        <tbody>${MEMBERS.map((mb) => { const pj = PROJECTS.filter((p) => p.alloc[mb.id] && p.status !== '完了'); const free = Math.max(0, CAPACITY - nextPlan(mb.id)); return `<tr>
          <td>${avatar(mb)} ${esc(mb.name)}</td><td>${esc(mb.role)}</td><td>${esc(mb.skill)}</td>
          <td>${pj.map((p) => `<a href="#/projects/${p.id}" class="pill p-gray" style="text-decoration:none;margin:1px">${esc(p.code)}</a>`).join('') || '—'}</td>
          ${canRate() ? `<td class="r">${yen(mb.cost)}/h</td>` : ''}
          <td class="r"><b>${free} h</b></td></tr>`; }).join('')}</tbody>
      </table></div>
      ${canRate() ? '' : '<p class="muted" style="margin:10px 0 0">※ 個人の原価単価は経営者ビューのみ表示（Notion 側でも閲覧権限を分離）。</p>'}
    </div>`;
}

// =============================================================
// Notion 構成
// =============================================================
function renderNotion() {
  const dbs = [
    ['🏢', '顧客DB', [['会社名', 'タイトル'], ['担当者・連絡先', 'テキスト'], ['案件', 'リレーション', 1], ['受注累計', 'ロールアップ']]],
    ['📁', '案件DB', [['案件名', 'タイトル'], ['顧客', 'リレーション', 1], ['PM・メンバー', 'リレーション', 1], ['ステータス / 期間 / 進捗', 'セレクト・日付・数値'], ['予算原価', '数値'], ['受注額', 'ロールアップ'], ['実績原価', 'ロールアップ＋数式'], ['着地見込・粗利率', '数式']]],
    ['📄', '受注DB', [['件名', 'タイトル'], ['案件 / 顧客', 'リレーション', 1], ['金額・確度', '数値'], ['ステータス', 'ステータス'], ['請求予定月', '日付']]],
    ['🧾', '発注DB', [['件名', 'タイトル'], ['発注先', 'リレーション', 1], ['案件', 'リレーション', 1], ['金額', '数値'], ['ステータス', 'ステータス']]],
    ['⏱', '工数DB', [['日付', '日付'], ['メンバー', 'リレーション', 1], ['案件', 'リレーション', 1], ['時間', '数値'], ['原価', '数式（時間×単価）']]],
    ['👤', 'メンバーDB', [['氏名', 'タイトル'], ['役割・スキル', 'マルチセレクト'], ['原価単価', '数値（経営のみ閲覧）'], ['今月工数', 'ロールアップ']]],
  ];
  view().innerHTML = `
    <div class="head-row"><h1>Notion 構成</h1><span class="sub">データはすべて Notion に。ポータルは「見やすく・入れやすく・権限で守る」ための窓口</span></div>
    <div class="card" style="margin-bottom:18px">
      <h2>業務の流れ</h2>
      <div class="flow">
        <span class="st">引合い・見積</span><span class="ar">→</span><span class="st">受注確定</span><span class="ar">→</span>
        <span class="st">案件起票・アサイン</span><span class="ar">→</span><span class="st">工数入力・外注発注</span><span class="ar">→</span>
        <span class="st">原価・粗利を自動集計</span><span class="ar">→</span><span class="st">納品・検収</span><span class="ar">→</span><span class="st">請求・入金</span>
      </div>
    </div>
    <div class="card" style="margin-bottom:18px">
      <div class="card-head"><h2>データベース設計（リレーションで連結）</h2><span class="r">${notionLink('テンプレートを見る')}</span></div>
      <div class="dbmap">${dbs.map(([e, n, fields]) => `<div class="db"><h3><span class="e">${e}</span>${n}</h3><ul>
        ${fields.map(([f, t, rel]) => `<li class="${rel ? 'rel' : ''}">${rel ? '↗ ' : ''}${esc(f)}<span class="ty">${esc(t)}</span></li>`).join('')}</ul></div>`).join('')}</div>
      <p class="muted" style="margin:12px 0 0">＋ お知らせDB。工数DB の「原価」を案件DB がロールアップ → 案件ごとの実績原価が常に最新になります。</p>
    </div>
    <div class="grid2">
      <div class="card">
        <h2>Notion だけで運用する場合との違い</h2>
        <div class="tbl-wrap"><table class="tbl" style="min-width:0">
          <thead><tr><th></th><th>Notion 単体</th><th>ポータル併用</th></tr></thead>
          <tbody>
            <tr><td>権限</td><td>ページ単位。原価単価などを部分的に隠しにくい</td><td>ロール別に項目ごと出し分け</td></tr>
            <tr><td>入力</td><td>DB に直接。慣れない人は迷う</td><td>週次グリッド・カンバンで迷わない</td></tr>
            <tr><td>集計</td><td>ロールアップ・数式の組み合わせが複雑</td><td>着地見込・稼働率を自動計算</td></tr>
            <tr><td>スマホ</td><td>DB 操作は小さく使いにくい</td><td>スマホ最適化済み</td></tr>
          </tbody>
        </table></div>
      </div>
      <div class="card">
        <h2>本番構成（プリコム社ポータルと同じ基盤）</h2>
        <div class="flow" style="flex-direction:column;align-items:stretch;gap:6px">
          <span class="st">① ブラウザ / スマホ（このポータル）</span><span class="ar" style="text-align:center">↓ ↑ 社員ログイン（Google / Microsoft SSO）</span>
          <span class="st">② Cloudflare Pages ＋ Functions（API・権限チェック）</span><span class="ar" style="text-align:center">↓ ↑ Notion API（インテグレーション）</span>
          <span class="st">③ Notion ワークスペース（7 データベース）</span>
        </div>
        <p class="muted" style="margin:12px 0 0">Notion の既存運用はそのまま。ポータルは読み書きの窓口なので、Notion 側で直接編集しても同期されます。月額の追加サーバー費用はほぼ不要。</p>
      </div>
    </div>
    <div style="margin-top:18px;text-align:right"><button class="btn btn-ghost btn-sm" id="reset">${svg('reset')}デモデータを初期化</button></div>`;
  document.getElementById('reset').addEventListener('click', () => {
    const role = S.role; S = freshState(); S.role = role; save(); toast('デモデータを初期化しました');
  });
}

// =============================================================
// 起動
// =============================================================
renderShell();
window.addEventListener('hashchange', route);
route();
