// The one world: a tree of frames (double precision) + the real sky for the chosen instant.
// Instant: 2026-04-23 16:30 UTC (12:30 EDT), Moon near first quarter. The man stands on the Fifth Ave sidewalk at the Met.
import { mm, mv, mtv, mT, rotX, rotZ, I3, fromCols, norm, cross, add, sub, mul, len, DEG } from './m.js';

export const AU = 1.495978707e11, LY = 9.4607e15, PC = 3.0857e16, R_EARTH = 6.371e6, R_MOON = 1.7374e6, R_SUN = 6.957e8;
export const P0 = { lat: 40.77909, lon: -73.96250 }; // overwritten from assets/geo/origin.json if present
export const JD = 2440587.5 + Date.UTC(2026, 3, 23, 16, 30, 0) / 86400000;
const d2000 = JD - 2451545.0, Tc = d2000 / 36525;
export const OBL = 23.43928 * DEG;

// ---------- frames ----------
const F = new Map();
export function def(name, parent, o = [0, 0, 0], R = I3()) { F.set(name, { name, parent, o, R, depth: parent ? F.get(parent).depth + 1 : 0 }); return F.get(name); }
export const frame = (n) => F.get(n);
export const frames = F;
// point/vector conversions
export function toParent(f, p) { return add(f.o, mv(f.R, p)); }
export function toChild(f, p) { return mtv(f.R, sub(p, f.o)); }
// transform a point given in frame a into frame b (walk up to common ancestor, then down)
export function xform(p, a, b) {
  if (a === b) return p;
  let fa = F.get(a), fb = F.get(b); const down = [];
  while (fa.depth > fb.depth) { p = toParent(fa, p); fa = F.get(fa.parent); }
  while (fb.depth > fa.depth) { down.push(fb); fb = F.get(fb.parent); }
  while (fa !== fb) { p = toParent(fa, p); fa = F.get(fa.parent); down.push(fb); fb = F.get(fb.parent); }
  for (let i = down.length - 1; i >= 0; i--) p = toChild(down[i], p);
  return p;
}
// rotation that maps frame-a vectors into frame-b vectors
export function rot(a, b) {
  if (a === b) return I3();
  let fa = F.get(a), fb = F.get(b); let up = I3(); const down = [];
  while (fa.depth > fb.depth) { up = mm(fa.R, up); fa = F.get(fa.parent); }
  while (fb.depth > fa.depth) { down.push(fb); fb = F.get(fb.parent); }
  while (fa !== fb) { up = mm(fa.R, up); fa = F.get(fa.parent); down.push(fb); fb = F.get(fb.parent); }
  let M = up; for (let i = down.length - 1; i >= 0; i--) M = mm(mT(down[i].R), M);
  return M;
}

// ---------- astronomy (JPL approximate elements, Meeus low-precision Moon) ----------
const EL = {
  mercury: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  venus: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255, 0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418],
  earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
  mars: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  jupiter: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  uranus: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503, -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574, 0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.01262724],
};
export const PLANETS = Object.keys(EL);
// heliocentric ecliptic position (m) at days-offset dd from the instant (for animated orbits)
export function planetPos(name, dd = 0) {
  const e0 = EL[name], T = Tc + dd / 36525, g = (i) => e0[i] + e0[i + 6] * T;
  const a = g(0), e = g(1), I = g(2) * DEG, L = g(3), wb = g(4), Om = g(5) * DEG;
  const w = (wb - g(5)) * DEG; let M = ((L - wb) % 360) * DEG;
  let E = M + e * Math.sin(M); for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(Om), sO = Math.sin(Om), cI = Math.cos(I), sI = Math.sin(I);
  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const zz = (sw * sI) * xp + (cw * sI) * yp;
  return [x * AU, y * AU, zz * AU];
}
export function orbitElements(name) { const e0 = EL[name]; return { a: e0[0] * AU, e: e0[1], I: e0[2] * DEG, Om: e0[5] * DEG, w: (e0[4] - e0[5]) * DEG }; }
// geocentric ecliptic Moon (m)
export function moonPos(dd = 0) {
  const d = d2000 + dd;
  const Lp = (218.316 + 13.176396 * d) * DEG, Mp = (134.963 + 13.064993 * d) * DEG, Fm = (93.272 + 13.229350 * d) * DEG;
  const lam = Lp + 6.289 * DEG * Math.sin(Mp), bet = 5.128 * DEG * Math.sin(Fm), dist = (385001 - 20905 * Math.cos(Mp)) * 1000;
  return [dist * Math.cos(bet) * Math.cos(lam), dist * Math.cos(bet) * Math.sin(lam), dist * Math.sin(bet)];
}
export const GMST = ((280.46061837 + 360.98564736629 * d2000) % 360) * DEG;
const eqToEcl = rotX(-OBL);
export function radecToEcl(raDeg, decDeg) { const ra = raDeg * DEG, de = decDeg * DEG; return mv(eqToEcl, [Math.cos(de) * Math.cos(ra), Math.cos(de) * Math.sin(ra), Math.sin(de)]); }

// WGS84 geodetic -> ECEF
const WA = 6378137, WF = 1 / 298.257223563, WE2 = WF * (2 - WF);
export function ecef(latDeg, lonDeg, h = 0) {
  const la = latDeg * DEG, lo = lonDeg * DEG, s = Math.sin(la), N = WA / Math.sqrt(1 - WE2 * s * s);
  return [(N + h) * Math.cos(la) * Math.cos(lo), (N + h) * Math.cos(la) * Math.sin(lo), (N * (1 - WE2) + h) * s];
}
export function enuAxes(latDeg, lonDeg) {
  const la = latDeg * DEG, lo = lonDeg * DEG;
  const E = [-Math.sin(lo), Math.cos(lo), 0], N = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)], U = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  return fromCols(E, N, U);
}
export const STREET_BEARING = 29; // Fifth Ave runs 29° east of true north; the camera looks 299° (into Central Park)

export function buildFrames(origin) {
  if (origin) { P0.lat = origin.lat; P0.lon = origin.lon; }
  F.clear();
  def('helio', null);                                     // Sun-centred, J2000 ecliptic axes
  // galactic frame: x toward the galactic centre, z to the north galactic pole; origin AT the galactic centre
  const gx = radecToEcl(266.405, -28.936), gz = radecToEcl(192.859, 27.128), gy = norm(cross(gz, gx)), gz2 = norm(cross(gx, gy));
  const Rg = fromCols(gx, gy, gz2);
  def('galaxy', 'helio', mul(gx, 8.18e3 * PC - 0), Rg);    // origin at Sgr A*; the Sun sits at (-8.18 kpc, 0, ~0)
  def('cosmos', 'galaxy', [0, 0, 0], I3());                // same axes, used for Local Group / web content
  const ePos = planetPos('earth');
  def('earth', 'helio', ePos, mm(eqToEcl, rotZ(GMST)));    // ECEF axes
  def('moon', 'earth', mv(mT(mm(eqToEcl, rotZ(GMST))), moonPos()), I3());
  def('enu', 'earth', ecef(P0.lat, P0.lon, 0), enuAxes(P0.lat, P0.lon));
  // street frame: x along Fifth Ave uptown (screen right in side view), y up, z toward the camera (ESE, 119°)
  const b = STREET_BEARING * DEG, X = [Math.sin(b), Math.cos(b), 0], Y = [0, 0, 1], Z = cross(X, Y);
  def('street', 'enu', [0, 0, 0], fromCols(X, Y, Z));
  return F;
}
// direction TO the Sun, in any frame
export function sunDir(frameName) { const p = xform([0, 0, 0], 'helio', frameName); const o = [0, 0, 0]; return norm(sub(p, o)); }
