// マナベル 講義スライド生成（全12回）
// デザインは「ささエール_スライドブランドガイド」（BNI_メインプレゼン_制作実績）に合わせる：
//   黄色の集中線×ドット背景、黒文字、情報は黒フチの白カード、強調はオレンジ
//   色は #FFD600 / #F5A623 / #DD6420 / #1A1A1A / #FFFFFF の5色だけ
//   見出し：けいふぉんと（英字は Dela Gothic One）、本文：Noto Sans JP
// 使い方：node build.js <出力フォルダ> [回番号...]
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const JSZip = require("jszip");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const LESSONS = require("./lessons.js");

const OUT = process.argv[2] || "out";
const ONLY = process.argv.slice(3).map(Number);
fs.mkdirSync(OUT, { recursive: true });

// ---- ブランド（この5色だけ使う） ----
const HEX = { yellow: "FFD600", sub: "F5A623", orange: "DD6420", ink: "1A1A1A", white: "FFFFFF" };
const FONT = {
  head: "Dela Gothic One", // 英字。和文は書き出し後に「けいふぉんと」を当てる
  headJa: "けいふぉんと",
  body: "Noto Sans JP",
  bodyMid: "Noto Sans JP Medium",
};
const LANG = "ja-JP";

// ---- 背景（集中線＋ドット）と講師写真 ----
async function makeBackground() {
  const W = 1920, H = 1080, cx = W * 0.62, cy = H * 0.42, R = 2600, N = 40;
  let rays = "";
  for (let i = 0; i < N; i += 2) {
    const a1 = (i / N) * Math.PI * 2, a2 = ((i + 1) / N) * Math.PI * 2;
    rays += `<path d="M${cx},${cy} L${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)} L${cx + R * Math.cos(a2)},${cy + R * Math.sin(a2)} Z"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <pattern id="dot" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="17" cy="17" r="4.2" fill="#${HEX.white}"/></pattern>
      <radialGradient id="glow" cx="${cx / W}" cy="${cy / H}" r="0.7"><stop offset="0" stop-color="#${HEX.yellow}" stop-opacity="0.9"/><stop offset="0.55" stop-color="#${HEX.yellow}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="#${HEX.yellow}"/>
    <g fill="#${HEX.sub}" opacity="0.55">${rays}</g>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    <rect width="${W}" height="${H}" fill="url(#dot)" opacity="0.45"/>
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
  return "image/jpeg;base64," + buf.toString("base64");
}
async function makePortrait() {
  const file = path.join(__dirname, "../../../images/representative-sm.png");
  if (!fs.existsSync(file)) return null;
  const img = sharp(file).trim();
  const { data, info } = await img.png().toBuffer({ resolveWithObject: true });
  return { data: "image/png;base64," + data.toString("base64"), ratio: info.width / info.height };
}

// ---- アイコン（react-icons → PNG） ----
const ICONS = {
  talk: fa.FaChalkboardTeacher, hands: fa.FaLaptopCode, check: fa.FaCheck, warn: fa.FaExclamationTriangle,
  lark: fa.FaFeatherAlt, ai: fa.FaRobot, line: fa.FaLine, chat: fa.FaComments, book: fa.FaBook,
  table: fa.FaTable, web: fa.FaGlobeAsia, flow: fa.FaSyncAlt, lock: fa.FaLock, user: fa.FaUserShield,
  key: fa.FaKey, bulb: fa.FaRegLightbulb, pen: fa.FaPencilAlt, arrow: fa.FaArrowRight, flag: fa.FaFlagCheckered,
  clock: fa.FaRegClock, target: fa.FaBullseye, down: fa.FaCaretDown,
};
const iconCache = {};
async function icon(name, color) {
  const k = name + color;
  if (!iconCache[k]) {
    const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(ICONS[name], { color: "#" + color, size: 256 }));
    const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
    iconCache[k] = "image/png;base64," + buf.toString("base64");
  }
  return iconCache[k];
}

// 黒いベタ影（Canvaのカードと同じ、ぼかし無し）。毎回新しいオブジェクトを渡す
const hardShadow = (offset = 4) => ({ type: "outer", color: HEX.ink, opacity: 1, blur: 0, offset, angle: 45 });

// 「」で囲んだ言葉をオレンジで強調する。\n は改行
function rich(text, base = {}) {
  const runs = [];
  const lines = text.split("\n");
  lines.forEach((line, li) => {
    const parts = line.split(/(「[^」]*」)/).filter((p) => p !== "");
    if (!parts.length) parts.push(" ");
    parts.forEach((p, pi) => {
      const o = { ...base };
      if (p.startsWith("「")) o.color = HEX.orange;
      if (pi === parts.length - 1 && li < lines.length - 1) o.breakLine = true;
      runs.push({ text: p, options: o });
    });
  });
  return runs;
}

// 書き出したpptxの仕上げ：テーマの色・フォントをブランドに、見出しの和文を「けいふぉんと」に
async function finishPptx(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const themes = Object.keys(zip.files).filter((f) => /^ppt\/theme\/theme\d+\.xml$/.test(f));
  const clr = (n, v) => `<a:${n}><a:srgbClr val="${v}"/></a:${n}>`;
  const scheme = `<a:clrScheme name="SasaYell">${clr("dk1", HEX.ink)}${clr("lt1", HEX.white)}${clr("dk2", HEX.ink)}${clr("lt2", HEX.yellow)}`
    + `${clr("accent1", HEX.yellow)}${clr("accent2", HEX.orange)}${clr("accent3", HEX.sub)}${clr("accent4", HEX.ink)}${clr("accent5", HEX.white)}${clr("accent6", HEX.orange)}`
    + `${clr("hlink", HEX.orange)}${clr("folHlink", HEX.sub)}</a:clrScheme>`;
  const fonts = `<a:fontScheme name="SasaYell">`
    + `<a:majorFont><a:latin typeface="${FONT.head}"/><a:ea typeface="${FONT.headJa}"/><a:cs typeface=""/></a:majorFont>`
    + `<a:minorFont><a:latin typeface="${FONT.body}"/><a:ea typeface="${FONT.body}"/><a:cs typeface=""/></a:minorFont></a:fontScheme>`;
  for (const t of themes) {
    let x = await zip.file(t).async("string");
    x = x.replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, scheme).replace(/<a:fontScheme\b[\s\S]*?<\/a:fontScheme>/, fonts)
      .replace(/(<a:theme\b[^>]*?\bname=")[^"]*"/, "$1SasaYell\"");
    zip.file(t, x);
  }
  const xmls = Object.keys(zip.files).filter((f) => /^ppt\/(slides|slideLayouts|slideMasters)\/[^/]+\.xml$/.test(f));
  for (const f of xmls) {
    const x = await zip.file(f).async("string");
    zip.file(f, x.replace(new RegExp(`<a:ea typeface="${FONT.head}"`, "g"), `<a:ea typeface="${FONT.headJa}"`));
  }
  fs.writeFileSync(file, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

async function buildDeck(L, BG, PHOTO) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
  pres.theme = { headFontFace: FONT.head, bodyFontFace: FONT.body, lang: LANG };
  const plainTitle = L.title.replace("\n", "");
  pres.title = `マナベル 第${L.no}回 ${plainTitle}`;
  pres.author = "ささエール（Office Plata）";
  pres.company = "ささエール";
  const footer = `マナベル　第${L.no}回　${plainTitle}`;

  // 講師台本（talk-XX.js）があれば、その回の発表者ノートは台本で置き換える
  const talkFile = path.join(__dirname, `talk-${String(L.no).padStart(2, "0")}.js`);
  const talk = fs.existsSync(talkFile) ? require(talkFile) : null;
  let talkIdx = 0;
  function notes(slide, fallback) {
    const t = talk && talk[talkIdx++];
    slide.addNotes(t ? `【${t.block}／このスライド ${t.minutes}分】\n${t.talk}` : fallback);
  }

  // 文字の既定値
  const H = (o = {}) => ({ fontFace: FONT.head, color: HEX.ink, lang: LANG, margin: 0, isTextBox: true, ...o });
  const B = (o = {}) => ({ fontFace: FONT.body, bold: true, color: HEX.ink, lang: LANG, margin: 0, isTextBox: true, ...o });
  const M = (o = {}) => ({ fontFace: FONT.bodyMid, bold: false, color: HEX.ink, lang: LANG, margin: 0, isTextBox: true, ...o });

  // ---- レイアウト ----
  const brandPill = [
    { rect: { x: 7.0, y: 5.2, w: 2.65, h: 0.3, fill: { color: HEX.ink }, rectRadius: 0.15 } },
    { text: { text: "ささエール｜OFFICE PLATA", options: { x: 7.12, y: 5.2, w: 2.0, h: 0.3, fontFace: FONT.body, bold: true, fontSize: 8.5, color: HEX.white, valign: "middle", margin: 0, lang: LANG } } },
  ];
  pres.defineSlideMaster({ title: "MANA_COVER", background: { data: BG }, objects: [] });
  pres.defineSlideMaster({
    title: "MANA_CONTENT",
    background: { data: BG },
    margin: [0.5, 0.6, 0.6, 0.6],
    objects: [
      ...brandPill,
      { text: { text: footer, options: { x: 0.4, y: 5.2, w: 6.4, h: 0.3, fontFace: FONT.bodyMid, fontSize: 8.5, color: HEX.ink, valign: "middle", margin: 0, lang: LANG } } },
    ],
    slideNumber: { x: 9.15, y: 5.2, w: 0.4, h: 0.3, fontFace: FONT.body, bold: true, fontSize: 8.5, color: HEX.white, align: "right", valign: "middle" },
  });

  // ---- 部品 ----
  // 斜めの黒ラベル（Canvaの「実例1」と同じ）。手を動かすパートはオレンジ
  function label(slide, text, x, y, opts = {}) {
    const fill = opts.fill || HEX.ink;
    const size = opts.size || 12;
    const w = opts.w || 0.5 + [...text].length * size * 0.0145;
    const h = opts.h || size * 0.035;
    slide.addText(text, H({
      shape: pres.shapes.RECTANGLE, x, y, w, h, fill: { color: fill }, line: { color: fill }, rotate: opts.rotate ?? -3,
      fontSize: size, color: opts.color || HEX.white, align: "center", valign: "middle", shadow: opts.shadow ? hardShadow(3) : undefined,
    }));
    return w;
  }
  // 小さなオレンジのタグ（カード見出し）
  function tag(slide, text, x, y, maxW, fill = HEX.orange) {
    const w = Math.min(maxW, 0.36 + [...text].length * 0.19);
    slide.addText(text, B({ shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, x, y, w, h: 0.36, fill: { color: fill }, line: { color: fill }, fontSize: 13, color: HEX.white, align: "center", valign: "middle", fit: "shrink" }));
    return w;
  }
  // 1行の最長文字数から、枠に収まる文字サイズを決める（和文1文字≒1em、英数字≒0.6em）
  function fitSize(text, width, max) {
    const em = Math.max(...text.split("\n").map((l) => [...l].reduce((a, c) => a + (/[ -~]/.test(c) ? 0.62 : 1), 0)));
    return Math.min(max, Math.floor((width * 72 * 0.92) / em));
  }
  function titleOf(slide, s) {
    let y = 0.55;
    if (s.chip) label(slide, s.chip, 0.45, 0.22, { fill: s.hands ? HEX.orange : HEX.ink, size: 11, rotate: -3 });
    slide.addText(rich(s.title), H({ x: 0.45, y, w: 9.1, h: 0.75, fontSize: 26, valign: "middle", fit: "shrink" }));
  }
  async function iconCircle(slide, x, y, d, name, bg = HEX.orange, fg = HEX.white) {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: HEX.ink, width: 1.5 }, objectName: "icon-circle" });
    const p = d * 0.25;
    slide.addImage({ data: await icon(name, fg), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, objectName: "icon" });
  }
  function card(slide, x, y, w, h, opts = {}) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h, rectRadius: 0.1, fill: { color: opts.fill || HEX.white },
      line: { color: HEX.ink, width: 2 }, shadow: hardShadow(opts.shadow || 4), objectName: opts.name || "card",
    });
  }
  // 下の帯（Canvaの「業種はバラバラ。でも…」と同じ、斜めのオレンジ帯）
  async function foot(slide, text, y = 4.5) {
    // 帯はオレンジなので「」の強調は黄色にする
    const runs = rich(text).map((r) => (r.options.color === HEX.orange ? { ...r, options: { ...r.options, color: HEX.yellow } } : r));
    slide.addText(runs, B({
      shape: pres.shapes.RECTANGLE, x: 0.55, y, w: 8.9, h: 0.55, fill: { color: HEX.orange }, line: { color: HEX.ink, width: 1.5 },
      rotate: -1, shadow: hardShadow(3), fontSize: 13, color: HEX.white, align: "center", valign: "middle", margin: [0, 0.15, 0, 0.15], fit: "shrink",
    }));
  }
  function contentSlide(section, s, withNotes = true) {
    const slide = pres.addSlide({ masterName: "MANA_CONTENT", sectionTitle: section });
    titleOf(slide, s);
    if (withNotes && (s.note || talk)) notes(slide, s.note || "");
    return slide;
  }
  const bullets = (items) => items.map((t, i) => ({ text: t, options: { bullet: { characterCode: "25CF" }, breakLine: i < items.length - 1 } }));

  // ---- 種類ごとの描画 ----
  const R = {
    async cards(slide, s) {
      const cols = s.cols, rows = Math.ceil(s.items.length / cols), gap = 0.28;
      const top = 1.55, bottom = s.foot ? 4.25 : 4.95;
      const w = (8.9 - (cols - 1) * gap) / cols, h = rows === 1 ? Math.min(2.55, bottom - top) : (bottom - top - (rows - 1) * gap) / rows;
      for (let i = 0; i < s.items.length; i++) {
        const it = s.items[i], x = 0.55 + (i % cols) * (w + gap), y = top + Math.floor(i / cols) * (h + gap);
        card(slide, x, y, w, h);
        const ic = it.icon || (s.warn ? "warn" : null);
        const small = rows > 1 || cols > 3;
        let by;
        if (ic && !small) {
          await iconCircle(slide, x + 0.22, y + 0.22, 0.6, ic);
          slide.addText(it.h, H({ x: x + 0.95, y: y + 0.22, w: w - 1.15, h: 0.6, fontSize: [...it.h].length > 7 ? 12.5 : [...it.h].length > 5 ? 15 : 17, valign: "middle", fit: "shrink" }));
          by = y + 0.98;
        } else {
          let tx = x + 0.2;
          if (ic) { await iconCircle(slide, x + 0.2, y + 0.17, 0.42, ic); tx = x + 0.72; }
          tag(slide, it.h, tx, y + 0.2, x + w - 0.2 - tx);
          by = y + 0.72;
        }
        slide.addText(it.b, B({ x: x + 0.22, y: by, w: w - 0.44, h: y + h - by - 0.15, fontSize: cols > 3 ? 12.5 : 13.5, valign: "top", paraSpaceAfter: 3, fit: "shrink", objectName: "card-body" }));
      }
      if (s.foot) await foot(slide, s.foot);
    },
    async table(slide, s) {
      const total = s.colW.reduce((a, b) => a + b, 0);
      const colW = s.colW.map((v) => (v / total) * 8.9);
      const head = s.head.map((t) => ({ text: t, options: { bold: true, color: HEX.white, fill: { color: HEX.ink }, fontSize: 12.5, fontFace: FONT.body } }));
      const rows = s.rows.map((r) => r.map((t, j) => ({ text: t, options: { fontSize: 12, bold: true, fontFace: j === 0 ? FONT.body : FONT.bodyMid, color: j === 0 ? HEX.orange : HEX.ink, fill: { color: HEX.white } } })));
      const rowH = s.rows.length > 4 ? 0.4 : 0.48;
      const tableH = rowH * (s.rows.length + 1);
      // 表の外枠に黒いベタ影をつける
      slide.addShape(pres.shapes.RECTANGLE, { x: 0.55, y: 1.55, w: 8.9, h: tableH, fill: { color: HEX.white }, line: { color: HEX.ink, width: 2 }, shadow: hardShadow(4) });
      slide.addTable([head, ...rows], { x: 0.55, y: 1.55, w: 8.9, colW, rowH, border: { type: "solid", pt: 1, color: HEX.ink }, valign: "middle", margin: [0, 0.1, 0, 0.1], lang: LANG, objectName: "table" });
      if (s.foot) await foot(slide, s.foot);
    },
    async steps(slide, s) {
      const n = s.steps.length, top = 1.55, bottom = s.tip ? 4.2 : 4.95, gap = 0.14;
      const rowH = Math.min(0.62, (bottom - top - (n - 1) * gap) / n);
      const start = top + Math.max(0, (bottom - top - rowH * n - gap * (n - 1)) / 2 - 0.05);
      for (let i = 0; i < n; i++) {
        const y = start + i * (rowH + gap);
        card(slide, 0.55, y, 8.9, rowH, { shadow: 3 });
        const d = Math.min(0.44, rowH - 0.12);
        slide.addText(String(i + 1), H({ shape: pres.shapes.OVAL, x: 0.7, y: y + (rowH - d) / 2, w: d, h: d, fill: { color: HEX.orange }, line: { color: HEX.ink, width: 1.5 }, fontSize: 15, color: HEX.white, align: "center", valign: "middle" }));
        slide.addText(s.steps[i], B({ x: 1.35, y, w: 7.95, h: rowH, fontSize: 14, valign: "middle", fit: "shrink", objectName: "step-text" }));
      }
      if (s.tip) await foot(slide, s.tip, 4.38);
    },
    async prompt(slide, s) {
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.55, y: 1.55, w: 8.9, h: 3.4, rectRadius: 0.1, fill: { color: HEX.ink }, line: { color: HEX.ink }, shadow: hardShadow(4), objectName: "prompt-box" });
      await iconCircle(slide, 0.8, 1.75, 0.5, "ai", HEX.yellow, HEX.ink);
      slide.addText("AIへの頼み方（コピーして使う）", H({ x: 1.45, y: 1.75, w: 6, h: 0.5, fontSize: 14, color: HEX.yellow, valign: "middle" }));
      slide.addText(s.text, M({ x: 0.85, y: 2.45, w: 8.3, h: 2.35, fontSize: 13, color: HEX.white, valign: "top", paraSpaceAfter: 2, fit: "shrink", objectName: "prompt-text" }));
    },
    async compare(slide, s) {
      const top = 1.55, h = s.foot ? 2.65 : 3.35, w = 3.95;
      for (const [k, side] of [[0, s.left], [1, s.right]]) {
        const x = k ? 5.5 : 0.55;
        card(slide, x, top, w, h);
        tag(slide, side.h, x + 0.22, top + 0.22, w - 0.44, k ? HEX.orange : HEX.ink);
        slide.addText(bullets(side.items), B({ x: x + 0.25, y: top + 0.78, w: w - 0.5, h: h - 0.95, fontSize: 13.5, valign: "top", paraSpaceAfter: 8, fit: "shrink" }));
      }
      await iconCircle(slide, 4.73, top + h / 2 - 0.27, 0.54, "arrow");
      if (s.foot) await foot(slide, s.foot);
    },
    async flow(slide, s) {
      const n = s.nodes.length, gap = 0.42, w = (8.9 - (n - 1) * gap) / n, y = 1.85, h = 1.75;
      for (let i = 0; i < n; i++) {
        const x = 0.55 + i * (w + gap);
        card(slide, x, y, w, h, { fill: i === n - 1 ? HEX.sub : HEX.white });
        slide.addText(`STEP ${i + 1}`, H({ shape: pres.shapes.RECTANGLE, x: x + w / 2 - 0.5, y: y - 0.16, w: 1.0, h: 0.32, fill: { color: HEX.ink }, line: { color: HEX.ink }, rotate: -3, fontSize: 10, color: HEX.white, align: "center", valign: "middle" }));
        slide.addText(s.nodes[i], B({ x: x + 0.12, y: y + 0.3, w: w - 0.24, h: h - 0.4, fontSize: n > 4 ? 12.5 : 14, align: "center", valign: "middle", fit: "shrink", objectName: "flow-node" }));
        if (i < n - 1) slide.addImage({ data: await icon("arrow", HEX.orange), x: x + w + 0.07, y: y + h / 2 - 0.14, w: 0.28, h: 0.28, objectName: "flow-arrow" });
      }
      if (s.foot) await foot(slide, s.foot, 4.15);
    },
    async phones(slide, s) {
      // スマホ画面のスクリーンショット（780x1640px）を並べ、右の白カードに説明を置く
      const h = 3.25, w = h * 780 / 1640, pad = 0.07, top = 1.6;
      let x = 0.7;
      for (let i = 0; i < s.images.length; i++) {
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: top, w: w + pad * 2, h: h + pad * 2, rectRadius: 0.14, fill: { color: HEX.ink }, line: { color: HEX.ink }, rotate: i % 2 ? 3 : -3, shadow: hardShadow(4), objectName: "phone-frame" });
        slide.addImage({ path: path.join(__dirname, "img", s.images[i]), x: x + pad, y: top + pad, w, h, rotate: i % 2 ? 3 : -3, objectName: "phone-screen", altText: s.alts?.[i] || "デモ画面" });
        x += w + pad * 2 + 0.35;
      }
      const px = x + 0.05, pw = 9.45 - px, n = s.points.length;
      card(slide, px, top - 0.05, pw, 3.45);
      const rowH = 3.15 / n;
      for (let i = 0; i < n; i++) {
        const y = top + 0.12 + i * rowH;
        await iconCircle(slide, px + 0.2, y + 0.09, 0.32, "check");
        slide.addText(s.points[i].h, B({ x: px + 0.62, y, w: pw - 0.8, h: 0.5, fontSize: 13, color: HEX.orange, valign: "middle", fit: "shrink", objectName: "point-head" }));
        slide.addText(s.points[i].b, M({ x: px + 0.62, y: y + 0.52, w: pw - 0.8, h: rowH - 0.58, fontSize: 11.5, valign: "top", fit: "shrink", objectName: "point-body" }));
      }
    },
    async bigtext(slide, s) {
      card(slide, 0.55, 1.6, 8.9, 2.2);
      await iconCircle(slide, 0.85, 1.9, 0.62, "target");
      slide.addText(rich(s.big), B({ x: 1.75, y: 1.7, w: 7.45, h: 2.0, fontSize: 19, valign: "middle", fit: "shrink", objectName: "big-text" }));
      await foot(slide, s.sub, 4.25);
    },
  };

  // 講師写真（表紙・最終スライド）
  function portrait(slide) {
    if (!PHOTO) return;
    const h = 4.3, w = h * PHOTO.ratio;
    slide.addImage({ data: PHOTO.data, x: 9.7 - w, y: 5.625 - h, w, h, objectName: "portrait", altText: "講師 笹原彰朗" });
  }

  // ---- 1. 表紙 ----
  pres.addSection({ title: "導入" });
  let slide = pres.addSlide({ masterName: "MANA_COVER", sectionTitle: "導入" });
  portrait(slide);
  label(slide, `第${L.no}回`, 0.5, 0.45, { size: 22, w: 1.75, h: 0.66, color: HEX.yellow, shadow: true, rotate: -4 });
  slide.addText(rich(L.title), H({ x: 0.5, y: 1.3, w: 6.6, h: 1.75, fontSize: fitSize(L.title, 6.6, 40), valign: "middle", fit: "shrink", lineSpacingMultiple: 1.05 }));
  slide.addText(`${L.phase}｜${L.week}`, B({
    shape: pres.shapes.RECTANGLE, x: 0.5, y: 3.25, w: 5.4, h: 0.55, fill: { color: HEX.orange }, line: { color: HEX.ink, width: 1.5 },
    rotate: -2, shadow: hardShadow(3), fontSize: 16, color: HEX.white, align: "center", valign: "middle",
  }));
  card(slide, 0.5, 4.08, 5.4, 0.98);
  slide.addText([
    { text: "マナベル｜AI×Lark 構築者育成講座", options: { fontFace: FONT.body, bold: true, fontSize: 15, color: HEX.ink, breakLine: true } },
    { text: "ささエール ／ OFFICE PLATA　笹原 彰朗", options: { fontFace: FONT.body, bold: true, fontSize: 11.5, color: HEX.orange } },
  ], B({ x: 0.72, y: 4.12, w: 5.0, h: 0.9, valign: "middle", paraSpaceAfter: 2 }));
  notes(slide, `第${L.no}回「${plainTitle}」。前回の宿題の提出状況を確認してから始める。`);

  // ---- 2. 今日のゴールと流れ ----
  slide = contentSlide("導入", { title: "今日のゴールと流れ", chip: "はじめに" }, false);
  const gN = L.goals.length, gGap = 0.28, gW = (8.9 - (gN - 1) * gGap) / gN;
  for (let i = 0; i < gN; i++) {
    const x = 0.55 + i * (gW + gGap);
    card(slide, x, 1.5, gW, 1.4);
    await iconCircle(slide, x + 0.2, 1.72, 0.48, "check");
    slide.addText(L.goals[i], B({ x: x + 0.82, y: 1.6, w: gW - 1.0, h: 1.2, fontSize: 14, valign: "middle", fit: "shrink", objectName: "goal" }));
  }
  const total = L.time.reduce((a, t) => a + t[1], 0);
  label(slide, `今日の流れ（${total}分）`, 0.5, 3.18, { size: 11, rotate: -2 });
  let tx = 0.55;
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.55, y: 3.68, w: 8.9, h: 0.75, fill: { color: HEX.white }, line: { color: HEX.ink, width: 2 }, shadow: hardShadow(4) });
  for (const [lbl, min, kind] of L.time) {
    const w = (min / total) * 8.9;
    const hands = kind === "hands";
    slide.addShape(pres.shapes.RECTANGLE, { x: tx, y: 3.68, w, h: 0.75, fill: { color: hands ? HEX.orange : HEX.ink }, line: { color: HEX.white, width: 1.5 }, objectName: "time-block" });
    slide.addText([{ text: lbl, options: { breakLine: true } }, { text: `${min}分`, options: { fontSize: 9 } }],
      B({ x: tx, y: 3.68, w, h: 0.75, fontSize: w < 0.9 ? 8.5 : 10.5, color: hands ? HEX.white : HEX.yellow, align: "center", valign: "middle", objectName: "time-label" }));
    tx += w;
  }
  slide.addText([{ text: "■ ", options: { color: HEX.ink } }, { text: "聞く　", options: {} }, { text: "■ ", options: { color: HEX.orange } }, { text: "手を動かす", options: {} }],
    B({ x: 0.55, y: 4.58, w: 4, h: 0.3, fontSize: 10.5 }));
  notes(slide, "ゴールを読み上げ、今日は「聞く」と「手を動かす」を交互に進めることを伝える。");

  // ---- 3. 本編 ----
  pres.addSection({ title: "本編" });
  for (const s of L.slides) {
    const sl = contentSlide("本編", s);
    await R[s.type](sl, s);
  }

  // ---- 4. 宿題とチェック ----
  pres.addSection({ title: "まとめ" });
  slide = contentSlide("まとめ", { title: "宿題と、今日のチェック", chip: "まとめ" }, false);
  for (const [k, head, items, ic] of [[0, "宿題", L.homework.map((t) => t), "pen"], [1, "できたらチェック", L.checks.map((t) => "☐ " + t), "check"]]) {
    const x = k ? 5.15 : 0.55, w = 4.3;
    card(slide, x, 1.55, w, 3.4);
    await iconCircle(slide, x + 0.22, 1.75, 0.5, ic);
    slide.addText(head, H({ x: x + 0.85, y: 1.75, w: 3, h: 0.5, fontSize: 18, valign: "middle" }));
    const runs = k ? items.map((t, i) => ({ text: t, options: { breakLine: i < items.length - 1 } })) : bullets(items);
    slide.addText(runs, B({ x: x + 0.25, y: 2.45, w: w - 0.5, h: 2.35, fontSize: 13.5, valign: "top", paraSpaceAfter: 8, fit: "shrink" }));
  }
  notes(slide, "宿題の目安時間を伝える。質問は講座グループへ（24時間以内に返信・土日祝を除く）。");

  // ---- 5. 次回 ----
  slide = pres.addSlide({ masterName: "MANA_COVER", sectionTitle: "まとめ" });
  portrait(slide);
  if (L.no < 12) {
    label(slide, "次回", 0.5, 0.6, { size: 20, w: 1.4, h: 0.6, color: HEX.yellow, shadow: true, rotate: -4 });
    const nextTitle = L.next.replace(/^(第\d+回)\s*/, "$1\n");
    slide.addText(rich(nextTitle), H({ x: 0.5, y: 1.4, w: 6.4, h: 1.7, fontSize: fitSize(nextTitle, 6.4, 32), valign: "middle", fit: "shrink" }));
  } else {
    label(slide, "修了", 0.5, 0.6, { size: 20, w: 1.4, h: 0.6, color: HEX.yellow, shadow: true, rotate: -4 });
    slide.addText([{ text: "修了、", options: { color: HEX.orange, breakLine: true } }, { text: "おめでとうございます!", options: {} }], H({ x: 0.5, y: 1.4, w: 6.4, h: 1.7, fontSize: 32, valign: "middle", fit: "shrink" }));
  }
  card(slide, 0.5, 3.4, 5.9, 1.45);
  const endText = L.no < 12
    ? "わからないところは、講座グループでいつでも質問してください。\nAPIキーやパスワードは送らないでください。"
    : "あなたはもう、自社のしくみを作れる「構築者」です。\n作ったしくみを、使われながら育てていきましょう。";
  slide.addText(rich(endText), B({ x: 0.75, y: 3.5, w: 5.4, h: 1.25, fontSize: 14, valign: "middle", paraSpaceAfter: 4, fit: "shrink" }));
  notes(slide, "次回までの宿題をもう一度確認して終了。");

  const file = path.join(OUT, `manaberu-${L.file}.pptx`);
  await pres.writeFile({ fileName: file });
  await finishPptx(file);
  return file;
}

(async () => {
  const BG = await makeBackground();
  const PHOTO = await makePortrait();
  for (const L of LESSONS) {
    if (ONLY.length && !ONLY.includes(L.no)) continue;
    console.log(await buildDeck(L, BG, PHOTO));
  }
})().catch((e) => { console.error(e); process.exit(1); });
