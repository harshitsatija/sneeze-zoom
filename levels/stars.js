// COSMOS level (owner: COSMOS agent): the real star field. 42k HYG v4.1 stars (all within 1,000 pc brighter than
// V = 8, plus every star within 30 pc) at their true 3D positions in the 'galaxy' frame. At Earth / solar zooms they are
// effectively at infinity and ARE the space background; from z ≈ 16 the nearby ones parallax as the camera pulls out.
// Look: shared/star.js (white core, B−V tint, 4-point flare only for bright stars); size and brightness follow the real
// apparent magnitude from the camera position against the camera's exposure (mLim) — no fixed-size sprites.
// The Sun is not in this list (HYG id 0 dropped): levels/solar.js draws it with drawSunPoint, the same law.
import { screenSpace } from '../core/kit.js';
import { Points, mLim, appMag, VIS, tintOf, look } from '../shared/star.js';
import { camOf } from '../shared/galaxy.js';
import { D, loadCosmos } from './cosmos-data.js';
import { mwDepth, labA } from './galaxy.js';

const PC = 3.0857e16;
const NEAR = new Points(8192), FAR = new Points(8192);
let TINT = null, NAMED = null;
// one label at a time while the nearest stars are the subject (names + distances: research/SCIENCE.md O-13)
const LAB = [['Sirius', 16.3, 16.8], ['Alpha Centauri A/B', 16.85, 17.32], ['Procyon', 17.36, 17.76]];

export default {
  id: 'stars', zr: [5.2, 22.5],
  async load(ctx) { await loadCosmos(ctx); TINT = new Uint8Array(D.stars.n); for (let i = 0; i < D.stars.n; i++) TINT[i] = tintOf(D.stars.CI[i]); NAMED = new Set(D.stars.named.map((n) => n.i)); },
  draw(V, items, labels) {
    if (!D.ready) return;
    const C = camOf(V), S = D.stars, sun = D.sun, mlim = mLim(V.z);
    // named neighbours (space v3): a minimum brightness while they are the subject round the centred Sun (z 17–20, eased in
    // and out over ~0.6 decade) — a documented hero boost like the presence law, so the frame is never blank there
    const zz = V.z, e3 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }, NW = e3(16.6, 17.3, zz) * (1 - e3(19.7, 20.4, zz)), NB = 1.5;
    const cx = C.p[0] - sun[0], cy = C.p[1] - sun[1], cz = C.p[2] - sun[2];
    const R0 = C.r[0], R1 = C.r[1], R2 = C.r[2], U0 = C.u[0], U1 = C.u[1], U2 = C.u[2], B0 = C.b[0], B1 = C.b[1], B2 = C.b[2];
    const f = C.f, w = C.w, h = C.h, ox = C.cx, oy = C.cy;
    // stars are sorted by absolute magnitude: stop once even the closest possible one is below the limit
    const dS = Math.hypot(cx, cy, cz), dmin = Math.max(dS - 1000 * PC, 2e15), dmMin = appMag(0, dmin * dmin);
    const near = NEAR.reset(), far = FAR.reset(), P = S.P, M = S.M;
    const lab = LAB.find((l) => V.z >= l[1] && V.z < l[2]); let labIdx = -1, labPos = null;
    if (lab) { const nm = S.named.find((n) => n.text === lab[0]); if (nm) labIdx = nm.i; }
    const NI = NW > 0 ? S.named.map((n) => n.i) : []; let iB = S.n;
    const one = (i, m0) => {
      const vx = P[i * 3] - cx, vy = P[i * 3 + 1] - cy, vz = P[i * 3 + 2] - cz;
      const Z = -(vx * B0 + vy * B1 + vz * B2); if (Z <= 0) return;
      const k = f / Z, sx = ox + (vx * R0 + vy * R1 + vz * R2) * k, sy = oy - (vx * U0 + vy * U1 + vz * U2) * k;
      if (sx < -80 || sx > w + 80 || sy < -80 || sy > h + 80) return;
      const nm = NAMED.has(i), dl0 = mlim - appMag(m0, vx * vx + vy * vy + vz * vz), dl = nm ? Math.max(dl0 + NB, 3.2 * NW) : dl0; if (dl < VIS) return;
      // which side of the galactic plane (the Milky Way's sheets are drawn between the two batches)
      ((P[i * 3 + 2] > 0) === (cz > 0) ? near : far).add(sx, sy, dl, TINT[i], nm ? 4 : 0, i); // named nearby stars: hero boost (documented)
      if (i === labIdx && dl > 2) labPos = [sx, sy, dl];
    };
    for (let i = 0; i < S.n; i++) {
      const m0 = M[i]; if (m0 + dmMin > mlim - VIS) { iB = i; break; }
      one(i, m0);
    }
    for (const i of NI) if (i >= iB) one(i, M[i]); // faint named neighbours (Proxima, Wolf 359 …) past the sorted cut-off
    // the Sun is drawn by levels/solar.js (z 7.3–19.5) with shared/star.js drawSunPoint — the same law as these stars
    const md = mwDepth(C);
    if (far.n) items.push({ name: 'stars-far', d: md * 1.000001 + 1e3, g: 0, draw(c) { screenSpace(c); far.draw(c, C.s, V.t); } });
    if (near.n) items.push({ name: 'stars-near', d: md * 0.999999 - 1e3, g: 0, draw(c) { screenSpace(c); near.draw(c, C.s, V.t); } });
    // the label sits beside its star (right of the star's glow), only while the star is clearly visible
    if (labPos) { const L = look(labPos[2], C.s); labels.push({ x: labPos[0] + Math.max(L.gr * 0.6, 10 * C.s), y: labPos[1] - 14 * C.s, text: lab[0], sub: S.named.find((n) => n.i === labIdx).sub, a: labA(V.z, lab[1], lab[2]) }); }
  },
};
