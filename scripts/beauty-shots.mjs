// README 美图：黄昏沁芳亭全景 + 夜色牌坊
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://127.0.0.1:5173/';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1600,900', '--proxy-server=direct://', '--proxy-bypass-list=*'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2000));
await page.click('#enter-btn');
await new Promise((r) => setTimeout(r, 500));
// 隐藏 HUD，纯风景
await page.evaluate(() => { document.getElementById('hud').style.display = 'none'; });

const shot = async (x, z, yaw, pitch, cycleT, name, eyeY = null) => {
  await page.evaluate(({ x, z, yaw, pitch, cycleT, eyeY }) => {
    const g = window.__game;
    g.player.grounded = true;
    const y = eyeY !== null ? eyeY : g.garden.getGroundHeight(x, z);
    g.player.pos.set(x, y, z);
    g.player.yaw = yaw;
    g.player.pitch = pitch;
    g.engine.cycleT = cycleT;
  }, { x, z, yaw, pitch, cycleT, eyeY });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: `scripts/${name}` });
};

// 黄昏：南桥上望沁芳亭（晚霞 + 初上花灯）
await shot(1.5, 22.5, 0.05, 0.02, 0.72, 'beauty-dusk.png');
// 夜：牌坊与大观楼灯火
await shot(0.5, -8, 0, 0.06, 0.82, 'beauty-night.png');

await browser.close();
