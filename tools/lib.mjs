// Shared puppeteer harness: ONE Chrome on the real GPU (Metal), page reused for every frame.
import puppeteer from 'puppeteer-core';
export const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const BASE = process.env.SNEEZE_URL || 'http://localhost:8790/index.html';
export async function open({ w = 1600, h = 1000, q = '' } = {}) {
  const browser = await puppeteer.launch({ executablePath: CH, headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', `--window-size=${w},${h}`, '--force-device-scale-factor=1'], defaultViewport: { width: w, height: h, deviceScaleFactor: 1 } });
  const page = await browser.newPage(); const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)));
  await page.goto(`${BASE}?freeze=1&shot=1&dpr=1${q ? '&' + q : ''}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__W && window.__ready', { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  return { browser, page, errors };
}
export async function at(page, z, t) { const s = await page.evaluate((z, t) => window.__W.at(z, t), z, t); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r()))); return s; }
export function arg(name, def) { const a = process.argv.find((x) => x.startsWith('--' + name + '=')); return a ? a.split('=').slice(1).join('=') : def; }
export const positional = () => process.argv.slice(2).filter((x) => !x.startsWith('--'));
