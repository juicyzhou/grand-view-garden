// v1.1.0 视觉检查：引路花灯夜景、潇湘馆月门、人物特写
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
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2000));
await page.click('#enter-btn');
await new Promise((r) => setTimeout(r, 500));

const teleport = (x, z, yaw, pitch = 0, cycleT = null) => page.evaluate(({ x, z, yaw, pitch, cycleT }) => {
  const g = window.__game;
  g.player.grounded = true;
  g.player.pos.set(x, g.garden.getGroundHeight(x, z), z);
  g.player.yaw = yaw;
  g.player.pitch = pitch;
  if (cycleT !== null) g.engine.cycleT = cycleT;
}, { x, z, yaw, pitch, cycleT });

// 1. 南门黄昏：引路花灯亮起，望向曲径通幽
await teleport(2.5, 41, Math.PI * 0.02, 0, 0.74);
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: 'scripts/v110-lamps.png' });

// 2. 潇湘馆月洞门正面：匾额 + 砖框 + 视线直通
await teleport(21.5, 2, Math.PI / 2 + 0.15, 0.05, 0.4);
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: 'scripts/v110-moongate.png' });

// 3. 馆内花径视角：月门望向厅堂
await teleport(27, 1.5, Math.PI / 2, 0, 0.4);
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: 'scripts/v110-court.png' });

// 4. 宝玉特写：金冠抹额 + 通灵宝玉
await teleport(31.2, -24, Math.PI / 2, 0.02, 0.45);
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: 'scripts/v110-baoyu.png' });

// 5. 妙玉特写：尼帽拂尘（栊翠庵）
await page.evaluate(() => {
  const g = window.__game;
  const spot = g.npcMgr.npcs.find((n) => n.id === 'miaoyu');
  const x = spot.fig.position.x - 1.6, z = spot.fig.position.z + 0.4;
  g.player.grounded = true;
  g.player.pos.set(x, g.garden.getGroundHeight(x, z), z);
  g.player.yaw = Math.PI / 2;
  g.player.pitch = 0;
});
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: 'scripts/v110-miaoyu.png' });

console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
