# マナベル 講義スライド（全12回・PowerPoint）

各回のテキスト（[../lessons/](../lessons/)）をもとにした、講義で映すスライドです。PowerPoint・Keynote・Googleスライドで開いて編集できます。

| 回 | ファイル | 枚数 |
|---|---|---|
| 1 | manaberu-01-orientation.pptx | 10 |
| 2 | manaberu-02-ai-basics.pptx | 10 |
| 3 | manaberu-03-lark-basics.pptx | 8 |
| 4 | manaberu-04-base-design.pptx | 10 |
| 5 | manaberu-05-form-view-dashboard.pptx | 8 |
| 6 | manaberu-06-automation.pptx | 9 |
| 7 | manaberu-07-claude-code-intro.pptx | 10 |
| 8 | manaberu-08-publish-web.pptx | 9 |
| 9 | manaberu-09-connect-lark-api.pptx | 10 |
| 10 | manaberu-10-line-liff.pptx | 9 |
| 11 | manaberu-11-operation-security.pptx | 8 |
| 12 | manaberu-12-final-presentation.pptx | 8 |

## 各回の構成
1. 表紙（第◯回・フェーズ・週）
2. 今日のゴールと流れ（90分の時間配分を帯で表示）
3. 本編：説明①（黒ラベル）→ ハンズオン①（オレンジラベル）→ 説明② → ハンズオン②
4. 宿題と、今日のチェック
5. 次回予告

- 講師メモは各スライドの「ノート」に入っています（発表者ビューで見られます）。第1回は、話す言葉そのものの講師台本がノートに入っています（[第1回 講師台本](../lessons/01-talk-script.md)）。
- 第8〜10回には、講師デモ版「まなべ食堂」のスマホ画面を「完成イメージ」として入れています。Lark・LINEとの通信を偽物に差し替えて撮った画面です。Lark・Cloudflare・LINE の管理画面は、講師環境で画面共有して見せます。
- デザインは「ささエール_スライドブランドガイド」（Canva「BNI_メインプレゼン_制作実績」）と同じトンマナです。黄色の集中線×ドット背景に黒文字、情報は黒フチ＋黒いベタ影の白カード、強調はオレンジ（見出しの「」の中の言葉は自動でオレンジ）。
- 色は #FFD600（メイン）／#F5A623（サブ）／#DD6420（強調）／#1A1A1A（文字）／#FFFFFF（カード）の5色だけです。テーマ（SasaYell）にも同じ5色を入れてあります。
- フォントは、見出しが「けいふぉんと」（英字は Dela Gothic One）、本文が Noto Sans JP（Bold／Medium）です。映すPCにこの3つのフォントを入れておいてください（入っていないと別のフォントで表示されます）。
- 表紙と最終スライドには講師写真（`images/representative-sm.png`）を入れています。

## 作り直すとき（講師・開発用）
文章は `src/lessons.js`、デザインは `src/build.js`、講師台本は `src/talk-XX.js`（あれば発表者ノートを置き換え）、画面写真は `src/img/` にあります。台本の時間チェックは `node talk-check.js 01` で行えます。

```
cd manaberu/slides/src
npm install
node build.js ..
```

`build.js` は書き出したあとに、テーマの色・フォントをブランドに合わせ、見出しの和文フォントを「けいふぉんと」に差し替えます。
