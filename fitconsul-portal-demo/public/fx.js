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
    const word = 'F-IT Consul';
    el.innerHTML = `
      <div class="intro-in">
        <div class="intro-mark"></div>
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
      { x: .15, y: .2, r: .45, c: [178, 224, 246], sp: .00007, ph: 0 },  // 空色
      { x: .85, y: .15, r: .38, c: [196, 216, 240], sp: .00005, ph: 2 }, // 青
      { x: .7, y: .85, r: .5, c: [252, 244, 200], sp: .00006, ph: 4 },   // 黄
      { x: .2, y: .9, r: .35, c: [252, 222, 190], sp: .00008, ph: 1 },   // 橙
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

  // ---------- ヒーロー：光の粒が球体からロゴ（F マーク）へ集まり、ふわっと浮遊する ----------
  let logoPts = null;
  function loadLogo() {
    if (logoPts) return Promise.resolve(logoPts);
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const S = 96, c = document.createElement('canvas'); c.width = c.height = S;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0, S, S);
        const d = x.getImageData(0, 0, S, S).data; const pts = [];
        for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) {
          const i = (yy * S + xx) * 4;
          if (d[i + 3] < 140) continue;
          if (Math.random() > .62) continue; // 粒を間引いて軽やかに
          pts.push({ x: (xx / S - .5) * 2 + (Math.random() - .5) * .02, y: (yy / S - .5) * 2 + (Math.random() - .5) * .02,
                     z: (Math.random() - .5) * .14, c: [d[i], d[i + 1], d[i + 2]] });
        }
        logoPts = pts; res(pts);
      };
      img.onerror = () => res([]);
      img.src = 'img/mark.png';
    });
  }
  let orbStop = null;
  async function orb(canvas) {
    if (orbStop) orbStop();
    if (!canvas) return;
    const pts = await loadLogo();
    if (!pts.length || !canvas.isConnected) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, devicePixelRatio || 1);
    // 出発点：球面上にばらまく（前回の球体の名残）
    pts.forEach((p, i) => {
      const y = 1 - (i / (pts.length - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
      p.sx = Math.cos(th) * r * 1.25; p.sy = y * 1.25; p.sz = Math.sin(th) * r * 1.25;
      p.dl = Math.random() * 700 + (p.y + 1) * 250; // 上から順に集まる
      p.ph = Math.random() * 6.28;
    });
    let mx = 0, my = 0, tmx = 0, tmy = 0, run = true;
    const host = canvas.parentElement;
    const onMove = (e) => {
      const r = host.getBoundingClientRect();
      tmx = (e.clientX - r.left) / r.width - .5; tmy = (e.clientY - r.top) / r.height - .5;
    };
    host.addEventListener('pointermove', onMove);
    const t0 = performance.now() + (document.documentElement.classList.contains('is-intro') ? 1500 : 250);
    const draw = (now) => {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      mx += (tmx - mx) * .05; my += (tmy - my) * .05;
      const t = now - t0;
      const narrow = W < 700;
      const R = narrow ? Math.min(W, H) * .3 : Math.min(W * .5, H) * .3;
      const cx = (narrow ? W * .72 : W * .8) + mx * 26, cy = H * .5 + Math.sin(now * .0007) * 10 + my * 16; // ふわふわ上下
      // ロゴが読める範囲でゆっくり左右に揺れる
      const a = Math.sin(now * .00035) * .42 + mx * .5, b = Math.sin(now * .00027) * .12 + my * .3;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of pts) {
        const k = Math.min(1, Math.max(0, (t - p.dl) / 1600)), e = ease(k);
        const wob = Math.sin(now * .0016 + p.ph) * .012; // 粒のきらめき・揺らぎ
        let x = p.sx + (p.x - p.sx) * e, y = p.sy + (p.y - p.sy) * e + wob, z = p.sz + (p.z - p.sz) * e;
        if (k < 1) { const sp = (1 - e) * t * .0004; const c = Math.cos(sp), s2 = Math.sin(sp); [x, z] = [x * c - z * s2, x * s2 + z * c]; }
        let X = x * ca - z * sa, Z = x * sa + z * ca, Y = y;
        const Y2 = Y * cb - Z * sb; Z = Y * sb + Z * cb; Y = Y2;
        const s = 2.6 / (2.6 + Z);
        const depth = Math.min(1, Math.max(0, (1 - Z) / 2));
        const al = (.35 + depth * .6) * (.35 + e * .65);
        const [r, g, bl] = p.c;
        ctx.fillStyle = `rgba(${r},${g},${bl},${al})`;
        ctx.beginPath(); ctx.arc(cx + X * R * s, cy + Y * R * s, (.7 + depth * 1.3) * (1 + (1 - e) * .4), 0, 6.2832); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    if (reduced) { draw(t0 + 5000); return; }
    const loop = (now) => { if (!run) return; if (!document.hidden) draw(now); requestAnimationFrame(loop); };
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
