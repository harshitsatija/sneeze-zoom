// Small helpers shared by the body levels (nose, mucosa, macrophage): view bounds of a planar layer in its own units,
// and screen position of a layer point. Layers can be rotated in the image plane (the head tilts during the sneeze).
export function toScreen(A, x, y) { return [A.a * x + A.c * y + A.e, A.b * x + A.d * y + A.f]; }
export function fromScreen(A, sx, sy) { const det = A.a * A.d - A.b * A.c; const X = sx - A.e, Y = sy - A.f; return [(A.d * X - A.c * Y) / det, (-A.b * X + A.a * Y) / det]; }
// [x0, y0, x1, y1] in layer units covering the viewport (+ pad px)
export function viewBox(A, V, pad = 0) {
  let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18;
  for (const [sx, sy] of [[-pad, -pad], [V.w + pad, -pad], [-pad, V.h + pad], [V.w + pad, V.h + pad]]) { const [x, y] = fromScreen(A, sx, sy); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
}
export const scaleOf = (A) => Math.hypot(A.a, A.b);
// A plane z = h (frame fr, whose +z points back toward the camera) is visible only if the camera is on its +z side by a
// margin. Planes at or above the camera's height get a tiny positive depth from the drift tilt and a first-order affine
// that is meaningless (it can cover the screen): cull them. `margin` is in metres.
export function camZ(V, fr) { return V.c(fr).p[2]; }
export function planeOK(V, fr, h, margin = 0) { return V.c(fr).p[2] - h > Math.max(margin, V.near * 3); }

// (integration fix) an object placed AT THE FOCUS of zoom z0, offset sideways by (kx, ky) field widths so it never crosses the
// lens: at z0 it is the sharp subject, then it grows and slides out of frame (or shrinks) by geometry.
import { cameraAt } from '../core/cam.js';
const _fs = new Map();
export function focusAnchor(z0, kx, ky, kd = 1) {
  const key = z0 + ':' + kx + ':' + ky + ':' + kd; let v = _fs.get(key); if (v) return v;
  const c = cameraAt(z0, 0), M = c.M, W = c.W * kd, p = [0, 1, 2].map((i) => c.pos[i] + (c.focus[i] - c.pos[i]) * kd + M[i * 3] * kx * W + M[i * 3 + 1] * ky * W); // kd < 1: nearer the lens, same screen offset
  v = { fr: c.fr, p, W }; _fs.set(key, v); return v;
}
