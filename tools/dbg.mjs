import { open, at } from '/Users/harshitnatoma/dot-world/sneeze/tools/lib.mjs';
const { browser, page, errors } = await open({ w: 800, h: 500 });
await at(page, -0.3, 4.18);
const r = await page.evaluate(async () => { const m = await import('/core/anchors.js'); return m.sneeze(4.18); });
console.log(JSON.stringify(r)); console.log(errors.join('\n'));
await browser.close();
