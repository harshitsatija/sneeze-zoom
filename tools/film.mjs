// node tools/film.mjs <name> [step=1] [--t=4.2] [--z0=-34.6] [--z1=27.2] [--cols=8] -> shots/film_<name>.jpg overview contact sheet
import { open, at, arg, positional } from './lib.mjs';
import fs from 'fs'; import path from 'path'; import { execFileSync } from 'child_process';
const [name, sts] = positional(); const step = Number(sts || 1), t = Number(arg('t', '4.2')), z0 = Number(arg('z0', '-34.6')), z1 = Number(arg('z1', '27.2'));
const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../shots'); const tmp = dir + '/_film'; fs.mkdirSync(tmp, { recursive: true });
const { browser, page, errors } = await open({ w: 800, h: 500, q: arg('q', '') });
const files = []; const ms = [];
for (let z = z0, i = 0; z <= z1 + 1e-9; z += step, i++) { const st = await at(page, z, t); ms.push([z, st.ms]); const f = `${tmp}/${name}_${i}.png`; await page.screenshot({ path: f }); files.push([f, z.toFixed(2)]); }
await browser.close();
execFileSync('python3', ['-I', path.resolve(path.dirname(new URL(import.meta.url).pathname), 'compose.py'), `${dir}/film_${name}.jpg`, arg('cols', '8'), ...files.flat()]);
files.forEach(([f]) => fs.unlinkSync(f));
console.log(`${dir}/film_${name}.jpg`); console.log('slowest:', ms.sort((a, b) => b[1] - a[1]).slice(0, 5).map(([z, m]) => `z=${z.toFixed(1)}:${m.toFixed(0)}ms`).join(' '));
if (errors.length) console.log('CONSOLE:', [...new Set(errors)].filter((e) => !e.includes('404')).slice(0, 8).join('\n  '));
