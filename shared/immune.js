// Shared immune-cell drawings (unit = 1 µm, y up, origin = cell centre). Used by the battlefield AND by the inner
// scales (the hero macrophage is drawn by the same function outside and inside), so every cell is one definition.
import { PAL, solid, crescent, spec, blob, circle, rgba, mix, glow, ball, UL } from '../core/kit.js';
import { rng } from '../core/m.js';

// ---- neutrophil: dark magenta body, orange club spikes, cyan multi-lobed nucleus (Kurzgesagt immune-actually/09)
export function neutrophil(c, r, seed, t) {
  const R = rng(seed);
  // spikes behind (darker), then body, then spikes in front
  const n = 16, sp = [];
  for (let k = 0; k < n; k++) sp.push({ a: k / n * 6.283 + R() * 0.3, l: 0.18 + R() * 0.14, w: 0.06 + R() * 0.03, ph: R() * 6.28 });
  const spike = (s, col) => {
    const a = s.a + 0.05 * Math.sin(t * 1.3 + s.ph), l = 1 + s.l * (0.85 + 0.15 * Math.sin(t * 2 + s.ph));
    c.save(); c.rotate(a); c.fillStyle = col; c.beginPath(); c.moveTo(0.82, -s.w * 0.6); c.lineTo(l - s.w, -s.w * 0.45); c.arc(l - s.w, 0, s.w * 1.15, -1.57, 1.57); c.lineTo(0.82, s.w * 0.6); c.fill(); c.restore();
  };
  c.save(); c.scale(r, r);
  sp.forEach((s, i) => i % 2 && spike(s, mix(PAL.neuSpike, PAL.neu, 0.35)));
  const body = blob(seed, 0.07, 5, t * 0.3);
  solid(c, body, PAL.neu, { shadow: mix(PAL.neu, '#0f0020', 0.35), so: 0.12, light: mix(PAL.neu, PAL.neuSpike, 0.45), lo: 0.06 });
  sp.forEach((s, i) => !(i % 2) && spike(s, PAL.neuSpike));
  // granules
  c.fillStyle = rgba(PAL.neuLit, 0.35); for (let k = 0; k < 14; k++) { const a = R() * 6.28, d = 0.2 + R() * 0.55; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, 0.04 + R() * 0.04, 0, 6.283); c.fill(); }
  // lobed nucleus: 3-4 linked balls
  const lobes = 3 + (seed % 2); let px = -0.3, py = 0.1;
  for (let k = 0; k < lobes; k++) { const x = -0.3 + k * 0.22 + (R() - 0.5) * 0.06, y = 0.12 * Math.sin(k * 1.9 + seed) - 0.05; ball(c, x, y, 0.17, PAL.nuc, mix(PAL.nuc, '#0f0020', 0.35), PAL.spec, 0.85); px = x; py = y; }
  c.restore();
}

// ---- macrophage (immune-actually/11): pink body, long round-tipped tentacles (some branching), lighter core, translucent
// granules, a dark phagosome full of captured virions, cyan nucleus. Unit radius ~1 = body radius.
function arms(seed, t) {
  const R = rng(seed), out = []; const n = 7 + (seed % 3);
  for (let k = 0; k < n; k++) {
    const a = k / n * 6.283 + (R() - 0.5) * 0.5, len = 0.8 + R() * 1.1, w = 0.11 + R() * 0.1, bend = (R() - 0.5) * 1.4, ph = R() * 6.28, taper = 0.45 + R() * 0.35;
    const pts = []; for (let i = 0; i <= 6; i++) { const u = i / 6, wob = Math.sin(t * 0.55 + ph + u * 2) * 0.2 * u; const aa = a + (bend + wob) * u * 0.6; const d = 0.6 + u * len; pts.push([Math.cos(aa) * d, Math.sin(aa) * d]); }
    out.push({ pts, w, taper, back: R() < 0.4 });
    if (R() < 0.45) { const j = 3 + ((R() * 2) | 0), p0 = pts[j], aa = Math.atan2(p0[1], p0[0]) + (R() < 0.5 ? 0.7 : -0.7), l2 = 0.35 + R() * 0.45; const br = [p0]; for (let i = 1; i <= 3; i++) br.push([p0[0] + Math.cos(aa) * l2 * i / 3, p0[1] + Math.sin(aa) * l2 * i / 3]); out.push({ pts: br, w: w * 0.75, taper: 0.6, back: out[out.length - 1].back }); }
  }
  return out;
}
// a pseudopod as a filled ribbon: wide where it leaves the body, tapering to a rounded tip (immune-actually/11)
const armCache = new WeakMap();
function armPath(arm) {
  let p = armCache.get(arm); if (p) return p;
  const P = arm.pts, C = [P[0]]; // smooth centreline through midpoints
  for (let i = 1; i < P.length - 1; i++) { const a = [(P[i - 1][0] + P[i][0]) / 2, (P[i - 1][1] + P[i][1]) / 2], b = [(P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2];
    for (let k = 1; k <= 4; k++) { const u = k / 4; C.push([(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * P[i][0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * P[i][1] + u * u * b[1]]); } }
  C.push(P[P.length - 1]);
  const n = C.length, L = [], Rr = []; let tipW = 0;
  for (let i = 0; i < n; i++) { const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const u = i / (n - 1), w = arm.w * (1.25 - (1.25 - arm.taper) * Math.pow(u, 0.8)) * (1 + 0.12 * Math.sin(u * 7 + arm.w * 40)); tipW = w;
    L.push([C[i][0] - ty * w, C[i][1] + tx * w]); Rr.push([C[i][0] + ty * w, C[i][1] - tx * w]); }
  p = new Path2D(); L.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  const e = C[n - 1]; p.lineTo(Rr[n - 1][0], Rr[n - 1][1]); for (let i = n - 1; i >= 0; i--) p.lineTo(Rr[i][0], Rr[i][1]); p.closePath();
  p.moveTo(e[0] + tipW, e[1]); p.arc(e[0], e[1], tipW, 0, 6.2832);
  armCache.set(arm, p); return p;
}
function strokeArm(c, arm, col, wmul = 1, dx = 0, dy = 0) {
  const p = armPath(arm); c.fillStyle = col;
  if (wmul === 1) { c.save(); c.translate(dx, dy); c.fill(p, 'nonzero'); c.restore(); return; }
  // lit stripe: the arm's own shape, clipped, offset toward the light (a crescent along the lit edge)
  c.save(); c.clip(p); const q = new Path2D(); q.addPath(p); q.addPath(p, new DOMMatrix([1, 0, 0, 1, -dx * 0.8, -dy * 0.8])); c.fill(q, 'evenodd'); c.restore();
}
export function macrophageShape(seed, t) { return blob(seed, 0.085, 3, t * 0.25, 72); }
export const macrophageArms = arms;
// opt: { nucleus, phago, core, granules, body, arms } — each defaults to true. The HERO macrophage uses this same
// function for its floor layer with nucleus/phago/core/granules off: its nucleus is drawn by levels/nucleus.js (frame
// 'mnuc') and its interior by levels/macrophage.js at real heights.
export function macrophage(c, r, seed, t, opt = {}) {
  const on = (k) => opt[k] !== false;
  const R = rng(seed + 5), A = arms(seed, t), body = macrophageShape(seed, t);
  const sx = UL[0] * 0.07, sy = UL[1] * 0.07;
  c.save(); c.scale(r, r);
  if (on('arms')) {
    // arms behind the body: darker
    for (const a of A) if (a.back) strokeArm(c, a, PAL.macDark);
    // front arms: shadow edge then base
    for (const a of A) if (!a.back) strokeArm(c, a, PAL.macDark, 1, sx, sy);
    for (const a of A) if (!a.back) strokeArm(c, a, PAL.mac);
    for (const a of A) if (!a.back) strokeArm(c, a, PAL.macLit, 0.38, -sx * 1.1, -sy * 1.1); // lit side of each arm (crescent)
  }
  if (on('body')) { c.fillStyle = PAL.mac; c.fill(body); crescent(c, body, PAL.macDark, UL[0] * 0.08, UL[1] * 0.08); }
  // lighter core (stacked flat fill, offset toward the light)
  if (on('core')) { c.save(); c.translate(-UL[0] * 0.05, -UL[1] * 0.05); c.scale(0.68, 0.62); c.fillStyle = PAL.macLit; c.fill(blob(seed + 9, 0.06, 4)); c.restore(); }
  // translucent granules
  if (on('granules')) for (let k = 0; k < 14; k++) { const a = R() * 6.28, d = 0.2 + R() * 0.55, rr = 0.05 + R() * 0.07; c.fillStyle = rgba(PAL.macDots, 0.28 + R() * 0.2); c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, rr, 0, 6.283); c.fill(); }
  // phagosome: dark violet with a toothed rim, captured virions inside
  if (on('phago')) {
    const px = -0.18, py = 0.05, pr = 0.3;
    phagosome(c, px, py, pr, R, 22);
  }
  // nucleus (kidney-shaped, cyan ball)
  if (on('nucleus')) {
    c.save(); c.translate(0.32, -0.22); c.rotate(-0.4); c.scale(0.3, 0.24); solid(c, circle, PAL.nuc, { shadow: mix(PAL.nuc, '#0f0020', 0.4), so: 0.22 }); c.restore();
    spec(c, 0.29, -0.18, 0.07, 0.045, PAL.spec, 0.8);
  }
  c.restore();
}
// phagosome disc (immune-actually/11): toothed lighter rim, dark violet lumen, coloured contents
export function phagosome(c, px, py, pr, R, n = 22) {
  c.fillStyle = mix(PAL.macDark, '#0f0020', 0.25); c.beginPath(); for (let k = 0; k <= 48; k++) { const a = k / 48 * 6.283, rr = pr * (1.06 + 0.04 * (k % 2)); k ? c.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr) : c.moveTo(px + rr, py); } c.fill();
  c.fillStyle = '#2a0a4a'; c.beginPath(); c.arc(px, py, pr, 0, 6.283); c.fill();
  for (let k = 0; k < n; k++) { const a = R() * 6.28, d = Math.sqrt(R()) * pr * 0.78; c.fillStyle = k % 4 === 0 ? PAL.virusMesa : k % 4 === 1 ? PAL.protein : PAL.virus; c.beginPath(); c.arc(px + Math.cos(a) * d, py + Math.sin(a) * d, pr * 0.093, 0, 6.283); c.fill(); }
}

// ---- lymphocyte (T / NK): cog ring, dark core, magenta nucleus (immune-actually/13)
export function lymphocyte(c, r, seed, t) {
  c.save(); c.scale(r, r);
  const cog = new Path2D(); const n = 22; for (let k = 0; k <= n * 4; k++) { const a = k / (n * 4) * 6.283, rr = 1 + 0.05 * Math.sin(a * n + t); k ? cog.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : cog.moveTo(rr, 0); } cog.closePath();
  solid(c, cog, PAL.tcell, { light: PAL.tcellRim, lo: 0.07, shadow: mix(PAL.tcell, '#0f0020', 0.3), so: 0.08 });
  c.fillStyle = PAL.tcellCore; c.beginPath(); c.arc(UL[0] * 0.05, UL[1] * 0.05, 0.8, 0, 6.283); c.fill();
  ball(c, 0.05, -0.02, 0.55, '#8c217a', mix('#8c217a', '#0f0020', 0.4), '#f07ab8', 0.7);
  c.restore();
}

// ---- rhinovirus (30 nm): capsid ball with cyan five-fold "mesas" (only resolved deep inside)
export function virion(c, r) {
  ball(c, 0, 0, r, PAL.virus, PAL.virusDark, null);
  c.fillStyle = PAL.virusMesa; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 + 0.3; c.beginPath(); c.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.17, 0, 6.283); c.fill(); }
  c.beginPath(); c.arc(0, 0, r * 0.17, 0, 6.283); c.fill();
}

// ---- pollen grain (birch/oak ~25 µm): spiky ball, ochre
export function pollen(c, r, seed) {
  c.save(); c.scale(r, r);
  const s = new Path2D(); const n = 26; for (let k = 0; k <= n * 2; k++) { const a = k / (n * 2) * 6.283, rr = k % 2 ? 1.0 : 1.14; k ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(rr, 0); } s.closePath();
  solid(c, s, '#e9a93a', { shadow: '#b5651d', so: 0.16, light: '#ffe08a', lo: 0.07 });
  c.fillStyle = 'rgba(181,101,29,0.55)'; const R = rng(seed); for (let k = 0; k < 3; k++) { const a = R() * 6.28; c.beginPath(); c.arc(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.16, 0, 6.283); c.fill(); }
  c.restore();
}
