// The cloud layer: Kurzgesagt pill clouds (nuke-all-earth/03) lying flat at their real altitude (2–3 km) on the ellipsoid.
// A cluster = 2–3 overlapping rounded pills in white, over lavender copies of the same pills shifted away from the Sun
// (the shaded underside), no outlines. A real, faint ground shadow is cast along the Sun direction.
// Size law: a cluster's length is ~16 % of its distance from the Met, so whatever enters the frame edge while zooming out is a
// modest fraction of the frame and then shrinks (no big shape ever pops in), while near clusters fly past the camera (2.5D).
// Clusters drift slowly with time (a bounded east–west sway, a few % of their size). New York stays sunny: no cloud and no cloud
// shadow within ~1 km of the Met.
import { PAL, mix } from '../core/kit.js';
import { FAM } from '../core/look.js';
import { sunDir, P0, enuAxes } from '../core/world.js';
import { rng } from '../core/m.js';
import { ecefInto, Builder, cap } from './earth-geo.js';

const N = 30;           // outline points per pill
const DEG = Math.PI / 180;
const CL = [];          // clusters
// pill (stadium) outline at local offset (x east, y north, metres) of cluster centre, mapped onto the ellipsoid at altitude h
function pillInto(out, lat0, lon0, cx, cy, len, hgt, h) {
  const rr = hgt / 2, hx = Math.max(0, len / 2 - rr), cl = Math.cos(lat0 * DEG);
  for (let i = 0; i < N; i++) {
    const half = i < N / 2, a = (half ? -Math.PI / 2 : Math.PI / 2) + Math.PI * ((i % (N / 2)) / (N / 2 - 1));
    const x = cx + (half ? hx : -hx) + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    ecefInto(out, 3 * i, lat0 + y / 6.36e6 / DEG, lon0 + x / (6.39e6 * cl) / DEG, h);
  }
}
// Kurzgesagt cluster shapes in units of the cluster length: [cx, cy, len, height]
const SHAPES = [
  [[0, 0, 1, 0.3], [-0.12, 0.2, 0.52, 0.28], [0.2, -0.17, 0.62, 0.26]],
  [[0, 0, 1, 0.32], [0.18, 0.21, 0.6, 0.3]],
  [[0, 0, 0.9, 0.3], [-0.2, -0.19, 0.7, 0.28], [0.25, 0.19, 0.45, 0.26]],
  [[0, 0, 1, 0.28], [-0.25, 0.18, 0.4, 0.25]],
];
const BANDS = [ // long Kurzgesagt bars for the globe-scale clusters
  [[0, 0, 1, 0.19], [-0.16, 0.15, 0.62, 0.17], [0.22, -0.15, 0.7, 0.16]],
  [[0, 0, 1, 0.2], [0.2, 0.16, 0.55, 0.17]],
  [[0, 0, 0.85, 0.19], [-0.25, -0.15, 0.6, 0.17], [0.15, 0.16, 0.5, 0.16], [0.32, -0.3, 0.45, 0.15]],
];
const gc = (a1, o1, a2, o2) => 6371 * Math.acos(Math.min(1, Math.sin(a1 * DEG) * Math.sin(a2 * DEG) + Math.cos(a1 * DEG) * Math.cos(a2 * DEG) * Math.cos((o1 - o2) * DEG)));
let built = false, SUN = null, UP = null;
const CLEAR = [[40.754, -73.984, 9], [P0.lat - 0.05, P0.lon + 0.02, 9], [P0.lat + 0.01, P0.lon + 0.01, 5], [39.3, -76.6, 160]];
export function buildClouds() {
  if (built) return; built = true;
  const S = sunDir('earth'), r = rng(7321); SUN = S;
  const M = enuAxes(P0.lat, P0.lon); UP = [M[2], M[5], M[8]];
  const add = (d, scale = 0.16, band = false) => { // one cluster at great-circle distance d (km) from P0
    for (let tries = 0; tries < 30; tries++) {
      const az = r() * 2 * Math.PI, ang = d / 6371;
      const la0 = P0.lat * DEG, lat = Math.asin(Math.sin(la0) * Math.cos(ang) + Math.cos(la0) * Math.sin(ang) * Math.cos(az));
      const lon = P0.lon * DEG + Math.atan2(Math.sin(az) * Math.sin(ang) * Math.cos(la0), Math.cos(ang) - Math.sin(la0) * Math.sin(lat));
      if (Math.abs(lat / DEG) > 72) continue;
      const L = d * 1000 * scale * (0.75 + 0.5 * r()), h = 2000 + 1000 * r();
      // keep the Met sunny: cluster and its shadow (offset ~0.6 h to the NNW at 12:30) stay > 1 km away
      if (d < 20 && (d - L / 1000 < 1.0 || d * 1000 - L / 2 - 0.6 * h < 1000)) continue;
      // clouds never cover a label's subject: clear zones around the label anchors (Manhattan / NYC / Upper East Side, US East Coast)
      if (CLEAR.some(([a, o, km]) => gc(a, o, lat / DEG, lon / DEG) < km + L / 2000)) continue;
      if (L > 1e5 && CL.some((o) => o.L > 1e5 && gc(o.lat, o.lon, lat / DEG, lon / DEG) * 1000 < 0.75 * (o.L + L))) continue; // no overlapping bands
      CL.push({ band, lat: lat / DEG, lon: lon / DEG, L, h, shape: SHAPES[(r() * SHAPES.length) | 0], ph: r() * 6.28, ph2: r() * 6.28, flip: r() < 0.5 ? -1 : 1 });
      return;
    }
  };
  // REAL, fixed sizes (they shrink as the view widens): small puffs near New York, mid-size clouds further out, big systems
  // only far away (so whatever enters the frame edge is a modest fraction of it). One look (puffy pill clusters) everywhere.
  const band = (n, d0, d1, L0, L1) => { for (let k = 0; k < n; k++) { const d = d0 * Math.pow(d1 / d0, (k + r()) / n), L = L0 + (L1 - L0) * r(); add(d, L / d); } };
  band(16, 2.5, 60, 1.0, 3.5);       // fair-weather puffs, 1–3.5 km
  band(18, 120, 900, 12, 40);        // 12–40 km clouds
  band(34, 1800, 5200, 170, 480);    // 170–480 km cloud systems (flatter, smaller on the globe: no stuck-on stickers)
  // precompute local horizontal Sun direction per cluster (for the shade offset) and bounding spheres
  for (const c of CL) {
    const ce = [0, 0, 0]; ecefInto(ce, 0, c.lat, c.lon, c.h); c.ce = ce;
    const la = c.lat * DEG, lo = c.lon * DEG, E = [-Math.sin(lo), Math.cos(lo), 0], Nn = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
    const U = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    const sE = S[0] * E[0] + S[1] * E[1] + S[2] * E[2], sN = S[0] * Nn[0] + S[1] * Nn[1] + S[2] * Nn[2], sU = S[0] * U[0] + S[1] * U[1] + S[2] * U[2];
    const sl = Math.hypot(sE, sN) || 1; c.away = [-sE / sl, -sN / sl]; c.sun = sU > 0.05 ? [sE / sU, sN / sU] : null; // shadow: −(h)·(sE,sN)/sU
    c.R = c.L * 0.8 + (c.sun ? c.h * Math.hypot(c.sun[0], c.sun[1]) : 0);
  }
}

// which clusters are visible this frame (bounding-sphere culls: frustum, behind the Earth, < 1 px)
export function cloudItems(S, V) {
  buildClouds();
  const e = S.e, C = S.C, list = []; let dsum = 0; const c3 = cap(S, 3000);
  for (const c of CL) {
    const b = c.ce, R = c.R, X = b[0] - C[0], Y = b[1] - C[1], Z = b[2] - C[2];
    const x = X * e.r[0] + Y * e.r[1] + Z * e.r[2], y = X * e.u[0] + Y * e.u[1] + Z * e.u[2], d = -(X * e.b[0] + Y * e.b[1] + Z * e.b[2]);
    if (d + R < S.near) continue;
    if ((x - d * S.tx) * S.nx > R || (-x - d * S.tx) * S.nx > R || (y - d * S.ty) * S.ny > R || (-y - d * S.ty) * S.ny > R) continue;
    if (d - R > 0 && c.L * 0.3 * S.f / (d - R) < 1) continue;                                   // thinner than a pixel
    if ((b[0] * c3.m[0] + b[1] * c3.m[1] + b[2] * c3.m[2] - c3.d0) / c3.mlen < -R) continue;    // behind the Earth
    list.push({ c, d }); dsum += d;
  }
  list.sort((a, b) => b.d - a.d);
  return { list, depth: list.length ? dsum / list.length : 1, t: V.t };
}
const BUF = new Float64Array(3 * N);
// slow bounded drift with time (east–west sway, a little north–south)
function drift(c, t) { return [c.L * (0.07 * Math.sin(t * 0.13 + c.ph) + 0.03 * Math.sin(t * 0.31 + c.ph2)), c.L * 0.02 * Math.sin(t * 0.19 + c.ph2)]; }
function eachPill(c, t, fn) { const [dx, dy] = drift(c, t); for (const p of c.shape) fn(dx + p[0] * c.L * c.flip, dy + p[1] * c.L, p[2] * c.L, p[3] * c.L); }

// ground shadows: one faint multiply fill (darkens water, land and city alike)
export function drawCloudShadows() {} // no ground shadows: a shadow must never show before (or without) its cloud
// the clouds (unification pass: the body() recipe on pills): a lilac shade copy shifted away from the Sun, the near-white base,
// and a white lit core shifted toward the Sun. Three batched fills, one look at every scale (street sky to globe).
export function drawClouds(c2d, S, cl) {
  if (!cl.list.length) return;
  const shade = new Builder(S, 2500, 0), lit = new Builder(S, 2500, 0), core = new Builder(S, 2500, 0); // clipped to what the Earth does not hide
  for (const { c } of cl.list) {
    const k = c.L * 0.028, ax = c.away[0] * k, ay = c.away[1] * k - c.L * 0.01;
    eachPill(c, cl.t, (x, y, len, hgt) => {
      pillInto(BUF, c.lat, c.lon, x + ax, y + ay, len * 1.02, hgt * 1.05, c.h - 1); shade.ring(BUF, 0, N, true, 1);
      pillInto(BUF, c.lat, c.lon, x, y, len, hgt, c.h); lit.ring(BUF, 0, N, true, 1);
      pillInto(BUF, c.lat, c.lon, x - ax * 0.9, y - ay * 0.9, len * 0.8, hgt * 0.62, c.h + 1); core.ring(BUF, 0, N, true, 1);
    });
  }
  c2d.fillStyle = CLOUD.shade; c2d.fill(shade.path, 'nonzero');
  c2d.fillStyle = CLOUD.base; c2d.fill(lit.path, 'nonzero');
  c2d.fillStyle = CLOUD.core; c2d.fill(core.path, 'nonzero');
}
const CLOUD = { shade: mix(FAM.violet.glow, FAM.violet.lit, 0.2), base: mix('#ffffff', FAM.violet.glow, 0.3), core: mix('#ffffff', FAM.violet.glow, 0.08) };
