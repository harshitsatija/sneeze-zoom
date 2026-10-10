// SNEEZE engine. One world, one camera, one painter's sort. Canvas2D vector drawing at every scale.
// z = log10(field width in metres at the focus). Levels push draw items; the engine sorts them far → near,
// skips everything behind the nearest item that covers the whole screen, groups runs of similar depth-of-field
// blur into offscreen passes, and draws labels (max 2).
import * as Wd from './world.js';
import { cameraAt, KD, FOVX } from './cam.js';
import { sub, dot, col, mm, mv, clamp, ss, lerp } from './m.js';

const q = new URLSearchParams(location.search);
export const Q = q;
export const ZMIN = -34.6, ZMAX = 27.2;
const canvas = document.getElementById('c'), ctx = canvas.getContext('2d', { alpha: false });
let DPR = q.has('dpr') ? Number(q.get('dpr')) : Math.min(window.devicePixelRatio || 1, 1.25);
let CW = 0, CH = 0; // canvas pixels
const offA = document.createElement('canvas'), offCtx = offA.getContext('2d');
// scaled scratch canvases for blurred runs, one per resolution factor: every setTransform is pre-scaled by k, so items
// draw unchanged (items must size their own scratch canvases from V.w/V.h, never from c.canvas)
const SCALED = new Map();
function scaled(k0) {
  let S = SCALED.get('one');
  if (!S) { const cv = document.createElement('canvas'), c = cv.getContext('2d'), st = c.setTransform.bind(c);
    S = { cv, ctx: c, k: 1 };
    c.setTransform = (a, b, cc, d, e, f) => { const k = S.k; if (typeof a === 'object') { const m = a; return st(m.a * k, m.b * k, m.c * k, m.d * k, m.e * k, m.f * k); } return st(a * k, b * k, cc * k, d * k, e * k, f * k); };
    SCALED.set('one', S); }
  if (S.cv.width !== CW || S.cv.height !== CH) { S.cv.width = CW; S.cv.height = CH; }
  return S;
}
// (legacy) half-resolution scratch for strongly blurred runs: every setTransform on it is pre-scaled by HK, so items draw unchanged
const offH = document.createElement('canvas'), offHCtx = offH.getContext('2d'), HK = 0.5, offH2 = document.createElement('canvas'), offH2Ctx = offH2.getContext('2d');
{ const st = offHCtx.setTransform.bind(offHCtx); offHCtx.setTransform = (a, b, c, d, e, f) => { if (typeof a === 'object') { const m = a; return st(m.a * HK, m.b * HK, m.c * HK, m.d * HK, m.e * HK, m.f * HK); } return st(a * HK, b * HK, c * HK, d * HK, e * HK, f * HK); }; }

// ---------- View: everything a level needs to project and draw ----------
export class View {
  constructor(cam, t) {
    this.cam = cam; this.t = t; this.z = cam.z; this.W = cam.W; this.D = cam.D;
    this.w = CW; this.h = CH; this.cx = CW / 2; this.cy = CH / 2; this.f = (CW / 2) / Math.tan(FOVX / 2);
    this.ppm = this.f / this.D; // pixels per metre at the focus
    this.near = this.D * 2e-3; this.cache = new Map(); this.s = CW / 1600; // style scale (1 at 1600 px wide)
    this.dofA = 9 * this.s * dofAt(this.z); // v2: half strength (calmer focus changes)
  }
  // camera position + rows(right, up, back) in frame fr
  c(fr) {
    let e = this.cache.get(fr); if (e) return e;
    const p = Wd.xform(this.cam.pos, this.cam.fr, fr), M = mm(Wd.rot(this.cam.fr, fr), this.cam.M);
    e = { p, r: col(M, 0), u: col(M, 1), b: col(M, 2) }; this.cache.set(fr, e); return e;
  }
  // camera-space coordinates of a point given in frame fr: [x, y, depth]
  cs(fr, p) { const e = this.c(fr), v = sub(p, e.p); return [dot(v, e.r), dot(v, e.u), -dot(v, e.b)]; }
  // project to screen: [sx, sy, depth]  (depth <= near means not drawable)
  P(fr, p) { const c = this.cs(fr, p); const k = this.f / c[2]; return [this.cx + c[0] * k, this.cy - c[1] * k, c[2]]; }
  // pixel size of `m` metres at depth d
  px(m, d) { return m * this.f / d; }
  // depth-of-field blur radius (canvas px) for an item at depth d
  // v2: near layers saturate early (1.4x) so things passing the lens don't swing from sharp to mush
  coc(d) { if (this.dofA <= 0) return 0; const x = Math.abs(1 - this.D / d); return this.dofA * 1.4 * x / (1 + x); }
  // affine transform for a planar drawing: origin O, unit axes ux, uy (vectors in frame fr, metres per drawing unit)
  layer(fr, O, ux, uy) {
    const c0 = this.cs(fr, O); if (c0[2] <= this.near) return null;
    const e = this.c(fr), cu = [dot(ux, e.r), dot(ux, e.u), -dot(ux, e.b)], cv = [dot(uy, e.r), dot(uy, e.u), -dot(uy, e.b)];
    const k = this.f / c0[2];
    // first-order (affine) projection around O; exact for planes parallel to the image plane
    const a = (cu[0] - c0[0] * cu[2] / c0[2]) * k, b = -(cu[1] - c0[1] * cu[2] / c0[2]) * k;
    const cc = (cv[0] - c0[0] * cv[2] / c0[2]) * k, d = -(cv[1] - c0[1] * cv[2] / c0[2]) * k;
    return { a, b, c: cc, d, e: this.cx + c0[0] * k, f: this.cy - c0[1] * k, depth: c0[2], k };
  }
  // camera-facing billboard at O with `m` metres per drawing unit (y up in drawing units)
  bill(fr, O, m) { const c0 = this.cs(fr, O); if (c0[2] <= this.near) return null; const k = this.f / c0[2]; return { a: m * k, b: 0, c: 0, d: -m * k, e: this.cx + c0[0] * k, f: this.cy - c0[1] * k, depth: c0[2], k, s: m * k }; }
  // project a 3D polygon (frame fr) with near-plane clipping; returns [[sx,sy],...] or null
  poly(fr, pts) {
    const e = this.c(fr), n = this.near, cs = pts.map((p) => { const v = sub(p, e.p); return [dot(v, e.r), dot(v, e.u), -dot(v, e.b)]; });
    const out = []; let inside = 0;
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i], b = cs[(i + 1) % cs.length], ia = a[2] > n, ib = b[2] > n;
      if (ia) { out.push(a); inside++; }
      if (ia !== ib) { const t = (n - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, n]); }
    }
    if (out.length < 2) return null;
    return out.map((c) => [this.cx + c[0] * this.f / c[2], this.cy - c[1] * this.f / c[2], c[2]]);
  }
  onScreen(x, y, r) { return x + r > 0 && x - r < this.w && y + r > 0 && y - r < this.h; }
  // does a circle (screen) fully contain the viewport?
  covers(x, y, r) { const dx = Math.max(Math.abs(x - 0) , Math.abs(x - this.w)), dy = Math.max(Math.abs(y - 0), Math.abs(y - this.h)); return dx * dx + dy * dy < r * r; }
}
// DOF strength by zoom: body + face scales have Kurzgesagt depth of field; aerial / space views are sharp
// DOF strength by zoom: full at body + face scales, light over the aerial map span (a map must read), half in space
// (the same depth language as inside: soft background, sharp focus, bokeh foreground)
// space v3 (z > 7): the focus stays on the subject — DOF eases DOWN to a faint 0.08 by z 8 (it was rising to 0.5 there), so
// nothing in space swings in and out of focus as layers pass
function dofAt(z) { if (z < 1.0) return 1; if (z < 6.5) return 1 - 0.85 * ss(1.0, 2.2, z); const d = 0.15 + 0.35 * ss(6.5, 8.0, z); return z <= 7 ? d : d + (0.08 - d) * ss(7.0, 8.0, z); }
export { dofAt };


// blur a layer with MIRRORED edges (CSS blur treats outside-canvas as transparent, which fades the frame border and exposes
// the layer below as a seam). src -> padded mirror copy -> blurred -> returned canvas (same size as src).
const padA = document.createElement('canvas'), padB = document.createElement('canvas'), padAC = padA.getContext('2d'), padBC = padB.getContext('2d');
const outE = document.createElement('canvas'), outEC = outE.getContext('2d');
function blurMirrored(src, b, rw, rh) {
  const w = rw || src.width, h = rh || src.height, p = Math.min(Math.ceil(b * 3) + 2, Math.max(w, h));
  if (padA.width !== w + 2 * p || padA.height !== h + 2 * p) { padA.width = padB.width = w + 2 * p; padA.height = padB.height = h + 2 * p; }
  if (outE.width !== w || outE.height !== h) { outE.width = w; outE.height = h; }
  padAC.setTransform(1, 0, 0, 1, 0, 0); padAC.clearRect(0, 0, padA.width, padA.height);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const sx = i ? -1 : 1, sy = j ? -1 : 1, tx = i === -1 ? p : i === 1 ? p + 2 * w : p, ty = j === -1 ? p : j === 1 ? p + 2 * h : p;
    padAC.setTransform(sx, 0, 0, sy, tx, ty); padAC.drawImage(src, 0, 0, w, h, 0, 0, w, h);
  }
  padBC.setTransform(1, 0, 0, 1, 0, 0); padBC.clearRect(0, 0, padB.width, padB.height); padBC.filter = `blur(${b.toFixed(2)}px)`; padBC.drawImage(padA, 0, 0); padBC.filter = 'none';
  outEC.setTransform(1, 0, 0, 1, 0, 0); outEC.clearRect(0, 0, w, h); outEC.drawImage(padB, p, p, w, h, 0, 0, w, h);
  return outE;
}

// ---------- levels ----------
const levels = [];
export function addLevel(L) { levels.push(L); }
export const allLevels = () => levels;

// ---------- labels ----------
const labelBox = document.getElementById('labels');
const labelEls = [];
function placeLabels(V, cands) {
  const show = q.has('nolabels') ? [] : cands.filter((l) => l.x > 40 && l.x < V.w - 40 && l.y > 40 && l.y < V.h - 60)
    .sort((a, b) => Math.hypot(a.x - V.cx, a.y - V.cy) - Math.hypot(b.x - V.cx, b.y - V.cy)).slice(0, 2);
  while (labelEls.length < 2) { const d = document.createElement('div'); d.className = 'lab'; d.innerHTML = '<b></b><i></i>'; labelBox.appendChild(d); labelEls.push(d); }
  const placed = [];
  labelEls.forEach((el, i) => {
    const l = show[i]; if (!l) { el.style.display = 'none'; return; }
    el.style.display = 'block'; el.firstChild.textContent = l.text; el.lastChild.textContent = l.sub || '';
    // keep the whole label on screen: flip to the left of its anchor if it would run off the right edge
    const vw = V.w / DPR, vh = V.h / DPR, w = el.offsetWidth + 14, h = el.offsetHeight + 12;
    let x = l.x / DPR, y = l.y / DPR; if (x + w > vw - 12) x = Math.max(12, x - w - 24); if (y + h > vh - 44) y = vh - 44 - h; if (y < 8) y = 8;
    if (i === 1 && placed[0] && Math.abs(placed[0][1] - y) < h && Math.abs(placed[0][0] - x) < w) y = placed[0][1] + h; // never overlap the first label
    placed[i] = [x, y];
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; el.style.opacity = String(l.a ?? 1);
  });
}

// ---------- state ----------
let z = q.has('z') ? Number(q.get('z')) : -0.3, zt = z, tLive = q.has('t') ? Number(q.get('t')) : 0;
let frozen = q.has('freeze'), auto = 0, last = performance.now(), dirty = true, frames = 0;
const only = q.has('only') ? q.get('only').split(',') : null, hide = q.has('hide') ? q.get('hide').split(',') : [];
// the film's medium colour where nothing covers the screen: navy at Earth scale, deep violet-indigo in space
import { mix as kmix } from './kit.js';
import { look as LOOK } from './look.js';
const bgAt = (z) => LOOK(z).medium; // one continuous medium colour (core/look.js)
export { bgAt };
export const stats = { items: 0, drawn: 0, runs: 0, ms: 0 };
// profiling (?prof): per-frame CPU split for real-time analysis, read by tools/play.mjs
const PROF = q.has('prof'); let lvlMs = {}; const profLog = [];

function resize() {
  const w = window.innerWidth, h = window.innerHeight; CW = Math.round(w * DPR); CH = Math.round(h * DPR);
  canvas.width = CW; canvas.height = CH; canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  offA.width = 1; offA.height = 1; dirty = true;
}
window.addEventListener('resize', resize);

function drawItem(c, it) { c.save(); try { it.draw(c); } catch (e) { console.error('item', it.name, e); } c.restore(); }

let frameHook = null; export function onFrame(fn) { frameHook = fn; }
const levelFrames = () => { for (const L of levels) if (L.frames) try { L.frames(tLive); } catch (e) { console.error('frames', L.id, e); } };
export function render() {
  const t0 = performance.now(); if (frameHook) frameHook(tLive); levelFrames(); const cam = cameraAt(z, tLive); const V = new View(cam, tLive);
  const items = [], labels = [];
  for (const L of levels) {
    if (only && !only.includes(L.id)) continue; if (hide.includes(L.id)) continue;
    if (L.zr && (z < L.zr[0] || z > L.zr[1])) continue;
    const tl = performance.now(); try { L.draw(V, items, labels); } catch (e) { console.error('level', L.id, e); } if (PROF) lvlMs[L.id] = (lvlMs[L.id] || 0) + performance.now() - tl;
  }
  let list = items.filter((it) => it.d > V.near && !(it.name && hide.includes(it.name)));
  list.sort((a, b) => (a.g || 0) - (b.g || 0) || b.d - a.d); // groups: -2 sky, -1 ground planes, 0 everything standing
  // nearest full-screen opaque cover: everything farther is invisible
  let start = 0; for (let i = list.length - 1; i >= 0; i--) if (list[i].cover) { start = i; break; }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = bgAt(z); ctx.fillRect(0, 0, CW, CH);
  const noBlur = q.get('blur') === '0';
  // runs of similar blur
  let i = start, runs = 0; const drawn = list.length - start;
  while (i < list.length) {
    const b0 = noBlur ? 0 : (list[i].blur || 0);
    if (b0 < 0.8) { drawItem(ctx, list[i]); i++; continue; }
    let j = i, sum = 0; const RB = q.has('rb') ? Number(q.get('rb')) : 2.0, lo = b0 / RB, hi = b0 * RB;
    while (j < list.length && (list[j].blur || 0) >= Math.max(0.8, lo) && (list[j].blur || 0) <= hi) { sum += list[j].blur; j++; }
    const bl = sum / (j - i);
    // resolution follows blur CONTINUOUSLY (no quality steps): one full-size buffer, drawn at scale k, blurred by bl*k
    const k = q.has('fullblur') ? 1 : Math.max(0.25, Math.min(1, 2.5 / bl)), S = scaled(1); S.k = k;
    const w = Math.ceil(CW * k), h = Math.ceil(CH * k);
    S.ctx.setTransform(1, 0, 0, 1, 0, 0); S.ctx.clearRect(0, 0, CW, CH);
    for (let m = i; m < j; m++) drawItem(S.ctx, list[m]);
    const bc = blurMirrored(S.cv, bl * k, w, h);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bc, 0, 0, w, h, 0, 0, CW, CH); ctx.restore();
    runs++; i = j;
  }
  // vignette (constant, part of the lens, not of any scene)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const vg = ctx.createRadialGradient(CW / 2, CH / 2, Math.min(CW, CH) * 0.45, CW / 2, CH / 2, Math.hypot(CW, CH) * 0.62);
  vg.addColorStop(0, 'rgba(10,0,30,0)'); vg.addColorStop(1, 'rgba(10,0,30,0.32)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, CW, CH);
  placeLabels(V, labels); hud(V);
  stats.items = list.length; stats.drawn = drawn; stats.runs = runs; stats.ms = performance.now() - t0; frames++;
  if (PROF) { profLog.push({ z: +z.toFixed(3), ms: +stats.ms.toFixed(2), runs, items: list.length, lv: lvlMs, t: performance.now() }); lvlMs = {}; if (profLog.length > 5000) profLog.shift(); }
  canvas.dataset.frames = String(frames); window.__ready = true;
}

// ---------- HUD: one quiet line ----------
const hudEl = document.getElementById('hud');
function fmtLen(m) {
  const u = [[1e26, 'billion light-years', 9.4607e24], [9.4607e21, 'million light-years', 9.4607e21], [9.4607e17, 'thousand light-years', 9.4607e18], [9.4607e15 * 0.5, 'light-years', 9.4607e15],
    [1.496e12, 'AU', 1.496e11], [1e6, 'thousand km', 1e6], [1e3, 'km', 1e3], [1, 'm', 1], [1e-2, 'cm', 1e-2], [1e-3, 'mm', 1e-3], [1e-6, 'µm', 1e-6], [1e-9, 'nm', 1e-9], [1e-12, 'pm', 1e-12], [1e-15, 'fm', 1e-15]];
  for (const [th, name, unit] of u) if (m >= th) { const v = m / unit; return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(0) : v.toFixed(1)) + ' ' + name; }
  const e = Math.floor(Math.log10(m)); return (m / Math.pow(10, e)).toFixed(1) + ' × 10' + sup(e) + ' m';
}
const sup = (n) => String(n).split('').map((ch) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(ch)]).join('');
export { fmtLen, sup };
function hud(V) { if (hudEl) hudEl.textContent = fmtLen(V.W) + ' across'; }

// ---------- input / loop ----------
function advance(dt) {
  if (!frozen) tLive += dt;
  if (auto) { zt = clamp(zt + auto * dt * 0.42, ZMIN, ZMAX); z = zt; if (zt <= ZMIN || zt >= ZMAX) auto = 0; dirty = true; }
  else if (Math.abs(zt - z) > 1e-5) { z += (zt - z) * (1 - Math.exp(-dt * 6)); dirty = true; }
}
function tick(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!document.hidden) advance(dt); if (!frozen || dirty) { render(); dirty = false; } requestAnimationFrame(tick); }
window.addEventListener('wheel', (e) => { e.preventDefault(); auto = 0; zt = clamp(zt + e.deltaY * 0.0022, ZMIN, ZMAX); }, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === '-') { auto = 0; zt = clamp(zt + 0.25, ZMIN, ZMAX); }
  if (e.key === 'ArrowDown' || e.key === '=' || e.key === '+') { auto = 0; zt = clamp(zt - 0.25, ZMIN, ZMAX); }
  if (e.key === ' ') { auto = 0; }
});
let ty = null; window.addEventListener('touchstart', (e) => { ty = e.touches[0].clientY; auto = 0; }, { passive: true });
window.addEventListener('touchmove', (e) => { if (ty == null) return; const y = e.touches[0].clientY; zt = clamp(zt + (ty - y) * 0.01, ZMIN, ZMAX); ty = y; }, { passive: true });
// pre-build every level's caches (tiles, sprites, GL buffers) across the whole zoom before the user sees anything
export async function warm(step = 0.5, onProgress) {
  const z0 = z, t0 = tLive; const N = Math.ceil((ZMAX - ZMIN) / step);
  for (let k = 0; k <= N; k++) { z = zt = ZMIN + k * step; for (const tt of [2, 4.2]) { tLive = tt; render(); } if (onProgress) onProgress(k / N); if (k % 4 === 3) await new Promise((r) => setTimeout(r, 0)); }
  z = zt = z0; tLive = t0;
}
export function go(dir) { auto = auto === dir ? 0 : dir; }
export function start() {
  resize(); render(); requestAnimationFrame(tick);
  window.__W = { at(zz, tt) { auto = 0; frozen = true; z = zt = clamp(zz, ZMIN, ZMAX); if (tt !== undefined) tLive = tt; render(); return { ...stats }; }, stats, levels, get z() { return z; }, go, profLog, setZ(zz) { auto = 0; z = zt = clamp(zz, ZMIN, ZMAX); }, unfreeze() { frozen = false; } };
}
