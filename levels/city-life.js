// Street life: trees (real census positions and canopy radii), Fifth Avenue traffic (southbound), pedestrians,
// people sitting on the Met steps. Kurzgesagt flat shapes. Every standing thing is a cross-billboard: a vertical cutout
// (side view) + a horizontal top cutout (seen from above), each edge-on in the view where it would look wrong.
import { PAL, mix, blob, T, UL } from '../core/kit.js';
import { personPal, crowdPose, drawPerson, drawSitterFig } from './hero-figure.js';
import { G, COL, proj, depthOf, addPoly3 } from './city-geo.js';
import { rng, clamp } from '../core/m.js';

// light in a layer's own unit space from a screen-space light direction
export function setUL(A, Ls) { const det = A.a * A.d - A.b * A.c; if (!det) return; const x = (A.d * Ls[0] - A.c * Ls[1]) / det, y = (-A.b * Ls[0] + A.a * Ls[1]) / det, l = Math.hypot(x, y) || 1; UL[0] = x / l; UL[1] = y / l; }

// ---------- trees ----------
// one canopy recipe at every size: dark silhouette, base fill pushed toward the light, light cap (stacked flat fills).
// Small trees are circles; above 10 px the outline gains wobble continuously (0 at 10 px), so there is no visible switch.
export const LOBES = [[0, 0, 1], [-0.47, -0.3, 0.6], [0.5, -0.36, 0.54]];
const circ = (P, x, y, r) => { P.moveTo(x + r, y); P.arc(x, y, r, 0, 6.2832); };
export function treeBatch(Pd, Pb, Pl, x, y, r, lx, ly) {
  for (let k = 0; k < 3; k++) { const L = LOBES[k], cx = x + L[0] * r, cy = y + L[1] * r, rr = L[2] * r;
    circ(Pd, cx, cy, rr); if (Pb) circ(Pb, cx + lx * 0.12 * rr, cy + ly * 0.12 * rr, 0.88 * rr); if (Pl) circ(Pl, cx + lx * 0.36 * rr, cy + ly * 0.36 * rr, 0.42 * rr); }
}
export function treeBig(c, x, y, r, lx, ly, seed) {
  const wob = Math.round(clamp((r - 10) / 25, 0, 1) * 10) / 100;
  const Pd = new Path2D(), Pb = new Path2D(), Pl = new Path2D();
  for (let k = 0; k < 3; k++) { const L = LOBES[k], cx = x + L[0] * r, cy = y + L[1] * r, rr = L[2] * r, b = wob > 0 ? blob(seed + k, wob, 5) : null;
    const add = (P, ox, oy, s) => { if (b) P.addPath(b, new DOMMatrix([rr * s, 0, 0, rr * s, cx + ox * rr, cy + oy * rr])); else circ(P, cx + ox * rr, cy + oy * rr, rr * s); };
    add(Pd, 0, 0, 1); add(Pb, lx * 0.12, ly * 0.12, 0.88); add(Pl, lx * 0.36, ly * 0.36, 0.42); }
  c.fillStyle = COL.canopyDark; c.fill(Pd); c.fillStyle = COL.canopy; c.fill(Pb); c.fillStyle = COL.canopyLit; c.fill(Pl);
}
export function trunk(c, C, x, z, h, w) {
  const rl = Math.hypot(C.r0, C.r2) || 1, ax = C.r0 / rl * w, az = C.r2 / rl * w, P = new Path2D();
  addPoly3(P, C, [x - ax * 1.4, 0, z - az * 1.4, x + ax * 1.4, 0, z + az * 1.4, x + ax, h, z + az, x - ax, h, z - az]); c.fillStyle = COL.trunk; c.fill(P);
}

// ---------- vehicles (metres, front toward +x, y up) ----------
const P = (d) => new Path2D(d);
const RR = (x0, y0, x1, y1, r) => { const p = new Path2D(); p.roundRect(x0, y0, x1 - x0, y1 - y0, r); return p; };
const SEDAN = P('M -2.4 0.3 L -2.42 0.86 C -2.4 0.99 -2.22 1.03 -1.95 1.05 L -1.28 1.08 L -0.78 1.45 C -0.62 1.52 0.48 1.53 0.74 1.46 L 1.33 1.1 L 2.1 1.01 C 2.36 0.97 2.43 0.86 2.43 0.7 L 2.41 0.3 Z');
const SEDAN_WIN = P('M -1.12 1.1 L -0.7 1.4 L -0.12 1.41 L -0.12 1.1 Z M 0.0 1.1 L 0.0 1.41 L 0.66 1.4 L 1.17 1.1 Z');
const SUV = P('M -2.45 0.32 L -2.47 1.06 C -2.45 1.2 -2.32 1.25 -2.12 1.27 L -1.98 1.82 C -1.92 1.89 1.0 1.9 1.14 1.84 L 1.74 1.3 L 2.2 1.19 C 2.4 1.13 2.47 1.0 2.47 0.86 L 2.45 0.32 Z');
const SUV_WIN = P('M -1.85 1.3 L -1.75 1.76 L -0.55 1.77 L -0.55 1.3 Z M -0.42 1.3 L -0.42 1.77 L 1.0 1.77 L 1.5 1.3 Z');
const BUS = RR(-6.1, 0.32, 6.1, 3.15, 0.35);
const BUS_WIN = (() => { const p = new Path2D(); for (let x = -5.6; x < 3.6; x += 1.55) p.rect(x, 1.55, 1.32, 1.1); p.roundRect(4.75, 1.0, 1.2, 1.75, 0.15); return p; })();
const BUS_BAND = RR(-6.1, 1.18, 6.1, 1.42, 0.05);
const KINDS = [
  { body: SEDAN, win: SEDAN_WIN, wheels: [[-1.45, 0.34], [1.45, 0.34]], L: 4.85, W: 1.82, H: 1.5 },
  { body: SUV, win: SUV_WIN, wheels: [[-1.5, 0.36], [1.5, 0.36]], L: 4.9, W: 1.95, H: 1.88 },
  { body: BUS, win: BUS_WIN, wheels: [[-3.7, 0.5], [4.0, 0.5]], L: 12.2, W: 2.55, H: 3.15 },
];
const CAR_COLS = [PAL.ice, PAL.tcell, PAL.mac, PAL.protein2, PAL.wall, PAL.virusMesa, PAL.macDark];
export const FIFTH_LANES = [7.75, 11.2, 14.65, 18.1];
// Fifth Avenue is southbound (toward -x). The light at the E 82nd St crosswalk (x ≈ +7) is red for the whole 12 s
// session: cars arriving from upstream roll up and queue behind the stop line, the cars that already crossed drive away.
// So nothing ever drives between the camera and the man (who stands between the two crosswalks).
export const STOP_X = 10.0, CLEAR_X = -12.0;
export const CARS = []; { const r = rng(9091);
  FIFTH_LANES.forEach((z, li) => { const v = [10.5, 9.0, 8.0, 6.5][li]; const lane = [];
    const add = (x, up) => { const bus = li === 3 && r() < 0.5, kind = bus ? 2 : (r() < 0.22 ? 1 : 0), taxi = !bus && kind === 0 && r() < 0.72;
      const col = bus ? PAL.ice : taxi ? PAL.taxi : CAR_COLS[(r() * CAR_COLS.length) | 0];
      const c = { z: z + (r() - 0.5) * 0.35, x0: x, v, kind, col, taxi, bus, up, idle: r() * 6.28 }; lane.push(c); CARS.push(c); return KINDS[kind].L; };
    for (let x = STOP_X + 4 + r() * 20; x < 9000;) x += add(x, true) + 6 + r() * 34;   // ~15 minutes of arrivals from upstream
    for (let x = CLEAR_X - 4 - r() * 10; x > -420;) x -= add(x, false) + 8 + r() * 36;
    // queue slots for the upstream cars, nearest the stop line first
    let q = STOP_X; lane.filter((c) => c.up).sort((a, b) => a.x0 - b.x0).forEach((c) => { const L = KINDS[c.kind].L; c.q = q + L / 2; q += L + 1.6; }); }); }
export function carX(cr, t) { const x = cr.x0 - cr.v * t; return cr.up ? Math.max(x, cr.q) : x; }   // continuous in time (no loop wrap)
// side cutout (vertical plane through the car's near side) + plan at roof height
export function drawCarSide(c, A, cr, Ls) {
  const K = KINDS[cr.kind]; T(c, A); setUL(A, Ls); c.scale(-1, 1); // southbound: front toward -x
  const sh = cr.taxi ? PAL.taxiShade : mix(cr.col, PAL.bodyDeep, 0.3);
  c.fillStyle = cr.col; c.fill(K.body);
  c.save(); c.clip(K.body); c.fillStyle = sh; c.fillRect(-7, 0, 14, cr.bus ? 1.0 : 0.62); c.restore();             // lower body in shade
  if (cr.bus) { c.fillStyle = PAL.tcell; c.fill(BUS_BAND); }
  c.fillStyle = cr.bus ? mix(PAL.tcellCore, PAL.tcell, 0.3) : PAL.tcellCore; c.fill(K.win);
  if (cr.taxi) { c.fillStyle = PAL.glowHot; c.fillRect(-0.32, 1.52, 0.64, 0.15); }
  c.fillStyle = PAL.shoe; for (const [x, r] of K.wheels) { c.beginPath(); c.arc(x, r, r, 0, 6.2832); c.fill(); }
  c.fillStyle = mix(PAL.shoe, PAL.curb, 0.45); for (const [x, r] of K.wheels) { c.beginPath(); c.arc(x, r, r * 0.42, 0, 6.2832); c.fill(); }
  c.fillStyle = PAL.glowHot; c.fillRect(K.L / 2 - 0.12, cr.bus ? 0.8 : 0.72, 0.12, 0.14); c.fillStyle = PAL.virus; c.fillRect(-K.L / 2, cr.bus ? 0.8 : 0.74, 0.1, 0.14);
}
export function drawCarTop(c, A, cr, Ls) {
  const K = KINDS[cr.kind]; T(c, A); setUL(A, Ls); c.scale(-1, 1);
  const hl = K.L / 2, hw = K.W / 2;
  c.fillStyle = cr.taxi ? PAL.taxiShade : mix(cr.col, PAL.bodyDeep, 0.25); c.beginPath(); c.roundRect(-hl, -hw, K.L, K.W, 0.35); c.fill();
  c.fillStyle = cr.col; c.beginPath(); c.roundRect(-hl + 0.08, -hw + 0.08, K.L - 0.16, K.W - 0.16, 0.3); c.fill();
  if (cr.bus) { c.fillStyle = mix(PAL.ice, PAL.roofShade, 0.35); c.fillRect(-3.5, -0.7, 2.2, 1.4); c.fillRect(0.5, -0.7, 2.0, 1.4); return; }
  c.fillStyle = PAL.tcellCore; c.beginPath(); c.moveTo(0.55, -hw + 0.18); c.lineTo(1.25, -hw + 0.12); c.lineTo(1.25, hw - 0.12); c.lineTo(0.55, hw - 0.18); c.fill();
  c.fillRect(-1.5, -hw + 0.2, 0.45, K.W - 0.4);
  c.fillStyle = mix(cr.col, PAL.ice, 0.25); c.fillRect(-1.05, -hw + 0.22, 1.6, K.W - 0.44);
  if (cr.taxi) { c.fillStyle = PAL.glowHot; c.fillRect(-0.3, -0.35, 0.6, 0.7); }
}
export const kindOf = (cr) => KINDS[cr.kind];

// ---------- people: the SAME character kit as the man (levels/hero-figure.js), simpler, tinted toward the background ----------
// At street scale the cast is small and placed: 9 people at mid (plaza) and far (steps) depth, all behind the man and
// never crossing his silhouette; they stand, talk, look at a phone, take a photo (idle acting, no walking). The long
// sidewalk lanes (far up and down the avenue) only matter from the air, where they are a few pixels each.
export const TINT = '#b8a2d4';                                      // the blurred plaza / limestone tone behind him
const COATS = [PAL.mac, PAL.wall, PAL.tcell, PAL.protein2, PAL.taxi, PAL.virusMesa, PAL.macDark, PAL.neuSpike];
const PANTS = [PAL.pants, '#3a2a6a', '#2a3a7a', '#4a2050', '#1f2f5a'];
export const PEDS = []; { const r = rng(5150);
  const lanes = [[2.2, 5.4, 60], [20.9, 25.6, 60]]; // west plaza far up/down the avenue, east sidewalk
  lanes.forEach(([za, zb, n], li) => { for (let k = 0; k < n; k++) { const stand = r() < 0.08; const sp = 840 / n, x0 = (k + 0.15 + r() * 0.7) * sp;
    PEDS.push({ z: za + (zb - za) * r(), x0, dir: k % 2 ? -1 : 1, v: stand ? 0 : 1.1 + r() * 0.5, h: 1.58 + r() * 0.26, coat: COATS[(r() * COATS.length) | 0], pants: PANTS[(r() * PANTS.length) | 0], skin: (r() * 4) | 0, hair: (r() * 3) | 0, stand, ph: r() * 6.28, Lr: 840, tk: 0.3,
      pp: { c: (k % 2 ? -1 : 1) * (44 + r() * 360), L: 20 + r() * 10 } }); } });
  // the street-scale cast (x, z, facing, act, coat, hair, skin, height, y = standing on a step)
  const step = (k) => ({ z: -8.5 - k * 0.52 - 0.26, y: (k + 1) * 0.16 });
  for (const [x, z, dir, act, coat, hair, skin, h, y] of [
    [-2.35, -4.4, 1, 'talk', PAL.tcell, 0, 1, 1.76, 0], [-1.6, -4.8, -1, 'talk', PAL.mac, 1, 0, 1.66, 0],
    [1.75, -3.7, -1, 'phone', PAL.protein2, 2, 2, 1.7, 0], [3.4, -6.3, 1, 'stand', PAL.wall, 0, 3, 1.82, 0],
    [-4.8, -5.7, 1, 'photo', PAL.taxi, 1, 1, 1.64, 0],
    [-3.5, step(4).z, -1, 'stand', PAL.virusMesa, 0, 0, 1.74, step(4).y], [5.3, step(7).z, 1, 'talk', PAL.macDark, 2, 2, 1.68, step(7).y]]) {
    PEDS.push({ fixed: x, z, dir, v: 0, stand: true, act, h, y, coat, pants: PANTS[(r() * PANTS.length) | 0], skin, hair, ph: r() * 6.28, tk: y > 0 ? 0.36 : 0.22, cast: true }); } }
export function pedX(p, t) {
  if (p.fixed !== undefined) { p.cd = p.dir; return p.fixed; }
  if (p.pp) { const u = ((p.x0 + p.v * t) % (4 * p.pp.L) + 4 * p.pp.L) % (4 * p.pp.L), fwd = u < 2 * p.pp.L; p.cd = fwd ? 1 : -1; return p.pp.c - p.pp.L + (fwd ? u : 4 * p.pp.L - u); }
  p.cd = p.dir; const x = (p.x0 + p.dir * p.v * t) % p.Lr; return (x < 0 ? x + p.Lr : x) - p.Lr / 2; }
const pxPerUnit = (c) => { const m = c.getTransform(); return Math.hypot(m.a, m.b); };
// a person in profile, in their own drawing units (metres, feet at 0, facing +x)
export function drawWalker(c, p, t) {
  if (!p.pal) p.pal = personPal(p, TINT, p.tk);
  const px = pxPerUnit(c) * p.h, lod = px < 40 ? 0 : 1;
  if (p.y) c.translate(0, p.y);
  const walk = p.stand ? 0 : 0.34 * Math.sin(p.ph + (p.v * t) / 0.7 * Math.PI);
  if (px < 6) { // a few pixels: the same silhouette, flat (no inner detail is resolvable)
    c.fillStyle = p.pal.pants; c.fillRect(-0.09, 0, 0.18, 0.5 * p.h); c.fillStyle = p.pal.coat; c.beginPath(); c.roundRect(-0.15, 0.48 * p.h, 0.28, 0.36 * p.h, 0.08); c.fill();
    c.fillStyle = p.pal.hairShade; c.beginPath(); c.arc(0, 0.92 * p.h, 0.12, 0, 6.2832); c.fill(); return; }
  drawPerson(c, p, p.pal, walk ? { arm: [0, 0, 0] } : crowdPose(p, t), lod, walk);
}
export function drawPedTop(c, p) { // seen from above: shoulders + head (unit metres; x = walking direction)
  if (p.y) return; if (!p.pal) p.pal = personPal(p, TINT, p.tk);
  c.fillStyle = p.pal.coatShade; c.beginPath(); c.ellipse(0, 0, 0.13, 0.24, 0, 0, 6.2832); c.fill();
  c.fillStyle = p.pal.coat; c.beginPath(); c.ellipse(-0.01, 0, 0.11, 0.21, 0, 0, 6.2832); c.fill();
  c.fillStyle = p.pal.hairShade; c.beginPath(); c.arc(0.0, 0, 0.1, 0, 6.2832); c.fill();
}
// a person sitting on a step, seen from the front (cutout in the x-y plane), seat at y = 0
export function drawSitter(c, s) {
  if (!s.pal) s.pal = personPal(s, TINT, 0.38);
  drawSitterFig(c, s, s.pal, pxPerUnit(c) > 30 ? 1 : 0);
}
