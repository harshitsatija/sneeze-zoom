import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'] });
const p = await b.newPage(); p.on('pageerror', (e) => console.log('ERR', String(e))); p.on('console', (m) => m.type() === 'error' && console.log('CON', m.text()));
await p.goto('http://localhost:8790/index.html?shot=1&freeze=1', { waitUntil: 'load' }); await new Promise((r) => setTimeout(r, 8000));
console.log('ready', await p.evaluate(() => !!window.__ready)); await b.close();
