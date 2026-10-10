// node tools/shot.mjs <prefix> z1 z2 ... [--t=6] [--size=1600x1000] [--q=only=man&nolabels]
import { open, at, arg, positional } from './lib.mjs';
import fs from 'fs'; import path from 'path';
const [prefix, ...zs] = positional(); const [w, h] = arg('size', '1600x1000').split('x').map(Number); const t = Number(arg('t', '6'));
const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../shots'); fs.mkdirSync(dir, { recursive: true });
const { browser, page, errors } = await open({ w, h, q: arg('q', '') });
for (const z of zs) { const t0 = Date.now(); const st = await at(page, Number(z), t); const out = `${dir}/${prefix}${z}.png`; await page.screenshot({ path: out });
  console.log(out, `items=${st.items} drawn=${st.drawn} runs=${st.runs} ms=${st.ms.toFixed(1)} wall=${Date.now() - t0}ms`); }
if (errors.length) console.log('CONSOLE:', [...new Set(errors)].slice(0, 8).join('\n  '));
await browser.close();
