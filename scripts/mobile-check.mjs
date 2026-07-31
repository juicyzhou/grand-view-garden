// 手机端显示排查：iPhone 视口标题屏 + 入园后 HUD
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
  viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: 'scripts/mobile-title.png' });

// 入园后 HUD 布局
await page.tap('#enter-btn');
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: 'scripts/mobile-game.png' });

// 对话面板移动版式
await page.evaluate(() => {
  const g = window.__game;
  g.player.grounded = true;
  g.player.pos.set(32, g.garden.getGroundHeight(32, 3.5), 3.5);
  g.player.yaw = -Math.PI / 2;
});
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => window.__game.hud.onInteractKey());
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: 'scripts/mobile-dialogue.png' });

console.log('done');
await browser.close();
