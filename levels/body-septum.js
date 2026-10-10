// The septum wall at millimetre scale (Little's area): what makes the mucosa read between z -2.0 and -3.2.
// - Kiesselbach's plexus: arterial trees converging on the anterior septum, seen through the thin lining. Each vessel sits
//   at its real depth below the surface (bigger = deeper), so the vessel layers parallax against the surface.
// - Inflamed area: vasodilation around the infection (a constant tint + dilated vessels), centred on the battle.
// - The mucus gel's wet sheen (highlight streaks ON the gel, 12 µm up) and thick mucus sheets (rhinorrhoea) floating
//   30–350 µm above the surface: translucent constant-alpha material that flies past the camera on the way down.
// Frame 'muc': z = 0 apical surface, +z toward the camera; unit 1 µm. Everything here is drawn at all zooms (it simply
// becomes large/blurred or leaves the frame at cell scale; nothing fades).
import { PAL, mix, rgba, T, blob, UL, crescent, screenSpace, lightFor } from '../core/kit.js';
import { rgb } from '../core/kit.js';
import { rng, clamp } from '../core/m.js';
import { MAC } from '../core/anchors.js';
import { viewBox, toScreen, planeOK } from './body-util.js';

export const MUCUS_WARM = mix(PAL.skinShade, PAL.tissueLit, 0.28), MUCUS_LIT = mix(PAL.cheek, '#ffffff', 0.35), GEL_FOLD = mix(PAL.skin, PAL.cheek, 0.5), GEL_DEEP = mix(PAL.skinDeep, PAL.tissue, 0.35);
const UM = 1e-6, HX = MAC[0] / UM, HY = MAC[1] / UM; // the battle centre (hero macrophage)
// ---------- vessels ----------
const segs = [];
{ const R = rng(2024);
  const grow = (x, y, ang, w, gen) => {
    const len = 700 + w * 2.5 + R() * 600, n = 7, pts = [[x, y]]; let a = ang, px = x, py = y; let curl = (R() - 0.5) * 0.5;
    for (let i = 1; i <= n; i++) { curl += (R() - 0.5) * 0.25; a += curl * 0.35; px += Math.cos(a) * len / n; py += Math.sin(a) * len / n; pts.push([px, py]); }
    const dc = Math.hypot(px - HX, py - HY); const dil = 1 + 0.4 * Math.exp(-dc / 1300); // inflamed: dilated near the battle
    const terminal = w < 75 || dc < 600; // the battlefield itself sits between vessels
    if (!terminal) segs.push({ pts, w: w * dil, depth: 90 + w * 1.3, gen });
    else { // terminal branch: tapers to nothing (it dives into the capillary bed), split into narrowing pieces
      for (let i = 0; i < n; i++) segs.push({ pts: [pts[i], pts[i + 1], pts[i + 1]], w: w * dil * (1 - i / n) ** 1.3, depth: 90 + w * 1.3, gen });
      return; }
    const sp = 0.45 + R() * 0.3, k1 = 0.72 + R() * 0.08, k2 = 0.55 + R() * 0.12;
    const toC = Math.atan2(HY - py, HX - px); const bias = (b) => b + Math.sin(toC - b) * 0.22; // the plexus converges on Little's area
    grow(px, py, bias(a + sp), w * k1, gen + 1); grow(px, py, bias(a - sp * 0.9), w * k2, gen + 1);
  };
  const roots = [[-5400, 3000], [4600, 4200], [5400, -2600], [-1400, -5400]];
  roots.forEach(([x, y], i) => grow(x, y, Math.atan2(HY - y, HX - x) + (R() - 0.5) * 0.5, 210 + R() * 50, 0));
  for (let i = segs.length - 1; i >= 0; i--) if (segs[i].pts.some(([x, y]) => Math.hypot(x - HX, y - HY) < 420)) segs.splice(i, 1); // nothing ends in mid-air inside the gap
  for (const s of segs) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of s.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } s.bb = [x0 - s.w, y0 - s.w, x1 + s.w, y1 + s.w]; }
}
// depth bins (each one planar layer at its mean depth → one item each)
const BINS = [[0, 200], [200, 250], [250, 300], [300, 1e9]].map(([lo, hi], i) => {
  const ss = segs.filter((s) => s.depth >= lo && s.depth < hi); const depth = ss.reduce((a, s) => a + s.depth, 0) / Math.max(1, ss.length);
  const k = i / 3; // deeper = more of the tissue in front: darker, more violet, lower contrast
  return { segs: ss, depth, alpha: 0.66 - k * 0.14, wall: mix('#a8105c', '#6a0a5a', k * 0.6), core: mix(PAL.rbc, '#b0127a', k * 0.6), hi: mix(PAL.rbcLit, PAL.rbc, k) };
});
let _sc = null; function scratch(w, h) { if (!_sc) _sc = document.createElement('canvas'); if (_sc.width !== w || _sc.height !== h) { _sc.width = w; _sc.height = h; } return _sc; }
function strokeSeg(c, s, wk, dx, dy) { const p = s.pts; c.moveTo(p[0][0] + dx, p[0][1] + dy); for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; c.quadraticCurveTo(p[i][0] + dx, p[i][1] + dy, mx + dx, my + dy); } c.lineTo(p[p.length - 1][0] + dx, p[p.length - 1][1] + dy); }

// ---------- wet sheen streaks on the gel (12 µm up) ----------
const sheen = []; { const R = rng(77); for (let k = 0; k < 16; k++) { const a = R() * 6.283, d = 420 + R() * 4200, L = 300 + R() * 1300, w = 26 + R() * 70, ang = -0.6 + (R() - 0.5) * 0.9, bend = (R() - 0.5) * 0.5;
  const x = HX + Math.cos(a) * d, y = HY + Math.sin(a) * d; const p = new Path2D(); const n = 14;
  const P = (u, side) => { const t = u - 0.5, cx = t * L, cy = bend * L * (t * t - 0.25) + side * w * Math.sin(u * Math.PI) ** 0.8; return [x + cx * Math.cos(ang) - cy * Math.sin(ang), y + cx * Math.sin(ang) + cy * Math.cos(ang)]; };
  for (let i = 0; i <= n; i++) { const [px, py] = P(i / n, 1); i ? p.lineTo(px, py) : p.moveTo(px, py); } for (let i = n; i >= 0; i--) { const [px, py] = P(i / n, -1); p.lineTo(px, py); } p.closePath();
  const core = new Path2D(); for (let i = 2; i <= n - 2; i++) { const [px, py] = P(i / n, 0.32); i > 2 ? core.lineTo(px, py) : core.moveTo(px, py); } for (let i = n - 2; i >= 2; i--) { const [px, py] = P(i / n, -0.05); core.lineTo(px, py); } core.closePath();
  sheen.push({ p, core, x, y, r: L / 2 + w }); } }

// ---------- thick mucus sheets (rhinorrhoea) floating above the gel ----------
const sheets = []; { const R = rng(4040); for (let k = 0; k < 12; k++) {
  const z = 60 * Math.pow(6, R()), r = 90 + R() * 260 * Math.min(1, z / 150); const a = R() * 6.283, d = r * 1.35 + 220 + Math.pow(R(), 0.8) * 3600;
  const bubbles = []; const nb = 2 + ((R() * 6) | 0); for (let i = 0; i < nb; i++) { const ba = R() * 6.283, bd = Math.sqrt(R()) * 0.7; bubbles.push([Math.cos(ba) * bd, Math.sin(ba) * bd, 0.03 + R() * 0.07]); }
  const specks = []; for (let i = 0; i < 10; i++) { const ba = R() * 6.283, bd = Math.sqrt(R()) * 0.8; specks.push([Math.cos(ba) * bd, Math.sin(ba) * bd, 0.006 + R() * 0.012, R() < 0.3]); }
  sheets.push({ x: HX + Math.cos(a) * d, y: HY + Math.sin(a) * d, z, r, seed: (R() * 1e6) | 0, bubbles, specks, drift: 0.6 + R() * 0.8 }); } }

const BLANKET = [{ z: 26, hole: 290, a: 0.46, seed: 4401, rim: true }, { z: 52, hole: 520, a: 0.3, seed: 4417 }, { z: 95, hole: 820, a: 0.3, seed: 4431 }].map((L) => { const R = rng(L.seed), sheen = [];
  for (let i = 0; i < 22; i++) { const a = R() * 6.283, d = L.hole * 1.3 + Math.pow(R(), 0.7) * 5000; sheen.push([Math.cos(a) * d, Math.sin(a) * d, 200 + R() * 700, 120 + R() * 380, R() * 3, R() < 0.5]); }
  const glints = []; for (let i = 0; i < 50; i++) { const a = R() * 6.283, d = L.hole * 1.15 + Math.pow(R(), 0.6) * 4500; glints.push([Math.cos(a) * d, Math.sin(a) * d, 4 + R() * 10]); }
  return { ...L, sheen, glints }; });
export function septum(V, items, A, t) {
  const s = Math.hypot(A.a, A.b); // px per µm at the surface
  const dEpi = A.depth;
  // ---- vessels, deepest bin first. Painted over the epithelium (seen through the thin lining), positioned at depth.
  BINS.forEach((B, bi) => {
    const Ab = V.layer('muc', [0, 0, -B.depth * UM], [UM, 0, 0], [0, UM, 0]); if (!Ab) return; const sb = Math.hypot(Ab.a, Ab.b);
    const [x0, y0, x1, y1] = viewBox(Ab, V, 4);
    const vis = B.segs.filter((g) => g.w * sb > 0.25 && g.bb[2] > x0 && g.bb[0] < x1 && g.bb[3] > y0 && g.bb[1] < y1); if (!vis.length) return;
    items.push({ name: 'vessels', d: dEpi * (1 - 1e-7 * (4 - bi)), blur: V.coc(Ab.depth), draw(c) {
      // group opacity: draw the tubes opaque into a scratch canvas, composite at the layer's constant alpha
      const sc = scratch(V.w, V.h), g = sc.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, sc.width, sc.height);
      g.setTransform(Ab.a, Ab.b, Ab.c, Ab.d, Ab.e, Ab.f); lightFor(Ab.a, Ab.b, Ab.c, Ab.d);
      g.lineCap = 'round'; g.lineJoin = 'round';
      const pass = (col, wk, ox, oy) => { g.strokeStyle = col; const byW = new Map(); for (const sg of vis) { const kq = Math.round(sg.w * wk * 2) / 2; let a = byW.get(kq); if (!a) { a = []; byW.set(kq, a); } a.push(sg); }
        for (const [w, gs] of byW) { g.lineWidth = Math.max(w, 0.6 / sb); g.beginPath(); for (const sg of gs) strokeSeg(g, sg, wk, ox * sg.w, oy * sg.w); g.stroke(); } };
      pass(B.wall, 1, 0, 0); pass(B.core, 0.7, -UL[0] * 0.08, -UL[1] * 0.08); pass(B.hi, 0.18, -UL[0] * 0.2, -UL[1] * 0.2);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = B.alpha; c.drawImage(sc, 0, 0); c.restore();
    } });
  });
  // ---- inflamed area: vasodilation reddens the lining around the battle (radial tint at the surface)
  { const R0 = 1500; items.push({ name: 'inflamed', d: dEpi * (1 - 5e-7), blur: 0, draw(c) {
      T(c, A); const g = c.createRadialGradient(HX, HY, 0, HX, HY, R0); g.addColorStop(0, rgba(PAL.rbc, 0)); g.addColorStop(0.14, rgba(PAL.rbc, 0)); g.addColorStop(0.42, rgba(PAL.rbc, 0.26)); g.addColorStop(1, rgba(PAL.rbc, 0));
      c.fillStyle = g; c.beginPath(); c.arc(HX, HY, R0, 0, 6.283); c.fill(); } }); }
  // ---- the mucus blanket: a continuous wet gel sheet over the lining (warm, flesh-pink) with a ragged GAP over the battle,
  // two layers at real heights (30 µm gel, 95 µm thick secretion). The camera descends through the gap; the vessels sit
  // visibly under it. Constant-alpha material.
  for (const L of BLANKET) {
    const cp = V.c('muc').p; if (cp[2] - L.z * UM <= V.near * 3) continue;
    const Ab = V.layer('muc', [HX * UM, HY * UM, L.z * UM], [UM, 0, 0], [0, UM, 0]); if (!Ab) continue; const sb = Math.hypot(Ab.a, Ab.b);
    if (V.covers(Ab.e, Ab.f, L.hole * 0.3 * sb)) continue; // the clear centre contains the whole view
    items.push({ name: 'mucus-blanket', d: Ab.depth, blur: V.coc(Ab.depth), draw(c) { T(c, Ab);
      // the gel THINS toward the battle (spatially varying thickness of one constant material), so the cell world
      // beneath shows through gradually: no hole, no rim, no portal
      const R0 = L.hole * 0.35, R1 = L.hole * 2.4; const [r, gg, bb] = rgb(MUCUS_WARM);
      // gradient built in SCREEN space (huge user-space arcs + gradients glitch in Skia); the layer is camera-facing
      c.save(); screenSpace(c); const g = c.createRadialGradient(Ab.e, Ab.f, R0 * sb, Ab.e, Ab.f, R1 * sb);
      g.addColorStop(0, `rgba(${r},${gg},${bb},0)`); g.addColorStop(0.45, `rgba(${r},${gg},${bb},${(L.a * 0.45).toFixed(3)})`); g.addColorStop(1, `rgba(${r},${gg},${bb},${L.a})`);
      c.fillStyle = g; c.fillRect(0, 0, V.w, V.h); c.restore(); T(c, Ab);
      const p = new Path2D(); p.arc(0, 0, 16000, 0, 6.283); p.arc(0, 0, R1 * 0.8, 0, 6.283, true);
      c.save(); c.clip(p, 'evenodd');
      for (const [x, y, rx, ry, rot, lit] of L.sheen) { c.fillStyle = lit ? rgba(GEL_FOLD, 0.1) : rgba(GEL_DEEP, 0.1); c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 6.283); c.fill(); }
      if (sb * 6 > 0.6) { c.fillStyle = 'rgba(255,246,240,0.45)'; c.beginPath(); for (const [x, y, rr] of L.glints) { c.moveTo(x + rr, y); c.ellipse(x, y, rr, rr * 0.55, -0.6, 0, 6.283); } c.fill(); }
      c.restore(); } });
  }
}
// one translucent mucus body (unit radius): constant-alpha material, a lighter inner body, a lit rim crescent on the
// light side, air bubbles and trapped specks. No strokes. Shared with the near-surface rafts in mucosa.js.
export function mucusBody(c, seed, bubbles = [], specks = []) {
  const b = blob(seed, 0.1, 4, 0, 56);
  c.fillStyle = rgba(MUCUS_WARM, 0.3); c.fill(b);
  c.save(); c.translate(-UL[0] * 0.1, -UL[1] * 0.1); c.scale(0.72, 0.72); c.fillStyle = rgba(MUCUS_LIT, 0.16); c.fill(b); c.restore();
  for (const [x, y, r] of bubbles) { c.fillStyle = rgba(MUCUS_LIT, 0.35); c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill(); c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(x - UL[0] * r * 0.4, y - UL[1] * r * 0.4, r * 0.25, 0, 6.283); c.fill(); }
  for (const [x, y, r, v] of specks) { c.fillStyle = v ? PAL.virus : 'rgba(255,240,176,0.85)'; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill(); }
}
