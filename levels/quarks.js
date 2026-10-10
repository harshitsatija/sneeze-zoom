// S2 → S0 · the hero proton, its quarks and gluon field, the 14-decade "desert" and the Planck-scale foam. Owner: SUBATOMIC agent.
// Frames: 'proton' (hero proton centre) and 'quark' (its up quark) are (re)defined every frame by levels/nucleus12.js.
//  - The hero proton is the same flat-shaded ball as the other 11 nucleons (shared/nucleon.js), split into depth layers so the
//    camera can enter it: an opaque back (base + shadow crescent), the interior at real depths (warm glowing QCD-vacuum lumps,
//    the solid gluon Y, the down and second up quark as solid balls, the quark sea), and a front lit band + highlight near the
//    limb. Entering the ball is geometry only: the limb shading grows past the frame edges, the base colour fills the view.
//  - The up quark we dive into and everything below it is the "nest" in levels/sub-field.js.
import { PAL, rgba, screenSpace, blob, L } from '../core/kit.js';
import { clamp, I3, sub, dot, norm, add, mul } from '../core/m.js';
import { FM, R_NUC, NUCLEONS, HERO, QBALL, QCOL, DRESS_R, quarkPos, junction, makeLumps, nucleonBack, nucleonFront, nucleonBall, ballCovers, drawFluxY, flatBall, quarkPoint, LUMP, blurSplit, blurSnap } from '../shared/nucleon.js';
import { POINT_PX } from './nucleus12.js';
import { drawField, drawPopulation, fieldBegin, fieldFlush, drawNest, H } from './sub-field.js';

const hero = NUCLEONS[HERO];
const lumps = makeLumps(hero, true);
// the proton's sea: virtual quark–antiquark pairs and gluon loops inside the proton (0.04–0.12 fm), reborn every life
const sea = []; for (let i = 0; i < 18; i++) { /* calm pass: a sparse sea (was 40) */ const rho = 0.35 + 1.1 * Math.pow(H(i, 40), 1.3); sea.push({ i: 900000 + i, u: -15.9, rho, tau: 6.5 * rho * (0.8 + 0.4 * H(i, 41)), ph0: H(i, 42), sp: H(i, 43) < 0.45 ? 1 : 2 }); }
const U = hero.quarks[0].p;
function seaPlace(b, n) {
  const i = b.i * 977 + n * 131, r = Math.cbrt(H(i, 44)) * 0.74, th = Math.acos(2 * H(i, 45) - 1), ph = H(i, 46) * 6.2832;
  const p = [r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th)];
  const lat = Math.hypot(p[0] - U[0], p[1] - U[1]);
  // calm pass: in front of the quark a pair must sit far enough off the path to leave the frame small and nearly sharp
  if (p[2] > U[2] - 0.1 && lat < Math.max(0.2, 0.9 * (p[2] - U[2]) + 0.25, 9 * seaSize(b) / FM)) return null;
  if (p[2] < U[2] && lat < (U[2] - p[2]) * 0.45 + 0.15) return null;      // and the cone the deep zoom looks into
  return [p[0] * FM, p[1] * FM, p[2] * FM];
}
const seaSize = (b) => (0.03 + 0.045 * b.rho) * FM;
const fadeIn = (z, z0, z1, e = 0.12) => clamp(Math.min((z - z0) / e, (z1 - z) / e), 0, 1);

export default {
  id: 'quarks', zr: [-34.6, -9.0],
  // the up quark is centred from z −16.4 inward (the hand-off keys are −15.4 proton centre and −18.7 quark)
  keys: [{ z: -16.4, fr: 'quark', at: [0, 0, 0], M: I3() }],
  draw(V, items, labels) { this.FB = null; try { this.draw0(V, items, labels); } finally { if (this.FB) fieldFlush(items, this.FB, 'vacuum'); } },
  draw0(V, items, labels) {
    const t = V.t, z = V.z;
    const FB = this.FB = fieldBegin(V); drawField(V, FB, t);
    const nestLab = drawNest(V, items, t);
    let lab = null;

    // ---- the hero proton (skipped while the whole nucleus is still one point: levels/nucleus12.js draws that point)
    const pc = V.P('proton', [0, 0, 0]), dBack = pc[2] + 0.25 * R_NUC * FM;
    const a0 = V.P('atom', [0, 0, 0]);
    if (!(a0[2] > V.near && V.px(2.9 * FM, a0[2]) < POINT_PX) && pc[2] > V.near) {
      const R = V.px(R_NUC * FM, pc[2]);
      if (V.onScreen(pc[0], pc[1], R * 1.2)) {
        const covers = ballCovers(V, pc[0], pc[1], R);
        if (covers) V.coverDepth = Math.min(V.coverDepth ?? Infinity, dBack); // lets levels drawn after this skip work that is fully hidden
        items.push({ name: 'proton-back', d: dBack, blur: covers ? 0 : V.coc(pc[2]), cover: covers, draw(c) { screenSpace(c); nucleonBack(c, V, pc[0], pc[1], R, 'p'); } });
        const clipIn = (c) => { if (R < 1e5 && !covers) { c.beginPath(); c.arc(pc[0], pc[1], R * 0.97, 0, 6.2832); c.clip(); } };
        const P = (q) => V.P('proton', [q[0] * FM, q[1] * FM, q[2] * FM]);
        if (R > 6) {
          // QCD-vacuum lumps: warm glowing clouds at their real depths
          const lb = new Map();
          for (const l of lumps) {
            const p = P([l.p[0] + 0.03 * Math.sin(t * 0.4 + l.ph), l.p[1] + 0.03 * Math.cos(t * 0.33 + l.ph), l.p[2]]); if (p[2] <= V.near) continue;
            const r = V.px(l.r * FM, p[2]); if (r < 1 || !V.onScreen(p[0], p[1], r * 1.3)) continue;
            if (V.covers(p[0], p[1], r * 0.7) && p[2] < pc[2]) continue;
            for (const [cls, bl, wgt] of blurSplit(V, V.coc(p[2]))) {
              let B = lb.get(cls); if (!B) { B = { d: 0, blur: bl, n: 0, list: [] }; lb.set(cls, B); }
              B.d += Math.min(p[2], dBack * (1 - 1e-6)); B.n++; B.list.push([p, r, l, wgt]);
            }
          }
          for (const [, B] of lb) items.push({ name: 'qcd-lumps', d: B.d / B.n, blur: B.blur, draw(c) {
            screenSpace(c); clipIn(c); c.globalCompositeOperation = 'lighter';
            for (const [p, r, l, wgt] of B.list) { c.fillStyle = rgba(LUMP, 0.07 * wgt); c.save(); c.translate(p[0], p[1]); c.scale(r, r); c.fill(blob(l.seed, 0.2, 5, t * 0.35)); c.restore(); }
          } });
          drawPopulation(V, FB, t, 'proton', sea, seaPlace, seaSize, dBack * (1 - 1e-6));
        }
        // the other two valence quarks: solid coloured balls (their gluon clouds) with the unresolved point at the centre
        const Q = [0, 1, 2].map((j) => quarkPos(hero, j, t, true)), J = junction(Q);
        for (let j = 1; j < 3; j++) {
          const pq = P(Q[j]); if (pq[2] <= V.near) continue;
          const rq = V.px(DRESS_R * FM, pq[2]), k = hero.quarks[j].col;
          for (const [, bl, wgt] of blurSnap(V, V.coc(pq[2]))) items.push({ name: 'quark', d: Math.min(pq[2], dBack * (1 - 1e-6)), blur: bl, draw(c) {
            screenSpace(c); clipIn(c); c.globalAlpha = wgt; flatBall(c, pq[0], pq[1], rq, QBALL[k]); quarkPoint(c, pq[0], pq[1], V.px(4.3e-19 * 2.5, pq[2]) + rq * 0.08, QCOL[k]);
          } });
        }
        // the Y flux tube: a solid shaded tube, its own item at the junction's depth
        const pj = P(J);
        if (pj[2] > V.near && R > 1.2) { const dj = Math.min(pj[2], dBack * (1 - 2e-6)); for (const [, bl, wgt] of blurSnap(V, V.coc(pj[2]))) items.push({ name: 'flux-tube', d: dj, blur: bl, draw(c) { screenSpace(c); clipIn(c); drawFluxY(c, V, Q, J, P, wgt); } }); }
        // the opaque skin, with the hole the camera opens when it reaches it: skin points nearer than the clip distance
        // Dn = 0.6·D (a lens clip, like every near plane) are cut away, so the hole grows smoothly from a point to the full view
        const cam = V.c('proton').p, Rm = R_NUC * FM, uq = Q[0].map((v) => v * FM), dir = norm(sub(uq, cam));
        const bq = dot(cam, dir), cq = dot(cam, cam) - Rm * Rm, disc = bq * bq - cq;
        if (cq > 0 && disc > 0) {
          const eps = -bq - Math.sqrt(disc), Dn = 0.6 * V.D; let hole = null;
          if (eps < Dn) { const cs = 1 - (Dn - eps) / Rm, rho = Rm * Math.sqrt(Math.max(0, 1 - Math.max(-1, cs) ** 2)), S = V.P('proton', add(cam, mul(dir, eps))); hole = [S[0], S[1], (cs < 0 ? Rm : rho) * V.f / Dn]; }
          const df = pc[2] - 0.9 * Rm;
          if (df > V.near) items.push({ name: 'proton-skin', d: df, blur: V.coc(pc[2]), draw(c) { screenSpace(c); nucleonFront(c, V, pc[0], pc[1], R, 'p'); } }); // the ring (membrane edge-on); its face is clear
        }
        // labels beside their object
        if (z > -15.05 && z < -14.35 && pc[1] > 60 && pc[1] < V.h - 60) lab = { x: pc[0] + R + 16 * V.s, xl: pc[0] - R - 16 * V.s, y: pc[1] - 20 * V.s, text: 'Proton', sub: '3 quarks held by gluons · 0.84 fm', a: fadeIn(z, -15.05, -14.35) };
        else if (z > -16.35 && z < -15.45 && R > 0) { const m = [J[0] + (Q[1][0] - J[0]) * 0.55, J[1] + (Q[1][1] - J[1]) * 0.55, J[2] + (Q[1][2] - J[2]) * 0.55], p = P(m), w = V.px(0.06 * FM, p[2]);
          lab = { x: p[0] + w + 14 * V.s, y: p[1] - 18 * V.s, text: 'Gluon flux tube', sub: 'binds the quarks · ~1 GeV/fm', a: fadeIn(z, -16.35, -15.45) }; }
      }
    }
    if (!lab && nestLab) lab = nestLab;
    // a label sits BESIDE its object: right of it if the text fits, else left of it, else none (never flipped onto the object)
    if (lab) {
      const dpr = V.w / Math.max(1, innerWidth), wl = (Math.max(lab.text.length * 8.6, (lab.sub || '').length * 6.4) + 30) * dpr;
      if (lab.x + wl > V.w - 14 * dpr) lab = lab.xl !== undefined && lab.xl - wl > 14 * dpr ? { ...lab, x: lab.xl - wl } : null;
      if (lab && (lab.y < 40 || lab.y > V.h - 70)) lab = null;
    }
    if (lab) labels.push(lab);
  },
};
