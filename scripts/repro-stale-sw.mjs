// 复现 + 修复证明：旧部署 Service Worker 缓存劫持导致标题遮罩卡死
//
// 原理：用户手机访问过同域旧部署，其注册的 SW 以 cache-first 拦截导航。
// 旧 SW 卸载检查得到 404 后永久滞留，持续用旧缓存（旧 HTML/CSS/JS）应答，
// 于是出现用户截图所示症状：旧标题（太虚幻境/贾元春联）+ 旧版 v1.1.2
// 角标 + 任务追踪在跑，但点「入画」后遮罩不消失。
//
// 本脚本用本地服务器完整重演该机制（旧页为重构替身——旧工程从未入库），
// 然后证明：清除 SW/缓存后（即 v1.1.2 启动清理或用户手动清站点数据），
// 同一浏览器加载当前构建，标题正常、入画后遮罩消失。
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DIST = new URL('../dist', import.meta.url).pathname;
const PORT = 4199;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

// —— 旧部署重构替身（症状来自用户截图：太虚幻境印、贾元春联、入画后遮罩不消）——
const OLD_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>大观园</title><style>
  body{margin:0;background:#1a1512;font-family:serif;overflow:hidden}
  #title-screen{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:18px;color:#e8dcc0;
    background:rgba(30,24,18,0.55);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
  /* 旧构建缺陷：.hidden 规则从未定义/被覆盖，start() 只加类名，遮罩因此永不消失 */
  .seal{width:64px;height:64px;border:2px solid #a63a2c;color:#a63a2c;display:flex;
    align-items:center;justify-content:center;font-size:20px;writing-mode:vertical-rl;letter-spacing:2px}
  h1{font-size:34px;margin:0;letter-spacing:8px;font-weight:400}
  .couplet{font-size:14px;opacity:.8;letter-spacing:2px}
  #enter-btn{margin-top:12px;padding:12px 42px;font-size:18px;letter-spacing:6px;
    background:none;border:1px solid #d8b96a;color:#d8b96a;font-family:serif}
  #version-tag{position:absolute;bottom:14px;right:16px;font-size:12px;opacity:.6}
  #quest-tracker{position:fixed;left:12px;bottom:150px;z-index:40;color:#e8dcc0;
    background:rgba(20,16,12,.72);padding:8px 12px;border:1px solid rgba(216,185,106,.35);font-size:12px}
  canvas{position:fixed;inset:0}
</style></head><body>
<canvas id="scene" width="390" height="700"></canvas>
<div id="quest-tracker">游记 · 零/玖<div>下一站 · 沿引路花灯，穿过曲径通幽</div></div>
<div id="title-screen">
  <div class="seal">太虚幻境</div>
  <h1>大观园</h1>
  <div class="couplet">贾元春才选凤藻宫 · 秦鲸卿夭逝黄泉路</div>
  <button id="enter-btn">一梦入红楼</button>
  <div id="version-tag">v1.1.2</div>
</div>
<script>
  // 旧构建的 start()：只 add('hidden')，而样式表里没有该类的规则 → 遮罩驻留
  document.getElementById('enter-btn').addEventListener('click', () => {
    document.getElementById('title-screen').classList.add('hidden');
  });
  const c = document.getElementById('scene').getContext('2d');
  c.fillStyle = '#2b3a2e'; c.fillRect(0, 0, 390, 700); // 伪场景：表示游戏已在运行
  c.fillStyle = '#d8b96a'; c.font = '16px serif'; c.fillText('（游戏画面运行中）', 130, 350);
</script></body></html>`;

const OLD_SW = `self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(caches.open('old-v1').then(async (cache) => {
      const hit = await cache.match('/__old__/index.html');
      if (hit) return hit;
      const res = await fetch('/__old__/index.html');
      cache.put('/__old__/index.html', res.clone());
      return res;
    }));
  }
});`;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/sw.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(OLD_SW); }
  if (url === '/__old__/index.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(OLD_HTML); }
  const path = join(DIST, url === '/' ? 'index.html' : url);
  if (existsSync(path)) {
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    return res.end(readFileSync(path));
  }
  res.writeHead(404); res.end('nf');
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

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
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// —— 阶段 0：访问旧部署，注册 SW（模拟用户手机上个月的状态）——
await page.goto(`http://127.0.0.1:${PORT}/__old__/index.html`, { waitUntil: 'load' });
await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
await new Promise((r) => setTimeout(r, 800));

// —— 阶段 1【复现】：重新进站，SW 拦截导航返回旧页 ——
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 1200));
const stale = await page.evaluate(() => ({
  couplet: document.querySelector('.couplet')?.textContent ?? null,
  version: document.getElementById('version-tag')?.textContent ?? null,
  swControlled: !!navigator.serviceWorker.controller,
}));
console.log('REPRO stale page =', JSON.stringify(stale));
await page.tap('#enter-btn');
await new Promise((r) => setTimeout(r, 1200));
const overlayAfterTap = await page.evaluate(() => {
  const el = document.getElementById('title-screen');
  const cs = getComputedStyle(el);
  return { display: cs.display, visible: cs.display !== 'none' && el.offsetHeight > 0 };
});
console.log('REPRO overlay after 入画 =', JSON.stringify(overlayAfterTap));
await page.screenshot({ path: 'scripts/repro-stale-stuck.png' });

// —— 阶段 2【修复】：清 SW + 清缓存（= v1.1.2 启动清理逻辑/用户手动清站点数据）——
await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
});
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 6000));
const fresh = await page.evaluate(() => ({
  version: document.getElementById('version-tag')?.textContent ?? null,
  titleSub: document.querySelector('.title-sub')?.textContent ?? null,
  swControlled: !!navigator.serviceWorker.controller,
}));
console.log('FIXED fresh page =', JSON.stringify(fresh));
await page.screenshot({ path: 'scripts/repro-fixed-title.png' });
await page.tap('#enter-btn');
await new Promise((r) => setTimeout(r, 2500));
const fixedOverlay = await page.evaluate(() => {
  const el = document.getElementById('title-screen');
  const cs = getComputedStyle(el);
  return { display: cs.display, hidden: cs.display === 'none' || el.offsetHeight === 0 };
});
console.log('FIXED overlay after 入画 =', JSON.stringify(fixedOverlay));
await page.screenshot({ path: 'scripts/repro-fixed-game.png' });

const expectedVersion = 'v' + JSON.parse(readFileSync(join(DIST, '../package.json'), 'utf8')).version;
const pass = stale.couplet?.includes('贾元春') && overlayAfterTap.visible
  && fresh.titleSub?.includes('沉 浸 游 园') && fresh.version === expectedVersion
  && fixedOverlay.hidden && errors.length === 0;
console.log(pass ? 'PASS: 复现成立，修复有效' : `FAIL errors=${JSON.stringify(errors)}`);
await browser.close();
server.close();
process.exit(pass ? 0 : 1);
