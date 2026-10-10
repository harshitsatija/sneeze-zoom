// The septum mucosa seen from the airway: epithelium (ciliated + goblet cells), mucus rafts, the immune battle
// around the hero macrophage, a wound where shed cells expose the capillary bed, and airborne debris at every height.
// Frame 'muc': z = 0 is the apical surface of the epithelium, +z toward the camera. Drawing unit: 1 µm.
import { PAL, solid, crescent, spec, blob, circle, rgba, mix, glow, ball, T, screenSpace, pointLaw, UL, lightFor } from '../core/kit.js';
import { rng, clamp, ss, hash } from '../core/m.js';
import { neutrophil, macrophage, lymphocyte, pollen } from '../shared/immune.js';
import { MAC } from '../core/anchors.js';
import { faceClipFor, clipItems, slitOpen } from './man.js';
import { septum, mucusBody, MUCUS_WARM } from './body-septum.js';
import { viewBox, planeOK } from './body-util.js';

const UM = 1e-6;
// ---------- periodic epithelium: 16 × 16 jittered cells in a 96 µm period ----------
const NC = 16, PER = 96, SP = PER / NC;
const cells = [];
{ const r = rng(9); for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) cells.push({ x: (i + 0.5 + (j % 2) * 0.5 + (r() - 0.5) * 0.8) * SP, y: (j + 0.5 + (r() - 0.5) * 0.8) * SP, goblet: r() < 0.17, seed: (r() * 1e6) | 0, ph: r() }); }
function clipHalf(poly, px, py, nx, ny) { // keep side where (p - P)·n <= 0
  const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const da = (a[0] - px) * nx + (a[1] - py) * ny, db = (b[0] - px) * nx + (b[1] - py) * ny; if (da <= 0) out.push(a); if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return out;
}
for (const c of cells) {
  let poly = [[-SP * 1.5, -SP * 1.5], [SP * 1.5, -SP * 1.5], [SP * 1.5, SP * 1.5], [-SP * 1.5, SP * 1.5]];
  for (const o of cells) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
    if (o === c && !ox && !oy) continue; const dx = o.x + ox * PER - c.x, dy = o.y + oy * PER - c.y; if (dx * dx + dy * dy > (SP * 2.6) ** 2) continue;
    poly = clipHalf(poly, dx / 2, dy / 2, dx, dy);
  }
  // full polygon (for wound clipping) + shrunk rounded shape (for drawing: dark gaps between cells, like immune-actually/05)
  const full = new Path2D(); poly.forEach(([x, y], i) => (i ? full.lineTo(x * 1.02, y * 1.02) : full.moveTo(x * 1.02, y * 1.02))); full.closePath(); c.full = full;
  // rounded cell: distance to the Voronoi edge along 36 directions, low-pass filtered, shrunk (dark gaps between cells).
  // Kurzgesagt epithelium (immune-actually/05) = rounded ovals, never shards.
  const NA_ = 36, rad = [];
  for (let i = 0; i < NA_; i++) { const a = i / NA_ * 6.2832, dx = Math.cos(a), dy = Math.sin(a); let best = SP * 1.5;
    for (let q = 0; q < poly.length; q++) { const A = poly[q], B = poly[(q + 1) % poly.length], ex = B[0] - A[0], ey = B[1] - A[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue;
      const t = (A[0] * ey - A[1] * ex) / den, u = (A[0] * dy - A[1] * dx) / den; if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t); }
    rad.push(best); }
  let sm = rad; for (let pass = 0; pass < 3; pass++) sm = sm.map((v, i) => (sm[(i + NA_ - 1) % NA_] + 2 * v + sm[(i + 1) % NA_]) / 4);
  const n = 48, pts = []; for (let i = 0; i < n; i++) { const f = i / n * NA_, i0 = Math.floor(f) % NA_, i1 = (i0 + 1) % NA_, u = f - Math.floor(f), r = (sm[i0] * (1 - u) + sm[i1] * u) * 0.8, a = i / n * 6.2832; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  const p = new Path2D();
  const mid = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
  let m = mid(n - 1); p.moveTo(m[0], m[1]); for (let i = 0; i < n; i++) { const m2 = mid(i); p.quadraticCurveTo(pts[i][0], pts[i][1], m2[0], m2[1]); } p.closePath();
  c.path = p; c.r = Math.sqrt(Math.abs(pts.reduce((s, a, i) => s + a[0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * a[1], 0)) / 2 / Math.PI);
}
const CILIA_PH = 8; // animation phases for cilia (shared by raster tiles and vector cells, so the LOD switch is invisible)
function ciliaPhase(t) { return Math.floor(((t * 1.6) % 1 + 1) % 1 * CILIA_PH); }
// one epithelial cell, unit = µm, centred (Kurzgesagt: thick magenta ring with a lit lip, dark violet interior offset
// toward the light, cyan nucleus ball; goblet cells hold teal mucin granules; cilia are a muted fringe, not confetti)
function drawCell(c, ce, ph, detail) {
  c.save(); c.translate(ce.x, ce.y);
  c.fillStyle = PAL.tissue; c.fill(ce.path);
  crescent(c, ce.path, PAL.tissueLit, -UL[0] * 0.55, -UL[1] * 0.55);
  c.save(); c.translate(UL[0] * 0.3, UL[1] * 0.3); c.scale(0.74, 0.74); c.fillStyle = ce.goblet ? '#24064f' : PAL.cyto; c.fill(ce.path); c.restore();
  const R = rng(ce.seed);
  if (ce.goblet) {
    for (let k = 0; k < 6; k++) { const a = R() * 6.28, d = R() * ce.r * 0.35; c.fillStyle = k % 2 ? rgba(PAL.mucus, 0.8) : rgba(PAL.mucusDeep, 0.85); c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, ce.r * (0.15 + R() * 0.07), 0, 6.283); c.fill(); }
  } else {
    ball(c, ce.r * 0.12, -ce.r * 0.1, ce.r * 0.27, PAL.nuc, mix(PAL.nuc, '#0f0020', 0.45), PAL.spec, detail ? 0.85 : 0.6);
    // cilia: a muted fringe that sways in a metachronal wave
    const wave = ((ph / CILIA_PH) + (ce.x + ce.y * 0.4) / PER * 3) % 1, lean = Math.sin(wave * 6.283) * 0.5;
    c.strokeStyle = rgba('#7a1a8c', 0.75); c.lineCap = 'round'; c.lineWidth = 0.26; c.beginPath();
    for (let k = 0; k < 11; k++) { const a = R() * 6.28, d = (0.45 + R() * 0.3) * ce.r * 0.7, x = Math.cos(a) * d, y = Math.sin(a) * d, L = 0.9 + R() * 0.5; c.moveTo(x, y); c.quadraticCurveTo(x + lean * L * 0.4, y + L * 0.45, x + lean * L, y + L * 0.7); }
    c.stroke();
  }
  c.restore();
}
// the tile's average colour (its 1 px mip) and the lining tone the far epithelium takes
let _avg = null; function epiAvg() { if (_avg) return _avg; const t = tile(2, 0), g = document.createElement('canvas'); g.width = g.height = 1; const x = g.getContext('2d'); x.drawImage(t, 0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; _avg = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join(''); return _avg; }
const EPI_FAR = mix(MUCUS_WARM, PAL.tissue, 0.35);
// raster mip tiles of one period (identical drawing code → invisible switch to vector)
const MIPS = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]; const tiles = new Map();
function tile(px, ph) {
  const key = px + ':' + ph; let cv = tiles.get(key); if (cv) return cv;
  if (px < 64) { // small mips are box-filtered down from the 64 px tile (same drawing, no aliasing)
    const src = tile(px * 2, ph); cv = document.createElement('canvas'); cv.width = cv.height = px; const c = cv.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(src, 0, 0, px, px); tiles.set(key, cv); return cv; }
  cv = document.createElement('canvas'); cv.width = cv.height = px; const c = cv.getContext('2d'); const s = px / PER;
  c.fillStyle = PAL.bodyDeep; c.fillRect(0, 0, px, px);
  c.setTransform(s, 0, 0, -s, 0, px); lightFor(s, 0, 0, -s); // y-up µm, like the layer
  for (const ce of cells) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { if (ce.x + ox * PER < -SP * 1.2 || ce.x + ox * PER > PER + SP * 1.2 || ce.y + oy * PER < -SP * 1.2 || ce.y + oy * PER > PER + SP * 1.2) continue; c.save(); c.translate(ox * PER, oy * PER); drawCell(c, ce, ph, px >= 512); c.restore(); }
  tiles.set(key, cv); return cv;
}

// ---------- the battle zone (positions in µm, muc frame) ----------
const R0 = rng(31);
const actors = [];
for (let k = 0; k < 60; k++) { const a = R0() * 6.28, d = 22 + Math.pow(R0(), 1.4) * 520; actors.push({ kind: 'neu', x: MAC[0] / UM + Math.cos(a) * d, y: MAC[1] / UM + Math.sin(a) * d, r: 6 + R0() * 1.2, seed: (R0() * 1e6) | 0, vx: (R0() - 0.5) * 0.6, vy: (R0() - 0.5) * 0.6 }); }
for (let k = 0; k < 6; k++) { const a = R0() * 6.28, d = 60 + Math.sqrt(R0()) * 380; actors.push({ kind: 'mac', x: MAC[0] / UM + Math.cos(a) * d, y: MAC[1] / UM + Math.sin(a) * d, r: 9 + R0() * 2, seed: (R0() * 1e6) | 0, vx: 0, vy: 0 }); }
for (let k = 0; k < 7; k++) { const a = R0() * 6.28, d = 40 + Math.sqrt(R0()) * 380; actors.push({ kind: 'lym', x: MAC[0] / UM + Math.cos(a) * d, y: MAC[1] / UM + Math.sin(a) * d, r: 3.8, seed: (R0() * 1e6) | 0, vx: (R0() - 0.5) * 0.4, vy: (R0() - 0.5) * 0.4 }); }
for (let k = 0; k < 3; k++) { const a = R0() * 6.28, d = 120 + R0() * 300; const pol = { kind: 'pol', x: MAC[0] / UM + Math.cos(a) * d, y: MAC[1] / UM + Math.sin(a) * d, r: 12 + R0() * 2, seed: k * 7 + 1, z: 14 }; if (d > 330) actors.push(pol); } // keep the RNG sequence (golden layout); only far pollen stays
const infected = [];
for (let k = 0; k < 22; k++) { const a = R0() * 6.28, d = 28 + Math.pow(R0(), 1.3) * 420; const ce = cells[(R0() * cells.length) | 0]; infected.push({ x: MAC[0] / UM + Math.cos(a) * d, y: MAC[1] / UM + Math.sin(a) * d, ce, ph: R0() * 12, burst: R0() < 0.5 }); }
// further infection foci across Little's area: small patches of 1–4 infected ciliated cells (rhinovirus infects few cells)
for (let k = 0; k < 34; k++) { const a = R0() * 6.28, d = 480 + Math.pow(R0(), 0.9) * 2600; const n = 1 + ((R0() * 3.5) | 0); const x0 = MAC[0] / UM + Math.cos(a) * d, y0 = MAC[1] / UM + Math.sin(a) * d;
  for (let i = 0; i < n; i++) infected.push({ x: x0 + (R0() - 0.5) * 22, y: y0 + (R0() - 0.5) * 22, ce: cells[(R0() * cells.length) | 0], ph: R0() * 12, burst: false, far: true }); }
// the infected cell the label names: a real glowing one, right of the hero, nearest to it
const LABEL_INF = infected.filter((f) => !f.far && f.x > MAC[0] / UM + 25).sort((a, b) => Math.hypot(a.x - MAC[0] / UM, a.y - MAC[1] / UM) - Math.hypot(b.x - MAC[0] / UM, b.y - MAC[1] / UM))[0] || infected[0];
const hero = { kind: 'mac', x: MAC[0] / UM, y: MAC[1] / UM, r: 10.5, seed: 777 };
// virion clouds around bursting cells
const clouds = infected.filter((f) => f.burst).map((f) => { const R = rng(f.x * 13 | 0); const pts = []; for (let k = 0; k < 260; k++) { const a = R() * 6.28, d = Math.pow(R(), 0.6) * 14; pts.push([Math.cos(a) * d, Math.sin(a) * d, 2 + R() * 10]); } return { f, pts }; });
// mucus rafts: big translucent sheets 8–22 µm above the surface, with a gap above the hero
const rafts = []; { const R = rng(55); for (let k = 0; k < 16; k++) { const a = R() * 6.28, d = 60 + Math.pow(R(), 0.7) * 1100; const bubbles = [], specks = []; for (let i = 0; i < 3; i++) { const ba = R() * 6.283, bd = Math.sqrt(R()) * 0.6; bubbles.push([Math.cos(ba) * bd, Math.sin(ba) * bd, 0.04 + R() * 0.06]); } for (let i = 0; i < 8; i++) { const ba = R() * 6.283, bd = Math.sqrt(R()) * 0.8; specks.push([Math.cos(ba) * bd, Math.sin(ba) * bd, 0.012 + R() * 0.012, R() < 0.5]); }
  rafts.push({ x: MAC[0] / UM + Math.cos(a) * d, y: MAC[1] / UM + Math.sin(a) * d, r: 14 + R() * 30, z: 9 + R() * 14, seed: (R() * 1e6) | 0, bubbles, specks, ax: 1.1 + R() * 0.5, rot: (R() - 0.5) * 0.6 }); } }
// airborne debris: log-spaced heights up to 10 mm, sizes ∝ height (fly-through foreground at every zoom)
// airborne particles caught in the nose (pollen grains ~25 µm, mucus droplets 8–60 µm) at log-spaced heights, off the
// camera axis: recognisable, coloured foreground objects that fly past on the way down (no dark smudges)
const debris = []; { const R = rng(808); for (let o = 0; o < 9; o++) { const h = 14 * Math.pow(2, o); for (let k = 0; k < 3; k++) { const a = R() * 6.28, d = (0.32 + R() * 0.3) * h + 60; const pol = h > 90 && R() < 0.3;
  debris.push({ x: MAC[0] / UM + Math.cos(a) * d, y: MAC[1] / UM + Math.sin(a) * d, z: h * (0.75 + R() * 0.5), r: pol ? 11 + R() * 3 : 6 + R() * Math.min(40, h * 0.06), seed: (R() * 1e6) | 0, pol }); } } }
// the wound: shed epithelium exposing the capillary bed 40 µm below
const WOUND = { x: MAC[0] / UM - 34, y: MAC[1] / UM + 26, r: 10 };
// the shed cells: every (periodic) cell whose centre lies inside the wound radius
const woundCells = []; for (const ce of cells) for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const x = ce.x + Math.floor(WOUND.x / PER) * PER + i * PER, y = ce.y + Math.floor(WOUND.y / PER) * PER + j * PER; if (Math.hypot(x - WOUND.x, y - WOUND.y) < WOUND.r) woundCells.push({ ce, x, y }); }
const woundClip = new Path2D(); woundCells.forEach((w) => woundClip.addPath(w.ce.full, new DOMMatrix([1, 0, 0, 1, w.x, w.y])));
const MUCOSA_R = 14000; // µm: the visible septum wall region

export default {
  id: 'mucosa', zr: [-9, 1.2],
  async load() { for (let ph = 0; ph < CILIA_PH; ph++) for (const m of MIPS) tile(m, ph); }, // pre-render the mip tiles (no first-use stalls)
  draw(V, items, labels) { if (!slitOpen(V)) return; const n0 = items.length; this.draw0(V, items, labels); clipItems(items, n0, faceClipFor(V)); },
  draw0(V, items, labels) {
    // planar layer at (x, y, z) m; r = the object's radius (m). Culled when it cannot be in the view cone (looking down,
    // half-angle < 20°) — this also removes planes at or above the camera, whose first-order affine is meaningless.
    const cp = V.c('muc').p;
    const Lm = (x, y, z, r = 0) => { const dz = cp[2] - z; if (dz <= V.near * 3) return null; if (Math.hypot(x - cp[0], y - cp[1]) - r > 0.4 * dz + V.W) return null; return V.layer('muc', [x, y, z], [UM, 0, 0], [0, UM, 0]); };
    const A = V.layer('muc', [0, 0, 0], [UM, 0, 0], [0, UM, 0]); if (!A || cp[2] <= V.near * 3) return;
    const s = Math.hypot(A.a, A.b); // px per µm
    const t = V.t, ph = ciliaPhase(t);
    // ---- the epithelium sheet (cover when it fills the view)
    const coversView = V.covers(A.e, A.f, MUCOSA_R * s * 0.98);
    items.push({ name: 'epithelium', d: A.depth, blur: V.coc(A.depth), cover: coversView && s < 9e5, draw(c) {
      const perPx = PER * s; const useVector = perPx > 1024;
      if (!useVector) {
        const mip = MIPS.find((m) => m >= perPx) || 1024; const tl = tile(mip, ph); const pat = c.createPattern(tl, 'repeat');
        const k = PER / mip; pat.setTransform(new DOMMatrix([A.a * k, A.b * k, -A.c * k, -A.d * k, A.e + A.c * PER, A.f + A.d * PER]));
        c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = pat;
        const cellPx = SP * s, kA = clamp((40 - cellPx) / 30, 0, 1) * 0.55, kL = clamp((8 - cellPx) / 6, 0, 1) * 0.85;
        const fillIt = () => { if (coversView) c.fillRect(0, 0, V.w, V.h); else { T(c, A); c.beginPath(); c.arc(0, 0, MUCOSA_R, 0, 6.283); c.setTransform(1, 0, 0, 1, 0, 0); c.fill(); } };
        fillIt();
        // (unification pass) detail density by size: far cells are ring + core only (style ref §5), so a cell field smaller than
        // ~40 px per cell is laid under a flat coat of its own average colour (no static noise of nuclei); below ~8 px it takes
        // the lining's colour, so the thinning mucus never opens a dark "spotlight" onto the destination
        if (kA > 0.01) { c.fillStyle = rgba(epiAvg(), kA); fillIt(); }
        if (kL > 0.01) { c.fillStyle = rgba(EPI_FAR, kL); fillIt(); }
        if (!coversView) return;
        // cut the wound hole back out (draw the lamina below: handled by wound items drawn before) — mask with evenodd clip
      } else {
        // vector cells in view
        screenSpace(c); c.fillStyle = PAL.bodyDeep; c.fillRect(0, 0, V.w, V.h);
        T(c, A);
        const [x0, y0, x1, y1] = viewBox(A, V, 2); // µm bounds (the layer may be rotated: the head tilts)
        const i0 = Math.floor(Math.min(x0, x1) / PER) - 1, i1 = Math.floor(Math.max(x0, x1) / PER) + 1, j0 = Math.floor(Math.min(y0, y1) / PER) - 1, j1 = Math.floor(Math.max(y0, y1) / PER) + 1;
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const ce of cells) {
          const cx = ce.x + i * PER, cy = ce.y + j * PER; if (cx < Math.min(x0, x1) - SP || cx > Math.max(x0, x1) + SP || cy < Math.min(y0, y1) - SP || cy > Math.max(y0, y1) + SP) continue;
          c.save(); c.translate(i * PER, j * PER); drawCell(c, ce, ph, true); c.restore();
        }
      }
    } });
    // ---- the septum at mm scale: Kiesselbach's plexus, inflamed area, wet sheen, thick mucus sheets
    septum(V, items, A, t);
    // ---- the wound: shed cells expose the lamina propria 30 µm below: a capillary with red blood cells
    { const Aw = Lm(WOUND.x * UM, WOUND.y * UM, -30 * UM);
      if (false && Aw && s * WOUND.r > 1.5 && V.onScreen(...V.P('muc', [WOUND.x * UM, WOUND.y * UM, 0]).slice(0, 2), WOUND.r * 2 * s)) items.push({ name: 'wound', d: A.depth * (1 - 1e-9), blur: V.coc(Aw.depth), draw(c) {
        T(c, A); c.clip(woundClip);
        T(c, Aw); c.fillStyle = PAL.bodyMid; c.fillRect(-60, -60, 120, 120);
        // capillary: wall, lumen, flowing red blood cells
        const cap = new Path2D(); cap.moveTo(-60, -8); cap.bezierCurveTo(-20, 6, 10, -10, 60, 4); c.lineCap = 'round';
        c.strokeStyle = PAL.tissue; c.lineWidth = 11; c.stroke(cap); c.strokeStyle = mix(PAL.bodyDeep, PAL.rbcDark, 0.45); c.lineWidth = 8; c.stroke(cap);
        for (let k = 0; k < 8; k++) { const u = ((k / 8 + t * 0.02) % 1) * 120 - 60, y = -8 + (u + 60) / 120 * 12 + Math.sin(u * 0.05) * 5; c.save(); c.translate(u, y); c.rotate(0.2); c.scale(3.7, 3.2); solid(c, circle, PAL.rbc, { shadow: PAL.rbcDark, so: 0.25 }); c.fillStyle = PAL.rbcDark; c.beginPath(); c.ellipse(0.06, 0, 0.42, 0.5, 0, 0, 6.283); c.fill(); c.restore(); }
        c.save(); c.translate(8, 14); neutrophil(c, 6, 99, t); c.restore();
      } });
    }
    // ---- infected cells: glowing (active things glow), some bursting
    for (const f of infected) {
      const Af = Lm(f.x * UM, f.y * UM, 0.4 * UM, 40 * UM); if (!Af) continue; const sp = Math.hypot(Af.a, Af.b);
      if (!V.onScreen(Af.e, Af.f, 40 * sp)) continue;
      const pulse = 0.85 + 0.15 * Math.sin(t * 2.2 + f.ph); if (sp * 20 < 0.15) continue;
      items.push({ name: 'infected', d: Af.depth, blur: V.coc(Af.depth), draw(c) {
        screenSpace(c); { const [gr, ga] = pointLaw(13 * sp * pulse, 3); glow(c, Af.e, Af.f, gr, PAL.glow, 0.32 * ga, 1); }
        T(c, Af); c.save(); c.scale(1.15, 1.15); c.translate(-f.ce.x, -f.ce.y);
        c.translate(f.ce.x, f.ce.y); c.fillStyle = '#ffe9a0'; c.fill(f.ce.path); c.save(); c.scale(0.75, 0.75); c.fillStyle = PAL.glow; c.fill(f.ce.path); c.restore();
        c.fillStyle = PAL.glowHot; c.beginPath(); c.arc(0, 0, f.ce.r * 0.35, 0, 6.283); c.fill(); c.restore();
      } });
    }
    for (const cl of clouds) {
      const O = Lm(cl.f.x * UM, cl.f.y * UM, 6 * UM, 20 * UM); if (!O) continue; const sp = Math.hypot(O.a, O.b); if (!V.onScreen(O.e, O.f, 20 * sp)) continue;
      const [rv, av] = pointLaw(0.015 * sp, 0.8);
      items.push({ name: 'virions', d: O.depth, blur: V.coc(O.depth), draw(c) { T(c, O); c.globalAlpha = av; c.fillStyle = PAL.virus; const rr = rv / sp; const drift = 1.5 + 1.5 * Math.sin(t * 0.5 + cl.f.ph);
        for (const [x, y] of cl.pts) { c.beginPath(); c.arc(x * (1 + drift * 0.04), y * (1 + drift * 0.04), rr, 0, 6.283); c.fill(); } } });
    }
    // ---- immune cells crawling on the surface
    const crawlers = actors; // the hero macrophage is levels/macrophage.js (layered, all zooms)
    for (const a of crawlers) {
      const x = a.x + (a.vx || 0) * Math.sin(t * 0.35 + a.seed) * 16 + Math.sin(t * 0.9 + a.seed * 3) * 0.4, y = a.y + (a.vy || 0) * Math.cos(t * 0.3 + a.seed) * 16 + Math.cos(t * 0.8 + a.seed) * 0.4;
      const h = a.kind === 'pol' ? a.z : a.r * 0.45; const Ac = Lm(x * UM, y * UM, h * UM, a.r * 2.6 * UM); if (!Ac) continue;
      const sp = Math.hypot(Ac.a, Ac.b); if (sp * a.r < 0.35) continue; if (!V.onScreen(Ac.e, Ac.f, a.r * 2.6 * sp)) continue;
      items.push({ name: a.kind, d: Ac.depth, blur: V.coc(Ac.depth), draw(c) {
        T(c, Ac);
        if (a.kind === 'neu') neutrophil(c, a.r, a.seed, t);
        else if (a.kind === 'mac') macrophage(c, a.r, a.seed, t);
        else if (a.kind === 'lym') lymphocyte(c, a.r, a.seed, t);
        else if (a.kind === 'pol') pollen(c, a.r, a.seed);
      } });
    }
    // ---- mucus rafts (translucent material, constant alpha)
    for (const m of rafts) {
      const x = m.x + t * 1.2, Am = Lm(x * UM, m.y * UM, m.z * UM, m.r * m.ax * 1.3 * UM); if (!Am) continue; const sp = Math.hypot(Am.a, Am.b);
      if (!V.onScreen(Am.e, Am.f, m.r * 1.4 * sp)) continue;
      if (Math.hypot(x - hero.x, m.y - hero.y) < m.r * m.ax + 30) continue; // gap above the hero (the camera's way down)
      items.push({ name: 'mucus', d: Am.depth, blur: V.coc(Am.depth), draw(c) { T(c, Am); c.rotate(m.rot); c.scale(m.r * m.ax, m.r / Math.sqrt(m.ax)); mucusBody(c, m.seed, m.bubbles, m.specks); } });
    }
    // ---- airborne particles (pollen, mucus droplets)
    for (const b of debris) {
      const Ab = Lm(b.x * UM, b.y * UM, b.z * UM, b.r * 1.3 * UM); if (!Ab) continue; const sp = Math.hypot(Ab.a, Ab.b);
      if (sp * b.r < 0.5 || !V.onScreen(Ab.e, Ab.f, b.r * 1.3 * sp + 40)) continue;
      items.push({ name: 'particle', d: Ab.depth, blur: V.coc(Ab.depth), draw(c) { T(c, Ab); c.rotate(t * 0.05 + b.seed);
        if (b.pol) pollen(c, b.r, b.seed); else { c.scale(b.r, b.r); mucusBody(c, b.seed, [[0.2, 0.15, 0.12]], []); } } });
    }
    // ---- labels: one at a time, beside its object
    if (V.z < -2.2 && V.z > -3.1) { const p = V.P('muc', [(hero.x + 300 * 1.1) * UM, hero.y * UM, 26e-6]); labels.push({ x: p[0] + 14, y: p[1] - 12, text: 'Nasal lining', sub: 'wet mucus over ciliated cells' }); }
        else if (V.z <= -3.5 && V.z > -4.6) { /* one label per scale, no ping-pong: nasal lining → macrophage */ const p = V.P('muc', [(hero.x + 13) * UM, hero.y * UM, 5e-6]); labels.push({ x: p[0] + 14, y: p[1] - 12, text: 'Macrophage', sub: 'a cell that eats invaders · 21 µm' }); }
  },
};
