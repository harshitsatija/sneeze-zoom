// Chromatin (owner: NUCLEUS agent): irregular chains of nucleosomes ("beads on a string", 5–24 nm, no neat 30 nm solenoid —
// research/SCIENCE.md I-7, Ou et al. 2017 ChromEMT) packed into domains inside the macrophage nucleus.
// Every bead is the shared nucleosome (shared/nucleosome.js). Each linker is straight DNA leaving one nucleosome's exit end and
// entering the next one's entry end; the hero's two neighbours follow the exact two-angle geometry of their DNA ends.
// All positions in the 'mnuc' frame, nm. Drawn by GL in depth bands (levels/nuc-gl.js); beads < 1.5 px become chain strokes
// of the same width and colour; beads >= ATOM_PX become real atoms (levels/dna.js).
import * as G from './nuc-gl.js';
import { NS, ORIENT, NM, BEAD_R, RISE, xp, xc, atlas, strip, beadColor, ATLAS, lowerBound } from '../shared/nucleosome.js';
import { mv, norm, add, sub, mul, dot, cross, rng } from '../core/m.js';
import { NSOME } from '../core/anchors.js';
import { NUC, nucR, inTunnel, buildPath, PATH } from './nuc-geom.js';

export const ATOM_PX = 128, MIN_PX = 1.5;
export const CH = { ready: false, beads: [], segs: [] };
const HERO = NSOME.map((v) => v / NM); // nm in mnuc

function col(R, j) { return [R[j], R[3 + j], R[6 + j]]; }
function ends(o) {
  const R = ORIENT[o];
  return { inP: mv(R, NS.EA.t), inT: mv(R, col(NS.EA.R, 2)), outP: mv(R, NS.EB.t), outT: mv(R, col(NS.EB.R, 2)) };
}
// spatial hash for excluded volume
const CELL = 14; let grid = new Map();
const gk = (x, y, z) => ((Math.floor(x / CELL) * 73856093) ^ (Math.floor(y / CELL) * 19349663) ^ (Math.floor(z / CELL) * 83492791)) | 0;
function crowded(p, minD) {
  const cx = Math.floor(p[0] / CELL), cy = Math.floor(p[1] / CELL), cz = Math.floor(p[2] / CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    const l = grid.get((((cx + i) * 73856093) ^ ((cy + j) * 19349663) ^ ((cz + k) * 83492791)) | 0); if (!l) continue;
    for (const q of l) if ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2 < minD * minD) return true;
  }
  return false;
}
function addGrid(p) { const k = gk(p[0], p[1], p[2]); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(p); }
const ru = (R) => { const z = R() * 2 - 1, a = R() * 6.2832, s = Math.sqrt(1 - z * z); return [s * Math.cos(a), s * Math.sin(a), z]; };

function okPos(p, dom) {
  if (nucR(p[0] / 1000, p[1] / 1000, p[2] / 1000) > 0.94) return false;
  if (inTunnel(p[0], p[1], p[2], BEAD_R + 2, HERO[2])) return false;
  if (Math.hypot(p[0] - HERO[0], p[1] - HERO[1], p[2] - HERO[2]) < 30) return false; // breathing room around the hero nucleosome
  if (dom && Math.hypot(p[0] - dom.c[0], p[1] - dom.c[1], p[2] - dom.c[2]) > dom.r * 1.15) return false;
  return !crowded(p, 10.5);
}
// grow a chain from bead `b` (index) forward (dir = +1: exit -> next entry) or backward, n beads, confined to dom.
// When the walk is boxed in, it continues from another bead of the same domain (domains hold many chain segments).
function grow(b0, dir, n, dom, R) {
  let cur = b0, stuck = 0;
  for (let k = 0; k < n && stuck < 40; k++) {
    const B = CH.beads[cur], E = ends(B.o);
    const from = add(B.p, dir > 0 ? E.outP : E.inP), tan = dir > 0 ? E.outT : mul(E.inT, -1);
    let placed = -1;
    for (let tries = 0; tries < 24 && placed < 0; tries++) {
      const toC = sub(dom.c, from), dC = Math.hypot(...toC) / dom.r; const steer = mul(norm(toC), dom.k * dC * dC);
      const d = norm(add(add(mul(tan, 0.8 - tries * 0.03), mul(ru(R), 1.1 + tries * 0.08)), steer)); const nbp = 26 + Math.floor(R() * 36), len = nbp * RISE;
      const at = add(from, mul(d, len)); const o = Math.floor(R() * ORIENT.length); const E2 = ends(o);
      const c = sub(at, dir > 0 ? E2.inP : E2.outP);
      if (!okPos(c, dom)) continue;
      CH.beads.push({ p: c, o, dom: dom.i }); addGrid(c); placed = CH.beads.length - 1;
      CH.segs.push({ a: from, b: at, kind: 1, len, ph: R() * 21 * RISE, i: cur, j: placed });
      CH.segs.push({ a: B.p, b: c, kind: 0, len: 0, ph: 0, i: cur, j: placed });
    }
    if (placed < 0) { stuck++; k--; const pool = dom.members; cur = pool[Math.floor(R() * pool.length)]; dir = R() < 0.5 ? 1 : -1; continue; }
    dom.members.push(placed); cur = placed;
  }
}

export function buildChromatin() {
  if (CH.ready || !NS.ready) return;
  buildPath(); grid = new Map(); CH.beads = []; CH.segs = [];
  const R = rng(4242);
  // ---- the hero domain: the hero nucleosome at NSOME, its two exact neighbours, then the chain grows both ways
  const hdom = { i: 0, c: add(HERO, [40, -30, -60]), r: 330, k: 1.6, members: [0, 1, 2] };
  CH.beads.push({ p: HERO.slice(), o: 0, dom: 0, hero: true }); addGrid(CH.beads[0].p);
  const pP = add(HERO, NS.prev.t), pN = add(HERO, NS.next.t);
  CH.beads.push({ p: pP, o: 1, dom: 0, nb: true }); addGrid(pP); CH.beads.push({ p: pN, o: 2, dom: 0, nb: true }); addGrid(pN);
  const E0 = ends(0), E1 = ends(1), E2 = ends(2);
  CH.segs.push({ a: add(pP, E1.outP), b: add(HERO, E0.inP), kind: 1, len: NS.L1 * RISE, ph: 0, i: 1, j: 0, exact: 'prev' });
  CH.segs.push({ a: add(HERO, E0.outP), b: add(pN, E2.inP), kind: 1, len: NS.L2 * RISE, ph: 0, i: 0, j: 2, exact: 'next' });
  CH.segs.push({ a: pP, b: HERO.slice(), kind: 0, len: 0, ph: 0, i: 1, j: 0 }); CH.segs.push({ a: HERO.slice(), b: pN, kind: 0, len: 0, ph: 0, i: 0, j: 2 });
  grow(1, -1, 900, hdom, R); grow(2, +1, 900, hdom, R);
  // ---- other domains (chromatin territories / TAD-like clusters), Poisson-spaced through the nucleus
  const doms = [hdom]; let guard = 0;
  // domains along the camera's line of sight at the chromatin zooms: the -6.1 key looks at the nucleus centre, then the view
  // slides to the hero domain (so the focus plane is never empty)
  for (const [t, dz, r] of [[0, -120, 300], [0.42, -260, 240], [-0.35, 60, 260]]) doms.push({ i: doms.length, c: [HERO[0] * t + (t < 0 ? -380 : 0), HERO[1] * t + (t < 0 ? 260 : 0), HERO[2] * t + dz], r, k: 1.6, members: [] });
  doms.push({ i: doms.length, c: [HERO[0] * 0.84, HERO[1] * 0.84, HERO[2] - 270], r: 200, k: 1.6, members: [] }); // the view centre at z -6.5 … -7
  while (doms.length < 150 && guard++ < 20000) {
    const p = [(R() * 2 - 1) * NUC.a * 1000, (R() * 2 - 1) * NUC.b * 1000, (R() * 2 - 1) * NUC.c * 1000], r = 200 + R() * 140;
    if (nucR(p[0] / 1000, p[1] / 1000, p[2] / 1000) > 0.86) continue;
    if (doms.some((d) => Math.hypot(p[0] - d.c[0], p[1] - d.c[1], p[2] - d.c[2]) < (d.r + r) * 1.45)) continue;
    if (inTunnel(p[0], p[1], p[2], r * 0.6, HERO[2])) continue;
    doms.push({ i: doms.length, c: p, r, k: 1.6, members: [] });
  }
  for (const d of doms.slice(1)) {
    let s = -1; for (let t = 0; t < 30 && s < 0; t++) { const p = add(d.c, mul(ru(R), d.r * 0.5 * R())); if (okPos(p, d)) { CH.beads.push({ p, o: Math.floor(R() * ORIENT.length), dom: d.i }); addGrid(p); s = CH.beads.length - 1; } }
    if (s < 0) continue; d.members.push(s); const n = Math.round(1.25e-5 * (4 / 3) * Math.PI * d.r ** 3); grow(s, 1, n >> 1, d, R); grow(s, -1, n >> 1, d, R);
  }
  CH.doms = doms;
  // ---- GL buffers: (bead, slab) sprites sorted by height, segments sorted by mid height
  const S = []; CH.beads.forEach((b, i) => { for (let s = 0; s < 4; s++) S.push([b.p[0], b.p[1], b.p[2], b.o * 4 + s, b.p[2] + ATLAS.zoff[s]]); });
  S.sort((a, b) => a[4] - b[4]);
  const sd = new Float32Array(S.length * 4), sz = new Float32Array(S.length); S.forEach((e, i) => { sd[i * 4] = e[0]; sd[i * 4 + 1] = e[1]; sd[i * 4 + 2] = e[2]; sd[i * 4 + 3] = e[3]; sz[i] = e[4]; });
  const Sg = CH.segs.slice().sort((a, b) => (a.a[2] + a.b[2]) - (b.a[2] + b.b[2]));
  const gd = new Float32Array(Sg.length * 10), gz = new Float32Array(Sg.length);
  Sg.forEach((g, i) => { gd.set([g.a[0], g.a[1], g.a[2], g.b[0], g.b[1], g.b[2], g.kind, g.len, g.ph, 0], i * 10); gz[i] = (g.a[2] + g.b[2]) / 2; });
  CH.spr = { data: sd, zs: sz, n: S.length, buf: G.buffer(sd) }; CH.seg = { data: gd, zs: gz, n: Sg.length, buf: G.buffer(gd) };
  CH.segsOf = []; for (const g of CH.segs) { (CH.segsOf[g.i] ||= []).push(g); (CH.segsOf[g.j] ||= []).push(g); }
  // coarse grid of beads for near-camera queries (atom-level beads)
  CH.cg = new Map(); CH.beads.forEach((b, i) => { const k = Math.floor(b.p[0] / 200) + ',' + Math.floor(b.p[1] / 200) + ',' + Math.floor(b.p[2] / 200); let l = CH.cg.get(k); if (!l) CH.cg.set(k, (l = [])); l.push(i); });
  CH.ready = true;
  console.log('chromatin', CH.beads.length, 'beads', doms.length, 'domains', CH.segs.length, 'segs');
}
// The nucleosomes drawn from their atoms this frame: the (up to) MAX_ATOM nearest beads whose size is >= ATOM_PX.
// Every other bead stays a sprite (the sprite pass skips exactly these, by position). Memoised per frame.
export const MAX_ATOM = 16;
let memoV = null, memo = null;
export function atomSet(V) {
  if (V === memoV) return memo; memoV = V; memo = { list: [], ex: new Float32Array(48), n: 0, set: new Set() };
  if (!CH.ready) return memo;
  const e = V.c('mnuc'), cp = e.p.map((v) => v / NM), rq = BEAD_R * 2 * V.f / ATOM_PX + 20; const out = [];
  const c0 = [Math.floor((cp[0] - rq) / 200), Math.floor((cp[1] - rq) / 200), Math.floor((cp[2] - rq) / 200)], c1 = [Math.floor((cp[0] + rq) / 200), Math.floor((cp[1] + rq) / 200), Math.floor((cp[2] + rq) / 200)];
  if ((c1[0] - c0[0] + 1) * (c1[1] - c0[1] + 1) * (c1[2] - c0[2] + 1) <= 400)
    for (let x = c0[0]; x <= c1[0]; x++) for (let y = c0[1]; y <= c1[1]; y++) for (let z = c0[2]; z <= c1[2]; z++) {
      const l = CH.cg.get(x + ',' + y + ',' + z); if (!l) continue;
      for (const i of l) { const p = CH.beads[i].p; const c = V.cs('mnuc', [p[0] * NM, p[1] * NM, p[2] * NM]), d = c[2]; if (d <= -12 * NM) continue;
        const px = 2 * BEAD_R * V.f / (Math.max(d, 1e-3 * NM) / NM); if (px < ATOM_PX) continue;
        // on screen? (bead bounding sphere 10 nm, projected; beads beside or behind the camera are skipped)
        if (i > 1) { // the hero and its upstream neighbour (the hero carbon's linker joins them) always qualify
        if (d > 10 * NM) { const k = V.f / d, sx = V.cx + c[0] * k, sy = V.cy - c[1] * k; if (!V.onScreen(sx, sy, 10 * NM * k)) continue; }
        else if (Math.hypot(c[0], c[1]) > 10 * NM + d * 1.2) continue; }
        out.push({ i, depth: d, pri: i <= 1 ? 1e12 - i : px }); }
    }
  out.sort((a, b) => b.pri - a.pri); memo.list = out.slice(0, MAX_ATOM);
  memo.list.forEach((a, k) => { const p = CH.beads[a.i].p; memo.ex.set(p, k * 3); memo.set.add(a.i); }); memo.n = memo.list.length;
  return memo;
}
export const atomBeads = (V) => atomSet(V).list;
// linker segments touching an atom-level bead (drawn as atoms)
export function atomLinkers(V, beadSet) {
  const out = []; if (!CH.ready) return out;
  for (const i of beadSet) for (const g of CH.segsOf[i] || []) if (g.kind === 1 && !out.includes(g)) out.push(g);
  return out;
}
