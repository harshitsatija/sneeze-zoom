// Inside the nostril: a STRAIGHT tunnel on the camera's line. From z -0.75 inward the camera zooms straight onto one
// point P* (core/anchors.js), which sits behind the centre of the slit (levels/hero-figure.js). The vestibule is a stack
// of wall layers (annuli) concentric around that line at their real depths: dark, skin-lined, with soft wet folds and a
// faint warm glow high on the wall (light through the thin wing). It narrows to a small internal valve; beyond it the
// warm lit cavity walls frame the septum lining (levels/mucosa.js). Through the slit from outside the tunnel reads as
// nested dark rims converging on a small, dim centre (the lining's dark immune hot spot sits exactly on the line).
// Vibrissae root in the walls and reach toward the line, passing near the lens without crossing it.
// Frame 'nose': origin at the NOSTRIL anchor on the face plane, z toward the camera. Drawing unit: 1 mm.
import { PAL, mix, rgba, T, blob, UL, screenSpace } from '../core/kit.js';
import { rng, clamp, ss, I3 } from '../core/m.js';
import { MUC, MAC, MNUC, NSOME, sneeze, NOSTRIL } from '../core/anchors.js';
import { faceClipFor, HOLE_PTS, SLIT_C, slitOpen } from './man.js';
import { planeOK, focusAnchor } from './body-util.js';
import { gel, circle, FAM } from '../core/look.js';
const DROPS = [[-2.08, 0.2, 0.08, 0.06], [-1.95, -0.24, -0.12, 0.035]], DROP_KD = 0.12, DROP_COL = mix(FAM.cyan.lit, '#ffffff', 0.35);

const MM = 1e-3;
const S0 = [(SLIT_C[0] - NOSTRIL[0]) / MM, (SLIT_C[1] - NOSTRIL[1]) / MM]; // slit centre in nose mm
// the camera's path through the tunnel (nose mm; from the keys below, drift-averaged): depth → [x, y]
// the camera's line: P* projected on the face plane (nose mm), from the nested anchors (sub-µm terms are negligible)
const AX = [(MUC[0] + MAC[0] + MNUC[0] + NSOME[0]) / MM, (MUC[1] + MAC[1] + MNUC[1] + NSOME[1]) / MM];
export const camPath = () => AX;
// wall layers: depth (mm), hole centre and half-axes, tone, lip, shadow band. The hole centres climb with the camera but
// stay a little above it, so each ring's lower lip hides the next ring from the slit (checked by ray casting).
// glow: light through the thin wing skin, high on the wall (0..1); folds: wet ridges around the opening
const PROFILE = [
  { z: -0.22, cx: S0[0], cy: S0[1], rx: 4.5, ry: 1.0, col: '#5a1a32', lip: '#6a2440', sh: '#4c162e', slit: true },
  { z: -0.7, rx: 3.6, ry: 1.12, col: '#5e1c38', lip: '#7e304b', sh: '#42112b', folds: 2 },
  { z: -1.4, rx: 3.0, ry: 1.08, col: '#5a1b38', lip: '#7a2e4a', sh: '#40102a', folds: 3, glow: 0.4 },
  { z: -2.3, rx: 2.5, ry: 1.0, col: '#561a38', lip: '#78304a', sh: '#3c102a', folds: 3, glow: 0.6 },
  { z: -3.3, rx: 2.05, ry: 0.9, col: '#521a38', lip: '#7a324c', sh: '#3a0f2a', folds: 3, glow: 0.5 },
  { z: -4.3, rx: 1.6, ry: 0.78, col: '#4e1838', lip: '#7c344e', sh: '#381030', folds: 2, glow: 0.3 },
  { z: -5.2, rx: 1.2, ry: 0.64, col: '#4c1838', lip: '#843852', sh: '#381232', warm: 0.2 },
  { z: -6.1, rx: 0.75, ry: 0.45, col: '#521a3a', lip: '#904058', sh: '#3e1434', warm: 0.3 },
  { z: -6.9, rx: 0.42, ry: 0.3, col: '#5a1c3e', lip: '#9c4660', sh: '#441634', warm: 0.4 },  // internal valve: small, its rim lit from beyond
  { z: -8.0, rx: 3.0, ry: 2.1, col: '#b8405e', lip: '#cc5470', sh: '#983452', warm: 0.8 },   // the cavity: lit through thin skin
  { z: -9.3, rx: 5.6, ry: 3.8, col: '#cc5470', lip: '#dc6a7e', sh: '#ac4260', warm: 1 },
].map((P) => (P.slit ? P : { ...P, cx: AX[0], cy: AX[1] }));
const slitShape = (() => { const p = new Path2D(); HOLE_PTS.forEach(([x, y], i) => { const X = (x - NOSTRIL[0]) / MM, Y = (y - NOSTRIL[1]) / MM; i ? p.lineTo(X, Y) : p.moveTo(X, Y); }); p.closePath(); return p; })();
const slitC = (() => { let x = 0, y = 0; HOLE_PTS.forEach(([a, b]) => { x += (a - NOSTRIL[0]) / MM; y += (b - NOSTRIL[1]) / MM; }); return [x / HOLE_PTS.length, y / HOLE_PTS.length]; })();
const layers = PROFILE.map((P, k) => {
  const R = rng(100 + k), seed = (R() * 1e6) | 0;
  const hole = new Path2D();
  if (P.slit) hole.addPath(slitShape, new DOMMatrix().translate(slitC[0], slitC[1]).scale(1.08, 1.25).translate(-slitC[0], -slitC[1]));
  else hole.addPath(blob(seed, 0.05, 4, 0, 48), new DOMMatrix().translate(P.cx, P.cy).rotate(-4 + k * 1.5).scale(P.rx, P.ry));
  const outer = new Path2D(); outer.ellipse(P.cx, P.cy, P.rx * 2.6 + 9, P.ry * 2.6 + 9, 0, 0, Math.PI * 2);
  const ring = new Path2D(); ring.addPath(outer); ring.addPath(hole);
  // the lining's vessels on the warm (lit) walls: a few branching wavy strokes around the opening
  let ves = null;
  if (P.warm >= 0.5) { ves = new Path2D(); for (let i = 0; i < 9; i++) { const a = R() * 6.283, r0 = 1.08 + R() * 0.15; let x = P.cx + Math.cos(a) * P.rx * r0, y = P.cy + Math.sin(a) * P.ry * r0; ves.moveTo(x, y);
    for (let j = 0; j < 5; j++) { const aa = a + (R() - 0.5) * 0.9, st = 0.5 + R() * 0.9; x += Math.cos(aa) * st * (1 + P.rx * 0.08); y += Math.sin(aa) * st * (1 + P.ry * 0.08); ves.lineTo(x, y); } } }
  // wet folds: ridges hugging the opening (a dark groove + a soft glossy highlight just above it), wavering a little
  let fold = null, foldHi = null;
  if (P.folds) { fold = new Path2D(); foldHi = new Path2D(); for (let i = 0; i < P.folds; i++) { const g = 0.38 + i * (0.42 + 0.06 * i), ph = R() * 6.28, w = 0.05 + R() * 0.05;
    for (const [path, dy] of [[fold, 0], [foldHi, 0.17 + 0.02 * i]]) { for (let j = 0; j <= 72; j++) { const a = j / 72 * 6.2832, wob = 1 + w * Math.sin(3 * a + ph);
      const x = P.cx + Math.cos(a) * (P.rx + g) * wob, y = P.cy + Math.sin(a) * (P.ry + g) * wob + dy; j ? path.lineTo(x, y) : path.moveTo(x, y); } } } }
  return { ...P, k, hole, ring, ves, seed, fold, foldHi };
});

// vibrissae: rooted in the skin-lined vestibule (rings 1–3), growing toward the exit and inward; real size
// (0.1–0.15 mm thick, 4–10 mm long). Most lie along the walls; four reach across the camera's path at the bend.
const hairs = [];
{ const R = rng(17);
  for (let k = 0; k < 6; k++) {
    const L = layers[1 + ((R() * 4) | 0)], a = R() * 6.283, ca = Math.cos(a), sa = Math.sin(a);
    const root = [L.cx + ca * L.rx * 1.02, L.cy + sa * L.ry * 1.02, L.z - 0.08];
    const len = 4 + R() * 6, inward = 0.25 + R() * 0.3, rise = Math.min(len * 0.6, -root[2] - 0.12);
    const tip = [root[0] - ca * L.rx * inward, root[1] - sa * L.ry * inward - 0.3, root[2] + rise];
    const mid = [(root[0] + tip[0]) / 2 - ca * 0.3 + (R() - 0.5) * 0.8, (root[1] + tip[1]) / 2 - sa * 0.25 - 0.3, (root[2] + tip[2]) / 2 + 0.15];
    hairs.push({ root, mid, tip, w: 0.1 + R() * 0.05, ph: R() * 6.28 });
  }
  // near the lens: rooted in the walls, tips reaching to 0.3–0.7 mm from the line at several depths (they pass the
  // lens as soft dark silhouettes at the edge of the view, never across its centre)
  for (let k = 0; k < 5; k++) {
    const zt = -0.6 - k * 0.85 - R() * 0.2, a = k * 2.4 + R() * 0.6, off = 0.3 + R() * 0.4, reach = 0.9 + R() * 0.9;
    const tip = [AX[0] + Math.cos(a) * off, AX[1] + Math.sin(a) * off * 0.8, zt];
    const root = [tip[0] + Math.cos(a) * reach, tip[1] + Math.sin(a) * reach * 0.7, zt - 0.7 - R() * 0.8];
    const mid = [(root[0] + tip[0]) / 2, (root[1] + tip[1]) / 2 - 0.1, (root[2] + tip[2]) / 2];
    hairs.push({ root, mid, tip, w: 0.1 + R() * 0.04, ph: R() * 6.28, close: true });
  }
}
const bez = (a, b, c, u) => [0, 1, 2].map((i) => (1 - u) * (1 - u) * a[i] + 2 * (1 - u) * u * b[i] + u * u * c[i]);
const bin = (b) => { b = Math.min(b, 7 * (typeof window !== 'undefined' ? 1 : 1)); return b < 0.8 ? b : Math.pow(2, Math.round(Math.log2(b) * 2) / 2); }; // shared blur bins; capped so the tunnel folds stay readable (no dark mush)

export default {
  id: 'nose', zr: [-3.4, 1.2],
  draw(V, items) {
    // (integration fix) the tunnel bend (z ≈ -2.1) had nothing in focus: two airborne mucus droplets (0.3–0.6 mm) float at
    // the focus there, off the camera axis; gel with a lighter core and a flat highlight (the droplet language of the spray)
    if (false) for (const [z0, kx, ky, kr] of DROPS) { // droplets removed: they flickered in/out and read as glitches const A = focusAnchor(z0, kx, ky, DROP_KD), q = V.P(A.fr, A.p); if (q[2] <= V.near * 2) continue;
      const r = kr * A.W * V.f / q[2]; if (r < 1 || !V.onScreen(q[0], q[1], r * 1.2)) continue;
      items.push({ name: 'droplet', d: q[2], blur: Math.min(V.coc(q[2]), 0.6), /* the focus racks to the droplet: the subject of the tunnel bend */ draw(c) { screenSpace(c); c.save(); c.translate(q[0], q[1]); c.scale(r, r); gel(c, circle, DROP_COL, 0.55, 0.7);
        c.fillStyle = rgba('#ffffff', 0.7); c.beginPath(); c.ellipse(UL[0] * 0.45, UL[1] * 0.45, 0.2, 0.11, Math.atan2(UL[1], UL[0]) + Math.PI / 2, 0, 6.2832); c.fill(); c.restore(); } }); }
    if (!slitOpen(V)) return; // under ~1.6 px the slit is painted dark by the face itself
    const n0 = items.length, s = sneeze(V.t);
    for (const L of layers) {
      if (!planeOK(V, 'nose', L.z * MM)) continue; const A = V.layer('nose', [0, 0, L.z * MM], [MM, 0, 0], [0, MM, 0]); if (!A) continue;
      const sc = Math.hypot(A.a, A.b); if (sc * L.rx < 0.4) continue;
      items.push({ name: 'nostril-wall', d: A.depth, blur: bin(V.coc(A.depth)), draw(c) {
        T(c, A); c.fillStyle = L.col; c.fill(L.ring, 'evenodd');
        c.save(); c.clip(L.ring, 'evenodd');
        if (L.warm >= 0.5) { // light through the thin skin of the nose: a soft lit region on the upper-front wall
          const gx = L.cx + L.rx * 1.3, gy = L.cy + L.ry * 1.25, g = c.createRadialGradient(gx, gy, 0, gx, gy, L.rx * 2.4);
          g.addColorStop(0, rgba('#ff9a8a', 0.42 * L.warm)); g.addColorStop(1, rgba('#ff9a8a', 0)); c.fillStyle = g; c.fill(L.ring, 'evenodd');
          c.strokeStyle = rgba('#8a1840', 0.45); c.lineWidth = 0.09 + 0.02 * L.rx; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(L.ves); }
        if (L.fold) { c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = rgba(L.sh, 0.9); c.lineWidth = 0.2; c.stroke(L.fold);
          c.strokeStyle = 'rgba(255,175,210,0.26)'; c.lineWidth = 0.14; c.stroke(L.foldHi); }
        if (L.glow) { // light through the thin ala skin: a faint warm translucent glow high on the wall
          const gx = L.cx + L.rx * 0.6, gy = L.cy + L.ry * 2.1, g = c.createRadialGradient(gx, gy, 0, gx, gy, L.rx * 1.6);
          g.addColorStop(0, rgba('#ff8a7a', 0.34 * L.glow)); g.addColorStop(1, rgba('#ff8a7a', 0)); c.fillStyle = g; c.fill(L.ring, 'evenodd'); }
        // shadow band on the upper-left inner wall (it faces away from the light), lit lip on the lower-right
        const sh = new Path2D(); sh.addPath(L.hole); sh.addPath(L.hole, new DOMMatrix([1, 0, 0, 1, UL[0] * 0.7, UL[1] * 0.7])); c.fillStyle = L.sh; c.fill(sh, 'evenodd');
        const lp = new Path2D(); lp.addPath(L.hole); lp.addPath(L.hole, new DOMMatrix([1, 0, 0, 1, -UL[0] * 0.24, -UL[1] * 0.24])); c.fillStyle = L.lip; c.fill(lp, 'evenodd');
        c.restore();
      } });
    }
    // vibrissae as tapered ribbons (per-vertex projection, near-plane clipped): foreground silhouettes passing the camera
    const near = V.near * 1.5;
    for (const h of hairs) {
      const bend = s.choo * 0.9 + 0.15 * Math.sin(V.t * 0.8 + h.ph);
      const tip = [h.tip[0], h.tip[1] - bend * 0.3, h.tip[2] + bend * 0.5];
      const cs = []; for (let i = 0; i <= 10; i++) { const p = bez(h.root, h.mid, tip, i / 10); cs.push({ c: V.cs('nose', [p[0] * MM, p[1] * MM, p[2] * MM]), w: h.w * MM * (1 - 0.6 * i / 10) }); }
      const pts = []; for (let i = 0; i < cs.length; i++) { const a = cs[i]; if (a.c[2] > near) pts.push(a); if (i < cs.length - 1) { const b = cs[i + 1]; if ((a.c[2] > near) !== (b.c[2] > near)) { const u = (near - a.c[2]) / (b.c[2] - a.c[2]); pts.push({ c: [a.c[0] + (b.c[0] - a.c[0]) * u, a.c[1] + (b.c[1] - a.c[1]) * u, near], w: a.w + (b.w - a.w) * u }); } } }
      if (pts.length < 2) continue;
      const sp = pts.map((p) => { const k = V.f / p.c[2]; return [V.cx + p.c[0] * k, V.cy - p.c[1] * k, p.w * k * 0.5, p.c[2]]; });
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, wmax = 0; for (const p of sp) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); wmax = Math.max(wmax, p[2]); }
      if (x1 + wmax < 0 || x0 - wmax > V.w || y1 + wmax < 0 || y0 - wmax > V.h) continue; if (wmax < 0.15) continue;
      const dRoot = V.cs('nose', [h.root[0] * MM, h.root[1] * MM, h.root[2] * MM])[2];
      let dm = 0, wsum = 0; for (const p of sp) { if (p[0] > -50 && p[0] < V.w + 50 && p[1] > -50 && p[1] < V.h + 50) { dm += p[3]; wsum++; } } dm = wsum ? dm / wsum : sp[sp.length >> 1][3];
      items.push({ name: 'vibrissa', d: dRoot * 0.9995, blur: bin(V.coc(dm)), draw(c) {
        screenSpace(c);
        const left = [], right = [];
        for (let i = 0; i < sp.length; i++) { const a = sp[Math.max(0, i - 1)], b = sp[Math.min(sp.length - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; const w = Math.max(0.35, sp[i][2]); left.push([sp[i][0] - ty * w, sp[i][1] + tx * w]); right.push([sp[i][0] + ty * w, sp[i][1] - tx * w]); }
        c.beginPath(); left.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); for (let i = right.length - 1; i >= 0; i--) c.lineTo(right[i][0], right[i][1]); c.closePath();
        c.fillStyle = '#14020f'; c.fill();
        const e = sp[sp.length - 1]; c.beginPath(); c.arc(e[0], e[1], Math.max(0.35, e[2]), 0, 6.283); c.fill();
        if (sp[0][2] > 1.5) { c.beginPath(); for (let i = 0; i < sp.length; i++) { const p = sp[i], q = left[i]; const x = p[0] + (q[0] - p[0]) * 0.55, y = p[1] + (q[1] - p[1]) * 0.55; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.strokeStyle = rgba(PAL.hairLit, 0.9); c.lineWidth = Math.max(0.5, sp[0][2] * 0.35); c.lineCap = 'round'; c.stroke(); }
      } });
    }
    const clip = faceClipFor(V); if (clip) for (let i = n0; i < items.length; i++) { const it = items[i], d0 = it.draw; it.draw = (c) => { clip(c); d0(c); }; }
  },
};
