// Earth geometry kernel shared by every terrain / globe / cloud drawing (levels/earth*.js).
// One ellipsoid (WGS84), one projection path, one visibility rule:
//  * Sphere space: scaling ECEF z by K = a/b maps the ellipsoid onto a sphere of radius a. Affine maps keep tangency, so the
//    visible cap from the camera C is the half-space p·m >= d0 (m = n' with its z scaled by K), and the limb is a circle in
//    sphere space. Clipping, horizon, limb and terminator are all exact on the ellipsoid this way.
//  * Rings are culled by bounding sphere (frustum, cap, < 1 px size: things leave by geometry only), clipped to the visible
//    cap with the limb followed as an arc (Weiler-Atherton on a circle), then near/guard-band clipped and projected.
export const WA = 6378137, WB = 6356752.314245, K = WA / WB, DEG = Math.PI / 180;
const E2 = 1 - (WB * WB) / (WA * WA);
export function ecefInto(out, o, latDeg, lonDeg, h) {
  const la = latDeg * DEG, lo = lonDeg * DEG, s = Math.sin(la), c = Math.cos(la), N = WA / Math.sqrt(1 - E2 * s * s);
  out[o] = (N + h) * c * Math.cos(lo); out[o + 1] = (N + h) * c * Math.sin(lo); out[o + 2] = (N * (1 - E2) + h) * s;
}
export function ecef3(lat, lon, h = 0) { const o = [0, 0, 0]; ecefInto(o, 0, lat, lon, h); return o; }

// ---------- a layer: rings of ECEF points with bounding spheres ----------
// { P: Float32Array xyz RELATIVE to the ring's bounding-sphere centre (float32 is < 1 m even for a 6,000 km ring),
//   st: Int32Array ring starts (n+1), fl: Uint8Array (0 outer CCW, 1 hole CW), bs: Float64Array cx,cy,cz,r }
// decode one layer of assets/earth/terrain.bin (varint lens, flag bytes, zigzag varint delta lon/lat x 1e-7 deg)
export function decodeLayer(bytes, e, scale, h = 0) {
  let p = e.off; const n = e.n;
  const rd = () => { let v = 0, mul = 1, b; do { b = bytes[p++]; v += (b & 127) * mul; mul *= 128; } while (b & 128); return v; };
  const st = new Int32Array(n + 1); for (let i = 0; i < n; i++) st[i + 1] = st[i] + rd();
  const fl = bytes.slice(p, p + n); p += n;
  const np = st[n], A = new Float64Array(np * 3);
  for (let i = 0; i < n; i++) { let lon = 0, lat = 0;
    for (let k = st[i]; k < st[i + 1]; k++) { const zx = rd(), zy = rd(); const dx = zx % 2 ? -(zx + 1) / 2 : zx / 2, dy = zy % 2 ? -(zy + 1) / 2 : zy / 2;
      if (k === st[i]) { lon = dx; lat = dy; } else { lon += dx; lat += dy; }
      ecefInto(A, k * 3, lat * scale, lon * scale, h); } }
  return finishLayer(A, st, fl);
}
export function makeLayer(lens, flags, ll, scale, h = 0) {
  const n = lens.length, st = new Int32Array(n + 1); for (let i = 0; i < n; i++) st[i + 1] = st[i] + lens[i];
  const np = st[n], P = new Float64Array(np * 3);
  for (let i = 0; i < np; i++) ecefInto(P, i * 3, ll[i * 2 + 1] * scale, ll[i * 2] * scale, h);
  const fl = new Uint8Array(n); for (let i = 0; i < n; i++) fl[i] = flags[i];
  return finishLayer(P, st, fl);
}
// absolute Float64 ECEF in, relative Float32 out
export function finishLayer(A, st, fl) {
  const n = st.length - 1, bs = new Float64Array(n * 4), P = new Float32Array(A.length);
  for (let i = 0; i < n; i++) {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let k = st[i] * 3; k < st[i + 1] * 3; k += 3) { const x = A[k], y = A[k + 1], z = A[k + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2; let r = 0;
    for (let k = st[i] * 3; k < st[i + 1] * 3; k += 3) { const dx = A[k] - cx, dy = A[k + 1] - cy, dz = A[k + 2] - cz, d = dx * dx + dy * dy + dz * dz; if (d > r) r = d; P[k] = dx; P[k + 1] = dy; P[k + 2] = dz; }
    bs[i * 4] = cx; bs[i * 4 + 1] = cy; bs[i * 4 + 2] = cz; bs[i * 4 + 3] = Math.sqrt(r) * 1.000001 + 0.01;
  }
  return { P, st, fl, bs, n };
}

// ---------- per-frame camera / cap state ----------
// h = altitude of the surface being drawn (0 = ground, clouds > 0); the cap for a raised shell uses its own radius.
export function frameState(V, fr = 'earth') {
  const e = V.c(fr), C = e.p;
  const Cs = [C[0], C[1], C[2] * K], dC = Math.hypot(Cs[0], Cs[1], Cs[2]), n = [Cs[0] / dC, Cs[1] / dC, Cs[2] / dC];
  const pick = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let u = [pick[1] * n[2] - pick[2] * n[1], pick[2] * n[0] - pick[0] * n[2], pick[0] * n[1] - pick[1] * n[0]]; const ul = Math.hypot(u[0], u[1], u[2]); u = [u[0] / ul, u[1] / ul, u[2] / ul];
  const w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const tx = V.w / 2 / V.f, ty = V.h / 2 / V.f;
  const S = { V, e, C, Cs, dC, n, u, w, f: V.f, cx: V.cx, cy: V.cy, tx, ty, nx: 1 / Math.hypot(1, tx), ny: 1 / Math.hypot(1, ty),
    alt: dC - WA, // approximate altitude (sphere space)
    near: 0, guard: 3, caps: new Map() };
  S.near = Math.max(V.near, Math.min(S.alt * 0.02, V.D * 0.05));
  return S;
}
// visible cap of the shell at altitude h: p·m >= d0 (ECEF), plus the limb circle in sphere space
export function cap(S, h = 0) {
  let c = S.caps.get(h); if (c) return c;
  const rho = WA + h, a = Math.acos(Math.min(1, WA / S.dC)) + (h > 0 ? Math.acos(WA / rho) : 0);
  const d0 = rho * Math.cos(Math.min(a, Math.PI)), m = [S.n[0], S.n[1], S.n[2] * K];
  c = { h, rho, d0, m, mlen: Math.hypot(m[0], m[1], m[2]), lr: Math.sqrt(Math.max(0, rho * rho - d0 * d0)), ang: a, inside: S.dC < rho };
  S.caps.set(h, c); return c;
}

// ---------- the drawing path builder ----------
// Scratch buffers (typed, reused every frame: no per-vertex allocation on the hot path)
let CS = new Float64Array(3 << 16), CS2 = new Float64Array(3 << 16), SD = new Float64Array(1 << 16), LB = new Float64Array(3 << 16);
function need(n) { if (CS.length < 3 * n + 30) { const m = 3 * n * 2 + 30; CS = new Float64Array(m); CS2 = new Float64Array(m); } if (SD.length < n + 10) SD = new Float64Array(2 * n + 10); }
let lbn = 0; function lbPush(x, y, z) { if (LB.length < 3 * lbn + 3) { const nb = new Float64Array(LB.length * 2); nb.set(LB); LB = nb; } LB[3 * lbn] = x; LB[3 * lbn + 1] = y; LB[3 * lbn + 2] = z; lbn++; }
// clip a camera-space polygon (src, n points) by the plane a·x + b·y + c·d + k >= 0 into dst; returns the new count
function clipTA(src, n, dst, A, B, Cc, Kk) {
  let m = 0; if (!n) return 0; let i0 = 3 * (n - 1), va = A * src[i0] + B * src[i0 + 1] + Cc * src[i0 + 2] + Kk;
  for (let i = 0; i < n; i++) {
    const j = 3 * i, vb = A * src[j] + B * src[j + 1] + Cc * src[j + 2] + Kk;
    if (3 * m + 6 > dst.length) return m;
    if ((va >= 0) !== (vb >= 0)) { const t = va / (va - vb); dst[3 * m] = src[i0] + (src[j] - src[i0]) * t; dst[3 * m + 1] = src[i0 + 1] + (src[j + 1] - src[i0 + 1]) * t; dst[3 * m + 2] = src[i0 + 2] + (src[j + 2] - src[i0 + 2]) * t; m++; }
    if (vb >= 0) { dst[3 * m] = src[j]; dst[3 * m + 1] = src[j + 1]; dst[3 * m + 2] = src[j + 2]; m++; }
    i0 = j; va = vb;
  }
  return m;
}
// A Path builder that knows the camera; add rings from layers (fast path) or loose ECEF point lists.
export class Builder {
  constructor(S, h = 0, minPx = 1) { this.S = S; this.c = cap(S, h); this.minPx = minPx; this.path = new Path2D(); this.count = 0; this.rings = 0; }
  // add every visible ring of a layer
  layer(L) {
    if (!L) return this;
    const S = this.S, e = S.e, C = S.C, r = e.r, u = e.u, b = e.b, f = S.f, c = this.c, m = c.m, d0 = c.d0, ml = c.mlen;
    const tx = S.tx, ty = S.ty, nx = S.nx, ny = S.ny, G = S.guard, near = S.near, minPx = this.minPx, bs = L.bs;
    for (let i = 0; i < L.n; i++) {
      const q = i * 4, X = bs[q] - C[0], Y = bs[q + 1] - C[1], Z = bs[q + 2] - C[2], R = bs[q + 3];
      const x = X * r[0] + Y * r[1] + Z * r[2], y = X * u[0] + Y * u[1] + Z * u[2], d = -(X * b[0] + Y * b[1] + Z * b[2]);
      if (d + R < near) continue;                                                   // behind the camera
      if ((x - d * tx) * nx > R || (-x - d * tx) * nx > R || (y - d * ty) * ny > R || (-y - d * ty) * ny > R) continue; // off screen
      if (d - R > near && 2 * R * f / (d - R) < minPx) continue;                    // smaller than a pixel: gone by size
      const sd = (bs[q] * m[0] + bs[q + 1] * m[1] + bs[q + 2] * m[2] - d0) / ml;     // signed distance to the cap plane
      if (sd < -R) continue;                                                        // beyond the horizon / limb
      const inGuard = d - R > near && (x - d * tx * G) * nx < -R && (-x - d * tx * G) * nx < -R && (y - d * ty * G) * ny < -R && (-y - d * ty * G) * ny < -R;
      if (sd > R && inGuard) this.fast(L.P, L.st[i], L.st[i + 1], X, Y, Z);
      else this.ring(L.P, L.st[i], L.st[i + 1], sd <= R, L.fl[i] ? -1 : 1, bs[q], bs[q + 1], bs[q + 2]);
    }
    return this;
  }
  // P relative to the ring centre; (c0,c1,c2) = centre - camera
  fast(P, a, b, c0, c1, c2) {
    const S = this.S, r = S.e.r, u = S.e.u, bb = S.e.b, f = S.f, cx = S.cx, cy = S.cy, path = this.path;
    const r0 = r[0], r1 = r[1], r2 = r[2], u0 = u[0], u1 = u[1], u2 = u[2], b0 = bb[0], b1 = bb[1], b2 = bb[2];
    let lx = 0, ly = 0, n = 0; const kEnd = b * 3 - 3;
    for (let k = a * 3; k <= kEnd; k += 3) {
      const X = P[k] + c0, Y = P[k + 1] + c1, Z = P[k + 2] + c2, s = -f / (X * b0 + Y * b1 + Z * b2);
      const sx = cx + (X * r0 + Y * r1 + Z * r2) * s, sy = cy - (X * u0 + Y * u1 + Z * u2) * s;
      if (!n) { path.moveTo(sx, sy); lx = sx; ly = sy; n++; }
      else if (Math.abs(sx - lx) + Math.abs(sy - ly) > 0.35 || k === kEnd) { path.lineTo(sx, sy); lx = sx; ly = sy; n++; }
    }
    if (n) { this.count += n; this.rings++; } // no closePath: fills close implicitly, and closePath costs ~60 µs per contour in Chrome
  }
  // one ring (typed source, points a..b-1): cap clip if needed (Weiler-Atherton with limb arcs), then emit
  ring(P, a, b, needCap, sgn, ox = 0, oy = 0, oz = 0) {
    const n = b - a; need(n);
    if (needCap) {
      const c = this.c, m = c.m, d0 = c.d0 - (ox * m[0] + oy * m[1] + oz * m[2]); let nin = 0;
      for (let i = 0; i < n; i++) { const k = 3 * (a + i), v = P[k] * m[0] + P[k + 1] * m[1] + P[k + 2] * m[2] - d0; SD[i] = v; if (v >= 0) nin++; }
      if (nin === n) needCap = false;
      else if (nin === 0) { // may enclose the whole cap: winding of the ring around the cap axis
        const S = this.S; let wind = 0, prev = capAngleXYZ(S, c, P[3 * (b - 1)] + ox, P[3 * (b - 1) + 1] + oy, P[3 * (b - 1) + 2] + oz);
        for (let i = 0; i < n; i++) { const k = 3 * (a + i), an = capAngleXYZ(S, c, P[k] + ox, P[k + 1] + oy, P[k + 2] + oz); let d = an - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; wind += d; prev = an; }
        if (Math.round(wind / (2 * Math.PI)) * sgn > 0) { lbn = 0; limbInto(S, c); this.emit(LB, 0, lbn); }
        return;
      } else { this.wa(P, a, n, sgn, ox, oy, oz); return; }
    }
    this.emit(P, 3 * a, n, ox, oy, oz);
  }
  wa(P, a, n, sgn, ox, oy, oz) {
    const S = this.S, c = this.c, runs = [];
    let s0 = 0; while (!(SD[s0] >= 0 && SD[(s0 + n - 1) % n] < 0)) s0++;
    let cur = null;
    for (let j = 0; j < n; j++) {
      const i = (s0 + j) % n, ip = (i + n - 1) % n, ka = 3 * (a + ip), kb = 3 * (a + i);
      if (SD[i] >= 0) {
        if (SD[ip] < 0) { const t = SD[ip] / (SD[ip] - SD[i]); const ex = ox + P[ka] + (P[kb] - P[ka]) * t, ey = oy + P[ka + 1] + (P[kb + 1] - P[ka + 1]) * t, ez = oz + P[ka + 2] + (P[kb + 2] - P[ka + 2]) * t;
          cur = { e: [ex, ey, ez], i0: i, cnt: 0, a0: capAngleXYZ(S, c, ex, ey, ez) }; runs.push(cur); }
        cur.cnt++;
      } else if (SD[ip] >= 0) { const t = SD[ip] / (SD[ip] - SD[i]); const xx = ox + P[ka] + (P[kb] - P[ka]) * t, xy = oy + P[ka + 1] + (P[kb + 1] - P[ka + 1]) * t, xz = oz + P[ka + 2] + (P[kb + 2] - P[ka + 2]) * t;
        cur.x = [xx, xy, xz]; cur.a1 = capAngleXYZ(S, c, xx, xy, xz); cur = null; }
    }
    const TP = 2 * Math.PI, fwd = (from, to) => { let d = sgn > 0 ? to - from : from - to; d %= TP; if (d < 0) d += TP; return d; };
    const done = new Uint8Array(runs.length);
    for (let s = 0; s < runs.length; s++) {
      if (done[s]) continue; lbn = 0; let r = s, guard = 0;
      while (!done[r] && guard++ <= runs.length) {
        done[r] = 1; const R = runs[r];
        lbPush(R.e[0], R.e[1], R.e[2]);
        for (let q = 0; q < R.cnt; q++) { const k = 3 * (a + (R.i0 + q) % n); lbPush(P[k] + ox, P[k + 1] + oy, P[k + 2] + oz); }
        lbPush(R.x[0], R.x[1], R.x[2]);
        let best = -1, bd = Infinity; for (let k = 0; k < runs.length; k++) { const d = fwd(R.a1, runs[k].a0); if (d < bd) { bd = d; best = k; } }
        arcInto(S, c, R.a1, runs[best].a0, sgn > 0 ? 1 : -1);
        r = best;
      }
      if (lbn >= 3) { const cp = LB.slice(0, 3 * lbn); this.emit(cp, 0, lbn); }
    }
  }
  // emit a closed ECEF polygon from a typed source: camera transform, near/guard clip only if needed, project, add to the path
  emit(src, off, n, ox = 0, oy = 0, oz = 0) {
    if (n < 3) return; need(n * 4 + 16);
    const S = this.S, e = S.e, C = S.C, r = e.r, u = e.u, b = e.b, near = S.near, tx = S.tx * S.guard, ty = S.ty * S.guard;
    const qx = ox - C[0], qy = oy - C[1], qz = oz - C[2];
    let all = true;
    for (let i = 0; i < n; i++) {
      const k = off + 3 * i, X = src[k] + qx, Y = src[k + 1] + qy, Z = src[k + 2] + qz;
      const x = X * r[0] + Y * r[1] + Z * r[2], y = X * u[0] + Y * u[1] + Z * u[2], d = -(X * b[0] + Y * b[1] + Z * b[2]);
      CS[3 * i] = x; CS[3 * i + 1] = y; CS[3 * i + 2] = d;
      if (all && (d < near || x > d * tx || -x > d * tx || y > d * ty || -y > d * ty)) all = false;
    }
    let A = CS, B = CS2, m = n;
    if (!all) {
      m = clipTA(A, m, B, 0, 0, 1, -near); [A, B] = [B, A];
      m = clipTA(A, m, B, -1, 0, tx, 0); [A, B] = [B, A];
      m = clipTA(A, m, B, 1, 0, tx, 0); [A, B] = [B, A];
      m = clipTA(A, m, B, 0, -1, ty, 0); [A, B] = [B, A];
      m = clipTA(A, m, B, 0, 1, ty, 0); [A, B] = [B, A];
      if (m < 3) return;
    }
    const f = S.f, cx = S.cx, cy = S.cy, path = this.path; let lx = 0, ly = 0, cnt = 0;
    for (let i = 0; i < m; i++) { const s = f / A[3 * i + 2], sx = cx + A[3 * i] * s, sy = cy - A[3 * i + 1] * s;
      if (!cnt) { path.moveTo(sx, sy); lx = sx; ly = sy; cnt++; } else if (Math.abs(sx - lx) + Math.abs(sy - ly) > 0.35 || i === m - 1) { path.lineTo(sx, sy); lx = sx; ly = sy; cnt++; } }
    this.count += cnt; this.rings++;
  }
  // add one closed loop given as an array of ECEF points
  loop(pts) { const n = pts.length; if (n < 3) return; const t = new Float64Array(3 * n); for (let i = 0; i < n; i++) { t[3 * i] = pts[i][0]; t[3 * i + 1] = pts[i][1]; t[3 * i + 2] = pts[i][2]; } this.emit(t, 0, n); }
  // a ring given as an array of ECEF points, clipped to the cap
  capLoop(pts, sgn = 1) { const n = pts.length; const t = new Float64Array(3 * n); for (let i = 0; i < n; i++) { t[3 * i] = pts[i][0]; t[3 * i + 1] = pts[i][1]; t[3 * i + 2] = pts[i][2]; } this.ring(t, 0, n, true, sgn); }
}
function capAngleXYZ(S, c, px, py, pz) { const x = px - S.n[0] * c.d0, y = py - S.n[1] * c.d0, z = pz * K - S.n[2] * c.d0; return Math.atan2(x * S.w[0] + y * S.w[1] + z * S.w[2], x * S.u[0] + y * S.u[1] + z * S.u[2]); }
function arcInto(S, c, t0, t1, dir) {
  let span = dir > 0 ? t1 - t0 : t0 - t1; span %= 2 * Math.PI; if (span < 0) span += 2 * Math.PI;
  const st = arcStep(S, c), n = Math.min(4000, Math.ceil(span / st));
  for (let k = 1; k < n; k++) { const p = capPoint(S, c, t0 + dir * span * k / n); lbPush(p[0], p[1], p[2]); }
}
function limbInto(S, c) { const st = arcStep(S, c), n = Math.min(4000, Math.ceil(2 * Math.PI / st)); for (let k = 0; k < n; k++) { const p = capPoint(S, c, 2 * Math.PI * k / n); lbPush(p[0], p[1], p[2]); } }
// angle of an ECEF point around the cap axis (sphere space)
function capAngle(S, c, p) { const x = p[0] - S.n[0] * c.d0, y = p[1] - S.n[1] * c.d0, z = p[2] * K - S.n[2] * c.d0; return Math.atan2(x * S.w[0] + y * S.w[1] + z * S.w[2], x * S.u[0] + y * S.u[1] + z * S.u[2]); }
function capPoint(S, c, th) { const co = Math.cos(th) * c.lr, si = Math.sin(th) * c.lr; return [S.n[0] * c.d0 + S.u[0] * co + S.w[0] * si, S.n[1] * c.d0 + S.u[1] * co + S.w[1] * si, (S.n[2] * c.d0 + S.u[2] * co + S.w[2] * si) / K]; }
// arc step (radians) so the limb chord error stays under ~0.25 px
export function arcStep(S, c) { const rpx = S.f * c.lr / Math.max(1, S.dC - c.d0); return Math.max(0.0015, Math.min(0.2, 2 * Math.sqrt(0.5 / Math.max(rpx, 1)))); }
// the full limb (horizon) circle as an ECEF loop
export function limbLoop(S, c) { const out = [], st = arcStep(S, c), n = Math.min(4000, Math.ceil(2 * Math.PI / st)); for (let k = 0; k < n; k++) out.push(capPoint(S, c, 2 * Math.PI * k / n)); return out; }

// ray from the camera through screen point (sx, sy) -> first hit on the shell at altitude h (sphere space), or null
export function rayHit(S, sx, sy, h = 0) {
  const e = S.e, x = (sx - S.cx) / S.f, y = -(sy - S.cy) / S.f;
  const D = [e.r[0] * x + e.u[0] * y - e.b[0], e.r[1] * x + e.u[1] * y - e.b[1], e.r[2] * x + e.u[2] * y - e.b[2]];
  const Ds = [D[0], D[1], D[2] * K], O = S.Cs, rho = WA + h;
  const A = Ds[0] * Ds[0] + Ds[1] * Ds[1] + Ds[2] * Ds[2], B = 2 * (O[0] * Ds[0] + O[1] * Ds[1] + O[2] * Ds[2]), Cc = O[0] * O[0] + O[1] * O[1] + O[2] * O[2] - rho * rho;
  const disc = B * B - 4 * A * Cc; if (disc < 0) return null;
  const sq = Math.sqrt(disc); let t = (-B - sq) / (2 * A); if (t <= 0) t = (-B + sq) / (2 * A); if (t <= 0) return null;
  // depth along the view axis: D·(-b) = 1 per unit t by construction
  return { p: [S.C[0] + D[0] * t, S.C[1] + D[1] * t, S.C[2] + D[2] * t], depth: t };
}
