// The character kit: ONE figure design (proportions, parts, shading planes) shared by the hero (levels/man.js, hi-fi,
// with the moving 'head' frame) and the background people (levels/city-life.js, the same paths at low detail, tinted
// toward the background). Every path is built ONCE here; animation is transforms only.
// Units: metres for a 1.78 m figure. Body parts are in the street frame (feet at y = 0, body axis x = 0, facing +x);
// head parts are in head-frame metres (origin = head centre, street (0, 1.62)). Kurzgesagt build: flat fills, hard
// two-tone planes (lit face / shaded jaw-and-neck), crescents toward the light (upper left), no outlines; thin round
// strokes only for linear things (seams, lid line).
import { PAL, mix, rgba, solid, crescent, UL } from '../core/kit.js';
import { NOSTRIL } from '../core/anchors.js';

const P = (d) => new Path2D(d);
const E = (x, y, rx, ry, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; };
export const NECK = [-0.012, 1.48], HEAD0 = [0, 1.62];      // = MAN.neck / MAN.head in core/anchors.js

// ======================= HEAD (head frame) =======================
// skull + face profile (skin). Forehead → brow → bridge → (nose drawn on top) → philtrum → lips → soft chin → jaw.
export const SKULL = P(`M -0.074 -0.104 C -0.1 -0.072 -0.113 -0.024 -0.111 0.03 C -0.108 0.1 -0.052 0.143 0.0 0.143
  C 0.052 0.143 0.087 0.114 0.094 0.07 C 0.097 0.056 0.1 0.047 0.1 0.04 C 0.1 0.031 0.096 0.026 0.097 0.02
  L 0.12 -0.014 L 0.117 -0.047 C 0.11 -0.05 0.105 -0.052 0.104 -0.056 C 0.106 -0.062 0.111 -0.066 0.111 -0.0705
  C 0.111 -0.0735 0.107 -0.0752 0.1055 -0.0765 C 0.1085 -0.0795 0.1095 -0.085 0.1063 -0.0885
  C 0.102 -0.092 0.0985 -0.0935 0.0995 -0.0985 C 0.1035 -0.106 0.1065 -0.116 0.1005 -0.1245
  C 0.0945 -0.1325 0.08 -0.1375 0.06 -0.1375 C 0.045 -0.1375 0.036 -0.136 0.028 -0.14
  C 0.005 -0.136 -0.02 -0.126 -0.04 -0.118 C -0.055 -0.113 -0.066 -0.108 -0.074 -0.104 Z`);
// the neck stub that moves with the head (the body draws its own neck column under it; both are the shade tone)
export const NECK_H = P('M 0.036 -0.128 L 0.034 -0.163 L -0.07 -0.163 L -0.074 -0.095 Z');
// shaded plane: underside of the jaw (hard edge, soft curve from the chin back to under the ear)
export const JAW = P('M 0.1035 -0.112 C 0.075 -0.109 0.02 -0.1 -0.03 -0.083 C -0.06 -0.073 -0.09 -0.06 -0.13 -0.05 L -0.13 -0.3 L 0.13 -0.3 L 0.13 -0.112 Z');
// a second, quieter plane: the side of the face behind the cheekbone (lit / mid split, Kurzgesagt faceted close-ups)
export const CHEEKPLANE = P('M 0.026 0.035 C 0.034 -0.01 0.036 -0.06 0.05 -0.13 L -0.13 -0.13 L -0.13 0.035 Z');
// contact shadow on the neck right under the jaw line (head frame, clipped to the neck stub)
export const NECK_SH = P('M 0.05 -0.134 C 0.02 -0.13 -0.03 -0.118 -0.08 -0.098 L -0.08 -0.11 C -0.03 -0.13 0.02 -0.142 0.05 -0.146 Z');

// nose: bridge + bulb tip + ala (wing). The tip carries the cold-red; the underside is a darker flat plane.
export const NOSE = P(`M 0.0955 0.03 C 0.104 0.019 0.118 0.0 0.131 -0.0105 C 0.145 -0.0155 0.1555 -0.025 0.1545 -0.037
  C 0.1535 -0.0485 0.141 -0.0535 0.131 -0.0505 C 0.1265 -0.0495 0.1245 -0.0475 0.1215 -0.0478
  C 0.114 -0.0492 0.1045 -0.0488 0.1005 -0.0432 C 0.0968 -0.0375 0.0978 -0.0295 0.1025 -0.025
  C 0.1 -0.012 0.0955 0.01 0.0948 0.02 Z`);
export const ALA = E(0.1105, -0.0362, 0.0118, 0.0102, -0.15);
const NOSE_SIL = (() => { const p = new Path2D(); p.addPath(NOSE); p.addPath(ALA); return p; })();
// underside plane of the nose (everything below this curve, clipped to the nose)
export const NOSE_UNDER = P('M 0.09 -0.0415 C 0.11 -0.0425 0.13 -0.0418 0.16 -0.0385 L 0.16 -0.07 L 0.09 -0.07 Z');
// alar crease: the curved groove that separates the wing from the cheek and the tip (a thin darker crescent band)
export const ALA_CREASE = P('M 0.1045 -0.0262 C 0.0985 -0.0285 0.0975 -0.0385 0.1015 -0.0438 C 0.0995 -0.0375 0.1003 -0.0298 0.1045 -0.0262 Z M 0.1155 -0.0262 C 0.121 -0.027 0.1235 -0.031 0.1232 -0.036 C 0.1222 -0.0315 0.1195 -0.0285 0.1155 -0.0262 Z');

// THE NOSTRIL. At the face scale it is a small dark curved slit under the wing (no visible interior). It is the mouth of
// a bent tunnel (levels/nose.js). Its centre sits 2.6 mm under the 'nose' frame origin, so the tunnel can climb under
// the wing to the cavity axis. One polygon in head-frame metres, shared by the face cut and the tunnel's first ring.
export const SLIT_C = [NOSTRIL[0] - 0.0003, NOSTRIL[1] - 0.0026]; // head frame
export const HOLE_PTS = (() => {
  // a comma: fuller at the back (toward the cheek), tapering to a fine point toward the tip; the upper edge arches
  // under the wing, the lower edge is flatter. 8.6 mm long, ~1.9 mm at its widest.
  const out = [], hw = 0.0043, N = 40, th = (u) => Math.pow(Math.max(0, 1 - u * u), 0.7) * (1 - 0.42 * u);
  for (let i = 0; i <= N; i++) { const u = -1 + 2 * i / N; out.push([SLIT_C[0] + u * hw, SLIT_C[1] + 0.0003 + 0.00105 * th(u) + 0.0006 * (1 - u * u) - 0.0006 - 0.00025 * u]); }
  for (let i = N - 1; i > 0; i--) { const u = -1 + 2 * i / N; out.push([SLIT_C[0] + u * hw, SLIT_C[1] + 0.0003 - 0.00075 * th(u) + 0.0006 * (1 - u * u) - 0.0006 - 0.00025 * u]); }
  return out; })();
export const NOSTRIL_HOLE = (() => { const p = new Path2D(); HOLE_PTS.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; })();
// the soft rim lip around the slit (a slightly darker crescent above it: the wing's edge folding in)
// the vestibule skin curving inward around the slit: two stepped, darker rims (tight, so the nostril still reads small)
const rimOf = (kx, ky, dy) => { const p = new Path2D(); HOLE_PTS.forEach(([x, y], i) => { const X = SLIT_C[0] + (x - SLIT_C[0]) * kx, Y = SLIT_C[1] + (y - SLIT_C[1] - 0.0003) * ky + 0.0003 + dy; i ? p.lineTo(X, Y) : p.moveTo(X, Y); }); p.closePath(); return p; };
export const SLIT_RIM = rimOf(1.1, 1.75, 0.0002), SLIT_RIM2 = rimOf(1.04, 1.32, 0.0001);

// lips: upper lip plane (slightly redder) and lower lip blob; mouth corner line
export const LIP_UP = P('M 0.1045 -0.056 C 0.107 -0.062 0.1115 -0.066 0.111 -0.0705 C 0.1105 -0.0735 0.107 -0.0752 0.1055 -0.0765 C 0.1 -0.0765 0.096 -0.074 0.094 -0.07 C 0.098 -0.066 0.101 -0.061 0.1045 -0.056 Z');
export const LIP_LO = P('M 0.1055 -0.0765 C 0.1085 -0.0795 0.1095 -0.085 0.1063 -0.0885 C 0.103 -0.0915 0.097 -0.0905 0.095 -0.086 C 0.096 -0.081 0.1 -0.0775 0.1055 -0.0765 Z');
export const MOUTH_LINE = P('M 0.1055 -0.0765 C 0.101 -0.0768 0.097 -0.0758 0.0935 -0.0742');
export const MOUTH_AT = [0.1035, -0.077];

// eye (eye-local coords, centre at EYE): almond, iris slice, pupil, glint; lids are translated shapes clipped to it
export const EYE = [0.0785, 0.0165];
export const EYE_AL = E(0, 0, 0.0098, 0.0074, -0.06);
export const EYE_CLIP2 = E(0.0004, 0, 0.0122, 0.0094, -0.06);
export const LID_UP = (() => { const p = new Path2D(); p.moveTo(-0.016, 0); for (let i = 0; i <= 16; i++) { const x = -0.016 + 0.032 * i / 16, u = x / 0.0125; p.lineTo(x, 0.0024 * Math.max(0, 1 - u * u)); } p.lineTo(0.016, 0.03); p.lineTo(-0.016, 0.03); p.closePath(); return p; })();
export const LID_LINE = (() => { const p = new Path2D(); for (let i = 0; i <= 16; i++) { const x = -0.0118 + 0.0242 * i / 16, u = x / 0.0125; i ? p.lineTo(x, 0.0024 * Math.max(0, 1 - u * u)) : p.moveTo(x, 0.0024 * Math.max(0, 1 - u * u)); } return p; })();
export const LID_LO = (() => { const p = new Path2D(); p.moveTo(-0.016, 0); for (let i = 0; i <= 16; i++) { const x = -0.016 + 0.032 * i / 16, u = x / 0.0125; p.lineTo(x, -0.0016 * Math.max(0, 1 - u * u)); } p.lineTo(0.016, -0.03); p.lineTo(-0.016, -0.03); p.closePath(); return p; })();
export const LID_FOLD = P('M -0.008 0.0108 C -0.003 0.0132 0.004 0.0134 0.0095 0.0105');
export const BROW = P('M 0.0635 0.0345 C 0.071 0.0435 0.0865 0.0465 0.0985 0.0405 L 0.0975 0.0335 C 0.0875 0.0375 0.074 0.0368 0.0655 0.0295 Z');
export const BROW_C = [0.081, 0.037];

// ear: outer shell, inner fold (helix/antihelix C), concha, lobe
export const EAR = P(`M -0.009 0.019 C -0.026 0.027 -0.043 0.014 -0.044 -0.008 C -0.045 -0.03 -0.035 -0.047 -0.02 -0.049
  C -0.011 -0.05 -0.006 -0.043 -0.008 -0.036 C -0.01 -0.024 -0.004 -0.006 -0.005 0.006 C -0.006 0.013 -0.007 0.017 -0.009 0.019 Z`);
export const EAR_FOLD = P(`M -0.0125 0.0105 C -0.026 0.0155 -0.0355 0.003 -0.0355 -0.0115 C -0.0355 -0.025 -0.029 -0.035 -0.0205 -0.0365
  C -0.0265 -0.027 -0.0285 -0.013 -0.0245 -0.003 C -0.022 0.0035 -0.0165 0.0075 -0.0125 0.0105 Z`);
export const EAR_IN = E(-0.0175, -0.0145, 0.0045, 0.0085, 0.15);

// hair: three masses (shade base, main mass, front lock) + a highlight shape toward the light + sideburn
export const HAIR_BASE = P(`M 0.088 0.1 C 0.076 0.132 0.032 0.164 -0.03 0.162 C -0.092 0.158 -0.127 0.112 -0.127 0.042
  C -0.127 -0.018 -0.108 -0.07 -0.086 -0.102 C -0.074 -0.088 -0.064 -0.068 -0.056 -0.046
  C -0.05 -0.03 -0.048 -0.006 -0.043 0.012 C -0.034 0.032 -0.012 0.034 -0.002 0.024
  C 0.0 0.01 0.001 -0.004 0.004 -0.008 C 0.007 -0.009 0.0095 -0.006 0.0105 0.0 C 0.0125 0.022 0.016 0.046 0.026 0.068 C 0.042 0.088 0.066 0.094 0.088 0.1 Z`);
export const HAIR_TOP = P(`M 0.101 0.098 C 0.104 0.134 0.068 0.172 0.004 0.174 C -0.056 0.176 -0.106 0.146 -0.124 0.088
  C -0.098 0.118 -0.05 0.132 0.0 0.126 C 0.038 0.121 0.068 0.106 0.083 0.088 C 0.09 0.092 0.096 0.096 0.101 0.098 Z`);
export const HAIR_LOCK = P('M 0.101 0.099 C 0.109 0.096 0.113 0.088 0.112 0.079 C 0.104 0.087 0.094 0.091 0.083 0.092 C 0.09 0.097 0.095 0.1 0.101 0.099 Z');
export const HAIR_HI = P('M -0.116 0.098 C -0.092 0.146 -0.03 0.172 0.04 0.166 C 0.064 0.163 0.08 0.156 0.088 0.148 C 0.05 0.152 0.0 0.148 -0.04 0.136 C -0.074 0.126 -0.098 0.114 -0.116 0.098 Z');
export const HAIR_HI2 = P('M -0.121 0.06 C -0.122 0.02 -0.114 -0.02 -0.1 -0.05 C -0.108 -0.015 -0.112 0.02 -0.11 0.055 Z');
// crowd hair styles (same construction): a bob and a bun
export const HAIR_BOB = P(`M 0.092 0.098 C 0.08 0.14 0.03 0.168 -0.03 0.165 C -0.1 0.16 -0.135 0.11 -0.136 0.03 C -0.137 -0.04 -0.125 -0.1 -0.1 -0.14
  L -0.05 -0.14 C -0.045 -0.09 -0.042 -0.04 -0.036 0.0 C -0.026 0.03 -0.008 0.035 0.006 0.025 L 0.012 -0.01 L 0.02 -0.01
  C 0.024 0.03 0.04 0.06 0.06 0.08 C 0.07 0.088 0.082 0.094 0.092 0.098 Z`);
export const HAIR_BUN = (() => { const p = P(`M 0.088 0.098 C 0.074 0.134 0.032 0.164 -0.03 0.162 C -0.094 0.158 -0.126 0.11 -0.126 0.04
  C -0.126 -0.02 -0.108 -0.07 -0.088 -0.1 C -0.07 -0.08 -0.058 -0.05 -0.05 -0.02 C -0.042 0.012 -0.02 0.03 -0.004 0.02
  L 0.002 -0.02 L 0.012 -0.02 C 0.016 0.02 0.026 0.05 0.045 0.072 C 0.06 0.086 0.075 0.094 0.088 0.098 Z`); p.addPath(E(-0.1, 0.13, 0.05, 0.048)); return p; })();

// ======================= BODY (street frame) =======================
export const NECK_B = P('M -0.068 1.395 L 0.035 1.395 L 0.037 1.535 L -0.072 1.535 Z');
export const JACKET = P(`M -0.084 1.476 C -0.128 1.462 -0.15 1.424 -0.153 1.362 C -0.157 1.25 -0.151 1.1 -0.146 0.95
  L -0.143 0.852 C -0.06 0.841 0.06 0.842 0.13 0.857 C 0.132 0.95 0.131 1.05 0.127 1.13
  C 0.131 1.22 0.137 1.3 0.122 1.37 C 0.108 1.418 0.082 1.446 0.05 1.456 C 0.0 1.47 -0.05 1.479 -0.084 1.476 Z`);
export const JK_HEM = P('M -0.16 0.89 C -0.06 0.878 0.06 0.879 0.15 0.894 L 0.15 0.8 L -0.16 0.8 Z');
export const JK_ZIP = P('M 0.114 1.448 C 0.124 1.38 0.123 1.26 0.117 1.13 C 0.121 1.02 0.121 0.94 0.12 0.85');
export const JK_PULL = (() => { const p = new Path2D(); p.roundRect(0.106, 1.398, 0.009, 0.026, 0.004); return p; })();
export const JK_SEAMS = P('M -0.072 1.474 C -0.098 1.44 -0.128 1.418 -0.156 1.41 M 0.048 1.455 C 0.064 1.39 0.09 1.32 0.128 1.29 M -0.15 1.08 C -0.06 1.07 0.04 1.07 0.125 1.085');
export const JK_POCKET = P('M 0.052 1.0 L 0.124 1.02 L 0.124 1.034 L 0.05 1.015 Z');
export const JK_POCKET_SH = P('M 0.05 1.015 L 0.124 1.034 L 0.124 0.985 C 0.1 0.975 0.07 0.975 0.052 0.985 Z');
// collar: inner face (visible at the front, behind the neck) and the near band (in front of the neck)
export const COLLAR_IN = P('M -0.095 1.548 C -0.05 1.553 0.02 1.515 0.07 1.488 L 0.06 1.43 L -0.09 1.45 Z');
export const COLLAR = P(`M -0.106 1.545 C -0.06 1.534 0.02 1.5 0.07 1.481 C 0.074 1.47 0.072 1.455 0.064 1.448
  C 0.02 1.445 -0.04 1.452 -0.088 1.462 C -0.1 1.48 -0.106 1.51 -0.106 1.545 Z`);
export const COLLAR_FOLD = P('M -0.1 1.512 C -0.05 1.5 0.02 1.474 0.066 1.462');
// legs (jeans), standing; the far leg is drawn darker and slightly behind
export const LEG_NEAR = P(`M -0.066 0.94 C -0.06 0.78 -0.045 0.6 -0.035 0.48 C -0.03 0.36 -0.02 0.22 -0.004 0.075 L 0.078 0.075
  C 0.078 0.22 0.08 0.36 0.082 0.48 C 0.088 0.6 0.11 0.76 0.122 0.94 Z`);
export const LEG_FAR = P(`M -0.128 0.94 C -0.125 0.78 -0.11 0.6 -0.102 0.48 C -0.096 0.36 -0.088 0.22 -0.075 0.075 L 0.0 0.075
  C 0.0 0.22 0.0 0.36 0.004 0.48 C 0.01 0.6 0.03 0.76 0.04 0.94 Z`);
export const CREASE = P('M 0.05 0.86 C 0.048 0.7 0.04 0.58 0.036 0.48 C 0.036 0.36 0.036 0.22 0.036 0.09');
export const KNEE_FOLD = P('M -0.03 0.5 C -0.015 0.49 0.0 0.488 0.012 0.492 M -0.028 0.47 C -0.012 0.462 0.004 0.46 0.014 0.464');
export const HEM_CUFF = P('M -0.008 0.11 L 0.08 0.11 L 0.08 0.075 L -0.006 0.075 Z');
// sneakers: upper, sole, toe cap, collar; dx shifts the far shoe back
export const SHOE = (dx) => P(`M ${-0.072 + dx} 0.118 C ${-0.09 + dx} 0.1 ${-0.098 + dx} 0.05 ${-0.09 + dx} 0.026 L ${0.13 + dx} 0.026
  C ${0.152 + dx} 0.03 ${0.158 + dx} 0.055 ${0.14 + dx} 0.068 C ${0.11 + dx} 0.082 ${0.07 + dx} 0.094 ${0.05 + dx} 0.112
  C ${0.03 + dx} 0.124 ${-0.04 + dx} 0.128 ${-0.072 + dx} 0.118 Z`);
export const SOLE = (dx) => P(`M ${-0.094 + dx} 0.034 L ${0.146 + dx} 0.034 C ${0.16 + dx} 0.03 ${0.162 + dx} 0.012 ${0.15 + dx} 0.004
  C ${0.14 + dx} 0.0 ${0.12 + dx} 0.0 ${0.1 + dx} 0.0 L ${-0.08 + dx} 0.0 C ${-0.096 + dx} 0.004 ${-0.1 + dx} 0.02 ${-0.094 + dx} 0.034 Z`);
export const SOLE_LINE = (dx) => P(`M ${-0.092 + dx} 0.016 L ${0.155 + dx} 0.016`);
export const TOE = (dx) => P(`M ${0.1 + dx} 0.034 C ${0.12 + dx} 0.034 ${0.15 + dx} 0.036 ${0.148 + dx} 0.06 C ${0.13 + dx} 0.07 ${0.112 + dx} 0.072 ${0.1 + dx} 0.07 C ${0.094 + dx} 0.06 ${0.094 + dx} 0.045 ${0.1 + dx} 0.034 Z`);
export const LACES = (dx) => P(`M ${0.03 + dx} 0.105 L ${0.045 + dx} 0.097 M ${0.052 + dx} 0.094 L ${0.067 + dx} 0.086 M ${0.074 + dx} 0.083 L ${0.089 + dx} 0.076`);
export const SHOE_N = SHOE(0), SOLE_N = SOLE(0), TOE_N = TOE(0), LACES_N = LACES(0), SOLE_LINE_N = SOLE_LINE(0);
export const SHOE_F = SHOE(-0.07), SOLE_F = SOLE(-0.07);

// near arm, rigged: upper arm about the shoulder S, forearm about the elbow, mitten hand about the wrist (local
// coordinates point DOWN the limb; +x = forward when hanging)
export const SHOULDER = [-0.016, 1.402], UPPER_L = 0.29, FORE_L = 0.25;
export const UPPER = P('M -0.06 0.0 C -0.062 0.052 0.058 0.058 0.06 0.006 C 0.06 -0.08 0.053 -0.2 0.047 -0.27 C 0.046 -0.31 -0.046 -0.31 -0.047 -0.27 C -0.052 -0.2 -0.058 -0.1 -0.06 0.0 Z');
export const UPPER_FOLD = P('M 0.044 -0.218 C 0.03 -0.226 0.016 -0.236 0.006 -0.25 M 0.046 -0.25 C 0.036 -0.256 0.026 -0.264 0.02 -0.274');
export const FORE = P('M -0.046 0.02 C -0.047 0.054 0.047 0.054 0.046 0.02 L 0.041 -0.226 L -0.041 -0.226 Z');
export const FORE_FOLD = P('M 0.04 -0.02 C 0.026 -0.03 0.012 -0.034 -0.002 -0.034');
export const CUFF = (() => { const p = new Path2D(); p.roundRect(-0.043, -0.252, 0.086, 0.036, 0.008); return p; })();
export const HAND = P(`M -0.03 0.005 L 0.03 0.005 C 0.037 -0.026 0.035 -0.064 0.016 -0.082 C 0.002 -0.094 -0.022 -0.09 -0.03 -0.066
  C -0.035 -0.045 -0.034 -0.02 -0.03 0.005 Z`);
export const THUMB = P('M 0.022 -0.006 C 0.042 -0.014 0.052 -0.04 0.044 -0.054 C 0.038 -0.062 0.03 -0.056 0.026 -0.046 C 0.022 -0.034 0.024 -0.02 0.022 -0.006 Z');
// finger creases: the mitten reads as a hand (three fingers curled toward the palm)
export const FINGERS = P('M -0.012 -0.072 C -0.01 -0.05 -0.011 -0.03 -0.014 -0.012 M 0.004 -0.077 C 0.006 -0.055 0.005 -0.034 0.002 -0.016');
export const KNUCKLE = P('M -0.02 -0.07 C -0.01 -0.074 0.0 -0.074 0.01 -0.07');

// ---------- palettes ----------
const DEEP = '#0f0020';
export function heroPal(tint = null, k = 0) {
  const t = (c) => (tint ? mix(c, tint, k) : c);
  return {
    skin: t(PAL.skin), skinMid: t(mix(PAL.skin, PAL.skinShade, 0.3)), skinShade: t(PAL.skinShade), skinDeep: t(PAL.skinDeep), skinDark: t(PAL.skinDark),
    cheek: t(PAL.cheek), nose: t(mix(PAL.skin, PAL.noseRed, 0.62)), noseSh: t(mix(PAL.skinShade, PAL.noseRed, 0.6)), noseUnder: t(mix(PAL.skinDeep, PAL.noseRed, 0.38)),
    ala: t(mix(PAL.skin, PAL.noseRed, 0.42)), lip: t(mix(PAL.skin, PAL.skinShade, 0.55)), lipLo: t(mix(PAL.skin, PAL.cheek, 0.45)),
    hair: t(PAL.hair), hairShade: t(mix(PAL.hair, DEEP, 0.35)), hairLit: t(mix(PAL.hairLit, '#7a3aa0', 0.35)),
    eye: t(PAL.eye), iris: t('#2e7a6a'), pupil: t('#3ddc97'), lid: t(mix(PAL.skin, PAL.skinShade, 0.35)),
    coat: t(PAL.coat), coatShade: t(PAL.coatShade), coatLit: t(PAL.coatLit), coatDeep: t(mix(PAL.coatShade, DEEP, 0.25)),
    pants: t(PAL.pants), pantsShade: t(PAL.pantsShade), pantsLit: t(mix(PAL.pants, '#6a6ad0', 0.35)),
    shoe: t(PAL.tcell), shoeShade: t(mix(PAL.tcell, DEEP, 0.35)), sole: t('#efeaff'), soleLine: t('#c9c0f0'), toe: t('#efeaff'),
  };
}

// ---------- shared drawing (one routine for the hero and the crowd) ----------
// setBody(c) / setHead(c) put the body / head transform on c (and the light direction). lod: 0 crowd-far, 1 crowd, 2 hero.
// pose: { k, sy, arm: [a1, a2, a3], mouth, lid, lidLo, brow, hair, crowd }
const rot = (c, x, y, a) => { c.translate(x, y); c.rotate(a); };
export function upperXf(c, pose) { // the upper body leans / breathes about the neck pivot (the head frame is fixed there)
  if (!pose.k && !pose.sy) return; const [nx, ny] = NECK; c.translate(nx, ny); c.transform(1, 0, pose.k || 0, pose.sy || 1, 0, 0); c.translate(-nx, -ny);
}
function legsXf(c, pose) { if (!pose.k) return; const top = -(1.48 - 0.9) * pose.k; c.transform(1, 0, top / 0.9, 1, 0, 0); } // feet stay put, hips follow
export function drawLegs(c, p, pose, lod, walk = 0) {
  c.save(); legsXf(c, pose);
  const hip = [0.0, 0.92];
  const leg = (path, shoe, sole, ang, far) => { c.save(); if (ang) { c.translate(hip[0], hip[1]); c.rotate(ang); c.translate(-hip[0], -hip[1]); }
    c.fillStyle = far ? p.pantsShade : p.pants; c.fill(path);
    if (!far && lod > 0) { c.save(); c.clip(path); crescent(c, path, p.pantsShade, 0.016, 0); c.restore(); }
    c.fillStyle = far ? p.shoeShade : p.shoe; c.fill(shoe); c.fillStyle = far ? p.soleLine : p.sole; c.fill(sole);
    if (!far && lod > 0) { c.fillStyle = p.toe; c.fill(TOE_N); c.strokeStyle = p.soleLine; c.lineWidth = 0.004; c.stroke(SOLE_LINE_N);
      if (lod > 1) { c.strokeStyle = p.pantsLit; c.lineWidth = 0.004; c.lineCap = 'round'; c.stroke(CREASE); c.strokeStyle = p.pantsShade; c.lineWidth = 0.005; c.stroke(KNEE_FOLD);
        c.fillStyle = p.pantsShade; c.fill(HEM_CUFF); c.strokeStyle = p.sole; c.lineWidth = 0.006; c.stroke(LACES_N); } }
    c.restore(); };
  leg(LEG_FAR, SHOE_F, SOLE_F, -walk, true);
  leg(LEG_NEAR, SHOE_N, SOLE_N, walk, false);
  c.restore();
}
export function drawTorso(c, p, pose, lod) {
  c.save(); upperXf(c, pose);
  c.fillStyle = p.coatDeep; c.fill(COLLAR_IN);
  c.fillStyle = p.skinShade; c.fill(NECK_B);
  solid(c, JACKET, p.coat, { shadow: p.coatShade, so: 0.075, light: p.coatLit, lo: 0.026 }); // (unification) deeper crescents, like the cells
  c.save(); c.clip(JACKET); c.fillStyle = p.coatShade; c.fill(JK_HEM);
  if (lod > 0) { c.fillStyle = p.coatShade; c.fill(JK_POCKET_SH); c.fillStyle = p.coatDeep; c.fill(JK_POCKET); c.lineCap = 'round';
    c.strokeStyle = p.coatShade; c.lineWidth = 0.007; c.stroke(JK_ZIP);
    if (lod > 1) { c.lineWidth = 0.0035; c.stroke(JK_SEAMS); c.fillStyle = p.coatDeep; c.fill(JK_PULL); } }
  c.restore();
  c.restore();
}
export function drawCollar(c, p, pose, lod) {
  c.save(); upperXf(c, pose); solid(c, COLLAR, p.coat, { light: p.coatLit, lo: 0.012 });
  if (lod > 1) { c.strokeStyle = p.coatShade; c.lineWidth = 0.004; c.lineCap = 'round'; c.stroke(COLLAR_FOLD); }
  c.restore();
}
// the head drawn in head-frame units (the caller has set the head transform). pose.lid: upper-lid drop 0..1, pose.mouth 0..1
export function drawNeckStub(c, p) { c.fillStyle = p.skinShade; c.fill(NECK_H); c.save(); c.clip(NECK_H); c.fillStyle = p.skinDeep; c.fill(NECK_SH); c.restore(); }
export function drawHead(c, p, pose, lod, hair = 0, slitFill = null) {
  const hairBase = hair === 1 ? HAIR_BOB : hair === 2 ? HAIR_BUN : HAIR_BASE;
  if (hair === 1) { c.fillStyle = p.hairShade; c.fill(HAIR_BOB); } // long hair hangs behind the neck
  c.fillStyle = p.skin; c.fill(SKULL);
  c.save(); c.clip(SKULL);
  if (lod > 0) { c.fillStyle = p.skinMid; c.fill(CHEEKPLANE); }
  c.fillStyle = p.skinShade; c.fill(JAW);
  // (unification) the head is an orb too: a shade crescent away from the upper-left light (chin, jaw line) and a lit rim
  crescent(c, SKULL, rgba(p.skinShade, 0.85), UL[0] * 0.016, UL[1] * 0.016);
  if (lod > 0) crescent(c, SKULL, mix(p.skin, '#ffffff', 0.18), -UL[0] * 0.006, -UL[1] * 0.006);
  if (lod > 0) { c.fillStyle = rgba(p.cheek, 0.5); c.beginPath(); c.ellipse(0.06, -0.038, 0.021, 0.018, 0, 0, 6.2832); c.fill(); }
  c.restore();
  // ear
  c.fillStyle = p.skin; c.fill(EAR);
  if (lod > 0) { c.fillStyle = p.skinShade; c.fill(EAR_FOLD); c.fillStyle = p.skinDeep; c.fill(EAR_IN); }
  // hair masses
  c.fillStyle = hair === 1 ? p.hair : p.hairShade; c.fill(hairBase);
  if (hair !== 1) { c.fillStyle = p.hair; c.fill(HAIR_TOP); if (lod > 0) c.fill(HAIR_LOCK); }
  else { c.fillStyle = p.hair; c.save(); c.clip(HAIR_BOB); c.fill(HAIR_TOP); c.restore(); }
  if (lod > 0) { c.fillStyle = p.hairLit; c.fill(HAIR_HI); if (lod > 1) c.fill(HAIR_HI2); }
  // nose
  c.fillStyle = p.ala; c.fill(ALA);
  c.fillStyle = p.nose; c.fill(NOSE);
  if (lod > 0) {
    c.save(); c.clip(NOSE_SIL); c.fillStyle = p.noseUnder; c.fill(NOSE_UNDER); if (lod > 1) { c.fillStyle = p.noseSh; c.fill(ALA_CREASE); } c.restore();
    c.fillStyle = 'rgba(255,232,218,0.75)'; c.beginPath(); c.ellipse(0.1405, -0.0195, 0.0052, 0.0031, -0.55, 0, 6.2832); c.fill();
    if (slitFill !== null) { c.fillStyle = mix(p.noseUnder, '#3a0c26', 0.22); c.fill(SLIT_RIM); c.fillStyle = mix(p.noseUnder, '#3a0c26', 0.48); c.fill(SLIT_RIM2); if (slitFill) { c.fillStyle = slitFill; c.fill(NOSTRIL_HOLE); } }
  }
  // lips + mouth
  if (lod > 0) { c.fillStyle = p.lip; c.fill(LIP_UP); c.fillStyle = p.lipLo; c.fill(LIP_LO); }
  const mo = pose.mouth || 0;
  if (mo > 0.04) { c.save(); c.translate(MOUTH_AT[0], MOUTH_AT[1]); c.rotate(0.25); c.scale(0.55 + 0.45 * mo, mo); c.fillStyle = p.skinDark; c.beginPath(); c.ellipse(-0.002, -0.001, 0.0065, 0.0105, 0, 0, 6.2832); c.fill();
    c.fillStyle = mix(p.skinDark, PAL.virus, 0.35); c.beginPath(); c.ellipse(-0.003, -0.006, 0.0045, 0.0045, 0, 0, 6.2832); c.fill(); c.restore(); }
  else if (lod > 0) { c.strokeStyle = p.skinDeep; c.lineWidth = 0.0018; c.lineCap = 'round'; c.stroke(MOUTH_LINE); }
  // eye + brow
  c.save(); c.translate(EYE[0], EYE[1]);
  if (lod > 0) {
    const lid = pose.lid ?? 0.3, lo = pose.lidLo ?? 0;
    c.save(); c.clip(EYE_AL); c.fillStyle = p.eye; c.fill(EYE_AL);
    c.fillStyle = p.iris; c.fillRect(0.0024, -0.012, 0.012, 0.024);
    c.fillStyle = p.pupil; c.beginPath(); c.arc(0.0056, 0.0003, 0.0023, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(0.0028, 0.0033, 0.0011, 0, 6.2832); c.fill();
    const ly = 0.0074 - lid * 0.0152, lly = -0.0074 + lo * 0.0125;
    c.save(); c.translate(0, lly); c.fillStyle = p.lid; c.fill(LID_LO); c.restore();
    c.save(); c.translate(0, ly); c.fillStyle = p.lid; c.fill(LID_UP); c.restore();
    c.restore();
    if (lod > 1) { c.save(); c.clip(EYE_CLIP2); c.translate(0, ly); c.strokeStyle = p.eye; c.lineWidth = 0.0017; c.lineCap = 'round'; c.stroke(LID_LINE); c.restore();
      c.strokeStyle = p.skinShade; c.lineWidth = 0.0013; c.lineCap = 'round'; c.stroke(LID_FOLD); }
  } else { c.fillStyle = p.eye; c.beginPath(); c.ellipse(0.001, 0, 0.0075, 0.0068, 0, 0, 6.2832); c.fill(); }
  c.restore();
  c.save(); c.translate(BROW_C[0], BROW_C[1] + (pose.brow || 0)); c.rotate(pose.browRot || 0); c.translate(-BROW_C[0], -BROW_C[1]); c.fillStyle = p.hair; c.fill(BROW); c.restore();
}
// the near arm (body transform set): angles a1 (shoulder), a2 (elbow), a3 (wrist), radians, + = forward / up
export function drawArm(c, p, pose, lod) {
  const [a1, a2, a3] = pose.arm || [0.06, 0.12, 0.04];
  c.save(); upperXf(c, pose);
  rot(c, SHOULDER[0], SHOULDER[1], a1);
  solid(c, UPPER, p.coat, { shadow: p.coatShade, so: 0.075, light: p.coatLit, lo: 0.02 });
  if (lod > 1) { c.strokeStyle = p.coatShade; c.lineWidth = 0.0045; c.lineCap = 'round'; c.stroke(UPPER_FOLD); }
  rot(c, 0, -UPPER_L, a2);
  solid(c, FORE, p.coat, { shadow: p.coatShade, so: 0.06, light: p.coatLit, lo: 0.02 });
  if (lod > 1) { c.strokeStyle = p.coatShade; c.lineWidth = 0.0045; c.stroke(FORE_FOLD); }
  c.fillStyle = p.coatShade; c.fill(CUFF);
  rot(c, 0, -FORE_L, a3);
  solid(c, HAND, p.skin, { shadow: p.skinShade, so: 0.14 });
  if (pose.held) { c.fillStyle = '#2a2050'; c.fill(pose.held); }
  c.fillStyle = p.skin; c.fill(THUMB); if (lod > 1) { c.save(); c.clip(THUMB); crescent(c, THUMB, p.skinShade, 0.006, -0.004); c.restore(); c.strokeStyle = p.skinShade; c.lineWidth = 0.003; c.lineCap = 'round'; c.stroke(KNUCKLE); c.lineWidth = 0.0035; c.stroke(FINGERS); }
  c.restore();
}

// ======================= THE CROWD (same kit, simpler, depth-tinted) =======================
// a person's palette from a few base colours, pulled toward the background tone by k (depth tint)
export const SKINS = [[PAL.skin, PAL.skinShade, PAL.skinDeep], ['#dc8058', '#c4644e', '#a84a48'], ['#b8644e', '#9c4c46', '#823a42'], ['#8e4646', '#763840', '#5e2a3a']];
export function personPal(o, tint, k) {
  const t = (c) => mix(c, tint, k), [sk, ss, sd] = SKINS[o.skin || 0], coat = o.coat, pants = o.pants || PAL.pants, hair = o.hairCol || PAL.hair;
  return {
    skin: t(sk), skinMid: t(mix(sk, ss, 0.3)), skinShade: t(ss), skinDeep: t(sd), skinDark: t(mix(sd, DEEP, 0.3)), cheek: t(mix(sk, PAL.cheek, 0.6)),
    nose: t(sk), noseSh: t(ss), noseUnder: t(ss), ala: t(mix(sk, ss, 0.4)), lip: t(mix(sk, ss, 0.55)), lipLo: t(mix(sk, PAL.cheek, 0.4)),
    hair: t(hair), hairShade: t(mix(hair, DEEP, 0.35)), hairLit: t(mix(hair, '#ffffff', 0.22)),
    eye: t(PAL.eye), iris: t(PAL.eye), pupil: t(PAL.eye), lid: t(mix(sk, ss, 0.35)),
    coat: t(coat), coatShade: t(mix(coat, DEEP, 0.22)), coatLit: t(mix(coat, '#ffffff', 0.16)), coatDeep: t(mix(coat, DEEP, 0.4)),
    pants: t(pants), pantsShade: t(mix(pants, DEEP, 0.3)), pantsLit: t(mix(pants, '#ffffff', 0.15)),
    shoe: t(o.shoe || '#e8e2ff'), shoeShade: t(mix(o.shoe || '#e8e2ff', DEEP, 0.3)), sole: t('#efeaff'), soleLine: t('#c9c0f0'), toe: t('#efeaff'),
  };
}
const PHONE = (() => { const p = new Path2D(); p.roundRect(-0.012, -0.11, 0.07, 0.04, 0.008); return p; })();
// idle acting for a standing person (time t, phase ph): breathing, a slow sway of the head, a gesture
export function crowdPose(p, t) {
  const ph = p.ph || 0, br = Math.sin(t * 1.3 + ph) * 0.5 + 0.5, sl = Math.sin(t * 0.37 + ph * 1.7);
  const pose = { k: 0.006 * sl, sy: 1 + 0.006 * br, lid: 0.3 + 0.7 * Math.max(0, Math.sin(t * 0.9 + ph * 3) - 0.97) / 0.03, mouth: 0, head: 0.03 * sl, arm: [0.06, 0.12, 0.05] };
  if (p.act === 'talk') { const g = Math.max(0, Math.sin(t * 1.1 + ph)); pose.arm = [0.25 + 0.2 * g, 1.2 + 0.4 * g, 0.2]; pose.mouth = 0.25 * Math.max(0, Math.sin(t * 7 + ph)) * (Math.sin(t * 0.8 + ph) > 0 ? 1 : 0); pose.head = 0.05 * g; }
  else if (p.act === 'phone') { pose.arm = [0.32, 1.95, 0.25]; pose.head = -0.2; pose.lid = 0.55; pose.held = PHONE; }
  else if (p.act === 'photo') { const g = 0.5 + 0.5 * Math.sin(t * 0.5 + ph); pose.arm = [1.25 + 0.1 * g, 1.3, 0.1]; pose.head = 0.06; pose.held = PHONE; }
  return pose;
}
// a whole person in their own drawing units (metres, feet at 0, facing +x); lod 0 = silhouette-level, 1 = with face
export function drawPerson(c, p, pal, pose, lod, walk = 0) {
  const sc = p.h / 1.78; c.save(); c.scale(sc * (p.wf || 1), sc);
  if (walk) pose = { ...pose, arm: [-0.8 * walk, 0.2 + 0.3 * Math.abs(walk), 0.05] };
  drawLegs(c, pal, pose, lod > 0 ? 1 : 0, walk);
  drawTorso(c, pal, pose, lod > 0 ? 1 : 0);
  const headXf = () => { c.translate(NECK[0], NECK[1]); c.rotate(pose.head || 0); c.translate(HEAD0[0] - NECK[0], HEAD0[1] - NECK[1]); };
  c.save(); headXf(); drawNeckStub(c, pal); c.restore();
  drawCollar(c, pal, pose, 1);
  c.save(); headXf(); drawHead(c, pal, pose, lod, p.hair || 0); c.restore();
  drawArm(c, pal, pose, lod > 0 ? 1 : 0);
  c.restore();
}
// front-facing person sitting on a step (seat at y = 0, metres): same palette and shading rules
const SIT = {
  torso: P('M -0.2 0.02 C -0.21 0.25 -0.2 0.45 -0.15 0.56 C -0.08 0.6 0.08 0.6 0.15 0.56 C 0.2 0.45 0.21 0.25 0.2 0.02 Z'),
  collar: P('M -0.09 0.56 C -0.05 0.6 0.05 0.6 0.09 0.56 L 0.07 0.52 C 0.03 0.55 -0.03 0.55 -0.07 0.52 Z'),
  thighs: P('M -0.2 0.06 C -0.21 -0.02 -0.18 -0.06 -0.1 -0.06 L 0.1 -0.06 C 0.18 -0.06 0.21 -0.02 0.2 0.06 Z'),
  shins: P('M -0.19 -0.04 L -0.17 -0.36 L -0.05 -0.36 L -0.03 -0.04 Z M 0.03 -0.04 L 0.05 -0.36 L 0.17 -0.36 L 0.19 -0.04 Z'),
  shoes: P('M -0.2 -0.34 C -0.21 -0.4 -0.19 -0.42 -0.15 -0.42 L -0.06 -0.42 C -0.03 -0.42 -0.02 -0.4 -0.03 -0.34 Z M 0.03 -0.34 C 0.02 -0.4 0.03 -0.42 0.06 -0.42 L 0.15 -0.42 C 0.19 -0.42 0.21 -0.4 0.2 -0.34 Z'),
  arms: P('M -0.22 0.5 C -0.27 0.4 -0.27 0.2 -0.21 0.06 L -0.13 0.08 C -0.17 0.2 -0.17 0.38 -0.14 0.5 Z M 0.22 0.5 C 0.27 0.4 0.27 0.2 0.21 0.06 L 0.13 0.08 C 0.17 0.2 0.17 0.38 0.14 0.5 Z'),
  hands: P('M -0.22 0.08 C -0.24 0.02 -0.2 -0.02 -0.15 0.0 C -0.12 0.02 -0.12 0.07 -0.14 0.09 Z M 0.22 0.08 C 0.24 0.02 0.2 -0.02 0.15 0.0 C 0.12 0.02 0.12 0.07 0.14 0.09 Z'),
  neck: P('M -0.045 0.54 L 0.045 0.54 L 0.045 0.64 L -0.045 0.64 Z'),
  face: P('M -0.1 0.74 C -0.104 0.66 -0.07 0.6 0.0 0.6 C 0.07 0.6 0.104 0.66 0.1 0.74 C 0.1 0.83 0.06 0.87 0.0 0.87 C -0.06 0.87 -0.1 0.83 -0.1 0.74 Z'),
  faceSh: P('M 0.02 0.6 C 0.07 0.6 0.104 0.66 0.1 0.74 C 0.1 0.83 0.06 0.87 0.02 0.87 C 0.05 0.8 0.05 0.68 0.02 0.6 Z'),
  ears: P('M -0.1 0.74 C -0.125 0.75 -0.13 0.71 -0.1 0.69 Z M 0.1 0.74 C 0.125 0.75 0.13 0.71 0.1 0.69 Z'),
  hair: P('M -0.112 0.74 C -0.12 0.86 -0.06 0.92 0.0 0.92 C 0.06 0.92 0.12 0.86 0.112 0.74 C 0.1 0.8 0.08 0.82 0.05 0.83 C 0.0 0.81 -0.06 0.82 -0.1 0.78 Z'),
  hairHi: P('M -0.1 0.82 C -0.08 0.89 -0.03 0.91 0.01 0.91 C -0.03 0.89 -0.07 0.86 -0.1 0.82 Z'),
};
export function drawSitterFig(c, s, pal, lod) {
  c.fillStyle = pal.pantsShade; c.fill(SIT.shins); c.fillStyle = pal.shoe; c.fill(SIT.shoes);
  c.fillStyle = pal.pants; c.fill(SIT.thighs);
  solid(c, SIT.torso, pal.coat, { shadow: pal.coatShade, so: 0.05, light: pal.coatLit, lo: 0.02 });
  c.fillStyle = pal.coatShade; c.fill(SIT.arms); c.fillStyle = pal.skin; c.fill(SIT.hands);
  c.fillStyle = pal.skinShade; c.fill(SIT.neck); c.fillStyle = pal.coatDeep; c.fill(SIT.collar);
  c.fillStyle = pal.skin; c.fill(SIT.face); c.fill(SIT.ears); c.fillStyle = pal.skinShade; c.fill(SIT.faceSh);
  c.fillStyle = pal.hairShade; c.fill(SIT.hair); if (lod > 0) { c.fillStyle = pal.hairLit; c.fill(SIT.hairHi); }
  if (lod > 0) { c.fillStyle = pal.eye; c.beginPath(); c.arc(-0.035, 0.73, 0.011, 0, 6.2832); c.arc(0.035, 0.73, 0.011, 0, 6.2832); c.fill();
    c.fillStyle = rgba(pal.cheek, 0.55); c.beginPath(); c.arc(-0.06, 0.69, 0.018, 0, 6.2832); c.arc(0.06, 0.69, 0.018, 0, 6.2832); c.fill(); }
}
