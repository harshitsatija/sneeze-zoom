// City data + fast projection, shared by street.js (side view, crane, UES, Manhattan) and mantop.js.
// Everything lives in the 'street' frame: x = uptown (bearing 29°), y = up, z = toward the side-view camera (ESE 119°).
// Sources: assets/geo/{street,ues,manhattan}.json (real footprints, heights, roadbeds, trees) + assets/city/city.json
// (derived: park trees, Central Park wall, block coverage/height). See assets/city/SOURCES.md.
import { PAL, mix } from '../core/kit.js';
import { sunDir } from '../core/world.js';
import { TERRAIN } from './earth-terrain.js';
import { FAM, look } from '../core/look.js';

export const SB = Math.sin(29 * Math.PI / 180), CB = Math.cos(29 * Math.PI / 180);
const SC = 0.1;
export const G = { ok: false };

// ---------- colours (PAL only, plus mixes of PAL colours) ----------
// unification pass: every city colour from core/look.js (Kurzgesagt nuke-city/02 saturation, not pale lavender).
// Ground: saturated violets (asphalt deep, sidewalks mid, curbs light). Buildings: bluish-violet walls lit / FAM.violet.dark
// shade, lit roofs in violet / pink / teal lights, gold windows. The Met is ONE warm stone family (FAM.skin) on every face, the
// facade, its roof tiers and the steps alike (lilac-pink stone: the street's saturated lilac medium, look(-1)), so it reads as one model from the side view to the map.
const V_ = FAM.violet, DEEP_ = look(1.5).deep;
// the Met's stone: a lilac-pink family (the side view's big background must not share the man's skin / jacket oranges)
const SK = { base: mix(V_.lit, FAM.magenta.lit, 0.3), lit: mix(mix(V_.lit, FAM.magenta.lit, 0.3), '#ffffff', 0.35), dark: mix(V_.base, FAM.magenta.dark, 0.3) };
export const COL = {
  road: mix(DEEP_, V_.dark, 0.4), lane: mix(V_.lit, '#ffffff', 0.5), laneY: FAM.gold.lit, zebra: mix(V_.lit, '#ffffff', 0.35),
  walk: mix(V_.base, V_.lit, 0.3), walkLit: mix(V_.base, V_.lit, 0.62), curb: mix(V_.lit, '#ffffff', 0.35), plaza: mix(V_.base, V_.lit, 0.5), median: mix(V_.base, FAM.lime.dark, 0.35),
  path: mix(V_.lit, FAM.lime.base, 0.25),
  window: FAM.gold.base, wallLit: mix(V_.base, FAM.cyan.base, 0.18), wallShade: mix(V_.dark, DEEP_, 0.25), wallDeep: mix(V_.dark, DEEP_, 0.6),
  roofs: [V_.lit, mix(V_.lit, FAM.magenta.lit, 0.45), mix(V_.lit, FAM.cyan.lit, 0.5), mix(V_.lit, '#ffffff', 0.25)],
  metLit: SK.lit, metMid: mix(SK.lit, SK.base, 0.5), metWall: SK.base, metShade: mix(SK.dark, V_.dark, 0.35),
  metRoof: mix(SK.lit, SK.base, 0.35), metRoofHi: mix(SK.lit, '#ffffff', 0.2), metGlass: FAM.cyan.lit,
  metDark: mix(V_.dark, DEEP_, 0.4), glass: mix(FAM.cyan.base, V_.dark, 0.3),
  stepT: mix(SK.lit, '#ffffff', 0.15), stepR: mix(SK.base, SK.dark, 0.3),
  stone: mix(V_.base, V_.lit, 0.4), stoneTop: mix(V_.lit, '#ffffff', 0.2),
  canopy: mix(FAM.lime.base, FAM.cyan.base, 0.45), canopyLit: mix(FAM.lime.lit, FAM.cyan.lit, 0.4), canopyDark: mix(FAM.lime.dark, FAM.cyan.dark, 0.5), trunk: mix(V_.dark, DEEP_, 0.3),
  water: TERRAIN.water, urban: TERRAIN.urban, shadow: 'rgba(29,3,59,0.28)',
};

// ---------- helpers ----------
export function ringST(flat, k = SC) { const n = flat.length >> 1, a = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const e = flat[2 * i] * k, nn = flat[2 * i + 1] * k; a[2 * i] = e * SB + nn * CB; a[2 * i + 1] = e * CB - nn * SB; } return a; }
export function ringArea(a) { let s = 0; const n = a.length >> 1; for (let i = 0, j = n - 1; i < n; j = i++) s += a[2 * j] * a[2 * i + 1] - a[2 * i] * a[2 * j + 1]; return s / 2; }
function bbox(rings) { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const r of rings) for (let i = 0; i < r.length; i += 2) { const x = r[i], z = r[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; } return [x0, z0, x1, z1]; }
// radial-distance decimation (keeps the first vertex; max deviation < tol)
function decim(a, tol) { const n = a.length >> 1; if (n <= 4) return a; const out = [a[0], a[1]]; let lx = a[0], lz = a[1]; for (let i = 1; i < n; i++) { const x = a[2 * i], z = a[2 * i + 1]; if ((x - lx) ** 2 + (z - lz) ** 2 >= tol * tol) { out.push(x, z); lx = x; lz = z; } } return out.length >= 6 ? new Float32Array(out) : null; }
export function hash32(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }

function areaSet(polys, lods = null) {
  const out = []; for (const p of polys) { const rings = p.map((r) => ringST(r)).filter((r) => r.length >= 6); if (!rings.length) continue; const bb = bbox(rings);
    const e = { rings, bb, x: (bb[0] + bb[2]) / 2, z: (bb[1] + bb[3]) / 2, rad: Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2 };
    if (lods) e.lod = lods.map((t) => rings.map((r) => decim(r, t)).filter(Boolean)); out.push(e); }
  return out;
}

// ---------- load ----------
export async function loadCity(ctx) {
  const [st, ues, man, city] = await Promise.all([ctx.json('assets/geo/street.json'), ctx.json('assets/geo/ues.json'), ctx.json('assets/geo/manhattan.json'), ctx.json('assets/city/city.json')]);
  // prisms: ues footprints; BINs with 3D-model roof tiers (street.json parts) are replaced by their tiers (the Met: 165)
  const parts = new Map(); for (const b of st.buildings) if (b[7] && b[7].length) parts.set(b[3], b[7]);
  const prisms = [];
  const addPrism = (rings, h, base, bin, kind, blk) => {
    rings = rings.filter((r) => r.length >= 6); if (!rings.length) return; const bb = bbox(rings);
    const sg = rings.map((r) => Math.sign(ringArea(r)) || 1);
    prisms.push({ rings, sg, h, b: base, bin, kind, blk, x: (bb[0] + bb[2]) / 2, z: (bb[1] + bb[3]) / 2, rad: Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2,
      tint: (hash32(bin | 0) * 4) | 0, area: Math.abs(ringArea(rings[0])) });
  };
  ues.buildings.forEach((b, i) => {
    const bin = b[2], kind = bin === 1083810 ? 1 : 0, blk = city.bld_block[i];
    const pp = parts.get(bin);
    if (pp) for (const p of pp) addPrism(p[2].map((r) => ringST(r)), Math.max(p[0] * SC, 2.5), p[1] * SC, bin, kind, blk);
    else for (const poly of b[3]) addPrism(poly.map((r) => ringST(r)), Math.max(b[0] * SC, 3.0), 0, bin, kind, blk);
  });
  G.prisms = prisms;
  // ground details
  G.ground = {
    sidewalk: areaSet(st.areas.sidewalk), plaza: areaSet(st.areas.plaza), ped: areaSet(st.areas.pedestrian_area), median: areaSet(st.areas.median),
    roadbed: city.roadbed_tiles.map((t) => { const L = t.map((polys) => polys.flatMap((p) => p.map((r) => ringST(r)).filter((r) => r.length >= 6))); const rings = L[0]; if (!rings.length) return null;
      const bb = bbox(rings); return { rings, lod: [L[1], L[2], L[3]], bb, x: (bb[0] + bb[2]) / 2, z: (bb[1] + bb[3]) / 2, rad: Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2 }; }).filter(Boolean),
  };
  G.crossings = st.crossings.map((c) => ({ w: c[1] * SC, line: ringST(c[2]) }));
  G.paths = ues.paths.map((p) => ({ kind: p[0], line: ringST(p[1]) })).filter((p) => p.line.length >= 4);
  G.roads = ues.roads.map((r) => ({ cls: r[0], name: ues.names[r[1]] || '', w: r[2] * SC, oneway: r[3], br: r[4], line: ringST(r[5]) })).filter((r) => r.line.length >= 4);
  // trees, one table: street census + OSM inside the street square, census outside it (3 km), generated park trees
  const T = [];
  st.trees.forEach((t) => { const s = ringST([t[0], t[1]]); T.push(s[0], s[1], Math.max(1.2, t[3] * SC)); });
  for (const t of city.street_trees) { const s = ringST([t[0], t[1]]); T.push(s[0], s[1], t[2] * SC); }
  for (const t of city.trees) { const s = ringST([t[0], t[1]]); T.push(s[0], s[1], t[2] * SC); }
  const n = T.length / 3; G.tree = { n, x: new Float32Array(n), z: new Float32Array(n), r: new Float32Array(n), h: new Float32Array(n), seed: new Uint32Array(n) };
  for (let i = 0; i < n; i++) { const r = T[3 * i + 2]; G.tree.x[i] = T[3 * i]; G.tree.z[i] = T[3 * i + 1]; G.tree.r[i] = r; G.tree.h[i] = Math.min(24, 2.6 + 2.15 * r); G.tree.seed[i] = (hash32(i * 31 + 7) * 1e6) | 0; }
  G.wall = city.wall.map((w) => ringST(w));
  // Manhattan blocks with real (or PLUTO) heights and coverage
  const blocks = [], byJ = new Array(man.blocks.length).fill(null); man.blocks.forEach((b, j) => { const cb = city.blocks[j]; const rings = [ringST(b[2][0])]; if (rings[0].length < 6) return;
    const bb = bbox(rings), A = ringArea(rings[0]); const e = { j, rings, bb, x: (bb[0] + bb[2]) / 2, z: (bb[1] + bb[3]) / 2, sg: Math.sign(A) || 1,
      rad: Math.hypot(bb[2] - bb[0], bb[3] - bb[1]) / 2, h: cb[0] >= 0 ? cb[0] * SC : -1, cov: cb[1] >= 0 ? cb[1] / 100 : 0.5, park: cb[2] / 100, inside: cb[3], area: Math.abs(A), thr: 9 + 9 * hash32(j * 13 + 5) };
    blocks.push(e); byJ[j] = e; });
  G.blocks = blocks; G.blockByJ = byJ; G.nBlocksRaw = man.blocks.length;
  G.sun = sunDir('street');
  G.met = st.met;
  G.ok = true;
}

// ---------- camera ----------
// C = flattened camera for tight loops (camera position + right/up/back rows in the street frame)
export function camOf(V) {
  const e = V.c('street');
  return { px: e.p[0], py: e.p[1], pz: e.p[2], r0: e.r[0], r1: e.r[1], r2: e.r[2], u0: e.u[0], u1: e.u[1], u2: e.u[2], b0: e.b[0], b1: e.b[1], b2: e.b[2], f: V.f, cx: V.cx, cy: V.cy, near: Math.max(V.near, 0.05), w: V.w, h: V.h };
}
export function depthOf(C, x, y, z) { return -((x - C.px) * C.b0 + (y - C.py) * C.b1 + (z - C.pz) * C.b2); }
// project one point: returns [sx, sy, d] (d <= near: invalid)
export function proj(C, x, y, z) {
  const vx = x - C.px, vy = y - C.py, vz = z - C.pz, d = -(vx * C.b0 + vy * C.b1 + vz * C.b2);
  const k = C.f / d; return [C.cx + (vx * C.r0 + vy * C.r1 + vz * C.r2) * k, C.cy - (vx * C.u0 + vy * C.u1 + vz * C.u2) * k, d];
}
// add a polygon given in 3D (flat [x,y,z,...]) to a Path2D, clipped to the near plane
let _cs = new Float64Array(3 * 4096);
const grow = (n) => { if (3 * n > _cs.length) _cs = new Float64Array(3 * n * 2); };
export function addPoly3(path, C, P) {
  const n = P.length / 3; let any = false, all = true; grow(n);
  for (let i = 0; i < n; i++) { const vx = P[3 * i] - C.px, vy = P[3 * i + 1] - C.py, vz = P[3 * i + 2] - C.pz;
    const d = -(vx * C.b0 + vy * C.b1 + vz * C.b2); _cs[3 * i] = vx * C.r0 + vy * C.r1 + vz * C.r2; _cs[3 * i + 1] = vx * C.u0 + vy * C.u1 + vz * C.u2; _cs[3 * i + 2] = d;
    if (d > C.near) any = true; else all = false; }
  if (!any) return false;
  emitClipped(path, C, n, all);
  return true;
}
// ring at constant height y (flat x,z Float32Array)
export function addRingY(path, C, ring, y) {
  const n = ring.length >> 1; let any = false, all = true; const dy = y - C.py; grow(n);
  for (let i = 0; i < n; i++) { const vx = ring[2 * i] - C.px, vz = ring[2 * i + 1] - C.pz;
    const d = -(vx * C.b0 + dy * C.b1 + vz * C.b2); _cs[3 * i] = vx * C.r0 + dy * C.r1 + vz * C.r2; _cs[3 * i + 1] = vx * C.u0 + dy * C.u1 + vz * C.u2; _cs[3 * i + 2] = d;
    if (d > C.near) any = true; else all = false; }
  if (!any) return false; emitClipped(path, C, n, all); return true;
}
function emitClipped(path, C, n, all) {
  const f = C.f, cx = C.cx, cy = C.cy, nr = C.near;
  if (all) { for (let i = 0; i < n; i++) { const k = f / _cs[3 * i + 2], x = cx + _cs[3 * i] * k, y = cy - _cs[3 * i + 1] * k; i ? path.lineTo(x, y) : path.moveTo(x, y); } path.closePath(); return; }
  let first = true;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, da = _cs[3 * i + 2], db = _cs[3 * j + 2], ia = da > nr, ib = db > nr;
    if (ia) { const k = f / da, x = cx + _cs[3 * i] * k, y = cy - _cs[3 * i + 1] * k; first ? path.moveTo(x, y) : path.lineTo(x, y); first = false; }
    if (ia !== ib) { const t = (nr - da) / (db - da), X = _cs[3 * i] + (_cs[3 * j] - _cs[3 * i]) * t, Y = _cs[3 * i + 1] + (_cs[3 * j + 1] - _cs[3 * i + 1]) * t, k = f / nr;
      const x = cx + X * k, y = cy - Y * k; first ? path.moveTo(x, y) : path.lineTo(x, y); first = false; }
  }
  path.closePath();
}
// polyline at height y as a stroked line (screen space; returns mean depth or 0)
export function addLineY(path, C, line, y) {
  const n = line.length >> 1; let pen = false, dsum = 0, dn = 0; const dy = y - C.py;
  for (let i = 0; i < n; i++) { const vx = line[2 * i] - C.px, vz = line[2 * i + 1] - C.pz, d = -(vx * C.b0 + dy * C.b1 + vz * C.b2);
    if (d <= C.near) { pen = false; continue; } const k = C.f / d, x = C.cx + (vx * C.r0 + dy * C.r1 + vz * C.r2) * k, y2 = C.cy - (vx * C.u0 + dy * C.u1 + vz * C.u2) * k;
    pen ? path.lineTo(x, y2) : path.moveTo(x, y2); pen = true; dsum += d; dn++; }
  return dn ? dsum / dn : 0;
}
// is a sphere (centre, radius m) possibly on screen, and how big? returns px radius or -1
export function sphPx(C, x, y, z, r) {
  const vx = x - C.px, vy = y - C.py, vz = z - C.pz, d = -(vx * C.b0 + vy * C.b1 + vz * C.b2);
  if (d < -r) return -1; const dd = Math.max(d, C.near), k = C.f / dd, rp = r * k;
  if (d > r) { const sx = C.cx + (vx * C.r0 + vy * C.r1 + vz * C.r2) * k, sy = C.cy - (vx * C.u0 + vy * C.u1 + vz * C.u2) * k;
    if (sx + rp < 0 || sx - rp > C.w || sy + rp < 0 || sy - rp > C.h) return -1; }
  return rp;
}
// is a point (with lateral radius r) hidden behind the Met's Fifth Avenue front for this camera? (cheap occlusion cull)
export function hiddenByMet(C, x, ytop, z, r) {
  const ZF = -25.2; if (C.pz <= ZF + 1 || z >= ZF - 0.5) return false;
  const t = (ZF - C.pz) / (z - C.pz), xi = C.px + t * (x - C.px), yi = C.py + t * (ytop - C.py), m = r * t + 0.5;
  return yi < 21 - m && xi > -148 + m && xi < 148 - m;
}
// screen-space light direction (where the light comes FROM, unit, canvas y down) at a world point
export function lightAt(C, x, y, z) {
  const a = proj(C, x, y, z), s = G.sun || [-0.39, 0.86, 0.34], k = 0.01 * Math.max(1, Math.abs(a[2]));
  const b = proj(C, x + s[0] * k, y + s[1] * k, z + s[2] * k); let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy);
  if (l < 1e-9) return [-0.42, -0.9]; return [dx / l, dy / l];
}
