// DNA scale (owner: NUCLEUS agent): every nucleosome that is >= ATOM_PX on screen is drawn from its real atoms (PDB 1KX5),
// with its linker DNA, by the same GL atom shader that made the sprites (levels/nuc-gl.js), split into depth-of-field bands.
// The hero nucleosome sits at frame 'nsome'; the hero carbon atom defines frame 'atom'.
import * as G from './nuc-gl.js';
import { ATOM_RMUL, NS, NM, RISE, loadNucleosome, glLook, orientModel, modelFrom, linkerAtoms, lowerBound, xc, ORIENT } from '../shared/nucleosome.js';
import { CH, atomBeads, atomLinkers } from './nuc-chain.js';
import { def } from '../core/world.js';
import { norm, sub, cross, dot, mv } from '../core/m.js';
import { shellItems, snapBlur } from './nuc-shell.js';
import { PAL, spec, mix } from '../core/kit.js';
import { NSOME } from '../core/anchors.js';
import { look, f3 } from '../core/look.js';

// ---- the hero carbon is drawn on its own (its back surfaces behind the 'atom' origin, its front surfaces in front), so the
// carbon nucleus drawn at the origin by levels/nucleus12.js sits inside the cloud. Same shader, same atom, no switch.
let heroRest = null, heroOnly = null, heroLinker = null;
function buildHero() {
  const w = NS.world0;
  if (NS.heroOnLinker) {
    // the hero carbon lives on the linker DNA from the previous nucleosome (exact two-angle linker 'prev')
    const g = CH.segs.find((q) => q.exact === 'prev'), m = linkerModel(g), H = CH.beads[0].p, hp = NS.heroP.map((v, i) => v + H[i]);
    let bi = -1, bd = 1e9; m.atoms.forEach((a, i) => { const d = Math.hypot(a.p[0] - hp[0], a.p[1] - hp[1], a.p[2] - hp[2]); if (d < bd) { bd = d; bi = i; } });
    heroLinker = modelFrom(m.atoms.filter((_, i) => i !== bi), 'heroLinker'); heroRest = orientModel(0);
    heroOnly = modelFrom([{ p: NS.heroP.slice(), r: m.atoms[bi].r, cls: m.atoms[bi].cls + 24 }], 'heroOnly'); return;
  }
  const rest = [];
  for (let i = 0; i < NS.n; i++) if (i !== NS.hero) rest.push({ p: [w[i * 3], w[i * 3 + 1], w[i * 3 + 2]], r: NS.rad[i], cls: NS.cls[i] });
  heroRest = modelFrom(rest, 'heroRest'); heroOnly = modelFrom([{ p: NS.heroP.slice(), r: NS.rad[NS.hero], cls: NS.cls[NS.hero] + 24 }], 'heroOnly');
}
// Atoms buried under two or more layers of other atoms (seen from above, where the camera always is at these scales) add
// nothing visible but cost fill: drop them from the atom-level models (height map on a 0.06 nm grid).
const culled = new Map();
function topLayer(m, key) {
  let c = culled.get(key); if (c) return c; const d = m.data, n = m.n, G0 = 0.06, H = new Map();
  for (let j = 0; j < n; j++) { const x = d[j * 5], y = d[j * 5 + 1], z = d[j * 5 + 2] + d[j * 5 + 3], r = d[j * 5 + 3];
    for (let gx = Math.floor((x - r) / G0); gx <= Math.floor((x + r) / G0); gx++) for (let gy = Math.floor((y - r) / G0); gy <= Math.floor((y + r) / G0); gy++) {
      const k = gx * 100003 + gy; const v = H.get(k); if (v === undefined || z > v) H.set(k, z); } }
  const keep = [];
  for (let j = 0; j < n; j++) { const x = d[j * 5], y = d[j * 5 + 1], z = d[j * 5 + 2] + d[j * 5 + 3]; let hmin = 1e9;
    for (const [ox, oy] of [[0, 0], [0.08, 0], [-0.08, 0], [0, 0.08], [0, -0.08]]) { const v = H.get(Math.floor((x + ox) / G0) * 100003 + Math.floor((y + oy) / G0)); if (v !== undefined && v < hmin) hmin = v; }
    if (z >= hmin - 0.8) keep.push({ p: [d[j * 5], d[j * 5 + 1], d[j * 5 + 2]], r: d[j * 5 + 3], cls: d[j * 5 + 4] }); }
  c = modelFrom(keep, 'top_' + key); culled.set(key, c); return c;
}
// straight linker atoms from a chain segment (exact two-angle linkers for the hero's neighbours, otherwise the exit frame of the
// upstream nucleosome turned to point along the segment)
function linkerModel(g) {
  const key = 'L' + g.i + '_' + g.j; const B = CH.beads[g.i], R = ORIENT[B.o];
  let F0 = xc({ R, t: B.p }, NS.EB); let nbp = Math.round(g.len / RISE);
  if (!g.exact) { const d = norm(sub(g.b, g.a)), z = [F0.R[2], F0.R[5], F0.R[8]], y0 = [F0.R[1], F0.R[4], F0.R[7]];
    const x = norm(cross(y0, d)), y = cross(d, x); F0 = { R: [x[0], y[0], d[0], x[1], y[1], d[1], x[2], y[2], d[2]], t: g.a }; nbp = Math.max(1, Math.round(Math.hypot(...sub(g.b, g.a)) / RISE) - 1); }
  return modelFrom(linkerAtoms(F0, nbp, 0), key);
}

// build every atom-level model the dive can need once, at start-up (no hitch the first time a bead turns into atoms)
let warm = false;
function prewarm() {
  warm = true; buildHero(); if (!NS.heroOnLinker) topLayer(heroRest, 'hero'); ORIENT.forEach((_, k) => topLayer(orientModel(k), 'o' + k));
  const H = CH.beads[0].p; for (const g of CH.segs) if (g.kind === 1 && Math.hypot(g.a[0] - H[0], g.a[1] - H[1], g.a[2] - H[2]) < 140) linkerModel(g);
}
export default {
  id: 'dna', zr: [-15.6, -6.8], // below -15.3 the proton's opaque interior covers the view (verified pixel-identical): no GL work
  async load(ctx) { await loadNucleosome(ctx); },
  frames(t) { if (NS.ready) def('atom', 'nsome', NS.heroP.map((v) => v * NM)); if (!warm && CH.ready && G.glOK()) prewarm(); },
  draw(V, items, labels) {
    if (!NS.ready || !CH.ready || !G.glOK()) return;
    // fully hidden behind an opaque screen-covering item (the proton's interior): skip all GL work (frame-rate fix)
    if (V.coverDepth !== undefined) { const hd = V.cs('atom', [0, 0, 0])[2]; if (V.coverDepth < Math.max(hd - 2.9e-15, V.near * 1.01)) return; }
    // ---- labels (one at a time, placed on the thing they name)
    // labels: beside their object (to the right of its screen edge), short wording
    const beside = (fr, p, rM, text, sub) => { const q = V.P(fr, p); if (q[2] <= V.near) return; const r = Math.min(rM, 0.2 * V.W) * V.f / q[2];
      let x = q[0] + r + 14; if (x + 240 > V.w) x = q[0] - r - 240; if (x < 44) x = Math.min(V.w - 250, q[0] + r * 0.5); labels.push({ x, y: q[1] - 14, text, sub }); };
    if (V.z < -7.35 && V.z > -7.9) beside('nsome', [0, 0, 0], 6.5 * NM, 'Nucleosome', 'DNA wrapped 1.65 times · 11 nm');
    else if (V.z < -8.5 && V.z > -9.3) beside('atom', [0, 0, 0], 1.0 * NM, 'DNA double helix', 'two strands, 10.5 base pairs a turn · 2 nm');
    else if (V.z < -9.4 && V.z > -9.95) beside('atom', [0, 0, 0], 0.17 * NM, 'Carbon atom', 'a cloud of 6 electrons · ~0.15 nm');
    else if (V.z < -10.5 && V.z > -11.4) beside('atom', [0, 0, 0], 0.009 * NM, 'Mostly empty space', 'innermost (1s) electrons · ~9 pm');
    const ab = atomBeads(V); if (!ab.length) return;
    const set = new Set(ab.map((a) => a.i)); const pieces = [];
    if (!heroRest) buildHero(); const hero = set.has(0) || set.has(1);
    for (const a of ab) { const B = CH.beads[a.i]; pieces.push({ m: a.i === 0 ? topLayer(heroRest, NS.heroOnLinker ? 'o0' : 'hero') : topLayer(orientModel(B.o), 'o' + B.o), O: B.p, d: a.depth, bead: true }); }
    if (hero) { const hd = V.cs('atom', [0, 0, 0])[2], X = G.camXf(V, 'mnuc', CH.beads[0].p.map((v) => v * NM), null, NM);
      // 2p lobe axes (nsome frame: two perpendicular horizontal-ish directions), rotated into camera space
      const M = X.M, cam = (v) => { const r = [M[0] * v[0] + M[3] * v[1] + M[6] * v[2], M[1] * v[0] + M[4] * v[1] + M[7] * v[2], M[2] * v[0] + M[5] * v[1] + M[8] * v[2]]; const l = Math.hypot(...r); return r.map((x) => x / l); };
      const lobes = [cam([0.5, 0.28, 0.82]), cam([-0.45, 0.5, 0.74])];
      for (const pass of [1, 2]) { const dd = pass === 1 ? Math.max(hd, V.near * 1.01) + 2.9e-15 : Math.max(hd - 2.9e-15, V.near * 1.01); // far half behind the whole C-12 nucleus (r ≈ 2.5 fm), near half in front of it
        // LAZY: the GL render happens only if the engine actually draws this item (hidden items cost nothing)
        items.push({ name: pass === 1 ? 'hero-cloud-back' : 'hero-cloud-front', d: dd, blur: snapBlur(V.coc(Math.abs(hd))), draw(c) {
          const b = G.band(V); if (!b) return; b.box = [0, 0, V.w, V.h]; G.drawAtoms(V, X, heroOnly, 0, 1, { near: V.near / NM, pass, lobes }); G.blit(c, b); } }); } }
    for (const g of atomLinkers(V, set)) { const m = g.exact === 'prev' && heroLinker ? heroLinker : linkerModel(g); pieces.push({ m, O: [0, 0, 0], d: V.cs('mnuc', [(g.a[0] + g.b[0]) / 2 * NM, (g.a[1] + g.b[1]) / 2 * NM, (g.a[2] + g.b[2]) / 2 * NM])[2] }); }
    pieces.sort((a, b) => b.d - a.d);
    const e = V.c('mnuc'), camH = e.p[2] / NM, D = V.D / NM, near = V.near / NM;
    let zmin = 1e9, zmax = -1e9; for (const p of pieces) { zmin = Math.min(zmin, p.O[2] + p.m.zs[0]); zmax = Math.max(zmax, p.O[2] + p.m.zs[p.m.n - 1]); }
    const dN = Math.min(near, camH - zmax - 0.5), dF = camH - zmin + 0.5; // atoms centred above the camera still reach below it
    // fixed band edges (multiples of the focus distance), never merged: atoms never jump between blur levels
    G.setFog(f3(look(V.z).haze), 0.66, 0.85 * D, 2.2 * D, [f3(look(V.z).deep), 0.62, 0.4 * D, 0.95 * D]); // far atoms sink into the medium, continuously with depth
    const E = [0.5, 0.86, 1.5, 3.5].map((k) => k * D); const edges = [Math.min(dN, E[0] * 0.999), ...E, Math.max(dF, E[3] * 1.001)];
    for (let k = edges.length - 2; k >= 0; k--) {
      const zLo = camH - edges[k + 1], zHi = camH - edges[k]; let b = null, zA = 1e9, zB = -1e9;
      const jobs = [];
      for (const p of pieces) { const i0 = lowerBound(p.m.zs, zLo - p.O[2]), i1 = lowerBound(p.m.zs, zHi - p.O[2]); if (i1 <= i0) continue; zA = Math.min(zA, p.O[2] + p.m.zs[i0]); zB = Math.max(zB, p.O[2] + p.m.zs[i1 - 1]);
        jobs.push([G.camXf(V, 'mnuc', p.O.map((v) => v * NM), null, NM), p, i0, i1]); }
      if (!jobs.length) continue; const dm = Math.sqrt(Math.max(camH - zB, edges[k], near * 2) * Math.max(Math.min(camH - zA, edges[k + 1]), near * 3)) * NM;
      const fogArgs = [f3(look(V.z).haze), 0.66, 0.85 * D, 2.2 * D, [f3(look(V.z).deep), 0.62, 0.4 * D, 0.95 * D]];
      // LAZY: rendered only if the engine draws this band (hidden bands cost nothing)
      items.push({ name: 'atoms', d: dm, blur: V.coc(dm), draw(c) { const bb = G.band(V); if (!bb) return; bb.box = [0, 0, V.w, V.h]; G.setFog(...fogArgs);
        for (const [Xp, p, i0, i1] of jobs) G.drawAtoms(V, Xp, p.m, i0, i1, { near, bc: p.bead ? Xp.T : null, br: p.bead ? 6.2 : 0, rmul: ATOM_RMUL });
        G.setFog([0, 0, 0], 0); G.blit(c, bb); } });
    }
    G.setFog([0, 0, 0], 0);
  },
};
