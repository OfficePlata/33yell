// =============================================================
// 演出レイヤー（サウンドなし）
// - イントロ（ロゴが浮かび上がり、幕が上がる）
// - ページ遷移・スクロール時に要素が「ふわっ」と浮き出るリビール
// - ヒーローの浮遊する 3D ドット球体、背景の霧、数値のカウントアップ
// prefers-reduced-motion の環境ではすべて即時表示に切り替える。
// =============================================================
const FX = (() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = (t) => 1 - Math.pow(1 - t, 4);

  // ---------- イントロ ----------
  function intro() {
    const el = document.createElement('div');
    el.className = 'intro';
    el.setAttribute('aria-hidden', 'true');
    const word = 'FIT CONSUL';
    el.innerHTML = `
      <div class="intro-in">
        <div class="intro-word">${[...word].map((c, i) => `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</div>
        <div class="intro-sub">Operations Portal — powered by Notion</div>
        <div class="intro-line"><i></i></div>
      </div>`;
    document.body.appendChild(el);
    document.documentElement.classList.add('is-intro');
    let resolve; ready = new Promise((r) => (resolve = r));
    const done = () => {
      resolve();
      el.classList.add('out');
      document.documentElement.classList.remove('is-intro');
      document.documentElement.classList.add('is-ready');
      setTimeout(() => el.remove(), 1400);
    };
    if (reduced) return done();
    requestAnimationFrame(() => el.classList.add('run'));
    setTimeout(done, 2300);
  }

  // ---------- リビール ----------
  const TARGETS = [
    '.head-row', '.hero', '.side', '.kpi', '.mod', '.card', '.col', '.kcard', '.tbl-wrap',
    '.db', '.alert-row', '.empty', '.todo a', '.flow .st', '.ms li', '.bc-row', '.heat tbody tr',
  ].join(',');
  let io;
  function observer() {
    if (io) return io;
    io = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
        countUp(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    return io;
  }
  const ITEMS = '.kcard, .todo a, .ms li, .bc-row, .heat tbody tr, .flow .st';
  let ready = null; // イントロが終わるまでリビールを待つ
  function reveal(root) {
    if (!root) return;
    splitHero(root);
    root.querySelectorAll(TARGETS).forEach((el) => {
      // 親がリビール対象なら、リスト項目以外は親と一緒に動かす
      if (el.parentElement.closest('.rv') && !el.matches(ITEMS)) return;
      const idx = [...el.parentElement.children].indexOf(el);
      el.classList.add('rv');
      el.style.setProperty('--d', `${Math.min(idx, 8) * 80}ms`);
      if (reduced) { el.classList.add('in'); countUp(el); return; }
      ready.then(() => observer().observe(el));
    });
  }

  // 見出し文字を 1 文字ずつ浮かせる
  function splitHero(root) {
    root.querySelectorAll('.h-greet, .head-row h1').forEach((h) => {
      if (h.dataset.split) return;
      h.dataset.split = '1';
      h.setAttribute('aria-label', h.textContent);
      let i = 0; // <br> などの要素は残し、テキストだけ 1 文字ずつに分ける
      [...h.childNodes].forEach((n) => {
        if (n.nodeType !== 3) return;
        const frag = document.createElement('span');
        frag.setAttribute('aria-hidden', 'true');
        frag.innerHTML = [...n.textContent].map((c) => `<span class="ch" style="--c:${i++}">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
        n.replaceWith(frag);
      });
    });
  }

  // ---------- 数値カウントアップ ----------
  function countUp(scope) {
    if (reduced) return;
    scope.querySelectorAll('.kpi .v, .h-stat .v').forEach((v) => {
      if (v.dataset.counted) return;
      v.dataset.counted = '1';
      const node = [...v.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.textContent));
      if (!node) return;
      const raw = node.textContent;
      const target = parseFloat(raw.replace(/[^\d.-]/g, ''));
      if (!isFinite(target)) return;
      const suffix = raw.replace(/[\d,.\-\s]/g, '');
      const t0 = performance.now(), dur = 1400;
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        node.textContent = Math.round(target * ease(p)).toLocaleString('ja-JP') + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // ---------- カードの光（カーソル追従） ----------
  function sheen() {
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest && e.target.closest('.mod, .kpi, .card, .kcard, .side');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
  }

  // ---------- 背景の霧（ゆっくり漂う光） ----------
  function fog() {
    const c = document.createElement('canvas');
    c.className = 'fog';
    c.setAttribute('aria-hidden', 'true');
    document.body.prepend(c);
    const ctx = c.getContext('2d');
    const blobs = [
      { x: .15, y: .2, r: .45, c: [214, 202, 184], sp: .00007, ph: 0 },
      { x: .85, y: .15, r: .38, c: [196, 205, 208], sp: .00005, ph: 2 },
      { x: .7, y: .85, r: .5, c: [222, 214, 200], sp: .00006, ph: 4 },
      { x: .2, y: .9, r: .35, c: [205, 198, 214], sp: .00008, ph: 1 },
    ];
    let w, h;
    const size = () => { w = c.width = Math.ceil(innerWidth / 4); h = c.height = Math.ceil(innerHeight / 4); };
    size(); addEventListener('resize', size);
    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);
      blobs.forEach((b) => {
        const x = (b.x + Math.sin(t * b.sp + b.ph) * .08) * w;
        const y = (b.y + Math.cos(t * b.sp * 1.3 + b.ph) * .08) * h;
        const r = b.r * Math.max(w, h);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${b.c},.55)`); g.addColorStop(1, `rgba(${b.c},0)`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      });
    };
    if (reduced) return draw(0);
    let last = 0;
    const loop = (t) => { if (t - last > 50 && !document.hidden) { draw(t); last = t; } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  // ---------- ヒーローの浮遊するドット球体 ----------
  let orbStop = null;
  function orb(canvas) {
    if (orbStop) orbStop();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, devicePixelRatio || 1);
    const N = 520, pts = [];
    for (let i = 0; i < N; i++) { // フィボナッチ球
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    let mx = 0, my = 0, tmx = 0, tmy = 0, run = true;
    const host = canvas.parentElement;
    const onMove = (e) => {
      const r = host.getBoundingClientRect();
      tmx = ((e.clientX - r.left) / r.width - .5); tmy = ((e.clientY - r.top) / r.height - .5);
    };
    host.addEventListener('pointermove', onMove);
    const draw = (t) => {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      mx += (tmx - mx) * .05; my += (tmy - my) * .05;
      const R = Math.min(W, H) * .36;
      const cx = W * .72 + mx * 24, cy = H * .5 + Math.sin(t * .0008) * 10 + my * 18; // ふわふわ上下
      const a = t * .00018 + mx * .6, b = .35 + my * .4;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      for (const [x, y, z] of pts) {
        // 表面をゆっくり波打たせる
        const k = 1 + Math.sin(x * 3 + t * .0012) * Math.cos(y * 3 - t * .001) * .06;
        let X = x * ca - z * sa, Z = x * sa + z * ca, Y = y;
        const Y2 = Y * cb - Z * sb; Z = Y * sb + Z * cb; Y = Y2;
        const s = 2.4 / (2.4 + Z);
        const px = cx + X * R * k * s, py = cy + Y * R * k * s;
        const depth = (1 - Z) / 2; // 手前ほど明るく大きく
        ctx.fillStyle = `rgba(236,228,214,${.12 + depth * .75})`;
        ctx.beginPath(); ctx.arc(px, py, .5 + depth * 1.5, 0, 6.2832); ctx.fill();
      }
    };
    if (reduced) { draw(0); return; }
    const loop = (t) => { if (!run) return; if (!document.hidden) draw(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    orbStop = () => { run = false; host.removeEventListener('pointermove', onMove); orbStop = null; };
  }

  // ---------- スクロールでヘッダーを締める ----------
  function header() {
    const on = () => document.documentElement.classList.toggle('scrolled', scrollY > 8);
    addEventListener('scroll', on, { passive: true }); on();
  }

  function init() { intro(); fog(); sheen(); header(); }
  return { init, reveal, orb, reduced };
})();
FX.init();
