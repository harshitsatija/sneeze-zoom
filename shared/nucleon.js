// Shared nucleon / quark look (owner: SUBATOMIC agent). ONE source for the carbon-12 nucleus (levels/nucleus12.js) and
// the hero proton's interior (levels/quarks.js), so the proton we dive into is the same object as the one in the nucleus.
// Units: fm (1e-15 m). Frame 'atom' = the nucleus centre. Everything here is drawn in SCREEN space (call screenSpace(c)).
//
// Physics (research/SCIENCE.md I-10…I-14):
//  - C-12: 6 p + 6 n, rms charge radius 2.47 fm, drawn as 3 alpha clusters (2p+2n tetrahedra) in a triangle (real cluster model).
//  - nucleon radius 0.84 fm (proton charge radius); centre spacing ~1.75 fm, so they sit close-packed.
//  - each nucleon holds 3 valence quarks (p = uud, n = udd) with colour charges r/g/b, joined by a Y-shaped flux tube.
//  - a quark has no measured size (< 4.3e-19 m): an unresolved bright core whose glow obeys a size law.
import { PAL, mix, rgba, crescent, L } from '../core/kit.js';
import { FAM, look, interior } from '../core/look.js';
import { rng, clamp } from '../core/m.js';

export const FM = 1e-15;
// One fixed set of blur values (px at 1600 wide) for every subatomic item. The engine merges neighbouring items of similar blur
// into one run blurred at their mean; if all our items sit exactly on these values, regrouping never changes any blur.
// A continuous blur is represented by splitting the item between the two neighbouring values with complementary alpha.
export const CLS_BLUR = [0, 2.6, 8, 24];
export function blurSplit(V, blur) {
  const sc = V.s, b = blur / sc, N = CLS_BLUR.length - 1, cap = (v) => Math.min(v * sc, V.dofA * 3.2);
  if (b >= CLS_BLUR[N]) return [[N, cap(CLS_BLUR[N]), 1]];
  if (b <= 0.7) return [[0, 0, 1]];
  for (let k = 0; k < N; k++) if (b < CLS_BLUR[k + 1]) {
    const lo = Math.log(Math.max(CLS_BLUR[k], 0.7)), f = Math.round(clamp((Math.log(b) - lo) / (Math.log(CLS_BLUR[k + 1]) - lo), 0, 1) * 8) / 8;
    return [[k, cap(CLS_BLUR[k]), 1 - f], [k + 1, cap(CLS_BLUR[k + 1]), f]].filter((x) => x[2] > 0);
  }
  return [[0, 0, 1]];
}
// opaque shapes cannot be alpha-split (two partial copies of an opaque shape let the backdrop through): snap to the nearest class
export function blurSnap(V, blur) {
  const sc = V.s, b = blur / sc, N = CLS_BLUR.length - 1; let k = 0, best = 1e9;
  for (let i = 0; i <= N; i++) { const d = Math.abs(Math.log(Math.max(b, 0.7)) - Math.log(Math.max(CLS_BLUR[i], 0.7))); if (d < best) { best = d; k = i; } }
  return [[k, Math.min(CLS_BLUR[k] * sc, V.dofA * 3.2), 1]];
}
export const R_NUC = 0.84;               // fm, nucleon (proton charge) radius
export const QUARK_BOUND = 4.3e-19;      // m, ZEUS 2016 upper bound on the quark radius
export const DRESS = 0.2;                // fm, the gluon "dressing" of a valence quark (constituent quark scale)

// ---------- colours (unification pass: all from core/look.js) ----------
// Every nucleon is a Kurzgesagt CELL (the reference's vocabulary): a ring of its family (base, dark crescent away from the light,
// lit crescent toward it, a small flat highlight), and a DARK INTERIOR = the medium of the scale inside it (look(z) warmed by the
// family). Flying into a nucleon is flying into its interior: the frame becomes that medium, never a flat bright colour.
const ZP = -15.4; // the scale inside a nucleon
const cellCol = (f, zIn) => ({ base: f.base, dark: f.dark, lit: f.lit, hi: f.glow, in: interior(f, zIn, 0.2), inDark: mix(look(zIn).deep, f.dark, 0.2) });
export const NCOL = { p: cellCol(FAM.coral, ZP), n: cellCol(FAM.cyan, ZP) };
// colour charges -> families (index 1 is the hero up quark's charge: coral, the warm accent of the proton scale)
export const QFAM = [FAM.cyan, FAM.coral, FAM.lime];
export const QCOL = QFAM.map((f) => f.lit);
export const QBALL = QFAM.map((f) => ({ base: f.base, dark: f.dark, lit: f.lit, hi: f.glow, in: interior(f, -17.5, 0.2), inDark: mix(look(-17.5).deep, f.dark, 0.2) }));
export const GLU = { base: FAM.gold.base, dark: FAM.gold.dark, lit: FAM.gold.lit };
export const LUMP = FAM.gold.base;                      // QCD-vacuum lumps glow warm inside the proton
export const DRESS_R = 0.13;                            // fm, drawn radius of a valence quark's gluon cloud (constituent quark)
// the family of a scale (u = log10 of a size in m): cyan in the atom, coral at the proton and the quark, magenta at the LHC limit,
// violet in the desert, cyan again in the Planck foam. Neighbouring decades always share most of their colour (continuous ramp).
const FSTOPS = [[-11.0, FAM.cyan], [-14.6, FAM.cyan], [-15.6, FAM.coral], [-18.4, FAM.coral], [-20.4, FAM.magenta], [-23.0, FAM.magenta], [-25.6, FAM.violet], [-28.6, FAM.violet], [-31.6, FAM.cyan], [-35.3, FAM.cyan]];
const mixFam = (A, B, t) => { const o = {}; for (const k of ['base', 'dark', 'lit', 'glow']) o[k] = mix(A[k], B[k], t); return o; };
export function famAt(u) {
  if (u >= FSTOPS[0][0]) return FSTOPS[0][1];
  for (let k = 1; k < FSTOPS.length; k++) if (u >= FSTOPS[k][0]) return mixFam(FSTOPS[k - 1][1], FSTOPS[k][1], (FSTOPS[k - 1][0] - u) / (FSTOPS[k - 1][0] - FSTOPS[k][0]));
  return FSTOPS[FSTOPS.length - 1][1];
}
export const hueAt = (u) => famAt(u).base;

// ---------- the carbon-12 arrangement (atom frame, fm) ----------
const RA = 2.05, EDGE = 1.75, TET = EDGE / (2 * Math.SQRT2);
const TV = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
function rotFrom(r) { // random rotation matrix (uniform-ish) from rng
  const a = r() * 6.283, b = Math.acos(2 * r() - 1), g = r() * 6.283;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
  return [ca * cg - sa * cb * sg, -ca * sg - sa * cb * cg, sa * sb, sa * cg + ca * cb * sg, -sa * sg + ca * cb * cg, -ca * sb, sb * sg, sb * cg, cb];
}
const mv = (M, p) => [M[0] * p[0] + M[1] * p[1] + M[2] * p[2], M[3] * p[0] + M[4] * p[1] + M[5] * p[2], M[6] * p[0] + M[7] * p[1] + M[8] * p[2]];
export const NUCLEONS = [];
{
  const r = rng(12012);
  const tilt = 38 * Math.PI / 180, e1 = [1, 0, 0], e2 = [0, Math.cos(tilt), Math.sin(tilt)]; // triangle plane leans toward the camera
  for (let k = 0; k < 3; k++) {
    const a = Math.PI / 2 + k * 2.0944 + 0.25, c = [RA * (Math.cos(a) * e1[0] + Math.sin(a) * e2[0]), RA * (Math.cos(a) * e1[1] + Math.sin(a) * e2[1]), RA * (Math.cos(a) * e1[2] + Math.sin(a) * e2[2])];
    const M = rotFrom(r);
    TV.forEach((v, j) => { const q = mv(M, v); NUCLEONS.push({ p: [c[0] + q[0] * TET, c[1] + q[1] * TET, c[2] + q[2] * TET], kind: j < 2 ? 'p' : 'n', seed: (r() * 1e6) | 0, ph: [r() * 6.28, r() * 6.28, r() * 6.28] }); });
  }
}
// the hero: the proton nearest the camera (largest z)
export const HERO = NUCLEONS.reduce((bi, n, i) => (n.kind === 'p' && n.p[2] > NUCLEONS[bi].p[2] ? i : bi), NUCLEONS.findIndex((n) => n.kind === 'p'));
// valence quarks per nucleon (nucleon frame, fm): a Y around the centre. The hero's up quark (index 0) faces the camera.
for (let i = 0; i < NUCLEONS.length; i++) {
  const n = NUCLEONS[i], r = rng(n.seed + 5);
  const flav = n.kind === 'p' ? ['u', 'u', 'd'] : ['u', 'd', 'd'];
  let Q;
  // hero: u faces the camera, ~0.08 fm off the centre line; the junction sits 39° off that line, so in the deep zoom nothing
  // of the Y stays inside the view cone behind the quark
  if (i === HERO) Q = [[0.10, 0.08, 0.32], [-0.46, 0.06, -0.12], [0.06, -0.41, -0.20]];
  else { const M = rotFrom(r); Q = [0, 1, 2].map((j) => { const a = j * 2.0944 + r() * 0.4; return mv(M, [Math.cos(a) * 0.36, Math.sin(a) * 0.36, (r() - 0.5) * 0.1]); }); }
  const col = [0, 1, 2].map((j) => (j + (i % 3)) % 3);
  n.quarks = Q.map((p, j) => ({ p, flav: flav[j], col: i === HERO ? [1, 0, 2][j] : col[j], ph: [r() * 6.28, r() * 6.28, r() * 6.28] }));
}
export const nucleonPos = (n, t) => [n.p[0] + 0.05 * Math.sin(0.83 * t + n.ph[0]), n.p[1] + 0.05 * Math.sin(0.67 * t + n.ph[1]), n.p[2] + 0.05 * Math.sin(0.74 * t + n.ph[2])];
// the hero's up quark moves little (it carries the camera in the deep zoom); the others jostle more
export const quarkPos = (n, j, t, hero) => { const q = n.quarks[j], a = hero && j === 0 ? 0.01 : 0.035; return [q.p[0] + a * Math.sin(1.31 * t + q.ph[0]), q.p[1] + a * Math.sin(1.07 * t + q.ph[1]), q.p[2] + a * Math.sin(0.93 * t + q.ph[2])]; };
export const junction = (Q) => [(Q[0][0] + Q[1][0] + Q[2][0]) / 3, (Q[0][1] + Q[1][1] + Q[2][1]) / 3, (Q[0][2] + Q[1][2] + Q[2][2]) / 3];

// QCD-vacuum lumps inside every nucleon (nucleon frame, fm): soft violet clouds, kept off the hero's camera path
export function makeLumps(n, hero) {
  const r = rng(n.seed + 99), out = [], u = n.quarks[0].p;
  for (let k = 0; out.length < (hero ? 26 : 7) && k < 400; k++) {
    const rr = 0.16 + r() * 0.2, d = Math.cbrt(r()) * (R_NUC - rr * 0.7), th = Math.acos(2 * r() - 1), ph = r() * 6.283;
    const p = [d * Math.sin(th) * Math.cos(ph), d * Math.sin(th) * Math.sin(ph), d * Math.cos(th)];
    if (hero && p[2] > u[2] - 0.15 - rr && Math.hypot(p[0] - u[0], p[1] - u[1]) < rr + 0.16 + 0.8 * Math.max(0, p[2] - u[2])) continue; // camera path (calm pass: wider cone, no lump crosses the lens)
    out.push({ p, r: rr, seed: (r() * 1e6) | 0, ph: r() * 6.28 });
  }
  return out;
}

// ---------- drawing (screen space) ----------
const arc = (x, y, r) => { const p = new Path2D(); p.arc(x, y, Math.max(r, 0.01), 0, 6.2832); return p; };
// a nucleon is a CELL: ring (R) + interior (radius 0.84 R, centre moved 0.06 R toward the light, so the ring is thicker on the
// shadow side). ballCovers = the interior alone fills the view (then the whole visible frame is the interior colour: no pop).
const IN_K = 0.84, IN_O = 0.06;
export function ballCovers(V, x, y, R) { return V.covers(x + L[0] * R * IN_O, y + L[1] * R * IN_O, R * IN_K * 0.995); }
const inArc = (x, y, R) => arc(x + L[0] * R * IN_O, y + L[1] * R * IN_O, R * IN_K);
function interiorFill(c, x, y, R, P) {
  const ip = inArc(x, y, R); c.fillStyle = P.in; c.fill(ip);
  if (R < 4e5 && R > 3) crescent(c, ip, P.inDark, L[0] * R * 0.1, L[1] * R * 0.1);
}
function ringFill(c, V, x, y, R, P) {
  const o = arc(x, y, R), ring = new Path2D(); ring.addPath(o); ring.addPath(inArc(x, y, R));
  c.save(); c.clip(ring, 'evenodd'); c.fillStyle = P.base; c.fill(o);
  if (R < 4e5) { crescent(c, o, P.dark, L[0] * R * 0.14, L[1] * R * 0.14); crescent(c, o, P.lit, -L[0] * R * 0.06, -L[1] * R * 0.06); }
  c.restore();
  if (R > 3 && R < 4e5) { c.fillStyle = rgba(P.hi, 0.85); c.beginPath(); c.ellipse(x + L[0] * R * 0.86, y + L[1] * R * 0.86, R * 0.13, R * 0.045, Math.atan2(L[1], L[0]) + Math.PI / 2, 0, 6.2832); c.fill(); }
}
// back of the hero nucleon: its interior (opaque). Returns true when it fills the view.
export function nucleonBack(c, V, x, y, R, kind, P = NCOL[kind]) {
  if (ballCovers(V, x, y, R)) { c.fillStyle = P.in; c.fillRect(0, 0, V.w, V.h); return true; }
  interiorFill(c, x, y, R, P); return false;
}
// front of the hero nucleon: the ring only (a membrane is dense edge-on, clear face-on), so its real quarks show inside
export function nucleonFront(c, V, x, y, R, kind, P = NCOL[kind]) {
  if (R < 0.8 || ballCovers(V, x, y, R)) return; ringFill(c, V, x, y, R, P);
}
// a whole nucleon cell (the other 11): ring + interior + its three quarks as small nuclei (the reference's cell nucleus)
export function nucleonBall(c, V, x, y, R, kind, hole = null, P = NCOL[kind], qs = null) {
  if (R < 0.4) return;
  if (ballCovers(V, x, y, R)) { c.fillStyle = P.in; c.fillRect(0, 0, V.w, V.h); return; }
  if (R < 1.6) { c.fillStyle = P.base; c.beginPath(); c.arc(x, y, R, 0, 6.2832); c.fill(); return; }
  interiorFill(c, x, y, R, P);
  if (qs && R > 5) for (const [qx, qy, k] of qs) flatBall(c, x + qx * R, y + qy * R, R * 0.17, QBALL[k]);
  ringFill(c, V, x, y, R, P);
}
// a whole small ball (quarks inside nucleons, pair particles): the orb recipe (base, dark crescent, lit crescent, flat highlight)
export function flatBall(c, x, y, R, P) {
  if (R < 0.4) return; const o = arc(x, y, R); c.fillStyle = P.base; c.fill(o);
  if (R > 2) { crescent(c, o, P.dark, L[0] * R * 0.18, L[1] * R * 0.18); if (R > 4) crescent(c, o, P.lit, -L[0] * R * 0.07, -L[1] * R * 0.07);
    c.fillStyle = rgba(P.hi, 0.85); c.beginPath(); c.ellipse(x + L[0] * R * 0.42, y + L[1] * R * 0.42, R * 0.22, R * 0.12, Math.atan2(L[1], L[0]) + Math.PI / 2, 0, 6.2832); c.fill(); }
}
// gluon flux tubes: solid shaded tubes (dark band, base band shifted toward the light, thin highlight), built from samples along
// the 3D line; constant width in the middle and a cusp (w ∝ s³) at each quark, where the tube disappears into the quark's cloud.
export function tubePoly(P, pts, widths, ox = 0, oy = 0) {
  const n = pts.length; if (n < 2) return; const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)]; let dx = q[0] - o[0], dy = q[1] - o[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = widths[i] / 2; left.push([p[0] + ox * w - dy * w, p[1] + oy * w + dx * w]); right.push([p[0] + ox * w + dy * w, p[1] + oy * w - dx * w]);
  }
  P.moveTo(left[0][0], left[0][1]); for (let i = 1; i < n; i++) P.lineTo(left[i][0], left[i][1]);
  for (let i = n - 1; i >= 0; i--) P.lineTo(right[i][0], right[i][1]); P.closePath();
}
export const TUBE_W = 0.085; // fm (lattice: the field extends ~0.3–0.4 fm around a narrower core)
const tubeW = (u) => TUBE_W * Math.min(1, (u / 0.45) ** 3);
// the Y: a glowing gold field tube (soft halo, solid core, bright centre line; no bevel). Additive halo = luminous field.
export function drawFluxY(c, V, Q, J, project, alpha = 1) {
  const pj = project(J); if (pj[2] <= V.near) return;
  const arms = []; let wmax = 0;
  for (let j = 0; j < 3; j++) {
    const pts = [], ws = [];
    for (let k = 0; k <= 40; k++) {
      const s = k < 20 ? k / 20 * 0.55 : 1 - 0.45 * Math.pow(1 - (k - 20) / 20, 2.4), q = [J[0] + (Q[j][0] - J[0]) * s, J[1] + (Q[j][1] - J[1]) * s, J[2] + (Q[j][2] - J[2]) * s];
      const p = project(q); if (p[2] <= V.near) break; const w = V.px(tubeW(1 - s) * FM, p[2]); if (w < 0.4) break; pts.push(p); ws.push(w); wmax = Math.max(wmax, w);
    }
    if (pts.length < 2) continue;
    const core = new Path2D(), hot = new Path2D(); tubePoly(core, pts, ws); tubePoly(hot, pts.slice(3), ws.slice(3).map((w) => w * 0.35)); arms.push([core, hot]);
  }
  if (!arms.length) return;
  const rj = V.px(TUBE_W * 0.6 * FM, pj[2]);
  c.save(); c.globalAlpha *= alpha;
  // solid gold core, each arm filled on its own (no winding cancellation), with a soft glow around it (luminous field)
  c.shadowColor = rgba(FAM.gold.base, 0.25); c.shadowBlur = clamp(wmax * 0.4, 2, 30);
  c.fillStyle = mix(FAM.gold.base, FAM.coral.base, 0.3); // (unification) a warm tube, not a white-hot neon
  for (const [core] of arms) c.fill(core);
  c.beginPath(); c.arc(pj[0], pj[1], rj, 0, 6.2832); c.fill();
  c.shadowBlur = 0; c.shadowColor = 'transparent';
  c.globalCompositeOperation = 'lighter'; c.fillStyle = rgba(FAM.gold.lit, 0.15);
  for (const [, hot] of arms) c.fill(hot);
  const g = c.createRadialGradient(pj[0], pj[1], 0, pj[0], pj[1], rj * 0.9); g.addColorStop(0, rgba(FAM.gold.glow, 0.45)); g.addColorStop(1, rgba(FAM.gold.base, 0)); c.fillStyle = g; c.beginPath(); c.arc(pj[0], pj[1], rj * 0.9, 0, 6.2832); c.fill();
  c.restore();
}
// the quark's unresolved core: a glowing point (luminous); size law below a pixel (kit.pointLaw-style dimming)
export function quarkPoint(c, x, y, rPx, col, a = 1) {
  const r = Math.max(rPx, 1.6), k = Math.min(1, Math.sqrt(Math.max(rPx, 0) / 1.6)) * a; if (k < 0.03) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, rgba(mix(col, '#ffffff', 0.6), 0.75 * k)); g.addColorStop(0.3, rgba(col, 0.3 * k)); g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 4, 0, 6.2832); c.fill(); c.restore();
  c.fillStyle = rgba(mix(col, '#ffffff', 0.8), k); c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
}
