// Macrophage nucleus geometry + the camera's real path through it (owner: NUCLEUS agent).
// Frame 'mnuc' (centre of the nucleus, axes = street axes: x right, y up, z = height toward the camera). Units: µm here.
import { cameraAt } from '../core/cam.js';
import { xform } from '../core/world.js';

// Kidney/bean nucleus (research/SCIENCE.md I-5: 8–12 µm, oval to kidney shaped, eccentric, indented toward the Golgi / cell centre)
export const NUC = { a: 5.0, b: 3.85, c: 2.9, dentPhi: Math.atan2(-1.6, -2.2), dentW: 0.62, dentD: 0.2, env: 0.035 }; // env = perinuclear gap
const angd = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
// footprint radius (µm) at azimuth phi, at the equator
export function footR(phi) {
  const c = Math.cos(phi), s = Math.sin(phi), e = 1 / Math.sqrt((c / NUC.a) ** 2 + (s / NUC.b) ** 2);
  const d = angd(phi, NUC.dentPhi); return e * (1 - NUC.dentD * Math.exp(-((d / NUC.dentW) ** 2)) + 0.025 * Math.sin(3 * phi + 0.7) + 0.015 * Math.sin(5 * phi + 2.1));
}
// "radius" of a point relative to the envelope (< 1 inside)
export function nucR(x, y, z) { const r = Math.hypot(x, y), f = footR(Math.atan2(y, x)); return Math.hypot(r / f, z / NUC.c); }
// footprint path (µm, y up) scaled by s, inflated by `grow` µm
const FP = 160; const fpCache = new Map();
export function footPath(s, grow = 0) {
  const key = s.toFixed(5) + '|' + grow; let p = fpCache.get(key); if (p) return p; p = new Path2D();
  for (let i = 0; i <= FP; i++) { const a = i / FP * 2 * Math.PI, r = footR(a) * s + grow; i ? p.lineTo(Math.cos(a) * r, Math.sin(a) * r) : p.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  p.closePath(); if (fpCache.size > 600) fpCache.clear(); fpCache.set(key, p); return p;
}

// ---------- the camera path inside the nucleus (computed once from the real camera keys, drift excluded) ----------
// path.h[i] = camera height (nm, mnuc z), path.x/y = lateral position (nm). Sorted by height.
export const PATH = { ready: false };
export function buildPath() {
  const h = [], x = [], y = [];
  for (let z = -9.8; z <= -4.6; z += 0.005) {
    const cam = cameraAt(z, 0); const p = xform(cam.pos, cam.fr, 'mnuc'); h.push(p[2] * 1e9); x.push(p[0] * 1e9); y.push(p[1] * 1e9);
  }
  const idx = h.map((_, i) => i).sort((a, b) => h[a] - h[b]);
  PATH.h = idx.map((i) => h[i]); PATH.x = idx.map((i) => x[i]); PATH.y = idx.map((i) => y[i]); PATH.ready = true;
}
// camera lateral position (nm) when it is at height hz (nm)
export function pathAt(hz) {
  const H = PATH.h; if (hz <= H[0]) return [PATH.x[0], PATH.y[0]]; const n = H.length; if (hz >= H[n - 1]) return [PATH.x[n - 1], PATH.y[n - 1]];
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (H[m] < hz) lo = m; else hi = m; }
  const t = (hz - H[lo]) / (H[hi] - H[lo] || 1); return [PATH.x[lo] + (PATH.x[hi] - PATH.x[lo]) * t, PATH.y[lo] + (PATH.y[hi] - PATH.y[lo]) * t];
}
// lateral clearance (nm) the camera needs at height hz above the dive target zT: nearer things fly past at the frame edge
export function inTunnel(px, py, pz, r, zT) {
  if (!PATH.ready || pz < zT - 2) return false; const [cx, cy] = pathAt(pz); const h = Math.max(0, pz - zT), need = 8 + r + (h < 400 ? 0.2 * h : 80 + 0.06 * (h - 400)); // a clear view cone over the final dive
  return Math.hypot(px - cx, py - cy) < need;
}
