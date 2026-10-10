// WebGL2 accelerator for the city's static 3D geometry (18k buildings, the Met's 165 roof tiers + facade, 41k trees,
// 30k Manhattan blocks). It renders into ONE offscreen canvas that the Canvas2D engine composites like any other
// draw item. While depth of field is on, the scene is rendered in depth slices (near/far planes), one draw item per
// slice, so blur still follows real depth and Canvas2D items (the man, people, cars) interleave by depth.
// Same flat colours and geometry as a Canvas2D vector render; a z-buffer replaces the painter's sort.
import { rgb, mix, PAL } from '../core/kit.js';
import { G, COL, hash32, SB, CB } from './city-geo.js';
import { TERRAIN } from './earth-terrain.js';
import { FAM } from '../core/look.js';
import { cameraAt } from '../core/cam.js';
import { xform } from '../core/world.js';
import { setPath } from '../core/anchors.js';

const VS = `#version 300 es
precision highp float;
in vec3 a_pos; in float a_col; in float a_meta; in float a_h; in float a_u;
uniform vec3 u_cam, u_r, u_u, u_b; uniform float u_f; uniform vec2 u_wh; uniform vec2 u_nf; uniform highp sampler2D u_bt; uniform vec3 u_urban; uniform float u_gm; uniform vec3 u_park; uniform vec3 u_road;
out vec3 v_col; out float v_h; out float v_win; out float v_u;
void main() {
  v_u = a_u;
  float kind = mod(a_meta, 4.0), blk = floor(a_meta / 4.0) - 1.0;
  if (kind != 2.0 && blk >= 0.0) { int b = int(blk + 0.5); float st = texelFetch(u_bt, ivec2(b % 256, b / 256), 0).r; bool isBlock = kind == 1.0;
    if ((!isBlock && st > 0.5) || (isBlock && st < 0.5)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } }
  vec3 v = a_pos - u_cam; float X = dot(v, u_r), Y = dot(v, u_u), D = -dot(v, u_b), n = u_nf.x, f = u_nf.y;
  gl_Position = vec4(X * u_f * 2.0 / u_wh.x, Y * u_f * 2.0 / u_wh.y, D * (f + n) / (f - n) - 2.0 * f * n / (f - n), D);
  float c = a_col; v_col = vec3(floor(c / 65536.0), mod(floor(c / 256.0), 256.0), mod(c, 256.0)) / 255.0;
  v_h = a_h; v_win = kind > 2.5 ? 1.0 : 0.0;
  if (u_gm < 1e8 && a_h > 2.5) { v_col = mix(u_road, v_col, clamp((u_gm * 0.046 - 0.7) / 1.3, 0.0, 1.0)); } // markings (0.64 m bars) melt into the asphalt before they alias
  if (u_gm < 1e8) { float m = a_h > 1.5 && a_h < 2.5 ? clamp((u_gm * 0.229 - 0.5) / 1.5, 0.0, 1.0) : clamp((u_gm - 1.2) / 3.0, 0.0, 1.0); v_col = mix(a_h > 1.5 && a_h < 2.5 ? u_park : u_urban, v_col, m); v_h = 0.0; } // ground details narrower than ~1 px become the urban ground they sit on
  if (kind == 1.0 && a_h < 0.0 && -a_h * u_f / max(D, 1.0) < 1.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (kind == 1.0) { float px = abs(a_h) * u_f / max(D, 1.0); v_col = mix(u_urban, v_col, clamp((px - 1.0) / 1.5, 0.0, 1.0)); v_h = 0.0; } // sub-pixel blocks are the urban ground
}`;
const FS = `#version 300 es
precision highp float;
in vec3 v_col; in float v_h; in float v_win; in float v_u; uniform vec3 u_winc; out vec4 o;
void main() {
  vec3 c = v_col;
  if (v_win > 0.5) { // window bands, one per 3.3 m floor; they fade to their own average colour when sub-pixel (no switch)
    // a grid of windows (3.3 m floors, 2.6 m bays); it fades to its own average colour before it gets small enough to alias
    float fl = v_h / 3.3, w = max(fwidth(fl), fwidth(v_u));
    float wy = smoothstep(0.28 - w, 0.28 + w, fract(fl)) * (1.0 - smoothstep(0.80 - w, 0.80 + w, fract(fl)));
    float wx = smoothstep(0.22 - w, 0.22 + w, fract(v_u)) * (1.0 - smoothstep(0.78 - w, 0.78 + w, fract(v_u)));
    float k = clamp((0.22 - w) / 0.12, 0.0, 1.0); vec3 avg = mix(c, u_winc, 0.52 * 0.56 * 0.55);
    c = mix(avg, mix(c, u_winc, 0.55 * wy * wx), k);
  }
  o = vec4(c, 1.0);
}`;
const TVS = `#version 300 es
precision highp float;
in vec2 a_q; in vec3 a_c; in float a_r; in float a_seed;
uniform vec3 u_cam, u_r, u_u, u_b; uniform float u_f; uniform vec2 u_wh; uniform vec2 u_nf;
out vec2 v_q; out float v_seed; out float v_rp;
void main() {
  vec3 v = a_c - u_cam; float X = dot(v, u_r), Y = dot(v, u_u), D = -dot(v, u_b), n = u_nf.x, f = u_nf.y;
  if (D < n || D > f) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float k = u_f / D, rp = a_r * k; vec2 c = vec2(X * k, Y * k) + vec2(a_q.x, -a_q.y) * rp;
  float z = (D * (f + n) / (f - n) - 2.0 * f * n / (f - n)) / D;
  gl_Position = vec4(c * 2.0 / u_wh, z, 1.0); v_q = a_q; v_seed = a_seed; v_rp = rp;
}`;
const TFS = `#version 300 es
precision highp float;
in vec2 v_q; in float v_seed; in float v_rp; uniform vec2 u_L; uniform vec3 u_dark, u_base, u_lit; out vec4 o;
float h(float s) { return fract(sin(s * 12.9898) * 43758.5453); }
float lobe(vec2 q, vec2 c, float s, float sd, float wob) { vec2 p = (q - c) / s; float a = atan(p.y, p.x);
  float R = 1.0 + wob * ((0.5 + 0.5 * h(sd)) * sin(2.0 * a + 6.28 * h(sd + 1.1)) + 0.6 * h(sd + 2.3) * sin(3.0 * a + 6.28 * h(sd + 3.7)) + 0.4 * h(sd + 4.1) * sin(5.0 * a + 6.28 * h(sd + 5.3)));
  return length(p) / R; }
void main() {
  vec2 O[3] = vec2[3](vec2(0.0), vec2(-0.47, -0.3), vec2(0.5, -0.36)); float S[3] = float[3](1.0, 0.6, 0.54);
  float wob = 0.12 * clamp((v_rp - 10.0) / 25.0, 0.0, 1.0);
  float dk = 9.0, bs = 9.0, lt = 9.0;
  for (int i = 0; i < 3; i++) { float sd = v_seed + float(i) * 7.0;
    dk = min(dk, lobe(v_q, O[i], S[i], sd, wob));
    bs = min(bs, lobe(v_q, O[i] + u_L * 0.12 * S[i], 0.88 * S[i], sd, wob));
    lt = min(lt, lobe(v_q, O[i] + u_L * 0.36 * S[i], 0.42 * S[i], sd + 0.5, wob * 0.6)); }
  float aa = max(fwidth(dk), 1e-4);
  float a = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, dk); if (a <= 0.0) discard;
  float ab = 1.0 - smoothstep(1.0 - aa * 1.1, 1.0 + aa * 1.1, bs), al = 1.0 - smoothstep(1.0 - aa * 2.0, 1.0 + aa * 2.0, lt);
  vec3 c = mix(mix(u_dark, u_base, ab), u_lit, al * step(1.4, v_rp));
  o = vec4(c * a, a);
}`;

const pack = (hex) => { const [r, g, b] = rgb(hex); return r * 65536 + g * 256 + b; };
const unrgb = (hex) => rgb(hex).map((v) => v / 255);

export const GL = { ok: false };
function sh(gl, type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
function prog(gl, vs, fs) { const p = gl.createProgram(); gl.attachShader(p, sh(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }

// ---------- geometry builder: grouped into spatial tiles so each slice draws only what it can see ----------
class Builder {
  constructor() { this.v = []; this.i = []; this.tiles = new Map(); this.cur = null; }
  tile(key, bb) { let t = this.tiles.get(key); if (!t) { t = { key, v: [], i: [], bb: [1e9, 1e9, -1e9, -1e9], hmax: 0 }; this.tiles.set(key, t); } this.cur = t; return t; }
  vert(x, y, z, col, meta, h, u = 0) { const t = this.cur; const k = t.v.length / 7; t.v.push(x, y, z, col, meta, h, u);
    if (x < t.bb[0]) t.bb[0] = x; if (x > t.bb[2]) t.bb[2] = x; if (z < t.bb[1]) t.bb[1] = z; if (z > t.bb[3]) t.bb[3] = z; if (y > t.hmax) t.hmax = y; return k; }
  tri(a, b, c) { this.cur.i.push(a, b, c); }
  // a planar polygon (flat [x,y,z,...]) as a fan, front face toward normal n
  poly(P, n, col, meta, h = 0) {
    const k = P.length / 3; if (k < 3) return; let nx = 0, ny = 0, nz = 0;
    for (let a = 0; a < k; a++) { const b = (a + 1) % k; nx += (P[3 * a + 1] - P[3 * b + 1]) * (P[3 * a + 2] + P[3 * b + 2]); ny += (P[3 * a + 2] - P[3 * b + 2]) * (P[3 * a] + P[3 * b]); nz += (P[3 * a] - P[3 * b]) * (P[3 * a + 1] + P[3 * b + 1]); }
    const flip = nx * n[0] + ny * n[1] + nz * n[2] < 0, base = []; for (let a = 0; a < k; a++) base.push(this.vert(P[3 * a], P[3 * a + 1], P[3 * a + 2], col, meta, h));
    for (let a = 1; a < k - 1; a++) flip ? this.tri(base[0], base[a + 1], base[a]) : this.tri(base[0], base[a], base[a + 1]);
  }
  finish(gl) {
    const tiles = [...this.tiles.values()].filter((t) => t.i.length); let nv = 0, ni = 0; for (const t of tiles) { nv += t.v.length; ni += t.i.length; }
    const V = new Float32Array(nv), I = new Uint32Array(ni); let ov = 0, oi = 0;
    for (const t of tiles) { V.set(t.v, ov); const base = ov / 7; for (let k = 0; k < t.i.length; k++) I[oi + k] = t.i[k] + base; t.off = oi; t.cnt = t.i.length; ov += t.v.length; oi += t.i.length; t.v = null; t.i = null; }
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, V, gl.STATIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I, gl.STATIC_DRAW);
    const P = GL.p; const at = (name, n, off) => { const l = gl.getAttribLocation(P, name); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 28, off); };
    at('a_pos', 3, 0); at('a_col', 1, 12); at('a_meta', 1, 16); at('a_h', 1, 20); at('a_u', 1, 24);
    gl.bindVertexArray(null);
    return { vao, tiles, nv: nv / 7, ni };
  }
}
const META = (kind, blk) => (blk + 1) * 4 + kind; // kind 0 = building (hidden when its block is drawn), 1 = block, 2 = always, 3 = wall with windows (always)

export async function initGL(ctx, marks) {
  const tri = new Uint32Array(await ctx.buf('assets/city/tri.bin')), gnd = new Float32Array(await ctx.buf('assets/city/ground.bin'));
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
  const gl = cv.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, depth: true, preserveDrawingBuffer: false });
  if (!gl) return;
  GL.cv = cv; GL.gl = gl; GL.p = prog(gl, VS, FS); GL.tp = prog(gl, TVS, TFS);
  const sx = G.sun[0], sz = G.sun[2];
  // ---- prisms (buildings + Met tiers) and blocks, read in the same order as the triangulation
  const B = new Builder(); let tp = 0; const TS = 200;
  const roofCol = COL.roofs.map(pack), wallL = pack(COL.wallLit), wallS = pack(COL.wallShade), metL = pack(COL.metLit), metS = pack(COL.metShade), metR = pack(COL.metRoof), metRH = pack(COL.metRoofHi), metG = pack(COL.metGlass), metW = pack(COL.metWall);
  const prism = (p, roofC, litC, shC, meta, wmeta) => {
    const ntri = tri[tp++], T = tri.subarray(tp, tp + 3 * ntri); tp += 3 * ntri;
    B.tile('p' + Math.floor(p.x / TS) + ',' + Math.floor(p.z / TS));
    // roof (front face up)
    const base = []; for (const R of p.rings) for (let i = 0; i < R.length; i += 2) base.push(B.vert(R[i], p.h, R[i + 1], roofC, meta, 0));
    const vx = (k) => B.cur.v[7 * k], vz = (k) => B.cur.v[7 * k + 2];
    for (let k = 0; k < ntri; k++) { const a = base[T[3 * k]], b = base[T[3 * k + 1]], c = base[T[3 * k + 2]]; if (a === undefined || b === undefined || c === undefined) continue;
      const cr = (vx(b) - vx(a)) * (vz(c) - vz(a)) - (vz(b) - vz(a)) * (vx(c) - vx(a)); cr < 0 ? B.tri(a, b, c) : B.tri(a, c, b); }   // +y normal: (b-a)x(c-a).y = dz1*dx2 - dx1*dz2 > 0 ⇔ cr < 0
    // walls (outward), coloured by the real Sun
    p.rings.forEach((R, ri) => { const s = ri === 0 ? p.sg[ri] : -p.sg[ri], n = R.length >> 1;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n, x0 = R[2 * i], z0 = R[2 * i + 1], x1 = R[2 * j], z1 = R[2 * j + 1], nx = s * (z1 - z0), nz = -s * (x1 - x0);
        const col = nx * sx + nz * sz > 0 ? litC : shC; const hh = p.h - p.b;
        const u0 = 0, u1 = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 2.6));  // a whole number of 2.6 m window bays per wall
        const a = B.vert(x0, p.b, z0, col, wmeta, 0, u0), b = B.vert(x1, p.b, z1, col, wmeta, 0, u1), c = B.vert(x1, p.h, z1, col, wmeta, hh, u1), d = B.vert(x0, p.h, z0, col, wmeta, hh, u0);
        // front = outward normal (nx, 0, nz): (b-a)x(c-a) = (x1-x0,0,z1-z0)x(x1-x0,h,z1-z0) -> y-up wall normal ∝ (-(z1-z0)h, 0, (x1-x0)h)
        const fx = -(z1 - z0), fz = x1 - x0; if (fx * nx + fz * nz > 0) { B.tri(a, b, c); B.tri(a, c, d); } else { B.tri(a, c, b); B.tri(a, d, c); } } });
  };
  // NYC rooftop furniture: a wooden water tank on legs and a stair bulkhead on a share of the taller roofs
  const inRing = (R, x, z) => { let c = false; for (let i = 0, j = R.length / 2 - 1; i < R.length / 2; j = i++) { const xi = R[2 * i], zi = R[2 * i + 1], xj = R[2 * j], zj = R[2 * j + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const tankL = pack(FAM.skin.base), tankS = pack(mix(FAM.skin.dark, FAM.violet.dark, 0.4)), tankT = pack(FAM.skin.lit), legC = pack(PAL.trunk);
  const bulkL = pack(mix(COL.wallLit, COL.roofs[0], 0.35)), bulkS = pack(COL.wallShade), bulkT = pack(COL.roofs[3]);
  const box3 = (x0, x1, y0, y1, z0, z1, cl, cs, ct, meta) => { const F = (P, n) => { const c = n[1] > 0 ? ct : (n[0] * sx + n[2] * sz > 0 ? cl : cs); B.poly(P, n, c, meta); };
    F([x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1]); F([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0], [0, 0, -1]);
    F([x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [-1, 0, 0]); F([x1, y0, z0, x1, y0, z1, x1, y1, z1, x1, y1, z0], [1, 0, 0]); F([x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1], [0, 1, 0]); };
  const roofTop = (p) => {
    const hq = hash32((p.bin | 0) + 77); if (hq > 0.5) return; const R = p.rings[0]; let cx = 0, cz = 0; const n = R.length / 2; for (let i = 0; i < n; i++) { cx += R[2 * i]; cz += R[2 * i + 1]; } cx /= n; cz /= n;
    if (!inRing(R, cx, cz)) return; const meta = META(0, p.blk), h = p.h, ox = (hash32((p.bin | 0) + 5) - 0.5) * 4, oz = (hash32((p.bin | 0) + 9) - 0.5) * 4;
    const tx = cx + ox, tz = cz + oz; if (!inRing(R, tx, tz)) return;
    if (hq < 0.3) { // water tank: legs, octagonal tub, conical lid
      box3(tx - 1.3, tx + 1.3, h, h + 1.5, tz - 1.3, tz + 1.3, legC, legC, legC, meta);
      const r = 1.7, y0 = h + 1.5, y1 = h + 4.5, K = 8;
      for (let k = 0; k < K; k++) { const a0 = 6.2832 * k / K, a1 = 6.2832 * (k + 1) / K, am = (a0 + a1) / 2, nx = Math.cos(am), nz = Math.sin(am);
        B.poly([tx + r * Math.cos(a0), y0, tz + r * Math.sin(a0), tx + r * Math.cos(a1), y0, tz + r * Math.sin(a1), tx + r * Math.cos(a1), y1, tz + r * Math.sin(a1), tx + r * Math.cos(a0), y1, tz + r * Math.sin(a0)], [nx, 0, nz], nx * sx + nz * sz > 0 ? tankL : tankS, meta);
        B.poly([tx + r * Math.cos(a0), y1, tz + r * Math.sin(a0), tx + r * Math.cos(a1), y1, tz + r * Math.sin(a1), tx, y1 + 1.1, tz], [nx, 1.5, nz], nx * sx + nz * sz > 0 ? tankL : tankT, meta); }
    }
    const bx = cx - ox * 0.8, bz = cz - oz * 0.8; if (inRing(R, bx - 1.6, bz - 1.8) && inRing(R, bx + 1.6, bz + 1.8) && Math.hypot(bx - tx, bz - tz) > 3.2) box3(bx - 1.6, bx + 1.6, h, h + 3.0, bz - 1.8, bz + 1.8, bulkL, bulkS, bulkT, meta);
  };
  for (const p of G.prisms) {
    if (p.kind === 1) { const hq = hash32((p.x * 37 + p.z * 11) | 0), roof = hq < 0.22 ? metG : p.h > 30 ? metRH : metR; prism(p, roof, metW, metS, META(2, -1), META(2, -1)); }
    else prism(p, roofCol[p.tint], wallL, wallS, META(0, p.blk), META(p.h > 9 ? 3 : 0, p.blk));
    if (p.kind === 0 && p.h > 18 && p.area > 260) roofTop(p);
  }
  // blocks: slab at the block's mean height, colour = area-weighted mix of roofs and ground
  const ground = TERRAIN.urban, roofAvg = mix(mix(COL.roofs[0], COL.roofs[1], 0.5), mix(COL.roofs[2], COL.roofs[3], 0.5), 0.5);
  for (let j = 0; j < G.nBlocksRaw; j++) {
    const ntri = tri[tp++], T = tri.subarray(tp, tp + 3 * ntri); tp += 3 * ntri;
    const bk = G.blockByJ[j]; if (!bk || bk.h <= 0.5 || bk.park > 0.5) continue;
    const R = bk.rings[0], n = R.length >> 1; B.tile('b' + Math.floor(bk.x / 1000) + ',' + Math.floor(bk.z / 1000));
    // data edge (manhattan.json is a ±15 km ENU square): within 4 km of it the blocks take on the terrain's urban colour, so the square never shows
    const ee = bk.x * SB + bk.z * CB, nn = bk.x * CB - bk.z * SB, edge = clamp01((15000 - Math.max(Math.abs(ee), Math.abs(nn))) / 4000);
    const cov = clamp01(bk.cov), E = (c) => pack(mix(ground, c, edge)), roofC = E(mix(ground, roofAvg, cov)), litC = E(mix(ground, COL.wallLit, Math.min(1, cov * 1.2))), shC = E(mix(ground, COL.wallShade, Math.min(1, cov * 1.2)));
    const meta = META(1, j);
    const sa = Math.sqrt(bk.area) * (bk.cov >= 0.05 ? 1 : -1), base = []; // negative: sparse block, not drawn once sub-pixel (the terrain is right there)
    for (let i = 0; i < n; i++) base.push(B.vert(R[2 * i], bk.h, R[2 * i + 1], roofC, meta, sa));
    const vx = (k) => B.cur.v[7 * k], vz = (k) => B.cur.v[7 * k + 2];
    for (let k = 0; k < ntri; k++) { const a = base[T[3 * k]], b = base[T[3 * k + 1]], c = base[T[3 * k + 2]]; if (a === undefined || b === undefined || c === undefined) continue;
      const cr = (vx(b) - vx(a)) * (vz(c) - vz(a)) - (vz(b) - vz(a)) * (vx(c) - vx(a)); cr < 0 ? B.tri(a, b, c) : B.tri(a, c, b); }
    const s = bk.sg;
    for (let i = 0; i < n; i++) { const jn = (i + 1) % n, x0 = R[2 * i], z0 = R[2 * i + 1], x1 = R[2 * jn], z1 = R[2 * jn + 1], nx = s * (z1 - z0), nz = -s * (x1 - x0);
      const col = nx * sx + nz * sz > 0 ? litC : shC;
      const a = B.vert(x0, 0, z0, col, meta, sa), b = B.vert(x1, 0, z1, col, meta, sa), c = B.vert(x1, bk.h, z1, col, meta, sa), d = B.vert(x0, bk.h, z0, col, meta, sa);
      const fx = -(z1 - z0), fz = x1 - x0; if (fx * nx + fz * nz > 0) { B.tri(a, b, c); B.tri(a, c, d); } else { B.tri(a, c, b); B.tri(a, d, c); } }
  }
  // the Met front (facade boxes, banners, steps, landing, cheek walls, fountains) + the Central Park wall
  B.tile('met');
  for (const f of G.metFaces) B.poly(f.p, f.n, pack(f.c), META(2, -1));
  const wallF = pack(COL.stone), wallT = pack(COL.stoneTop);
  for (const w of G.wall) { const n = w.length >> 1; B.tile('w' + Math.floor(w[0] / TS) + ',' + Math.floor(w[1] / TS));
    for (let i = 0; i < n - 1; i++) { const x0 = w[2 * i], z0 = w[2 * i + 1], x1 = w[2 * i + 2], z1 = w[2 * i + 3], l = Math.hypot(x1 - x0, z1 - z0) || 1, ox = -(z1 - z0) / l * 0.25, oz = (x1 - x0) / l * 0.25, H = 0.95;
      B.poly([x0 + ox, 0, z0 + oz, x1 + ox, 0, z1 + oz, x1 + ox, H, z1 + oz, x0 + ox, H, z0 + oz], [ox, 0, oz], wallF, META(2, -1));
      B.poly([x0 - ox, 0, z0 - oz, x1 - ox, 0, z1 - oz, x1 - ox, H, z1 - oz, x0 - ox, H, z0 - oz], [-ox, 0, -oz], wallF, META(2, -1));
      B.poly([x0 - ox, H, z0 - oz, x1 - ox, H, z1 - oz, x1 + ox, H, z1 + oz, x0 + ox, H, z0 + oz], [0, 1, 0], wallT, META(2, -1)); } }
  GL.geo = B.finish(gl);
  // ---- ground details (g = -1): drawn without depth test, layer by layer (park paths, sidewalks, plaza, median, roadbed, markings)
  const GB = new Builder(), gk = (L, x, z) => L + ':' + Math.floor(x / TS) + ',' + Math.floor(z / TS), A2 = META(2, -1);
  const pathC = pack(COL.path);
  for (const p of G.paths) { const L = p.line, n = L.length >> 1, w = 1.6;
    for (let i = 0; i < n - 1; i++) { const x0 = L[2 * i], z0 = L[2 * i + 1], x1 = L[2 * i + 2], z1 = L[2 * i + 3], l = Math.hypot(x1 - x0, z1 - z0); if (l < 0.01) continue;
      const ox = -(z1 - z0) / l * w, oz = (x1 - x0) / l * w, ex = (x1 - x0) / l * w * 0.6, ez = (z1 - z0) / l * w * 0.6; GB.tile(gk('a', x0, z0));
      GB.poly([x0 - ox - ex, 0, z0 - oz - ez, x1 - ox + ex, 0, z1 - oz + ez, x1 + ox + ex, 0, z1 + oz + ez, x0 + ox - ex, 0, z0 + oz - ez], [0, 1, 0], pathC, A2, 2); } }
  const mcol = [COL.walk, COL.plaza, COL.median, COL.road].map(pack);
  for (const m of [0, 1, 2, 3]) for (let i = 0; i < gnd.length; i += 9) { if (gnd[i + 2] !== m) continue; GB.tile(gk('m' + m, gnd[i], gnd[i + 1]));
    const a = GB.vert(gnd[i], 0, gnd[i + 1], mcol[m], A2, 0), b = GB.vert(gnd[i + 3], 0, gnd[i + 4], mcol[m], A2, 0), c = GB.vert(gnd[i + 6], 0, gnd[i + 7], mcol[m], A2, 0); GB.tri(a, b, c); }
  (marks || []).forEach((L, li) => { const col = pack(L.col); for (const q of L.quads) { GB.tile(gk('k' + li, q[0], q[2])); GB.poly(q, [0, 1, 0], col, A2, 3); } });
  GL.ground = GB.finish(gl);
  // ---- trees: instanced billboards, sorted into tiles
  // (night rework) drop the few real trees whose crowns the crane passes through (they popped in at the lens at z ~1.5)
  try { cameraAt(1, 0); } catch (e) { setPath(); } // keys are merged after load; the crane keys are central, so set them now
  const CP = []; for (let zz = 0.9; zz <= 2.7; zz += 0.01) { const c = cameraAt(zz, 0); CP.push(xform(c.pos, c.fr, 'street')); }
  const clear = (i) => { const x = G.tree.x[i], z = G.tree.z[i], r = G.tree.r[i], y = G.tree.h[i] - r * 0.95; return CP.every((p) => Math.hypot(p[0] - x, p[1] - y, p[2] - z) > r * 3 + 3); };
  const Tr = G.tree, order = [...Array(Tr.n).keys()].filter(clear).sort((a, b) => tkey(Tr, a) - tkey(Tr, b));
  const inst = new Float32Array(order.length * 5), ttiles = []; let last = null;
  order.forEach((i, k) => { const key = tkey(Tr, i); if (!last || last.key !== key) { last = { key, off: k, cnt: 0, bb: [1e9, 1e9, -1e9, -1e9], hmax: 0 }; ttiles.push(last); }
    last.cnt++; const x = Tr.x[i], z = Tr.z[i], r = Tr.r[i], h = Tr.h[i]; inst.set([x, h - r * 0.95, z, r, Tr.seed[i] % 1000], 5 * k);
    last.bb[0] = Math.min(last.bb[0], x - r); last.bb[2] = Math.max(last.bb[2], x + r); last.bb[1] = Math.min(last.bb[1], z - r); last.bb[3] = Math.max(last.bb[3], z + r); last.hmax = Math.max(last.hmax, h + r); });
  const tvao = gl.createVertexArray(); gl.bindVertexArray(tvao);
  const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.25, -1.05, 1.2, -1.05, 1.2, 1.15, -1.25, -1.05, 1.2, 1.15, -1.25, 1.15]), gl.STATIC_DRAW);
  const ql = gl.getAttribLocation(GL.tp, 'a_q'); gl.enableVertexAttribArray(ql); gl.vertexAttribPointer(ql, 2, gl.FLOAT, false, 8, 0);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
  GL.tl = ['a_c', 'a_r', 'a_seed'].map((n) => gl.getAttribLocation(GL.tp, n)); GL.tib = ib;
  GL.tl.forEach((l) => { gl.enableVertexAttribArray(l); gl.vertexAttribDivisor(l, 1); });
  gl.bindVertexArray(null); GL.tvao = tvao; GL.ttiles = ttiles;
  // ---- block state texture (1 = draw the block instead of its buildings)
  const nb = G.nBlocksRaw, th = Math.ceil(nb / 256); GL.bstate = new Uint8Array(256 * th); GL.bth = th;
  GL.btex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, GL.btex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 256, th, 0, gl.RED, gl.UNSIGNED_BYTE, GL.bstate);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  GL.u = {}; for (const P of [GL.p, GL.tp]) { const m = {}; const n = gl.getProgramParameter(P, gl.ACTIVE_UNIFORMS); for (let k = 0; k < n; k++) { const a = gl.getActiveUniform(P, k); m[a.name] = gl.getUniformLocation(P, a.name); } GL.u[P === GL.p ? 'g' : 't'] = m; }
  GL.ok = true;
}
const tkey = (Tr, i) => (Math.floor(Tr.x[i] / 200) + 64) * 1000 + (Math.floor(Tr.z[i] / 200) + 64);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// tile visibility for a depth slice: project the 8 corners of the tile box
function tileVis(C, bb, hmax, lo, hi) {
  let dmin = 1e18, dmax = -1e18, sxmin = 1e18, sxmax = -1e18, symin = 1e18, symax = -1e18, behind = false;
  for (let k = 0; k < 8; k++) { const x = k & 1 ? bb[2] : bb[0], z = k & 2 ? bb[3] : bb[1], y = k & 4 ? hmax : 0;
    const vx = x - C.px, vy = y - C.py, vz = z - C.pz, d = -(vx * C.b0 + vy * C.b1 + vz * C.b2); if (d < dmin) dmin = d; if (d > dmax) dmax = d;
    if (d <= 1e-3) { behind = true; continue; } const X = (vx * C.r0 + vy * C.r1 + vz * C.r2) / d, Y = (vx * C.u0 + vy * C.u1 + vz * C.u2) / d;
    if (X < sxmin) sxmin = X; if (X > sxmax) sxmax = X; if (Y < symin) symin = Y; if (Y > symax) symax = Y; }
  if (dmax < lo || dmin > hi) return false; if (behind) return true;
  const ax = C.w / 2 / C.f * 1.05, ay = C.h / 2 / C.f * 1.05; return !(sxmax < -ax || sxmin > ax || symax < -ay || symin > ay);
}

// render one depth slice into the GL canvas (what = 'geo' for standing things, 'ground' for ground details)
export function renderSlice(V, C, lo, hi, Ls, what = 'geo') {
  const gl = GL.gl, cv = GL.cv; if (cv.width !== V.w || cv.height !== V.h) { cv.width = V.w; cv.height = V.h; }
  gl.viewport(0, 0, V.w, V.h); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.disable(gl.BLEND);
  const set = (u) => { gl.uniform3f(u.u_cam, C.px, C.py, C.pz); gl.uniform3f(u.u_r, C.r0, C.r1, C.r2); gl.uniform3f(u.u_u, C.u0, C.u1, C.u2); gl.uniform3f(u.u_b, C.b0, C.b1, C.b2);
    gl.uniform1f(u.u_f, C.f); gl.uniform2f(u.u_wh, V.w, V.h); gl.uniform2f(u.u_nf, lo, hi); };
  gl.useProgram(GL.p); const ug = GL.u.g; set(ug); gl.uniform3fv(ug.u_winc, unrgb(COL.window)); gl.uniform3fv(ug.u_urban, unrgb(TERRAIN.urban)); gl.uniform3fv(ug.u_park, unrgb(TERRAIN.park)); gl.uniform3fv(ug.u_road, unrgb(COL.road));
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, GL.btex); gl.uniform1i(ug.u_bt, 0);
  let calls = 0;
  gl.uniform1f(ug.u_gm, what === 'ground' ? 14 * C.f / Math.max(1, V.D) : 1e9); // roadbed width in px (sets the sub-pixel size law)
  if (what === 'ground') { gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.bindVertexArray(GL.ground.vao);
    for (const t of GL.ground.tiles) { if (!tileVis(C, t.bb, 0.1, lo, hi)) continue; gl.drawElements(gl.TRIANGLES, t.cnt, gl.UNSIGNED_INT, t.off * 4); calls++; }
    gl.bindVertexArray(null); return calls; }
  gl.bindVertexArray(GL.geo.vao);
  for (const t of GL.geo.tiles) { if (!tileVis(C, t.bb, t.hmax, lo, hi)) continue; gl.drawElements(gl.TRIANGLES, t.cnt, gl.UNSIGNED_INT, t.off * 4); calls++; }
  // trees
  gl.disable(gl.CULL_FACE); gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
  gl.useProgram(GL.tp); const ut = GL.u.t; set(ut); gl.uniform2f(ut.u_L, Ls[0], Ls[1]);
  gl.uniform3fv(ut.u_dark, unrgb(COL.canopyDark)); gl.uniform3fv(ut.u_base, unrgb(COL.canopy)); gl.uniform3fv(ut.u_lit, unrgb(COL.canopyLit));
  gl.bindVertexArray(GL.tvao); gl.bindBuffer(gl.ARRAY_BUFFER, GL.tib);
  for (const t of GL.ttiles) { if (!tileVis(C, t.bb, t.hmax, lo, hi)) continue; const o = t.off * 20;
    gl.vertexAttribPointer(GL.tl[0], 3, gl.FLOAT, false, 20, o); gl.vertexAttribPointer(GL.tl[1], 1, gl.FLOAT, false, 20, o + 12); gl.vertexAttribPointer(GL.tl[2], 1, gl.FLOAT, false, 20, o + 16);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, t.cnt); calls++; }
  gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE); gl.bindVertexArray(null);
  return calls;
}
export function setBlockState(state) { const gl = GL.gl; GL.bstate.set(state.subarray(0, GL.bstate.length)); gl.bindTexture(gl.TEXTURE_2D, GL.btex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, GL.bth, gl.RED, gl.UNSIGNED_BYTE, GL.bstate); }

// does a depth slice contain anything (CPU tile test only; used to skip empty slices)
export function sliceHas(C, lo, hi, what) {
  if (what === 'ground') { for (const t of GL.ground.tiles) if (tileVis(C, t.bb, 0.1, lo, hi)) return true; return false; }
  for (const t of GL.geo.tiles) if (tileVis(C, t.bb, t.hmax, lo, hi)) return true;
  for (const t of GL.ttiles) if (tileVis(C, t.bb, t.hmax, lo, hi)) return true; return false;
}
