// Fifth Avenue at the Met → Upper East Side → Manhattan, from real data (NYC footprints + 3D-model roof tiers, NYC
// planimetrics, 2015 street-tree census, OSM, PLUTO; see assets/geo/SOURCES.md and assets/city/SOURCES.md).
// Street frame: x = uptown (screen right in the side view), y = up, z = toward the side-view camera (ESE). The man
// stands at the origin on the Met plaza, 6.0 m from the Fifth Avenue curb, 23.4 m in front of the Hunt facade.
// Static 3D (buildings, the Met, trees, the park wall, Manhattan blocks) is real geometry rendered by city-gl.js in
// depth slices; ground details (g = -1), people, cars and fountain jets are Canvas2D. No backdrops except the real sky.
import { PAL, mix, screenSpace } from '../core/kit.js';
import { clamp } from '../core/m.js';
import { G, COL, loadCity, camOf, proj, depthOf, addPoly3, addRingY, addLineY, sphPx, lightAt } from './city-geo.js';
import { metFaces, SITTERS, FOUNT, drawJets } from './city-met.js';
import { setUL, CARS, carX, drawCarSide, drawCarTop, kindOf, PEDS, pedX, drawWalker, drawPedTop, drawSitter } from './city-life.js';
import { blockMode } from './city-blocks.js';
import { GL, initGL, renderSlice, setBlockState, sliceHas } from './city-gl.js';
import { basis } from '../core/cam.js';

// camera: once past the Fifth Ave tree line the crane rises quickly above the E 82nd St tree crowns (28° by z 1.28),
// so no canopy ever comes between the camera and the man (line-of-sight clearance >= 1.6 crown radii, checked numerically)
const PITCH = (deg) => { const p = deg * Math.PI / 180; return basis([0, Math.sin(p), Math.cos(p)], [0, 1, 0]); };

// ---------- static ground details (built once) ----------
let STATIC = null;
function buildStatic() {
  const S = { dash: [], zebra: [], bus: null };
  const crossX = [];
  for (const cw of G.crossings) {
    const L = cw.line, n = L.length >> 1, ax = L[0], az = L[1], bx = L[2 * n - 2], bz = L[2 * n - 1], len = Math.hypot(bx - ax, bz - az); if (len < 2) continue;
    const ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux, hw = Math.max(1.5, cw.w / 2);
    if (Math.abs((ax + bx) / 2) < 170 && (az + bz) / 2 < 5.5 && (az + bz) / 2 > -40) continue; // OSM 'crossings' drawn on the Met plaza itself are not painted
    if (Math.abs(uz) > 0.8 && Math.min(az, bz) < 8 && Math.max(az, bz) > 17) crossX.push((ax + bx) / 2);
    for (let s = 0.6; s < len - 0.4; s += 1.2) { const cx = ax + ux * s, cz = az + uz * s, w = 0.32;
      S.zebra.push([cx - ux * w - nx * hw, 0, cz - uz * w - nz * hw, cx + ux * w - nx * hw, 0, cz + uz * w - nz * hw, cx + ux * w + nx * hw, 0, cz + uz * w + nz * hw, cx - ux * w + nx * hw, 0, cz - uz * w + nz * hw]); }
  }
  for (const lz of [9.47, 12.92]) for (let x = -414; x < 414; x += 12) { if (crossX.some((cx) => Math.abs(cx - x - 1.5) < 13)) continue;
    S.dash.push([x, 0, lz - 0.07, x + 3, 0, lz - 0.07, x + 3, 0, lz + 0.07, x, 0, lz + 0.07]); }
  S.busLine = []; let x0 = -414; const xs = crossX.slice().sort((a, b) => a - b); S.bus = [];
  for (const cx of xs.concat([414 + 13])) { const x1 = Math.min(414, cx - 13); if (x1 > x0 + 3) { S.bus.push([x0, 0, 16.5, x1, 0, 16.5, x1, 0, 19.7, x0, 0, 19.7]); S.busLine.push([x0, 0, 16.3, x1, 0, 16.3, x1, 0, 16.5, x0, 0, 16.5]); } x0 = cx + 13; }
  const cen = (q) => [(q[0] + q[3] + q[6] + q[9]) / 4, (q[2] + q[5] + q[8] + q[11]) / 4, Math.hypot(q[6] - q[0], q[8] - q[2]) / 2];
  S.all = [['bus', S.bus, mix(PAL.road, PAL.virusDark, 0.42)], ['dash', S.dash, COL.lane], ['busLine', S.busLine, COL.lane], ['zebra', S.zebra, COL.zebra]].map(([k, list, col]) => ({ k, col, list: list.map((q) => ({ q, c: cen(q) })) }));
  return S;
}

// ---------- ground details (g = -1): GL, in depth slices while depth of field is on ----------
// depth slices: drop empty ones, merge neighbours whose depth-of-field blur differs by < 30 % (fewer GL passes)
// (perf) at side view the plaza is one flat tone, so its slices may differ more in blur before it shows: `fac`
function slices(V, C, B, what, fac = 1.3) {
  const out = []; for (let i = 0; i < B.length - 1; i++) { const lo = B[i], hi = B[i + 1]; if (!sliceHas(C, lo, hi, what)) continue;
    const last = out[out.length - 1], b0 = V.coc(lo), b1 = V.coc(Math.min(hi, lo * 40));
    if (last && last.hi === lo && Math.max(last.b, b0, b1) <= fac * Math.max(0.6, Math.min(last.b, b0, b1))) { last.hi = hi; last.bmin = Math.min(last.bmin, b0, b1); last.b = Math.max(last.b, b0, b1); continue; }
    out.push({ lo, hi, b: Math.max(b0, b1), bmin: Math.min(b0, b1) }); }
  return out;
}
function groundItems(V, C, items, Ls) {
  if (!GL.ok) return;
  let near = Math.max(C.near, 0.03); const far = Math.max(3e4, V.D * 60), dof = V.dofA > 0.3 && Math.abs(C.u1) > 0.02;
  // (perf) the ground is only on screen beyond the depth where the screen's bottom edge meets it: nearer slices are skipped
  { const k = C.b1 + C.u1 * V.h / (2 * C.f); if (k > 1e-4 && C.py > 0) near = Math.max(near, 0.96 * C.py / k); }
  const B = [near]; if (dof) { for (let d = near * 1.4; d < Math.min(far, 4e4); d *= 1.4) B.push(d); } B.push(far);
  const side = Math.abs(C.b1) < 0.25; // (perf) side view: the ground is a near-uniform plaza tone
  for (const S of slices(V, C, B, 'ground', 1.3)) // (unification) one merge rule at every pitch: the side-view factor 4 snapped the plaza's blur at z 1.25
  { const lo = S.lo, hi = S.hi, dm = Math.sqrt(lo * Math.min(hi, lo * 40));
    items.push({ name: 'ground', d: dm, g: -1, blur: dof ? V.coc(dm) : 0, draw(c) { if (!renderSlice(V, C, near, hi, Ls, 'ground')) return; screenSpace(c); c.drawImage(GL.cv, 0, 0); } }); } // [near, hi]: no seams
}

// ---------- the static 3D city in GL depth slices ----------
// (perf) the GL depth slices of this frame: people and cars take the blur of the slice they stand in, so they join its
// blur run instead of opening runs of their own
let GLSL = [];
const blurIn = (V, d) => { for (const S of GLSL) if (d >= S.lo && d < S.hi) return S.b; return V.coc(Math.max(d, 0.5)); };
function glItems(V, C, items, Ls) {
  if (!GL.ok) return;
  const near = Math.max(C.near, 0.03), far = Math.max(3e4, V.D * 60);
  let B;
  if (V.dofA > 0.3) { const m = Math.max(near * 3, depthOf(C, 0, 0.9, 0)); B = [near];
    // (perf) at side view nothing static stands between the camera and the man (checked by rendering with and without
    // the near slices for z -0.3 … 1.25: identical), so slicing starts at the man (each slice is a GL pass + a blur run)
    const side = Math.abs(C.b1) < 0.25; if (side) B[0] = Math.max(near, 0.97 * m);
    // (unification pass) finer slices just behind the focus, where the blur changes fastest: things crossing a slice edge there
    // (the Met steps at z 1.2 → 1.25) jumped from blur 1.0 to 2.9 in one frame; slices() still merges the ones that agree
    const ks = side ? [1.12, 1.25, 1.45, 1.62, 1.8, 2.2, 2.8, 5, 10, 25] : [0.3, 0.55, 0.8, 1, 1.12, 1.25, 1.45, 1.62, 1.8, 2.2, 2.8, 5, 10, 25];
    for (const k of ks) if (k * m > B[B.length - 1] * 1.05 && k * m < far) B.push(k * m); B.push(far); }
  else B = [Math.max(near, V.D * 0.004), far];
  const SL = B.length === 2 ? [{ lo: B[0], hi: B[1] }] : slices(V, C, B, 'geo');
  GLSL = SL.map((S) => ({ lo: S.lo, hi: S.hi, b: V.coc(Math.sqrt(S.lo * Math.min(S.hi, S.lo * 40))) }));
  for (const S of SL) { const lo = S.lo, hi = S.hi, rep = Math.sqrt(lo * Math.min(hi, lo * 40));
    items.push({ name: 'gl', d: B.length === 2 ? 1e8 : rep, blur: V.coc(rep), draw(c) { renderSlice(V, C, lo, hi, Ls); screenSpace(c); c.drawImage(GL.cv, 0, 0); } }); }
}

// ---------- traffic, pedestrians, people on the steps, fountain jets (Canvas2D cross-billboards) ----------
function lifeItems(V, C, items, Ls) {
  const t = V.t;
  for (const cr of CARS) {
    const K = kindOf(cr), x = carX(cr, t); if (x < -425 || x > 425) continue; const rp = sphPx(C, x, K.H / 2, cr.z, K.L / 2 + 0.5); if (rp < 0.7) continue;
    const d = depthOf(C, x, K.H / 2, cr.z); if (d < C.near + K.L) continue; // never draw a car the camera is inside of
    { const q = proj(C, x, K.H / 2, cr.z); if (!V.onScreen(q[0], q[1], rp * 1.6)) continue; } // (perf) off screen
    const side = C.pz > cr.z ? 1 : -1;
    const A = V.layer('street', [x, 0, cr.z + side * K.W / 2], [1, 0, 0], [0, 1, 0]); const B = C.py > K.H ? V.layer('street', [x, K.H, cr.z], [1, 0, 0], [0, 0, 1]) : null;
    items.push({ name: 'car', d, blur: blurIn(V, d), draw(c) {
      screenSpace(c); const S = new Path2D(), ox = -G.sun[0] / G.sun[1] * K.H * 0.6, oz = -G.sun[2] / G.sun[1] * K.H * 0.6;
      addPoly3(S, C, [x - K.L / 2, 0.01, cr.z - K.W / 2, x + K.L / 2, 0.01, cr.z - K.W / 2, x + K.L / 2 + ox, 0.01, cr.z + K.W / 2 + oz, x - K.L / 2 + ox, 0.01, cr.z + K.W / 2 + oz]);
      c.fillStyle = COL.shadow; c.fill(S);
      if (A) drawCarSide(c, A, cr, Ls); if (B) drawCarTop(c, B, cr, Ls); } });
  }
  for (const p of PEDS) {
    const x = pedX(p, t); if (Math.abs(x) < 1.2 && Math.abs(p.z) < 2) continue;
    const rp = sphPx(C, x, p.h / 2, p.z, p.h / 2 + 0.2); if (rp < 0.8) continue;
    const d = depthOf(C, x, p.h / 2, p.z); if (d < C.near + 0.6) continue;
    { const q = proj(C, x, p.h / 2 + (p.y || 0), p.z); if (!V.onScreen(q[0], q[1], rp * 1.6)) continue; } // (perf) off screen
    const dir = p.cd || 1;
    const A = V.layer('street', [x, 0, p.z], [dir, 0, 0], [0, 1, 0]), B = C.py > p.h ? V.layer('street', [x, p.h * 0.84, p.z], [dir, 0, 0], [0, 0, 1]) : null;
    items.push({ name: 'ped', d, blur: blurIn(V, d), draw(c) { if (A) { c.setTransform(A.a, A.b, A.c, A.d, A.e, A.f); setUL(A, Ls); drawWalker(c, p, t); } if (B) { c.setTransform(B.a, B.b, B.c, B.d, B.e, B.f); drawPedTop(c, p); } } });
  }
  for (const s of SITTERS) {
    const rp = sphPx(C, s.x, s.y + 0.4, s.z, 0.6); if (rp < 0.8) continue; const d = depthOf(C, s.x, s.y + 0.4, s.z);
    { const q = proj(C, s.x, s.y + 0.4, s.z); if (!(q[2] > 0) || !V.onScreen(q[0], q[1], rp * 1.6)) continue; } // (perf) off screen
    const A = V.layer('street', [s.x, s.y, s.z], [s.s, 0, 0], [0, s.s, 0]); if (!A) continue;
    items.push({ name: 'sitter', d, blur: blurIn(V, d), draw(c) { c.setTransform(A.a, A.b, A.c, A.d, A.e, A.f); drawSitter(c, s); } });
  }
  for (const fo of FOUNT) { const rp = sphPx(C, fo.xm, 1, (fo.z0 + fo.z1) / 2, 8); if (rp < 2) continue; const d = depthOf(C, fo.xm, 0.8, (fo.z0 + fo.z1) / 2);
    items.push({ name: 'jets', d, blur: blurIn(V, d), draw(c) { screenSpace(c); drawJets(c, C, fo, t); } }); }
}

// ---------- sky (the real sky beyond the horizon; only when the horizon is in view) ----------
function skyItem(V, C, items) {
  const fx = -C.b0, fz = -C.b2, hl = Math.hypot(fx, fz); if (hl < 0.05) return;
  const hp = proj(C, C.px + fx / hl * 1e7, C.py, C.pz + fz / hl * 1e7); if (!(hp[2] > 0) || hp[1] < -V.h * 0.3) return;
  items.push({ name: 'sky', d: 1e9, g: -2, draw(c) { screenSpace(c); const y = clamp(hp[1], -1, V.h + 1);
    const g = c.createLinearGradient(0, y - V.h * 1.1, 0, y); g.addColorStop(0, PAL.skyHi); g.addColorStop(0.75, PAL.sky); g.addColorStop(1, PAL.skyLow);
    c.fillStyle = g; c.fillRect(0, 0, V.w, Math.max(0, y) + 4); } }); // the ground below the horizon is the EARTH terrain (g -1.5)
}

export default {
  id: 'street', zr: [-1.9, 5.6],
  keys: [{ z: 1.28, fr: 'street', at: [-2.5, 1.0, 0], M: PITCH(28) }],
  async load(ctx) { await loadCity(ctx); G.metFaces = metFaces(); STATIC = buildStatic(); await initGL(ctx, STATIC.all.map((L) => ({ col: L.col, quads: L.list.map((e) => e.q) }))); },
  draw(V, items, labels) {
    if (!G.ok) return;
    const PROF = window.__cityProf, n0 = items.length, t0 = performance.now();
    const C = camOf(V), fd = V.D, Ls = lightAt(C, C.px - C.b0 * fd, C.py - C.b1 * fd, C.pz - C.b2 * fd);
    { const a = performance.now(); if (GL.ok) setBlockState(blockMode(V, C)); if (PROF) PROF['B.blk'] = performance.now() - a; }
    skyItem(V, C, items);
    if (V.z < 4.3) groundItems(V, C, items, Ls);
    glItems(V, C, items, Ls);
    if (V.z < 3.0) lifeItems(V, C, items, Ls);
    if (PROF) { PROF.build = (PROF.build || 0) + performance.now() - t0; for (let i = n0; i < items.length; i++) { const it = items[i], d0 = it.draw, nm = it.name; it.draw = (c) => { const a = performance.now(); d0(c); PROF[nm] = (PROF[nm] || 0) + performance.now() - a; PROF['#' + nm] = (PROF['#' + nm] || 0) + 1; }; } }
    // one label at a time, beside its subject
    const lab = (x, y, z, text, sub) => { const p = proj(C, x, y, z); if (p[2] > 0) labels.push({ x: p[0] + 14 * V.s, y: p[1], text, sub }); };
    if (V.z > 1.65 && V.z < 2.45) lab(160, 28, -20, 'The Met', 'art museum · ~400 m long');
    else if (V.z > 2.75 && V.z < 3.35) lab(-300, 12, -500, 'Central Park', '4 km long');
    else if (V.z > 3.45 && V.z < 3.95) lab(-150, 40, 650, 'Upper East Side', 'neighbourhood · ~3 km');
    else if (V.z > 4.15 && V.z < 4.75) lab(-3300, 60, -249, 'Manhattan', 'island · 21.6 km long');   // Midtown, 40.754 N 73.984 W
  },
};
