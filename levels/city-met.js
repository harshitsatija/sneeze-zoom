// The Met's Fifth Avenue front as real 3D geometry in the street frame (metres): Hunt facade (4 paired-column groups,
// 3 arched bays, entablature, cornice, the 4 uncarved attic blocks), exhibition banners, the grand steps with people
// sitting on them, the two plaza fountains with jets. Footprint planes come from the NYC footprint / 3D model tiers
// (central front z = -23.45, wings z = -25, end pavilions z = -13.5). Steps: no survey exists, proportions are approximate.
import { PAL, mix } from '../core/kit.js';
import { COL, proj } from './city-geo.js';
import { rng } from '../core/m.js';

const ZC = -23.36, ZW = -24.7, ZE = -12.75;            // facade planes (central pavilion, wings, end pavilions)
export const STEP = { z0: -8.5, n: 16, rise: 0.16, run: 0.52, x0: -30.6, x1: 30.6 };
export const LAND = STEP.n * STEP.rise;                  // 3.6 m: the entrance level
const ZTOP = STEP.z0 - STEP.n * STEP.run;                // -16.8: top step edge

// a face = { p: [x,y,z,...], n: [nx,ny,nz], c: colour }
const disc = (xc, yc, r, n = 18) => { const p = []; for (let i = 0; i < n; i++) { const a = 6.2832 * i / n; p.push(xc + r * Math.cos(a), yc + r * Math.sin(a)); } return p; };
const F = (p, n, c) => ({ p, n, c });
function box(x0, x1, y0, y1, z0, z1, cf, ct, cl, cr, cb) {
  const out = [];
  if (cb) out.push(F([x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], [0, -1, 0], cb));
  if (cl) out.push(F([x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [-1, 0, 0], cl));
  if (cr) out.push(F([x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [1, 0, 0], cr));
  if (ct) out.push(F([x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0], [0, 1, 0], ct));
  if (cf) out.push(F([x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1], cf));
  return out;
}
// flat shape on a facade plane z (points in x,y)
function onWall(xy, z, c) { const p = []; for (let i = 0; i < xy.length; i += 2) p.push(xy[i], xy[i + 1], z); return F(p, [0, 0, 1], c); }
function arch(xc, hw, y0, ys, seg = 10) { const p = [xc - hw, y0, xc + hw, y0, xc + hw, ys]; for (let i = 1; i < seg; i++) { const a = Math.PI * i / seg; p.push(xc + hw * Math.cos(a), ys + hw * Math.sin(a)); } p.push(xc - hw, ys); return p; }
const rect = (x0, x1, y0, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];

// ---------- build ----------
const LAYERS = []; // drawn in order; faces inside a layer never overlap each other
{
  // the bays: a warm, lit interior behind glass rather than a black hole (it sits right behind his head at street scale)
  const lit = COL.metLit, mid = COL.metMid, sh = COL.metShade, dk = mix(COL.metDark, COL.metMid, 0.38), top = mix(COL.metLit, PAL.ice, 0.3);
  const L0 = [], L1 = [], L2 = [], L3 = [], L4 = [], L5 = [];
  const pairs = [-27.4, -9.15, 9.15, 27.4], bays = [-18.27, 0, 18.27];
  // central pavilion: rusticated base band behind the landing, 3 arched bays (dark), doors, lunette mullions
  L0.push(onWall(rect(-31.9, 31.9, LAND, LAND + 0.9), ZC + 0.04, mid));
  for (const b of bays) {
    L0.push(onWall(arch(b, 4.3, LAND + 0.4, 13.6, 14), ZC + 0.06, dk));
    L1.push(onWall(rect(b - 3.3, b + 3.3, LAND + 0.4, 8.6), ZC + 0.09, mix(dk, PAL.road, 0.5)));          // doors
    L1.push(onWall(rect(b - 4.3, b + 4.3, 8.6, 9.2), ZC + 0.09, mid));                                    // transom bar
    for (const dx of [-1.45, 1.45]) L1.push(onWall(rect(b + dx - 0.12, b + dx + 0.12, 9.2, 17.2), ZC + 0.09, COL.glass)); // mullions
    L1.push(onWall(rect(b - 0.55, b + 0.55, 17.0, 18.3), ZC + 0.09, lit));                                // keystone
  }
  // wings: tall arched windows + cornice band
  for (const s of [-1, 1]) {
    for (let x = 36.5; x < 86; x += 5.6) L0.push(onWall(arch(s * x, 1.25, 6.0, 12.6, 8), ZW + 0.06, dk));
    for (let x = 36.5; x < 86; x += 5.6) L0.push(onWall(rect(s * x - 1.0, s * x + 1.0, 15.0, 18.0), ZW + 0.06, dk));
    L1.push(...box(Math.min(s * 32.2, s * 89.6), Math.max(s * 32.2, s * 89.6), 19.6, 20.6, ZW, ZW + 0.7, lit, top, mid, sh, dk));
    // end pavilions (McKim, Mead & White): three tall arched windows, pilaster strips
    const c = s * 121;
    for (const dx of [-14, 0, 14]) L0.push(onWall(arch(c + dx, 2.4, 5.0, 15.5, 10), ZE + 0.06, dk));
    for (const dx of [-21, -7, 7, 21]) L1.push(...box(c + dx - 0.8, c + dx + 0.8, 1.0, 20.5, ZE, ZE + 0.45, lit, top, mid, sh, null));
    L1.push(...box(Math.min(s * 89.2, s * 152.4), Math.max(s * 89.2, s * 152.4), 20.5, 21.6, ZE, ZE + 0.8, lit, top, mid, sh, dk));
  }
  // banners hanging in front of the three bays (the Met's exhibition banners)
  // three tall banners, one per bay, hung above the doors (big simple shapes that still read under heavy blur)
  const ban = [PAL.virus, PAL.virusMesa, PAL.taxi], motif = [PAL.taxi, PAL.virus, PAL.virus];
  bays.forEach((b, i) => { const c = ban[i], zf = ZC + 0.95, y0 = LAND + 3.6, y1 = 19.3, hw = 2.1;
    L2.push(...box(b - hw, b + hw, y0, y1, zf - 0.15, zf, c, c, mix(c, PAL.ice, 0.2), mix(c, PAL.bodyDeep, 0.35), mix(c, PAL.bodyDeep, 0.5)));   // cloth with thickness
    L3.push(onWall(rect(b - hw, b + hw, y0, y0 + 1.4), zf + 0.02, mix(c, PAL.bodyDeep, 0.3)));                                                   // dark foot band
    L3.push(onWall(rect(b + hw - 0.6, b + hw, y0 + 1.4, y1), zf + 0.02, mix(c, PAL.bodyDeep, 0.18)));                                           // fold in shadow (away from the light)
    L3.push(onWall(disc(b + 0.2, 12.4, 1.35), zf + 0.02, motif[i]));                                                                             // the exhibition's graphic
    L3.push(onWall(rect(b - hw + 0.6, b + hw - 0.5, 16.6, 17.3), zf + 0.02, mix(c, PAL.ice, 0.6)));                                           // title bar
    L3.push(...box(b - hw - 0.3, b + hw + 0.3, y1, y1 + 0.3, zf - 0.2, zf + 0.15, PAL.shoe, PAL.shoe, PAL.shoe, PAL.shoe, PAL.shoe)); });       // hanging rod
  // paired Corinthian columns on pedestals
  for (const xc of pairs) {
    L3.push(...box(xc - 2.25, xc + 2.25, LAND, LAND + 2.6, ZC, ZC + 2.1, lit, top, mid, sh, null));
    for (const dx of [-1.12, 1.12]) {
      L4.push(...box(xc + dx - 0.72, xc + dx + 0.72, LAND + 2.6, 18.2, ZC + 0.25, ZC + 1.75, lit, null, mid, sh, null));
      L4.push(...box(xc + dx - 0.95, xc + dx + 0.95, 18.2, 19.5, ZC + 0.1, ZC + 1.9, mix(lit, PAL.ice, 0.4), top, mid, sh, dk));
    }
  }
  // entablature (breaking forward over each pair), cornice, attic blocks
  L5.push(...box(-32.0, 32.0, 19.5, 22.4, ZC, ZC + 0.6, mid, top, mid, sh, dk));
  for (const xc of pairs) L5.push(...box(xc - 2.35, xc + 2.35, 19.5, 22.4, ZC + 0.6, ZC + 2.0, lit, top, mid, sh, dk));
  const L6 = [];
  L6.push(...box(-32.4, 32.4, 22.4, 23.2, ZC, ZC + 1.1, lit, top, mid, sh, mix(sh, dk, 0.5)));
  for (const xc of pairs) L6.push(...box(xc - 2.5, xc + 2.5, 22.4, 23.3, ZC + 1.1, ZC + 2.3, lit, top, mid, sh, mix(sh, dk, 0.5)));
  for (const xc of pairs) L6.push(...box(xc - 1.9, xc + 1.9, 23.3, 29.6, ZC + 0.4, ZC + 1.9, lit, top, mid, sh, null));
  LAYERS.push(L0, L1, L2, L3, L4, L5, L6);
}

// ---------- every static face, for the GL renderer (facade layers, steps, landing, cheek walls, fountains) ----------
const TREAD = mix(COL.stepR, COL.stepT, 0.5);
export function metFaces() {
  const out = [];
  for (const L of LAYERS) out.push(...L);
  // steps: treads (up) + risers (toward the street)
  for (let k = STEP.n - 1; k >= 0; k--) { const zf = STEP.z0 - k * STEP.run, zb = zf - STEP.run, y0 = k * STEP.rise, y1 = y0 + STEP.rise;
    out.push(F([STEP.x0, y1, zf, STEP.x1, y1, zf, STEP.x1, y1, zb, STEP.x0, y1, zb], [0, 1, 0], TREAD));
    out.push(F([STEP.x0, y0, zf, STEP.x1, y0, zf, STEP.x1, y1, zf, STEP.x0, y1, zf], [0, 0, 1], COL.stepR)); }
  out.push(F([STEP.x0 - 1, LAND, ZTOP, STEP.x1 + 1, LAND, ZTOP, STEP.x1 + 1, LAND, ZC, STEP.x0 - 1, LAND, ZC], [0, 1, 0], COL.stepT));
  for (const sg of [-1, 1]) { const xi = sg * STEP.x1, xo = sg * (STEP.x1 + 1.0), yb = 0.9;
    out.push(F([xi, 0, STEP.z0, xi, yb, STEP.z0, xi, LAND + yb, ZTOP, xi, LAND + yb, ZC, xi, 0, ZC], [-sg, 0, 0], sg < 0 ? COL.metShade : COL.metMid));
    out.push(F([xo, 0, STEP.z0, xo, yb, STEP.z0, xo, LAND + yb, ZTOP, xo, LAND + yb, ZC, xo, 0, ZC], [sg, 0, 0], sg < 0 ? COL.metMid : COL.metShade));
    out.push(F([xi, 0, STEP.z0, xo, 0, STEP.z0, xo, yb, STEP.z0, xi, yb, STEP.z0], [0, 0, 1], COL.metLit));
    const sl = LAND / (STEP.z0 - ZTOP);
    out.push(F([xi, yb, STEP.z0, xo, yb, STEP.z0, xo, LAND + yb, ZTOP, xi, LAND + yb, ZTOP], [0, 1, sl], COL.stoneTop));
    out.push(F([xi, LAND + yb, ZTOP, xo, LAND + yb, ZTOP, xo, LAND + yb, ZC, xi, LAND + yb, ZC], [0, 1, 0], COL.stoneTop)); }
  // fountains: granite basin walls, rim, water
  for (const fo of FOUNT) { const h = 0.62, w = 0.55, { x0, x1, z0, z1 } = fo;
    out.push(...box(x0, x1, 0, h, z0, z1, COL.stone, null, mix(COL.stone, COL.stoneTop, 0.3), mix(COL.stone, PAL.road, 0.2), null));
    out.push(F([x0, h, z1, x1, h, z1, x1, h, z1 - w, x0, h, z1 - w], [0, 1, 0], COL.stoneTop), F([x0, h, z0 + w, x1, h, z0 + w, x1, h, z0, x0, h, z0], [0, 1, 0], COL.stoneTop));
    out.push(F([x0, h, z1 - w, x0 + w, h, z1 - w, x0 + w, h, z0 + w, x0, h, z0 + w], [0, 1, 0], COL.stoneTop), F([x1 - w, h, z1 - w, x1, h, z1 - w, x1, h, z0 + w, x1 - w, h, z0 + w], [0, 1, 0], COL.stoneTop));
    out.push(F([x0 + w, h - 0.1, z1 - w, x1 - w, h - 0.1, z1 - w, x1 - w, h - 0.1, z0 + w, x0 + w, h - 0.1, z0 + w], [0, 1, 0], COL.water));
    // inner walls of the basin (visible from above)
    out.push(F([x0 + w, h - 0.1, z0 + w, x1 - w, h - 0.1, z0 + w, x1 - w, h, z0 + w, x0 + w, h, z0 + w], [0, 0, 1], mix(COL.stone, PAL.road, 0.25)));
  }
  return out;
}

// ---------- people sitting on the steps (front-facing, the same character kit) ----------
// three near the middle (part of the street-scale cast), the rest far out along the steps (they only matter from above)
export const SITTERS = []; { const r = rng(4711); const cols = [PAL.mac, PAL.wall, PAL.tcell, PAL.virus, PAL.protein2, PAL.macDark, PAL.tcellRim, PAL.taxi];
  const put = (step, x, col) => { const zf = STEP.z0 - step * STEP.run; SITTERS.push({ step, x, y: (step + 1) * STEP.rise, z: zf - STEP.run / 2 + 0.12, coat: col, pants: ['#2a2a7a', '#3a2a6a', '#4a2050'][(r() * 3) | 0], skin: (r() * 4) | 0, s: 0.92 + r() * 0.14, lean: 0 }); };
  put(10, -1.5, PAL.virus); put(12, 2.7, PAL.tcell); put(8, -6.6, PAL.protein2);
  for (let k = 0; k < 22; k++) { let x = 13 + r() * 16; if (r() < 0.5) x = -x; put(2 + ((r() * 13) | 0), x, cols[(r() * cols.length) | 0]); } }

// ---------- fountains: jets (animated, Canvas2D) ----------
export const FOUNT = [[-45.2, -32.3], [32.3, 45.2]].map(([x0, x1]) => ({ x0, x1, z0: -17.0, z1: -3.1, xm: (x0 + x1) / 2 }));
export function drawJets(c, C, fo, t) {
  const h = 0.62; c.strokeStyle = PAL.spec; c.lineCap = 'round';
  for (let z = fo.z1 - 1.4, i = 0; z > fo.z0 + 1.2; z -= 1.15, i++) {
    const hh = 1.2 + 0.35 * Math.sin(t * 2.1 + i * 0.9), a = proj(C, fo.xm, h - 0.1, z), b = proj(C, fo.xm, h + hh, z); if (a[2] <= C.near || b[2] <= C.near) continue;
    const wpx = 0.09 * C.f / a[2]; if (wpx < 0.25) continue; c.lineWidth = Math.max(0.6, wpx); c.globalAlpha = 0.8; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  }
  c.globalAlpha = 1;
}
export const MET_FRONT = { ZC, ZW, ZE };
