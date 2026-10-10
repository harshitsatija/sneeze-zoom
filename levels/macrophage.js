// The HERO macrophage (21 µm), drawn at every zoom from the mm scale down, as real depth layers in frame 'mac'
// (origin = its footprint centre on the epithelium, +z = height toward the camera, unit 1 µm):
//   floor   0.6 µm   arms + body (the same shared drawing as every other macrophage, minus nucleus/interior)
//   interior 0.9–7.2 µm  organelles in height slabs: ER, Golgi, mitochondria, lysosomes, phagosomes with captured
//                    rhinoviruses (real 30 nm), microtubules, vesicles. Each slab is a planar layer → parallax.
//   dome    1.2–12.5 µm  the top membrane: nested blob annuli at their real heights, constant-alpha translucent.
// The camera descends through the dome apex: the top annulus has a small opening exactly where the camera path
// crosses, so a hole opens at the centre and grows outward as each annulus passes above the camera. No fades.
// The nucleus is NOT drawn here: levels/nucleus.js draws it at frame 'mnuc' at every zoom.
import { PAL, solid, crescent, spec, blob, circle, rgba, mix, ball, T, UL, pointLaw } from '../core/kit.js';
import { rng, clamp, ss } from '../core/m.js';
import { macrophage, macrophageShape, virion } from '../shared/immune.js';
import { MAC, MNUC } from '../core/anchors.js';
import { faceClipFor, clipItems, slitOpen } from './man.js';
import { viewBox, planeOK } from './body-util.js';
import { footR } from './nuc-geom.js';

const UM = 1e-6;
export const HERO = { r: 10.5, seed: 777 };
let _sc = null; function scratch(w, h) { if (!_sc) _sc = document.createElement('canvas'); if (_sc.width !== w || _sc.height !== h) { _sc.width = w; _sc.height = h; } return _sc; }
const R_ = HERO.r;
// the nucleus footprint (levels/nuc-geom.js owns it: a = 5.0, b = 3.85, c = 2.9 µm, indented toward the cell centre)
const NUC = { x: MNUC[0] / UM, y: MNUC[1] / UM, rx: 5.0, ry: 3.85, dent: Math.atan2(-1.6, -2.2) };
const C = [-2.3, -0.75];       // dome apex footprint = where the camera path (key z -5.2) crosses the membrane
const H = 14, H0 = 1.2;     // apex height, rim height
const NA = 16, HOLE = 0.75;    // annuli, apex opening radius (µm)

// ---------------- interior inventory (deterministic) ----------------
const R = rng(4711);
const inNuc = (x, y, pad) => Math.hypot(x - NUC.x, y - NUC.y) < footR(Math.atan2(y - NUC.y, x - NUC.x)) + pad; // the real bean footprint (levels/nuc-geom.js)
const inBody = (x, y, k = 0.82) => Math.hypot(x, y) < R_ * k;
const PH = [ // phagosomes: x, y, h, r, kind
  { x: -4.3, y: -2.7, h: 2.8, r: 2.2, kind: 'main' },
  { x: -0.9, y: -5.9, h: 2.2, r: 1.25, kind: 'lyso' },
  { x: -6.6, y: 1.9, h: 3.1, r: 0.95, kind: 'pino' },
];
const inPh = (x, y, pad) => PH.some((p) => Math.hypot(x - p.x, y - p.y) < p.r + pad);
// the camera's descent (sampled from the camera path, t-independent part): height → xy in 'mac' µm
const PATH = [[16, -2.35, -0.78], [13.3, -2.35, -0.78], [11.3, -1.37, -0.27], [9.76, -0.45, 0.22], [8.53, 0.41, 0.68], [7.56, 1.13, 1.06], [6.79, 1.66, 1.34], [6.16, 1.99, 1.52], [5.65, 2.16, 1.6], [4.9, 2.22, 1.63]];
export function pathAt(h) { if (h >= PATH[0][0]) return [PATH[0][1], PATH[0][2]]; for (let i = 1; i < PATH.length; i++) if (h >= PATH[i][0]) { const a = PATH[i - 1], b = PATH[i], u = (h - b[0]) / (a[0] - b[0]); return [b[1] + (a[1] - b[1]) * u, b[2] + (a[2] - b[2]) * u]; } const l = PATH[PATH.length - 1]; return [l[1], l[2]]; }
// an object at height h would pass THROUGH the camera if it sits on the path at that height (drift adds ±0.35 µm)
const inCorridor = (x, y, h, r) => h > 4.6 && Math.hypot(x - pathAt(h)[0], y - pathAt(h)[1]) < r + 0.6;
const NUC_TOP = 6.7; // assumed top of the nucleus (levels/nucleus.js); organelles may float above it
const free = (x, y, pad, h = 0) => inBody(x, y) && (h > NUC_TOP + pad || !inNuc(x, y, pad)) && !inPh(x, y, pad) && !inCorridor(x, y, h, pad);
// phagosome contents: rhinovirus clusters (opsonised clumps), apoptotic debris of an infected epithelial cell
for (const p of PH) {
  const n = p.kind === 'main' ? 15 : p.kind === 'pino' ? 3 : 5; p.clusters = []; p.debris = [];
  for (let i = 0; i < n; i++) { const a = R() * 6.283, d = Math.sqrt(R()) * p.r * 0.62, cr = 0.1 + R() * 0.16, nv = 12 + ((R() * 30) | 0), vs = [];
    for (let j = 0; j < nv; j++) { const b = R() * 6.283, e = Math.sqrt(R()) * cr; vs.push([Math.cos(b) * e, Math.sin(b) * e]); }
    const ab = []; if (i % 2 === 0) for (let j = 0; j < 14; j++) { const b = R() * 6.283; ab.push([Math.cos(b) * cr * 1.05, Math.sin(b) * cr * 1.05, b]); }
    p.clusters.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, cr, vs, ab }); }
  if (p.kind !== 'pino') for (let i = 0; i < (p.kind === 'main' ? 11 : 5); i++) { const a = R() * 6.283, d = Math.sqrt(R()) * p.r * 0.6; p.debris.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: 0.18 + R() * 0.28, kind: i % 3, seed: (R() * 1e6) | 0, rot: R() * 6.28 }); }
  // lysosomes docking on the rim (phagolysosome fusion)
  p.dock = []; for (let i = 0; i < (p.kind === 'main' ? 5 : 2); i++) { const a = R() * 6.283; p.dock.push({ a, r: 0.28 + R() * 0.2 }); }
}
const org = []; // { kind, x, y, h, ... }
const place = (pad, h, tries = 40) => { for (let i = 0; i < tries; i++) { const a = R() * 6.283, d = Math.sqrt(R()) * R_ * 0.8, x = Math.cos(a) * d, y = Math.sin(a) * d; if (free(x, y, pad, h)) return [x, y]; } return null; };
for (let i = 0; i < 26; i++) { const h = 1.0 + R() * 3.6, p = place(0.9, h); if (i % 2) continue; if (p) org.push({ kind: 'mito', x: p[0], y: p[1], h, L: 1.2 + R() * 1.3, W: 0.48 + R() * 0.12, rot: R() * 3.14, bend: (R() - 0.5) * 0.5 }); }
for (let i = 0; i < 70; i++) { const h = 1.2 + R() * 7.5, p = place(0.35, h); if (p) org.push({ kind: 'lyso', x: p[0], y: p[1], h, r: 0.14 + Math.pow(R(), 2) * 0.4 }); }
for (let i = 0; i < 240; i++) { const h = 0.8 + R() * 10.5, p = place(0.1, h); if (p) org.push({ kind: 'ves', x: p[0], y: p[1], h, r: 0.04 + R() * 0.08, c: R() < 0.25 ? 1 : 0 }); }
// rough ER: meandering rounded tubes in a shell around the nucleus
for (let i = 0; i < 9; i++) { const a0 = R() * 6.283, rr = 1.25 + R() * 0.35, h = 1.6 + R() * 1.6; const pts = []; let a = a0;
  for (let j = 0; j < 9; j++) { a += 0.16 + R() * 0.1; const k = rr + (j % 2 ? 0.12 : -0.05) * (1 + R()); pts.push([NUC.x + Math.cos(a) * NUC.rx * k, NUC.y + Math.sin(a) * NUC.ry * k]); }
  if (pts.every(([x, y]) => inBody(x, y, 0.9) && !inPh(x, y, 0.3))) org.push({ kind: 'er', x: pts[4][0], y: pts[4][1], h, pts, w: 0.3 }); }
// Golgi: a stack of curved cisternae in the nucleus' indentation (facing the cell centre), centrosome beside it
const GOL = { x: NUC.x + Math.cos(NUC.dent) * 4.4, y: NUC.y + Math.sin(NUC.dent) * 4.4, h: 3.6, rot: NUC.dent + Math.PI };
org.push({ kind: 'golgi', ...GOL });
const MTOC = { x: GOL.x + Math.cos(NUC.dent) * 1.6, y: GOL.y + Math.sin(NUC.dent) * 1.6, h: 2.2 };
const mts = []; for (let i = 0; i < 26; i++) { const a = i / 26 * 6.283 + R() * 0.2, L = 5 + R() * 4.5, b = (R() - 0.5) * 0.25; const pts = []; for (let j = 0; j <= 12; j++) { const u = j / 12, x = MTOC.x + Math.cos(a + b * u) * L * u, y = MTOC.y + Math.sin(a + b * u) * L * u; if (inNuc(x, y, 0.15) || !inBody(x, y, 0.95)) break; pts.push([x, y]); } if (pts.length > 2) mts.push(pts); }
org.push({ kind: 'mt', x: MTOC.x, y: MTOC.y, h: MTOC.h });
PH.forEach((p) => org.push({ kind: 'phago', x: p.x, y: p.y, h: p.h, p }));
// height slabs → one planar layer each
const SLABS = [0.95, 1.7, 2.45, 3.2, 4.1, 5.2, 6.6, 8.6];
const slabOf = (h) => { let b = 0; for (let i = 1; i < SLABS.length; i++) if (Math.abs(SLABS[i] - h) < Math.abs(SLABS[b] - h)) b = i; return b; };
const slabs = SLABS.map(() => []); for (const o of org) { o.rad = o.kind === 'mito' ? o.L : o.kind === 'er' ? 9 : o.kind === 'golgi' ? 2.2 : o.kind === 'mt' ? 10 : o.kind === 'phago' ? o.p.r * 1.2 : o.r; slabs[slabOf(o.h)].push(o); }
// actin cortex: a meshwork band just inside the rim (bundles ~0.06 µm), on the floor
const cortex = (() => { const p = new Path2D(); const Q = rng(99); for (let i = 0; i < 260; i++) { const a = Q() * 6.283, d = R_ * (0.8 + Q() * 0.17), b = a + 1.57 + (Q() - 0.5) * 1.6, L = 0.6 + Q() * 1.4; const x = Math.cos(a) * d, y = Math.sin(a) * d; p.moveTo(x, y); p.lineTo(x + Math.cos(b) * L, y + Math.sin(b) * L); } return p; })();

// free ribosomes / small vesicles: a periodic 4 µm tile of dots, repeated in several height layers (depth cue at the
// smallest interior scales; each dot ~25 nm, real)
const RT = 4, RIBO = (() => { const Q = rng(31337), out = []; for (let i = 0; i < 70; i++) out.push([Q() * RT, Q() * RT, Q() < 0.18]); return out; })();
const RIBO_H = [1.3, 2.9, 4.3, 5.5, 7.4, 9.6];
// ---------------- organelle drawings (µm, y up) ----------------
// interior hierarchy: the phagosome (dark) and nucleus (cyan) lead; organelles are quiet pink-violet tones of the cell
const MITO_OUT = mix(PAL.macDark, PAL.cyto2, 0.35), MITO_IN = mix(PAL.mac, PAL.macDark, 0.35), MITO_DOT = PAL.macDots;
function drawMito(c, o, s) {
  c.save(); c.translate(o.x, o.y); c.rotate(o.rot);
  const L = o.L, W = o.W; c.lineCap = 'round';
  const path = new Path2D(); path.moveTo(-L / 2 + W / 2, 0); path.quadraticCurveTo(0, o.bend * L * 0.4, L / 2 - W / 2, 0);
  c.strokeStyle = MITO_OUT; c.lineWidth = W; c.stroke(path);
  c.strokeStyle = MITO_IN; c.lineWidth = W * 0.66; c.save(); c.translate(-UL[0] * W * 0.06, -UL[1] * W * 0.06); c.stroke(path); c.restore();
  if (W * s > 4) { c.fillStyle = MITO_DOT; for (let k = -1; k <= 1; k++) { const u = k * (L - W) * 0.32; c.beginPath(); c.arc(u, o.bend * L * 0.4 * (1 - (2 * u / L) ** 2) * 0.5, W * 0.17, 0, 6.283); c.fill(); } }
  c.restore();
}
function drawPhago(c, p, s, t) {
  const Q = rng(p.x * 1000 | 0);
  // toothed membrane rim (lighter), dark lumen, then contents
  c.fillStyle = PAL.macLit; c.beginPath(); for (let k = 0; k <= 64; k++) { const a = k / 64 * 6.283, rr = p.r * (1.07 + 0.035 * (k % 2)); k ? c.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr) : c.moveTo(p.x + rr, p.y); } c.fill();
  // lumen: a shaded sphere, not a dead disc (base violet, shadow crescent away from the light, lit crescent toward it)
  c.save(); c.translate(p.x, p.y); c.scale(p.r * 1.0, p.r * 1.0);
  solid(c, circle, p.kind === 'lyso' ? '#4a1a72' : '#3c1266', { shadow: '#24083e', so: 0.16, light: '#5e2a8a', lo: 0.07 }); c.restore();
  // docking lysosomes
  for (const d of p.dock) ball(c, p.x + Math.cos(d.a) * (p.r + d.r * 0.6), p.y + Math.sin(d.a) * (p.r + d.r * 0.6), d.r, PAL.cyto2, PAL.cyto, d.r * s > 3 ? PAL.macDots : null, 0.7);
  // debris of a dead infected epithelial cell: nuclear fragments (cyan), membrane shreds (magenta)
  for (const d of p.debris) { if (d.kind === 0) ball(c, d.x, d.y, d.r, PAL.nuc, mix(PAL.nuc, '#0f0020', 0.4), d.r * s > 4 ? PAL.spec : null, 0.8); else { c.save(); c.translate(d.x, d.y); c.rotate(d.rot); c.scale(d.r, d.r * 0.6); c.fillStyle = d.kind === 1 ? PAL.tissueLit : PAL.ab; c.fill(blob(d.seed, 0.25, 4)); c.restore(); } }
  // captured rhinoviruses: real 30 nm. Unresolved clusters are drawn as their coverage (same colour, same area)
  const rv = 0.015, rpx = rv * s;
  for (const cl of p.clusters) {
    const jx = Math.sin(t * 0.7 + cl.x * 9) * 0.03, jy = Math.cos(t * 0.6 + cl.y * 7) * 0.03;
    // antibody (IgA) coat: a lime halo of 15 nm Y's around opsonised clumps; unresolved it is a lime ring of the same area
    if (cl.ab.length) { if (rpx < 1.2) { c.fillStyle = rgba(PAL.ab, 0.9); c.beginPath(); c.arc(cl.x + jx + UL[0] * cl.cr * 0.08, cl.y + jy + UL[1] * cl.cr * 0.08, cl.cr * 1.12, 0, 6.283); c.fill(); }
      else { c.strokeStyle = PAL.ab; c.lineWidth = 0.004; c.lineCap = 'round'; c.beginPath(); for (const [ax, ay, b] of cl.ab) { const X = cl.x + jx + ax, Y = cl.y + jy + ay, ca = Math.cos(b), sa = Math.sin(b); c.moveTo(X, Y); c.lineTo(X + ca * 0.008, Y + sa * 0.008); c.lineTo(X + ca * 0.013 - sa * 0.005, Y + sa * 0.013 + ca * 0.005); c.moveTo(X + ca * 0.008, Y + sa * 0.008); c.lineTo(X + ca * 0.013 + sa * 0.005, Y + sa * 0.013 - ca * 0.005); } c.stroke(); } }
    if (rpx < 0.6) { const cov = cl.ab.length ? 1 : Math.min(1, cl.vs.length * rv * rv / (cl.cr * cl.cr) * 1.6); c.fillStyle = rgba(PAL.virus, Math.min(1, cov * 1.15)); c.beginPath(); c.arc(cl.x + jx, cl.y + jy, cl.cr * 0.85, 0, 6.283); c.fill(); continue; }
    if (rpx < 2.5) { c.fillStyle = PAL.virus; c.beginPath(); for (const [vx, vy] of cl.vs) { c.moveTo(cl.x + jx + vx + rv, cl.y + jy + vy); c.arc(cl.x + jx + vx, cl.y + jy + vy, rv, 0, 6.283); } c.fill(); continue; }
    for (const [vx, vy] of cl.vs) { c.save(); c.translate(cl.x + jx + vx, cl.y + jy + vy); virion(c, rv); c.restore(); }
  }
}
function drawER(c, o, s) {
  const p = new Path2D(); const P = o.pts; p.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length - 1; i++) { const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2; p.quadraticCurveTo(P[i][0], P[i][1], mx, my); } p.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = mix(PAL.macDark, PAL.cyto2, 0.25); c.lineWidth = o.w; c.stroke(p);
  c.strokeStyle = mix(PAL.mac, PAL.macDots, 0.3); c.lineWidth = o.w * 0.4; c.save(); c.translate(-UL[0] * 0.05, -UL[1] * 0.05); c.stroke(p); c.restore();
  if (o.w * s > 6) { const Q = rng(o.pts.length * 31 + (o.x * 100 | 0)); c.fillStyle = PAL.protein; for (let i = 0; i < P.length - 1; i++) for (let k = 0; k < 6; k++) { const u = Q(), x = P[i][0] + (P[i + 1][0] - P[i][0]) * u, y = P[i][1] + (P[i + 1][1] - P[i][1]) * u, sd = Q() < 0.5 ? 1 : -1; const nx = -(P[i + 1][1] - P[i][1]), ny = P[i + 1][0] - P[i][0], nl = Math.hypot(nx, ny) || 1; c.beginPath(); c.arc(x + nx / nl * o.w * 0.55 * sd, y + ny / nl * o.w * 0.55 * sd, 0.025, 0, 6.283); c.fill(); } }
}
function drawGolgi(c, o, s) {
  c.save(); c.translate(o.x, o.y); c.rotate(o.rot + Math.PI); c.lineCap = 'round';
  for (let k = 0; k < 5; k++) { const r = 0.9 + k * 0.32, sw = 0.95 - k * 0.07; c.strokeStyle = k % 2 ? PAL.macDots : mix(PAL.macLit, PAL.macDark, 0.3); c.lineWidth = 0.2; c.beginPath(); c.arc(-1.6, 0, r, -sw, sw); c.stroke(); }
  c.fillStyle = PAL.macDots; const Q = rng(5); for (let k = 0; k < 9; k++) { const a = (Q() - 0.5) * 2.2, r = 2.6 + Q() * 0.6; c.beginPath(); c.arc(-1.6 + Math.cos(a) * r, Math.sin(a) * r, 0.1 + Q() * 0.06, 0, 6.283); c.fill(); }
  c.restore();
}

export default {
  id: 'macrophage', zr: [-34.6, 1.2],
  draw(V, items, labels) { if (!slitOpen(V)) return; const n0 = items.length; this.draw0(V, items, labels); clipItems(items, n0, faceClipFor(V)); },
  draw0(V, items, labels) {
    const t = V.t; const cm = V.c('mac').p, cx = cm[0] / UM, cy = cm[1] / UM, cz = cm[2] / UM, Wum = V.W / UM;
    const cone = (x, y, r, h) => Math.hypot(x - cx, y - cy) - r < 0.42 * (cz - h) + Wum; // can (x,y,r) at height h be in view?
    const lay = (h) => (planeOK(V, 'mac', h * UM) ? V.layer('mac', [0, 0, h * UM], [UM, 0, 0], [0, UM, 0]) : null);
    const A0 = lay(0.6); if (!A0) return; const s0 = Math.hypot(A0.a, A0.b); if (s0 * R_ * 2.5 < 0.4) return;
    if (!V.onScreen(A0.e, A0.f, R_ * 2.8 * s0 + 4)) return;
    // ---- floor: arms + body (shared drawing), actin cortex band
    items.push({ name: 'hero-floor', d: A0.depth, blur: V.coc(A0.depth), draw(c) {
      T(c, A0); macrophage(c, R_, HERO.seed, t, { nucleus: false, phago: false, granules: false });
    } });
    // ---- interior slabs
    if (s0 * R_ > 6) SLABS.forEach((h, si) => {
      const A = lay(h); if (!A) return; const s = Math.hypot(A.a, A.b);
      const [x0, y0, x1, y1] = viewBox(A, V, 8);
      const vis = slabs[si].filter((o) => o.x + o.rad > x0 && o.x - o.rad < x1 && o.y + o.rad > y0 && o.y - o.rad < y1 && (o.rad * s > 0.5) && cone(o.x, o.y, o.rad, h));
      if (!vis.length) return;
      items.push({ name: 'hero-slab', d: A.depth, blur: V.coc(A.depth), draw(c) {
        T(c, A);
        // vesicles + lysosomes batched
        c.fillStyle = rgba(PAL.macDots, 0.75); c.beginPath(); for (const o of vis) if (o.kind === 'ves' && !o.c) { c.moveTo(o.x + o.r, o.y); c.arc(o.x, o.y, o.r, 0, 6.283); } c.fill();
        c.fillStyle = rgba(PAL.protein, 0.8); c.beginPath(); for (const o of vis) if (o.kind === 'ves' && o.c) { c.moveTo(o.x + o.r, o.y); c.arc(o.x, o.y, o.r, 0, 6.283); } c.fill();
        for (const o0 of vis) { const j = o0.kind === 'phago' || o0.kind === 'golgi' || o0.kind === 'er' || o0.kind === 'mt' ? 0 : 0.12 + 0.1 * (o0.h % 1);
          const o = j ? { ...o0, x: o0.x + Math.sin(t * 0.7 + o0.h * 13) * j, y: o0.y + Math.cos(t * 0.6 + o0.x * 7) * j, rot: (o0.rot || 0) + Math.sin(t * 0.3 + o0.y) * 0.15 } : o0;
          if (o.kind === 'lyso') { if (o.r * s < 2) { c.fillStyle = PAL.cyto2; c.beginPath(); c.arc(o.x, o.y, o.r, 0, 6.283); c.fill(); } else ball(c, o.x, o.y, o.r, PAL.cyto2, PAL.cyto, PAL.macDots, 0.6); }
          else if (o.kind === 'mito') drawMito(c, o, s);
          else if (o.kind === 'er') drawER(c, o, s);
          else if (o.kind === 'golgi') drawGolgi(c, o, s);
          else if (o.kind === 'phago') drawPhago(c, o.p, s, t);
          else if (o.kind === 'mt') { c.strokeStyle = rgba(PAL.macLit, 0.14); c.lineWidth = 0.16; c.lineCap = 'round'; c.beginPath(); for (const P of mts) { c.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) c.lineTo(P[i][0], P[i][1]); } c.stroke();
            ball(c, MTOC.x, MTOC.y, 0.25, PAL.macLit, PAL.mac, null); }
        }
      } });
    });
    // ---- ribosome dot layers
    RIBO_H.forEach((h, li) => {
      const A = lay(h); if (!A) return; const s = Math.hypot(A.a, A.b); if (0.014 * s < 0.35) return;
      const [x0, y0, x1, y1] = viewBox(A, V, 4); if (x1 - x0 > 60) return;
      const pts = [], ptsG = [];
      for (let i = Math.floor(x0 / RT); i <= Math.floor(x1 / RT); i++) for (let j = Math.floor(y0 / RT); j <= Math.floor(y1 / RT); j++) for (const [dx, dy, gr] of RIBO) {
        const x = i * RT + ((dx + li * 1.37) % RT), y = j * RT + ((dy + li * 2.11) % RT);
        if (x < x0 || x > x1 || y < y0 || y > y1 || !inBody(x, y, 0.93) || (h < NUC_TOP && inNuc(x, y, 0.25)) || inPh(x, y, 0.1) || inCorridor(x, y, h, 0.02)) continue; (gr ? ptsG : pts).push(x, y); }
      if (!pts.length && !ptsG.length) return;
      items.push({ name: 'hero-ribo', d: A.depth, blur: V.coc(A.depth), draw(c) { T(c, A); const r = 0.014;
        c.fillStyle = rgba(PAL.macDots, 0.8); c.beginPath(); for (let i = 0; i < pts.length; i += 2) { c.moveTo(pts[i] + r, pts[i + 1]); c.arc(pts[i], pts[i + 1], r, 0, 6.283); } c.fill();
        c.fillStyle = rgba(PAL.protein, 0.85); c.beginPath(); for (let i = 0; i < ptsG.length; i += 2) { c.moveTo(ptsG[i] + r, ptsG[i + 1]); c.arc(ptsG[i], ptsG[i + 1], r, 0, 6.283); } c.fill(); } });
    });
    // ---- dome: nested annuli at real heights (the top membrane). Drawn opaque into a scratch canvas with stepped
    // Kurzgesagt tones (rim → lit core), composited at ONE constant alpha (a translucent material, no stacking stripes).
    const shape = macrophageShape(HERO.seed, t);
    const S = (h) => Math.sqrt(Math.max(0, 1 - ((h - H0) / (H - H0)) ** 2));
    const dh = (H - H0) / NA, ann = [];
    for (let k = 0; k < NA; k++) { const h = H0 + (k + 0.5) * dh; const A = lay(h); if (!A) continue; if (Math.hypot(A.a, A.b) * R_ < 1.5) continue;
      const si = k === NA - 1 ? HOLE / R_ : S(h + dh * 0.5); if (si * R_ * 0.85 - Math.hypot(cx - C[0], cy - C[1]) > 0.42 * (cz - h) + Wum) continue; // annulus entirely outside the view cone
      ann.push({ k, h, A }); }
    if (ann.length) {
      // thin-membrane optics per annulus: nearly clear face-on, denser where the membrane is seen edge-on
      // alpha = min(1 − (1 − 0.08)^(1/cos θ), 0.5), θ = slope of the dome at that annulus. A material, not a fade.
      const M = (sc) => new DOMMatrix([sc * R_, 0, 0, sc * R_, (1 - sc) * C[0], (1 - sc) * C[1]]);
      const TONES = [PAL.mac, mix(PAL.mac, PAL.macLit, 0.45), PAL.macLit, mix(PAL.macLit, PAL.macDots, 0.5)];
      const top = ann[ann.length - 1].A;
      items.push({ name: 'hero-dome', d: top.depth, blur: V.coc(top.depth), draw(c) {
        let prev = null; // outer edge of the annulus above (screen space): lower annuli are clipped outside it (no double layers)
        for (let i = ann.length - 1; i >= 0; i--) {
          const { k, h, A } = ann[i];
          const so = S(h - dh * 0.5), si = k === NA - 1 ? 0 : S(h + dh * 0.5), sm = Math.max(0.05, S(h));
          const slope = (H - H0) / R_ * sm / Math.sqrt(Math.max(1e-4, 1 - sm * sm)), cosT = 1 / Math.sqrt(1 + slope * slope);
          const alpha = Math.min(1 - Math.pow(0.92, 1 / cosT), 0.5);
          const outer = new Path2D(); outer.addPath(shape, M(so));
          const p = new Path2D(); p.addPath(outer); if (k === NA - 1) p.arc(C[0], C[1], HOLE, 0, 6.283, true); else p.addPath(shape, M(si));
          c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
          if (prev) { const ex = new Path2D(); ex.rect(-1e5, -1e5, 3e5, 3e5); ex.addPath(prev.path, prev.m); c.clip(ex, 'evenodd'); }
          T(c, A); c.globalAlpha = alpha; c.fillStyle = TONES[Math.min(3, Math.floor(k / NA * 4))]; c.fill(p, 'evenodd'); c.restore();
          prev = { path: outer, m: new DOMMatrix([A.a, A.b, A.c, A.d, A.e, A.f]) };
        }
      } });
    }
    // ---- label (inside the cell)
    if (V.z < -4.7 && V.z > -5.28) { const p = PH[0]; const q = V.P('mac', [(p.x + p.r * 1.12) * UM, p.y * UM, p.h * UM]); if (q[2] > 0) labels.push({ x: q[0] + 14, y: q[1] - 14, text: 'Phagosome', sub: 'a bubble of swallowed viruses' }); }
  },
};
