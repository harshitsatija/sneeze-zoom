// Real-time continuous zoom like a user: node tools/play.mjs <name> z0 z1 [--dpr=2] [--size=1440x900] [--shots=1]
// Records rAF frame intervals + engine CPU split per frame, optional screencast frames (CDP) during motion.
import puppeteer from 'puppeteer-core'; import fs from 'fs'; import { CH, BASE, arg, positional } from './lib.mjs';
const [name, z0s, z1s] = positional(); const z0 = +z0s, z1 = +z1s; const [w, h] = arg('size', '1440x900').split('x').map(Number); const dpr = +arg('dpr', '2');
const b = await puppeteer.launch({ executablePath: CH, headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${w},${h}`] , defaultViewport: { width: w, height: h, deviceScaleFactor: dpr } });
const p = await b.newPage(); await p.goto(`${BASE}?prof=1&nolabels=0&z=${z0}${process.env.PQ ? "&" + process.env.PQ : ""}`, { waitUntil: 'load' }); await p.waitForFunction('window.__W && window.__warm', { timeout: 180000 });
await new Promise((r) => setTimeout(r, 1500));
const dir = `shots/play_${name}`; if (arg('shots', '0') === '1') fs.mkdirSync(dir, { recursive: true });
const cdp = await p.target().createCDPSession(); let nShot = 0; const shotZ = [];
if (arg('shots', '0') === '1') { cdp.on('Page.screencastFrame', async (f) => { const zz = await p.evaluate(() => window.__W.z).catch(() => 0); fs.writeFileSync(`${dir}/${String(nShot).padStart(4, '0')}.jpg`, Buffer.from(f.data, 'base64')); shotZ.push([nShot, +zz.toFixed(3)]); nShot++; cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 960, maxHeight: 600, everyNthFrame: 1 }); }
await p.evaluate((z0, dir) => { window.__W.profLog.length = 0; window.__W.go(dir); }, z0, z1 < z0 ? -1 : 1);
const dur = Math.abs(z1 - z0) / 0.42 * 1000; await new Promise((r) => setTimeout(r, dur));
await p.evaluate(() => window.__W.go(0));
if (arg('shots', '0') === '1') await cdp.send('Page.stopScreencast');
const log = await p.evaluate(() => window.__W.profLog);
await b.close();
// frame intervals from engine timestamps
const iv = []; for (let i = 1; i < log.length; i++) iv.push(log[i].t - log[i - 1].t);
const sorted = iv.slice().sort((a, c) => a - c), pct = (q) => sorted[Math.floor(q * (sorted.length - 1))] || 0;
const fps = 1000 / (iv.reduce((a, c) => a + c, 0) / Math.max(1, iv.length));
console.log(`${name}: ${log.length} frames over z ${z0}→${z1}, avg fps ${fps.toFixed(1)}, frame interval p50 ${pct(0.5).toFixed(1)} p90 ${pct(0.9).toFixed(1)} p99 ${pct(0.99).toFixed(1)} ms, hitches(>50ms) ${iv.filter((x) => x > 50).length}`);
// worst frames + per-level split, binned by z
const bins = new Map(); for (let i = 1; i < log.length; i++) { const k = Math.round(log[i].z * 2) / 2; const B = bins.get(k) || { n: 0, iv: 0, cpu: 0, runs: 0, lv: {} }; B.n++; B.iv += iv[i - 1]; B.cpu += log[i].ms; B.runs += log[i].runs; for (const [id, m] of Object.entries(log[i].lv)) B.lv[id] = (B.lv[id] || 0) + m; bins.set(k, B); }
for (const [k, B] of [...bins].sort((a, c) => a[0] - c[0])) { const top = Object.entries(B.lv).sort((a, c) => c[1] - a[1]).slice(0, 3).map(([id, m]) => `${id}:${(m / B.n).toFixed(1)}`).join(' ');
  console.log(`  z ${k.toFixed(1).padStart(6)}  fps ${(1000 / (B.iv / B.n)).toFixed(0).padStart(3)}  cpu ${(B.cpu / B.n).toFixed(1).padStart(5)}ms  runs ${(B.runs / B.n).toFixed(1)}  ${top}`); }
const big = log.map((f, i) => [iv[i - 1] || 0, f]).sort((a, c) => c[0] - a[0]).slice(0, 5); console.log('  worst intervals:', big.map(([v, f]) => `${v.toFixed(0)}ms@z${f.z}`).join(' '));
if (shotZ.length) fs.writeFileSync(`${dir}/index.json`, JSON.stringify(shotZ));
