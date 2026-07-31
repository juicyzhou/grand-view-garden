// 游记追踪器块尺寸验证：修复后块应贴合文字（高 ~50px），不再拉伸
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.TRACKER_URL || 'http://127.0.0.1:5173/';

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
await new Promise((r) => setTimeout(r, 5000));
await page.tap('#enter-btn');
await new Promise((r) => setTimeout(r, 1500));

const m = await page.evaluate(() => {
  const t = document.getElementById('quest-tracker');
  const cs = getComputedStyle(t);
  const r = t.getBoundingClientRect();
  const coarse = matchMedia('(pointer: coarse)').matches;
  return {
    coarse,
    top: cs.top, bottom: cs.bottom, height: cs.height,
    rectH: Math.round(r.height), rectW: Math.round(r.width), rectY: Math.round(r.y),
    viewportH: innerHeight,
  };
});
console.log(JSON.stringify(m));
await page.screenshot({ path: 'scripts/tracker-fixed.png' });
const pass = m.coarse && m.rectH < 80; // 两行文字 ≈ 45~55px
console.log(pass ? 'PASS: 块已贴合文字' : 'FAIL: 块仍异常');
await browser.close();
process.exit(pass ? 0 : 1);
