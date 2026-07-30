import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--proxy-server=direct://', '--proxy-bypass-list=*'],
});
console.log('browser launched');

const page = await browser.newPage();
page.on('request', (r) => console.log('REQ', r.url().slice(0, 80)));
page.on('response', (r) => console.log('RES', r.status(), r.url().slice(0, 60)));
page.on('requestfailed', (r) => console.log('FAIL', r.url().slice(0, 60), r.failure()?.errorText));

try {
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('GOTO OK');
} catch (e) {
  console.log('GOTO FAILED:', e.message);
}
await browser.close();
process.exit(0);
