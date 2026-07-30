// 沁芳亭地板反光排查：亭中俯瞰/平视地板
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://127.0.0.1:5173/';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1280,800', '--proxy-server=direct://', '--proxy-bypass-list=*'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2000));
await page.click('#enter-btn');
await new Promise((r) => setTimeout(r, 500));

const shot = async (x, z, yaw, pitch, cycleT, name) => {
  await page.evaluate(({ x, z, yaw, pitch, cycleT }) => {
    const g = window.__game;
    g.player.grounded = true;
    g.player.pos.set(x, g.garden.getGroundHeight(x, z), z);
    g.player.yaw = yaw;
    g.player.pitch = pitch;
    g.engine.cycleT = cycleT;
  }, { x, z, yaw, pitch, cycleT });
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: `scripts/${name}` });
};

// 沁芳亭位置：池心洲 (2,16)；亭在其上
await shot(2, 16.5, 0, -0.9, 0.45, 'floor-down.png');  // 正午俯视地板
await shot(2, 18.5, Math.PI, -0.35, 0.45, 'floor-mid.png'); // 亭南侧平视地板
await shot(2, 16.5, 0, -0.9, 0.32, 'floor-morning.png'); // 清晨斜光
// 匾额特写：有凤来仪厅
await shot(31.5, -1, Math.PI / 2, 0.12, 0.4, 'plaque-hall.png');
// 匾额特写：潇湘馆月门
await shot(22.5, 2, Math.PI / 2, 0.18, 0.4, 'plaque-gate.png');

await browser.close();
