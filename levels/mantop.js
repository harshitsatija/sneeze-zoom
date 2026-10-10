// The man seen from above: horizontal cutouts at their real heights (shoes 0.02 m, shoulders 1.47 m, nose 1.58 m,
// hair 1.74 m) that, with the vertical side cutout in levels/man.js, make him a cross-billboard. A horizontal plane is
// drawn only while the camera is above it, so it is edge-on (zero thickness) exactly when it starts to show; the side
// cutout goes edge-on from straight above. Plus his real sun shadow on the plaza. The orange jacket follows a point
// size law below ~1.3 px, so he stays findable as he shrinks (dims, never pops).
import { PAL, mix, T, pointLaw, screenSpace } from '../core/kit.js';
import { sunDir } from '../core/world.js';

const E = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 6.2832); c.fill(); };
// drawing units: metres; x = forward (uptown, +x), y = his left (-z)
function shoes(c) { c.fillStyle = mix(PAL.shoe, PAL.tcell, 0.2); E(c, -0.035, 0.075, 0.135, 0.05); c.fillStyle = PAL.tcell; E(c, 0.085, -0.075, 0.135, 0.05); }
// the shoulders slab never reaches past the side silhouette at its height (x -0.15 … 0.11), so while it is nearly
// edge-on it hides inside the side cutout instead of showing as a thin line
function shoulders(c) {
  c.fillStyle = PAL.coatShade; c.beginPath(); c.roundRect(-0.15, -0.24, 0.26, 0.48, 0.12); c.fill();           // arms + body
  c.fillStyle = PAL.coat; c.beginPath(); c.roundRect(-0.14, -0.2, 0.235, 0.4, 0.11); c.fill();
  c.fillStyle = PAL.coatLit; c.beginPath(); c.roundRect(-0.12, -0.17, 0.11, 0.34, 0.055); c.fill();           // lit back of the shoulders (sun behind-left)
  c.fillStyle = PAL.coatShade; E(c, -0.02, 0, 0.07, 0.085); c.fillStyle = PAL.skinShade; E(c, -0.02, 0, 0.05, 0.06); // collar opening, neck
}
function nose(c) { c.fillStyle = mix(PAL.skin, PAL.noseRed, 0.6); E(c, 0.125, 0, 0.03, 0.024); }
function hair(c) { c.fillStyle = mix(PAL.skin, PAL.noseRed, 0.6); E(c, 0.12, 0, 0.026, 0.02); c.fillStyle = PAL.skinShade; E(c, -0.01, 0.0, 0.105, 0.085); c.fillStyle = mix(PAL.hair, '#0f0020', 0.35); E(c, -0.016, 0, 0.11, 0.084); c.fillStyle = PAL.hair; E(c, -0.006, 0.004, 0.096, 0.07); c.fillStyle = mix(PAL.hairLit, '#7a3aa0', 0.35); E(c, -0.05, 0.02, 0.05, 0.03); }
const PARTS = [[0.02, shoes, 0.16], [1.45, shoulders, 0.26], [1.74, hair, 0.12]];

let SUN = null;
export default {
  id: 'mantop', zr: [-1.9, 3.8],
  draw(V, items) {
    const e = V.c('street'), cy = e.p[1];
    if (!SUN) SUN = sunDir('street');
    // sun shadow on the plaza (ground detail): a soft capsule from his feet toward the shadow direction
    const sh = [-SUN[0] / SUN[1], -SUN[2] / SUN[1]], L = 1.72, S = V.layer('street', [0, 0.005, 0], [sh[0], 0, sh[1]], [-sh[1], 0, sh[0]]);
    const F = null, G = V.layer('street', [0, 0.004, 0], [1, 0, 0], [0, 0, 1]);
    if (S && cy > 0.05 && S.depth > 3.5) { const k = Math.hypot(S.a, S.b); if (k * L > 0.8) items.push({ name: 'manShadow', d: S.depth, g: -1, blur: V.coc(S.depth), draw(c) {
      T(c, S); c.fillStyle = 'rgba(29,3,59,0.26)'; const P = new Path2D(); P.roundRect(-0.12, -0.2, L * 0.98 + 0.1, 0.4, 0.2);
      if (F) P.addPath(F, new DOMMatrix([1, 0, 0, 1, 0, 0])); c.fill(P);
      if (G) { c.setTransform(G.a, G.b, G.c, G.d, G.e, G.f); c.beginPath(); c.ellipse(0.015, 0, 0.27, 0.14, 0, 0, 6.2832); c.fill(); } } }); }  // contact shadow under both shoes
    const M0 = V.layer('street', [0, 0, 0], [1, 0, 0], [0, 1, 0]), mDepth = M0 ? M0.depth : 0;
    for (const [y, fn, rad] of PARTS) {
      if (cy <= y) continue;                                    // a top surface only exists for a camera above it
      const A = V.layer('street', [0, y, 0], [1, 0, 0], [0, 0, -1]); if (!A) continue;
      if (A.depth < 14 * rad) continue;                         // too close for a flat cutout (only near eye level, where it is edge-on anyway)
      // seen from low (< 25° above the plane) the top cutout goes BEHIND the side cutout, which covers it; from higher up it lies on top
      const el = (cy - y) / A.depth, d = el < 0.42 ? Math.max(A.depth, mDepth + 1e-3) : A.depth;
      const px = Math.hypot(A.a, A.b) * rad;                   // true radius in px
      if (fn === shoulders && px < 1.3) {                       // size law: the jacket dims instead of vanishing
        const [r, a] = pointLaw(px, 1.3); if (a < 0.02) continue;
        items.push({ name: 'manTop', d, blur: V.coc(A.depth), draw(c) { screenSpace(c); c.globalAlpha = a; c.fillStyle = PAL.coat; c.beginPath(); c.arc(A.e, A.f, r, 0, 6.2832); c.fill(); c.globalAlpha = 1; } });
        continue;
      }
      if (px < 0.25) continue;
      items.push({ name: 'manTop', d, blur: V.coc(A.depth), draw(c) { T(c, A); fn(c); } });
    }
  },
};
