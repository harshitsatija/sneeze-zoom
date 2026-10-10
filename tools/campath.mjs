// Camera path analyzer: pan (screen widths per decade) and rotation (deg per decade) along z, with/without drift.
// node tools/campath.mjs z0 z1 [--t=4.2] [--drift=1]
import { open, arg, positional } from './lib.mjs';
const [z0s, z1s] = positional(); const z0 = +z0s, z1 = +z1s, t = +arg('t', '4.2'), drift = arg('drift', '1') === '1';
const { browser, page } = await open({ w: 800, h: 500 });
const rows = await page.evaluate(async (z0, z1, t, drift) => {
  const cam = await import('/core/cam.js'); const W = await import('/core/world.js'); const A = await import('/core/anchors.js');
  cam.DRIFT.on = drift; A.updateFrames(t);
  const out = []; const dz = (z1 > z0 ? 1 : -1) * 0.01; let prev = null;
  for (let z = z0; (dz > 0 ? z <= z1 : z >= z1); z += dz) {
    const c = cam.cameraAt(z, t); const f = W.xform(c.focus, c.fr, 'muc'); // anything: use focus in camera frame of prev
    if (prev) {
      // where does the previous frame's centre point (prev focus) land in this camera, in screen widths?
      const pf = W.xform(prev.focus, prev.fr, c.fr); const v = [pf[0] - c.pos[0], pf[1] - c.pos[1], pf[2] - c.pos[2]];
      const M = c.M, r = [M[0], M[3], M[6]], u = [M[1], M[4], M[7]], b = [M[2], M[5], M[8]];
      const x = v[0] * r[0] + v[1] * r[1] + v[2] * r[2], y = v[0] * u[0] + v[1] * u[1] + v[2] * u[2], d = -(v[0] * b[0] + v[1] * b[1] + v[2] * b[2]);
      const pan = Math.hypot(x, y) / d * cam.KD; // in field widths
      // rotation between camera bases (both expressed in c.fr)
      const R = W.rot(prev.fr, c.fr); const pb = [R[0] * prev.M[2] + R[1] * prev.M[5] + R[2] * prev.M[8], R[3] * prev.M[2] + R[4] * prev.M[5] + R[5] * prev.M[8], R[6] * prev.M[2] + R[7] * prev.M[5] + R[8] * prev.M[8]];
      const rotd = Math.acos(Math.min(1, pb[0] * b[0] + pb[1] * b[1] + pb[2] * b[2])) * 180 / Math.PI;
      out.push([+z.toFixed(2), pan / 0.01, rotd / 0.01]);
    }
    prev = c;
  }
  return out;
}, z0, z1, t, drift);
await browser.close();
// summarize per 0.5-decade bins
const bins = new Map(); for (const [z, p, r] of rows) { const k = Math.round(z * 2) / 2; const B = bins.get(k) || { p: 0, pm: 0, r: 0, n: 0 }; B.p += p; B.pm = Math.max(B.pm, p); B.r += r; B.n++; bins.set(k, B); }
console.log('z      pan(avg,max widths/decade)   rot(deg/decade)');
for (const [k, B] of [...bins].sort((a, b) => b[0] - a[0])) console.log(k.toFixed(1).padStart(6), (B.p / B.n).toFixed(2).padStart(7), B.pm.toFixed(2).padStart(7), (B.r / B.n).toFixed(1).padStart(8), '#'.repeat(Math.min(60, Math.round(B.pm * 10))));
