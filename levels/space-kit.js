// SPACE kit (owner: SPACE builder). The inside vocabulary, packaged for space: every nebula clump, star cloud, galaxy arm
// piece, web filament bead and dust mote is the SAME stacked-fill blob the body uses for chromatin, mucus and cells
// (a darker rim, the base, a lighter core offset toward the light), and every luminous thing gets the banded glow of
// the inflamed cells (sick-virus/03). Colours come only from PAL (mixed), see STYLE.md.
import { PAL, rgba, mix, blob, L, clamp } from '../core/kit.js';
import { FAM, look } from '../core/look.js';

const TAU = Math.PI * 2;
// the space hues (saturated violet / magenta / cyan / gold), all PAL mixes
// unification pass: the same FAM families as every other scale
export const SPC = {
  violet: FAM.violet.base, violetDeep: look(15).haze, magenta: FAM.magenta.base, magentaLit: FAM.magenta.lit, pink: FAM.magenta.glow,
  cyan: FAM.cyan.lit, cyanLit: FAM.cyan.glow, cyanDeep: FAM.cyan.base, gold: FAM.gold.base, goldRim: FAM.gold.dark, goldHot: FAM.gold.glow, ember: FAM.coral.base,
};

// ---------- stacked-fill blob sprites ----------
// One sprite = a wobbly blob drawn as 3 stacked flat fills: rim (darker, the full shape), body (inset, offset toward the
// light), core (small, lighter, further toward the light). A ~2 % soft edge, so a translucent pile of them reads as a
// soft material (mucus / chromatin), never as a hard cut-out and never as a gradient puff. 4 shape variants per colour.
const SPR = new Map(), S = 128, RAD = 50;
// hi = true: a 3x sprite (same soft edge in screen px) for clouds drawn hundreds of px wide — scaled-up 128 px sprites read
// as out-of-focus bokeh (space v3)
export function blobSprite(col, v = 0, kind = 0, hi = false) {
  const key = col + '|' + (v & 3) + '|' + kind + (hi ? '|h' : ''); let cv = SPR.get(key); if (cv) return cv;
  const Z = hi ? 3 : 1, SS = S * Z, RR = RAD * Z;
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = SS; const g = tmp.getContext('2d');
  const P = blob(9001 + (v & 3) * 37 + kind * 5, kind === 1 ? 0.05 : kind === 2 ? 0.16 : 0.11, 5);
  const lay = (scale, off, color) => { g.save(); g.setTransform(RR * scale, 0, 0, RR * scale, SS / 2 + L[0] * off * RR, SS / 2 + L[1] * off * RR); g.fillStyle = color; g.fill(P); g.restore(); };
  if (kind === 2) { // far haze cloud: no light core, just a slightly lighter, more saturated body (low contrast, like L3 cells)
    lay(1, 0, mix(col, PAL.bodyDeeper, 0.2)); lay(0.8, 0.08, col); lay(0.5, 0.2, mix(col, PAL.macDark, 0.25));
  } else if (kind === 1) { // round bokeh disc (dust / ice motes): flat body, lighter cap toward the light, faint dark rim
    lay(1, 0, mix(col, PAL.bodyDeeper, 0.18)); lay(0.88, 0.05, col); lay(0.5, 0.26, mix(col, '#ffffff', 0.32));
  } else {
    lay(1, 0, mix(col, PAL.bodyDeeper, 0.38)); lay(0.8, 0.09, col); lay(0.44, 0.24, mix(col, '#ffffff', 0.28));
  }
  cv = document.createElement('canvas'); cv.width = cv.height = SS; const o = cv.getContext('2d');
  o.filter = kind === 2 ? 'blur(5px)' : 'blur(1.6px)'; o.drawImage(tmp, 0, 0); o.filter = 'none';
  SPR.set(key, cv); return cv;
}
// draw a blob sprite centred at (x, y) with radius r (the blob's nominal radius) and alpha a
export const SPRITE_K = S / 2 / RAD; // sprite half-size per unit radius
export function drawBlob(c, x, y, r, col, a, v = 0, kind = 0) {
  if (a <= 0.003 || r < 0.3) return; const h = r * SPRITE_K; c.globalAlpha = a; c.drawImage(blobSprite(col, v, kind, h > 110), x - h, y - h, 2 * h, 2 * h);
}

// ---------- banded glow (luminous only): a soft radial halo plus concentric flat bands, like the inflamed cells ----------
const GLW = new Map();
function glowSprite(col, bands) {
  const key = col + '|' + bands; let cv = GLW.get(key); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, rgba(col, 0.55)); gr.addColorStop(0.3, rgba(col, 0.26)); gr.addColorStop(0.65, rgba(col, 0.08)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  // flat bands with slightly soft edges (blurred once at build time)
  const t = document.createElement('canvas'); t.width = t.height = 256; const tg = t.getContext('2d');
  for (let k = 1; k <= bands; k++) { tg.fillStyle = rgba(col, 0.11); tg.beginPath(); tg.arc(128, 128, 128 * (0.3 + 0.62 * k / bands), 0, TAU); tg.fill(); }
  g.filter = 'blur(2.5px)'; g.drawImage(t, 0, 0); g.filter = 'none';
  GLW.set(key, cv); return cv;
}
export function bandGlow(c, x, y, r, col, a = 1, bands = 4) {
  if (!(r > 0.8) || !isFinite(r) || a <= 0.003) return;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = clamp(a, 0, 1); c.drawImage(glowSprite(col, bands), x - r, y - r, 2 * r, 2 * r); c.restore();
}

// ---------- the stacked-fill sphere (screen space): base, dark crescent away from the light, light crescent toward it,
// flat highlight ellipse. lx, ly = unit direction toward the light on screen (y down).
const UNIT = (() => { const p = new Path2D(); p.arc(0, 0, 1, 0, TAU); return p; })();
export function crescentFill(c, color, dx, dy) { // inside the current unit disc transform
  c.save(); c.clip(UNIT); const p = new Path2D(); p.addPath(UNIT); p.addPath(UNIT, new DOMMatrix([1, 0, 0, 1, dx, dy])); c.fillStyle = color; c.fill(p, 'evenodd'); c.restore();
}
export function stackBall(c, x, y, r, base, dark, lit, hi, lx = L[0], ly = L[1], hiA = 0.85) {
  c.save(); c.translate(x, y); c.scale(r, r);
  c.fillStyle = base; c.fill(UNIT);
  if (dark) crescentFill(c, dark, lx * 0.26, ly * 0.26);
  if (lit) crescentFill(c, lit, -lx * 0.1, -ly * 0.1);
  if (hi && r > 2.5) { c.globalAlpha = hiA; c.fillStyle = hi; c.beginPath(); c.ellipse(lx * 0.42, ly * 0.42, 0.28, 0.17, Math.atan2(ly, lx) + Math.PI / 2, 0, TAU); c.fill(); }
  c.restore();
}
