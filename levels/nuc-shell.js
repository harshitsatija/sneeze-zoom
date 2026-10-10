// Sliced shells (owner: NUCLEUS agent): a closed translucent surface (nuclear membrane, electron-cloud shell) cut into flat
// horizontal annuli at their REAL heights. Seen from far away the stack is exactly the flat Kurzgesagt disc (same colours,
// same crescent, same alpha law as the GL atom shader); as the camera descends through it, the annuli above the camera pass
// behind it one by one, so a hole opens at the centre and grows outward. Nothing fades.
// Shell model: alpha(bin) = constant material, thicker where the surface is seen edge-on (bins of the polar angle θ).
import { T, UL, rgba, lightFor } from '../core/kit.js';

const HALF_PI = Math.PI / 2;
const annCache = new Map();
function annulus(key, fp, s0, s1) {
  const k = key + '|' + s0.toFixed(5) + '|' + s1.toFixed(5); let p = annCache.get(k); if (p) return p;
  p = new Path2D(); p.addPath(fp(s1)); if (s0 > 1e-6) p.addPath(fp(s0)); if (annCache.size > 3000) annCache.clear(); annCache.set(k, p); return p;
}
// blur radii snapped to a 1.25x ladder so neighbouring slices share one engine blur pass
export const snapBlur = (b) => (b < 0.8 ? b : Math.pow(1.25, Math.round(Math.log(b) / Math.log(1.25))));
const BIG = (() => { const p = new Path2D(); p.rect(-1e7, -1e7, 2e7, 2e7); return p; })();
// o: { name, key, fr, O (metres), unit (metres per unit), fp(s) -> Path2D (footprint at scale s, unit space, y up), Rref (units, for
//      the crescent offset), Rmax (units), c (half height, units), bins, top, bottom, alpha(bin, half), base(bin, half), dark(bin, half),
//      so, deco(c, bin, half, A) (optional, drawn after the annulus in the same plane), dz (height offset of the centre, units) }
export function shellItems(V, items, o) {
  const bins = o.bins, out = []; const cam = V.c(o.fr).p, cLat = Math.hypot(cam[0] - o.O[0], cam[1] - o.O[1]) / o.unit;
  for (const half of [-1, 1]) {
    if ((half > 0 && o.top === false) || (half < 0 && o.bottom === false)) continue;
    const L = [], group = [];
    for (let i = 0; i < bins; i++) { const thm = (i + 0.5) / bins * HALF_PI, h = half * o.c * Math.cos(thm) + (o.dz || 0);
      L.push(V.layer(o.fr, [o.O[0], o.O[1], o.O[2] + h * o.unit], [o.unit, 0, 0], [0, o.unit, 0])); }
    for (let i = 0; i < bins; i++) {
      const A = L[i]; if (!A) continue;
      // o.overlap: each annulus of the dome reaches `overlap` bins inward under its higher neighbour, so perspective never opens a
      // gap between slices (gaps showed the floor as dark contour lines)
      const s0 = Math.sin(Math.max(0, i - (half > 0 ? (o.overlap || 0) : 0)) / bins * HALF_PI), s1 = Math.sin((i + 1) / bins * HALF_PI);
      // the riser between this slice and the next (shallower) one of a bowl: seen from above it would be a gap, so the deeper
      // slice's outer edge is moved (homothety about the camera's nadir) exactly onto where the next slice's inner edge projects
      let rim = null;
      if (half < 0 && i < bins - 1 && L[i + 1] && L[i + 1].depth > 0) { const r = A.depth / L[i + 1].depth;
        if (r > 1.0005) { const nx = (cam[0] - o.O[0]) / o.unit, ny = (cam[1] - o.O[1]) / o.unit; rim = new DOMMatrix([r, 0, 0, r, nx * (1 - r), ny * (1 - r)]); } }
      const sc = Math.hypot(A.a, A.b), rOut = sc * o.Rmax * s1 * (rim ? rim.a : 1) + (rim ? sc * Math.abs(rim.e) : 0); if (rOut < 0.25) continue;
      if (!V.onScreen(A.e, A.f, rOut)) continue;
      if (s0 > 0 && V.covers(A.e, A.f, sc * (o.Rmin ?? o.Rmax) * s0 * 0.98)) continue; // the hole fills the view: nothing of this annulus is visible
      const a0 = o.alpha(i, half); if (a0 <= 0.002) continue;
      const it = { name: o.name, d: A.depth, blur: snapBlur(V.coc(A.depth)), draw(c, opaque) { const a = opaque ? 1 : a0;
        T(c, A); let p; if (rim) { p = new Path2D(); p.addPath(o.fp(s1), rim); if (s0 > 1e-6) p.addPath(o.fp(s0)); } else p = annulus(o.key, o.fp, s0, s1);
        const sh = new Path2D(); sh.addPath(o.fp(1), new DOMMatrix([1, 0, 0, 1, UL[0] * o.so * o.Rref, UL[1] * o.so * o.Rref]));
        const M2 = o.Rmax * 1.6, out2 = new Path2D(); out2.rect(-M2, -M2, 2 * M2, 2 * M2); out2.addPath(sh);
        const fillZone = (k) => { c.save(); c.clip(sh); c.fillStyle = rgba(o.base(i, half), a * k); c.fill(p, 'evenodd'); c.restore();
          c.save(); c.clip(out2, 'evenodd'); c.fillStyle = rgba(o.dark(i, half), a * k); c.fill(p, 'evenodd'); c.restore(); };
        if (o.hole && half > 0) {
          // a thin patch of the envelope where the camera's path crosses it: the membrane there is thinner in three flat steps
          // (fixed in space, not by zoom), so the view opens gradually as the camera approaches instead of in one frame
          const H = o.hole, ring = (r0, r1) => { const q = new Path2D(); if (r1 > 0) { q.moveTo(H[0] + r1, H[1]); q.arc(H[0], H[1], r1, 0, 6.2832); } else q.rect(-M2, -M2, 2 * M2, 2 * M2); q.moveTo(H[0] + r0, H[1]); q.arc(H[0], H[1], r0, 0, 6.2832); return q; };
          const n = H.length - 2, zones = [[H[n + 1], 0, 1]]; for (let q = n; q >= 2; q--) zones.push([H[q], H[q + 1], (q - 1) / n]);
          zones.forEach(([r0, r1, k]) => { c.save(); c.clip(ring(r0, r1), 'evenodd'); fillZone(k); c.restore(); });
        } else fillZone(1);
        if (o.deco) o.deco(c, i, half, A, sc);
      } };
      if (o.composite) group.push(it); else items.push(it); out.push(it);
    }
    // composite mode: every slice of this half is drawn OPAQUE into a scratch canvas and the stack is laid down at ONE constant
    // alpha (a translucent material: overlapping slices never stack into darker contour rings)
    if (group.length) { const ds = group.map((g) => g.d).sort((a, b) => a - b), d = half > 0 ? ds[0] : ds[ds.length - 1], aC = o.alpha(0, half);
      // the whole half's silhouette gets ONE crescent in screen space (o.scr = { dark, lit, so, lo }): per-slice crescents at their
      // own heights read as stepped contour rings once perspective separates the slices
      const Le = L[bins - 1] || L.find((x) => x), rpx = Le ? Math.hypot(Le.a, Le.b) * o.Rref : 0, scr = o.scr && o.scr(half);
      items.push({ name: o.name, d, blur: snapBlur(V.coc(ds[ds.length >> 1])), draw(c) {
        const sc = scratch(V.w, V.h), g = sc.getContext('2d'); // full-resolution scratch: the target may be the engine's half-size blur canvas (its setTransform is pre-scaled)
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, sc.width, sc.height);
        for (const it of group.slice().sort((a, b) => b.d - a.d)) { g.save(); it.draw(g, true); g.restore(); }
        if (scr && rpx > 2) {
          const s2 = scratch2(V.w, V.h), g2 = s2.getContext('2d'); g2.setTransform(1, 0, 0, 1, 0, 0); g2.globalCompositeOperation = 'copy'; g2.drawImage(sc, 0, 0); g2.globalCompositeOperation = 'source-over';
          const mk = s3(V.w, V.h), g3 = mk.getContext('2d'); g3.setTransform(1, 0, 0, 1, 0, 0);
          // crescent = silhouette minus the equator footprint shifted along the light, cut as a PATH in the equator slice's unit
          // space (a raster shift would treat everything beyond the canvas edge as empty once the camera is inside)
          lightFor(Le.a, Le.b, Le.c, Le.d); const ux = UL[0], uy = UL[1], fp1 = o.fp(1);
          const band = (col, k) => { g3.setTransform(1, 0, 0, 1, 0, 0); g3.globalCompositeOperation = 'copy'; g3.fillStyle = col; g3.fillRect(0, 0, V.w, V.h);
            g3.globalCompositeOperation = 'destination-in'; g3.drawImage(s2, 0, 0); g3.globalCompositeOperation = 'destination-out';
            g3.setTransform(Le.a, Le.b, Le.c, Le.d, Le.e, Le.f); g3.translate(ux * k * o.Rref, uy * k * o.Rref); g3.fillStyle = '#000'; g3.fill(fp1);
            g3.setTransform(1, 0, 0, 1, 0, 0); g3.globalCompositeOperation = 'source-over'; g.drawImage(mk, 0, 0); };
          g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop';
          band(scr.dark, scr.so);           // dark crescent away from the light
          if (scr.lit) band(scr.lit, -scr.lo); // lit crescent toward it
          g.globalCompositeOperation = 'source-over';
        }
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = aC; c.drawImage(sc, 0, 0); c.restore(); } }); }
  }
  return out;
}
let _s2 = null, _s3 = null;
function scratch2(w, h) { if (!_s2) _s2 = document.createElement('canvas'); if (_s2.width !== w || _s2.height !== h) { _s2.width = w; _s2.height = h; } return _s2; }
function s3(w, h) { if (!_s3) _s3 = document.createElement('canvas'); if (_s3.width !== w || _s3.height !== h) { _s3.width = w; _s3.height = h; } return _s3; }
let _sc = null; function scratch(w, h) { if (!_sc) _sc = document.createElement('canvas'); if (_sc.width !== w || _sc.height !== h) { _sc.width = w; _sc.height = h; } return _sc; }
