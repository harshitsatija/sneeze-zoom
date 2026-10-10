// THE LOOK: one material library for every scale (unification pass). Every level takes its colours and shading from here.
// The reference is the inside-the-body style the user loves (shots/ref_inside-4.05.png, refs/kz/immune-actually/05,11):
//   a DARK SATURATED MEDIUM (L ≈ 8–18 %, never grey, never navy-black), objects in SATURATED families (magenta, cyan,
//   gold, violet, coral), stacked flat fills: base + darker crescent (away from light) + lighter crescent/flat highlight
//   (toward the upper-left light), glow only on luminous/active things, far layers sink toward the medium and blur,
//   near layers are big soft bokeh shapes.
// The medium hue drifts SLOWLY with the scale of the object (one continuous ramp over 62 decades): no colour jumps
// between neighbouring scales. Accents keep the same four families everywhere so every frame shares the palette.
import { mix, rgba, rgb, crescent, solid, UL, glow, blob, circle } from './kit.js';
import { clamp } from './m.js';

// ---- the ramp: medium colours keyed by z = log10(size of the thing / field width) --------------------------------
// medium = background tissue/space colour; deep = darker version for far layers + shadows; haze = what far layers sink to
const RAMP = [
  [-35.0, { medium: '#0c1446', deep: '#060a2a', haze: '#1c2a6e' }], // Planck foam: deep blue
  [-26.0, { medium: '#140d4a', deep: '#09062c', haze: '#2a1e78' }], // desert: blue-violet
  [-17.0, { medium: '#1e0a44', deep: '#0e0428', haze: '#3a1670' }], // quarks/proton: violet (warm accents)
  [-12.0, { medium: '#170b4a', deep: '#0b052e', haze: '#2e1c7a' }], // atom: indigo-violet
  [-8.0, { medium: '#1a0848', deep: '#0d042c', haze: '#33157a' }],  // DNA / chromatin
  [-5.0, { medium: '#1d033b', deep: '#0f0020', haze: '#3a0a5e' }],  // cell interior = THE reference
  [-3.5, { medium: '#260354', deep: '#12012c', haze: '#4a0a6e' }],  // epithelium battle
  [-2.3, { medium: '#3a0844', deep: '#1c0326', haze: '#6a1a5a' }],  // nasal lining (warmer magenta)
  [-1.0, { medium: '#5a2a8a', deep: '#2a1050', haze: '#8a6ac8' }],  // face / street: saturated lilac daylight
  [1.5, { medium: '#4a2aa0', deep: '#24125a', haze: '#7a62d8' }],   // street from above / city
  [4.0, { medium: '#3a2490', deep: '#1c1050', haze: '#6a58c8' }],   // Manhattan / region (land tone, urban violet)
  [7.0, { medium: '#13103e', deep: '#080624', haze: '#2a2470' }],   // Earth in space
  [12.0, { medium: '#130a3a', deep: '#080420', haze: '#2a1668' }],  // solar system
  [20.0, { medium: '#150938', deep: '#09041f', haze: '#2e1462' }],  // galaxy
  [27.5, { medium: '#120a33', deep: '#08041c', haze: '#28145a' }],  // cosmic web / edge
];
export function look(z) {
  let i = 0; while (i < RAMP.length - 2 && z > RAMP[i + 1][0]) i++;
  const [za, A] = RAMP[i], [zb, B] = RAMP[i + 1]; const t = clamp((z - za) / (zb - za), 0, 1);
  return { medium: mix(A.medium, B.medium, t), deep: mix(A.deep, B.deep, t), haze: mix(A.haze, B.haze, t) };
}

// ---- the four accent families (identical at every scale) + their shade/light steps ------------------------------
export const FAM = {
  magenta: { base: '#d5207b', dark: '#8b0167', lit: '#ec4f9f', glow: '#f07ab8' },
  cyan: { base: '#1f8fc0', dark: '#145a8a', lit: '#52b8d5', glow: '#a8f0ff' },
  gold: { base: '#f0a020', dark: '#c0601a', lit: '#ffd166', glow: '#fff3b0' },
  violet: { base: '#6a3ad0', dark: '#3a1890', lit: '#9a7af0', glow: '#c8b8ff' },
  coral: { base: '#ec6451', dark: '#b2303e', lit: '#ff9a7a', glow: '#ffd0b8' },
  lime: { base: '#7bc24a', dark: '#3f7a3a', lit: '#b8e86a', glow: '#e8ffb0' },
  skin: { base: '#f49065', dark: '#d8604f', lit: '#ffb08a', glow: '#ffe0cc' },
};

// depth tint: an object `k` (0..1) of the way from its own colour toward the medium of its scale (far layers sink)
export const sink = (hex, z, k) => mix(hex, look(z).haze, clamp(k, 0, 1));

// ---- THE material: every solid object in the film is drawn with this (unit space, after T(c, A)) -----------------
// fam: a FAM entry (or {base,dark,lit}); opt.so/lo crescent offsets as a fraction of unit radius (defaults Kurzgesagt);
// opt.hi = flat highlight ellipse (x, y, rx, ry in unit space) or false; opt.core = lighter inset core (cells) 0..1
export function body(c, path, fam, opt = {}) {
  c.fillStyle = fam.base; c.fill(path);
  crescent(c, path, fam.dark, UL[0] * (opt.so ?? 0.16), UL[1] * (opt.so ?? 0.16));
  if (opt.lo !== 0) crescent(c, path, fam.lit, -UL[0] * (opt.lo ?? 0.07), -UL[1] * (opt.lo ?? 0.07));
  if (opt.core) { c.save(); c.translate(-UL[0] * 0.05, -UL[1] * 0.05); c.scale(opt.core, opt.core); c.fillStyle = opt.coreCol || mix(fam.base, fam.lit, 0.5); c.fill(path); c.restore(); }
  if (opt.hi !== false) { const h = opt.hi || [UL[0] * 0.38, UL[1] * 0.38, 0.22, 0.13]; c.save(); c.fillStyle = rgba(fam.glow || '#ffffff', 0.85); c.beginPath(); c.ellipse(h[0], h[1], h[2], h[3], Math.atan2(UL[1], UL[0]) + Math.PI / 2, 0, 6.2832); c.fill(); c.restore(); }
}
// a ball (nucleus, planet, quark, nucleon, star disc) — the same recipe
export function orb(c, x, y, r, fam, opt = {}) { c.save(); c.translate(x, y); c.scale(r, r); body(c, circle, fam, opt); c.restore(); }
// a luminous thing's halo (infected cell, Sun, star, quark): banded, warm/cool by family
export function halo(c, x, y, r, fam, a = 0.45) { glow(c, x, y, r, fam.glow || fam.lit, a, 3); }
// translucent material (mucus, membranes, nebula gas, gel): ONE constant alpha, stacked lighter core, no strokes
export function gel(c, path, hex, a = 0.3, core = 0.72) {
  c.fillStyle = rgba(hex, a); c.fill(path);
  c.save(); c.translate(-UL[0] * 0.06, -UL[1] * 0.06); c.scale(core, core); c.fillStyle = rgba(mix(hex, '#ffffff', 0.25), a * 0.55); c.fill(path); c.restore();
}
// a bokeh disc for near out-of-focus particles (the engine blurs it by depth): flat, slightly lighter rim
export function bokeh(c, r, hex, a = 0.5) { c.fillStyle = rgba(hex, a); c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.fill(); c.fillStyle = rgba(mix(hex, '#ffffff', 0.3), a * 0.35); c.beginPath(); c.arc(0, 0, r * 0.82, 0, 6.2832); c.fill(); }
export { blob, circle, mix, rgba, rgb };
// ---- additions (unification pass, phase A) ----
// GL colour: hex -> [r, g, b] in 0..1 (for the WebGL layers, so they take the same families)
export const f3 = (hex) => rgb(hex).map((v) => v / 255);
// a family sunk toward the medium of scale z by k (far layers): every step of the family moves together
export function sinkFam(fam, z, k) { const o = {}; for (const key in fam) o[key] = sink(fam[key], z, k); return o; }
// a family pushed DARK, toward the deep medium of scale z (interiors: cytoplasm, the inside of a container we fly into)
export function deepFam(fam, z, k) { const d = look(z).deep, o = {}; for (const key in fam) o[key] = mix(fam[key], d, clamp(k, 0, 1)); return o; }
// the interior of a container at scale z (what fills the frame once the camera is inside it): the medium, warmed by its family
export const interior = (fam, z, k = 0.22) => mix(look(z).medium, fam.base, k);
