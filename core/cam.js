// Camera path: keyframes, each = focus point in its own frame + camera basis (columns: right, up, back) in that frame.
// Between two keyframes the focus and orientation interpolate with smootherstep in z. The camera sits D = W * KD behind the focus.
import { xform, rot } from './world.js';
import { mm, mv, lerp3, add, mul, qFromM, mFromQ, slerp, sss, col, fromCols, norm, cross } from './m.js';
export const FOVX = 34 * Math.PI / 180, KD = 1 / (2 * Math.tan(FOVX / 2));
export function basis(back, upHint) { const b = norm(back), r = norm(cross(upHint, b)), u = cross(b, r); return fromCols(r, u, b); }
let KEYS = [];
export function setKeys(k) { KEYS = k.slice().sort((a, b) => a.z - b.z); }
export const keys = () => KEYS;
// Evaluate the camera at zoom z. Returns { fr, pos, M, focus, W, D }
// DRIFT: a slow lateral orbit of the camera around the focus (Kurzgesagt's constant gentle parallax). The camera keeps
// looking at the focus, so nearer and farther layers slide against each other even when the zoom is still.
export const DRIFT = { amp: 0, on: false }; // v2: no drift (it read as jitter when layers pass close to the lens)
export function cameraAt(z, time = 0) {
  const W = Math.pow(10, z), D = W * KD;
  let i = 0; while (i < KEYS.length - 2 && z > KEYS[i + 1].z) i++;
  const a = KEYS[i], b = KEYS[Math.min(i + 1, KEYS.length - 1)];
  let t = b === a ? 0 : (z - a.z) / (b.z - a.z); t = (a.thru && b.thru) ? t : a.thru ? sss(0, 1, 0.5 + t / 2) * 2 - 1 : b.thru ? sss(0, 1, t / 2) * 2 : sss(0, 1, t); // keys with thru:true are passed at speed
  if (z <= KEYS[0].z) t = 0; if (z >= KEYS[KEYS.length - 1].z) { t = 1; }
  // work in the inner keyframe's frame (a.fr) unless we are past the last key
  const fr = a.fr;
  const fa = a.at, fb = xform(b.at, b.fr, fr);
  // g keeps the inner target on screen: its screen offset is sss(t) * |B-A| / W_b, never more than the outer framing
  const g0 = b === a ? 0 : Math.min(1, (W / Math.pow(10, b.z)) * t);
  const g = (a.arrive || b.arrive) ? g0 * g0 * (3 - 2 * g0) * 0.5 + g0 * 0.5 : g0; // opt-in: zero-speed arrival (key flag `arrive: true`)
  const focus = lerp3(fa, fb, g);
  const Ma = a.M, Mb = mm(rot(b.fr, fr), b.M);
  const M = mFromQ(slerp(qFromM(Ma), qFromM(Mb), t));
  let pos = add(focus, mul(col(M, 2), D)), Mo = M;
  if (DRIFT.on && DRIFT.amp > 0) {
    const ax = Math.sin(time * 0.21) * DRIFT.amp, ay = Math.sin(time * 0.153 + 1.3) * DRIFT.amp * 0.6; // radians of orbit
    const r = col(M, 0), u = col(M, 1), b = col(M, 2);
    const nb = norm(add(add(b, mul(r, Math.sin(ax))), mul(u, Math.sin(ay)))); // new back direction
    pos = add(focus, mul(nb, D)); const nr = norm(cross(u, nb)), nu = cross(nb, nr); Mo = fromCols(nr, nu, nb);
  }
  return { fr, pos, M: Mo, focus, W, D, z };
}
