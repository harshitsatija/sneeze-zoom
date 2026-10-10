// COSMOS data: loads the star / galaxy assets once and converts them into the 'galaxy' frame (origin Sgr A*, galactic
// axes) with core/world.js, so every position uses the same frame math as the rest of the film.
// Shared by levels/stars.js and levels/galaxy.js (one list of galaxies: Milky Way + Local Group + 2MRS + far web).
import { xform, rot, OBL, PC } from '../core/world.js';
import { mm, mv, rotX, norm, cross, DEG } from '../core/m.js';

export const KPC = PC * 1e3, MPC = PC * 1e6;
export const D = { ready: false };
let loading = null;

const eqUnit = (raDeg, decDeg) => { const a = raDeg * DEG, d = decDeg * DEG; return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]; };

export function loadCosmos(ctx) {
  if (loading) return loading;
  loading = (async () => {
    const [hygB, hygJ, lg, w2B, puB, farB, filB, nodB] = await Promise.all([
      ctx.buf('assets/stars/hyg.bin'), ctx.json('assets/stars/hyg.json'), ctx.json('assets/galaxies/localgroup.json'),
      ctx.buf('assets/galaxies/web2mrs.bin'), ctx.buf('assets/galaxies/puffs2mrs.bin'), ctx.buf('assets/galaxies/webfar.bin'),
      ctx.buf('assets/galaxies/filaments.bin'), ctx.buf('assets/galaxies/nodes.bin')]);
    const E2G = mm(rot('helio', 'galaxy'), rotX(-OBL)); // J2000 equatorial -> galactic axes
    D.E2G = E2G; D.eq2gal = (v) => mv(E2G, v);
    D.sun = xform([0, 0, 0], 'helio', 'galaxy');      // the Sun in the galaxy frame (≈ -8.18 kpc, 0, 0)
    // ---- HYG stars: Sun-centred, galactic axes, metres (Float64), absmag, tint ----
    const h = new Float32Array(hygB), n = h.length / 5;
    const P = new Float64Array(n * 3), M = new Float32Array(n), CI = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = h[i * 5] * PC, y = h[i * 5 + 1] * PC, z = h[i * 5 + 2] * PC;
      P[i * 3] = E2G[0] * x + E2G[1] * y + E2G[2] * z; P[i * 3 + 1] = E2G[3] * x + E2G[4] * y + E2G[5] * z; P[i * 3 + 2] = E2G[6] * x + E2G[7] * y + E2G[8] * z;
      M[i] = h[i * 5 + 3]; CI[i] = h[i * 5 + 4];
    }
    D.stars = { n, P, M, CI, named: hygJ.named };
    // ---- Local Group members: position (galaxy frame, metres) + disc axes from inclination / position angle ----
    D.lg = lg.map((g, k) => {
      const los = eqUnit(g.ra, g.dec), a = g.ra * DEG, d = g.dec * DEG;
      const eN = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)], eE = [-Math.sin(a), Math.cos(a), 0];
      const pa = (g.pa ?? hashAngle(k)) * DEG, inc = (g.inc ?? (20 + 50 * frac(k * 0.618 + 0.3))) * DEG;
      const maj = [0, 1, 2].map((j) => Math.cos(pa) * eN[j] + Math.sin(pa) * eE[j]);
      const mnr = [0, 1, 2].map((j) => -Math.sin(pa) * eN[j] + Math.cos(pa) * eE[j]);
      const nrm = [0, 1, 2].map((j) => -Math.cos(inc) * los[j] + Math.sin(inc) * mnr[j]);
      const ex = norm(mv(E2G, maj)), ez = norm(mv(E2G, nrm)), ey = norm(cross(ez, ex));
      const pos = mv(E2G, los).map((v, j) => D.sun[j] + v * g.d * KPC);
      return { ...g, O: pos, ex, ey, ez: cross(ex, ey) };
    });
    // ---- 2MRS galaxies (Mpc, equatorial) -> galaxy frame metres relative to the Sun ----
    const w = new Float32Array(w2B), nw = w.length / 7;
    const WP = new Float64Array(nw * 3), WM = new Float32Array(nw), WT = new Int8Array(nw), WB = new Float32Array(nw);
    for (let i = 0; i < nw; i++) { const v = mv(E2G, [w[i * 7], w[i * 7 + 1], w[i * 7 + 2]]); WP[i * 3] = D.sun[0] + v[0] * MPC; WP[i * 3 + 1] = D.sun[1] + v[1] * MPC; WP[i * 3 + 2] = D.sun[2] + v[2] * MPC; WM[i] = w[i * 7 + 3]; WT[i] = w[i * 7 + 4]; WB[i] = w[i * 7 + 5]; }
    // radial thinning of the flux-limited survey so its depth limit does not read as a sphere: keep a fixed random
    // subset with probability min(1, (60 Mpc / r)^2.3); beyond ~160 Mpc the procedural web (same r^-3 law) takes over
    const WK = new Uint8Array(nw);
    for (let i = 0; i < nw; i++) { const r = Math.hypot(w[i * 7], w[i * 7 + 1], w[i * 7 + 2]), h = Math.sin(i * 12.9898) * 43758.5453; WK[i] = (h - Math.floor(h)) < Math.min(1, Math.pow(60 / r, 2.3)) ? 1 : 0; }
    D.web = { n: nw, P: WP, M: WM, T: WT, BA: WB, K: WK };
    // filament glow puffs (smoothed 2MRS density)
    const pu = new Float32Array(puB), np = pu.length / 5, PP = new Float64Array(np * 3), PR = new Float32Array(np), PW = new Float32Array(np);
    for (let i = 0; i < np; i++) { const v = mv(E2G, [pu[i * 5], pu[i * 5 + 1], pu[i * 5 + 2]]); for (let j = 0; j < 3; j++) PP[i * 3 + j] = v[j] * MPC; PR[i] = pu[i * 5 + 3] * MPC; PW[i] = pu[i * 5 + 4]; }
    D.puffs = { n: np, P: PP, R: PR, W: PW };
    // procedural far web (beyond the 2MRS depth, out to the 46.5 Gly edge)
    const fa = new Float32Array(farB), nf = fa.length / 7, FP = new Float64Array(nf * 3), FM = new Float32Array(nf), FR = new Float32Array(nf), FS = new Uint8Array(nf), FW = new Float32Array(nf);
    for (let i = 0; i < nf; i++) {
      const v = mv(E2G, [fa[i * 7], fa[i * 7 + 1], fa[i * 7 + 2]]); for (let j = 0; j < 3; j++) FP[i * 3 + j] = v[j] * MPC;
      const R = fa[i * 7 + 3]; FM[i] = farMag(R, fa[i * 7 + 4]); FR[i] = fa[i * 7 + 5] * MPC * (fa[i * 7 + 6] >= 3 ? 2.0 : 1); FS[i] = fa[i * 7 + 6];
      // glow weight: every shell holds the same number of structures, so inner shells would look denser in projection;
      // weight by radius so each shell's projected glow per solid angle is comparable (statistical background)
      FW[i] = 0.026 * Math.pow(R / 14260, 1.1);
    }
    D.far = { n: nf, P: FP, M: FM, R: FR, S: FS, W: FW };
    // filaments (MST of density peaks: real for 2MRS, statistical beyond) and nodes (richest 2MRS cells = clusters)
    const fl = new Float32Array(filB), nfl = fl.length / 8, FL = new Float64Array(nfl * 6), FLW = new Float32Array(nfl), FLS = new Uint8Array(nfl);
    for (let i = 0; i < nfl; i++) { for (let e = 0; e < 2; e++) { const v = mv(E2G, [fl[i * 8 + e * 3], fl[i * 8 + e * 3 + 1], fl[i * 8 + e * 3 + 2]]); for (let j = 0; j < 3; j++) FL[i * 6 + e * 3 + j] = D.sun[j] + v[j] * MPC; } FLW[i] = fl[i * 8 + 6]; FLS[i] = fl[i * 8 + 7]; }
    D.fil = { n: nfl, P: FL, W: FLW, S: FLS };
    const nd = new Float32Array(nodB), nn = nd.length / 5, NP = new Float64Array(nn * 3), NR = new Float32Array(nn), NW = new Float32Array(nn);
    for (let i = 0; i < nn; i++) { const v = mv(E2G, [nd[i * 5], nd[i * 5 + 1], nd[i * 5 + 2]]); for (let j = 0; j < 3; j++) NP[i * 3 + j] = D.sun[j] + v[j] * MPC; NR[i] = nd[i * 5 + 3] * MPC; NW[i] = nd[i * 5 + 4]; }
    D.nodes = { n: nn, P: NP, R: NR, W: NW };
    D.ready = true;
  })();
  return loading;
}
// luminosity of a far-web point (a cluster / supercluster region): brighter with distance (a flux-limited selection keeps
// only the most luminous structures far away), with a log-normal scatter
export function farMag(Rmpc, g) { return -20.75 - 4.5 * Math.log10(Rmpc / 150) + 0.7 * g; }
const frac = (x) => x - Math.floor(x);
const hashAngle = (k) => frac(Math.sin(k * 91.7 + 3.1) * 43758.5453) * 180;
