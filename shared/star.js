// Shared star / luminous-point renderer (owner: COSMOS agent). ONE law for every luminous point in the film:
// HYG stars, the Sun seen from afar, star complexes in galaxies, galaxy nuclei, galaxies of the cosmic web.
//
// Stable API (used by the SOLAR agent for the Sun as a point):
//   drawStar(c, x, y, rPx, color, brightness)   SCREEN space (call screenSpace(c) first).
//     rPx = true radius in pixels (may be << 1); brightness 0..1 scales the glow and the flare.
//
// The camera law: a point's look depends ONLY on its apparent magnitude m (from its real luminosity and its real
// distance to the camera) against the camera's limiting magnitude mLim(z) (a smooth, monotone exposure curve).
//   delta = mLim - m.  delta < -1.5: invisible. Core radius, alpha, glow and the 4-point cross flare all grow
//   continuously with delta (no thresholds that pop), so a star dims and shrinks only because it gets farther away.
import { PAL, mix, rgba, clamp, glow as kitGlow } from '../core/kit.js';

// ---------- colour from B−V (Kurzgesagt true-limits/01 palette: cyan, violet-blue, white, warm, orange, red) ----------
export const TINTS = [PAL.starCyan, '#8f86ff', PAL.star, '#ffd88a', PAL.starOrange, PAL.starRed, PAL.starViolet, '#ff6ab0'];
export const T_CYAN = 0, T_CYANW = 1, T_WHITE = 2, T_WARM = 3, T_ORANGE = 4, T_RED = 5, T_VIOLET = 6, T_PINK = 7;
export function tintOf(ci) { return ci < 0.0 ? 0 : ci < 0.3 ? 1 : ci < 0.6 ? 2 : ci < 0.9 ? 3 : ci < 1.3 ? 4 : 5; }
const DOT = TINTS.map((t) => mix('#ffffff', t, 0.75)); // small stars carry their colour

// ---------- exposure: limiting magnitude by zoom (monotone cubic through control points) ----------
const EXP = [[5.0, 6.6], [18.4, 6.6], [19.3, 7.9], [20.3, 9.9], [21.3, 11.6], [22.3, 12.8], [23.3, 13.9], [24.0, 16.5], [25.0, 18.6], [26.3, 20.4], [27.2, 21.8]];
const EXPM = (() => { // Fritsch–Carlson slopes
  const n = EXP.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((EXP[i + 1][1] - EXP[i][1]) / (EXP[i + 1][0] - EXP[i][0]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i]; const s = a * a + b * b; if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; } }
  return m;
})();
export function mLim(z) {
  if (z <= EXP[0][0]) return EXP[0][1]; const n = EXP.length; if (z >= EXP[n - 1][0]) return EXP[n - 1][1];
  let i = 0; while (z > EXP[i + 1][0]) i++;
  const h = EXP[i + 1][0] - EXP[i][0], t = (z - EXP[i][0]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * EXP[i][1] + (t3 - 2 * t2 + t) * h * EXPM[i] + (-2 * t3 + 3 * t2) * EXP[i + 1][1] + (t3 - t2) * h * EXPM[i + 1];
}
export const PC_M = 3.0857e16;
// apparent magnitude from absolute magnitude and squared distance in metres
export const appMag = (M, d2) => M + 1.0857362 * Math.log(d2 / (PC_M * PC_M * 100)); // 2.5*log10(d²/(10pc)²)

// ---------- the look as a function of delta ----------
export const VIS = -0.3; // (space restyle) fewer, more designed points: the faintest 0.7 mag of the old field is gone
export function look(delta, s = 1) {
  const a = clamp((delta - VIS) / 2.2, 0, 1);
  const r = Math.max(0.95 * Math.max(s, 0.6), Math.min(0.8 + 0.34 * Math.max(0, delta), 3.6) * s); // soft round dots, never 1 px noise
  const gr = delta > 1.5 ? Math.min(r * (2.2 + 0.9 * (delta - 1.5)), 52 * s) : 0, ga = delta > 1.5 ? 0.45 * Math.min(1, (delta - 1.5) / 2) : 0;
  const fl = delta > 2.8 ? Math.min(r * (4.2 + 1.9 * (delta - 2.8)), 38 * s) : 0, fa = delta > 2.8 ? 0.8 * Math.min(1, (delta - 2.8) / 1.4) : 0; // a gentle flare
  return { a, r, gr, ga, fl, fa };
}

// ---------- sprites (built once): soft glow disc and a 4-point cross flare, per tint ----------
let SPR = null;
function sprites() {
  if (SPR) return SPR; SPR = { glow: [], flare: [] };
  for (const t of TINTS) {
    // halo: a soft radial plus 3 flat concentric bands (the inflamed-cell glow of sick-virus/03), slightly soft edges
    const g = document.createElement('canvas'); g.width = g.height = 64; const gc = g.getContext('2d');
    const gr = gc.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, rgba(t, 0.9)); gr.addColorStop(0.25, rgba(t, 0.42)); gr.addColorStop(0.6, rgba(t, 0.1)); gr.addColorStop(1, rgba(t, 0));
    gc.fillStyle = gr; gc.fillRect(0, 0, 64, 64);
    const b = document.createElement('canvas'); b.width = b.height = 64; const bc = b.getContext('2d');
    for (const [rr, a] of [[29, 0.1], [21, 0.14], [13, 0.22]]) { bc.fillStyle = rgba(t, a); bc.beginPath(); bc.arc(32, 32, rr, 0, 6.2832); bc.fill(); }
    gc.filter = 'blur(1.2px)'; gc.drawImage(b, 0, 0); gc.filter = 'none'; SPR.glow.push(g);
    // gentle 4-point flare: short soft tapered petals (blurred once), a little white toward the centre
    const f0 = document.createElement('canvas'); f0.width = f0.height = 128; const fc0 = f0.getContext('2d');
    fc0.translate(64, 64); fc0.fillStyle = mix(t, '#ffffff', 0.3);
    for (let k = 0; k < 4; k++) { fc0.save(); fc0.rotate(k * Math.PI / 2); fc0.beginPath(); fc0.moveTo(0, -4.2); fc0.quadraticCurveTo(14, -1.6, 60, 0); fc0.quadraticCurveTo(14, 1.6, 0, 4.2); fc0.closePath(); fc0.fill(); fc0.restore(); }
    const f = document.createElement('canvas'); f.width = f.height = 128; const fc = f.getContext('2d'); fc.filter = 'blur(1.1px)'; fc.drawImage(f0, 0, 0); fc.filter = 'none';
    SPR.flare.push(f);
  }
  return SPR;
}

// ---------- batch of luminous points (one draw call per tint × alpha step; sprites for the bright ones) ----------
export class Points {
  constructor(cap = 4096) { this.n = 0; this.cap = cap; this.x = new Float32Array(cap); this.y = new Float32Array(cap); this.dl = new Float32Array(cap); this.h = new Float32Array(cap); this.t = new Uint8Array(cap); this.f = new Uint8Array(cap); }
  reset() { this.n = 0; return this; }
  grow() { const c = this.cap * 2; for (const k of ['x', 'y', 'dl', 'h']) { const a = new Float32Array(c); a.set(this[k]); this[k] = a; } for (const k of ['t', 'f']) { const a = new Uint8Array(c); a.set(this[k]); this[k] = a; } this.cap = c; }
  // flags: 1 = no flare (galaxy nuclei: a glow but never a cross); 2 = distant galaxy (look saturates at delta 5.5);
  // 4 = named nearby star (hero: 1.5× glow, 1.7× flare — the same at every moment, so the labelled star stands out)
  // id: a stable number per object (its twinkle phase)
  add(x, y, delta, tint, flags = 0, id = 0) { if (this.n >= this.cap) this.grow(); const i = this.n++; this.x[i] = x; this.y[i] = y; this.dl[i] = (flags & 2) ? Math.min(delta, 5.5) : delta; this.t[i] = tint; this.f[i] = flags; const q = Math.sin(id * 12.9898 + 4.1) * 43758.5453; this.h[i] = q - Math.floor(q); }
  draw(c, s = 1, time = 0) {
    if (!this.n) return; const S = sprites();
    const NA = 8, buckets = new Map(), halos = new Map(); const bright = [];
    for (let i = 0; i < this.n; i++) {
      const L = look(this.dl[i], s); if (L.a <= 0.004) continue;
      if (L.gr > 0 && !((this.f[i] & 2) && this.dl[i] < 3.2)) bright.push(i); // distant galaxies: a glow only when clearly bright
      const ai = Math.min(NA - 1, Math.floor(L.a * NA)), key = this.t[i] * NA + ai;
      let p = buckets.get(key); if (!p) { p = new Path2D(); buckets.set(key, p); }
      const x = this.x[i], y = this.y[i], r = L.r;
      p.moveTo(x + r, y); p.arc(x, y, r, 0, 6.2832);
      { let hp = halos.get(key); if (!hp) { hp = new Path2D(); halos.set(key, hp); } const hr = r * 2.3; hp.moveTo(x + hr, y); hp.arc(x, y, hr, 0, 6.2832); }
    }
    // soft halo discs (flat, translucent) around the visible dots: a dot reads as a small glowing disc, not a pixel
    for (const [key, hp] of halos) { c.globalAlpha = 0.16 * ((key % NA) + 1) / NA; c.fillStyle = TINTS[(key / NA) | 0]; c.fill(hp); }
    c.globalAlpha = 1;
    // glows (additive, luminous only)
    if (bright.length) {
      c.globalCompositeOperation = 'lighter';
      for (const i of bright) { const L = look(this.dl[i], s); c.globalAlpha = L.ga; const g = L.gr * (this.f[i] & 4 ? 1.15 : 1); c.drawImage(S.glow[this.t[i]], this.x[i] - g, this.y[i] - g, 2 * g, 2 * g); }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    }
    for (const [key, p] of buckets) { const t = (key / NA) | 0, ai = key % NA; const a = (ai + 1) / NA; c.globalAlpha = a; c.fillStyle = DOT[t]; c.fill(p); }
    c.globalAlpha = 1;
    // white-hot centre on the bright ones (Kurzgesagt: coloured star, white core)
    if (bright.length) { const wp = new Path2D(); for (const i of bright) { const L = look(this.dl[i], s); if (this.dl[i] < 2.5) continue; const r = L.r * 0.55; wp.moveTo(this.x[i] + r, this.y[i]); wp.arc(this.x[i], this.y[i], r, 0, 6.2832); } c.fillStyle = '#ffffff'; c.fill(wp); }
    // flares last (thin crosses, additive)
    let any = false;
    for (const i of bright) { if (this.f[i] & 1) continue; const L = look(this.dl[i], s); if (L.fa <= 0) continue; if (!any) { c.globalCompositeOperation = 'lighter'; any = true; } const h = this.h[i], tw = 1 + 0.16 * Math.sin(time * (1.3 + 1.7 * h) + 6.283 * h); c.globalAlpha = L.fa; const f = L.fl * tw * (this.f[i] & 4 ? 1.0 : 1); c.drawImage(S.flare[this.t[i]], this.x[i] - f, this.y[i] - f, 2 * f, 2 * f); }
    if (any) { c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
  }
}

// ---------- the stable single-star API ----------
// rPx: true radius in px; brightness 0..1. A resolved star (rPx >= 1.2) is a disc with a glow; an unresolved one
// is a point whose brightness maps onto the same delta scale as every other star (brightness 1 = a first-magnitude star).
export function drawStar(c, x, y, rPx, color = '#ffffff', brightness = 1) {
  const b = clamp(brightness, 0, 1); if (b < 0.01) return;
  const delta = VIS + b * 9.5; const L = look(delta, 1); const S = sprites();
  let ti = TINTS.indexOf(color); if (ti < 0) ti = T_WHITE;
  if (rPx >= 1.2) { kitGlow(c, x, y, rPx * 2.2, color, 0.45 * b); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, rPx, 0, 6.2832); c.fill(); return; }
  if (L.gr > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = L.ga; c.drawImage(S.glow[ti], x - L.gr, y - L.gr, 2 * L.gr, 2 * L.gr); c.restore(); }
  c.save(); c.globalAlpha = L.a; c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, Math.max(L.r, rPx), 0, 6.2832); c.fill(); c.restore();
  if (L.fa > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = L.fa; c.drawImage(S.flare[ti], x - L.fl, y - L.fl, 2 * L.fl, 2 * L.fl); c.restore(); }
}
// the Sun as a point with the SAME law as every other star (for the solar level at far zooms): pass V and the Sun's
// screen position; returns the delta used (so a caller can decide whether its own disc is still larger).
export const SUN_ABSMAG = 4.83;
export function sunDelta(z, d2) { return mLim(z) - appMag(SUN_ABSMAG, d2); }
export function drawSunPoint(c, x, y, z, d2, s = 1) { const P = new Points(1); P.add(x, y, sunDelta(z, d2), T_WARM); P.draw(c, s); }
