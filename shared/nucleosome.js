// Shared nucleosome look (owner: NUCLEUS agent). ONE definition of the nucleosome, used by the chromatin beads
// (levels/nucleus.js) and by the hero nucleosome at the DNA scale (levels/dna.js), so the bead the camera dives into is
// the same object. The atoms are the real crystal structure PDB 1KX5 (assets/pdb/SOURCES.md).
//
// Stable API (keep):
//   drawNucleosome(c, rUnits, seed, t, detail)  — 2D context, unit space centred, rUnits = 5.5 nm (disc radius) in caller units.
// Extended API (this agent):
//   loadNucleosome(ctx)        — loads the atoms once (call from a level's load()).
//   NS                         — decoded atoms (canonical nucleosome frame, nm) + derived data (DNA end frames, templates).
//   ATOM_LOOK, atomColor(cls)  — the one atom look: stacked translucent electron-cloud shells with Kurzgesagt flat shading.
//   ORIENT[k]                  — the bead orientations (k = 0 is the hero nucleosome). orientModel(k) → GL model sorted by height.
//   atlas(), strip()           — GL sprite atlas (orientation × depth slab) and the linker-DNA strip texture.
//   linkerAtoms(F0, nbp, ph)   — atoms of a straight B-DNA linker continuing frame F0.
import { PAL, rgb, mix, L as LIGHT, ball } from '../core/kit.js';
import { FAM } from '../core/look.js';
import { rotX, rotZ, rotY, mm, mv, mT, cross, norm, sub, add, mul, dot, I3 } from '../core/m.js';
import * as G from '../levels/nuc-gl.js';

export const NM = 1e-9;
export const BEAD_R = 5.5;                 // nm, disc radius of the core particle (11 nm across)
export const VDW = [0.170, 0.155, 0.152, 0.180, 0.180]; // nm, Bondi van der Waals radii: C N O P S (research/SCIENCE.md I-9)
export const RISE = 0.338, TWIST = 360 / 10.5 * Math.PI / 180; // B-DNA: 0.338 nm/bp, 10.5 bp/turn

// ---------- the atom look ----------
// An atom is a stack of concentric, translucent electron-cloud shells (constant-alpha material, thicker where seen edge-on:
// alpha = 1 - (1 - a0)^(1 / cos θ), θ quantised in `bins` flat steps). Each shell has a darker crescent away from the light
// (offset `so` of its radius) and the outer shell carries a flat highlight ellipse toward the light (kit.spec geometry).
// The GL shader (levels/nuc-gl.js) and the 3D sliced shells (levels/nuc-shell.js) both evaluate exactly this model.
// Volumetric: s = Gaussian widths (fractions of the van der Waals radius R), a = amplitudes (optical depth per R): a hollow-cored
// cloud (outer minus inner Gaussian). bins = number of flat alpha steps.
// unification pass: every non-hero atom drawn at 0.8 of its size so the medium shows between them (sprites, linker strip and
// real atoms all use it, so the bead -> atoms switch stays faithful); the hero carbon keeps its full size
export const ATOM_RMUL = 0.8;
export const ATOM_LOOK = { s: [0.62, 0.3], a: [3.2, 2.6], bins: 7, cap: 1, so: 0.24, hiA: 0.3 };
// DNA backbone teal-cyan, base-pair rungs gold (the ladder reads, complex-language/08), histones magenta (H3/H4) and pink (H2A/H2B): cyan chromatin
// with magenta histone beads on the deep-violet nucleoplasm (complex-language/01, 08), continuing the macrophage palette. (Gold
// histones were tried: gold + cyan averages to khaki/olive wherever beads are small, which the reviewers rejected.)
// unification pass: the four groups are the FAM families (backbone cyan, base pairs gold, H3/H4 magenta, H2A/H2B magenta lit),
// each atom's shadow is its family's own dark step (not a shared purple), element variation is a small step inside the family
const FAMS = [FAM.cyan, FAM.gold, FAM.magenta, { base: FAM.magenta.lit, dark: FAM.magenta.base }];
const GROUPS = FAMS.map((f) => f.base);
const ELMOD = [(c) => c, (c) => mix(c, FAM.violet.base, 0.12), (c) => mix(c, '#ffffff', 0.08), (c) => mix(c, '#ffffff', 0.18), (c) => mix(c, FAM.gold.lit, 0.35)];
export const CLS = []; // [group*5 + element] -> { base, dark }
for (let g = 0; g < 4; g++) for (let e = 0; e < 5; e++) { const b = ELMOD[e](GROUPS[g]); CLS.push({ base: b, dark: mix(ELMOD[e](FAMS[g].dark), FAM.violet.dark, 0.25) }); }
export const clsOf = (type, el) => (type === 0 ? 0 : type === 1 ? 1 : type <= 3 ? 2 : 3) * 5 + el;
const f3 = (h) => rgb(h).map((v) => v / 255);
export function glLook() {
  const l = Math.hypot(LIGHT[0], LIGHT[1]);
  return { base: new Float32Array(CLS.flatMap((c) => f3(c.base)).concat(new Array(12).fill(0))), dark: new Float32Array(CLS.flatMap((c) => f3(c.dark)).concat(new Array(12).fill(0))),
    hi: new Float32Array(f3('#f4feff')), hiA: ATOM_LOOK.hiA, s: new Float32Array([...ATOM_LOOK.s, 0, 0, 0, 0, 0, 0, 0, 0].slice(0, 8)), a: new Float32Array([...ATOM_LOOK.a, 0, 0, 0, 0, 0, 0, 0, 0].slice(0, 8)),
    ns: ATOM_LOOK.s.length, bins: ATOM_LOOK.bins, cap: ATOM_LOOK.cap, so: ATOM_LOOK.so, L: [LIGHT[0] / l, LIGHT[1] / l], s1c: new Float32Array(f3(PAL.eCloudHi)), s1d: new Float32Array(f3(mix(PAL.eCloudHi, PAL.eCloud, 0.6))) };
}
// shell alpha for slice bin b of shell k (shared with the sliced 3D renderer)
export function shellAlpha(k, bin) { const th = (bin + 0.5) / ATOM_LOOK.bins * Math.PI / 2; return Math.min(1 - Math.pow(1 - ATOM_LOOK.a[k], 1 / Math.cos(th)), ATOM_LOOK.cap); }

// ---------- rigid transforms {R (3x3 row-major, local -> parent), t} ----------
export const X = (R, t) => ({ R, t });
export const xc = (A, B) => ({ R: mm(A.R, B.R), t: add(mv(A.R, B.t), A.t) });
export const xi = (A) => { const Rt = mT(A.R); return { R: Rt, t: mul(mv(Rt, A.t), -1) }; };
export const xp = (A, p) => add(mv(A.R, p), A.t);
const STEP = { R: rotZ(TWIST), t: [0, 0, RISE] }, STEPI = xi(STEP);
export function stepN(n) { let A = { R: I3(), t: [0, 0, 0] }; const S = n >= 0 ? STEP : STEPI; for (let i = 0; i < Math.abs(n); i++) A = xc(A, S); return A; }

// ---------- data ----------
export const NS = { ready: false };
let loading = null;
export function loadNucleosome(ctx) {
  if (!loading) loading = (async () => {
    const [meta, buf] = await Promise.all([ctx.json('assets/pdb/1kx5.json'), ctx.buf('assets/pdb/1kx5.bin')]);
    decode(meta, buf); derive(); NS.ready = true;
  })();
  return loading;
}
function decode(meta, buf) {
  const n = meta.n, dv = new DataView(buf); NS.n = n;
  const pos = NS.pos = new Float32Array(n * 3), type = NS.type = new Uint8Array(n), el = NS.el = new Uint8Array(n), ch = NS.chain = new Uint8Array(n);
  const code = NS.code = new Uint8Array(n), res = NS.res = new Int16Array(n), cls = NS.cls = new Uint8Array(n), rad = NS.rad = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 12; pos[i * 3] = dv.getInt16(o, true) / 1000; pos[i * 3 + 1] = dv.getInt16(o + 2, true) / 1000; pos[i * 3 + 2] = dv.getInt16(o + 4, true) / 1000;
    type[i] = dv.getUint8(o + 6); el[i] = dv.getUint8(o + 7); ch[i] = dv.getUint8(o + 8); code[i] = dv.getUint8(o + 9); res[i] = dv.getInt16(o + 10, true);
    cls[i] = clsOf(type[i], el[i]); rad[i] = VDW[el[i]] * 0.84; // drawn a little under the vdW radius so the structure reads
  }
}
const P3 = (i) => [NS.pos[i * 3], NS.pos[i * 3 + 1], NS.pos[i * 3 + 2]];
function findAtom(strand, resno, codeWanted) { for (let i = 0; i < NS.n; i++) if (NS.type[i] <= 1 && NS.chain[i] === strand && NS.res[i] === resno && NS.code[i] === codeWanted) return i; return -1; }
// base-pair frame i (strand I residue i pairs with strand J residue -i): origin = C1' midpoint, y = C1'(I) -> C1'(J),
// z = local helix axis (along increasing i, from the midpoints of the neighbouring pairs), x = y × z
function bpMid(i) { const a = findAtom(0, i, 1), b = findAtom(1, -i, 1); if (a < 0 || b < 0) return null; const pa = P3(a), pb = P3(b); return { m: mul(add(pa, pb), 0.5), y: norm(sub(pb, pa)) }; }
function bpFrame(i, span = 2) {
  const c = bpMid(i); let lo = bpMid(Math.max(-73, i - span)), hi = bpMid(Math.min(73, i + span));
  const zr = norm(sub(hi.m, lo.m)); const y = norm(sub(c.y, mul(zr, dot(c.y, zr)))); const x = norm(cross(y, zr)); const z = cross(x, y);
  return { R: [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]], t: c.m };
}
function derive() {
  // DNA end frames (entry at bp -73, exit at bp +73; both z along increasing bp index)
  NS.EA = bpFrame(-72, 1); NS.EA = xc(NS.EA, stepN(-1)); // the -73 pair is often frayed: extrapolate one ideal step from -72
  NS.EB = bpFrame(72, 1); NS.EB = xc(NS.EB, stepN(1));
  // linker templates: 3 consecutive base pairs (both nucleotides), in their own bp frame
  NS.tpl = [20, 21, 22].map((t) => {
    const F = bpFrame(t, 2), Fi = xi(F), out = [];
    for (let i = 0; i < NS.n; i++) if (NS.type[i] <= 1 && ((NS.chain[i] === 0 && NS.res[i] === t) || (NS.chain[i] === 1 && NS.res[i] === -t))) out.push({ p: xp(Fi, P3(i)), cls: NS.cls[i], r: NS.rad[i] });
    return out;
  });
  // the hero nucleosome orientation and its two chain neighbours (two-angle chain: straight linkers that continue the DNA ends)
  NS.heroR = mm(rotZ(-28 * Math.PI / 180), rotX(-38 * Math.PI / 180));
  const H = { R: NS.heroR, t: [0, 0, 0] };
  NS.L1 = 41; NS.L2 = 46; // linker lengths (bp) to the previous / next nucleosome (human repeat ~185–200 bp → 38–53 bp linkers)
  NS.prev = xc(xc(xc(H, NS.EA), stepN(-(NS.L1 + 1))), xi(NS.EB));
  NS.next = xc(xc(xc(H, NS.EB), stepN(NS.L2 + 1)), xi(NS.EA));
  ORIENT.length = 0; ORIENT.push(NS.heroR, NS.prev.R, NS.next.R);
  const extra = [[0.3, 1.1, 2.0], [1.9, 0.4, 0.8], [2.7, 2.2, 0.2], [0.9, 2.9, 1.4], [2.2, 1.5, 2.6]];
  for (const [a, b, c] of extra) ORIENT.push(mm(rotZ(a), mm(rotX(b), rotZ(c))));
  pickHero();
  pickHeroOnLinker();
}
// The hero carbon sits on the straight linker DNA leaving the previous nucleosome: the camera, diving to it, sees the double helix
// run across the frame (backbones + base-pair rungs + grooves) before it reaches the atom.
function pickHeroOnLinker() {
  const F0 = xc(NS.prev, NS.EB), lk = linkerAtoms(F0, NS.L1, 0), all = [];
  for (let i = 0; i < NS.n; i++) { all.push([NS.world0[i * 3], NS.world0[i * 3 + 1], NS.world0[i * 3 + 2], NS.rad[i]]); const q = xp(NS.prev, P3(i)); all.push([q[0], q[1], q[2], NS.rad[i]]); }
  lk.forEach((a) => all.push([a.p[0], a.p[1], a.p[2], a.r]));
  const per = lk.length / NS.L1; let best = null, bs = -1e9;
  lk.forEach((a, j) => { const bp = j / per; if (a.cls !== 0 || bp < NS.L1 * 0.3 || bp > NS.L1 * 0.7) return;
    let ok = true; for (const q of all) { const dz = q[2] - a.p[2]; if (dz <= 0.01) continue; if (Math.hypot(q[0] - a.p[0], q[1] - a.p[1]) < q[3] + 0.6 * a.r + dz * 0.35) { ok = false; break; } }
    if (ok && a.p[2] > bs) { bs = a.p[2]; best = a; } });
  if (best) { NS.heroP = best.p.slice(); NS.heroOnLinker = true; NS.heroCls = best.cls; }
}
export const ORIENT = [];

// ---------- the hero atom: a DNA carbon on the near (camera) face, not occluded from above ----------
function pickHero() {
  const R = NS.heroR, n = NS.n, w = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const p = mv(R, P3(i)); w[i * 3] = p[0]; w[i * 3 + 1] = p[1]; w[i * 3 + 2] = p[2]; }
  const cand = []; for (let i = 0; i < n; i++) if (NS.type[i] === 0 && NS.el[i] === 0) cand.push(i);
  cand.sort((a, b) => w[b * 3 + 2] - w[a * 3 + 2]);
  let best = -1, bestScore = -1e9;
  for (const i of cand.slice(0, 400)) {
    const xi_ = w[i * 3], yi = w[i * 3 + 1], zi = w[i * 3 + 2]; let ok = true;
    for (let j = 0; j < n && ok; j++) { if (j === i) continue; const dz = w[j * 3 + 2] - zi; if (dz <= -0.05) continue; const d = Math.hypot(w[j * 3] - xi_, w[j * 3 + 1] - yi);
      // nothing above may overlap this atom's disc, and nothing may sit in the camera's descent cone above it
      if (dz > 0 && d < NS.rad[j] + 0.6 * NS.rad[i] + dz * 0.35) ok = false; }
    if (!ok) continue;
    const score = zi * 1.0 - 0.06 * Math.hypot(xi_, yi) + (NS.code[i] === 1 ? 0.6 : 0);
    if (score > bestScore) { bestScore = score; best = i; }
  }
  NS.hero = best; NS.heroP = [w[best * 3], w[best * 3 + 1], w[best * 3 + 2]]; // nm, nsome frame
  // bonded neighbours (covalent, < 0.19 nm)
  NS.heroBonded = []; for (let j = 0; j < n; j++) if (j !== best && Math.hypot(w[j * 3] - NS.heroP[0], w[j * 3 + 1] - NS.heroP[1], w[j * 3 + 2] - NS.heroP[2]) < 0.19) NS.heroBonded.push(j);
  NS.world0 = w;
}

// ---------- GL models ----------
const models = new Map();
// atoms of orientation k (rotated into frame axes, nm), sorted by height (painter order for a camera looking down -z)
export function orientModel(k) {
  let m = models.get('o' + k); if (m) return m;
  const R = ORIENT[k], n = NS.n, idx = new Uint32Array(n), z = new Float32Array(n), P = [];
  for (let i = 0; i < n; i++) { const p = mv(R, P3(i)); P.push(p); z[i] = p[2]; idx[i] = i; }
  idx.sort((a, b) => z[a] - z[b]);
  const data = new Float32Array(n * 5), zs = new Float32Array(n), order = new Uint32Array(n);
  for (let j = 0; j < n; j++) { const i = idx[j], p = P[i]; data.set([p[0], p[1], p[2], NS.rad[i], NS.cls[i]], j * 5); zs[j] = p[2]; order[j] = i; }
  m = { data, zs, order, n, buf: G.glOK() ? G.buffer(data) : null }; models.set('o' + k, m); return m;
}
// a straight B-DNA linker: base pairs j = 1..nbp at frames F0 ∘ STEP^j (F0 = the last frame of the DNA it continues)
export function linkerAtoms(F0, nbp, ph = 0) {
  const out = []; let F = F0;
  for (let j = 1; j <= nbp; j++) { F = xc(F, STEP); const T = NS.tpl[(j + ph) % NS.tpl.length]; for (const a of T) out.push({ p: xp(F, a.p), cls: a.cls, r: a.r }); }
  return out;
}
export function modelFrom(atoms, key) {
  let m = key && models.get(key); if (m) return m;
  const s = atoms.slice().sort((a, b) => a.p[2] - b.p[2]); const data = new Float32Array(s.length * 5), zs = new Float32Array(s.length);
  s.forEach((a, j) => { data.set([a.p[0], a.p[1], a.p[2], a.r, a.cls], j * 5); zs[j] = a.p[2]; });
  m = { data, zs, n: s.length, atoms: s, buf: G.glOK() ? G.buffer(data) : null }; if (key) models.set(key, m); return m;
}
// index of the first atom with z >= v in a model's sorted heights
export function lowerBound(zs, v) { let lo = 0, hi = zs.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (zs[mid] < v) lo = mid + 1; else hi = mid; } return lo; }

// ---------- sprite atlas: every orientation, split into 4 height slabs (each slab is drawn at its own depth, so even
// the sprites keep their 2.5D parallax). Rendered with the same GL atom shader, orthographically. ----------
export const ATLAS = { TILE: 256, H: 12, slabs: [-1e9, -1.8, 0, 1.8, 1e9], zoff: [-2.7, -0.9, 0.9, 2.7] };
let atlasObj = null, strip2D = null, stripObj = null, beadAvg = null;
export function atlas() {
  if (atlasObj || !NS.ready || !G.glOK()) return atlasObj;
  const K = ORIENT.length, T = ATLAS.TILE, cols = 8, rows = Math.ceil(K * 4 / cols), W = cols * T, Hh = rows * T, k = T / (2 * ATLAS.H);
  const can = document.createElement('canvas'); can.width = W; can.height = Hh; const c2 = can.getContext('2d');
  const r = G.offscreen(W, Hh, () => {
    for (let o = 0; o < K; o++) { const m = orientModel(o);
      for (let s = 0; s < 4; s++) { const ti = o * 4 + s, cx = (ti % cols + 0.5) * T, cy = (Math.floor(ti / cols) + 0.5) * T;
        const i0 = lowerBound(m.zs, ATLAS.slabs[s]), i1 = lowerBound(m.zs, ATLAS.slabs[s + 1]);
        G.drawAtoms(null, { M: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), T: [0, 0, 0] }, m, i0, i1, { ortho: k, vp: [W, Hh], center: [cx, cy], bc: [0, 0, 0], br: 6.2, sat: 1, rmul: ATOM_RMUL }); } }
  });
  c2.drawImage(r.cv, 0, 0, W, Hh, 0, 0, W, Hh);
  atlasObj = { tex: G.texture(can), grid: [cols, rows], H: ATLAS.H, zoff: ATLAS.zoff, canvas: can, K };
  // mean colour of a bead (chain strokes below 1.5 px use it: same colour as the beads they replace)
  const t = document.createElement('canvas'); t.width = t.height = 1; const tc = t.getContext('2d'); tc.imageSmoothingQuality = 'high';
  const acc = [0, 0, 0, 0];
  for (let o = 0; o < K; o++) { tc.clearRect(0, 0, 1, 1); for (let s = 0; s < 4; s++) { const ti = o * 4 + s; tc.drawImage(can, (ti % cols) * T + T * 0.22, Math.floor(ti / cols) * T + T * 0.22, T * 0.56, T * 0.56, 0, 0, 1, 1); }
    const d = tc.getImageData(0, 0, 1, 1).data; for (let q = 0; q < 4; q++) acc[q] += d[q]; }
  const a = acc[3] / K / 255 || 1; beadAvg = [acc[0] / K / 255 / a, acc[1] / K / 255 / a, acc[2] / K / 255 / a];
  return atlasObj;
}
export const beadColor = () => beadAvg || f3(mix(PAL.protein2, PAL.dnaA, 0.4));
// the linker-DNA strip: two helical turns (21 bp, exactly periodic) seen side-on, axis along +x, rendered from the template atoms
export const STRIP = { pxPerNm: 40, halfW: 1.25 };
export function strip() {
  if (stripObj || !NS.ready || !G.glOK()) return stripObj;
  const per = 21 * RISE, W = Math.round(per * STRIP.pxPerNm), Hh = Math.round(2 * STRIP.halfW * STRIP.pxPerNm);
  const F0 = { R: [0, 0, 1, 0, 1, 0, -1, 0, 0], t: [-per - 6 * RISE, 0, 0] }; // z_local -> +x, y_local -> +y, x_local -> -z
  const atoms = linkerAtoms(F0, 21 * 3 + 12, 0); const m = modelFrom(atoms, null);
  const k = STRIP.pxPerNm, can = document.createElement('canvas'); can.width = W; can.height = Hh; const c2 = can.getContext('2d');
  const r = G.offscreen(W * 3, Hh, () => G.drawAtoms(null, { M: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), T: [0, 0, 0] }, m, 0, m.n, { ortho: k, vp: [W * 3, Hh], center: [W, Hh / 2], rmul: ATOM_RMUL }));
  // the middle period of three (seamless: the helix and the template cycle both repeat every 21 bp)
  c2.drawImage(r.cv, W, 0, W, Hh, 0, 0, W, Hh);
  stripObj = { tex: G.texture(can, { repeat: true }), period: per, canvas: can };
  const t = document.createElement('canvas'); t.width = t.height = 1; const tc = t.getContext('2d'); tc.drawImage(can, 0, Hh * 0.2, W, Hh * 0.6, 0, 0, 1, 1); const d = tc.getImageData(0, 0, 1, 1).data;
  const a = d[3] / 255 || 1; stripObj.avg = [d[0] / 255 / a, d[1] / 255 / a, d[2] / 255 / a];
  return stripObj;
}

// ---------- the stable 2D API ----------
export function drawNucleosome(c, r, seed = 0, t = 0, detail = 0) {
  const A = atlas();
  if (!A) { ball(c, 0, 0, r, PAL.protein2, mix(PAL.protein2, '#0f0020', 0.4), null); return; }
  const o = ((seed % A.K) + A.K) % A.K, T = ATLAS.TILE, s = r / BEAD_R * ATLAS.H; // half-size of a tile in caller units
  c.save(); c.scale(1, -1); // caller units are y-up (layers); the atlas tiles are y-down images
  for (let k = 0; k < 4; k++) { const ti = o * 4 + k; c.drawImage(A.canvas, (ti % A.grid[0]) * T, Math.floor(ti / A.grid[0]) * T, T, T, -s, -s, 2 * s, 2 * s); }
  c.restore();
}
