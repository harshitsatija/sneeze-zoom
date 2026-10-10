// SPACE dust motes (owner: SPACE builder): the body's floating particles, in space. A scale-invariant field of drifting dust
// and ice motes, seeded at every scale along the camera path (14 per decade, z 7.55 … 27.3). Each mote is anchored in world
// space: it is placed once, relative to the camera pose of its own scale u (in that key's frame), at a depth q·D in front of
// that camera — near (q 0.14–0.6, big, off-centre, blurred by V.coc, they slide out past the frame edge as we zoom in),
// mid (around the focus, small and sharp) or far (behind the focus, small, soft). Its true size is a fixed fraction of its
// own scale, so it shrinks by geometry as the camera backs away and dims only by kit.pointLaw below ~1.5 px (never by zoom).
// Near motes keep at least 0.45 of the half-frame off the centre at their anchor; since screen offset and screen size grow
// together as the camera approaches, they leave the frame before they could cover the subject.
import { PAL, mix, screenSpace, pointLaw } from '../core/kit.js';
import { cameraAt } from '../core/cam.js';
import { col, rng, sub, dot } from '../core/m.js';
import { xform } from '../core/world.js';
import { drawBlob, SPC } from './space-kit.js';
import { FAM, sink } from '../core/look.js';

const NPD = 12, U0 = 7.55, U1 = 26.3, TAN = Math.tan(17 * Math.PI / 180);
let MOTES = null;
const DUST = [sink(FAM.magenta.base, 15, 0.3), sink(FAM.violet.base, 15, 0.25), sink(FAM.magenta.dark, 15, 0.2), sink(FAM.coral.base, 15, 0.35)];
// far haze clouds sunk toward the space medium (the soup was these at 18 % of all motes, light and big)
const HAZE = [sink(FAM.violet.base, 15, 0.7), sink(FAM.magenta.dark, 15, 0.6), sink(FAM.cyan.dark, 15, 0.65)];
const ICE = [sink(FAM.cyan.base, 15, 0.35), sink(FAM.violet.base, 15, 0.3), sink(FAM.cyan.dark, 15, 0.3)];
function build() {
  MOTES = []; const R = rng(51507);
  for (let u = U0; u < U1; u += 1 / NPD) {
    const uu = u + R() / NPD, cam = cameraAt(uu, 0), W = Math.pow(10, uu), D = cam.D;
    const rr = col(cam.M, 0), up = col(cam.M, 1), b = col(cam.M, 2);
    const ly = R(), haze = ly > 0.94, q = haze ? 1.6 + 0.8 * R() : ly < 0.4 ? 0.14 + 0.46 * R() : ly < 0.62 ? 0.7 + 0.25 * R() : 1.3 + 0.9 * R();
    let x = (R() * 2 - 1) * 1.1, y = (R() * 2 - 1) * 1.1;
    if (q < 0.65) { const m = Math.max(Math.abs(x), Math.abs(y)); if (m < 0.45) { const k = 0.45 / Math.max(m, 1e-3); x *= k; y *= k; } }
    // behind the focus: far enough off-axis that, zooming in toward this scale's focus, parallax carries the mote out of the
    // frame (angle → atan(x·q·tan17°/(q−1))); otherwise every larger scale's far layer would pile up behind the subject
    if (q > 1) { const g = q / (q - 1), m = Math.max(Math.abs(x), Math.abs(y)) * g; if (m < 1.08) { const k = 1.08 / Math.max(m, 1e-3); x *= k; y *= k; } }
    const d = q * D, hw = d * TAN, hh = hw * 0.625;
    const p = [0, 1, 2].map((j) => cam.pos[j] - b[j] * d + rr[j] * x * hw + up[j] * y * hh);
    const ice = !haze && R() < 0.45, pal = haze ? HAZE : ice ? ICE : DUST;
    // haze clouds: the far layer (true-limits/01, largest-star/07) — big, soft, low-contrast violet / magenta shapes
    const rho = haze ? W * (0.07 + 0.16 * R()) : W * (0.0022 + 0.011 * R() * R()) * (q < 0.65 ? 1.1 : q < 1.4 ? 0.7 : 1); // near bokeh smaller (a big near disc read as pasted)
    if (haze || q < 0.65) continue; // space v3: no near bokeh and no big haze clouds — nothing passes the lens or swings in and out of focus
    if (!clearOfPath(cam.fr, p, rho, uu)) continue;
    MOTES.push({ u: uu, q, fr: cam.fr, p, r: rho, col: pal[(R() * pal.length) | 0], kind: haze ? 2 : ice ? 1 : 0, v: (R() * 4) | 0, a: haze ? 0.12 + 0.08 * R() : 0.34 + 0.3 * R(), ph: R() * 6.283, rr, up, dw: W * 0.006 });
  }
}
// a mote must never fly through the lens: along the real camera path (z u−2 … u+0.6), while it is on screen it must stay
// smaller than 0.3 of the frame width (it then leaves the frame by parallax or shrinks, by geometry)
const PATHS = new Map();
function camSamples(u) { const k = Math.round(u * 50); let v = PATHS.get(k); if (!v) { const c = cameraAt(k / 50, 0); v = { fr: c.fr, pos: c.pos, r: col(c.M, 0), u: col(c.M, 1), b: col(c.M, 2) }; PATHS.set(k, v); } return v; }
function clearOfPath(fr, p, rho, u) {
  for (let z = 7.0; z <= u + 0.6; z += z > u - 1.2 ? 0.02 : 0.05) {
    const c = camSamples(z), q = sub(xform(p, fr, c.fr), c.pos), d = -dot(q, c.b); if (d <= 0) continue;
    const D = Math.pow(10, z) * 1.6356, mx = 0.04 * D / d, my = 0.025 * D / d; // the camera's drift orbit (±0.035, ±0.021 rad)
    const x = dot(q, c.r) / d, y = dot(q, c.u) / d, rr = rho / d; // tan-space
    if (Math.abs(x) - rr - mx < TAN && Math.abs(y) - rr - my < TAN * 0.625 && rr > 0.3 * TAN * 2) return false;
  }
  return true;
}
// built once, shortly after load (the camera keys exist by then), so the first zoom into space does not hitch
export function prebuildDust() { setTimeout(() => { try { if (!MOTES) build(); } catch (e) { MOTES = null; } }, 800); }
const BINS = [1.5, 6, 14, 1e9];
export function dustItems(V, items) {
  if (!MOTES) build();
  const groups = BINS.map(() => ({ list: [], ds: 0, bs: 0 })), t = V.t, f = V.f;
  for (const m of MOTES) {
    const dx = Math.sin(t * 0.06 + m.ph) * m.dw, dy = Math.cos(t * 0.045 + m.ph * 1.7) * m.dw; // a slow drift
    const P = [m.p[0] + m.rr[0] * dx + m.up[0] * dy, m.p[1] + m.rr[1] * dx + m.up[1] * dy, m.p[2] + m.rr[2] * dx + m.up[2] * dy];
    const cs = V.cs(m.fr, P), d = cs[2]; if (d <= V.near * 4) continue;
    const px = m.r * f / d; if (px < 0.3) continue;
    const [r, al] = pointLaw(px, 1.5), a = m.a * al; if (a < 0.02) continue;
    const sx = V.cx + cs[0] * f / d, sy = V.cy - cs[1] * f / d; if (!V.onScreen(sx, sy, r * 1.4 + 2)) continue;
    const bl = V.coc(d); let k = 0; while (bl >= BINS[k]) k++;
    const g = groups[k]; g.list.push([sx, sy, r, m.col, a, m.v, m.kind]); g.ds += Math.log(d); g.bs += bl;
  }
  groups.forEach((g, k) => {
    if (!g.list.length) return; const n = g.list.length, d = Math.exp(g.ds / n), L = g.list;
    items.push({ name: 'dust', d, blur: k === 0 ? 0 : g.bs / n, g: 0, draw(c) { screenSpace(c); for (const [x, y, r, cl, a, v, kind] of L) drawBlob(c, x, y, r, cl, a, v, kind); c.globalAlpha = 1; } });
  });
}
