// 使い方:
//   node render.mjs stills 3 9 17 ...   指定秒のスクリーンショットを stills/ に保存
//   node render.mjs video [assets/bgm.m4a]  60秒をMP4に書き出す（out/sasayell_pv.mp4）
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const DURATION = 60;
const FPS = 30;
const mode = process.argv[2] ?? 'stills';
const here = path.dirname(new URL(import.meta.url).pathname);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(path.join(here, 'pv.html')).href + '#record');
await page.evaluate(() => window.ready);
await page.waitForTimeout(500);

if (mode === 'stills') {
  mkdirSync(path.join(here, 'stills'), { recursive: true });
  for (const t of process.argv.slice(3).map(Number)) {
    await page.evaluate(t => window.seek(t), t);
    await page.screenshot({ path: path.join(here, 'stills', `t${String(t).padStart(5, '0')}.png`) });
  }
} else {
  mkdirSync(path.join(here, 'out'), { recursive: true });
  const audio = process.argv[3];
  const args = ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-'];
  if (audio) args.push('-i', audio, '-shortest', '-c:a', 'aac', '-b:a', '192k');
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart',
    path.join(here, 'out', 'sasayell_pv.mp4'));
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = DURATION * FPS;
  for (let i = 0; i < total; i++) {
    await page.evaluate(t => window.seek(t), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.error(`frame ${i}/${total}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
await browser.close();
