// The hero macrophage's NUCLEUS (owner: NUCLEUS agent), frame 'mnuc', drawn at every zoom where it is visible (z -3 … -8.6).
// - Nuclear envelope: a double membrane (outer + inner, 35 nm apart) with ~3,000 nuclear pores (120 nm, 8-fold), built as
//   sliced shells at their real heights (levels/nuc-shell.js): the camera passes through it with a hole opening at the centre.
//   Top: thin translucent membrane (clear face-on, denser edge-on). Bottom: the lamina-lined floor gives the cyan ball its body.
// - Chromatin: ~10^5 nucleosomes in irregular chains packed into domains (levels/nuc-chain.js), drawn by GL in depth bands.
// - Nucleolus (dense, 2.3 µm) and nuclear speckles (interchromatin granule clusters).
import * as G from './nuc-gl.js';
import { PAL, mix, rgba, spec, T, blob, solid, circle, UL, glow, screenSpace } from '../core/kit.js';
import { rng, clamp } from '../core/m.js';
import { NS, NM, loadNucleosome, glLook, atlas, strip, beadColor, lowerBound } from '../shared/nucleosome.js';
import { NUC, footPath, footR, nucR, PATH, inTunnel, pathAt } from './nuc-geom.js';
import { CH, buildChromatin, MIN_PX, ATOM_PX, atomSet } from './nuc-chain.js';
import { shellItems, snapBlur } from './nuc-shell.js';
import { NSOME } from '../core/anchors.js';
import { look, FAM, body, interior, deepFam, sink, f3 } from '../core/look.js';
import { focusAnchor } from './body-util.js';
const SPK_FAM = { base: FAM.cyan.lit, dark: FAM.cyan.base, lit: FAM.cyan.glow, glow: '#ffffff' };
const SPK = (() => { const R = rng(808), o = []; for (let i = 0; i < 16; i++) { const a = R() * 6.2832, d = Math.sqrt(R()) * 0.11; o.push([Math.cos(a) * d * 0.8, Math.sin(a) * d * 0.65, 0.011 + R() * 0.013]); } return o; })();
import { def } from '../core/world.js';

const UM = 1e-6;
const DEEP = '#0f0020';
// Outside: a cyan ball (the top membrane, dense edge-on). Inside: a deep-violet nucleoplasm floor (the lamina-lined bottom),
// with cyan/gold chromatin in front of it (complex-language/01, 08). The camera enters through an opening at the apex
// (a nuclear pore-sized gap exactly where its path crosses), so the membrane never has to pass in front of the lens.
// unification pass: the envelope is FAM.cyan (the reference's nucleus), one crescent on the whole silhouette (nuc-shell scr);
// the floor seen from inside is the INTERIOR medium of this scale (look(-6.3) warmed by violet), so entering is a step into the
// dark saturated medium, never a teal fog or a lavender wash
const ZIN = -6.3;
const MEM = {
  topBase: FAM.cyan.base, topDark: mix(FAM.cyan.dark, FAM.violet.dark, 0.45), topLit: FAM.cyan.lit,
  botBase: mix(look(ZIN).medium, mix(FAM.violet.base, FAM.cyan.dark, 0.5), 0.24), botDark: mix(look(ZIN).deep, FAM.violet.dark, 0.25),
};
const law = (a0, cap) => (bin, bins) => { const th = (bin + 0.5) / bins * Math.PI / 2; return Math.min(1 - Math.pow(1 - a0, 1 / Math.cos(th)), cap); };
const BINS = 10;
// the outer membrane's top is ONE flat tone (no edge-on rim densification: that read as a bevelled slab); the crescent does the shading
const flat = (a) => () => a;
const A_TOP_O = flat(0.45), A_TOP_I = flat(0.1), A_BOT_O = law(0.3, 0.7), A_BOT_I = law(0.97, 1);
const RREF = 4.4, RMAX = 5.2, RMIN = 3.0, GAP = NUC.env;
const innerS = 1 - GAP / RREF;

// ---------- nuclear pores: ~3,000 (Fibonacci-spaced on the envelope), drawn on the outer membrane's slices ----------
const PORES = []; const poreSlices = new Map();
{
  const n = 3000, ga = Math.PI * (3 - Math.sqrt(5)), R = rng(77);
  for (let i = 0; i < n; i++) {
    const zc = R() * 2 - 1, th = Math.acos(zc), ph = R() * 6.2832; // random (not a lattice: a lattice read as a grid)
    const half = th < Math.PI / 2 ? 1 : -1, tp = half > 0 ? th : Math.PI - th, bin = Math.min(BINS - 1, Math.floor(tp / (Math.PI / 2) * BINS));
    const f = footR(ph), x = Math.sin(th) * f * Math.cos(ph), y = Math.sin(th) * f * Math.sin(ph);
    PORES.push({ x, y, z: NUC.c * Math.cos(th), ph, fs: Math.max(0.25, Math.abs(Math.cos(tp))), half, bin, rot: R() * 0.8 });
  }
  const unitDark = new Path2D(); unitDark.arc(0, 0, 0.056, 0, 6.2832);
  const unitLight = new Path2D(); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.2832; unitLight.moveTo(Math.cos(a) * 0.044 + 0.016, Math.sin(a) * 0.044); unitLight.arc(Math.cos(a) * 0.044, Math.sin(a) * 0.044, 0.016, 0, 6.2832); }
  unitLight.moveTo(0.019, 0); unitLight.arc(0, 0, 0.019, 0, 6.2832);
  for (const p of PORES) {
    const key = p.bin + ':' + p.half; let s = poreSlices.get(key); if (!s) poreSlices.set(key, (s = { dark: new Path2D(), light: new Path2D(), list: [] }));
    const c = Math.cos(p.ph), sn = Math.sin(p.ph), m = new DOMMatrix([c * p.fs, sn * p.fs, -sn, c, p.x, p.y]); // radial axis foreshortened
    s.dark.addPath(unitDark, m); s.light.addPath(unitLight, m.rotate(p.rot * 57.3)); s.list.push(p);
  }
}
// pores: low contrast on the membrane (a texture, not confetti); the floor's pores (seen from inside, nuclear baskets) fainter still
const PORE = { 1: [rgba(FAM.cyan.dark, 0.22), rgba(FAM.cyan.glow, 0.28)], [-1]: [rgba(MEM.botDark, 0.3), rgba(FAM.violet.lit, 0.14)] };
function poreDeco(c, bin, half, A, sc) {
  const s = poreSlices.get(bin + ':' + half); if (!s) return; const P = PORE[half];
  c.fillStyle = P[0]; c.fill(s.dark); if (0.056 * sc > 2.2) { c.fillStyle = P[1]; c.fill(s.light); }
}
function specDeco(c, bin, half) { if (half > 0 && bin === 3) spec(c, 0, 0, 0.3 * RREF, 0.16 * RREF, FAM.cyan.glow, 0.5); }

// ---------- nucleolus + nuclear speckles (µm, mnuc) ----------
const NUCLEOLUS_FAM = deepFam(FAM.cyan, ZIN, 0.45);
const NUCLEOLUS = { p: [1.9, -1.15, -0.55], r: 1.15, seed: 31 };
const SPECKLES = []; { const R = rng(515); let g = 0; while (SPECKLES.length < 16 && g++ < 4000) { const p = [(R() * 2 - 1) * 4.6, (R() * 2 - 1) * 3.5, (R() * 2 - 1) * 2.4], r = 0.28 + R() * 0.4;
  if (nucR(...p) > 0.8 || Math.hypot(p[0] - NUCLEOLUS.p[0], p[1] - NUCLEOLUS.p[1], p[2] - NUCLEOLUS.p[2]) < NUCLEOLUS.r + r + 0.3) continue;
  SPECKLES.push({ p, r, seed: (R() * 1e6) | 0, n: 18 + ((R() * 14) | 0) }); } }

let ready = false; let HOLE = null; // [x, y, r] µm: the opening at the apex where the camera's path crosses the envelope
function init() {
  if (ready || !NS.ready) return; if (!G.initGL(glLook())) return;
  def('atom', 'nsome', NS.heroP.map((v) => v * NM)); // the camera path (and the tunnel) must already dive to the hero carbon
  atlas(); strip(); buildChromatin();
  // the tunnel rule also clears speckles from the camera's way
  for (let i = SPECKLES.length - 1; i >= 0; i--) { const s = SPECKLES[i]; if (inTunnel(s.p[0] * 1000, s.p[1] * 1000, s.p[2] * 1000, s.r * 1000, NSOME[2] / NM)) SPECKLES.splice(i, 1); }
  { const h = NUC.c * Math.cos(0.5 / BINS * Math.PI / 2); const [x, y] = pathAt(h * 1000); HOLE = [x / 1000, y / 1000, 0.3, 0.55, 0.8, 1.05, 1.3, 1.6, 1.95]; }
  ready = true;
}

// ---------- chromatin depth bands ----------
const SAT = (c) => { const l = c[0] * 0.3 + c[1] * 0.5 + c[2] * 0.2; return c.map((v) => Math.min(1, Math.max(0, l + (v - l) * 1.15))); };
function chromatin(V, items) {
  if (!CH.ready) return;
  const A = atlas(), S = strip(); if (!A || !S) return;
  const e = V.c('mnuc'), camH = e.p[2] / NM, D = V.D / NM, near = V.near / NM;
  const X = G.camXf(V, 'mnuc', [0, 0, 0], null, NM); const AS = atomSet(V);
  const zmin = Math.min(CH.spr.zs[0], CH.seg.zs[0]), zmax = Math.max(CH.spr.zs[CH.spr.n - 1], CH.seg.zs[CH.seg.n - 1]);
  const dN = Math.max(near, camH - zmax - 8), dF = camH - zmin + 8; if (dF <= near) return;
  // nucleus screen box (crop for the blit)
  const pc = V.P('mnuc', [0, 0, 0]); const rr = pc[2] > 0 ? 6.5 * UM * V.f / Math.max(pc[2] - 3.2 * UM, V.near) : 1e9;
  const box = [pc[0] - rr, pc[1] - rr, pc[0] + rr, pc[1] + rr];
  // fixed band edges (multiples of the focus distance): bands never merge or re-split as z changes, so nothing jumps between blurs
  G.setFog(f3(look(V.z).haze), 0.62, 1.0 * D, 2.8 * D); // far chromatin sinks into the medium (continuous with depth)
  const E = [0.62, 0.86, 1.22, 2.1].map((k) => k * D); const edges = [Math.min(dN, E[0] * 0.999), ...E, Math.max(dF, E[3] * 1.001)];
  for (let k = edges.length - 2; k >= 0; k--) {
    const d0 = edges[k], d1 = edges[k + 1], zLo = camH - d1, zHi = camH - d0;
    const s0 = lowerBound(CH.spr.zs, zLo), s1 = lowerBound(CH.spr.zs, zHi), g0 = lowerBound(CH.seg.zs, zLo), g1 = lowerBound(CH.seg.zs, zHi);
    if (s1 <= s0 && g1 <= g0) continue;
    const b = G.band(V); if (!b) break;
    G.drawSegs(V, X, CH.seg, g0, g1, S, { near, min: MIN_PX, chainW: 9.5, dnaW: 2 * 1.1, chainC: SAT(beadColor()), dnaC: f3(FAM.cyan.base), ex: AS.ex, nex: AS.n });
    G.drawSprites(V, X, CH.spr, s0, s1, A, { near, min: MIN_PX, ex: AS.ex, nex: AS.n });
    b.box = box;
    // representative depth = geometric mean of the depths actually occupied in this band (not of the band edges)
    let zA = 1e9, zB = -1e9; if (s1 > s0) { zA = Math.min(zA, CH.spr.zs[s0]); zB = Math.max(zB, CH.spr.zs[s1 - 1]); } if (g1 > g0) { zA = Math.min(zA, CH.seg.zs[g0]); zB = Math.max(zB, CH.seg.zs[g1 - 1]); }
    const dm = Math.sqrt(Math.max(camH - zB, d0, near * 2) * Math.max(Math.min(camH - zA, d1), near * 3)) * NM;
    items.push({ name: 'chromatin', d: dm, blur: V.coc(dm), draw(c) { G.blit(c, b); } });
  }
  G.setFog([0, 0, 0], 0);
}

export default {
  id: 'nucleus', zr: [-34.6, -2.9],
  async load(ctx) { await loadNucleosome(ctx); },
  frames(t) { if (!ready) init(); },
  draw(V, items, labels) {
    if (!ready) return;
    const t = V.t;
    // ---- envelope: outer + inner membrane, both halves
    const base = { fr: 'mnuc', O: [0, 0, 0], unit: UM, Rref: RREF, Rmax: RMAX, Rmin: RMIN, bins: BINS, so: 0.2,
      base: (i, h) => (h > 0 ? MEM.topBase : MEM.botBase), dark: (i, h) => (h > 0 ? MEM.topBase : MEM.botBase),
      scr: (h) => (h > 0 ? { dark: MEM.topDark, lit: MEM.topLit, so: 0.16, lo: 0.05 } : { dark: MEM.botDark, so: 0.12 }) };
    shellItems(V, items, { ...base, name: 'envelope', key: 'envO', fp: (s) => footPath(s), c: NUC.c, hole: HOLE, composite: true, overlap: 0.6, alpha: (i, h) => (h > 0 ? A_TOP_O(i, BINS) : A_BOT_O(i, BINS)),
      deco: (c, i, h, A, sc) => { poreDeco(c, i, h, A, sc); specDeco(c, i, h);
        if (h > 0 && Math.hypot(HOLE[0], HOLE[1]) / RREF >= Math.sin(i / BINS * Math.PI / 2) * 0.98 && Math.hypot(HOLE[0], HOLE[1]) / RREF < Math.sin((i + 1) / BINS * Math.PI / 2) * 1.02) { // the opening we fly through, ringed like a nuclear pore (8 spokes)
          c.fillStyle = PORE[1][1]; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.2832; c.beginPath(); c.arc(HOLE[0] + Math.cos(a) * 0.34, HOLE[1] + Math.sin(a) * 0.34, 0.04, 0, 6.2832); c.fill(); } } } });
    shellItems(V, items, { ...base, name: 'envelope', key: 'envI', fp: (s) => footPath(s * innerS), c: NUC.c - GAP, hole: HOLE, composite: true, overlap: 0.6, Rref: RREF * innerS, alpha: (i, h) => (h > 0 ? A_TOP_I(i, BINS) : A_BOT_I(i, BINS)) });
    // ---- nucleolus
    { const p = NUCLEOLUS.p; const A = V.layer('mnuc', [p[0] * UM, p[1] * UM, p[2] * UM], [UM, 0, 0], [0, UM, 0]);
      if (A && Math.hypot(A.a, A.b) * NUCLEOLUS.r > 0.4 && V.onScreen(A.e, A.f, Math.hypot(A.a, A.b) * NUCLEOLUS.r * 1.3)) items.push({ name: 'nucleolus', d: A.depth, blur: V.coc(A.depth), draw(c) {
        T(c, A); c.save(); c.scale(NUCLEOLUS.r, NUCLEOLUS.r); const b = blob(NUCLEOLUS.seed, 0.1, 6, 0, 72);
        body(c, b, NUCLEOLUS_FAM, { so: 0.14, lo: 0.05, hi: false });
        const R = rng(9); c.fillStyle = rgba(FAM.cyan.lit, 0.4);
        for (let k = 0; k < 7; k++) { const a = R() * 6.28, d = R() * 0.55, r = 0.1 + R() * 0.08; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, 6.2832); c.fill(); }
        c.fillStyle = rgba(FAM.cyan.glow, 0.22); for (let k = 0; k < 90; k++) { const a = R() * 6.28, d = Math.sqrt(R()) * 0.85, r = 0.022 + R() * 0.02; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, 6.2832); c.fill(); }
        c.restore(); } }); }
    // ---- speckles (granule clusters)
    for (const s of SPECKLES) {
      const A = V.layer('mnuc', [s.p[0] * UM, s.p[1] * UM, s.p[2] * UM], [UM, 0, 0], [0, UM, 0]); if (!A) continue; const sc = Math.hypot(A.a, A.b);
      if (sc * s.r < 0.4 || !V.onScreen(A.e, A.f, sc * s.r * 1.4)) continue;
      items.push({ name: 'speckle', d: A.depth, blur: V.coc(A.depth), draw(c) {
        T(c, A); c.save(); c.scale(s.r, s.r); c.fillStyle = rgba(FAM.cyan.lit, 0.07); c.fill(blob(s.seed, 0.16, 5));
        const R = rng(s.seed); c.fillStyle = rgba(FAM.cyan.lit, 0.36);
        for (let k = 0; k < s.n; k++) { const a = R() * 6.28, d = Math.sqrt(R()) * 0.8, r = 0.035 + R() * 0.03; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, 6.2832); c.fill(); }
        c.restore(); } });
    }
    chromatin(V, items);
    // (integration fix) crossing the envelope (z ≈ -5.5) had nothing sharp: a nuclear speckle (interchromatin granule cluster)
    // sits at that zoom's focus, off the camera axis — a cluster of small cyan orbs (the reference's granules)
    { const Af = focusAnchor(-5.47, 0.22, -0.1), q = V.P(Af.fr, Af.p); if (q[2] > V.near * 2) { const k = Af.W * V.f / q[2];
      if (k * 0.14 > 2 && V.onScreen(q[0], q[1], k * 0.2)) items.push({ name: 'speckle-hero', d: q[2], blur: V.coc(q[2]), draw(c) { screenSpace(c);
        for (const [x, y, rr] of SPK) { c.save(); c.translate(q[0] + x * k, q[1] + y * k); c.scale(rr * k, rr * k); body(c, circle, SPK_FAM, { so: 0.2, lo: 0 }); c.restore(); } } }); } }
    // ---- labels (one at a time, on the thing)
    if (V.z < -4.75 && V.z > -5.5) { const p = V.P('mnuc', [1.2 * UM, 1.9 * UM, NUC.c * UM]); if (p[2] > 0) labels.push({ x: p[0], y: p[1], text: 'Macrophage nucleus · 10 µm', sub: '~2 m of DNA packed inside' }); }
    else if (V.z < -5.75 && V.z > -6.3) {
      let best = null, bd = 1e9; for (const q of PORES) { if (q.half < 0) continue; const p = V.P('mnuc', [q.x * UM, q.y * UM, q.z * UM]); if (p[2] <= V.near) continue; const dd = Math.hypot(p[0] - V.cx * 1.25, p[1] - V.cy * 0.7); if (dd < bd) { bd = dd; best = p; } }
      if (best) labels.push({ x: best[0] + 14, y: best[1] - 8, text: 'Nuclear pore · 120 nm', sub: '~3,000 per nucleus' });
    } else if (V.z < -6.6 && V.z > -7.35) { // beside a fixed nucleosome of the hero's chain (the next one), at its right edge
      const b = CH.beads[2], p = V.P('mnuc', b.p.map((v) => v * NM)); if (p[2] > V.near) { const r = 6 * NM * V.f / p[2];
        labels.push({ x: p[0] + r + 230 > V.w ? p[0] - r - 230 : p[0] + r + 12, y: p[1] - 12, text: 'Chromatin', sub: 'DNA wound on histones · 5–24 nm chains' }); } }
  },
};
