// マナベル 講義スライド生成（全12回）
// 使い方：node build.js <出力フォルダ> [回番号...]
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");
const LESSONS = require("./lessons.js");

const OUT = process.argv[2] || "out";
const ONLY = process.argv.slice(3).map(Number);
fs.mkdirSync(OUT, { recursive: true });

const HEX = {
  ink: "1A1A1A", white: "FFFFFF", soft: "5A6872", tint: "FFF6CC",
  yellow: "FFD600", orange: "DD6420", lark: "3370FF", line: "06C755", red: "E53935", gray: "F4F4F4",
};
const THEME = {
  name: "Manaberu",
  headFontFace: "Yu Gothic",
  bodyFontFace: "Yu Gothic",
  colors: {
    dk1: HEX.ink, lt1: HEX.white, dk2: HEX.soft, lt2: HEX.tint,
    accent1: HEX.yellow, accent2: HEX.orange, accent3: HEX.lark,
    accent4: HEX.line, accent5: HEX.red, accent6: "F5A623",
    hlink: HEX.lark, folHlink: "6B4FBB",
  },
};

// ---- アイコン（react-icons → PNG） ----
const ICONS = {
  talk: fa.FaChalkboardTeacher, hands: fa.FaLaptopCode, check: fa.FaCheck, warn: fa.FaExclamationTriangle,
  lark: fa.FaFeatherAlt, ai: fa.FaRobot, line: fa.FaLine, chat: fa.FaComments, book: fa.FaBook,
  table: fa.FaTable, web: fa.FaGlobeAsia, flow: fa.FaSyncAlt, lock: fa.FaLock, user: fa.FaUserShield,
  key: fa.FaKey, bulb: fa.FaRegLightbulb, pen: fa.FaPencilAlt, arrow: fa.FaArrowRight, flag: fa.FaFlagCheckered,
  clock: fa.FaRegClock, target: fa.FaBullseye,
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

// コミック調の影（毎回新しいオブジェクトを渡す）
const comicShadow = () => ({ type: "outer", color: "000000", opacity: 0.18, blur: 0, offset: 3, angle: 45 });

async function buildDeck(L) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  pres.title = `マナベル 第${L.no}回 ${L.title.replace("\n", "")}`;
  pres.author = "ささエール（Office Plata）";
  pres.company = "ささエール";
  const C = pres.SchemeColor;
  const footer = `マナベル　第${L.no}回　${L.title.replace("\n", "")}`;

  // ---- レイアウト ----
  pres.defineSlideMaster({
    title: "MANA_TITLE",
    background: { color: HEX.yellow },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.85, w: 6.4, h: 1.5, fontSize: 32, bold: true, color: C.text1, valign: "top", align: "left", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 3.55, w: 6.4, h: 0.5, fontSize: 14, color: C.text1, margin: 0 }, text: "" } },
      { text: { text: "マナベル｜AI×Lark 構築者育成講座", options: { x: 0.6, y: 4.95, w: 6, h: 0.3, fontSize: 10, color: C.text1, margin: 0 } } },
      { text: { text: "ささエール", options: { x: 7.4, y: 4.95, w: 2, h: 0.3, fontSize: 10, bold: true, color: C.text1, align: "right", margin: 0 } } },
    ],
  });
  pres.defineSlideMaster({
    title: "MANA_CONTENT",
    background: { color: HEX.white },
    margin: [0.5, 0.6, 0.6, 0.6],
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.72, w: 8.8, h: 0.62, fontSize: 24, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "" } },
      { text: { text: footer, options: { x: 0.6, y: 5.22, w: 7, h: 0.25, fontSize: 9, color: C.text2, margin: 0 } } },
    ],
    slideNumber: { x: 9.0, y: 5.22, w: 0.4, h: 0.25, fontSize: 9, color: HEX.soft, align: "right" },
  });
  pres.defineSlideMaster({
    title: "MANA_DARK",
    background: { color: HEX.ink },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.6, w: 8.8, h: 1.1, fontSize: 30, bold: true, color: C.accent1, valign: "top", align: "left", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 2.85, w: 8.8, h: 1.2, fontSize: 15, color: C.background1, valign: "top", margin: 0 }, text: "" } },
      { text: { text: "マナベル｜AI×Lark 構築者育成講座", options: { x: 0.6, y: 4.95, w: 6, h: 0.3, fontSize: 10, color: C.background1, margin: 0 } } },
    ],
  });

  // ---- 部品 ----
  function chip(slide, label, kind) {
    const fill = kind === "hands" ? C.accent2 : kind === "warn" ? C.accent5 : C.text1;
    const color = kind === "talk" ? C.accent1 : C.background1;
    const w = Math.min(3.2, 0.42 + label.length * 0.15);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 0.32, w, h: 0.32, fill: { color: fill }, line: { color: fill }, rectRadius: 0.16, objectName: "chip" });
    slide.addText(label, { x: 0.6, y: 0.32, w, h: 0.32, fontSize: 11, bold: true, color, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "chip-text" });
  }
  function chipKind(s) { return s.hands ? "hands" : s.warn ? "warn" : "talk"; }
  async function iconCircle(slide, x, y, d, name, bg = C.accent1, fg = HEX.ink) {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: HEX.ink, width: 1.25 }, objectName: "icon-circle" });
    const p = d * 0.26;
    slide.addImage({ data: await icon(name, fg), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, objectName: "icon" });
  }
  function card(slide, x, y, w, h, opts = {}) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h, rectRadius: 0.12, fill: { color: opts.fill || C.background1 },
      line: { color: opts.line || HEX.ink, width: 1.5 }, shadow: comicShadow(), objectName: opts.name || "card",
    });
  }
  async function foot(slide, text, y = 4.5) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y, w: 8.8, h: 0.55, rectRadius: 0.1, fill: { color: C.background2 }, line: { color: C.background2 }, objectName: "foot-box" });
    slide.addImage({ data: await icon("bulb", HEX.orange), x: 0.75, y: y + 0.14, w: 0.27, h: 0.27, objectName: "foot-icon" });
    slide.addText(text, { x: 1.15, y, w: 8.1, h: 0.55, fontSize: 11.5, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "foot-text" });
  }
  function contentSlide(section, s) {
    const slide = pres.addSlide({ masterName: "MANA_CONTENT", sectionTitle: section });
    slide.addText(s.title, { placeholder: "title" });
    if (s.chip) chip(slide, s.chip, chipKind(s));
    if (s.note) slide.addNotes(s.note);
    return slide;
  }

  // ---- 種類ごとの描画 ----
  const R = {
    async cards(slide, s) {
      const cols = s.cols, rows = Math.ceil(s.items.length / cols), gap = 0.25;
      const top = 1.6, bottom = s.foot ? 4.3 : 4.95;
      const w = (8.8 - (cols - 1) * gap) / cols, h = rows === 1 ? Math.min(2.5, bottom - top) : (bottom - top - (rows - 1) * gap) / rows;
      for (let i = 0; i < s.items.length; i++) {
        const it = s.items[i], x = 0.6 + (i % cols) * (w + gap), y = top + Math.floor(i / cols) * (h + gap);
        card(slide, x, y, w, h, { fill: s.warn ? "FFF1F0" : C.background1 });
        let tx = x + 0.2;
        const ic = it.icon || (s.warn ? "warn" : null);
        const small = rows > 1 || cols > 3;
        if (ic) {
          const d = small ? 0.42 : 0.55;
          await iconCircle(slide, x + 0.2, y + 0.2, d, ic, s.warn ? HEX.red : C.accent1, s.warn ? HEX.white : HEX.ink);
          if (!small) tx = x + 0.2;
        }
        const hy = ic ? (small ? y + 0.2 : y + 0.9) : y + 0.2;
        const hx = ic && small ? x + 0.75 : tx;
        slide.addText(it.h, { x: hx, y: hy, w: x + w - 0.2 - hx, h: small ? 0.42 : 0.4, fontSize: cols > 3 ? 17 : 15, bold: true, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "card-head" });
        const by = small ? hy + 0.5 : hy + 0.45;
        slide.addText(it.b, { x: tx, y: by, w: w - 0.4, h: y + h - by - 0.15, fontSize: cols > 3 ? 13 : 13, color: C.text1, valign: "top", margin: 0, isTextBox: true, paraSpaceAfter: 3, objectName: "card-body" });
      }
      if (s.foot) await foot(slide, s.foot);
    },
    async table(slide, s) {
      const total = s.colW.reduce((a, b) => a + b, 0);
      const colW = s.colW.map((v) => (v / total) * 8.8);
      const head = s.head.map((t) => ({ text: t, options: { bold: true, color: HEX.yellow, fill: { color: HEX.ink }, fontSize: 12 } }));
      const rows = s.rows.map((r, i) => r.map((t, j) => ({ text: t, options: { fontSize: 12, bold: j === 0, color: HEX.ink, fill: { color: i % 2 ? HEX.gray : HEX.white } } })));
      const rowH = s.rows.length > 4 ? 0.4 : 0.48;
      slide.addTable([head, ...rows], { x: 0.6, y: 1.6, w: 8.8, colW, rowH, border: { type: "solid", pt: 0.75, color: "BBBBBB" }, valign: "middle", margin: [0, 0.1, 0, 0.1], objectName: "table" });
      if (s.foot) await foot(slide, s.foot);
    },
    async steps(slide, s) {
      const n = s.steps.length, top = 1.6, bottom = s.tip ? 4.25 : 4.95;
      const rowH = Math.min(0.66, (bottom - top) / n);
      const start = top + Math.max(0, (bottom - top - rowH * n) / 2 - 0.1);
      for (let i = 0; i < n; i++) {
        const y = start + i * rowH;
        slide.addShape(pres.shapes.OVAL, { x: 0.6, y: y + (rowH - 0.42) / 2, w: 0.42, h: 0.42, fill: { color: C.accent1 }, line: { color: HEX.ink, width: 1.25 }, objectName: "step-num" });
        slide.addText(String(i + 1), { x: 0.6, y: y + (rowH - 0.42) / 2, w: 0.42, h: 0.42, fontSize: 14, bold: true, color: C.text1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "step-num-text" });
        slide.addText(s.steps[i], { x: 1.2, y, w: 8.2, h: rowH, fontSize: 14.5, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "step-text" });
      }
      if (s.tip) await foot(slide, s.tip, 4.35);
    },
    async prompt(slide, s) {
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 1.6, w: 8.8, h: 3.3, rectRadius: 0.12, fill: { color: HEX.ink }, line: { color: HEX.ink }, shadow: comicShadow(), objectName: "prompt-box" });
      await iconCircle(slide, 0.85, 1.82, 0.5, "ai");
      slide.addText("AIへの頼み方（コピーして使う）", { x: 1.5, y: 1.82, w: 6, h: 0.5, fontSize: 13, bold: true, color: C.accent1, valign: "middle", margin: 0, isTextBox: true });
      slide.addText(s.text, { x: 0.9, y: 2.5, w: 8.2, h: 2.25, fontSize: 13, color: C.background1, valign: "top", margin: 0, isTextBox: true, paraSpaceAfter: 2, objectName: "prompt-text" });
    },
    async compare(slide, s) {
      const top = 1.6, h = s.foot ? 2.7 : 3.3, w = 3.95;
      for (const [k, side] of [[0, s.left], [1, s.right]]) {
        const x = k ? 5.45 : 0.6;
        card(slide, x, top, w, h, { fill: k ? C.background2 : HEX.gray, line: k ? HEX.orange : HEX.ink });
        slide.addText(side.h, { x: x + 0.25, y: top + 0.2, w: w - 0.5, h: 0.45, fontSize: 16, bold: true, color: k ? C.accent2 : C.text1, valign: "middle", margin: 0, isTextBox: true });
        slide.addText(side.items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < side.items.length - 1 } })),
          { x: x + 0.25, y: top + 0.8, w: w - 0.5, h: h - 1.0, fontSize: 13, color: C.text1, valign: "top", margin: 0, paraSpaceAfter: 8, isTextBox: true });
      }
      await iconCircle(slide, 4.73, top + h / 2 - 0.27, 0.54, "arrow", C.accent2, HEX.white);
      if (s.foot) await foot(slide, s.foot);
    },
    async flow(slide, s) {
      const n = s.nodes.length, gap = 0.42, w = (8.8 - (n - 1) * gap) / n, y = 2.0, h = 1.6;
      for (let i = 0; i < n; i++) {
        const x = 0.6 + i * (w + gap);
        card(slide, x, y, w, h, { fill: i === n - 1 ? C.accent1 : C.background1 });
        slide.addText(`STEP ${i + 1}`, { x, y: y + 0.18, w, h: 0.3, fontSize: 10, bold: true, color: C.accent2, align: "center", margin: 0, isTextBox: true });
        slide.addText(s.nodes[i], { x: x + 0.1, y: y + 0.5, w: w - 0.2, h: h - 0.65, fontSize: n > 4 ? 12.5 : 14, bold: true, color: C.text1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "flow-node" });
        if (i < n - 1) slide.addImage({ data: await icon("arrow", HEX.orange), x: x + w + 0.08, y: y + h / 2 - 0.13, w: 0.26, h: 0.26, objectName: "flow-arrow" });
      }
      if (s.foot) await foot(slide, s.foot, 4.15);
    },
    async bigtext(slide, s) {
      card(slide, 0.6, 1.65, 8.8, 2.1, { fill: C.accent1 });
      await iconCircle(slide, 0.9, 1.95, 0.6, "target", C.background1);
      slide.addText(s.big, { x: 1.75, y: 1.75, w: 7.4, h: 1.9, fontSize: 18, bold: true, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "big-text" });
      slide.addText(s.sub, { x: 0.6, y: 4.1, w: 8.8, h: 0.6, fontSize: 15, color: C.text1, valign: "middle", margin: 0, isTextBox: true });
    },
  };

  // ---- 1. 表紙 ----
  pres.addSection({ title: "導入" });
  let slide = pres.addSlide({ masterName: "MANA_TITLE", sectionTitle: "導入" });
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 0.9, w: 2.0, h: 0.62, rectRadius: 0.31, fill: { color: HEX.ink }, line: { color: HEX.ink }, shadow: comicShadow(), objectName: "lesson-badge" });
  slide.addText(`第${L.no}回`, { x: 0.6, y: 0.9, w: 2.0, h: 0.62, fontSize: 22, bold: true, color: C.accent1, align: "center", valign: "middle", margin: 0, isTextBox: true });
  slide.addText(L.title, { placeholder: "title" });
  slide.addText(`${L.phase}　｜　${L.week}`, { placeholder: "body" });
  slide.addShape(pres.shapes.OVAL, { x: 7.15, y: 1.3, w: 2.3, h: 2.3, fill: { color: C.background1 }, line: { color: HEX.ink, width: 2 }, shadow: comicShadow(), objectName: "title-circle" });
  const mainIcon = L.no <= 3 ? "target" : L.no <= 6 ? "lark" : L.no <= 9 ? "ai" : "flag";
  slide.addImage({ data: await icon(mainIcon, HEX.ink), x: 7.75, y: 1.9, w: 1.1, h: 1.1, objectName: "title-icon" });
  slide.addNotes(`第${L.no}回「${L.title.replace("\n", "")}」。前回の宿題の提出状況を確認してから始める。`);

  // ---- 2. 今日のゴールと流れ ----
  slide = contentSlide("導入", { title: "今日のゴールと流れ", chip: "はじめに" });
  const gN = L.goals.length, gGap = 0.25, gW = (8.8 - (gN - 1) * gGap) / gN;
  for (let i = 0; i < gN; i++) {
    const x = 0.6 + i * (gW + gGap);
    card(slide, x, 1.55, gW, 1.4, { fill: C.background2 });
    await iconCircle(slide, x + 0.2, 1.75, 0.45, "check");
    slide.addText(L.goals[i], { x: x + 0.8, y: 1.65, w: gW - 1.0, h: 1.2, fontSize: 14, bold: true, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: "goal" });
  }
  const total = L.time.reduce((a, t) => a + t[1], 0);
  slide.addText(`今日の流れ（${total}分）`, { x: 0.6, y: 3.25, w: 4, h: 0.35, fontSize: 13, bold: true, color: C.text1, margin: 0, isTextBox: true });
  let tx = 0.6;
  for (const [label, min, kind] of L.time) {
    const w = (min / total) * 8.8;
    slide.addShape(pres.shapes.RECTANGLE, { x: tx, y: 3.7, w, h: 0.75, fill: { color: kind === "hands" ? HEX.orange : HEX.ink }, line: { color: HEX.white, width: 1.5 }, objectName: "time-block" });
    slide.addText([{ text: label, options: { breakLine: true } }, { text: `${min}分`, options: { fontSize: 9 } }],
      { x: tx, y: 3.7, w, h: 0.75, fontSize: w < 0.9 ? 8.5 : 10.5, bold: true, color: kind === "hands" ? HEX.white : HEX.yellow, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "time-label" });
    tx += w;
  }
  slide.addText([{ text: "■ ", options: { color: HEX.ink } }, { text: "聞く　", options: {} }, { text: "■ ", options: { color: HEX.orange } }, { text: "手を動かす", options: {} }],
    { x: 0.6, y: 4.55, w: 4, h: 0.3, fontSize: 10, color: C.text2, margin: 0, isTextBox: true });
  slide.addNotes("ゴールを読み上げ、今日は「聞く」と「手を動かす」を交互に進めることを伝える。");

  // ---- 3. 本編 ----
  pres.addSection({ title: "本編" });
  for (const s of L.slides) {
    const sl = contentSlide("本編", s);
    await R[s.type](sl, s);
  }

  // ---- 4. 宿題とチェック ----
  pres.addSection({ title: "まとめ" });
  slide = contentSlide("まとめ", { title: "宿題と、今日のチェック", chip: "まとめ" });
  card(slide, 0.6, 1.6, 4.25, 3.3, { fill: C.background2 });
  await iconCircle(slide, 0.85, 1.8, 0.5, "pen");
  slide.addText("宿題", { x: 1.5, y: 1.8, w: 3, h: 0.5, fontSize: 17, bold: true, color: C.text1, valign: "middle", margin: 0, isTextBox: true });
  slide.addText(L.homework.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < L.homework.length - 1 } })),
    { x: 0.85, y: 2.5, w: 3.8, h: 2.25, fontSize: 13.5, color: C.text1, valign: "top", margin: 0, paraSpaceAfter: 8, isTextBox: true });
  card(slide, 5.15, 1.6, 4.25, 3.3);
  await iconCircle(slide, 5.4, 1.8, 0.5, "check");
  slide.addText("できたらチェック", { x: 6.05, y: 1.8, w: 3, h: 0.5, fontSize: 17, bold: true, color: C.text1, valign: "middle", margin: 0, isTextBox: true });
  slide.addText(L.checks.map((t, i) => ({ text: "☐ " + t, options: { breakLine: i < L.checks.length - 1 } })),
    { x: 5.4, y: 2.5, w: 3.8, h: 2.25, fontSize: 13.5, color: C.text1, valign: "top", margin: 0, paraSpaceAfter: 8, isTextBox: true });
  slide.addNotes("宿題の目安時間を伝える。質問は講座グループへ（24時間以内に返信・土日祝を除く）。");

  // ---- 5. 次回 ----
  slide = pres.addSlide({ masterName: "MANA_DARK", sectionTitle: "まとめ" });
  if (L.no < 12) {
    slide.addText(`次回：${L.next}`, { placeholder: "title" });
    slide.addText("わからないところは、講座グループでいつでも質問してください。\nAPIキーやパスワードは送らないでください。", { placeholder: "body" });
  } else {
    slide.addText("修了おめでとうございます", { placeholder: "title" });
    slide.addText("あなたはもう、自社のしくみを作れる「構築者」です。\n作ったしくみを、使われながら育てていきましょう。", { placeholder: "body" });
  }
  slide.addNotes("次回までの宿題をもう一度確認して終了。");

  const file = path.join(OUT, `manaberu-${L.file}.pptx`);
  await pres.writeFile({ fileName: file });
  await applyTheme(file, THEME);
  return file;
}

(async () => {
  for (const L of LESSONS) {
    if (ONLY.length && !ONLY.includes(L.no)) continue;
    console.log(await buildDeck(L));
  }
})().catch((e) => { console.error(e); process.exit(1); });
