import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--proxy-server=direct://', '--proxy-bypass-list=*'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => console.log('CONSOLE:', m.type(), m.text().slice(0, 140)));

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));

const info = await page.evaluate(async () => {
  const res = await fetch('/src/main.js');
  const text = await res.text();
  return {
    gameType: typeof window.__game,
    servedHasGame: text.includes('__game'),
    servedLen: text.length,
    loadingHidden: document.getElementById('loading').classList.contains('hidden'),
    titleShown: !document.getElementById('title-screen').classList.contains('hidden'),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
process.exit(0);
