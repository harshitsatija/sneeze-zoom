// The terrain base for every scale (street → globe): one nested chain of products from assets/earth/terrain.bin
// (street 0.1 m → ues 0.55 → m0.5 … m5 → r5 … r60 → w100 … w60000, see assets/earth/SOURCES.md). Each coarser product contains the finer one
// inside its extent, re-simplified, so a switch moves no edge by more than err[j] metres; we switch when err·px/m < 0.3 px.
// Inner products (smaller extents) are drawn on top of the outer one, each painting its own sea + land, so the side view
// (horizon kilometres away) uses fine data near the camera and coarser data far away.
import { PAL, mix, L as LIGHT } from '../core/kit.js';
import { FAM, look } from '../core/look.js';
import { decodeLayer, Builder, cap, limbLoop, rayHit, frameState } from './earth-geo.js';

// ONE colour per material (unification pass: look()/FAM). Land is the city's deep violet at city and region scale (Kurzgesagt
// nuke-all-earth/07: violet land, cyan water) and drifts slowly to Kurzgesagt green between z 5.0 and 6.6 for the globe; urban is
// the lighter violet the city blocks average to; parks teal-green; water cyan. setTerrainZ(z) updates the drifting entries.
const LAND_V = mix(FAM.violet.base, look(4).medium, 0.3), LAND_G = mix(FAM.lime.base, '#48c671', 0.5);
const URBAN = mix(FAM.violet.lit, FAM.violet.base, 0.35);
const PARK = mix(FAM.lime.base, FAM.cyan.dark, 0.45), LAND_M = mix(FAM.cyan.dark, FAM.lime.dark, 0.45);
const LAND_STOPS = [LAND_V, '#3c3cb4', '#1f8a72', LAND_G];
export const TERRAIN = {
  water: mix(FAM.cyan.base, FAM.cyan.lit, 0.25),
  land: LAND_V,
  urban: URBAN,
  park: PARK,
  desert: mix(LAND_G, FAM.gold.lit, 0.55),
  forest: mix(LAND_V, PARK, 0.3),
  ice: PAL.ice,
  // crescent coast shading (not materials): extrusion under the shadow-side coast, lit rim on the lit-side coast, shade in water
  landDark: mix(LAND_V, look(4).deep, 0.6), landLit: mix(LAND_V, FAM.violet.lit, 0.55), waterShade: mix(FAM.cyan.base, FAM.cyan.dark, 0.7),
};
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function setTerrainZ(z) {
  // violet -> saturated dark teal -> green (an RGB mix of violet and green passes through grey); the mid stop stays darker than
  // the water so the coast always reads
  // four saturated stops (violet → indigo → teal-green → green): every pair is close enough in hue that an RGB mix stays
  // saturated (the old two-stop path went through a dull slate at 5.4–5.8); every stop is darker than the water
  const k = ss(5.0, 6.6, z), q = k * 3, j = Math.min(2, Math.floor(q)), land = mix(LAND_STOPS[j], LAND_STOPS[j + 1], q - j);
  TERRAIN.land = land; TERRAIN.forest = mix(land, PARK, 0.3);
  // urban: the blocks' average violet at city scale, a light tint of the land at region scale (no flat violet slab)
  TERRAIN.urban = mix(URBAN, mix(land, FAM.violet.lit, 0.1), ss(4.5, 5.3, z));
  TERRAIN.landDark = mix(land, look(Math.max(z, 4)).deep, 0.6); TERRAIN.landLit = mix(land, k < 0.5 ? FAM.violet.lit : FAM.lime.lit, 0.5);
}
const ORDER = ['sea', 'land', 'forest', 'desert', 'urban', 'park', 'ice', 'water'];

export const T = { products: null, ready: false, stats: {} };
if (typeof window !== 'undefined') window.__earthT = T;
export async function loadTerrain(ctx) {
  const buf = await ctx.buf('assets/earth/terrain.bin');
  const dv = new DataView(buf), hl = dv.getUint32(4, true);
  const hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)));
  const bytes = new Uint8Array(buf, 8 + hl), sc = hdr.scale;
  const L = (e) => (e ? decodeLayer(bytes, e, sc) : null);
  T.products = hdr.products.map((p) => ({ name: p.name, err: p.err, ext: L(p.ext), layers: Object.fromEntries(Object.entries(p.layers).map(([k, v]) => [k, L(v)])),
    extKind: p.ext ? p.kind : null, extSize: p.ext ? p.half : Infinity }));
  T.ready = true;
}

// local east/north metres of an ECEF point relative to P0's ECEF and ENU axes (for extent tests)
function localEN(E, p) { const d = [p[0] - E.o[0], p[1] - E.o[1], p[2] - E.o[2]]; return [d[0] * E.e[0] + d[1] * E.e[1] + d[2] * E.e[2], d[0] * E.n[0] + d[1] * E.n[1] + d[2] * E.n[2]]; }

// choose the products for this view and build their paths. Returns { draws: [{prod, inner, paths}], coversScreen, dmin }
export function terrainPlan(S, E) {
  const V = S.V, P = T.products; if (!P) return null;
  // sample rays: where is the ground, how near is it, is there sky/space in the frame?
  const xs = [0, V.w / 2, V.w], ys = [0, V.h / 2, V.h]; let dmin = Infinity, miss = 0, rmax = 0; const hits = [];
  for (const sy of ys) for (const sx of xs) { const h = rayHit(S, sx, sy); if (!h) { miss++; continue; } hits.push(h); dmin = Math.min(dmin, h.depth); const l = localEN(E, h.p); rmax = Math.max(rmax, Math.abs(l[0]), Math.abs(l[1])); }
  if (!hits.length && S.alt < 1e5) return null; // nothing of the ground in view
  if (!hits.length) dmin = S.alt;
  const c = cap(S, 0);
  if (miss) { const nad = localEN(E, [S.C[0], S.C[1], S.C[2]]); rmax = Math.max(rmax, Math.hypot(nad[0], nad[1]) + c.lr * 1.05); }
  const pxm = S.f / Math.max(dmin, 1e-3); // px per metre at the nearest visible ground
  // finest product needed: drop product j while the next coarser one moves edges by under 0.3 px (err = DP tolerance; the
  // measured symmetric-difference width is <= 1.5 err in almost all switches, see assets/earth/SOURCES.md)
  let j0 = 0; while (j0 < P.length - 1 && P[j0 + 1].err * pxm < 0.3) j0++;
  // outermost product: the first one (from j0) whose extent holds all the visible ground
  const holds = (p) => p.extKind === null || (p.extKind === 'square' ? rmax < p.extSize * 0.985 : rmax * 1.4143 < p.extSize * 0.985);
  let k = j0; while (k < P.length - 1 && !holds(P[k])) k++;
  T.stats = { j0: P[j0].name, k: P[k].name, dmin: Math.round(dmin), pxm };
  return { j0, k, coversScreen: miss === 0, dmin, pxm };
}

// draw the planned products on a canvas context (screen space). Returns vertex count.
export function drawTerrain(c, S, plan, colours = TERRAIN) {
  const P = T.products; let verts = 0;
  // base: the visible cap (everything below the horizon / inside the limb) is water
  const c0 = cap(S, 0);
  if (plan.coversScreen) { c.fillStyle = colours.water; c.fillRect(0, 0, S.V.w, S.V.h); }
  else { const b = new Builder(S, 0, 0); b.loop(limbLoop(S, c0)); c.fillStyle = colours.water; c.fill(b.path); }
  // crescent coast (screen px, constant: a drawing convention like a stroke width, not a zoom effect)
  const w = 3.2 * S.V.s, dx = -LIGHT[0] * w, dy = -LIGHT[1] * w;
  for (let j = plan.k; j >= plan.j0; j--) {
    const p = P[j], inner = j !== plan.k; // an inner product repaints its whole extent (sea + land partition it), no clip
    let ext = null; if (p.ext) { const be = new Builder(S, 0, 1).layer(p.ext); if (be.rings) ext = be.path; }
    let landP = null, rim = false;
    for (const key of ORDER) {
      const L = p.layers[key]; if (!L || (key === 'sea' && !inner)) continue;
      const b = new Builder(S, 0, 1).layer(L); if (!b.rings) continue;
      if (key === 'land' && colours.landDark) { // the land's 2.5D edge: a deep copy shifted away from the light, under the land
        landP = b.path; c.save(); if (ext) c.clip(ext, 'evenodd'); c.translate(dx, dy); c.fillStyle = colours.landDark; c.fill(b.path, 'evenodd'); c.restore(); }
      if (key === 'water' && landP && colours.landLit && (rim = true)) { // lit rim on the lit-side coast (inside land, over urban/forest too)
        c.save(); if (ext) c.clip(ext, 'evenodd'); c.clip(landP, 'evenodd'); const q = new Path2D(); q.addPath(landP); q.addPath(landP, new DOMMatrix([1, 0, 0, 1, dx * 0.5, dy * 0.5]));
        c.fillStyle = colours.landLit; c.fill(q, 'evenodd'); c.restore(); }
      c.fillStyle = colours[key === 'sea' ? 'water' : key]; c.fill(b.path, 'evenodd'); verts += b.count;
      if (key === 'water' && colours.waterShade) { // lakes and rivers: the bank's shadow inside the water on the lit side
        c.save(); if (ext) c.clip(ext, 'evenodd'); c.clip(b.path, 'evenodd'); const q = new Path2D(); q.addPath(b.path); q.addPath(b.path, new DOMMatrix([1, 0, 0, 1, dx * 0.6, dy * 0.6]));
        c.fillStyle = colours.waterShade; c.fill(q, 'evenodd'); c.restore(); }
    }
    if (landP && !rim && colours.landLit) { c.save(); if (ext) c.clip(ext, 'evenodd'); c.clip(landP, 'evenodd'); const q = new Path2D(); q.addPath(landP); q.addPath(landP, new DOMMatrix([1, 0, 0, 1, dx * 0.5, dy * 0.5]));
      c.fillStyle = colours.landLit; c.fill(q, 'evenodd'); c.restore(); }
  }
  return verts;
}
