// Real-time check: page runs live (no freeze); for each z, jump there, let it run 2.5 s, measure fps, screenshot.
import puppeteer from 'puppeteer-core'; import { CH, BASE } from './lib.mjs';
const zs = process.argv.slice(2).map(Number);
const b = await puppeteer.launch({ executablePath: CH, headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1440,900'], defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 } });
const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(BASE, { waitUntil: 'load' }); await p.waitForFunction('window.__W && window.__ready', { timeout: 90000 });
for (const z of zs) {
  await p.evaluate((z) => { const W = window.__W; W.at(z); }, z);
  // unfreeze: emulate the user's normal state by reloading at that z without freeze
  await p.goto(BASE + '?z=' + z + (process.env.RTQ ? '&' + process.env.RTQ : ''), { waitUntil: 'load' }); await p.waitForFunction('window.__W && window.__ready', { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1500));
  const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
  await p.screenshot({ path: `shots/rt_${z}.png` }); console.log('z', z, 'fps', fps.toFixed(1));
}
console.log(errs.filter((e) => !e.includes('404')).slice(0, 5).join('\n')); await b.close();
