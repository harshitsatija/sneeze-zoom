// S3 · the carbon-12 nucleus inside the hero carbon atom (frame 'atom', origin = the nucleus centre). Owner: SUBATOMIC agent.
// 6 protons + 6 neutrons as three alpha clusters (shared/nucleon.js). From z −9.8 inward the nucleus is a bright point with a
// physical size law (it dims while it is smaller than a pixel instead of staying a big sprite); the 12 nucleons resolve out of
// that point by size alone (same object at every size). The hero proton (nearest the camera) is drawn by levels/quarks.js.
// This module also (re)defines the frames 'proton' (the hero proton) and 'quark' (its up quark) every frame, so they jostle.
import { PAL, mix, rgba, screenSpace, pointLaw, glow } from '../core/kit.js';
import { def } from '../core/world.js';
import { FAM, halo } from '../core/look.js';
import { I3, clamp } from '../core/m.js';
import { FM, R_NUC, NUCLEONS, HERO, NCOL, QCOL, QBALL, DRESS_R, LUMP, nucleonPos, quarkPos, junction, makeLumps, nucleonBack, nucleonFront, nucleonBall, drawFluxY, flatBall, quarkPoint } from '../shared/nucleon.js';

const EXT = 2.9;                       // fm: outer extent of the cluster (centres up to ~2.2 fm + nucleon radius)
export const POINT_PX = 1.6;           // below this cluster radius the nucleus is drawn as one point (same colour, same size)
const AVG = mix(mix(NCOL.p.lit, NCOL.n.lit, 0.5), "#ffffff", 0.3), GLOW = FAM.coral.glow; // the point is luminous: a warm coral glow

export default {
  id: 'nucleus12', zr: [-34.6, -8.6],
  frames(t) {
    const h = NUCLEONS[HERO], p = nucleonPos(h, t), q = quarkPos(h, 0, t, true);
    def('proton', 'atom', [p[0] * FM, p[1] * FM, p[2] * FM], I3());
    def('quark', 'proton', [q[0] * FM, q[1] * FM, q[2] * FM], I3());
  },
  draw(V, items, labels) {
    const t = V.t, c0 = V.P('atom', [0, 0, 0]); if (c0[2] <= V.near) return;
    const Rc = V.px(EXT * FM, c0[2]);
    // the marker: a luminous point with the physical size law (kit.pointLaw): below a pixel it dims instead of staying big.
    // Its halo is physical too (≈ 3× the cluster), so it grows with the zoom and ends as the soft light behind the nucleons.
    // calm pass (presence law): from the atom's interior on, the nucleus is THE centred subject. Its halo grows steadily
    // (×2.5 per decade, ~24 px at z −10.5 → ~240 px at −13) until the cluster itself (2× its radius) outgrows it; a bright
    // core of at least 4 px sits behind the cluster and shrinks under the resolving nucleons by −12.8 (hidden by them).
    // Brightness follows the presence size alone (dim while tiny, like pointLaw), never the zoom.
    const s = V.s, rh = Math.max(2 * Rc, 24 * s * Math.pow(10, 0.4 * (-10.5 - V.z))), pa = clamp((rh / s - 4) / 9, 0, 1), dg = c0[2] + 2.6 * FM; // in front of the atom cloud's far half (+2.9 fm), behind every nucleon
    const ease = clamp((-11.8 - V.z) / 1.0, 0, 1), rp = 4 * s * (1 - ease * ease * (3 - 2 * ease));
    items.push({ name: 'c12-glow', d: dg, blur: 0, draw(c) { screenSpace(c); halo(c, c0[0], c0[1], rh, FAM.coral, 0.36 * pa);
      if (rp > 0.3) { glow(c, c0[0], c0[1], rp * 2.2, FAM.coral.glow, 0.5 * pa); c.fillStyle = rgba(AVG, pa); c.beginPath(); c.arc(c0[0], c0[1], rp, 0, 6.2832); c.fill(); } } });
    if (Rc < POINT_PX) { // a point: one dot of the cluster's mean colour, physical size law
      const [r, a] = pointLaw(Rc, 1.1);
      items.push({ name: 'c12-point', d: c0[2], blur: 0, draw(c) { screenSpace(c); c.fillStyle = rgba(AVG, Math.min(1, a * 1.15)); c.beginPath(); c.arc(c0[0], c0[1], r, 0, 6.2832); c.fill(); } });
      return;
    }
    NUCLEONS.forEach((n, i) => {
      if (i === HERO) return;
      const cen = nucleonPos(n, t), p = V.P('atom', [cen[0] * FM, cen[1] * FM, cen[2] * FM]); if (p[2] <= V.near) return;
      const R = V.px(R_NUC * FM, p[2]); if (!V.onScreen(p[0], p[1], R * 1.2)) return;
      const qs = n.quarks.map((q, j) => { const qp = quarkPos(n, j, t, false); return [qp[0] / R_NUC * 0.82, -qp[1] / R_NUC * 0.82, q.col]; });
      items.push({ name: 'nucleon', d: p[2], blur: V.coc(p[2]), draw(c) {
        screenSpace(c); nucleonBall(c, V, p[0], p[1], R, n.kind, null, undefined, qs); // a cell: its three quarks sit inside like nuclei
      } });
    });
    // label: beside the cluster (right of its screen edge) while it is the main subject and clearly visible
    if (V.z > -14.4 && V.z < -13.1 && c0[0] + Rc * 0.95 + 16 * V.s + 270 * V.w / Math.max(1, innerWidth) < V.w - 14) { // beside it, or not at all
      const a = Math.min(1, (V.z + 14.4) / 0.15, (-13.1 - V.z) / 0.15);
      labels.push({ x: c0[0] + Rc * 0.95 + 16 * V.s, y: c0[1] - 26 * V.s, text: 'Carbon-12 nucleus', sub: '6 protons + 6 neutrons · ~5 fm', a });
    }
  },
};
