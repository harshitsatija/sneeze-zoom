// Shared galaxy renderer (owner: COSMOS agent). ONE renderer for the Milky Way, every Local Group member and every
// galaxy of the cosmic web (true-limits/11): a bright stepped core with a warm glow, thick arms built of many overlapping
// soft star clouds (violet outer arms, red arms, orange inner arms), and sprinkled stars. Star clouds are real-size soft
// spheres (constant alpha); every position is projected with real perspective, so from inside the Milky Way the clouds
// grow in from the frame edges as the camera rises above the disc. Points use the shared star law (shared/star.js).
// Dust: clouds and points seen through the galaxy's own dust layer are dimmed by the real sight-line path through it
// (that is why the Galactic Centre is hidden from the Sun and appears as the camera rises above the disc).
// Minimum-size law (honest enlargement, documented): a galaxy smaller than its minimum pixel radius is drawn enlarged about
// its own centre by E = minPx / truePx (continuous), so Local Group members read as little galaxies.
import { PAL, mix, rgba, clamp } from '../core/kit.js';
import { rng } from '../core/m.js';
import { blobSprite, SPRITE_K, SPC } from '../levels/space-kit.js';
import { Points, appMag, VIS, T_CYAN, T_CYANW, T_WHITE, T_WARM, T_ORANGE, T_RED, T_VIOLET, T_PINK } from './star.js';

export const KPC = 3.0857e19;
// diffuse exposure: faint extended light (star clouds, nebulae, galaxy discs, core glows) is invisible while the bright
// Earth / Sun are the subject (z < 16.4, short exposure); it comes up with the deep-sky exposure by z 17.4.
export const diffuseExposure = (z) => { const t = Math.min(1, Math.max(0, (z - 14.0) / 3.5)); return 0.12 + 0.88 * t * t * (3 - 2 * t); }; // space v3: fainter behind Earth and the Sun (a nearby cloud complex read as a stray blob crossing the Earth beat) // (space restyle) the Milky Way's clouds are a dim far layer behind the solar system too, full deep-sky exposure by z 17.5 (a slow 2-decade change)
const TAU = Math.PI * 2;

// ---------- palettes (all from PAL / STYLE.md) ----------
export const GPAL = {
  // (space restyle) the inside palette: violet outer arms, magenta arms, gold inner arms and core (true-limits/11 hues)
  mw:   { outer: SPC.violet, arm: SPC.magenta, inner: mix(PAL.galCore, PAL.sunRim, 0.3), core: mix(PAL.sun, PAL.sunCore, 0.4), hot: PAL.sunCore, glow: PAL.sunRim, nuc: T_WARM, spr: [T_CYANW, T_WHITE, T_CYANW, T_WARM, T_ORANGE, T_CYAN] },
  warm: { outer: SPC.violet, arm: mix(SPC.magenta, PAL.galArm, 0.4), inner: PAL.galCore, core: mix(PAL.sun, PAL.sunCore, 0.4), hot: PAL.sunCore, glow: PAL.sunRim, nuc: T_WARM, spr: [T_WHITE, T_WARM, T_ORANGE, T_CYANW] },
  cyan: { outer: '#4a2a9e', arm: '#6d4fe0', inner: PAL.starCyan, core: '#bdf4ff', hot: '#ffffff', glow: '#7be2f8', nuc: T_CYAN, spr: [T_CYAN, T_CYANW, T_WHITE, T_VIOLET] },
  pink: { outer: '#7a1a86', arm: '#c8207c', inner: '#ff6ab0', core: '#ffd2ea', hot: '#ffffff', glow: '#ff6ab0', nuc: T_PINK, spr: [T_PINK, T_WHITE, T_VIOLET, T_CYANW] },
};

// ---------- geometry (local units = kpc, disc plane z = 0) ----------
function ellipse(cx, cy, a, b, ang, n = 64) {
  const r = new Float32Array(n * 2), ca = Math.cos(ang), sa = Math.sin(ang);
  for (let i = 0; i < n; i++) { const t = i / n * TAU, x = a * Math.cos(t), y = b * Math.sin(t); r[i * 2] = cx + x * ca - y * sa; r[i * 2 + 1] = cy + x * sa + y * ca; }
  return r;
}
const phiAt = (Rb, phiB, k, R) => phiB + Math.log(R / Rb) / k;
// lay soft cloud spheres along a log-spiral arm: R(phi) = Rb e^{k(phi - phiB)} from R0 to R1, half-width w
function armClouds(out, q, Rb, phiB, k, R0, R1, w, color, alpha, avoid, zs = 0.04) {
  const s = Math.sqrt(1 + k * k) / k; let R = R0; const L = (R1 - R0) * s; let l = 0;
  while (R < R1) {
    const u = l / Math.max(L, 1e-6), taper = Math.min(1, u / 0.1, (1 - u) / 0.18) * 0.55 + 0.45;
    const ph = phiAt(Rb, phiB, k, R), tx = k * Math.cos(ph) - Math.sin(ph), ty = k * Math.sin(ph) + Math.cos(ph), tl = Math.hypot(tx, ty);
    const off = (q() - 0.5) * 0.6 * w, x = R * Math.cos(ph) - ty / tl * off, y = R * Math.sin(ph) + tx / tl * off;
    const r = w * taper * (0.75 + 0.5 * q());
    // a star cloud is a cluster of smaller clumps with gaps between them (structure that reads up close)
    if (!avoid || Math.hypot(x - avoid[0], y - avoid[1]) > avoid[2] + r) {
      for (let j = 0; j < 9; j++) { const a = q() * TAU, d = r * 0.68 * Math.sqrt(q()), cr = r * (0.17 + 0.13 * q()); /* space v3: 9 smaller clumps (crisp up close, not bokeh) */ /* bold overlapping clumps (chromatin-like) */ out.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, z: (q() - 0.5) * zs * w, r: cr, color, alpha: Math.min(0.9, alpha * 1.5), seed: out.length, crisp: 1, soft: alpha === 0.24 ? 1 : alpha === 0.22 ? 2 : 0 }); } // soft: 1 = outer violet tier of the main arms, 2 = the local spur (thinned less)
    }
    const step = 0.72 * r; l += step; R += step / s;
  }
}
// returns { blobs, cores: [{ring, color, alpha}], spr: Float32Array(x,y,z,M,tint), R }
function buildSpiral(o) {
  const P = o.pal, R = o.R, q = rng(o.seed || 7), k = Math.tan((o.pitch || 12.5) * Math.PI / 180), nA = o.arms || 2;
  const Rb = o.Rb || R * 0.23, W = o.widths || [0.06, 0.05, 0.034, 0.027, 0.023, 0.018], blobs = [], spr = [];
  const arms = []; for (let j = 0; j < nA; j++) arms.push({ phiB: (o.phase || 0) + j * TAU / nA, major: nA === 4 ? j % 2 === 1 : true });
  const av = o.bubble; // the Local Bubble: no star cloud around the Sun
  for (const a of arms) armClouds(blobs, q, Rb, a.phiB, k, Rb, R * 1.02, (a.major ? W[0] : W[1]) * R, P.outer, 0.24, av);
  if (o.spur) armClouds(blobs, q, o.spur.R0 * Math.exp(Math.tan(o.spur.pitch * Math.PI / 180) * (o.spur.a - o.spur.phi0)), o.spur.a, Math.tan(o.spur.pitch * Math.PI / 180),
    o.spur.R0 * Math.exp(Math.tan(o.spur.pitch * Math.PI / 180) * (o.spur.a - o.spur.phi0)), o.spur.R0 * Math.exp(Math.tan(o.spur.pitch * Math.PI / 180) * (o.spur.b - o.spur.phi0)), o.spur.w, P.outer, 0.22, av);
  for (const a of arms) armClouds(blobs, q, Rb, a.phiB, k, Rb * 1.03, R * (a.major ? 0.76 : 0.66), (a.major ? W[2] : W[3]) * R, P.arm, 0.42, av);
  for (const a of arms) armClouds(blobs, q, Rb, a.phiB, k, Rb * 1.02, R * (a.major ? 0.46 : 0.38), (a.major ? W[4] : W[5]) * R, P.inner, 0.5, av);
  // bar: a chain of warm clouds; core: stepped flat ellipses (peach, white-hot)
  const bang = o.barAng ?? 0;
  if (o.bar) { const L = o.bar * R; for (let t = -1; t <= 1.001; t += 0.1) { const r = R * 0.032 * (1.1 - 0.45 * Math.abs(t)); blobs.push({ x: Math.cos(bang) * L * t + (q() - 0.5) * r * 0.5, y: Math.sin(bang) * L * t + (q() - 0.5) * r * 0.5, z: 0, r, color: P.inner, alpha: 0.42, seed: 900 + blobs.length, crisp: 1 }); } }
  // bulge: stacked soft glows (orange → peach → white-hot), part of the same cloud language, not a flat cut-out
  // core: stepped flat ellipses in the disc plane (true-limits/11: orange → peach → white-hot), aligned with the bar
  const cores = [{ ring: ellipse(0, 0, R * 0.17, R * 0.12, bang, 56), color: P.inner, alpha: 0.5 }, { ring: ellipse(0, 0, R * 0.105, R * 0.072, bang, 48), color: P.core, alpha: 0.75 }, { ring: ellipse(0, 0, R * 0.05, R * 0.034, bang, 36), color: P.hot, alpha: 1 }];
  // luminous points: star complexes along arms (young, bright) + bulge (old, warm)
  const nS = o.nSpr ?? 400;
  for (let i = 0; i < nS; i++) {
    const a = arms[i % nA], Rr = R * (0.24 + 0.76 * Math.sqrt(q())), ph = phiAt(Rb, a.phiB, k, Rr), off = (q() + q() + q() - 1.5) * 0.09 * R;
    const tx = k * Math.cos(ph) - Math.sin(ph), ty = k * Math.sin(ph) + Math.cos(ph), tl = Math.hypot(tx, ty);
    const x = Rr * Math.cos(ph) - ty / tl * off, y = Rr * Math.sin(ph) + tx / tl * off;
    if (o.avoid && Math.hypot(x - o.avoid[0], y - o.avoid[1]) < o.avoid[2]) continue;
    spr.push(x, y, (q() - 0.5) * 0.008 * R, (o.sprM ?? -6) - 3.6 * q() * q(), P.spr[(q() * P.spr.length) | 0]);
  }
  for (let i = 0; i < (o.nBulge ?? nS * 0.1); i++) { const rr = R * 0.09 * -Math.log(1 - 0.95 * q()), t = q() * TAU; spr.push(rr * Math.cos(t) * 1.3, rr * Math.sin(t) * 0.8, (q() - 0.5) * rr * 0.6, (o.sprM ?? -6) + 1.2 - 1.6 * q(), q() < 0.6 ? T_WARM : T_ORANGE); }
  return { blobs, cores, spr: new Float32Array(spr), R, glowR: 0.16 * R };
}
function buildIrregular(o) {
  const P = o.pal, R = o.R, q = rng(o.seed || 11), blobs = [], spr = [];
  const n = 5 + ((q() * 5) | 0);
  for (let i = 0; i < n; i++) { const t = q() * TAU, rr = R * 0.5 * Math.sqrt(q()), x = Math.cos(t) * rr, y = Math.sin(t) * rr * 0.75, s = R * (0.25 + 0.2 * q()); blobs.push({ x, y, z: 0, r: s, color: P.outer, alpha: 0.35, seed: i }); if (q() < 0.7) blobs.push({ x, y, z: 0, r: s * 0.55, color: P.arm, alpha: 0.45, seed: 50 + i }); if (q() < 0.45) blobs.push({ x, y, z: 0, r: s * 0.25, color: P.inner, alpha: 0.6, seed: 90 + i }); }
  if (o.lmc) for (let t = -1; t <= 1.001; t += 0.2) blobs.push({ x: Math.cos(0.4) * R * 0.4 * t, y: Math.sin(0.4) * R * 0.4 * t, z: 0, r: R * 0.1, color: P.inner, alpha: 0.28, seed: 200 + t * 10 });
  const nS = o.nSpr ?? 60;
  for (let i = 0; i < nS; i++) { const t = q() * TAU, rr = R * 0.6 * Math.sqrt(q()); spr.push(Math.cos(t) * rr, Math.sin(t) * rr * 0.75, (q() - 0.5) * 0.1 * R, (o.sprM ?? -5.5) - 2.5 * q() * q(), P.spr[(q() * P.spr.length) | 0]); }
  return { blobs, cores: [], spr: new Float32Array(spr), R, glowR: 0.4 * R };
}
function buildSpheroid(o) { // dwarf spheroidal (faint soft cloud) or elliptical (bright, stepped core)
  const P = o.pal, R = o.R, q = rng(o.seed || 13), e = clamp(o.ell ?? 0.25, 0, 0.7), spr = [], blobs = [], cores = [];
  if (o.ell_bright) { cores.push({ ring: ellipse(0, 0, R * 0.5, R * 0.5 * (1 - e), 0, 48), color: P.inner, alpha: 0.85 }, { ring: ellipse(0, 0, R * 0.26, R * 0.26 * (1 - e), 0, 40), color: P.core, alpha: 0.95 }, { ring: ellipse(0, 0, R * 0.1, R * 0.1 * (1 - e), 0, 28), color: P.hot, alpha: 1 }); blobs.push({ x: 0, y: 0, z: 0, r: R, color: P.outer, alpha: 0.45, seed: 1 }); }
  else { blobs.push({ x: 0, y: 0, z: 0, r: R, color: P.outer, alpha: 0.35, seed: 1 }, { x: 0, y: 0, z: 0, r: R * 0.5, color: P.arm, alpha: 0.3, seed: 2 }); }
  const nS = o.nSpr ?? 30;
  for (let i = 0; i < nS; i++) { const t = q() * TAU, rr = R * 0.75 * Math.sqrt(q()); spr.push(Math.cos(t) * rr, Math.sin(t) * rr * (1 - e), (q() - 0.5) * 0.3 * R, (o.sprM ?? -3.5) - 2 * q() * q(), q() < 0.6 ? T_WARM : T_WHITE); }
  return { blobs, cores, spr: new Float32Array(spr), R, glowR: 0.5 * R };
}

// ---------- the galaxy object ----------
// spec: { name, O:[x,y,z] (galaxy frame, metres), ex, ey, ez (unit axes), R (kpc), MV, kind, palName, seed, minPx, ... }
// surface-brightness factor: diffuse dwarfs (Sagittarius dSph spans ~20° of sky but is ~25 mag/arcsec²) stay faint
const sbFactor = (MV, R) => clamp(Math.pow(10, -0.4 * (MV + 5 * Math.log10(Math.max(R, 0.05)) + 14)), 0, 1);
export function makeGalaxy(spec) { return { ...spec, K: KPC, geo: null, sb: sbFactor(spec.MV, spec.R) }; }
function geometry(G) {
  if (G.geo) return G.geo;
  const pal = GPAL[G.palName || 'warm'], base = { R: G.R, pal, seed: G.seed || 3 };
  if (G.kind === 'mw') G.geo = buildSpiral({ ...base, ...G.build, pal: GPAL.mw });
  else if (G.kind === 'spiral') G.geo = buildSpiral({ ...base, arms: G.arms || 2, pitch: G.pitch || 14, bar: G.bar, nSpr: G.nSpr, sprM: G.sprM, phase: (G.seed || 0) * 0.37 });
  else if (G.kind === 'irr' || G.kind === 'lmc') G.geo = buildIrregular({ ...base, lmc: G.kind === 'lmc', nSpr: G.nSpr, sprM: G.sprM });
  else G.geo = buildSpheroid({ ...base, ell: G.ell, ell_bright: G.kind === 'ell', nSpr: G.nSpr, sprM: G.sprM });
  if (G.extraBlobs) G.geo.blobs = G.geo.extra = G.geo.blobs.concat(G.extraBlobs);
  return G.geo;
}

// ---------- camera (galaxy frame) ----------
export function camOf(V) { const e = V.c('galaxy'); return { p: e.p, r: e.r, u: e.u, b: e.b, f: V.f, cx: V.cx, cy: V.cy, w: V.w, h: V.h, near: V.near, s: V.s, z: V.z, t: V.t }; }
// per-galaxy projection state: camera-space origin + axes (scaled by K·E metres per kpc); camera position in local kpc
function prep(G, C, E) {
  const o = [G.O[0] - C.p[0], G.O[1] - C.p[1], G.O[2] - C.p[2]];
  const cs = (v) => [v[0] * C.r[0] + v[1] * C.r[1] + v[2] * C.r[2], v[0] * C.u[0] + v[1] * C.u[1] + v[2] * C.u[2], -(v[0] * C.b[0] + v[1] * C.b[1] + v[2] * C.b[2])];
  const Oc = cs(o), a = cs(G.ex), b = cs(G.ey), c = cs(G.ez), K = G.K * E;
  const m = [-o[0], -o[1], -o[2]];
  const cl = [(m[0] * G.ex[0] + m[1] * G.ex[1] + m[2] * G.ex[2]) / K, (m[0] * G.ey[0] + m[1] * G.ey[1] + m[2] * G.ey[2]) / K, (m[0] * G.ez[0] + m[1] * G.ez[1] + m[2] * G.ez[2]) / K];
  return { O: Oc, A: [a[0] * K, a[1] * K, a[2] * K, b[0] * K, b[1] * K, b[2] * K, c[0] * K, c[1] * K, c[2] * K], cl, K };
}
// project a planar ring (local x,y at z=0) into `path` with near-plane clipping
const TX = new Float64Array(4096), TY = new Float64Array(4096), TZ = new Float64Array(4096);
function ringPath(path, ring, step, S, C) {
  const n = (ring.length / 2 / step) | 0; if (n < 3) return;
  const O = S.O, A = S.A, near = C.near, f = C.f, cx = C.cx, cy = C.cy; let allIn = true;
  for (let i = 0; i < n; i++) { const x = ring[i * step * 2], y = ring[i * step * 2 + 1]; TX[i] = O[0] + x * A[0] + y * A[3]; TY[i] = O[1] + x * A[1] + y * A[4]; TZ[i] = O[2] + x * A[2] + y * A[5]; if (TZ[i] <= near) allIn = false; }
  if (allIn) { for (let i = 0; i < n; i++) { const k = f / TZ[i], sx = cx + TX[i] * k, sy = cy - TY[i] * k; i ? path.lineTo(sx, sy) : path.moveTo(sx, sy); } path.closePath(); return; }
  let started = false;
  const emit = (X, Y, Z) => { const k = f / Z, sx = clamp(cx + X * k, -1e6, 1e6), sy = clamp(cy - Y * k, -1e6, 1e6); if (started) path.lineTo(sx, sy); else { path.moveTo(sx, sy); started = true; } };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ai = TZ[i] > near, bj = TZ[j] > near;
    if (ai) emit(TX[i], TY[i], TZ[i]);
    if (ai !== bj) { const t = (near - TZ[i]) / (TZ[j] - TZ[i]); emit(TX[i] + (TX[j] - TX[i]) * t, TY[i] + (TY[j] - TY[i]) * t, near); }
  }
  if (started) path.closePath();
}
// sight-line path (kpc) through the galaxy's own dust layer, from the camera (local cl) to a local point
const DUST_H = 0.12, DUST_K = 2.6; // half-thickness (kpc), extinction (mag per kpc of path)
function dustA(cl, x, y, z, R) {
  const dx = cl[0] - x, dy = cl[1] - y, dz = cl[2] - z, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
  const sinel = Math.abs(dz) / L, path = Math.min(L, R, DUST_H / Math.max(sinel, 1e-6));
  return DUST_K * path * (Math.abs(cl[2]) < DUST_H || Math.abs(z) < DUST_H ? 1 : 0);
}

// true pixel radius of a galaxy (-1 when its centre is behind the camera; huge when the camera is inside it)
export function galaxyPx(G, C) {
  const o0 = G.O[0] - C.p[0], o1 = G.O[1] - C.p[1], o2 = G.O[2] - C.p[2];
  const Z = -(o0 * C.b[0] + o1 * C.b[1] + o2 * C.b[2]), d = Math.sqrt(o0 * o0 + o1 * o1 + o2 * o2), RR = G.R * G.K * 1.1;
  if (d < RR * 2) return 1e6;
  if (Z <= 0) return -1;
  return C.f * RR / Z;
}
// enlargement for the minimum-size law (1 when the galaxy is already large enough)
export function enlarge(G, C, pr, k = 1) { const m = (G.minPx || 0) * C.s * k; return pr > 0 && m > pr ? m / pr : 1; }
// the nucleus as a luminous point (all that is left of a galaxy once it is smaller than a pixel)
export function nucleusPoint(G, C, mlim, pts, X, Y, Z, d2, A = 0) {
  const k = C.f / Z, M = G.MV + (G.kind === 'spiral' || G.kind === 'mw' ? 0.9 : 0.2);
  pts.add(C.cx + X * k, C.cy - Y * k, mlim - appMag(M, d2) - A, GPAL[G.palName || 'warm'].nuc, 3, (G.seed || 1) * 7.1);
}

// draw a galaxy: clouds (outer → arms → inner), stepped core, core glow, points. `E` = enlargement (minimum-size law).
export function drawGalaxy(c, G, C, mlim, pr, E = 1) {
  const geo = geometry(G), S = prep(G, C, E), prE = pr * E, s = C.s, dx = diffuseExposure(C.z);
  // star clouds (blobs are listed outer tier first, so inner, brighter tiers land on top)
  SMALL.clear();
  if (dx > 0.002) for (const B of geo.blobs) drawBlob(c, B, S, C, G, dx);
  // tiny clumps (< 2.5 px): batched flat discs per colour × alpha step (the sprite's light at that size)
  for (const [k, p] of SMALL) { const [col, aq] = k.split('|'); c.globalAlpha = +aq / 40; c.fillStyle = col; c.fill(p); }
  c.globalAlpha = 1;
  // stepped core (flat fills) + warm core glow
  const step = prE > 260 ? 1 : prE > 70 ? 2 : prE > 20 ? 4 : 8;
  const cext = G.dust ? Math.pow(10, -0.4 * dustA(S.cl, 0, 0, 0, G.R)) : 1;
  for (const L of geo.cores) { const p = new Path2D(); ringPath(p, L.ring, step, S, C); c.globalAlpha = L.alpha * Math.max(G.sb, 0.35) * cext * dx; c.fillStyle = L.color; c.fill(p); }
  if (dx > 0.002) { c.globalCompositeOperation = 'lighter'; sphere(c, S.O[0], S.O[1], S.O[2], geo.glowR * S.K, GPAL[G.palName || (G.kind === 'mw' ? 'mw' : 'warm')].glow, 0.28 * Math.max(G.sb, 0.3) * (G.dust ? Math.pow(10, -0.4 * dustA(S.cl, 0, 0, 0, G.R)) : 1) * dx, C); }
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  // luminous points
  const P = POINTS.reset(), sp = geo.spr;
  for (let i = 0; i < sp.length; i += 5) {
    const x = sp[i], y = sp[i + 1], z = sp[i + 2];
    const X = S.O[0] + x * S.A[0] + y * S.A[3] + z * S.A[6], Y = S.O[1] + x * S.A[1] + y * S.A[4] + z * S.A[7], Z = S.O[2] + x * S.A[2] + y * S.A[5] + z * S.A[8];
    if (Z <= C.near) continue; const k = C.f / Z, sx = C.cx + X * k, sy = C.cy - Y * k; if (sx < -60 || sx > C.w + 60 || sy < -60 || sy > C.h + 60) continue;
    const dl = mlim - appMag(sp[i + 3], X * X + Y * Y + Z * Z) - (G.dust ? dustA(S.cl, x, y, z, G.R) : 0); if (dl < VIS) continue;
    P.add(sx, sy, dl, sp[i + 4], 0, i + (G.seed || 0) * 977);
  }
  const Zc = S.O[2]; if (Zc > C.near) nucleusPoint(G, C, mlim, P, S.O[0], S.O[1], Zc, S.O[0] * S.O[0] + S.O[1] * S.O[1] + Zc * Zc, G.dust ? dustA(S.cl, 0, 0, 0, G.R) : 0);
  P.draw(c, s, C.t);
}
const POINTS = new Points(4096), SMALL = new Map();

// soft sprite per colour: a flat plateau with a soft edge (Kurzgesagt nebula / star-cloud look)
const NEB = new Map();
function nebSprite(col) {
  let cv = NEB.get(col); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = cv.height = 96; const g = cv.getContext('2d'), gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.42, rgba(col, 0.92)); gr.addColorStop(0.7, rgba(col, 0.42)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 96, 96); NEB.set(col, cv); return cv;
}
const CLUMP = new Map();
function clumpSprite(col) { // a crisper clump: flat plateau to 0.55, quick soft edge
  let cv = CLUMP.get(col); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.72, rgba(col, 0.96)); gr.addColorStop(0.86, rgba(col, 0.45)); gr.addColorStop(1, rgba(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); CLUMP.set(col, cv); return cv;
}
export { nebSprite };
// one continuous soft-sphere renderer. Inside: the sphere's light along the central view ray (chord fraction) as a uniform
// tint; a sphere subtending a large angle blends (20°–32°, by geometry) into that tint; small ones are soft sprites.
export function sphere(c, X, Y, Z, r, color, a0, C, crisp = 0, v = 0) {
  const d2 = X * X + Y * Y + Z * Z, r2 = r * r;
  const chord = () => { const p2 = X * X + Y * Y; if (p2 >= r2) return 0; const half = Math.sqrt(r2 - p2); return Math.max(0, Z + half - Math.max(0, Z - half)) / (2 * r); };
  if (d2 < r2) { c.globalAlpha = a0 * Math.min(1, chord()); c.fillStyle = color; c.fillRect(0, 0, C.w, C.h); return; }
  const al = Math.asin(Math.min(1, r / Math.sqrt(d2))), w = Math.min(1, Math.max(0, (al - 0.35) / 0.21)), ww = w * w * (3 - 2 * w);
  if (ww > 0) { const ch = chord(); if (ch > 0) { c.globalAlpha = a0 * ch * ww; c.fillStyle = color; c.fillRect(0, 0, C.w, C.h); } }
  if (ww >= 1 || Z <= C.near) return;
  const k = C.f / Z, sx = C.cx + X * k, sy = C.cy - Y * k, rp = C.f * r / Math.sqrt(d2 - r2), R2 = rp * SPRITE_K;
  if (rp < 0.3 || !(sx + R2 > 0 && sx - R2 < C.w && sy + R2 > 0 && sy - R2 < C.h)) return;
  c.globalAlpha = a0 * (1 - ww) * (rp < 1.5 ? (rp / 1.5) ** 2 : 1); c.drawImage(blobSprite(color, v, 0, R2 > 110), sx - R2, sy - R2, 2 * R2, 2 * R2); // the stacked-fill blob (dark rim, body, light core)
}
function drawBlob(c, B, S, C, G, dx = 1) {
  const X = S.O[0] + B.x * S.A[0] + B.y * S.A[3] + B.z * S.A[6], Y = S.O[1] + B.x * S.A[1] + B.y * S.A[4] + B.z * S.A[7], Z = S.O[2] + B.x * S.A[2] + B.y * S.A[5] + B.z * S.A[8];
  const ext = G.dust ? Math.pow(10, -0.4 * dustA(S.cl, B.x, B.y, B.z, G.R)) : 1; // dust hides clouds seen through the disc
  const a0 = B.alpha * ext * G.sb * dx; if (a0 < 0.004) return;
  const r = B.r * S.K;
  if (Z > C.near && Z > 6 * r) { // small and far enough that the sphere is just a disc: batch it
    const k = C.f / Z, rp = r * k;
    if (rp < 2.5) { // crisp clumps up to 5 px: a flat disc of the sprite's plateau (its soft rim is < 1.5 px there)
      if (rp < 0.3) return; const sx = C.cx + X * k, sy = C.cy - Y * k; if (sx < -4 || sx > C.w + 4 || sy < -4 || sy > C.h + 4) return;
      const a = a0 * 0.85, aq = Math.max(1, Math.round(a * 40)), key = mix(B.color, PAL.bodyDeeper, 0.12) + '|' + aq; // the blob's average tone
      let p = SMALL.get(key); if (!p) { p = new Path2D(); SMALL.set(key, p); } const rr = Math.max(rp * (rp > 2.5 ? 1.12 : 1.05), 0.5); p.moveTo(sx + rr, sy); p.arc(sx, sy, rr, 0, TAU); return;
    }
  }
  // space v3: the big soft outer (violet) cloud tier thins as a clump grows past ~2 % of the frame (by its true size on screen):
  // seen up close the arms read as crisp clumps, not as a wall of out-of-focus bokeh
  let a1 = a0; if (B.soft && Z > C.near) { const q = r * C.f / Z / C.w; a1 *= B.soft === 1 ? Math.max(0.3, Math.min(1, 1 - (q - 0.02) / 0.05)) : Math.max(0.55, Math.min(1, 1 - (q - 0.06) / 0.1)); }
  sphere(c, X, Y, Z, r, B.color, a1, C, B.crisp, (B.seed * 7 + 3) | 0);
}
