// THE anchor table: where every scale sits in the one world, and the camera path through them.
// All inner frames share the street frame's orientation (x = uptown / screen right, y = up, z = toward the camera),
// so every inner scene is authored as a 2.5D drawing: x right, y up, z = height toward the camera.
import { def, frame, rot, xform } from './world.js';
import { rotZ, rotX, I3, DEG, ss, clamp, sss, fromCols, mm, mv, cross, norm, mul, qFromM, mFromQ, slerp } from './m.js';
import { setKeys, basis } from './cam.js';

// ---------- the sneeze: one 12 s loop shared by every scale ----------
export const LOOP = 12;
export function sneeze(t) {
  const c = ((t % LOOP) + LOOP) % LOOP;
  const inhale = ss(0.6, 3.9, c) * (1 - ss(4.0, 4.12, c));          // "ah… ah…"
  const choo = c >= 4.0 ? Math.exp(-(c - 4.0) / 0.45) * ss(3.98, 4.06, c) : 0; // the burst
  const spray = c >= 4.02 ? (c - 4.02) : -1;                         // seconds since droplets left
  const tilt = 7 * inhale * DEG - 6 * choo * DEG; // gentle: the camera is locked to the head from the face inward   // head angle (+ = back)
  const squint = Math.max(ss(2.6, 3.9, c) * (1 - ss(4.6, 5.4, c)), 0);
  return { c, inhale, choo, spray, tilt, squint };
}

// ---------- the man (street frame, metres) ----------
export const MAN = { neck: [-0.012, 1.48, 0], head: [0.0, 1.62, 0] };
// nostril centre in head-frame metres (the face drawing in levels/man.js is authored around this point)
export const NOSTRIL = [0.119, -0.0425, 0];

// ---------- inner anchors ----------
export const MUC = [-0.000319, -0.002142, -0.0105];   // septum mucosa surface, in the nostril frame (10.5 mm deeper)
export const MAC = [16e-6, -9e-6, 0];           // hero macrophage (its footprint centre), in the mucosa frame
export const MNUC = [2.2e-6, 1.6e-6, 3.6e-6];   // its nucleus centre, in the macrophage frame
export const NSOME = [0.42e-6, -0.31e-6, 0.55e-6]; // hero nucleosome, in the nucleus frame
export const ATOM = [0, 0, 0];                  // hero carbon atom (set from the PDB data by levels/dna.js)
export const PROTON = [0.62e-15, 0.95e-15, 1.15e-15]; // hero proton, in the atom (= nucleus) frame
export const QUARK = [0.22e-15, 0.17e-15, 0.2e-15];   // hero up quark, in the proton frame

export function updateFrames(t) {
  const s = sneeze(t);
  // head pivots about the neck
  const R = rotZ(s.tilt), n = MAN.neck, h = MAN.head, d = [h[0] - n[0], h[1] - n[1], 0];
  const hp = [n[0] + R[0] * d[0] + R[1] * d[1], n[1] + R[3] * d[0] + R[4] * d[1], 0];
  def('head', 'street', hp, R);
  def('nose', 'head', NOSTRIL, I3());
  def('muc', 'nose', MUC, I3());
  def('mac', 'muc', MAC, I3());
  def('mnuc', 'mac', MNUC, I3());
  def('nsome', 'mnuc', NSOME, I3());
  def('atom', 'nsome', ATOM, I3());
  def('proton', 'atom', PROTON, I3());
  def('quark', 'proton', QUARK, I3());
}

// ---------- camera path ----------
const SIDE = I3();                                        // looking along -z (WNW, into Central Park), y up
const pitch = (p) => basis([0, Math.sin(p), Math.cos(p)], [0, Math.cos(p) > 0.05 ? 1 : 0, Math.cos(p) > 0.05 ? 0 : -1]);
const ENU_DOWN = basis([0, 0, 1], [Math.sin(299 * DEG), Math.cos(299 * DEG), 0]);
const ENU_NORTH = basis([0, 0, 1], [0, 1, 0]); // north up from Manhattan outward
// space hand-off: looking down on the ecliptic from 40° above it, ecliptic north up-ish (helio frame)
export const ECL_OBL = basis([0, -Math.cos(40 * DEG), Math.sin(40 * DEG)], [0, 0, 1]);
// CAMERA v2 (night rework after "it jitters, the camera moves a lot, things go in and out of focus"):
//  - INWARD: one straight zoom onto a single point (the hero quark, the deepest point of the nested anchors) from the face
//    to the Planck end. Zero sideways pan, one orientation; every nested scene is centred on that line.
//  - OUTWARD: few long, slow moves, each spread over decades (crane, roll to north-up, Earth -> Sun turn, out through the
//    galaxy), so rotation stays <= ~30 deg/decade and nothing stops and restarts.
//  - Level-defined keys are ignored (central control); extra keys passed in are only used for z > 16 (galaxy range).
export function setPath(extra = []) {
  const ext = extra.filter((k) => k.z > 16.5);
  setKeys([
    { z: -34.6, fr: 'quark', at: [0, 0, 0], M: SIDE },
    { z: -0.75, fr: 'quark', at: [0, 0, 0], M: SIDE },                    // from here inward: locked on one point
    { z: 0.8, fr: 'street', at: [0.25, 1.45, 0], M: SIDE },               // the man, head and shoulders centred
    { z: 1.9, fr: 'street', at: [0.1, 0.55, 0], M: pitch(42 * DEG), thru: true }, // the crane: one continuous rise
    { z: 2.9, fr: 'street', at: [0, 0, 0], M: pitch(89.9 * DEG), thru: true },
    { z: 5.6, fr: 'enu', at: [0, 0, 0], M: ENU_NORTH },                   // slow roll to north-up
    { z: 7.0, fr: 'enu', at: [0, 0, 0], M: ENU_NORTH },
    ...SPACE_KEYS(),
    { z: 16.0, fr: 'helio', at: [0, 0, 0], M: ECL_OBL },
    ...ext,
  ]);
}
// Earth -> Sun (space v3): ONE long, constant-speed orbit around Earth (7.0 -> ~10.9), from straight above New York (the
// noon side) round to Earth's night side, looking back past Earth toward the Sun. Earth stays centred the whole time (the
// terminator sweeps across it, it becomes a crescent); the Sun ends a little up-left of Earth, so as the camera keeps
// pulling out it drifts in toward the centre by itself (its offset falls as 1 AU / W). Then a slow rise to the z-16 view.
// Tunables via globalThis.__SP (dev only).
const dirEl = (el, az) => [Math.cos(el * DEG) * Math.cos(az * DEG), Math.cos(el * DEG) * Math.sin(az * DEG), Math.sin(el * DEG)];
function SPACE_KEYS() {
  const P = Object.assign({ e0: 0.3, tEl: 85, tAz: 125, nEl: 18, nAz: -12, roll: -60, zF: 11.0, zH: 12.5 }, globalThis.__SP || {});
  const E = xform([0, 0, 0], 'earth', 'helio'), eAz = Math.atan2(E[1], E[0]) / DEG, H = rot('helio', 'earth'), He = rot('earth', 'helio');
  const M0 = mm(rot('enu', 'earth'), ENU_NORTH);                       // = the z 7.0 core key, in the earth frame
  const M3 = mm(H, ECL_OBL);                                            // = the z 16 core key, in the earth frame
  // pure swing (minimum rotation, no added roll) of M that brings its back axis onto b
  const rod = (k, sn, cs) => { const K = [0, -k[2], k[1], k[2], 0, -k[0], -k[1], k[0], 0], KK = mm(K, K); return I3().map((v, i) => v + sn * K[i] + (1 - cs) * KK[i]); };
  const swing = (M, b) => { const a = [M[2], M[5], M[8]], x = cross(a, b), sn = Math.hypot(...x); return sn < 1e-9 ? M : mm(rod(norm(x), sn, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]), M); };
  // waypoint 1: high over the ecliptic (well away from the Moon, which sits 84 deg from the Sun near the plane, so the camera
  // never flies past it while its distance matches the Moon's); waypoint 2: the night side, the Sun beside Earth
  const Mt = swing(M0, mv(H, dirEl(P.tEl, P.tAz)));
  const b1 = mv(H, dirEl(P.nEl, eAz + P.nAz)), M1 = mm(rod(b1, Math.sin(P.roll * DEG), Math.cos(P.roll * DEG)), swing(Mt, b1));
  const Q = [M0, Mt, M1, M3].map(qFromM), ang = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));
  const A = [0]; for (let k = 1; k < Q.length; k++) A.push(A[k - 1] + ang(Q[k - 1], Q[k])); const AT = A[A.length - 1];
  const at = (f) => { const a = f * AT; let k = 1; while (k < A.length - 1 && a > A[k]) k++; return mFromQ(slerp(Q[k - 1], Q[k], (a - A[k - 1]) / Math.max(1e-9, A[k] - A[k - 1]))); };
  // one constant angular speed from 7.0 to 16.0 between short eases (a non-thru -> thru segment leaves at 1.875x its mean speed)
  const z0 = 7.0, zE = 16.0, e = P.e0, Lin = zE - z0 - 2 * e, v = 1 / (2 * e / 1.875 + Lin), fa = v * e / 1.875;
  globalThis.__SPturn = AT / DEG; globalThis.__SPrate = AT / DEG * v; globalThis.__SPz = A.map((a) => { const f = a / AT; return f < fa ? NaN : z0 + e + (f - fa) / v; });
  const keys = [];
  for (let z = z0 + e; z <= zE - e + 1e-6; z += 0.25) {
    if (z > P.zF && z < P.zH) continue;                                 // focus Earth -> Sun spread over this one long segment
    const M = at(fa + (z - z0 - e) * v), h = z >= P.zH;
    keys.push({ z, fr: h ? 'helio' : 'earth', at: [0, 0, 0], M: h ? mm(He, M) : M, thru: true });
  }
  return keys;
}
