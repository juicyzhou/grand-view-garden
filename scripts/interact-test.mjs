// 端到端：俯瞰布局 + NPC 对话 + 诗碑
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
await new Promise((r) => setTimeout(r, 400));

// 俯瞰全园
await page.evaluate(() => {
  const g = window.__game;
  g.player.pos.set(0, 60, 44);
  g.player.grounded = false;
  g.player.yaw = 0;
  g.player.pitch = -1.1;
});
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: 'scripts/aerial.png' });

// 传送到黛玉面前，按 E 交谈
await page.evaluate(() => {
  const g = window.__game;
  g.player.grounded = true;
  g.player.pos.set(32, g.garden.getGroundHeight(32, 3.5), 3.5);
  g.player.yaw = -Math.PI / 2;
  g.player.pitch = 0;
});
await new Promise((r) => setTimeout(r, 600));
const hint = await page.evaluate(() => document.getElementById('interact-hint').textContent);
await page.keyboard.press('KeyE');
await new Promise((r) => setTimeout(r, 1500));
const dlg = await page.evaluate(() => ({
  visible: !document.getElementById('dialogue').classList.contains('hidden'),
  name: document.getElementById('dlg-name').textContent,
  text: document.getElementById('dlg-text').textContent,
}));
await page.screenshot({ path: 'scripts/dialogue.png' });
await page.keyboard.press('KeyE'); // 推进对话
await new Promise((r) => setTimeout(r, 300));

// 诗碑
await page.evaluate(() => {
  const g = window.__game;
  g.hud.closePanels();
  g.player.pos.set(4.2, 0, 39.5);
  g.player.yaw = Math.PI;
});
await new Promise((r) => setTimeout(r, 500));
await page.keyboard.press('KeyE');
await new Promise((r) => setTimeout(r, 500));
const poem = await page.evaluate(() => ({
  visible: !document.getElementById('poem-panel').classList.contains('hidden'),
  title: document.getElementById('poem-title').textContent,
}));
await page.screenshot({ path: 'scripts/poem.png' });

console.log(JSON.stringify({ hint, dlg, poem, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
