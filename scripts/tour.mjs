// 巡回截图：传送到各景点，验证场景各部分渲染
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.SMOKE_URL || 'http://127.0.0.1:5173/';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1280,800', '--proxy-server=direct://', '--proxy-bypass-list=*'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2000));
await page.click('#enter-btn');
await new Promise((r) => setTimeout(r, 500));

const spots = [
  { name: 'hengwu2', x: -27, z: -10, yaw: 0.55, pitch: 0.1 },      // 蘅芜苑土山
  { name: 'xiaoxiang2', x: 22, z: 2, yaw: -Math.PI / 2, pitch: 0.05 }, // 潇湘馆竹林
  { name: 'daoxiang2', x: -30, z: 0, yaw: Math.PI * 0.7, pitch: 0 },  // 稻香村茅屋
  { name: 'qinfang', x: 0, z: 27, yaw: 0, pitch: 0.05 },             // 沁芳亭
];

for (const s of spots) {
  await page.evaluate(({ x, z, yaw, pitch }) => {
    const g = window.__game;
    g.player.pos.set(x, g.garden.getGroundHeight(x, z), z);
    g.player.yaw = yaw;
    g.player.pitch = pitch;
    g.player.vel.set(0, 0, 0);
  }, s);
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: `scripts/tour-${s.name}.png` });
}

// 夜景：沁芳亭灯火
await page.evaluate(() => {
  const g = window.__game;
  g.engine.cycleT = 0.82;
  g.player.pos.set(0, g.garden.getGroundHeight(0, 27), 27);
  g.player.yaw = 0;
  g.player.pitch = 0.05;
});
await new Promise((r) => setTimeout(r, 1000));
await page.screenshot({ path: 'scripts/tour-night.png' });

console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
