// 运行时冒烟测试：加载页面 → 收集控制台错误 → 入画 → 截图
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5173/';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--use-gl=angle', '--enable-webgl', '--no-sandbox', '--window-size=1280,800',
    "--proxy-server='direct://'", '--proxy-bypass-list=*',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`));

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));

// 标题屏是否出现
const titleVisible = await page.evaluate(() => {
  return !document.getElementById('title-screen').classList.contains('hidden');
});

await page.screenshot({ path: 'scripts/shot-title.png' });

// 入画
await page.click('#enter-btn');
await new Promise((r) => setTimeout(r, 1200));

// 模拟行走 + 环视
await page.keyboard.down('KeyW');
await new Promise((r) => setTimeout(r, 2500));
await page.keyboard.up('KeyW');
await page.screenshot({ path: 'scripts/shot-ingame.png' });

// 检查 HUD 状态
const hudState = await page.evaluate(() => ({
  hudVisible: !document.getElementById('hud').classList.contains('hidden'),
  webgl: !!document.querySelector('#scene'),
}));

// 昼夜切换
await page.click('#btn-cycle');
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: 'scripts/shot-night.png' });

console.log(JSON.stringify({ titleVisible, hudState, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
