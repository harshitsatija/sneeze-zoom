// The one render kit. Every level draws with these helpers and this palette, so every scale is the same artist.
// Kurzgesagt rules (see STYLE.md): stacked flat fills, no outlines, light from the upper left, crescents not gradients on
// objects, glow only on active / luminous things, gradients only for backgrounds and glows.
import { rng, clamp } from './m.js';

export const PAL = {
  // body world
  bodyDeep: '#1d033b', bodyDeeper: '#0f0020', bodyMid: '#260354', bodyViolet: '#543ab2', bodyTeal: '#5da6d5', bodyFar: '#3a1670',
  fgSil: '#0c0420',
  tissue: '#9b0885', tissueLit: '#c61885', cyto: '#1a0149', cyto2: '#3b0a6e', nuc: '#1f70ab', nucLit: '#52b8d5', spec: '#a8f0ff',
  mac: '#d5207b', macDark: '#8b0167', macLit: '#ec4f9f', macDots: '#f07ab8', macCyto: '#6a0a5c',
  neu: '#640b52', neuSpike: '#ec6451', neuLit: '#ff8a6e',
  tcell: '#1c70a9', tcellRim: '#72c5de', tcellCore: '#202a58',
  virus: '#e50a68', virusDark: '#aa023b', virusMesa: '#48cedd',
  ab: '#8cc26a', abDark: '#4f8a46',
  rbc: '#d82978', rbcDark: '#bd0159', rbcLit: '#f06aa0',
  glow: '#f0f47e', glowHot: '#fffbe0', dust: '#fff0b0',
  mucus: '#7fe3c4', mucusDeep: '#2a9c9a', cilia: '#e04aa5', ciliaTip: '#ff9fd2',
  dnaA: '#498ad5', dnaB: '#e9b85a', protein: '#85e013', protein2: '#3ab878',
  // people / outdoors
  skin: '#f49065', skinShade: '#e2725e', skinDeep: '#c4504f', skinDark: '#9a263d', cheek: '#ef99a4', noseRed: '#ec5f55',
  hair: '#2f0a47', hairLit: '#4a1a6a', eye: '#2f0a47',
  coat: '#e86531', coatShade: '#c2452c', coatLit: '#f88a4a', shirt: '#f8c415', pants: '#2a2a7a', pantsShade: '#1c1c5a', shoe: '#1a0a3a',
  sky: '#5fb8ec', skyHi: '#2f8fd8', skyLow: '#bfe9ff',
  ground: '#3a2a90', road: '#2c2470', roadLine: '#f8c415', walk: '#8b7fd6', walkLit: '#a99cf0', curb: '#cdb7f8',
  wall: '#6142c4', wallShade: '#4a2fa8', roof: '#cdb7f8', roofShade: '#a48ce8', window: '#f0a040',
  park: '#2f9a78', parkLit: '#48c671', canopy: '#2f9a78', canopyLit: '#58d08a', canopyDark: '#1f6f63', trunk: '#4a1f55',
  water: '#1bb0e9', waterDeep: '#2d91cf', taxi: '#f8c415', taxiShade: '#e09a10',
  // space
  space: '#0b1435', spaceDeep: '#020f32', ocean: '#2d91cf', oceanNight: '#1e69ca', land: '#48c671', landNight: '#2f9a78', desert: '#e9b85a', ice: '#e8f2ff',
  cloud: '#ffffff', cloudShade: '#afc0eb', atmo: '#1a3a9a', earthRim: '#0a194d',
  sun: '#f7d72d', sunRim: '#e49926', sunHi: '#fbf56e', sunCore: '#fffbd0', sunSpot: '#c84a10',
  star: '#ffffff', starCyan: '#7be2f8', starRed: '#ff4a3a', starOrange: '#ffb030', starViolet: '#c08cff',
  galArm: '#ca4d3a', galArm2: '#7f2362', galCore: '#f3af4e', galHalo: '#381460', nebula: '#33066f',
  // micro-physics
  eCloud: '#3f7be0', eCloudHi: '#9fd0ff', nucleon: '#ff6a3a', proton: '#ff4f6a', neutron: '#4f8aff', quarkR: '#ff3b5c', quarkG: '#38e08a', quarkB: '#3b8bff', gluon: '#ffd166', foam: '#7a3cff',
};

// Screen-space light: the real Sun at the man (az 168°, el 59°) seen from the side-view camera = upper left.
export const L = (() => { const x = -0.396, y = -0.853, l = Math.hypot(x, y); return [x / l, y / l]; })();

// ---------- colour helpers ----------
const hexCache = new Map();
export function rgb(h) { let v = hexCache.get(h); if (v) return v; const n = parseInt(h.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; hexCache.set(h, v); return v; }
export const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
export function mix(h1, h2, t) { const a = rgb(h1), b = rgb(h2); const c = a.map((v, i) => Math.round(v + (b[i] - v) * t)); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); }
export const shade = (h, k) => mix(h, k < 0 ? '#0f0020' : '#ffffff', Math.abs(k)); // toward deep violet, never grey

// ---------- shapes (unit radius, centred) ----------
const blobCache = new Map();
// a wobbly blob: lobes are low-frequency sines; `t` animates them; returns Path2D
export function blob(seed, wob = 0.08, n = 6, t = 0, pts = 48) {
  const key = seed + '|' + wob + '|' + n + '|' + (t ? (t * 10 | 0) : 0) + '|' + pts;
  let p = blobCache.get(key); if (p) return p;
  const r = rng(seed * 7919 + 13), ph = [], am = [];
  for (let k = 0; k < n; k++) { ph.push(r() * 6.283); am.push((0.4 + r() * 0.6) * wob / Math.sqrt(k + 1)); }
  p = new Path2D(); const tt = t ? (t * 10 | 0) / 10 : 0;
  const R = (a) => { let v = 1; for (let k = 0; k < n; k++) v += am[k] * Math.sin((k + 2) * a + ph[k] + tt * (0.6 + 0.2 * k)); return v; };
  // smooth closed curve through points using quadratic midpoints
  const P = []; for (let i = 0; i < pts; i++) { const a = i / pts * 6.2832, rr = R(a); P.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  const mid = (i) => { const a = P[i % pts], b = P[(i + 1) % pts]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  let m = mid(pts - 1); p.moveTo(m[0], m[1]);
  for (let i = 0; i < pts; i++) { const m2 = mid(i); p.quadraticCurveTo(P[i][0], P[i][1], m2[0], m2[1]); }
  p.closePath(); if (blobCache.size > 4000) blobCache.clear(); blobCache.set(key, p); return p;
}
export const circle = (() => { const p = new Path2D(); p.arc(0, 0, 1, 0, Math.PI * 2); return p; })();
const _shift = new Map();
// translated copy of a path (for crescents)
export function shifted(path, dx, dy) { const p = new Path2D(); p.addPath(path, new DOMMatrix([1, 0, 0, 1, dx, dy])); return p; }

// ---------- the core shading recipe (unit space, call after setting transform) ----------
// Kurzgesagt stacked fills: base, shadow crescent (away from light), highlight crescent (toward light).
// `lx,ly` = light direction in the object's unit space (pass from layerLight()).
export function crescent(c, path, color, dx, dy) { c.save(); c.clip(path); const p = new Path2D(); p.addPath(path); p.addPath(path, new DOMMatrix([1, 0, 0, 1, dx, dy])); c.fillStyle = color; c.fill(p, 'evenodd'); c.restore(); }
export function solid(c, path, base, opt = {}) {
  const lx = opt.lx ?? UL[0], ly = opt.ly ?? UL[1];
  c.fillStyle = base; c.fill(path);
  if (opt.shadow) crescent(c, path, opt.shadow, lx * (opt.so ?? 0.14), ly * (opt.so ?? 0.14));       // dark crescent on the far side
  if (opt.light) crescent(c, path, opt.light, -lx * (opt.lo ?? 0.08), -ly * (opt.lo ?? 0.08));       // light crescent on the lit side
}
// highlight ellipse (flat), upper-left
export function spec(c, x, y, rx, ry, color, a = 0.9) { c.save(); c.globalAlpha *= a; c.fillStyle = color; c.beginPath(); c.ellipse(x + UL[0] * rx * 1.4, y + UL[1] * rx * 1.4, rx, ry, Math.atan2(UL[1], UL[0]) + Math.PI / 2, 0, 6.2832); c.fill(); c.restore(); }
// a sphere-like disc (nucleus, planet, virion)
export function ball(c, x, y, r, base, dark, hi, hiA = 0.9) {
  c.save(); c.translate(x, y); c.scale(r, r); solid(c, circle, base, { shadow: dark, so: 0.24 }); c.restore();
  if (hi) spec(c, x, y, r * 0.3, r * 0.2, hi, hiA);
}
// Kurzgesagt cell: bright membrane ring, much darker interior offset toward the light, optional granules + nucleus
export function cell(c, path, P, opt = {}) {
  c.fillStyle = P.ring; c.fill(path);
  if (P.ringLit) crescent(c, path, P.ringLit, -UL[0] * 0.07, -UL[1] * 0.07);
  const ins = opt.inset ?? 0.84, off = opt.off ?? 0.06;
  c.save(); c.translate(UL[0] * off, UL[1] * off); c.scale(ins, ins); c.fillStyle = P.body; c.fill(path); if (P.bodyDark) crescent(c, path, P.bodyDark, UL[0] * 0.12, UL[1] * 0.12); c.restore();
}
// glow: additive radial halo with soft bands (only for luminous / active things)
export function glow(c, x, y, r, color, a = 0.5, bands = 0) {
  if (!(r > 0.5) || !isFinite(r)) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(x, y, 0, x, y, r); const [R, G, B] = rgb(color);
  g.addColorStop(0, `rgba(${R},${G},${B},${a})`); g.addColorStop(0.35, `rgba(${R},${G},${B},${a * 0.45})`); g.addColorStop(1, `rgba(${R},${G},${B},0)`);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  for (let k = 1; k <= bands; k++) { c.fillStyle = `rgba(${R},${G},${B},${a * 0.08})`; c.beginPath(); c.arc(x, y, r * (0.25 + 0.18 * k), 0, 6.2832); c.fill(); }
  c.restore();
}
// set a layer affine on a context
// T also sets UL = the light direction expressed in the drawing's own unit space (so y-up drawings shade correctly)
export const UL = [L[0], L[1]];
export function T(c, A) { c.setTransform(A.a, A.b, A.c, A.d, A.e, A.f); lightFor(A.a, A.b, A.c, A.d); }
export function lightFor(a, b, cc, d) { const det = a * d - b * cc; if (!det) return; const x = (d * L[0] - cc * L[1]) / det, y = (-b * L[0] + a * L[1]) / det, l = Math.hypot(x, y) || 1; UL[0] = x / l; UL[1] = y / l; }
export function screenSpace(c) { c.setTransform(1, 0, 0, 1, 0, 0); UL[0] = L[0]; UL[1] = L[1]; }
// screen-filling fill (when an object's interior covers the whole view)
export function fillScreen(c, V, color) { screenSpace(c); c.fillStyle = color; c.fillRect(0, 0, V.w, V.h); }
// background gradient (vertical, 2–3 stops) — only for the outermost containing medium
export function bgGrad(c, V, stops) { c.setTransform(1, 0, 0, 1, 0, 0); const g = c.createLinearGradient(0, 0, V.w * 0.25, V.h); stops.forEach(([o, col]) => g.addColorStop(o, col)); c.fillStyle = g; c.fillRect(0, 0, V.w, V.h); }

// size law for point-like luminous things: true radius when resolved, never smaller than `minPx`,
// with brightness falling as the true size drops below minPx (so a shrinking thing dims instead of popping)
export function pointLaw(truePx, minPx = 1.2) { const r = Math.max(truePx, minPx); const a = truePx >= minPx ? 1 : clamp(Math.pow(truePx / minPx, 0.5), 0, 1); return [r, a]; }
export { rng, clamp };
