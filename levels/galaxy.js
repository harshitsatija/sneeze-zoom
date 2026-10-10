// COSMOS level (owner: COSMOS agent): the Milky Way, the Local Group, the cosmic web and the observable universe.
// Everything sits at its real position in the 'galaxy' frame (origin Sgr A*, galactic axes; 'cosmos' shares it):
//   - Milky Way: barred spiral, 4 log-spiral arms (pitch 12.5°), bar 4.5 kpc at 27° to the Sun–centre line, the Sun at
//     8.18 kpc inside the Local Arm (Orion Spur) and inside the Local Bubble (no star cloud within 300 pc), arms built of
//     soft star clouds, real nearby cloud complexes (Orion, Taurus, Sco-Cen, Cygnus X, Carina …). Drawn by shared/galaxy.js.
//   - Local Group: M31, M33 + 67 dwarfs from the Local Volume Database at real distance / direction (same renderer).
//   - Cosmic web: 2MRS (41.7k real galaxies with redshift distances, zone of avoidance filled by cloning), filaments = the
//     minimum spanning tree of its density peaks, warm nodes = its richest cells; beyond its depth a statistical web.
//   - The edge: the CMB last-scattering surface as a filled, limb-brightened glowing shell (R = 4.40e26 m).
//   - Minimum-size law (honest, documented enlargement) so Local Group members read as little galaxies.
import { screenSpace, PAL, rgba, mix } from '../core/kit.js';
import { ss } from '../core/m.js';
import { basis } from '../core/cam.js';
import { DEG, rng, mm, qFromM, mFromQ, slerp } from '../core/m.js';
import { rot } from '../core/world.js';
import { ECL_OBL } from '../core/anchors.js';
import { Points, mLim, appMag, VIS, T_CYAN, T_CYANW, T_WHITE, T_WARM, T_ORANGE, T_VIOLET, T_PINK } from '../shared/star.js';
import { makeGalaxy, drawGalaxy, galaxyPx, nucleusPoint, camOf, enlarge, sphere, nebSprite, KPC } from '../shared/galaxy.js';
import { D, loadCosmos, MPC } from './cosmos-data.js';
import { dustItems, prebuildDust } from './space-dust.js';
import { blobSprite, SPRITE_K, SPC } from './space-kit.js';
import { L as LL } from '../core/kit.js';
import { FAM, sink, body, halo, circle } from '../core/look.js';
const EDGE_FAM = { base: FAM.violet.base, dark: FAM.violet.dark, lit: FAM.violet.lit, glow: FAM.violet.glow };

const R_CMB = 4.40e26, LY = 9.4607e15;
// length of the part of a ray (from a point at distance D from a sphere's centre, at cos-angle ct to the centre) inside the sphere
// the shell is drawn as seen from an effective distance that runs ahead of the camera over z 26 -> 27 (log-linear, x6.5 at 26,
// exact from 27): its rim comes in from the frame corners at ~26 and tightens steadily instead of appearing in the last
// 0.1 decade (a documented stretch, like the presence law; exact geometry from z 27 on)
const cmbDc = (dc, z) => dc * Math.pow(10, 0.81 * Math.min(1, Math.max(0, 27.0 - z))); // a constant x6.5 below z 26 (still well inside the shell there)
function cmbChord(D, ct, R) { const st2 = 1 - ct * ct, b2 = D * D * st2; if (b2 >= R * R) return 0; const tc = D * ct, h = Math.sqrt(R * R - b2); return Math.max(0, tc + h) - Math.max(0, tc - h); }
const obl = (az, el) => basis([Math.cos(el * DEG) * Math.cos(az * DEG), Math.cos(el * DEG) * Math.sin(az * DEG), Math.sin(el * DEG)], [0, 0, 1]);
const lbd = (l, b, d) => [Math.cos(b * DEG) * Math.cos(l * DEG) * d, Math.cos(b * DEG) * Math.sin(l * DEG) * d, Math.sin(b * DEG) * d];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

// real nearby star-forming cloud complexes (galactic l, b in deg; distance and radius in pc) — approximate literature values
const CLOUDS = [
  ['Taurus', 172, -15, 140, 16], ['Orion', 209, -19, 410, 42], ['Ophiuchus', 353, 17, 130, 11], ['Sco-Cen', 330, 10, 130, 45],
  ['Perseus', 160, -18, 300, 22], ['Cepheus', 110, 3, 900, 60], ['Cygnus X', 80, 0.5, 1400, 100], ['Carina', 287.6, -0.6, 2300, 80],
  ['Vela', 265, -1.5, 700, 50], ['Gum', 258, -2, 450, 90], ['Lagoon', 6, -1.2, 1250, 32], ['Eagle', 17, 0.8, 1740, 32],
  ['Rosette', 206.3, -2.1, 1600, 32], ['North America', 85.6, -0.8, 800, 28], ['Mon R2', 213.7, -12.6, 830, 28], ['Lupus', 339, 16, 155, 11],
];
const CLOUD_COL = [PAL.nebula, PAL.galArm2, '#2a1a6e', '#4a1a7a'];

const G = { mw: null, lg: [], ext: new Map() };
let SUN = [0, 0, 0], GA = [0, 0, 0], VIRGO = [0, 0, 0], M31 = [0, 0, 0], ORION = [0, 0, 0], SPUR = [0, 0, 0];
const WEBPTS = new Points(8192);
const MINPX = (g) => (g.name.startsWith('Andromeda (') ? 90 : g.name.startsWith('Triangulum') ? 38 : g.name === 'LMC' ? 26 : g.name === 'SMC' ? 18 : g.kind === 'ell' ? 10 : g.kind === 'irr' ? 9 : 7);

function build() {
  SUN = D.sun;
  const sx = SUN[0] / KPC, sy = SUN[1] / KPC;
  // real cloud complexes as clusters of clumps (structure, gaps); Orion: an elongated ridge of pink/magenta clumps with a
  // bright core (the Orion Nebula, M42) — the hero of z 18.5–19.3
  const extra = [], qq = rng(1344);
  CLOUDS.forEach(([n, l, b, d, r], i) => {
    const p = lbd(l, b, d / 1000), cx = sx + p[0], cy = sy + p[1], cz = p[2], R = r / 1000, orion = n === 'Orion';
    const N = orion ? 34 : 7, ang = qq() * Math.PI;
    for (let k = 0; k < N; k++) {
      const t = (qq() - 0.5) * 2, u = (qq() - 0.5) * 2, along = orion ? t * R * 1.1 : t * R * 0.6, across = orion ? u * R * 0.35 : u * R * 0.6;
      const x = cx + Math.cos(ang) * along - Math.sin(ang) * across, y = cy + Math.sin(ang) * along + Math.cos(ang) * across, z = cz + (qq() - 0.5) * R * 0.5;
      const cr = R * (orion ? 0.12 + 0.2 * qq() : 0.25 + 0.25 * qq());
      extra.push({ x, y, z, r: cr, color: orion ? ['#c8207c', '#e0408a', '#7f2362', '#9a3ad8'][k % 4] : ['#7f2362', '#4a2a9e', '#2a6ab0'][i % 3], alpha: orion ? 0.1 : 0.22, // space v3: Orion is no longer the hero (it drifted across the turn); a subtle cloud like its neighbours
        seed: 101 + i * 50 + k, crisp: 1 });
    }
  });
  const o = CLOUDS.find((c) => c[0] === 'Orion'); ORION = add3(SUN, mul3(lbd(o[1], o[2], o[3]), 3.0857e16));
  G.mw = makeGalaxy({
    name: 'Milky Way', kind: 'mw', minPx: 85, O: [0, 0, 0], ex: [1, 0, 0], ey: [0, 1, 0], ez: [0, 0, 1], R: 15, MV: -20.8, dust: true, seed: 42,
    extraBlobs: extra,
    build: { arms: 4, pitch: 12.5, Rb: 3.5, phase: 6 * DEG, bar: 0.3, barAng: 153 * DEG, widths: [0.06, 0.05, 0.034, 0.027, 0.023, 0.018],
      spur: { R0: 8.18, phi0: Math.PI, pitch: 11.4, a: 160 * DEG, b: 207 * DEG, w: 0.25 }, bubble: [sx, sy, 0.15] /* space v3: cloud-free bubble kept small (~150 pc) so the local arm reads from z ~19 */, avoid: [sx, sy, 1.0], nSpr: 1800, sprM: -8.2, nBulge: 420 },
  });
  const pals = ['cyan', 'pink', 'warm'];
  G.lg = D.lg.map((g, k) => {
    const kind = g.kind === 'lmc' ? 'lmc' : g.kind;
    const pal = g.name.startsWith('Andromeda (') ? 'warm' : g.name.startsWith('Triangulum') ? 'cyan' : kind === 'lmc' || g.name === 'SMC' ? 'cyan' : kind === 'ell' || kind === 'sph' ? 'warm' : pals[k % 3];
    const spec = { name: g.name, kind, O: g.O, ex: g.ex, ey: g.ey, ez: g.ez, R: g.R, MV: g.MV, palName: pal, seed: 7 + k * 31, ell: g.ell, label: g.label, sub: g.sub, arms: g.arms, pitch: g.pitch,
      nSpr: kind === 'spiral' ? (g.MV < -20 ? 700 : 260) : kind === 'lmc' ? 160 : kind === 'irr' ? 50 : kind === 'ell' ? 40 : 18, sprM: kind === 'spiral' ? -6 : -5, bar: g.name.startsWith('Andromeda (') ? 0.12 : 0 };
    spec.minPx = MINPX(spec);
    return makeGalaxy(spec);
  });
  M31 = G.lg[0].O;
  { const ph = Math.PI + 0.09, R = 8.18 * Math.exp(Math.tan(11.4 * DEG) * 0.09); SPUR = [R * Math.cos(ph) * KPC, R * Math.sin(ph) * KPC, 0]; } // a spur cloud beyond the Local Bubble
  // camera keys (strictly inside (16.0, 27.2)). v3 (calm pull-out): ONE slow turn (16 -> 19.8) from the solar view up to
  // ~60 deg over the galactic plane on the far side of the Sun from the centre, looking in across the disc, the Sun kept at
  // the centre. From high above, every arm cloud lies near the focus depth (no cloud passes the lens, no giant bokeh) and the
  // disc fills in around the Sun as the local stars thin out. Then only a gentle lowering of the view (19.8 -> 27), the
  // focus easing toward the Local Group's middle and back to us for the end frame.
  const GP = (globalThis.__GP || {}), az1 = GP.az1 ?? 301, el1 = GP.el1 ?? 50, z1 = GP.z1 ?? 20.0;
  const M0 = mm(rot('helio', 'galaxy'), ECL_OBL), M1 = obl(az1, el1), q0 = qFromM(M0), q1 = qFromM(M1);
  const e = 0.6, Lin = z1 - 16 - 2 * e, v = 1 / (2 * e / 1.875 + Lin), fa = v * e / 1.875, keys = [];
  for (let z = 16 + e; z <= z1 - e + 1e-6; z += 0.25) keys.push({ z, fr: 'galaxy', at: SUN.slice(), M: mFromQ(slerp(q0, q1, fa + (z - 16 - e) * v)), thru: true });
  keys.push({ z: z1, fr: 'galaxy', at: SUN.slice(), M: M1 });
  keys.push({ z: 23.4, fr: 'cosmos', at: mul3(M31, 0.45), M: obl(az1 + 6, GP.el2 ?? 36) });
  keys.push({ z: 27.0, fr: 'cosmos', at: SUN.slice(), M: obl(az1 + 12, GP.el3 ?? 30) }); // the end frame: the observable universe centred and whole
  mod.keys = keys;
}

// lazily built extended 2MRS galaxy (only the few that are larger than a pixel at a given moment)
function webGalaxy(i) {
  let g = G.ext.get(i); if (g) return g;
  const W = D.web, p = [W.P[i * 3], W.P[i * 3 + 1], W.P[i * 3 + 2]], M = W.M[i], T = W.T[i];
  const los = [p[0] - SUN[0], p[1] - SUN[1], p[2] - SUN[2]], l = Math.hypot(...los); los[0] /= l; los[1] /= l; los[2] /= l;
  const e1n = [-los[1], los[0], 0], e1l = Math.hypot(...e1n) || 1, e1 = e1n.map((v) => v / e1l), e2 = [los[1] * e1[2] - los[2] * e1[1], los[2] * e1[0] - los[0] * e1[2], los[0] * e1[1] - los[1] * e1[0]];
  const h = (x) => { const s = Math.sin(i * 12.9898 + x * 78.233) * 43758.5453; return s - Math.floor(s); };
  const pa = h(1) * Math.PI, inc = Math.acos(Math.min(0.99, Math.max(0.15, W.BA[i] || 0.6)));
  const maj = [0, 1, 2].map((j) => Math.cos(pa) * e2[j] + Math.sin(pa) * e1[j]), mnr = [0, 1, 2].map((j) => -Math.sin(pa) * e2[j] + Math.cos(pa) * e1[j]);
  const nr = [0, 1, 2].map((j) => -Math.cos(inc) * los[j] + Math.sin(inc) * mnr[j]);
  const ey = [nr[1] * maj[2] - nr[2] * maj[1], nr[2] * maj[0] - nr[0] * maj[2], nr[0] * maj[1] - nr[1] * maj[0]], ez = [maj[1] * ey[2] - maj[2] * ey[1], maj[2] * ey[0] - maj[0] * ey[2], maj[0] * ey[1] - maj[1] * ey[0]];
  const ell = T <= -1 && T > -8;
  g = makeGalaxy({ name: '2mrs' + i, kind: ell ? 'ell' : 'spiral', O: p, ex: maj, ey, ez, R: webR(M) * (ell ? 0.6 : 1), MV: M, palName: webPal(i, T), seed: i, arms: 2, pitch: 10 + 12 * h(2), nSpr: 40, sprM: -8, ell: 0.2 });
  if (G.ext.size > 400) G.ext.clear(); G.ext.set(i, g); return g;
}
const webR = (M) => 12 * Math.pow(10, -0.2 * (M + 21));
const webPal = (i, T) => (T <= -1 && T > -8 ? 'warm' : ['cyan', 'pink', 'warm', 'cyan'][i % 4]);
const webTint = (i, T) => (T <= -1 && T > -8 ? (i % 2 ? T_WARM : T_ORANGE) : [T_CYAN, T_VIOLET, T_CYANW, T_PINK, T_WHITE][i % 5]);

// ---- helpers ----
function proj(C, p) { const o0 = p[0] - C.p[0], o1 = p[1] - C.p[1], o2 = p[2] - C.p[2]; const Z = -(o0 * C.b[0] + o1 * C.b[1] + o2 * C.b[2]); if (Z <= 0) return null; const X = o0 * C.r[0] + o1 * C.r[1] + o2 * C.r[2], Y = o0 * C.u[0] + o1 * C.u[1] + o2 * C.u[2], k = C.f / Z; return [C.cx + X * k, C.cy - Y * k, Z, X, Y]; }
const dist = (C, p) => Math.hypot(p[0] - C.p[0], p[1] - C.p[1], p[2] - C.p[2]);
const cs3 = (C, P, i, out) => { const o0 = P[i] - C.p[0], o1 = P[i + 1] - C.p[1], o2 = P[i + 2] - C.p[2]; out[0] = o0 * C.r[0] + o1 * C.r[1] + o2 * C.r[2]; out[1] = o0 * C.u[0] + o1 * C.u[1] + o2 * C.u[2]; out[2] = -(o0 * C.b[0] + o1 * C.b[1] + o2 * C.b[2]); };

// filaments: glowing strokes of real physical width (a wide soft halo + a brighter core), additive. Width below ~0.6 px
// keeps 0.6 px and dims in proportion (area-conserving).
const FCOL = { realHalo: mix(FAM.violet.base, FAM.magenta.base, 0.4), realCore: FAM.magenta.lit, statHalo: sink(mix(FAM.violet.base, FAM.magenta.base, 0.3), 25, 0.35), statCore: FAM.magenta.lit };
const A0 = [0, 0, 0], B0 = [0, 0, 0]; let EXPO = 1, STATB = 1;
// each filament segment bends softly: a fixed 3D control point, offset perpendicular to the segment by ~20 % of its length
let FCTL = null, FLEN = null, SMED = null;
function ctlPoints() {
  const F = D.fil; FCTL = new Float64Array(F.n * 3); FLEN = new Float32Array(F.n); const q = rng(4242);
  for (let i = 0; i < F.n; i++) {
    const a = F.P.subarray(i * 6, i * 6 + 3), b = F.P.subarray(i * 6 + 3, i * 6 + 6), d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d); FLEN[i] = L / MPC;
    let v = [q() - 0.5, q() - 0.5, q() - 0.5]; const k = (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / (L * L); v = [v[0] - k * d[0], v[1] - k * d[1], v[2] - k * d[2]]; const vl = Math.hypot(...v) || 1;
    const m = (F.S[i] === 0 ? 0.18 : 0.1) * L * (0.4 + 0.6 * q()); for (let j = 0; j < 3; j++) FCTL[i * 3 + j] = (a[j] + b[j]) / 2 + v[j] / vl * m;
  }
  // each statistical shell's median link length: pruning and widths are relative to the shell's own sampling
  SMED = new Float32Array(9); for (let k = 1; k < 9; k++) { const L = []; for (let i = 0; i < F.n; i++) if (F.S[i] === k) L.push(FLEN[i]); L.sort((x, y) => x - y); SMED[k] = L.length ? L[L.length >> 1] : 1; }
}
const M0 = [0, 0, 0];
function drawFilaments(c, C) {
  if (!FCTL) ctlPoints();
  const F = D.fil, buckets = new Map(), chains = [];
  const put = (key, col, a, w, x1, y1, xm, ym, x2, y2) => { let b = buckets.get(key); if (!b) { b = { p: new Path2D(), col, a, w, inner: key[0] === 'i', core: key[0] === 'c' }; buckets.set(key, b); } b.p.moveTo(x1, y1); b.p.quadraticCurveTo(xm, ym, x2, y2); };
  for (let i = 0; i < F.n; i++) {
    cs3(C, F.P, i * 6, A0); cs3(C, F.P, i * 6 + 3, B0); cs3(C, FCTL, i * 3, M0); if (A0[2] <= C.near || B0[2] <= C.near || M0[2] <= C.near) continue;
    const ka = C.f / A0[2], kb = C.f / B0[2], km = C.f / M0[2];
    const x1 = C.cx + A0[0] * ka, y1 = C.cy - A0[1] * ka, x2 = C.cx + B0[0] * kb, y2 = C.cy - B0[1] * kb, xm = C.cx + M0[0] * km, ym = C.cy - M0[1] * km;
    // quadratic control point so the curve passes through the projected middle point
    const qx = 2 * xm - (x1 + x2) / 2, qy = 2 * ym - (y1 + y2) / 2;
    if (Math.max(x1, x2, qx) < -50 || Math.min(x1, x2, qx) > C.w + 50 || Math.max(y1, y2, qy) < -50 || Math.min(y1, y2, qy) > C.h + 50) continue;
    const zm = 2 / (1 / A0[2] + 1 / B0[2]), real = F.S[i] === 0, lam = real ? 1 : Math.min(60 * 2 ** (F.S[i] - 1), 420);
    if (!real && FLEN[i] > 1.25 * SMED[F.S[i]]) continue; // the statistical web keeps its shorter, denser links only
    const wHalo = (real ? 2.0 : 0.12 * SMED[F.S[i]]) * MPC * C.f / zm, wCore = 0.45 * MPC * C.f / zm;
    const wt = real ? Math.min(1, F.W[i] / 2.2) : 1;
    // a wide (near) filament is a chain of soft clouds, like the galaxy arms; thin (far) ones are soft glowing strokes
    if (real && wHalo > 6 * C.s) { chains.push([x1, y1, qx, qy, x2, y2, wHalo * (zm / A0[2]), wHalo * (zm / B0[2]), (real ? 0.024 : 0.016) * wt * Math.min(1, 60 * C.s / wHalo), FCOL.realHalo]); continue; }
    const passes = real ? [[wHalo, 0.05 * wt, FCOL.realHalo, 'h'], [wCore, 0.14 * wt, FCOL.realCore, 'c']] : [[wHalo, 0.075, FCOL.statHalo, 'h']];
    for (const [w, a, col, tag] of passes) {
      // the bright core only where the filament is thin on screen (far away): a near filament is a soft glow, not a line
      const mn = tag === 'h' ? (real ? 1.4 : 2.4) : 0.6, cap = (tag === 'h' ? 48 : 4) * C.s, ww = Math.min(Math.max(w, mn), cap), aa = a * Math.min(1, Math.sqrt(w / mn)) * Math.min(1, cap / w) * (tag === 'c' ? Math.min(1, Math.max(0, (6 * C.s - w) / (4 * C.s))) : 1); if (aa < 0.003) continue;
      const wq = Math.round(Math.log2(ww) * 3), aq = Math.round(aa * 60);
      put(tag + wq + ':' + aq, col, aq / 60, Math.pow(2, wq / 3), x1, y1, qx, qy, x2, y2);
      if (tag === 'h' && ww > 4) put('i' + wq + ':' + aq, col, aq / 60, Math.pow(2, wq / 3) * 0.45, x1, y1, qx, qy, x2, y2); // soft falloff: a narrower inner pass
    }
  }
  // (space restyle) every filament is a chain of beads — a zero-length round dash per bead — in three stacked fills
  // (dark rim, body, light core offset toward the light): the vessel / chromatin language, no hairlines, no graph edges
  c.lineCap = 'round';
  for (const b of buckets.values()) {
    if (b.inner || b.core) continue; const w = Math.max(b.w * 0.8, 3 * C.s), a = Math.min(1, b.a * EXPO * (b.col === FCOL.statHalo ? 1.4 * STATB : 2.6) * Math.min(1, b.w / w));
    if (w >= 8 * C.s) { // resolved: a chain of beads
      c.setLineDash([0, w * 0.95]);
      c.globalAlpha = a; c.strokeStyle = mix(b.col, PAL.bodyDeeper, 0.35); c.lineWidth = w; c.stroke(b.p);
      c.save(); c.translate(LL[0] * w * 0.08, LL[1] * w * 0.08); c.strokeStyle = b.col; c.lineWidth = w * 0.74; c.stroke(b.p);
      c.translate(LL[0] * w * 0.1, LL[1] * w * 0.1); c.strokeStyle = mix(b.col, '#ffffff', 0.3); c.lineWidth = w * 0.36; c.stroke(b.p); c.restore();
      c.setLineDash([]);
    } else { // small: a soft ribbon (stacked widths, lighter core), like a far vessel
      const k = Math.min(1, Math.max(0, (w - 4 * C.s) / (4 * C.s))); // below ~5 px: only a soft wide band (no line-like core)
      c.globalAlpha = a * 0.22; c.strokeStyle = b.col; c.lineWidth = w * 2.8; c.stroke(b.p);
      if (k > 0) { c.globalAlpha = a * 0.5 * k; c.lineWidth = w; c.stroke(b.p); c.globalAlpha = a * 0.4 * k; c.strokeStyle = mix(b.col, '#ffffff', 0.3); c.lineWidth = w * 0.4; c.stroke(b.p); }
    }
  }
  c.setLineDash([]);
  // (unification pass) the near filaments are GEL: chains of translucent stacked-fill clouds laid down normally (additive piles
  // made a bright magenta mass that collapsed into faint ribbons once the filaments thinned)
  // budget: at most ~2500 cloud sprites per frame (spacing widens uniformly when there are more; alpha compensates)
  let tot = 0; for (const ch of chains) tot += Math.min(24, Math.max(1, Math.hypot(ch[4] - ch[0], ch[5] - ch[1]) / (0.6 * Math.min(ch[6], ch[7]))));
  const sp = Math.max(1, tot / 1200);
  for (const [x1, y1, qx, qy, x2, y2, w1, w2, a0, col] of chains) {
    const L = Math.hypot(x2 - x1, y2 - y1), n = Math.min(24, Math.max(1, Math.ceil(L / (0.6 * sp * Math.min(w1, w2))))), a = Math.min(0.2, a0 * Math.sqrt(sp) * 7) * EXPO; // space v3: capped bead size and alpha: the near web stays crisp, no glow clumps
    c.globalAlpha = a;
    for (let j = 0; j <= n; j++) { const t = j / n, u = 1 - t, x = u * u * x1 + 2 * u * t * qx + t * t * x2, y = u * u * y1 + 2 * u * t * qy + t * t * y2, r = Math.min((w1 + (w2 - w1) * t) * 0.62, 16 * C.s); if (x + r < 0 || x - r > C.w || y + r < 0 || y - r > C.h) continue; const h = r * SPRITE_K; c.drawImage(blobSprite(col, j, 0), x - h, y - h, 2 * h, 2 * h); }
  }
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
}
// nodes: the richest 2MRS cells (galaxy clusters) as warm glows of real size
const XYZ = [0, 0, 0];
function drawNodes(c, C) {
  const N = D.nodes; c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N.n; i++) {
    if (Math.hypot(N.P[i * 3] - SUN[0], N.P[i * 3 + 1] - SUN[1], N.P[i * 3 + 2] - SUN[2]) < 8 * MPC) continue; // not the Local Group's own cell
    cs3(C, N.P, i * 3, XYZ); const a = 0.045 * EXPO * Math.min(1, (N.W[i] - 2) / 2); // space v3: halved (they flashed as big glows)
    sphere(c, XYZ[0], XYZ[1], XYZ[2], N.R[i] * 0.22, '#d8407a', a, C); sphere(c, XYZ[0], XYZ[1], XYZ[2], N.R[i] * 0.08, '#ffb0d0', a * 2.5, C);
  }
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
}

const mod = {
  id: 'galaxy', zr: [5.2, 27.3], keys: [],
  async load(ctx) { await loadCosmos(ctx); build(); prebuildDust(); },
  draw(V, items, labels) {
    if (!D.ready) return;
    dustItems(V, items); // the floating dust / ice motes at every scale (levels/space-dust.js)
    const C = camOf(V), mlim = mLim(V.z), z = V.z;
    // ---- the CMB: a thin glowing shell centred on us, seen from inside as a faint uniform navy-blue glow (the camera
    // enters its emitting layer as it approaches), from outside as a filled disc brightening toward its limb ----
    const dc = cmbDc(dist(C, SUN), z);
    // space v3: the edge is ONE continuous limb-brightened shell (the same law as the heliosphere): the brightness along every
    // ray is the real path length through the last-scattering layer (0.86 R … R), drawn as one soft limb glow. Inside it, that is a
    // faint uniform violet that slowly deepens as we near the wall; leaving it, the bright limb comes in from the frame edges
    // as a soft band and tightens into the sphere — no ring that pops in, no switch between "inside" and "outside" looks.
    items.push({ name: 'cmb', d: 1e45, g: 0, draw(c) {
      screenSpace(c);
      const p = proj(C, SUN), Ri = 0.86 * R_CMB, Lpk = 2 * Math.sqrt(R_CMB * R_CMB - Ri * Ri), A = 0.5, N = 96;
      const ox = p ? p[0] : C.cx, oy = p ? p[1] : C.cy, corner = Math.hypot(Math.max(ox, C.w - ox), Math.max(oy, C.h - oy));
      // ray angle for a screen radius: the centre direction is (ox, oy); for a camera inside the shell this is still exact enough
      const g = c.createRadialGradient(ox, oy, 0, ox, oy, corner);
      for (let i = 0; i <= N; i++) { const rho = corner * i / N, ct = Math.cos(Math.atan(rho / C.f));
        const L = cmbChord(dc, ct, R_CMB) - cmbChord(dc, ct, Ri), aq = A * Math.pow(Math.min(1, L / Lpk), 1.6); // smooth (flat bands would flip the whole frame's tint at once from inside)
        g.addColorStop(i / N, rgba(i / N < 0.999 ? mix(EDGE_FAM.base, EDGE_FAM.lit, aq / A * 0.6) : EDGE_FAM.base, aq)); }
      c.fillStyle = g; c.fillRect(0, 0, C.w, C.h);
    } });
    // ---- the cosmic web: filaments, warm nodes, then points (2MRS real galaxies, far statistical structures) ----
    // the web's glow obeys the same camera exposure as every point: faint at Milky Way zooms, full from z ≈ 24
    const ex = ss(22.3, 24.5, z); // a slow two-decade exposure ramp (the star-law exposure jumps 2.6 mag in 0.7 decade here)
    if (ex > 0.01) items.push({ name: 'web-fil', d: 1e44, g: 0, draw(c) { screenSpace(c); EXPO = ex; STATB = 1 + 1.6 * ss(24.6, 26.0, z); drawFilaments(c, C); drawNodes(c, C); } });
    const pts = WEBPTS.reset();
    if (z > 20.0) {
      const W = D.web, dSun = dist(C, SUN), dmin = Math.max(dSun - 215 * MPC, 1.5 * MPC);
      const dmMin = appMag(0, dmin * dmin);
      for (let i = 0; i < W.n; i++) {
        const M = W.M[i]; if (M + dmMin > mlim - VIS) break;
        if (W.K[i] === 0) continue; // radial thinning (see cosmos-data.js)
        const o0 = W.P[i * 3] - C.p[0], o1 = W.P[i * 3 + 1] - C.p[1], o2 = W.P[i * 3 + 2] - C.p[2];
        const Z = -(o0 * C.b[0] + o1 * C.b[1] + o2 * C.b[2]); if (Z <= 0) continue;
        const k = C.f / Z, sx = C.cx + (o0 * C.r[0] + o1 * C.r[1] + o2 * C.r[2]) * k, sy = C.cy - (o0 * C.u[0] + o1 * C.u[1] + o2 * C.u[2]) * k;
        if (sx < -40 || sx > C.w + 40 || sy < -40 || sy > C.h + 40) continue;
        const d2 = o0 * o0 + o1 * o1 + o2 * o2, dl = mlim - appMag(M, d2); if (dl < VIS) continue;
        const pr = C.f * webR(M) * KPC * 1.1 / Z;
        if (pr >= 2.5) { pushGalaxy(items, webGalaxy(i), C, mlim, pr, 1); continue; } // space v3: below ~2.5 px a web galaxy stays a crisp point (soft mini-galaxies read as grain)
        pts.add(sx, sy, dl - 1.8, webTint(i, W.T[i]), 3, i); // −1.8 mag: fewer, more designed web dots (space v3: less grain at z 24.5–25)
      }
      const F = D.far;
      for (let i = 0; i < F.n; i++) {
        const o0 = F.P[i * 3] - C.p[0], o1 = F.P[i * 3 + 1] - C.p[1], o2 = F.P[i * 3 + 2] - C.p[2];
        const Z = -(o0 * C.b[0] + o1 * C.b[1] + o2 * C.b[2]); if (Z <= 0) continue;
        const d2 = o0 * o0 + o1 * o1 + o2 * o2, dl = mlim - appMag(F.M[i], d2); if (dl < 0.6) continue; // only the clearly visible far structures
        const k = C.f / Z, sx = C.cx + (o0 * C.r[0] + o1 * C.r[1] + o2 * C.r[2]) * k, sy = C.cy - (o0 * C.u[0] + o1 * C.u[1] + o2 * C.u[2]) * k;
        if (sx < -40 || sx > C.w + 40 || sy < -40 || sy > C.h + 40) continue;
        pts.add(sx, sy, Math.min(dl, 3.2) - 1.2, i % 7 === 0 ? T_ORANGE : [T_VIOLET, T_CYAN, T_PINK, T_CYANW, T_VIOLET][i % 5], 3, 50000 + i);
      }
    }
    // ---- Milky Way + Local Group (one renderer, one list), with the minimum-size law (tapers off on web scales) ----
    const kmin = 1 - ss(23.5, 24.5, z); SHOWN.clear();
    for (const g of [G.mw, ...G.lg]) {
      const pr = galaxyPx(g, C); if (pr < 0) continue;
      const E = pr > 1e5 ? 1 : enlarge(g, C, pr, kmin);
      if (pr * E >= 0.8) { pushGalaxy(items, g, C, mlim, pr, E); SHOWN.set(g, pr * E); continue; }
      const p = proj(C, g.O); if (!p) continue; if (p[0] < -40 || p[0] > C.w + 40 || p[1] < -40 || p[1] > C.h + 40) continue;
      nucleusPoint(g, C, mlim, pts, p[3], p[4], p[2], p[2] * p[2] + p[3] * p[3] + p[4] * p[4]);
    }
    if (pts.n) items.push({ name: 'web-points', d: 1e42, g: 0, draw(c) { screenSpace(c); pts.draw(c, C.s, C.t); } });
    label(V, C, labels);
  },
};
const SHOWN = new Map();
export const mwDepth = (C) => (G.mw ? dist(C, G.mw.O) : 2.5e20);
function pushGalaxy(items, g, C, mlim, pr, E) {
  const d = Math.max(dist(C, g.O), C.near * 4);
  items.push({ name: g.kind === 'mw' ? 'milkyway' : 'gal', d, g: 0, draw(c) { screenSpace(c); drawGalaxy(c, g, C, mlim, pr, E); } });
}

// label opacity: a short ease at the edges of each label's z window (the label is UI, not scene geometry)
export const labA = (z, z0, z1, e = 0.07) => Math.max(0, Math.min(1, (z - z0) / e, (z1 - z) / e));
// [z0, z1, target, text, sub, galaxy (to sit beside its edge)]
const LABS = [
  [19.3, 20.35, () => SPUR, 'Orion Spur', 'the arm we live in · 26,000 light-years from the centre', null],
  [20.4, 22.35, () => [0, 0, 0], 'Milky Way', '100,000 light-years across', () => G.mw],
  [22.35, 22.95, () => M31, 'Andromeda', '2.5 million light-years away', () => G.lg[0]],
  [22.95, 23.5, () => [0, 0, 0], 'Local Group', 'our neighbourhood · ~10 million light-years', () => G.mw],
  [23.6, 24.3, () => VIRGO, 'Virgo Cluster', '54 million light-years away', null],
  [24.35, 25.5, () => GA, 'Laniakea', 'our supercluster · 520 million light-years', null],
];
// a label beside its object: to the right of the object's edge if the text fits, else to its left (never across it)
const labW = (t, s) => Math.max(t.length * 7.3, (s || "").length * 5.8) + 48; // CSS px (labels do not scale)
function beside(labels, C, x, y, re, text, sub, a, strict = false) {
  const w = labW(text, sub), right = x + re + 10 * C.s, left = x - re - 10 * C.s - w;
  if (right + w < C.w - 8) labels.push({ x: right, y, text, sub, a });
  else if (left >= 42 || !strict) labels.push({ x: Math.max(42, left), y, text, sub, a }); // strict: no room outside the object → wait
}
function label(V, C, labels) {
  const z = V.z;
  if (z >= 26.3) {
    const p = proj(C, SUN), dc = cmbDc(dist(C, SUN), z); if (!p || dc <= R_CMB) return;
    const rp = C.f * R_CMB / Math.sqrt(dc * dc - R_CMB * R_CMB);
    // beside the shell's upper-right rim (outside it), where the frame has the most room
    const T1 = 'Observable universe · 93 billion light-years', S1 = 'edge: the cosmic microwave background';
    const fits = p[0] + rp * 0.92 + 10 * C.s + labW(T1, S1) < C.w - 8; // narrow frames get the compact form of the same label
    beside(labels, C, p[0], p[1] - rp * 0.62, rp * 0.92, fits ? T1 : 'Observable universe', fits ? S1 : '93 billion light-years across', labA(z, 26.3, 99), true); return;
  }
  const L = LABS.find((l) => z >= l[0] && z < l[1]); if (!L) return;
  const tgt = L[2](); const p = proj(C, tgt); if (!p) return;
  const g = L[5] && L[5](); let pe = g ? SHOWN.get(g) || 0 : 0; // beside the galaxy's (drawn) edge
  if (L[3] === 'Orion Nebula') pe = C.f * 42 * 3.0857e16 / p[2]; // beside the cloud's edge
  beside(labels, C, p[0], p[1] - 10 * C.s, Math.min(pe * 0.85, C.w * 0.3), L[3], L[4], labA(z, L[0], L[1]));
}
export default mod;
