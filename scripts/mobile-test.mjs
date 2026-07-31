// 手机端复现与回归：竖屏仿真截图标题屏与游戏内画面
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://127.0.0.1:5173/';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--proxy-server=direct://', '--proxy-bypass-list=*'],
});
const page = await browser.newPage();
await page.emulate({
  viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0',
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: 'scripts/mobile-title.png' });

await page.tap('#enter-btn');
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: 'scripts/mobile-game.png' });

// 量测画布实际覆盖范围
const metrics = await page.evaluate(() => {
  const c = document.getElementById('scene');
  const r = c.getBoundingClientRect();
  return {
    innerW: window.innerWidth, innerH: window.innerHeight,
    canvasW: r.width, canvasH: r.height, canvasLeft: r.left,
    styleW: c.style.width, styleH: c.style.height,
    dpr: window.devicePixelRatio,
    docW: document.documentElement.clientWidth,
    bodyScrollW: document.body.scrollWidth,
  };
});
console.log(JSON.stringify({ metrics, errors }, null, 2));
await browser.close();
