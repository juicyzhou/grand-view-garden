// 线上部署的手机端真实状态验证
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'https://juicyzhou.github.io/grand-view-garden/';

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

await page.goto(URL, { waitUntil: 'load', timeout: 45000 });
await new Promise((r) => setTimeout(r, 4000));
const info = await page.evaluate(() => ({
  version: document.getElementById('version-tag')?.textContent,
  titleSub: document.querySelector('.title-sub')?.textContent,
  hudHidden: document.getElementById('hud')?.classList.contains('hidden'),
}));
console.log(JSON.stringify(info));
await page.screenshot({ path: 'scripts/mobile-live-title.png' });

await page.tap('#enter-btn');
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: 'scripts/mobile-live-game.png' });
console.log('done');
await browser.close();
