// node tools/strip.mjs <name> z0 z1 [n=8] [--t=6] [--q=...] [--cols=4] -> shots/strip_<name>.jpg (frames 800x500 with z printed)
import { open, at, arg, positional } from './lib.mjs';
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const [name, z0s, z1s, ns] = positional(); const z0 = Number(z0s), z1 = Number(z1s), n = Number(ns || 8), t = Number(arg('t', '6'));
const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../shots'); const tmp = dir + '/_strip'; fs.mkdirSync(tmp, { recursive: true });
const { browser, page, errors } = await open({ w: 800, h: 500, q: arg('q', '') });
const files = [];
for (let i = 0; i < n; i++) { const z = z0 + (z1 - z0) * i / (n - 1); await at(page, z, t); const f = `${tmp}/${name}_${i}.png`; await page.screenshot({ path: f }); files.push([f, z.toFixed(2)]); }
await browser.close();
const cols = Number(arg('cols', '4'));
execFileSync('python3', ['-I', path.resolve(path.dirname(new URL(import.meta.url).pathname), 'compose.py'), `${dir}/strip_${name}.jpg`, String(cols), ...files.flat()]);
files.forEach(([f]) => fs.unlinkSync(f));
console.log(`${dir}/strip_${name}.jpg`); if (errors.length) console.log('CONSOLE:', [...new Set(errors)].filter((e) => !e.includes('404')).slice(0, 6).join('\n  '));
