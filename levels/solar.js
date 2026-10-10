// SOLAR (z 7.5 … 16.5): the Moon, the Sun, the planets at their real positions for 23 Apr 2026 16:30 UTC, thin orbits,
// the asteroid and Kuiper belts, the heliopause and the Oort cloud — and the camera turn from "straight down on New York"
// (z 7, core key) to "40° above the ecliptic, Sun at the centre" (z 16, core key).
//
// The camera move (keys below, all strictly inside (7, 16)):
//  7.0 → 9.6  focus stays on Earth while the camera orbits it from NYC's zenith (the noon side) over the north to the
//             night side, a little above the ecliptic. Earth turns under us, the terminator slides in, the crescent Moon
//             appears behind Earth and the Sun swings into frame beside it (by rotation, not by flying past).
//  9.6 → 11.6 focus slides from Earth to the Sun almost along the line of sight (Earth stays on screen: it drifts to the
//             upper left as a lit dot), while the camera rises to 25° above the ecliptic: inner planets and orbits open up.
// 11.6 → 16   camera rises/yaws slowly to the core's 40° view; real 3D positions give true parallax between the inner orbits,
//             the belts, the heliopause rim and the Oort cloud the camera flies out through.
import { PAL, rgba, mix, screenSpace, rng, clamp } from '../core/kit.js';
import { rot, xform, planetPos, orbitElements, PLANETS, AU, R_SUN, R_MOON, radecToEcl, sunDir } from '../core/world.js';
import { mm, mv, DEG, norm, sub, mul, add, dot, len, cross } from '../core/m.js';
import { basis, cameraAt } from '../core/cam.js';
import { drawBody, drawSun, LOOKS, presence } from './solar-draw.js';
import { FAM, sink } from '../core/look.js';
import { drawBlob } from './space-kit.js';

const dirEl = (el, az) => [Math.cos(el * DEG) * Math.cos(az * DEG), Math.cos(el * DEG) * Math.sin(az * DEG), Math.sin(el * DEG)];
const azel = (v) => { const n = norm(v); return [Math.atan2(n[1], n[0]) / DEG, Math.asin(n[2]) / DEG]; };

// ---------- camera keys ----------
const P = Object.assign({ zc: 7.3, zp: 8.78, pt: 30, mf: 0.5, zn: 9.4, nA: 1.5, nE: 0.5, zs: 11.05, sEl: 1, sdA: 1.5, zf: 11.75, fEl: 26, fdA: 20, z4: 12.9, el4: 36, az4: -105 }, globalThis.__SOLARP || {});
function makeKeys() {
  const E = xform([0, 0, 0], 'earth', 'helio'), Mo = xform([0, 0, 0], 'moon', 'helio');
  const sH = norm(mul(E, -1)), mH = norm(sub(Mo, E)), [eAz] = azel(E);
  const toE = (Mh) => mm(rot('helio', 'earth'), Mh), Z = [0, 0, 1];
  // Earth + Moon beat: look down on the plane of Sun, Earth and Moon (the Moon is at first quarter, 84° from the Sun), so
  // both are half lit; the Moon sits to the right of Earth and sunlight comes from the top of the frame.
  let bp = norm(cross(mH, sH)); if (bp[2] < 0) bp = mul(bp, -1);
  // camera above and beyond the Moon (P.pt° up from the Moon direction): the Moon in the foreground at its real size,
  // Earth behind it — both about half lit (the camera direction is ~84° from the Sun)
  const bpe = norm(add(mul(mH, Math.cos(P.pt * DEG)), mul(bp, Math.sin(P.pt * DEG))));
  const ENU_N = basis([0, 0, 1], [0, 1, 0]); // the core z-7 orientation (straight down on NYC, north up)
  const mid = mul(xform([0, 0, 0], 'moon', 'earth'), P.mf);
  return [
    // same view as z 7, focus moved from NYC down to Earth's centre (along the line of sight: no shift)
    { z: P.zc, fr: 'earth', at: [0, 0, 0], M: mm(rot('enu', 'earth'), ENU_N) },
    // Earth and Moon side by side, focus between them
    { z: P.zp, fr: 'earth', at: mid, M: toE(basis(bpe, sH)) },
    // pitched up to face the Sun from Earth's night side: Earth in front, the Sun 9° to the side
    { z: P.zn, fr: 'earth', at: [0, 0, 0], M: toE(basis(dirEl(P.nE, azel(mul(sH, -1))[0] + P.nA), Z)) },
    // heading in toward the Sun from Earth's side, 30° above the ecliptic: the Sun grows (real size), Earth passes behind
    { z: P.zs, fr: 'helio', at: [0, 0, 0], M: basis(dirEl(P.sEl, eAz + P.sdA), Z), arrive: true },
    // pulling back out over the inner planets
    { z: P.zf, fr: 'helio', at: [0, 0, 0], M: basis(dirEl(P.fEl, eAz + P.fdA), Z) },
    // rising toward the core's 40° view (z 16: el 40°, az −90°)
    { z: P.z4, fr: 'helio', at: [0, 0, 0], M: basis(dirEl(P.el4, P.az4), Z) },
  ];
}

// ---------- physical data ----------
const PR = { mercury: 2.4397e6, venus: 6.0518e6, mars: 3.3895e6, jupiter: 6.9911e7, saturn: 5.8232e7, uranus: 2.5362e7, neptune: 2.4622e7 };
// IAU north poles (RA, Dec in degrees) for band / ring orientation
const POLE = { mercury: [281.01, 61.41], venus: [272.76, 67.16], mars: [317.68, 52.89], jupiter: [268.06, 64.5], saturn: [40.59, 83.54], uranus: [257.31, -15.18], neptune: [299.36, 43.46] };
const ZOD = mix(FAM.gold.base, FAM.coral.base, 0.35);
const LIGHT_S = (() => { const d = len(planetPos('earth')); return d / 299792458; })();

const NORB = 720, GAP = 14, GAP_E = 44, TAPER = 18; // Earth's orbit keeps a wider gap: the camera lives right next to it
let ORB = null, PTS = null, OORT_OK = false, OCL = null;
const OCOL = [sink(FAM.cyan.lit, 16, 0.3), sink(FAM.cyan.glow, 16, 0.4), sink(FAM.violet.lit, 16, 0.35)];
function buildOortClumps() { // every 37th Oort point seeds a short curved chain of 4 icy clumps along the shell
  OCL = []; const a = PTS.oort, R = rng(9137);
  for (let j = 0; j < a.length; j += 4 * 37) { if (!a[j + 3]) continue; const p = [a[j], a[j + 1], a[j + 2]], rad = len(p); if (rad < 1e3 * AU) continue;
    const n = norm(p), t0 = norm(cross(n, Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), t1 = cross(n, t0), th = R() * 6.2832, t = add(mul(t0, Math.cos(th)), mul(t1, Math.sin(th)));
    const r0 = rad * (0.012 + 0.012 * R()), col = OCOL[(R() * 3) | 0];
    for (let m = 0; m < 4; m++) { const a2 = R() * 6.2832, rr = r0 * 1.1 * Math.sqrt(R()); // a small ROUND cluster (straight chains read as worms)
      OCL.push({ p: add(add(p, mul(t0, Math.cos(a2) * rr)), mul(t1, Math.sin(a2) * rr)), r: r0 * (0.6 + 0.4 * R()), col, v: (R() * 4) | 0 }); } } }
function build() {
  ORB = PLANETS.map((name) => {
    const o = orbitElements(name), pts = new Float64Array(NORB * 3);
    const cw = Math.cos(o.w), sw = Math.sin(o.w), cO = Math.cos(o.Om), sO = Math.sin(o.Om), cI = Math.cos(o.I), sI = Math.sin(o.I);
    for (let i = 0; i < NORB; i++) {
      const E = i / NORB * 2 * Math.PI, xp = o.a * (Math.cos(E) - o.e), yp = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
      pts[i * 3] = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
      pts[i * 3 + 1] = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
      pts[i * 3 + 2] = (sw * sI) * xp + (cw * sI) * yp;
    }
    const p = planetPos(name); let best = 0, bd = Infinity;
    for (let i = 0; i < NORB; i++) { const d = (pts[i * 3] - p[0]) ** 2 + (pts[i * 3 + 1] - p[1]) ** 2 + (pts[i * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } }
    const n = norm([Math.sin(o.I) * Math.sin(o.Om), -Math.sin(o.I) * Math.cos(o.Om), Math.cos(o.I)]);
    return { name, pts, at: best, n, a: o.a, ci: PLANETS.indexOf(name), col: mix(name === 'earth' ? PAL.ocean : LOOKS[name].base, PAL.bodyViolet, 0.45) };
  });
  // point populations: [x, y, z, radius(m)] — "clumps" with a physical size, drawn with a size law
  const r = rng(20260415);
  const gauss = () => { let u = 0; for (let k = 0; k < 4; k++) u += r(); return (u - 2) / 0.577; };
  const pop = (n, gen) => { const a = new Float64Array(n * 4); for (let i = 0; i < n; i++) gen(a, i * 4); return a; };
  const ring = (a, j, rad, incSd, size) => {
    const th = r() * 2 * Math.PI, inc = Math.abs(gauss()) * incSd * DEG, Om = r() * 2 * Math.PI;
    a[j] = rad * Math.cos(th); a[j + 1] = rad * Math.sin(th); a[j + 2] = rad * Math.sin(inc) * Math.sin(th - Om); a[j + 3] = size;
  };
  PTS = {
    // main belt 2.1–3.3 AU (with the 2.5 and 2.82 AU Kirkwood gaps thinned)
    ast: pop(2200, (a, j) => { let R; do { R = 2.1 + r() * 1.2; } while ((Math.abs(R - 2.5) < 0.03 || Math.abs(R - 2.82) < 0.03) && r() < 0.85); ring(a, j, R * AU, 7, 0.9e8 * (0.5 + r())); }),
    // Kuiper belt: classical 42–48 AU core plus a wider 30–55 AU spread
    kui: pop(2600, (a, j) => { const R = r() < 0.6 ? 42 + r() * 6 : 30 + r() * 25; ring(a, j, R * AU, r() < 0.6 ? 4 : 14, 1.4e9 * (0.5 + r())); }),
    // Oort cloud: inner (Hills) cloud flattened toward the ecliptic, outer cloud spherical; radius 2,000–100,000 AU
    oort: pop(6000, (a, j) => {
      const inner = r() < 0.6, R = (inner ? 2000 * Math.pow(10, r() * 1.0) : 20000 * Math.pow(5, Math.pow(r(), 0.8))) * AU;
      const u = r() * 2 - 1, ph = r() * 2 * Math.PI, s = Math.sqrt(1 - u * u);
      a[j] = R * s * Math.cos(ph); a[j + 1] = R * s * Math.sin(ph); a[j + 2] = R * u * (inner ? 0.35 : 1); a[j + 3] = R * (inner ? 7e-4 : 5e-4) * (0.5 + r());
    }),
  };
}
// Remove the few Oort clumps that would pass within ~5° of the camera's own path (they would fly into the lens as
// screen-sized blobs). Runs once, after the camera keys exist.
function cullOort() {
  const bs = []; for (let z = 12.5; z <= 17.01; z += 0.1) { const cam = cameraAt(z, 0); bs.push(norm(mv(rot(cam.fr, 'helio'), [cam.M[2], cam.M[5], cam.M[8]]))); }
  const a = PTS.oort, cos5 = Math.cos(5 * DEG);
  for (let j = 0; j < a.length; j += 4) { const n = norm([a[j], a[j + 1], a[j + 2]]); for (const b of bs) if (dot(n, b) > cos5) { a[j + 3] = 0; break; } }
  OORT_OK = true;
}

// ---------- projection helpers (helio frame, batched) ----------
function camH(V) { const e = V.c('helio'); return { p: e.p, r: e.r, u: e.u, b: e.b }; }
const NB = 8; // alpha buckets for point clouds
function pointItems(V, C, arr, col, ds, name, minPx = 0.9, gate = 1, thin = 1) {
  if (gate <= 0) return [];
  const f = V.f, cx = V.cx, cy = V.cy, near = V.near, W = V.w, H = V.h;
  const paths = [[], []]; for (let s = 0; s < 2; s++) for (let k = 0; k < NB; k++) paths[s].push(null);
  let cnt = 0;
  for (let j = 0; j < arr.length; j += 4 * thin) {
    const size = arr[j + 3]; if (!size) continue;
    const vx = arr[j] - C.p[0], vy = arr[j + 1] - C.p[1], vz = arr[j + 2] - C.p[2];
    const d = -(vx * C.b[0] + vy * C.b[1] + vz * C.b[2]); if (d <= near) continue;
    const k = f / d, sx = cx + (vx * C.r[0] + vy * C.r[1] + vz * C.r[2]) * k, sy = cy - (vx * C.u[0] + vy * C.u[1] + vz * C.u[2]) * k;
    const px = size * k * gate; const rr = Math.max(px, minPx); if (sx < -rr || sx > W + rr || sy < -rr || sy > H + rr) continue;
    const a = px >= minPx ? 1 : Math.sqrt(px / minPx); if (a < 0.05) continue;
    const bk = Math.min(NB - 1, Math.floor(a * NB)), side = d > ds ? 0 : 1;
    let P = paths[side][bk]; if (!P) P = paths[side][bk] = new Path2D();
    P.moveTo(sx + rr, sy); P.arc(sx, sy, rr, 0, 6.2832); // flat round blobs, never pixel speckle
    cnt++;
  }
  if (!cnt) return [];
  const mk = (side) => (c) => { screenSpace(c); for (let k = 0; k < NB; k++) { const P = paths[side][k]; if (!P) continue; c.fillStyle = rgba(col, 0.85 * (k + 0.5) / NB); c.fill(P); } };
  return [{ name, d: ds * 1.0000001 + 1, g: 0, draw: mk(0) }, { name, d: ds * 0.9999999, g: 0, draw: mk(1) }];
}

// Orbits (fix round 1): soft coloured bands, each a flat ribbon in its real orbital plane (1 % of the orbit's size wide)
// drawn at least ~2 px wide. Their opacity follows the ribbon's true projected width (edge-on → nothing, by geometry).
// Each orbit has its own near limit: parts closer to the camera than 0.6 × the orbit's radius are not drawn (they
// would only be stray arcs across the Earth–Moon frames); the band thins out over 0.6–0.95 of that radius.
const RIB = 0.008, NA = 8;
// a planet (and its orbit band) is enlarged only once the camera has backed out from the Sun far enough to see its
// orbit: 0 at dSun = a/4, 1 at dSun = 0.8 a (log-linear in the camera's real distance; inner planets first, then outer)
const reveal = (dSun, a) => clamp(Math.log10(dSun / (0.25 * a)) / 0.5, 0, 1);
function nearFade(dist, dSun) { return clamp((dist / dSun - 0.5) / 0.25, 0, 1); }
function orbitItems(V, C, ds, dSun) {
  const f = V.f, cx = V.cx, cy = V.cy, near = V.near, LIM = 2e5, s = V.s;
  const paths = [new Map(), new Map()]; let any = false;
  for (const O of ORB) {
    const G = O.name === 'earth' ? GAP_E : GAP, pts = O.pts, span = NORB - 2 * G, n = O.n, w = O.a * RIB, rv = clamp(Math.log10(dSun / (1.6 * Math.max(O.a, 0.8 * AU))) / 0.35, 0, 1); let prev = null; // orbit bands appear once the camera is out past ~1.6 × the orbit
    if (rv <= 0) continue;
    for (let m = 0; m <= span; m++) {
      const i = (O.at + G + m) % NORB, j = i * 3;
      const vx = pts[j] - C.p[0], vy = pts[j + 1] - C.p[1], vz = pts[j + 2] - C.p[2];
      const d = -(vx * C.b[0] + vy * C.b[1] + vz * C.b[2]);
      const dist = Math.hypot(vx, vy, vz), nf = clamp((dist / O.a - 0.6) / 0.35, 0, 1);
      if (d <= near * 4 || nf <= 0) { prev = null; continue; }
      const k = f / d, sx = cx + (vx * C.r[0] + vy * C.r[1] + vz * C.r[2]) * k, sy = cy - (vx * C.u[0] + vy * C.u[1] + vz * C.u[2]) * k;
      if (Math.abs(sx) > LIM || Math.abs(sy) > LIM) { prev = null; continue; }
      const sinA = Math.abs(vx * n[0] + vy * n[1] + vz * n[2]) / dist, ws = w * k * sinA;
      const taper = Math.min(1, Math.min(m, span - m) / TAPER);
      const a = clamp(ws / (1.1 * s), 0, 1) * (0.2 + 0.8 * taper) * nf * rv;
      const lw = clamp(ws, 2.0 * s, 6 * s), side = d > ds ? 0 : 1;
      if (prev && a > 0.04) {
        const ab = Math.min(NA - 1, Math.floor(a * NA)), wb = lw < 3 * s ? 0 : lw < 4.5 * s ? 1 : 2, key = (O.ci * NA + ab) * 3 + wb;
        let P = paths[side].get(key); if (!P) { P = new Path2D(); paths[side].set(key, P); }
        P.moveTo(prev[0], prev[1]); P.lineTo(sx, sy); any = true;
      }
      prev = [sx, sy];
    }
  }
  if (!any) return [];
  const WB = [2.0 * s, 3.6 * s, 5.4 * s];
  const mk = (side) => (c) => { screenSpace(c); c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [key, P] of paths[side]) { const wb = key % 3, ab = Math.floor(key / 3) % NA, ci = Math.floor(key / 3 / NA), col = ORB[ci].col, al = (ab + 0.5) / NA;
      // a wide soft ribbon: three stacked translucent widths (no hairline core)
      c.lineWidth = WB[wb] * 5; c.strokeStyle = rgba(col, 0.05 * al); c.stroke(P);
      c.lineWidth = WB[wb] * 2.4; c.strokeStyle = rgba(col, 0.09 * al); c.stroke(P);
      c.lineWidth = WB[wb] * 1.1; c.strokeStyle = rgba(col, 0.16 * al); c.stroke(P); } };
  return [{ name: 'orbits', d: ds * 1.0000002 + 2, g: 0, draw: mk(0) }, { name: 'orbits', d: ds * 0.9999998, g: 0, draw: mk(1) }];
}

// Belt bands: a translucent annulus lying in the ecliptic under the belt's dots (rogue-earth/03), clipped by the same
// orbit-layer near limit (as a plane in camera space). Edge-on it is a thin line of colour, by geometry.
function clipPoly(cs, dmin) { const out = []; for (let i = 0; i < cs.length; i++) { const a = cs[i], b = cs[(i + 1) % cs.length], ia = a[2] >= dmin, ib = b[2] >= dmin;
  if (ia) out.push(a); if (ia !== ib) { const t = (dmin - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, dmin]); } } return out; }
function bandItem(V, C, r1, r2, col, alpha, ds, dSun, name) {
  const toC = (p) => { const v = sub(p, C.p); return [dot(v, C.r), dot(v, C.u), -dot(v, C.b)]; }, dmin = Math.max(V.near * 4, 0.5 * dSun);
  const ring = (R) => { const a = []; for (let i = 0; i < 128; i++) { const th = i / 128 * 2 * Math.PI; a.push(toC([R * Math.cos(th), R * Math.sin(th), 0])); } return clipPoly(a, dmin); };
  const o = ring(r2), inn = ring(r1); if (o.length < 3) return null;
  const P = new Path2D(), add = (pts) => { pts.forEach((c, i) => { const x = V.cx + c[0] * V.f / c[2], y = V.cy - c[1] * V.f / c[2]; i ? P.lineTo(x, y) : P.moveTo(x, y); }); P.closePath(); };
  add(o); if (inn.length >= 3) add(inn);
  return { name, d: ds * 1.0000003 + 3, g: 0, draw(c) { screenSpace(c); c.fillStyle = rgba(col, alpha); c.fill(P, 'evenodd'); } };
}

// Heliosphere (fix round 1): a soft glow bubble with no outline. Its brightness along every line of sight is the real
// path length through the heliosheath shell (termination shock 115 AU → heliopause 145 AU radius around a centre pushed
// 25 AU tailward), so it is continuous as the camera crosses the shell: from inside only the far wall shows (a faint
// tint), from outside the limb is brightest and the outer edge falls off as a square root, never a line.
const NOSE = dirEl(5, 255), H_C = mul(NOSE, -25 * AU), H_R2 = 145 * AU, H_R1 = 115 * AU;
function chord(D, ct, R) { const st2 = 1 - ct * ct, b2 = D * D * st2; if (b2 >= R * R) return 0; const tc = D * ct, h = Math.sqrt(R * R - b2); return Math.max(0, tc + h) - Math.max(0, tc - h); }
function helioItem(V, C) {
  const v = sub(H_C, C.p), D = len(v), d = -dot(v, C.b); if (d <= V.near) return null;
  const k = V.f / d, sx = V.cx + dot(v, C.r) * k, sy = V.cy - dot(v, C.u) * k;
  const corner = Math.hypot(Math.max(sx, V.w - sx), Math.max(sy, V.h - sy)), fe = V.f * D / d;
  const col = mix(PAL.nucLit, PAL.bodyViolet, 0.35), A = 0.06, // space v3: a faint bubble (it read as a big blurred ring flashing past)
    Lpk = 2 * Math.sqrt(H_R2 * H_R2 - H_R1 * H_R1), N = 48, stops = [];
  // minus the thinnest path over the whole sky (continuous: R2−R1 in the cavity, R2−r in the sheath, 0 outside), so the
  // uniform far-wall tint seen from inside is never drawn — only the bubble's shape
  const Lmin = D < H_R1 ? H_R2 - H_R1 : D < H_R2 ? H_R2 - D : 0;
  for (let i = 0; i <= N; i++) { const rho = corner * i / N, th = Math.atan(rho / fe), ct = Math.cos(th);
    const L = chord(D, ct, H_R2) - chord(D, ct, H_R1) - Lmin; stops.push(A * Math.pow(clamp(L / Lpk, 0, 1), 3)); } // limb-weighted: a clear bubble, not a fog
  if (Math.max(...stops) < 0.004) return null;
  const r2px = D > H_R2 ? fe * H_R2 / Math.sqrt(D * D - H_R2 * H_R2) : Infinity;
  return { name: 'heliosphere', d: d + H_R2, g: 0, r2px, sx, sy, draw(c) {
    screenSpace(c); const g = c.createRadialGradient(sx, sy, 0, sx, sy, corner);
    stops.forEach((a, i) => g.addColorStop(i / N, rgba(col, a))); c.fillStyle = g; c.fillRect(0, 0, V.w, V.h);
  } };
}

function sunAt(V, zr, t) { const cam = cameraAt(zr, t), p = sub(xform([0, 0, 0], 'helio', cam.fr), cam.pos), M = cam.M;
  const x = p[0] * M[0] + p[1] * M[3] + p[2] * M[6], y = p[0] * M[1] + p[1] * M[4] + p[2] * M[7], d = -(p[0] * M[2] + p[1] * M[5] + p[2] * M[8]);
  return [V.cx + x * V.f / d, V.cy - y * V.f / d]; }
const toCam = (C, w) => [dot(w, C.r), dot(w, C.u), dot(w, C.b)];

export default {
  id: 'solar', zr: [7.3, 19.5],
  get keys() { return makeKeys(); },
  async load() { build(); },
  draw(V, items, labels) {
    if (!ORB) build();
    if (!OORT_OK) cullOort();
    const C = camH(V), t = V.t, s = V.s, z = V.z;
    const sc = V.cs('helio', [0, 0, 0]), ds = sc[2] > V.near ? sc[2] : 0, dSun = len(C.p);
    const lab = []; // candidate labels: [zFrom, zTo, x, y, text, sub]; at most one is pushed
    const beside = (x, y, r, text, sub) => { const lw = 230 * V.w / (globalThis.innerWidth || V.w), off = r + 10 * s;
      const nx = x + off + lw <= V.w - 50 ? x + off : x - off - lw >= 50 ? x - off - lw : -1e4; return { x: Math.round(nx), y: Math.round(y - 22 * s), text, sub }; };
    // --- the Sun: one warm look at every size (presence disc 16 px near 1 AU, shrinking to the star core far away) ---
    if (sc[2] > V.near) {
      const k = V.f / sc[2], sx = V.cx + sc[0] * k, sy = V.cy - sc[1] * k;
      const R = V.f * Math.tan(Math.asin(Math.min(0.999, R_SUN / dSun))) * (dSun / sc[2]);
      const Rp = presence(dSun, AU, 8 * s, 6), d2 = dSun * dSun;
      if (V.onScreen(sx, sy, Math.max(R, Rp) * 12 + 60 * s)) {
        items.push({ name: 'sun', d: sc[2], g: 0, draw(c) { screenSpace(c); drawSun(c, sx, sy, R, Rp, z, d2, t, s); } });
        // the story label is pinned beside where the Sun sits at z 10.2 (it moves < 0.03 W over the window), so it is calm
        // on screen; it still follows the slow camera drift with time
        const ref = sunAt(V, 9.8, t), Lb = beside(ref[0], ref[1], 44 * s, `Sunlight · ${Math.floor(LIGHT_S / 60)} min ${Math.round(LIGHT_S % 60)} s`, `it left the Sun ${(LIGHT_S / 60).toFixed(1)} minutes before he sneezed`);
        Lb.a = clamp(Math.min(z - 9.25, 10.25 - z) / 0.12, 0, 1); lab.push([9.25, 10.25, Lb]);
      }
    }
    // --- the Moon: real position (two days before new moon), presence 5 px while the Earth–Moon pair is the subject ---
    {
      const mc = V.cs('moon', [0, 0, 0]);
      if (mc[2] > V.near) {
        const k = V.f / mc[2], sx = V.cx + mc[0] * k, sy = V.cy - mc[1] * k, rpx = R_MOON * k;
        const e = V.c('moon'), pres = presence(len(e.p), 3.844e8, 13 * s, 20); // space v3: beside Earth through the Earth+Moon beat (full to 20 x its orbit, gone by z ~10.7) // (integration fix) visibly present through the Earth+Moon beat
        if (Math.max(rpx, pres) > 0.02 && V.onScreen(sx, sy, Math.max(rpx, pres, 2) * 3)) {
          const sd = sunDir('moon'), sCam = [dot(sd, e.r), dot(sd, e.u), dot(sd, e.b)], pCam = [e.r[2], e.u[2], e.b[2]];
          items.push({ name: 'moon', d: mc[2], blur: Math.min(V.coc(mc[2]), 0.6), g: 0, draw(c) { screenSpace(c); drawBody(c, sx, sy, rpx, sCam, LOOKS.moon, pCam, pres, t); } });
          const rr = Math.max(rpx, pres); if (rr > 3.5 * s) { const Lm = beside(sx, sy, rr * 1.5, 'The Moon', '384,000 km away · half lit today'); Lm.a = clamp(Math.min(z - 8.6, 9.05 - z) / 0.1, 0, 1); lab.push([8.6, 9.05, Lm]); }
        }
      }
    }
    // --- planets: real positions, presence 4.5 px (honest enlargement) while the camera is within ~6 orbit sizes ---
    const PL = { venus: [10.95, 11.7, 'Venus', 'the hottest planet · 12,104 km'], jupiter: [12.15, 12.9, 'Jupiter', 'the giant · 140,000 km'] };
    for (const O of ORB) {
      const name = O.name; if (name === 'earth') continue;
      const p = planetPos(name), v = sub(p, C.p), d = -dot(v, C.b); if (d <= V.near) continue;
      const k = V.f / d, sx = V.cx + dot(v, C.r) * k, sy = V.cy - dot(v, C.u) * k, rpx = PR[name] * k;
      const giant = O.a > 3 * AU, pres = presence(len(v), O.a, (giant ? 10 : 5) * s, 6) * (giant ? reveal(dSun, O.a) : 1), rr = Math.max(rpx, pres);
      if (!V.onScreen(sx, sy, Math.max(rr * 3, 3))) continue;
      const sCam = toCam(C, norm(mul(p, -1))), pl = POLE[name], pCam = toCam(C, radecToEcl(pl[0], pl[1]));
      items.push({ name, d, blur: V.coc(d), g: 0, draw(c) { screenSpace(c); drawBody(c, sx, sy, rpx, sCam, LOOKS[name], pCam, pres, t); } });
      const sunS = sc[2] > V.near ? [V.cx + sc[0] * V.f / sc[2], V.cy - sc[1] * V.f / sc[2]] : [-1e9, -1e9];
      if (PL[name] && rr > 3.5 * s && Math.hypot(sx - sunS[0], sy - sunS[1]) > 70 * s) { const Lp = beside(sx, sy, rr * 2, PL[name][2], PL[name][3]), lw = 230 * V.w / (globalThis.innerWidth || V.w);
        // never on the Sun: the label box (plus a margin) must not contain the Sun
        if (!(sunS[0] > Lp.x - 40 * s && sunS[0] < Lp.x + lw + 40 * s && sunS[1] > Lp.y - 40 * s && sunS[1] < Lp.y + 60 * s)) lab.push([PL[name][0], PL[name][1], Lp]); }
    }
    // --- orbits, belts, heliosphere, Oort cloud ---
    for (const it of orbitItems(V, C, ds, dSun)) items.push(it);
    const ochre = mix(PAL.desert, PAL.sunRim, 0.35), icy = mix(PAL.starCyan, PAL.ice, 0.25);
    // belts and the Oort cloud grow in (dot size × gate) only once the camera backs out to them: seen from deep inside
    // they would just be speckle over the sky
    const gate = (r0) => clamp(Math.log10(dSun / r0) / 0.35, 0, 1);
    for (const it of pointItems(V, C, PTS.ast, ochre, ds, 'asteroids', 1.7 * Math.max(s, 0.7), gate(2.4 * AU), 2)) items.push(it);
    for (const it of pointItems(V, C, PTS.kui, icy, ds, 'kuiper', 1.8 * Math.max(s, 0.7), gate(36 * AU), 2)) items.push(it);
    for (const it of pointItems(V, C, PTS.oort, mix(PAL.starCyan, PAL.bodyViolet, 0.25), ds, 'oort', 2.2 * Math.max(s, 0.7), gate(1000 * AU), 3)) items.push(it);
    // (integration fix) the Oort cloud as visible icy CLUMP CHAINS (gel blobs ~1,500 AU) along the shell, built from its own points
    { const g = gate(1000 * AU); if (g > 0 && ds > 0) { if (!OCL) buildOortClumps(); const L = [];
      for (const q of OCL) { const v = sub(q.p, C.p), d = -dot(v, C.b); if (d <= V.near) continue; const k = V.f / d, r = q.r * k * g; if (r < 1.2) continue;
        const sx = V.cx + dot(v, C.r) * k, sy = V.cy - dot(v, C.u) * k; if (!V.onScreen(sx, sy, r * 1.5)) continue; L.push([sx, sy, r, q.col, q.v]); }
      if (L.length) items.push({ name: 'oort-clumps', d: ds * 1.02, g: 0, blur: V.coc(ds), draw(c) { screenSpace(c); for (const [x, y, r, col, v] of L) drawBlob(c, x, y, r, col, 0.42, v, 1); c.globalAlpha = 1; } }); } }
    const h = helioItem(V, C);
    if (h) items.push(h); // (space v3: no label on the faint bubble)
    if (sc[2] > V.near) { const rO = V.f * 2e4 * AU / sc[2], k = V.f / sc[2];
      if (rO < V.h * 0.75) lab.push([15.45, 16.3, beside(V.cx + sc[0] * k + Math.min(rO * 0.6, V.w * 0.25), V.cy - sc[1] * k - Math.min(rO * 0.3, V.h * 0.2), 4 * s, 'Oort cloud', 'icy comets · out to ~1.6 light-years')]); }
    for (const [z0, z1, L] of lab) if (z > z0 && z < z1 && L.x > 45 && L.x < V.w - 60 && L.y > 45 && L.y < V.h - 70) { labels.push(L); break; }
  },
};
