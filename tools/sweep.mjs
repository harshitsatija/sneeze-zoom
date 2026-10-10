// node tools/sweep.mjs <name> z0 z1 [step=0.05] [--t=6] [--q=...] -> shots/sweep_<name>.json + printed pops
// Renders every step at 480x300, mean absolute pixel difference to the previous frame; a pop is a frame whose diff is
// > 1.5x the mean of its two neighbours (flag) or > 2x (FAIL). Also records the visible levels.
import { open, at, arg, positional } from './lib.mjs';
import { PNG } from 'pngjs'; import fs from 'fs'; import path from 'path';
const [name, z0s, z1s, sts] = positional(); const z0 = Number(z0s), z1 = Number(z1s), step = Number(sts || 0.05), t = Number(arg('t', '6'));
const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../shots'); fs.mkdirSync(dir, { recursive: true });
const { browser, page, errors } = await open({ w: 480, h: 300, q: arg('q', '') });
const rows = []; let prev = null; const n = Math.round(Math.abs(z1 - z0) / step) + 1, sgn = z1 >= z0 ? 1 : -1;
for (let i = 0; i < n; i++) {
  const z = +(z0 + sgn * step * i).toFixed(4); const st = await at(page, z, t);
  const buf = await page.screenshot(); const png = PNG.sync.read(buf); const d = png.data;
  let diff = 0; if (prev) { for (let k = 0; k < d.length; k += 4) diff += Math.abs(d[k] - prev[k]) + Math.abs(d[k + 1] - prev[k + 1]) + Math.abs(d[k + 2] - prev[k + 2]); diff /= (d.length / 4) * 3; }
  prev = Buffer.from(d); const vis = await page.evaluate(() => window.__W.levels.filter((L) => !L.zr || (window.__W.z >= L.zr[0] && window.__W.z <= L.zr[1])).map((L) => L.id).join(','));
  rows.push({ z, diff: +diff.toFixed(3), items: st.items, ms: +st.ms.toFixed(1), vis });
}
await browser.close();
const pops = [];
for (let i = 2; i < rows.length - 1; i++) { const nb = (rows[i - 1].diff + rows[i + 1].diff) / 2; const r = rows[i].diff / Math.max(nb, 0.4); if (r > 1.5 && rows[i].diff > 1.0) pops.push({ ...rows[i], ratio: +r.toFixed(2), fail: r > 2 }); }
fs.writeFileSync(`${dir}/sweep_${name}.json`, JSON.stringify({ rows, pops }, null, 1));
const avg = rows.slice(1).reduce((s, r) => s + r.diff, 0) / Math.max(1, rows.length - 1), slow = rows.filter((r) => r.ms > 30);
console.log(`sweep ${name}: ${rows.length} frames, mean diff ${avg.toFixed(2)}, pops ${pops.length} (fail ${pops.filter((p) => p.fail).length}), slow frames(>30ms) ${slow.length}`);
pops.forEach((p) => console.log(`  ${p.fail ? 'FAIL' : 'flag'} z=${p.z} diff=${p.diff} ratio=${p.ratio} vis=${p.vis}`));
if (errors.length) console.log('CONSOLE:', [...new Set(errors)].filter((e) => !e.includes('404')).slice(0, 6).join('\n  '));
