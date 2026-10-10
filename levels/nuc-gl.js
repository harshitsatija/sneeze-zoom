// One small WebGL2 renderer for the nucleus / DNA scales (owner: NUCLEUS agent).
// Canvas2D cannot draw 13,607 atoms or ~10^5 chromatin beads per frame in 8 ms, so these are drawn here, instanced, and each
// depth band is then blitted into the 2D canvas as an ordinary engine draw item (so the engine's painter sort and depth-of-field
// blur runs still apply). The look (palette, Kurzgesagt shell shading) is passed in from shared/nucleosome.js: this file only
// knows how to draw what it is told.
//   - ONE GL render per frame: every band is rendered into its own horizontal strip of a tall canvas; items blit their strip.
//   - atoms:   instanced camera-facing discs with the stacked translucent-shell shading (perspective or orthographic).
//   - sprites: instanced textured quads (nucleosome slab sprites from the atlas), with a per-bead size window.
//   - segs:    instanced chain strokes (beads < 1.5 px) and linker DNA strips, with the same size window.
import { FAM, look as LOOK, interior, f3 } from '../core/look.js';
let gl = null, cv = null, P = {}, quad = null, look = null;
// the hero carbon's colours (unification pass): a Kurzgesagt CELL — bright cyan ring (the cloud seen edge-on), the dark medium
// of the scale inside it (look(-11)), the 2p lobes in cyan light, the 2s shell violet, the 1s core deep violet
const V3 = (h) => 'vec3(' + f3(h).map((v) => v.toFixed(4)).join(', ') + ')';
const HC = { vio: V3(interior(FAM.violet, -11, 0.1)), cb: V3(FAM.cyan.lit), cd: V3(FAM.cyan.base), lb: V3(FAM.cyan.lit), ld: V3(FAM.cyan.base),
  s2: V3(FAM.violet.lit), s2d: V3(FAM.violet.base), s1: V3(FAM.violet.base), s1d: V3(FAM.violet.dark) };
const MAXB = 12;
let bandW = 0, bandH = 0, nextBand = 0, frameKey = null;

// Atoms: each atom is a stack of concentric translucent shells, RAY-CAST per pixel (exact perspective, valid from outside and
// from inside a shell). Per shell: back surface then front surface, alpha = 1 - (1 - a0)^(1/cos θ) with θ the ray/surface angle
// quantised to flat steps; darker crescent where |n_xy - so·L| > 1; a flat highlight on the outer front surface.
// Classes >= 24 mark the hero carbon: it also holds its compact 1s shells. uPass: 0 all, 1 back surfaces only, 2 front only.
const VS_ATOM = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner; layout(location=1) in vec3 aP; layout(location=2) in float aR; layout(location=3) in float aC;
uniform mat3 uM; uniform vec3 uT; uniform float uF; uniform vec2 uC; uniform vec2 uVP; uniform float uOrtho; uniform float uNear; uniform float uRmul;
out vec3 vO; out vec3 vD; flat out vec3 vCen; flat out float vRad; flat out int vCls; flat out float vPx; out float vDep;
void main(){
  vec3 p = uM * aP + uT; vDep = p.z; float R = aR * uRmul * 1.15; vec2 s; float h; bool full = false;
  if (uOrtho > 0.0) { s = uC + vec2(p.x, -p.y) * uOrtho; h = R * uOrtho + 1.5; vPx = 1.0 / uOrtho; }
  else {
    if (p.z < -R) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    float d = length(p);
    if (d < R * 1.02 || p.z < R * 1.02) full = true;
    else { float k = uF / p.z; s = uC + vec2(p.x, -p.y) * k; h = uF * R / sqrt(max(d * d - R * R, 1e-30)) * (d / p.z) + 2.0; }
    vPx = 1.0 / uF;
  }
  vec2 q; if (full) q = uC + aCorner * vec2(uVP.x, uVP.y); else q = s + aCorner * h;
  if (uOrtho > 0.0) { vO = vec3((q.x - uC.x) / uOrtho, -(q.y - uC.y) / uOrtho, -1000.0); vD = vec3(0.0, 0.0, 1.0); }
  else { vO = vec3(0.0); vD = vec3((q.x - uC.x) / uF, -(q.y - uC.y) / uF, 1.0); }
  vCen = p; vRad = R / 1.15; vCls = int(aC + 0.5);
  gl_Position = vec4(q.x / uVP.x * 2.0 - 1.0, 1.0 - q.y / uVP.y * 2.0, 0.0, 1.0);
}`;
const FS_ATOM = `#version 300 es
precision highp float;
in vec3 vO; in vec3 vD; flat in vec3 vCen; flat in float vRad; flat in int vCls; flat in float vPx; in float vDep;
uniform vec3 uBase[24]; uniform vec3 uDark[24]; uniform vec3 uHiC; uniform float uHiA; uniform vec3 uS1C; uniform vec3 uS1D;
uniform float uS[8]; uniform float uA[8]; uniform int uNS; uniform float uBins; uniform float uCap; uniform float uSo; uniform vec2 uL; uniform int uPass; uniform float uOrtho; uniform vec3 uLob0; uniform vec3 uLob1; uniform vec3 uBC; uniform float uBR; uniform float uSat;
out vec4 o;
float erf_(float x) { float s = sign(x); x = abs(x); float t = 1.0 / (1.0 + 0.3275911 * x);
  float y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-x * x); return s * y; }
// optical depth of a Gaussian blob (amplitude A per unit length, width sg) along the ray between s0 and s1 (measured from the
// closest approach, impact parameter b)
float gi(float A, float sg, float b, float s0, float s1) { return A * exp(-b * b / (sg * sg)) * sg * 0.8862269 * (erf_(s1 / sg) - erf_(s0 / sg)); }
// anisotropic Gaussian lobe (2p): centre c, long axis u (width sa), short widths st; ray o + t D (|D| = 1), t in [t0, t1]
float lobe(float A, vec3 c, vec3 u, float sa, float st, vec3 o, vec3 D, float t0, float t1) {
  float k = 1.0 / (sa * sa) - 1.0 / (st * st); vec3 w = c - o; float du = dot(D, u), wu = dot(w, u);
  float al = 1.0 / (st * st) + k * du * du, be = dot(D, w) / (st * st) + k * du * wu, ga = dot(w, w) / (st * st) + k * wu * wu;
  float m = be / al, sq = sqrt(al); return A * exp(-(ga - be * m)) * 0.8862269 / sq * (erf_(sq * (t1 - m)) - erf_(sq * (t0 - m))); }
vec4 over(vec4 acc, vec3 c, float a) { return vec4(c * a, a) + acc * (1.0 - a); }
float stepA(float tau) { return 1.0 - exp(-max(tau, 0.0)); }
// crisp flat shape where the optical depth passes a threshold (its edge moves continuously with the camera)
float isoA(float tau, float a) { float w = max(fwidth(tau), 1e-4); return a * smoothstep(0.55 - w, 0.55 + w, tau); }
float isoT(float tau, float th) { float w = max(fwidth(tau), 1e-4); return smoothstep(th - w, th + w, tau); }
void main0(){
  vec3 D = normalize(vD); vec3 oc = vCen - vO; float tca = dot(oc, D); vec3 perp = oc - D * tca; float b = length(perp);
  float R = vRad; if (b > R * 1.15) discard;
  float bq = b;
  bool hero = vCls >= 24; int ci = hero ? vCls - 24 : vCls; vec3 base = uBase[ci], dark = uDark[ci];
  // the nucleosome as a whole gets one Kurzgesagt crescent too (atoms on its shadow side are a step darker)
  if (uBR > 0.0) { vec3 q = vO + D * ((uBC.z - vO.z) / D.z); vec2 off = (q.xy - uBC.xy) / uBR; off.y = -off.y;
    if (length(off - uL * 0.32) > 1.0) { base *= vec3(0.74, 0.74, 0.86); dark *= vec3(0.74, 0.74, 0.86); } }
  if (!hero) {
    // every other atom: ONE flat tone, a darker crescent away from the light, a small flat highlight (complex-language/08 beads)
    float pixR = (uOrtho > 0.0 ? vPx : max(tca, 1e-30) * vPx * length(vD));
    float cov = clamp((R - b) / max(pixR, 1e-30) + 0.5, 0.0, 1.0); if (cov <= 0.0) discard;
    vec2 n2 = vec2(-perp.x, perp.y) / R; // pixel offset from the centre, screen axes (y down)
    vec3 col = length(n2 - uL * uSo) > 1.0 ? dark : base;
    vec2 d = n2 - uL * 0.45; float an = atan(uL.y, uL.x) + 1.5707963; float ca = cos(an), sa = sin(an);
    vec2 e = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y); float hv = e.x * e.x / 0.032 + e.y * e.y / 0.014;
    float hc = clamp((1.0 - hv) * R / max(pixR, 1e-30) * 0.15, 0.0, 1.0) * uHiA; col = mix(col, uHiC, hc);
    if (uBR > 0.0) { float l = dot(col, vec3(0.3, 0.5, 0.2)); col = clamp(mix(vec3(l), col, uSat), 0.0, 1.0); } // same boost as the bead sprites
    if (uPass == 1) discard; o = vec4(col * cov, cov); return; }
  // ---- the hero carbon: flat Kurzgesagt shapes at their real places (all crisp iso-shapes of analytic densities)
  //   outer cloud (2s/2p region) -> 2p dumbbells -> 2s inner lobe -> 1s core; the camera dives through them.
  //   Each shape's NEAR half is weighted by the share of that shape still in front of the camera, so entering it is continuous;
  //   its FAR half (seen from inside) is the shape's own shadow side: a deep violet, so the inside reads as dark, nearly empty space.
  float sc = -tca, fA = max(sc, -1e4), bA = max(sc, 0.0);
  float s1 = uA[0] / R, g1 = uS[0] * R, s2 = uA[1] / R, g2 = uS[1] * R;
  float tf = sc < 0.0 ? gi(s1, g1, b, fA, 0.0) - gi(s2, g2, b, fA, 0.0) : 0.0, tb = gi(s1, g1, b, bA, 1e4) - gi(s2, g2, b, bA, 1e4);
  float tot = gi(s1, g1, b, -1e4, 1e4) - gi(s2, g2, b, -1e4, 1e4);
  float A3 = 6.0 / R, g3 = 0.075 * R; float h1f = sc < 0.0 ? gi(A3, g3, b, fA, 0.0) : 0.0, h1b = gi(A3, g3, b, bA, 1e4), h1T = gi(A3, g3, b, -1e4, 1e4);
  // 2s: a hollow shell (its radial node ~33 pm), a broad Gaussian minus a narrower one
  float A5 = 3.2 / R, g5 = 0.24 * R, A6 = A5 * 1.25, g6 = 0.13 * R;
  float s2f = sc < 0.0 ? gi(A5, g5, b, fA, 0.0) - gi(A6, g6, b, fA, 0.0) : 0.0, s2b = gi(A5, g5, b, bA, 1e4) - gi(A6, g6, b, bA, 1e4), s2T = gi(A5, g5, b, -1e4, 1e4) - gi(A6, g6, b, -1e4, 1e4);
  float pf = 0.0, pb = 0.0, pT = 0.0, best = 0.0; vec3 bc = vCen;
  for (int q = 0; q < 4; q++) { vec3 u = q < 2 ? uLob0 : uLob1; float sg = (q == 0 || q == 2) ? 1.0 : -1.0; vec3 c = vCen + u * (sg * 0.34 * R);
    float lT = lobe(4.5 / R, c, u, 0.2 * R, 0.14 * R, vO, D, tca - 4.0 * R, tca + 4.0 * R); pT += lT; if (lT > best) { best = lT; bc = c; }
    // each lobe is wholly in front of or behind the carbon nucleus (by its centre), so no seam cuts a lobe
    float lV = uOrtho > 0.0 ? lT : lobe(4.5 / R, c, u, 0.2 * R, 0.14 * R, vO, D, max(0.0, tca - 4.0 * R), tca + 4.0 * R); // only what lies in front of the lens
    if (dot(c - vO, D) < tca) pf += lV; else pb += lV; }
  // crescent test for a shape centred at c with radius r (pixel offset measured in the plane of c, screen axes)
  #define SHADOW(c, r) (length(vec2(-(((c) - (vO + D * (((c).z - vO.z) / D.z))).x), ((c) - (vO + D * (((c).z - vO.z) / D.z))).y) / (r) - uL * uSo) > 1.0)
  vec3 VIOLET = ${HC.vio};
  vec3 cloud = SHADOW(vCen, 0.9 * R) ? ${HC.cd} : ${HC.cb};
  vec3 lobeC = SHADOW(vCen, 0.62 * R) ? ${HC.ld} : ${HC.lb}; // the lobes shaded as one group (per-lobe crescents switched and cut spikes)
  vec3 s2C = SHADOW(vCen, 0.17 * R) ? ${HC.s2d} : ${HC.s2};
  vec3 s1C = SHADOW(vCen, 0.046 * R) ? ${HC.s1d} : ${HC.s1}; // the 1s core: deep violet, its centre is the carbon nucleus
  float shC = clamp(2.0 * tf / max(tf + tb, 1e-6), 0.0, 1.0), sh2 = clamp(2.0 * s2f / max(s2f + s2b, 1e-6), 0.0, 1.0), sh1 = clamp(2.0 * h1f / max(h1f + h1b, 1e-6), 0.0, 1.0);
  vec4 acc = vec4(0.0);
  // calm pass: every shape thins as the lens approaches it (near halves to nothing, far halves to a faint veil), so the
  // passage through the cloud is gentle; the factors depend only on the camera's distance to the atom (no switch)
  float cd = uOrtho > 0.0 ? 1e9 : length(oc);
  float fL = mix(0.3, 1.0, smoothstep(0.8 * R, 3.0 * R, cd)), f2 = mix(0.3, 1.0, smoothstep(0.4 * R, 1.5 * R, cd)), f1 = mix(0.35, 1.0, smoothstep(0.12 * R, 0.55 * R, cd));
  if (uPass != 2) { // far halves (behind the carbon nucleus)
    acc = over(acc, VIOLET, isoA(tot, 0.97)); // the cloud's own far side: the dark backdrop of the atom's interior
    acc = over(acc, lobeC * vec3(0.55, 0.55, 0.75), isoA(pb, 0.5) * fL); // the 2p lobes are gel: one constant alpha
    acc = over(acc, mix(s2C, VIOLET, 0.85), isoA(s2T, 0.8) * f2);
    acc = over(acc, mix(s1C, VIOLET, 0.82), isoA(h1T, 0.8) * f1); }
  if (uPass != 1) { // near halves
    // near halves of the inner shells: sunk toward the interior colour (seen from inside they are a veil over the whole frame)
    // calm pass: a near half thins out as the lens reaches it (fainter the closer the camera is to that shape), so passing
    // through the cloud is a gentle veil, not big flat shapes sweeping across the frame
    float nL = smoothstep(1.0 * R, 3.0 * R, cd), nC = smoothstep(1.0 * R, 2.6 * R, cd), n2 = smoothstep(0.5 * R, 1.5 * R, cd), n1 = smoothstep(0.16 * R, 0.55 * R, cd);
    acc = over(acc, mix(s1C, VIOLET, 0.6), isoA(h1T, 0.45) * sh1 * n1);
    acc = over(acc, mix(s2C, VIOLET, 0.6), isoA(s2T, 0.5) * sh2 * n2);
    acc = over(acc, mix(lobeC, VIOLET, 0.3), isoA(pf, 0.3) * nL);
    acc = over(acc, cloud, isoA(tot, 0.94) * (1.0 - 0.92 * isoT(tot, 1.1)) * shC * nC); // ring (edge-on cloud) + a thin veil over the interior
    if (sc < -R * 0.5 || uOrtho > 0.0) { vec2 nxy = vec2(-perp.x, perp.y) / R; vec2 d = nxy - uL * 0.74; float an = atan(uL.y, uL.x) + 1.5707963; float ca = cos(an), sa = sin(an);
      vec2 e = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y); float hv = e.x * e.x / 0.012 + e.y * e.y / 0.0025; float hc = clamp((1.0 - hv) * 6.0, 0.0, 1.0) * uHiA * shC;
      acc = over(acc, uHiC, hc); } }
  if (acc.a <= 0.0) discard;
  o = acc;
}
uniform vec4 uFog; uniform vec2 uFogD; uniform vec4 uFogN; uniform vec2 uFogND;
void main(){ main0(); float k = uFog.a * clamp((vDep - uFogD.x) / max(uFogD.y - uFogD.x, 1e-9), 0.0, 1.0); o.rgb = mix(o.rgb, uFog.rgb * o.a, k);
  float kn = uFogN.a * clamp((uFogND.y - vDep) / max(uFogND.y - uFogND.x, 1e-9), 0.0, 1.0); o.rgb = mix(o.rgb, uFogN.rgb * o.a, kn); }`;
// nucleosome slab sprites (atlas tiles), one instance per (bead, slab)
const VS_SPR = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner; layout(location=1) in vec3 aP; layout(location=2) in float aTile;
uniform mat3 uM; uniform vec3 uT; uniform float uF; uniform vec2 uC; uniform vec2 uVP; uniform float uNear;
uniform float uH; uniform float uBead; uniform float uMin; uniform float uMax; uniform vec2 uGrid; uniform float uZoff[4]; uniform vec3 uEx[16]; uniform int uNEx;
out vec2 vUV; out float vDep;
void main(){
  int ti = int(aTile + 0.5); int slab = ti - (ti / 4) * 4;
  vec3 p = uM * (aP + vec3(0.0, 0.0, uZoff[slab])) + uT; vDep = p.z;
  if (p.z <= uNear) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 pc = uM * aP + uT; float kc = uF / pc.z; float bead = uBead * kc;
  if (bead < uMin) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  for (int i = 0; i < 16; i++) { if (i >= uNEx) break; if (distance(aP, uEx[i]) < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } }
  float k = uF / p.z; vec2 s = uC + vec2(p.x, -p.y) * k + aCorner * uH * k;
  float col = float(ti) - floor(float(ti) / uGrid.x) * uGrid.x, row = floor(float(ti) / uGrid.x);
  vUV = vec2((col + aCorner.x * 0.5 + 0.5) / uGrid.x, (row + aCorner.y * 0.5 + 0.5) / uGrid.y);
  gl_Position = vec4(s.x / uVP.x * 2.0 - 1.0, 1.0 - s.y / uVP.y * 2.0, 0.0, 1.0);
}`;
const FS_TEX = `#version 300 es
precision highp float; in vec2 vUV; in float vDep; uniform sampler2D uTex; out vec4 o;
// small beads average cyan DNA and magenta histones toward grey: keep them saturated (Kurzgesagt beads are saturated at any size)
void main0(){ vec4 t = texture(uTex, vUV); float l = dot(t.rgb, vec3(0.3, 0.5, 0.2)); o = vec4(clamp(mix(vec3(l), t.rgb, 1.15), 0.0, t.a), t.a); }
uniform vec4 uFog; uniform vec2 uFogD; uniform vec4 uFogN; uniform vec2 uFogND;
void main(){ main0(); float k = uFog.a * clamp((vDep - uFogD.x) / max(uFogD.y - uFogD.x, 1e-9), 0.0, 1.0); o.rgb = mix(o.rgb, uFog.rgb * o.a, k);
  float kn = uFogN.a * clamp((uFogND.y - vDep) / max(uFogND.y - uFogND.x, 1e-9), 0.0, 1.0); o.rgb = mix(o.rgb, uFogN.rgb * o.a, kn); }`;
// chain strokes (kind 0, beads below uMin px) and linker DNA (kind 1, beads between uMin and uMax px)
const VS_SEG = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner; layout(location=1) in vec3 aA; layout(location=2) in vec3 aB; layout(location=3) in vec4 aK;
uniform mat3 uM; uniform vec3 uT; uniform float uF; uniform vec2 uC; uniform vec2 uVP; uniform float uNear;
uniform float uBead; uniform float uMin; uniform float uMax; uniform float uChainW; uniform float uDnaW; uniform vec3 uEx[16]; uniform int uNEx;
out vec2 vQ; out float vW; out float vAlpha; flat out float vKind; out float vAlong; out float vDep;
void main(){
  vec3 pa = uM * aA + uT, pb = uM * aB + uT; vDep = 0.5 * (pa.z + pb.z);
  if (pa.z <= uNear || pb.z <= uNear) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float ka = uF / pa.z, kb = uF / pb.z; float km = 0.5 * (ka + kb); float bead = uBead * km;
  float kind = aK.x; float w;
  if (kind < 0.5) { if (bead >= uMin) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } w = uChainW * km; }
  else { if (bead < uMin) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    for (int i = 0; i < 16; i++) { if (i >= uNEx) break; if (distance(aA, uEx[i]) < 9.0 || distance(aB, uEx[i]) < 9.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } }
    w = max(uDnaW * km, min(3.2, bead * 0.3)); } // linker DNA never thinner than a bold stroke beside its beads (a stroke-width law, like kit.pointLaw)
  vec2 sa = uC + vec2(pa.x, -pa.y) * ka, sb = uC + vec2(pb.x, -pb.y) * kb; vec2 d = sb - sa; float L = length(d);
  vec2 dir = L > 1e-4 ? d / L : vec2(1.0, 0.0); vec2 n = vec2(-dir.y, dir.x);
  float wp = max(w, 1.0); float hw = wp * 0.5 + 0.75; float cap = kind < 0.5 ? hw : 0.0;
  vec2 q = mix(sa, sb, aCorner.x) + dir * (aCorner.x * 2.0 - 1.0) * cap + n * aCorner.y * hw;
  vQ = vec2(aCorner.y * hw, wp * 0.5); vW = wp; vAlpha = min(w, 1.0); vKind = kind; vAlong = aCorner.x * aK.y + aK.z;
  gl_Position = vec4(q.x / uVP.x * 2.0 - 1.0, 1.0 - q.y / uVP.y * 2.0, 0.0, 1.0);
}`;
const FS_SEG = `#version 300 es
precision highp float;
in vec2 vQ; in float vW; in float vAlpha; flat in float vKind; in float vAlong; in float vDep;
uniform vec3 uChainC; uniform vec3 uDnaC; uniform sampler2D uTex; uniform float uPeriod; out vec4 o;
void main0(){
  float cov = clamp(vQ.y - abs(vQ.x) + 0.5, 0.0, 1.0) * vAlpha; if (cov <= 0.0) discard;
  if (vKind < 0.5) { o = vec4(uChainC * cov, cov); return; }
  if (vW < 3.0) { o = vec4(uDnaC * cov, cov); return; }
  vec4 t = texture(uTex, vec2(vAlong / uPeriod, 0.5 + vQ.x / vQ.y * 0.5)); o = t * clamp(vQ.y - abs(vQ.x) + 0.5, 0.0, 1.0);
}
uniform vec4 uFog; uniform vec2 uFogD; uniform vec4 uFogN; uniform vec2 uFogND;
void main(){ main0(); float k = uFog.a * clamp((vDep - uFogD.x) / max(uFogD.y - uFogD.x, 1e-9), 0.0, 1.0); o.rgb = mix(o.rgb, uFog.rgb * o.a, k);
  float kn = uFogN.a * clamp((uFogND.y - vDep) / max(uFogND.y - uFogND.x, 1e-9), 0.0, 1.0); o.rgb = mix(o.rgb, uFogN.rgb * o.a, kn); }`;

function compile(vs, fs) {
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const nm = info.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
export function glOK() { return !!gl; }
// depth sinking (unification pass): every band can be sunk toward the medium haze of its scale, like look.sink() in 2D
// sink amount k reached at depth d1 (model units), none nearer than d0: continuous with depth, no band steps
// near layer (optional): things nearer than n1 sink toward a dark silhouette colour, fully kN at n0 (the L0 foreground)
let FOG = [0, 0, 0, 0, 0, 1], FOGN = [0, 0, 0, 0, 0, 1];
export function setFog(rgb3, k, d0 = 0, d1 = 1, near = null) { FOG = [rgb3[0], rgb3[1], rgb3[2], k, d0, d1]; FOGN = near ? [near[0][0], near[0][1], near[0][2], near[1], near[2], near[3]] : [0, 0, 0, 0, 0, 1]; }
const fog = (u) => { gl.uniform4f(u.uFog, FOG[0], FOG[1], FOG[2], FOG[3]); gl.uniform2f(u.uFogD, FOG[4], FOG[5]); gl.uniform4f(u.uFogN, FOGN[0], FOGN[1], FOGN[2], FOGN[3]); gl.uniform2f(u.uFogND, FOGN[4], FOGN[5]); };
export function initGL(lk) {
  if (gl) return gl; look = lk;
  cv = document.createElement('canvas'); cv.width = 4; cv.height = 4;
  gl = cv.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) { console.warn('nucleus: no WebGL2'); return null; }
  P.atom = compile(VS_ATOM, FS_ATOM); P.spr = compile(VS_SPR, FS_TEX); P.seg = compile(VS_SEG, FS_SEG);
  quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  P.segQuad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, P.segQuad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST);
  return gl;
}
export const glCanvas = () => cv;
export function buffer(data) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; }
export function texture(src, { repeat = false, mip = true } = {}) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  if (mip) gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); return t;
}

// ---------- per-frame bands ----------
// Call band(V) to get a fresh strip for this frame (or null when all are used). Rendering happens immediately; blit later.
export const GS = 0.36; // the atom/cloud layer renders at half resolution (soft shapes, mostly blurred): 4x less GPU fill
let bandPW = 0, bandPH = 0; // physical band size
export function band(V) {
  if (!gl) return null;
  const key = V; if (key !== frameKey) { frameKey = key; nextBand = 0; }
  if (bandW !== V.w || bandH !== V.h) { bandW = V.w; bandH = V.h; bandPW = Math.ceil(V.w * GS); bandPH = Math.ceil(V.h * GS); cv.width = bandPW; cv.height = bandPH * MAXB; }
  if (nextBand >= MAXB) return null;
  const k = nextBand++; const y0 = (MAXB - 1 - k) * bandPH;
  gl.viewport(0, y0, bandPW, bandPH); gl.enable(gl.SCISSOR_TEST); gl.scissor(0, y0, bandPW, bandPH); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  return { k, y: k * bandPH, box: [1e9, 1e9, -1e9, -1e9] };
}
export function bandsLeft(V) { if (V && V !== frameKey) return MAXB; return MAXB - nextBand; }
// blit a band into a 2D context (screen space), cropped to its touched box
export function blit(c, b) {
  const [x0, y0, x1, y1] = b.box; const X0 = Math.max(0, Math.floor(x0)), Y0 = Math.max(0, Math.floor(y0)), X1 = Math.min(bandW, Math.ceil(x1)), Y1 = Math.min(bandH, Math.ceil(y1));
  if (X1 <= X0 || Y1 <= Y0) return;
  c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingQuality = 'high'; c.drawImage(cv, X0 * GS, b.y + Y0 * GS, (X1 - X0) * GS, (Y1 - Y0) * GS, X0, Y0, X1 - X0, Y1 - Y0);
}
export function grow(b, x0, y0, x1, y1) { const B = b.box; if (x0 < B[0]) B[0] = x0; if (y0 < B[1]) B[1] = y0; if (x1 > B[2]) B[2] = x1; if (y1 > B[3]) B[3] = y1; }

// camera transform for a model placed at O (metres, frame fr) with rotation R (3x3 row-major, model -> frame axes), model units = `unit` metres
// returns { M: Float32Array(9) column-major mat3 for GLSL, T: [x,y,depth] in model units }
export function camXf(V, fr, O, R, unit) {
  const e = V.c(fr); const v = [O[0] - e.p[0], O[1] - e.p[1], O[2] - e.p[2]];
  const rows = [e.r, e.u, [-e.b[0], -e.b[1], -e.b[2]]];
  const T = rows.map((r) => (r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) / unit);
  const M = new Float32Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const r = rows[i]; M[j * 3 + i] = R ? r[0] * R[j] + r[1] * R[3 + j] + r[2] * R[6 + j] : r[j]; }
  return { M, T };
}
function common(u, V, X, near) {
  gl.uniformMatrix3fv(u.uM, false, X.M); gl.uniform3f(u.uT, X.T[0], X.T[1], X.T[2]); gl.uniform1f(u.uF, V.f); gl.uniform2f(u.uC, V.cx, V.cy);
  gl.uniform2f(u.uVP, V.w, V.h); gl.uniform1f(u.uNear, near);
}
function setLook(u) {
  gl.uniform3fv(u.uBase, look.base); gl.uniform3fv(u.uDark, look.dark); gl.uniform3fv(u.uHiC, look.hi); gl.uniform1f(u.uHiA, look.hiA);
  gl.uniform1fv(u.uS, look.s); gl.uniform1fv(u.uA, look.a); gl.uniform1i(u.uNS, look.ns); gl.uniform1f(u.uBins, look.bins);
  gl.uniform1f(u.uCap, look.cap); gl.uniform1f(u.uSo, look.so); gl.uniform2f(u.uL, look.L[0], look.L[1]); gl.uniform3fv(u.uS1C, look.s1c); gl.uniform3fv(u.uS1D, look.s1d);
}
// model = { buf, n } interleaved [x,y,z,r,cls] float32 (model units). Draws instances [i0, i1).
export function drawAtoms(V, X, model, i0, i1, { ortho = 0, near = 0, rmul = 1, vp = null, center = null, pass = 0, lobes = null, bc = null, br = 0, sat = 1.15 } = {}) {
  if (i1 <= i0) return; const { p, u } = P.atom; gl.useProgram(p);
  if (vp) { gl.uniformMatrix3fv(u.uM, false, X.M); gl.uniform3f(u.uT, X.T[0], X.T[1], X.T[2]); gl.uniform1f(u.uF, 1); gl.uniform2f(u.uC, center[0], center[1]); gl.uniform2f(u.uVP, vp[0], vp[1]); gl.uniform1f(u.uNear, 0); }
  else common(u, V, X, near);
  fog(u); gl.uniform1f(u.uOrtho, ortho); gl.uniform1f(u.uRmul, rmul); gl.uniform1i(u.uPass, pass); setLook(u); const lb = lobes || [[1, 0, 0], [0, 1, 0]]; gl.uniform3fv(u.uLob0, lb[0]); gl.uniform3fv(u.uLob1, lb[1]); gl.uniform3fv(u.uBC, bc || [0, 0, 0]); gl.uniform1f(u.uBR, br); gl.uniform1f(u.uSat, sat);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, model.buf); const st = 20, off = i0 * st;
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, off); gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, st, off + 12); gl.vertexAttribDivisor(2, 1);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, st, off + 16); gl.vertexAttribDivisor(3, 1);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, i1 - i0);
  gl.disableVertexAttribArray(2); gl.disableVertexAttribArray(3); gl.vertexAttribDivisor(1, 0); gl.vertexAttribDivisor(2, 0); gl.vertexAttribDivisor(3, 0);
}
// sprites = { buf } interleaved [x,y,z,tile] ; atlas = { tex, grid:[cols,rows], H, zoff:[4] }
const NOEX = new Float32Array(48);
export function drawSprites(V, X, spr, i0, i1, atlas, { near = 0, bead = 11, min = 1.5, max = 1e9, ex = NOEX, nex = 0 } = {}) {
  if (i1 <= i0) return; const { p, u } = P.spr; gl.useProgram(p); common(u, V, X, near); fog(u);
  gl.uniform1f(u.uH, atlas.H); gl.uniform1f(u.uBead, bead); gl.uniform1f(u.uMin, min); gl.uniform1f(u.uMax, max); gl.uniform2f(u.uGrid, atlas.grid[0], atlas.grid[1]); gl.uniform1fv(u.uZoff, atlas.zoff); gl.uniform3fv(u.uEx, ex); gl.uniform1i(u.uNEx, nex);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlas.tex); gl.uniform1i(u.uTex, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, spr.buf); const st = 16, off = i0 * st;
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, off); gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, st, off + 12); gl.vertexAttribDivisor(2, 1);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, i1 - i0);
  gl.disableVertexAttribArray(2); gl.vertexAttribDivisor(1, 0); gl.vertexAttribDivisor(2, 0);
}
// segs = { buf } interleaved [ax,ay,az, bx,by,bz, kind, len, phase, 0]
export function drawSegs(V, X, seg, i0, i1, strip, { near = 0, bead = 11, min = 1.5, max = 1e9, chainW = 8.5, dnaW = 2.0, chainC, dnaC, ex = NOEX, nex = 0 } = {}) {
  if (i1 <= i0) return; const { p, u } = P.seg; gl.useProgram(p); common(u, V, X, near); fog(u);
  gl.uniform1f(u.uBead, bead); gl.uniform1f(u.uMin, min); gl.uniform1f(u.uMax, max); gl.uniform1f(u.uChainW, chainW); gl.uniform1f(u.uDnaW, dnaW); gl.uniform3fv(u.uEx, ex); gl.uniform1i(u.uNEx, nex);
  gl.uniform3fv(u.uChainC, chainC); gl.uniform3fv(u.uDnaC, dnaC); gl.uniform1f(u.uPeriod, strip ? strip.period : 1);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, strip ? strip.tex : null); gl.uniform1i(u.uTex, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, P.segQuad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, seg.buf); const st = 40, off = i0 * st;
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, off); gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, st, off + 12); gl.vertexAttribDivisor(2, 1);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, st, off + 24); gl.vertexAttribDivisor(3, 1);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, i1 - i0);
  gl.disableVertexAttribArray(2); gl.disableVertexAttribArray(3); gl.vertexAttribDivisor(1, 0); gl.vertexAttribDivisor(2, 0); gl.vertexAttribDivisor(3, 0);
}
// offscreen render helper (atlas building): render into the canvas at a given viewport, then copy into a 2D canvas region
export function offscreen(w, h, fn) {
  if (cv.width < w || cv.height < h) { cv.width = Math.max(cv.width, w); cv.height = Math.max(cv.height, h); bandW = bandH = 0; }
  gl.viewport(0, cv.height - h, w, h); gl.enable(gl.SCISSOR_TEST); gl.scissor(0, cv.height - h, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  fn(); return { cv, sx: 0, sy: 0, w, h };
}
