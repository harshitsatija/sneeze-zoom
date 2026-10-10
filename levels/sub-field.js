// The vacuum below the atom (owner: SUBATOMIC agent): one self-similar generator from the electron's Compton wavelength
// (QED pairs around the nucleus) through the proton's quark sea and the 14-decade "desert" to the Planck length.
// Kurzgesagt flat vocabulary: every fluctuation is a FILLED soft bubble (body + a lit rim band), its virtual pair two small
// solid balls that run around inside it and meet. Colour is a property of the bubble's own scale (shared/nucleon.js hueAt):
// warm gold/red near the proton → magenta → violet → blue → cyan foam at the Planck length.
//
// Two populations, both in frame 'quark' (the camera path's end point):
//  1. the NEST: a chain of bubbles centred just behind the focus, one about every decade (the up quark's gluon cloud, the quark's
//     size bound, then the desert). Each grows from a dot until it fills the view and becomes the backdrop (it never passes the
//     camera, so it never pops); the next one is already growing inside it. Each has a few siblings around it (the far layer)
//     that slide out of frame or are covered by the next backdrop. The milestone labels sit beside the nest bubble of that size.
//  2. the FIELD: floating bubbles in front of the focus (lateral offset > their radius, so they slide past, never through the
//     view), sub-pixel at the focus, growing, flying past: the near and mid layers. Lifetime ∝ size (they grow and shrink in time).
import { PAL, mix, rgba, blob, L } from '../core/kit.js';
import { ss, clamp, hash } from '../core/m.js';
import { blurSplit, blurSnap, hueAt, famAt, QCOL, QBALL, DRESS_R, QUARK_BOUND, FM, quarkPoint, flatBall } from '../shared/nucleon.js';
import { FAM, look, interior, sink } from '../core/look.js';

export const LP = 1.616255e-35;
const U0 = Math.log10(LP) - 0.2, U1 = Math.log10(2.4e-12);   // … the electron's Compton wavelength
const NPD = 110;
export const H = (a, b) => hash((a * 73856093) ^ (b * 19349663) ^ 0x5bd1e995);
export const bubbleHash = H;

// ---------------- the field ----------------
const front = [];
{ let acc = 0; const du = 0.02;
  for (let u = U0; u < U1; u += du) {
    // calm pass: the atom's empty interior and the proton's sea are SPARSE (a few small sharp pairs, not a bubble soup)
    acc += NPD * du * (1 + 0.25 * ss(-10.2, -10.8, u) * (1 - ss(-13.6, -14.4, u))) * (1 + 1.0 * ss(-32.6, -35.0, u)) * (1 - 0.25 * ss(-15.2, -15.8, u) * (1 - ss(-18.4, -19.2, u))) * (1 - 0.35 * ss(-15.6, -14.6, u));
    while (acc >= 1) { acc -= 1; const i = front.length; const rho = 0.35 + 1.1 * Math.pow(H(i, 2), 1.5);
      front.push({ i, u: u + H(i, 1) * du, Wh: Math.pow(10, u + H(i, 1) * du), rho, tau: 7.5 * rho * (0.8 + 0.4 * H(i, 3)), ph0: H(i, 4) }); } } } // calm pass: long lives (a bubble grows slowly, it does not blink)
const lo = (list, u) => { let a = 0, b = list.length; while (a < b) { const m = (a + b) >> 1; if (list[m].u < u) a = m + 1; else b = m; } return a; };
// calm pass: no enlarged bubbles in the atom or the proton (they were 1.5–2.2x bigger there and filled the lens)
const mOf = (u) => (13 - 5 * ss(-31.0, -34.9, u)) * (1 - 0.25 * ss(-10.4, -11.0, u) * (1 - ss(-18.4, -19.2, u)));
export const distortion = (u) => 0.16 * ss(-30.6, -34.9, u);
function stateOf(b, t) { const ph = t / b.tau + b.ph0, n = Math.floor(ph), f = ph - n; if (f > 0.84) return null; return { n, q: f / 0.84 }; }
function placeOf(b, n, t) {
  // calm pass: every bubble sits in a thin slab around the focus (-0.35 … +0.3 of its own scale) with a lateral offset many
  // times its size, so it drifts out of the frame while still small and nearly sharp; nothing ever reaches the lens
  const i = b.i * 977 + n * 131, z = -0.35 + 0.65 * H(i, 11), sr = b.rho / mOf(b.u);
  const rl = Math.max(0.55 + 2.6 * Math.sqrt(H(i, 12)) * (1 + 0.8 * Math.pow(H(i, 18), 3)), sr * 11, 1.2 * Math.max(z, 0) + 0.3); // never on the camera line
  const a = H(i, 13) * 6.2832; let x = Math.cos(a) * rl, y = Math.sin(a) * rl;
  const dist = distortion(b.u); if (dist > 0.001) { const w = 0.45 / b.rho; x += dist * 0.6 * Math.sin(t * w + H(i, 14) * 6.28); y += dist * 0.6 * Math.cos(t * w * 0.8 + H(i, 15) * 6.28); }
  return [x * b.Wh, y * b.Wh, z * b.Wh];
}
// colours of a field bubble: hue of its scale, jittered by ± a fraction of a decade so neighbours differ
// unification pass: a field bubble is GEL (one constant alpha, a lighter core toward the light, no rim stroke) in the family of its
// scale; its virtual pair are two small orbs (colour charges or gluons)
function bubbleCols(b, n, sp) {
  const f = famAt(b.u + (H(b.i + n, 9) - 0.5) * 1.6);
  let pa = f.lit, pb = f.glow;
  if (sp === 2) { const k = (H(b.i + n, 19) * 3) | 0; pa = QBALL[k].base; pb = QBALL[k].lit; }
  else if (sp === 1) { pa = FAM.gold.base; pb = FAM.gold.lit; }
  return { body: f.base, rim: mix(f.base, f.glow, 0.45), pa, pb };
}
const species = (b, n) => { const q = 1 - ss(-18.6, -22.0, b.u), h = H(b.i * 31 + n, 8); return b.sp ?? (h < q * 0.4 ? 1 : h < q * 0.85 ? 2 : 0); };

// ---- path builders (screen space, filled shapes so one fill per colour batches the field) ----
function shapePath(P, x, y, R, wob, seed, t, rev = false) {
  if (wob < 0.004) { P.moveTo(x + R, y); P.arc(x, y, R, 0, 6.2832, rev); return; }
  const n = Math.min(160, Math.max(28, (R * 0.12) | 0)), pts = [];
  for (let k = 0; k < n; k++) { const a = (rev ? -1 : 1) * k / n * 6.2832, r = R * (1 + wob * (0.6 * Math.sin(2 * a + seed + t * 0.6) + 0.4 * Math.sin(3 * a + seed * 1.7 - t * 0.8))); pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
  const mid = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
  let m = mid(n - 1); P.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) { const m2 = mid(i); P.quadraticCurveTo(pts[i][0], pts[i][1], m2[0], m2[1]); }
  P.closePath();
}
// lit rim band: outer shape minus the same shape shrunk and shifted away from the light (a crescent, thicker toward the light)
function bandPath(P, x, y, R, wob, seed, t) {
  shapePath(P, x, y, R, wob, seed, t);
  shapePath(P, x - L[0] * R * 0.1, y - L[1] * R * 0.1, R * 0.86, wob, seed, t, true);
}
const dotPath = (P, x, y, r) => { P.moveTo(x + r, y); P.arc(x, y, r, 0, 6.2832); };

// ---- buckets: one item per blur class, a Path2D per colour|alpha ----
let SV = null;
function addTo(buckets, d, blur, col, am, fn) {
  const b = blur / SV.s, dim = 1 - 0.55 * clamp((b - 6) / 22, 0, 1);
  for (const [cls, bl, wgt] of blurSplit(SV, blur)) {
    let B = buckets.get(cls); if (!B) { B = { cls, bl, d: 0, n: 0, paths: new Map() }; buckets.set(cls, B); }
    B.d += d; B.n++;
    const ck = col + '|' + (Math.round(am * dim * wgt * 64) / 64);
    let P = B.paths.get(ck); if (!P) { P = new Path2D(); B.paths.set(ck, P); } fn(P);
  }
}
function emit(V, e, buckets, t, b, st, p, s, dmax) {
  const v0 = p[0] - e.p[0], v1 = p[1] - e.p[1], v2 = p[2] - e.p[2];
  const d = -(v0 * e.b[0] + v1 * e.b[1] + v2 * e.b[2]); if (d <= V.near) return;
  const k2 = V.f / d, sx = V.cx + (v0 * e.r[0] + v1 * e.r[1] + v2 * e.r[2]) * k2, sy = V.cy - (v0 * e.u[0] + v1 * e.u[1] + v2 * e.u[2]) * k2;
  const q = st.q, R = s * k2 * Math.pow(Math.sin(Math.PI * q), 0.6);
  if (R < 2.5 * V.s) return;
  if (sx + R * 1.3 < 0 || sx - R * 1.3 > V.w || sy + R * 1.3 < 0 || sy - R * 1.3 > V.h) return;
  const wob = distortion(b.u), seed = H(b.i, 17) * 6.28, sp = species(b, st.n), C = bubbleCols(b, st.n, sp);
  const dd = dmax ? Math.min(d, dmax) : d, blur = V.coc(d), tier = R < 4 * V.s ? 0.45 : R < 7 * V.s ? 0.75 : 1;  // size law
  addTo(buckets, dd, blur, C.body, 0.34 * tier, (P) => shapePath(P, sx, sy, R, wob, seed, t));
  if (R > 5 * V.s) addTo(buckets, dd, blur, C.rim, 0.2 * tier, (P) => shapePath(P, sx + L[0] * R * 0.06, sy + L[1] * R * 0.06, R * 0.72, wob, seed, t));
  if (R > 14 * V.s && q < 0.97) { // the virtual pair: two small solid balls running round inside the rim, meeting at q = 1
    const a0 = H(b.i + st.n, 16) * 6.2832, span = Math.PI * q, rr = R * 0.66, br = R * 0.12;
    addTo(buckets, dd, blur, C.pa, 1, (P) => dotPath(P, sx + Math.cos(a0 + span) * rr, sy + Math.sin(a0 + span) * rr, br));
    addTo(buckets, dd, blur, C.pb, 1, (P) => dotPath(P, sx + Math.cos(a0 - span) * rr, sy + Math.sin(a0 - span) * rr, br));
    addTo(buckets, dd, blur, '#ffffff', 0.6, (P) => { dotPath(P, sx + Math.cos(a0 + span) * rr + L[0] * br * 0.4, sy + Math.sin(a0 + span) * rr + L[1] * br * 0.4, br * 0.3); dotPath(P, sx + Math.cos(a0 - span) * rr + L[0] * br * 0.4, sy + Math.sin(a0 - span) * rr + L[1] * br * 0.4, br * 0.3); });
  }
}
function flush(items, buckets, name) {
  for (const [cls, B] of buckets) {
    // draw order inside a bucket: bodies, then rims, then pair balls (Map insertion order groups them; sort by role)
    const entries = [...B.paths.entries()];
    items.push({ name: name + '-' + cls, d: B.d / B.n, blur: B.bl, draw(c) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      for (const [key, P] of entries) { const [col, a] = key.split('|'); c.fillStyle = rgba(col, Number(a)); c.fill(P); }
    } });
  }
}
export function fieldBegin(V) { SV = V; return { V, buckets: new Map() }; }
export function fieldFlush(items, FB, name) { flush(items, FB.buckets, name); }
export function drawField(V, FB, t) {
  const e = V.c('quark'), uz = Math.log10(V.W);
  for (let k = lo(front, uz - 2.0); k < front.length && front[k].u <= uz + 1.75; k++) {
    const b = front[k], st = stateOf(b, t); if (!st) continue;
    emit(V, e, FB.buckets, t, b, st, placeOf(b, st.n, t), b.rho * b.Wh / mOf(b.u));
  }
}
export function drawPopulation(V, FB, t, fr, list, place, size, dmax) {
  const e = V.c(fr);
  for (const b of list) { const st = stateOf(b, t); if (!st) continue; const p = place(b, st.n, t); if (!p) continue; emit(V, e, FB.buckets, t, b, st, p, size(b), dmax); }
}

// ---------------- the nest ----------------
// levels: u = log10(radius in m). The first two are the up quark itself: its gluon cloud (constituent-quark scale) and its
// size bound (< 4.3e-19 m), drawn as a glowing ball. Then the desert, one bubble per decade, with the milestones.
const MIL = {
  '-20.12': ['LHC resolution limit', 'smallest scale probed · ~10⁻²⁰ m'],
  '-21.89': ['Most energetic cosmic ray', 'reaches ~10⁻²² m'],
  '-25': ['The "desert"?', 'unexplored · a theory'],
  '-29.3': ['Neutrino-mass scale?', 'theory · ~10⁻²⁹ m'],
  '-32.3': ['Grand unification?', 'theory: forces merge · ~10⁻³² m'],
  '-34.3': ['String scale?', 'theory · ~10⁻³⁴ m'],
  '-35.22': ['Planck length · 1.6 × 10⁻³⁵ m', 'quantum foam? (unconfirmed)'],
};
const NEST_U = [-19.25, -20.12, -21.0, -21.89, -22.9, -23.9, -25, -26.0, -27.0, -28.1, -29.3, -30.3, -31.3, -32.3, -33.2, -33.9, -34.3, -34.75, -35.22];
export const NEST = [];
{
  NEST.push({ u: Math.log10(DRESS_R * FM), s: DRESS_R * FM, k: 1.15, ox: 0, oy: 0, kind: 'dress', sib: [] });
  NEST.push({ u: Math.log10(QUARK_BOUND), s: QUARK_BOUND, k: 1.1, ox: 0, oy: 0, kind: 'bound', sib: [], label: ['Up quark', 'no measured size · < 4.3 × 10⁻¹⁹ m'] });
  NEST_U.forEach((u, j) => {
    const s = Math.pow(10, u), a = H(j, 60) * 6.28, last = j >= NEST_U.length - 3, nS = last ? 6 : 3 + ((H(j, 61) * 2) | 0);
    // every decade has its own event: a virtual pair orbiting inside, a ring of small bubbles, a tight foam cluster, twin lobes,
    // or a glowing rim; the last three levels are the Planck foam (packed cluster)
    // one idea per decade (unification pass): LHC limit = a cell with a nucleus, the desert = a lone cell, grand unification = twin
    // lobes merging, string scale = vibrating loops, Planck = packed foam
    const style = ['pair', 'glow', 'ring', 'pair', 'cluster', 'twin', 'lone', 'lone', 'ring', 'cluster', 'pair', 'glow', 'cluster', 'twin', 'ring', 'cluster', 'strings', 'foam', 'foam'][j];
    const lev = { u, s, k: 1.0 + 0.25 * H(j, 62), ox: Math.cos(a) * 0.2 * s, oy: Math.sin(a) * 0.2 * s, kind: 'desert', style, seed: (H(j, 63) * 1e5) | 0, sib: [], label: MIL[String(u)], la: H(j, 70) * 6.28 };
    if (style === 'ring') { for (let m = 0; m < 9; m++) { const b = lev.la + m * 6.2832 / 9, r = 1.32; lev.sib.push({ r: s * (0.16 + 0.08 * H(j * 17 + m, 71)), x: lev.ox + Math.cos(b) * r * s, y: lev.oy + Math.sin(b) * r * s, k: lev.k, du: 0.4, seed: (H(j * 17 + m, 72) * 1e5) | 0 }); } }
    const nS2 = style === 'ring' || style === 'lone' ? 0 : style === 'cluster' ? 7 : nS;
    for (let m = 0; m < nS2; m++) { const tight = last || style === 'cluster', b = H(j * 13 + m, 64) * 6.28 + m * 6.28 / nS2, r = tight ? 0.95 + 0.6 * H(j * 13 + m, 65) : 1.05 + 1.5 * H(j * 13 + m, 65);
      lev.sib.push({ r: s * (tight ? 0.4 + 0.3 * H(j * 13 + m, 66) : 0.3 + 0.45 * H(j * 13 + m, 66)), x: lev.ox + Math.cos(b) * r * s, y: lev.oy + Math.sin(b) * r * s, k: lev.k * (0.8 + 0.5 * H(j * 13 + m, 67)), du: (H(j * 13 + m, 68) - 0.5) * 0.9, seed: (H(j * 13 + m, 69) * 1e5) | 0 }); }
    NEST.push(lev);
  });
}
// unification pass: every nest level is a CELL of its decade's family (famAt): a ring (base, dark crescent away from the light,
// lit crescent toward it, small flat highlight) around a DARK INTERIOR = the medium of the scale inside it (look(z), z = u + 0.3,
// warmed by the family). Flying into a level = flying into its interior, so the frame is always the continuous look() medium.
// Far siblings are the same cells sunk toward the haze of their scale.
const zIn = (u) => u + 0.3;
function cellOf(f, u, sinkK = 0) {
  const P = { base: f.base, dark: f.dark, lit: f.lit, hi: f.glow, in: interior(f, zIn(u), 0.2), inDark: mix(look(zIn(u)).deep, f.dark, 0.2) };
  if (sinkK > 0) for (const k in P) P[k] = sink(P[k], zIn(u), sinkK);
  return P;
}
const nestCols = (u, sinkK = 0) => cellOf(famAt(u), u, sinkK);
const IN_K = 0.82, IN_O = 0.06;
// the interior alone fills the view (conservative for the wobble), so the cover never pops
const inCovers = (V, x, y, R, wob) => V.covers(x + L[0] * R * IN_O, y + L[1] * R * IN_O, R * IN_K * (1 - wob) * 0.99);
function crescentP(c, clipP, x, y, R, wob, seed, t, dx, dy, col) {
  const sh = new Path2D(); shapePath(sh, x + dx, y + dy, R, wob, seed, t); const cr = new Path2D(); cr.addPath(clipP); cr.addPath(sh);
  c.save(); c.clip(clipP); c.fillStyle = col; c.fill(cr, 'evenodd'); c.restore();
}
function nestBlob(c, V, x, y, R, Pc, seed, t, wob, covers) {
  if (covers) { c.fillStyle = Pc.in; c.fillRect(0, 0, V.w, V.h); return; }
  const p = new Path2D(); shapePath(p, x, y, R, wob, seed, t);
  if (R < 6 || R > 3e5) { c.fillStyle = R < 6 ? Pc.base : Pc.in; c.fill(p); return; }
  c.fillStyle = Pc.base; c.fill(p);
  crescentP(c, p, x, y, R, wob, seed, t, L[0] * R * 0.14, L[1] * R * 0.14, Pc.dark);
  crescentP(c, p, x, y, R, wob, seed, t, -L[0] * R * 0.06, -L[1] * R * 0.06, Pc.lit);
  const ix = x + L[0] * R * IN_O, iy = y + L[1] * R * IN_O, ip = new Path2D(); shapePath(ip, ix, iy, R * IN_K, wob, seed, t);
  c.fillStyle = Pc.in; c.fill(ip); crescentP(c, ip, ix, iy, R * IN_K, wob, seed, t, L[0] * R * 0.1, L[1] * R * 0.1, Pc.inDark);
  c.fillStyle = rgba(Pc.hi, 0.8); c.beginPath(); c.ellipse(x + L[0] * R * 0.87, y + L[1] * R * 0.87, R * 0.12, R * 0.04, Math.atan2(L[1], L[0]) + Math.PI / 2, 0, 6.2832); c.fill();
}
// draw the nest (items) and return the label candidate { x, y, text, sub } of the level that is currently the subject
export function drawNest(V, items, t) {
  const e = V.c('quark'); let lab = null;
  const proj = (x, y, z) => { const v0 = x - e.p[0], v1 = y - e.p[1], v2 = z - e.p[2]; const d = -(v0 * e.b[0] + v1 * e.b[1] + v2 * e.b[2]); const k = V.f / d; return [V.cx + (v0 * e.r[0] + v1 * e.r[1] + v2 * e.r[2]) * k, V.cy - (v0 * e.u[0] + v1 * e.u[1] + v2 * e.u[2]) * k, d]; };
  for (const lev of NEST) {
    const p = proj(lev.ox, lev.oy, -lev.k * lev.s); if (p[2] <= V.near) continue;
    const R = lev.s * V.f / p[2];
    if (R < 0.3) continue;
    const wob = lev.kind === 'desert' ? 0.04 + distortion(lev.u) * 0.8 : 0;
    const covers = inCovers(V, p[0], p[1], R, wob);
    const bl = blurSnap(V, V.coc(p[2]));
    if (lev.kind === 'bound') {        // the up quark: a glowing point that resolves into a glowing ball of its size bound
      const Pc = QBALL[1];
      for (const [, b, w] of covers ? [[0, 0, 1]] : bl) items.push({ name: 'up-quark', d: p[2], blur: b, cover: covers, draw(c) {
        c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = w;
        if (R < 1.6) { quarkPoint(c, p[0], p[1], R, QCOL[1]); return; }
        if (!covers) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(p[0], p[1], R * 0.9, p[0], p[1], R * 2.4); g.addColorStop(0, rgba(QCOL[1], 0.35)); g.addColorStop(1, rgba(QCOL[1], 0)); c.fillStyle = g; c.beginPath(); c.arc(p[0], p[1], R * 2.4, 0, 6.2832); c.fill(); c.restore(); }
        nestBlob(c, V, p[0], p[1], R, Pc, 1, t, 0, covers);
        if (R < 4000) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], R * 0.45); g.addColorStop(0, rgba(mix(QCOL[1], '#ffffff', 0.5), 0.55)); g.addColorStop(1, rgba(QCOL[1], 0)); c.fillStyle = g; c.beginPath(); c.arc(p[0], p[1], R * 0.45, 0, 6.2832); c.fill(); c.restore(); }
      } });
      if (R > 30 * V.s && R < 560 * V.s) lab = { x: p[0] + R + 18 * V.s, xl: p[0] - R - 18 * V.s, y: p[1] - 22 * V.s, text: lev.label[0], sub: lev.label[1], R };
      continue;
    }
    if (lev.kind === 'dress') {        // the up quark's gluon cloud: a solid red ball around the quark (constituent-quark scale)
      if (R < 0.8) continue;
      const Pd = QBALL[1]; for (const [, b, w] of covers ? [[0, 0, 1]] : bl) items.push({ name: 'quark-cloud', d: p[2], blur: b, cover: covers, draw(c) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = w; nestBlob(c, V, p[0], p[1], R, Pd, 3, t, 0, covers); } });
      continue;
    }
    // desert level: siblings (far layer) + the main bubble
    const h = hueAt(lev.u), F = famAt(lev.u);
    for (const sb of lev.sib) {
      const q = proj(sb.x, sb.y, -sb.k * lev.s); if (q[2] <= V.near) continue; const r = sb.r * V.f / q[2]; if (r < 1.5) continue;
      if (!V.onScreen(q[0], q[1], r * 1.1)) continue;
      const Pc = nestCols(lev.u + sb.du, 0.45), bob = 1 + 0.03 * Math.sin(t * 0.7 + sb.seed);
      const foam = lev.style === 'foam'; for (const [, b, w] of blurSnap(V, V.coc(q[2]))) items.push({ name: 'nest-sib', d: q[2], blur: b, draw(c) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = w; if (foam) nestBlob(c, V, q[0], q[1], r * bob, Pc, sb.seed, t * 0.3, wob, false); else flatBall(c, q[0], q[1], r * bob, Pc); } }); // far siblings: sunk orbs (cells only in the packed foam)
    }
    if (R < 1) continue;
    const Pc = nestCols(lev.u);
    const st = lev.style, lob = [p[0] + Math.cos(lev.la) * R * 0.55, p[1] + Math.sin(lev.la) * R * 0.55];
    const lobeCovers = st === 'twin' && inCovers(V, lob[0], lob[1], R * 0.72, wob);
    for (const [, b, w] of covers ? [[0, 0, 1]] : bl) items.push({ name: 'nest', d: p[2], blur: b, cover: covers, draw(c) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = w;
      if (st === 'twin' && !covers) nestBlob(c, V, lob[0], lob[1], R * 0.72, nestCols(lev.u - 0.4), lev.seed + 5, t * 0.3, wob, lobeCovers);
      nestBlob(c, V, p[0], p[1], R, Pc, lev.seed, t * 0.3, wob, covers);
      if (st === 'glow' && R * 0.22 > 1.5 && R < 2e5) { // a nucleus: an orb of the next decade's family inside the cell (the reference's cell nucleus)
        const nf = famAt(lev.u - 1.2), nx = p[0] + Math.cos(lev.la) * R * 0.5, ny = p[1] + Math.sin(lev.la) * R * 0.5; if (V.onScreen(nx, ny, R * 0.22)) flatBall(c, nx, ny, R * 0.2, { base: nf.base, dark: nf.dark, lit: nf.lit, hi: nf.glow }); }
      if (st === 'strings' && R * 0.3 > 2 && R < 2e5) { // the string scale: closed strings, vibrating loops (tubes: a linear thing)
        const f = famAt(lev.u - 0.6); c.lineCap = 'round'; c.lineJoin = 'round';
        for (let m = 0; m < 3; m++) { const cx = p[0] + Math.cos(lev.la + m * 2.1) * R * 0.38, cy = p[1] + Math.sin(lev.la + m * 2.1) * R * 0.38, rr = R * (0.13 + 0.04 * m), w = R * 0.035, nm = 3 + m;
          if (!V.onScreen(cx, cy, rr * 1.4)) continue; const loop = (ox, oy) => { const P = new Path2D(); for (let k = 0; k <= 64; k++) { const a = k / 64 * 6.2832, r2 = rr * (1 + 0.16 * Math.sin(nm * a + t * (1.3 + m * 0.4))); const X = cx + ox + Math.cos(a) * r2, Y = cy + oy + Math.sin(a) * r2 * 0.8; k ? P.lineTo(X, Y) : P.moveTo(X, Y); } return P; };
          c.lineWidth = w; c.strokeStyle = f.dark; c.stroke(loop(L[0] * -w * 0.3, L[1] * -w * 0.3)); c.lineWidth = w * 0.7; c.strokeStyle = f.lit; c.stroke(loop(L[0] * w * 0.15, L[1] * w * 0.15)); }
      }
      if (st === 'pair' && R * 0.2 > 1.5) { // a virtual particle–antiparticle pair circling inside the bubble
        const ang = t * 0.35 + lev.la, rr = R * 0.5, br = R * 0.17;
        for (const [sg, P2] of [[0, { base: F.lit, dark: F.base, lit: F.glow, hi: '#ffffff' }], [Math.PI, { base: FAM.gold.base, dark: FAM.gold.dark, lit: FAM.gold.lit, hi: FAM.gold.glow }]]) { const x = p[0] + Math.cos(ang + sg) * rr, y = p[1] + Math.sin(ang + sg) * rr * 0.6;
          if (!V.onScreen(x, y, br)) continue; flatBall(c, x, y, br, P2); }
      }
    } });
    if (lev.label && R > 40 * V.s && R < 420 * V.s && !lab) {
      let ex = R; for (const sb of lev.sib) { const q = proj(sb.x, sb.y, -sb.k * lev.s); const r = sb.r * V.f / q[2]; if (Math.abs(q[1] - p[1]) < R) ex = Math.max(ex, q[0] - p[0] + r); }
      let exl = R; for (const sb of lev.sib) { const q = proj(sb.x, sb.y, -sb.k * lev.s); const r = sb.r * V.f / q[2]; if (Math.abs(q[1] - p[1]) < R) exl = Math.max(exl, p[0] - q[0] + r); }
      if (lev.style === 'foam') { ex = R; exl = R; } // in the packed foam the cell itself is the object
      lab = { x: p[0] + Math.min(ex, R * 2.2) + 18 * V.s, xl: p[0] - Math.min(exl, R * 2.2) - 18 * V.s, y: p[1] - 24 * V.s, text: lev.label[0], sub: lev.label[1], R };
    }
  }
  return lab;
}
