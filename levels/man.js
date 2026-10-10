// The man: one character (head in the moving 'head' frame, body in the 'street' frame), side profile facing uptown
// (screen right), 1.78 m, orange jacket, jeans, sneakers. All geometry is built once in levels/hero-figure.js (the same
// kit draws the background people); here it is posed from the sneeze timeline with transforms only.
// The nostril is a small dark slit under the wing: the mouth of the bent tunnel in levels/nose.js. The face IS the head
// of the full-body man: one object at every zoom.
import { PAL, L, T, mix, blob, pointLaw, screenSpace } from '../core/kit.js';
import { sneeze, NOSTRIL, MAN } from '../core/anchors.js';
import { rng, clamp, ss } from '../core/m.js';
import { xform } from '../core/world.js';
import { heroPal, drawLegs, drawTorso, drawCollar, drawNeckStub, drawHead, drawArm, HOLE_PTS, NOSTRIL_HOLE, SLIT_C, MOUTH_AT } from './hero-figure.js';
export { HOLE_PTS, SLIT_C };

// The nostril slit in SCREEN space, projected per vertex in double precision (no huge canvas transforms near the face
// plane). covers = the slit contains the whole viewport (or the face plane is behind the camera): then nothing of the
// face is visible and inner content needs no clip. The head drawing and the slit use ONE affine, anchored at the
// nostril (exact there), so the cut and the clip agree.
export function headLayer(V) { const k = '__headA'; if (V.cache.has(k)) return V.cache.get(k); const A = V.layer('head', [NOSTRIL[0], NOSTRIL[1], 0], [1, 0, 0], [0, 1, 0]); const r = A && { ...A, e: A.e - A.a * NOSTRIL[0] - A.c * NOSTRIL[1], f: A.f - A.b * NOSTRIL[0] - A.d * NOSTRIL[1] }; V.cache.set(k, r); return r; }
export function holeScreen(V) {
  const key = '__hole'; if (V.cache.has(key)) return V.cache.get(key);
  let res; const A = headLayer(V);
  if (!A || A.depth <= V.near * 4) res = { covers: true, behind: true, pts: null, hpx: 1e9 };
  else {
    const pts = HOLE_PTS.map(([x, y]) => [A.a * x + A.c * y + A.e, A.b * x + A.d * y + A.f]);
    const inside = (px, py) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > py) !== (b[1] > py) && px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    const covers = inside(-2, -2) && inside(V.w + 2, -2) && inside(-2, V.h + 2) && inside(V.w + 2, V.h + 2);
    res = { covers, behind: false, pts, hpx: Math.hypot(A.c, A.d) * 0.0019 }; // slit height in px
  }
  V.cache.set(key, res); return res;
}
// while the slit is under ~1.6 px tall it is simply painted dark (the tunnel behind it is the same tone): no cut, no clip
export const SLIT_DARK = '#3c1026';
export const slitOpen = (V) => holeScreen(V).hpx > 1.6;
// clip for anything behind the face plane: only visible through the nostril
export function faceClipFor(V) {
  const h = holeScreen(V); if (h.covers) return null; const pts = h.pts;
  return (c) => { c.setTransform(1, 0, 0, 1, 0, 0); c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.clip(); };
}
export function clipItems(items, from, fn) { if (!fn) return; for (let i = from; i < items.length; i++) { const it = items[i], d0 = it.draw; it.draw = (c) => { fn(c); d0(c); }; it.cover = false; } }
const OUTSIDE_HOLE = (() => { const p = new Path2D(); p.rect(-1, -1, 2, 2); p.addPath(NOSTRIL_HOLE); return p; })(); // everything except the nostril

// ---------- the acted sneeze: pose from the shared timeline (12 s loop, CHOO at 4.0) ----------
const lerp = (a, b, t) => a + (b - a) * t;
const ARM_REST = [0.07, 0.14, 0.05], ARM_UP = [0.56, 2.5, 0.32];
export function poseAt(t) {
  const s = sneeze(t), c = s.c;
  const close = ss(3.93, 4.01, c) * (1 - ss(4.45, 5.0, c));                       // eyes shut through the burst
  const hunch = ss(3.97, 4.1, c) * (1 - ss(4.35, 5.8, c));                         // shoulders hunch, upper body folds forward
  const recoil = ss(4.22, 4.55, c) * (1 - ss(4.6, 5.6, c));                        // small rebound after the burst
  const raise = ss(3.86, 4.1, c) * (1 - ss(4.9, 6.1, c));                          // the hand comes up to the face (a little late)
  const ah = s.inhale * ss(1.4, 3.0, c);                                           // "ah… ah…"
  const arm = ARM_REST.map((v, i) => lerp(v + (i === 0 ? 0.08 * s.inhale : 0), ARM_UP[i], raise));
  return {
    s, k: 0.05 * hunch - 0.024 * s.inhale - 0.012 * recoil, sy: 1 + 0.013 * s.inhale - 0.009 * hunch,
    lid: Math.min(1, 0.27 - 0.08 * ah * (1 - s.squint) + 0.6 * s.squint + close), lidLo: Math.min(0.9, 0.45 * s.squint + 0.45 * close),
    brow: 0.0035 * ah * (1 - s.squint) - 0.0035 * Math.max(s.squint, close), browRot: -0.14 * Math.max(s.squint, close),
    mouth: Math.max(0.42 * ah, s.choo), arm,
  };
}

// ---- the spray: real droplet sizes (Stokes drag: tau = rho d^2 / 18 mu). Visible drops fly ballistically and fall;
// the fine aerosol rides the turbulent puff, drawn as a soft mist of a few translucent blobs that grow and drift.
// SLOW MOTION: real droplets cross a 50 cm frame in ~20 ms, so the burst plays at 1/25 speed for its first ~0.6 s,
// then the clock accelerates (the cloud still drifts out over the rest of the loop). Same idea as the slowed cilia.
export function sprayClock(s) { if (s < 0) return -1; return s / 25 + 0.12 * Math.max(0, s - 0.55) ** 2; }
const NDROP = 120, drops = [];
{ const r = rng(4242); for (let i = 0; i < NDROP; i++) {
  const dia = Math.pow(10, -3.4 + Math.pow(r(), 1.3) * 0.9);      // 0.4–3.2 mm: the visible drops (the aerosol is the mist)
  const g = () => (r() + r() + r() - 1.5) * 1.15; // ~gaussian
  const delay = Math.pow(r(), 3) * 0.004;
  drops.push({ dia, v0: (7 + r() * 17) * (1 - delay * 8), ang: -0.32 + g() * 0.2, el: g() * 0.2, tau: Math.min(1.4, 3.1e6 * dia * dia), fromMouth: r() < 0.62, delay, tint: r() });
} }
function dropPos(d, tt0, src) {
  const tt = tt0 - d.delay; if (tt < 0) return null;
  const dist = d.v0 * d.tau * (1 - Math.exp(-tt / d.tau)) + 0.12 * tt; let x = Math.cos(d.ang) * Math.cos(d.el) * dist, y = Math.sin(d.ang) * dist - 4.9 * tt * tt, zz = Math.sin(d.el) * dist;
  if (src[1] + y < 0.002) y = 0.002 - src[1]; // lands on the sidewalk
  return [src[0] + x, src[1] + y, src[2] + zz];
}
const DROP_BASE = [mix(PAL.virus, '#ffffff', 0.16), mix(PAL.virus, '#ffffff', 0.3), mix(PAL.virus, PAL.cheek, 0.35)];
const DROP_SH = mix(PAL.virus, PAL.bodyDeep, 0.3), DROP_HI = '#ffe2ee';
// mist lobes: front x_f(t) = U·0.3(1−e^{−t/0.3}); radius grows ~0.25·distance (turbulent entrainment)
const PUFF = (() => { const r = rng(77), out = []; for (let i = 0; i < 9; i++) out.push({ u: 0.2 + r() * 0.85, dy: (r() - 0.5) * 0.8, dz: (r() - 0.5) * 0.9, k: 0.6 + r() * 0.5, seed: (r() * 1e6) | 0, mouth: i % 3 !== 0, rot: r() * 6.28 }); return out; })();

export default {
  id: 'man', zr: [-2.9, 3.6],
  draw(V, items, labels) {
    const t = V.t, pose = poseAt(t), s = pose.s;
    const B = V.layer('street', [0, 0, 0], [1, 0, 0], [0, 1, 0]); if (!B) return;
    const Hd = headLayer(V);
    const scale = Math.hypot(B.a, B.b); // px per metre
    const hole = holeScreen(V); if (hole.covers) return; // the camera is in the nostril: nothing of the man is in view
    if (scale * 1.8 < 0.4) return;
    const hpx = scale * 1.8, lod = hpx < 7 ? 0 : hpx < 60 ? 1 : 2, cut = hole.hpx > 1.6, pal = PAL_HERO;
    items.push({ name: 'man', d: B.depth, blur: V.coc(B.depth), draw(c) {
      T(c, B);
      drawLegs(c, pal, pose, lod);
      drawTorso(c, pal, pose, lod);
      if (Hd) { T(c, Hd); drawNeckStub(c, pal); T(c, B); }
      drawCollar(c, pal, pose, lod);
      if (Hd) { T(c, Hd); if (cut) { c.save(); c.clip(OUTSIDE_HOLE, 'evenodd'); }
        drawHead(c, pal, pose, lod, 0, cut ? '' : SLIT_DARK);
        if (cut) c.restore(); T(c, B); }
      drawArm(c, pal, pose, lod);
    } });
    // ---- spray
    const tt = sprayClock(s.spray);
    if (tt >= 0 && tt < 9) {
      const nose = xform([SLIT_C[0] + 0.006, SLIT_C[1] - 0.003, 0], 'head', 'street'), mouth = xform([MOUTH_AT[0] + 0.006, MOUTH_AT[1], 0], 'head', 'street');
      // droplets: flat shaded discs at their true size, grouped into a few blur bins (front / behind the man, by blur)
      const bins = new Map();
      for (const d of drops) {
        const p = dropPos(d, tt, d.fromMouth ? mouth : nose); if (!p) continue;
        const sp = V.P('street', p); if (sp[2] <= V.near) continue;
        const [r, a] = pointLaw(V.px(d.dia / 2, sp[2]), 0.6); if (a < 0.04 || !V.onScreen(sp[0], sp[1], r + 2)) continue;
        const cc = V.coc(sp[2]), lvl = cc < 1.5 ? 0 : Math.round(Math.log2(cc)), key = (p[2] > 0 ? 100 : 0) + lvl;
        let b = bins.get(key); if (!b) { b = { dsum: 0, n: 0, csum: 0, pts: [] }; bins.set(key, b); }
        b.dsum += sp[2]; b.csum += cc; b.n++; b.pts.push([sp[0], sp[1], r, a, d.tint]);
      }
      for (const b of bins.values()) { const dm = b.dsum / b.n, bl = b.csum / b.n < 1.5 ? 0 : Math.pow(2, Math.round(Math.log2(b.csum / b.n)));
        items.push({ name: 'spray', d: dm, blur: bl, draw(c) {
          screenSpace(c); const Lx = L[0], Ly = L[1];
          for (const [x, y, r, a, tn] of b.pts) {
            c.globalAlpha = 0.94 * a; c.fillStyle = DROP_BASE[(tn * 3) | 0]; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
            if (r > 2.2) { // darker crescent away from the light, small flat highlight toward it
              c.save(); c.clip(); c.fillStyle = DROP_SH; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.arc(x - Lx * r * 0.32, y - Ly * r * 0.32, r * 0.92, 0, 6.2832, true); c.fill(); c.restore();
              c.fillStyle = DROP_HI; c.beginPath(); c.ellipse(x + Lx * r * 0.42, y + Ly * r * 0.42, r * 0.26, r * 0.17, Math.atan2(Ly, Lx) + 1.5708, 0, 6.2832); c.fill(); }
          }
          c.globalAlpha = 1;
        } }); }
      // mist: one soft item; each lobe is three stacked translucent copies of one blob (a stepped soft edge)
      const lobes = []; let dsum = 0;
      const fade = Math.exp(-tt / 2.2);
      for (const q of PUFF) {
        const src = q.mouth ? mouth : nose, xf = 7 * 0.3 * (1 - Math.exp(-tt / 0.3)) * q.u + 0.05 * tt; if (xf < 0.003) continue;
        const R0 = 0.005 + 0.22 * xf * q.k, ang = -0.28;
        const p = [src[0] + Math.cos(ang) * xf, src[1] + Math.sin(ang) * xf + q.dy * R0 - 0.02 * tt * tt, src[2] + q.dz * R0];
        const Bq = V.bill('street', p, R0); if (!Bq || !V.onScreen(Bq.e, Bq.f, Bq.s * 1.3)) continue;
        lobes.push([Bq, q]); dsum += Bq.depth;
      }
      if (lobes.length) { const dm = dsum / lobes.length;
        items.push({ name: 'spray-mist', d: dm, blur: V.coc(dm), draw(c) {
          for (const [Bq, q] of lobes) { T(c, Bq); c.rotate(q.rot + tt * 0.3); const b = blob(q.seed, 0.16, 5);
            c.fillStyle = `rgba(250,214,236,${(0.06 * fade).toFixed(3)})`; c.fill(b); c.save(); c.scale(0.78, 0.78); c.fill(b); c.scale(0.7, 0.7); c.fill(b); c.restore(); }
        } }); }
    }
    // label: beside him (in front of his forehead, clear of the head and of the spray cone below)
    // label (unification pass): attached beside him, behind the back of his head (the side clear of the spray); if that does
    // not fit, just in front of his face. Anchored in the moving 'head' frame so it stays with him through the sneeze.
    if (V.z > -0.2 && V.z < 1.6) { const lw = (Math.max('A man sneezing'.length * 8.2, 'Fifth Avenue, New York · 1.78 m'.length * 5.9) + 4) * V.w / Math.max(1, globalThis.innerWidth || V.w), b = V.P('head', [-0.1, 0.05, 0]), f = V.P('head', [0.16, 0.1, 0]);
      const x = b[0] - lw - 8 * V.s >= 30 ? b[0] - lw - 8 * V.s : f[0] + 8 * V.s; if (b[2] > 0 && x + lw < V.w - 10) labels.push({ x, y: b[1] - 10 * V.s, text: 'A man sneezing', sub: 'Fifth Avenue, New York · 1.78 m' }); }
  },
};
const PAL_HERO = heroPal();
