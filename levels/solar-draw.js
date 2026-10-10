// SOLAR drawing helpers (screen space). Owner: SOLAR agent.
// Kurzgesagt look: stacked flat fills, a real terminator from the real Sun, detail that exists only above ~0.5 px.
import { PAL, rgba, mix, glow, rng, clamp } from '../core/kit.js';
import { look as starLook, sunDelta } from '../shared/star.js';
import { bandGlow, crescentFill } from './space-kit.js';
import { L as LIGHT } from '../core/kit.js';
import { FAM } from '../core/look.js';

const TAU = Math.PI * 2;

// ---------- lit sphere (Moon, planets) ----------
// s = direction to the Sun in camera coords [right, up, toward-camera]; returns the night-side path (disc minus lit part)
// in a frame rotated so that the projected Sun direction is +x. Lit set: x > -k·sqrt(r²-y²), k = s·toward-camera.
function nightPath(r, k, n = 28) {
  const P = new Path2D();
  // anti-sun semicircle (top -> left -> bottom), then the terminator back up (x = -k r cos t)
  P.moveTo(0, -r);
  for (let i = 1; i <= n; i++) { const a = -Math.PI / 2 - Math.PI * i / n; P.lineTo(r * Math.cos(a), r * Math.sin(a)); }
  for (let i = 1; i < n; i++) { const t = Math.PI / 2 - Math.PI * i / n; P.lineTo(-k * r * Math.cos(t), r * Math.sin(t)); }
  P.closePath(); return P;
}
const unit = (() => { const p = new Path2D(); p.arc(0, 0, 1, 0, TAU); return p; })();

// Planet / moon looks. bands: [fraction from south pole, colour] stacked; spots: [lat, lon, size, colour]
export const LOOKS = {
  moon: { base: mix('#ffffff', FAM.violet.glow, 0.45), night: mix(FAM.violet.base, FAM.violet.dark, 0.3), halo: FAM.violet.glow, rim: mix(PAL.cloudShade, '#ffffff', 0.35),
    craters: (() => { const r = rng(4242), a = []; for (let i = 0; i < 26; i++) { const lat = Math.asin(r() * 2 - 1), lon = r() * TAU; a.push([lat, lon, 0.05 + Math.pow(r(), 2.2) * 0.2, i < 6 ? 1 : 0]); } return a; })(),
    maria: mix(PAL.roofShade, PAL.walk, 0.4), crater: mix(PAL.roofShade, PAL.cloudShade, 0.2), craterLit: mix(PAL.roof, '#ffffff', 0.35) },
  mercury: { base: mix(PAL.walk, PAL.desert, 0.3), night: mix(PAL.ground, PAL.space, 0.35), bands: [], craters: [[0.3, 0.5, 0.18, 0], [-0.4, 2.0, 0.22, 0], [0.7, 3.5, 0.12, 0], [-0.1, 4.6, 0.15, 0]], crater: mix(PAL.walk, PAL.ground, 0.35) },
  venus: { base: PAL.desert, night: mix(PAL.ground, PAL.space, 0.3), bands: [[0.3, mix(PAL.desert, PAL.dust, 0.5)], [0.55, PAL.desert], [0.72, mix(PAL.desert, PAL.dust, 0.35)]] },
  mars: { base: PAL.neuSpike, night: mix(PAL.ground, PAL.space, 0.3), bands: [[0.08, PAL.ice], [0.14, PAL.neuSpike], [0.42, PAL.coatShade], [0.55, PAL.neuSpike], [0.93, PAL.ice]] },
  jupiter: { base: PAL.galArm, night: mix(PAL.ground, PAL.space, 0.25), bands: [[0.12, PAL.desert], [0.22, PAL.coat], [0.34, PAL.dust], [0.44, PAL.galArm], [0.53, PAL.dust], [0.64, PAL.coat], [0.76, PAL.desert], [0.88, PAL.galArm]], spot: [-0.38, PAL.galArm2] },
  saturn: { base: PAL.desert, night: mix(PAL.ground, PAL.space, 0.25), bands: [[0.18, PAL.taxi], [0.34, PAL.dust], [0.5, PAL.desert], [0.66, PAL.dust], [0.82, PAL.taxiShade]], ring: [1.24, 2.27, mix(PAL.dust, PAL.desert, 0.3)] },
  uranus: { base: PAL.starCyan, night: mix(PAL.ground, PAL.space, 0.25), bands: [[0.45, mix(PAL.starCyan, '#ffffff', 0.25)], [0.6, PAL.starCyan]] },
  neptune: { base: PAL.ocean, night: mix(PAL.ground, PAL.space, 0.25), bands: [[0.3, PAL.oceanNight], [0.42, PAL.ocean], [0.6, PAL.nucLit], [0.68, PAL.ocean]] },
};

// Lit-dot size law for reflected-light bodies: true radius when resolved; below minPx the dot keeps minPx and dims
// (gentler than kit.pointLaw so sub-pixel planets stay findable, but still vanish by geometry as they recede).
export function bodyLaw(px, minPx = 1.1) { if (px >= minPx) return [px, 1]; return [minPx, clamp(Math.pow(px / minPx, 0.42), 0, 1)]; }

// PRESENCE law (honest enlargement, fix round 1): a body is drawn no smaller than p0 px while the camera is within
// k × its orbit size `a`; beyond that the enlargement shrinks smoothly (log-linear) to nothing at 10 k a, and the
// true-size law above takes over. It depends only on the camera's real distance d, so nothing pops.
export function presence(d, a, p0, k = 6) { const x = Math.log10(d / (k * a)); return p0 * clamp(1 - x, 0, 1); }

// Draw a lit sphere at (x, y), true radius rpx, sun direction s (camera coords), pole direction pol (camera coords, optional)
export function drawBody(c, x, y, rpx, s, look, pol, pres = 0, t = 0) {
  const [r, a] = bodyLaw(Math.max(rpx, pres));
  rpx = Math.max(rpx, pres);
  if (a < 0.015) return;
  const th = Math.atan2(-s[1], s[0]); // screen angle of the projected sun direction (screen y down)
  const k = clamp(s[2], -1, 1);
  if (rpx < 1.1) { // unresolved: one dot, the lit-fraction-weighted colour
    const lit = (1 + k) / 2; c.fillStyle = rgba(mix(look.night, look.base, 0.25 + 0.75 * lit), a);
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); return;
  }
  // soft halo (fix round 1: planets carry a faint glow of their own colour so they read as bodies on the navy)
  if (r >= 1.5) bandGlow(c, x, y, r * 2.7, look.halo || look.base, 0.42, 3); // the same banded halo as a nucleus / inflamed cell
  c.save(); c.translate(x, y);
  // rings behind (Saturn): far half of the ring ellipse
  const ringSpec = look.ring && pol ? ringGeom(pol, r, look.ring) : null;
  if (ringSpec && ringSpec.px > 0.6) drawRing(c, ringSpec, look.ring[2], true);
  c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
  c.fillStyle = look.base; c.fillRect(-r, -r, 2 * r, 2 * r);
  // bands, oriented to the projected pole
  if (look.bands && look.bands.length && r > 1.6) {
    const pa = pol ? Math.atan2(-pol[1], pol[0]) : -Math.PI / 2, tilt = pol ? Math.sqrt(Math.max(0.05, 1 - pol[2] * pol[2])) : 1;
    c.save(); c.rotate(pa + Math.PI / 2); // now -y = north
    for (const [f, col] of look.bands) {
      const y0 = (1 - 2 * f + 0.03 * Math.sin(t * 0.4 + f * 9)) * r * tilt; c.fillStyle = col; // fill everything north of the boundary
      c.beginPath(); c.moveTo(-r * 1.1, y0); c.quadraticCurveTo(0, y0 + r * 0.18 * (pol ? Math.sign(pol[2] || 1) : 1), r * 1.1, y0); c.lineTo(r * 1.1, -r * 1.1); c.lineTo(-r * 1.1, -r * 1.1); c.closePath(); c.fill();
    }
    if (look.spot && r > 4) { c.fillStyle = look.spot[1]; c.beginPath(); c.ellipse(r * 0.25, -look.spot[0] * r * tilt, r * 0.16, r * 0.09, 0, 0, TAU); c.fill(); }
    c.restore();
  }
  // craters (Moon, Mercury): foreshortened discs on the visible hemisphere
  if (look.craters && r > 2.2) {
    for (const [lat, lon, sz, mare] of look.craters) {
      const cx = Math.cos(lat) * Math.sin(lon), cy = Math.sin(lat), cz = Math.cos(lat) * Math.cos(lon);
      if (cz < 0.08) continue; const rr = sz * r; if (rr < 0.45) continue;
      const ang = Math.atan2(cy, cx);
      c.fillStyle = mare && look.maria ? look.maria : look.crater;
      c.beginPath(); c.ellipse(cx * r, -cy * r, rr * cz, rr, ang, 0, TAU); c.fill();
      if (!mare && look.craterLit && rr > 1.2) { c.fillStyle = look.craterLit; c.beginPath(); c.ellipse(cx * r - Math.cos(th) * rr * 0.25 * cz, -cy * r - Math.sin(th) * rr * 0.25, rr * cz * 0.72, rr * 0.72, ang, 0, TAU); c.fill(); c.fillStyle = look.crater; c.beginPath(); c.ellipse(cx * r + Math.cos(th) * rr * 0.12 * cz, -cy * r + Math.sin(th) * rr * 0.12, rr * cz * 0.62, rr * 0.62, ang, 0, TAU); c.fill(); }
    }
  }
  // night side: flat dark violet shape (Kurzgesagt: the dark half is a flat colour, not black)
  c.rotate(th); c.fillStyle = look.night; c.fill(nightPath(r * 1.02, k));
  // stacked fills toward the Sun (no strokes): a lit crescent band on the Sun-facing limb and a flat highlight ellipse,
  // the same recipe as a nucleus (base, dark crescent = the night side, light crescent, highlight)
  if (r >= 1.6) { c.save(); c.scale(r, r); crescentFill(c, look.rim || mix(look.base, '#ffffff', 0.35), -0.13, 0); c.restore(); }
  if (r > 3 && k > -0.7) { c.globalAlpha = 0.5 * clamp((k + 0.7) / 0.9, 0, 1); c.fillStyle = mix(look.base, '#ffffff', 0.6); c.beginPath(); c.ellipse(r * (0.42 + 0.2 * (1 - Math.max(k, 0))), 0, r * 0.11, r * 0.26, 0, 0, TAU); c.fill(); c.globalAlpha = 1; }
  c.restore();
  if (ringSpec && ringSpec.px > 0.6) drawRing(c, ringSpec, look.ring[2], false);
  c.restore();
  if (a < 1) { /* unreachable: resolved bodies are opaque */ }
}
function ringGeom(pol, r, ring) { const pa = Math.atan2(-pol[1], pol[0]); return { pa, open: Math.abs(pol[2]), ri: ring[0] * r, ro: ring[1] * r, px: (ring[1] - ring[0]) * r }; }
function drawRing(c, g, col, back) {
  c.save(); c.rotate(g.pa + Math.PI / 2); // ring major axis along x
  c.beginPath(); if (back) { c.rect(-g.ro * 1.1, -g.ro, g.ro * 2.2, g.ro); } else { c.rect(-g.ro * 1.1, 0, g.ro * 2.2, g.ro); } c.clip();
  const p = new Path2D(); p.ellipse(0, 0, g.ro, g.ro * g.open + 0.3, 0, 0, TAU); p.ellipse(0, 0, g.ri, g.ri * g.open, 0, 0, TAU);
  c.fillStyle = rgba(col, 0.85); c.fill(p, 'evenodd'); c.restore();
}

// ---------- the Sun ----------
// Spots (on the visible hemisphere, slowly rotating), flare crescents round the limb, speckles: fixed seeds.
const R0 = rng(777);
const SPOTS = []; for (let i = 0; i < 13; i++) SPOTS.push({ lat: (R0() - 0.5) * 1.5, lon: R0() * TAU, s: 0.05 + Math.pow(R0(), 1.8) * 0.15 });
const FLARES = []; for (let i = 0; i < 70; i++) FLARES.push({ a: i / 70 * TAU + (R0() - 0.5) * 0.06, s: 0.022 + R0() * 0.03, h: R0() * 0.025, hi: R0() < 0.55 });
const SPECK = []; for (let i = 0; i < 90; i++) { const rr = Math.sqrt(R0()) * 0.9, a = R0() * TAU; SPECK.push([rr * Math.cos(a), rr * Math.sin(a), 0.006 + R0() * 0.01]); }
const RAYS = []; for (let i = 0; i < 16; i++) RAYS.push({ a: i / 16 * TAU + (R0() - 0.5) * 0.25, w: 0.05 + R0() * 0.06, l: 1.9 + R0() * 0.9 });

// ONE Sun look at every size (fix round 1). Sizes follow the shared star law (shared/star.js look(sunDelta)): core radius,
// glow radius and cross-flare length are the same numbers every other star uses, but the Sun is always WARM (yellow disc,
// orange-gold corona, gold flare). The disc is drawn at max(true radius, presence, star core). The flare only grows in as
// the disc shrinks toward a point (it scales with the disc's apparent size, never with zoom directly).
export function drawSun(c, x, y, Rtrue, Rpres, z, d2, t, s) {
  // space v3: the Sun keeps a minimum star brightness while it is the centred subject among its neighbours (z 16–19.4),
  // easing back to the true exposure law before the solar level ends at 19.5
  const zw = Math.min(1, Math.max(0, (19.45 - z) / 0.5)), sd = Math.max(sunDelta(z, d2), 3.6 * zw * zw * (3 - 2 * zw) * (z > 15 ? 1 : 0));
  const L = starLook(sd, s), R = Math.max(Rtrue, Rpres, L.r);
  const pulse = 1 + 0.04 * Math.sin(t * 1.3);
  // corona: one wide warm halo (star glow law) + the banded glow of the inflamed cells (sick-virus/03)
  glow(c, x, y, Math.max(R * 10, L.gr * 1.6) * pulse, PAL.sunRim, 0.2);
  bandGlow(c, x, y, Math.max(R * 3.4, L.gr * 0.9) * pulse, PAL.sun, 0.95, 4);
  bandGlow(c, x, y, R * 1.7, PAL.sunHi, 0.7, 2);
  // gold cross flare (star law length), fading in as the disc becomes small: factor 0 at R ≥ 9 px·s, 1 at R ≤ 3 px·s
  // (fix round 2) the cross appears only far out, where the Sun is already a star (apparent-magnitude law, not size)
  const ff = clamp((10 - sd) / 3, 0, 1) * L.fa;
  if (ff > 0.01 && L.fl > R) {
    c.save(); c.fillStyle = rgba(mix(PAL.sun, PAL.sunRim, 0.25), 0.8 * ff);
    const fl = L.fl * 0.75, w = Math.max(0.8, R * 0.35);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      c.beginPath(); c.moveTo(x - sa * w, y + ca * w); c.quadraticCurveTo(x + ca * fl * 0.16 - sa * w * 0.3, y + sa * fl * 0.16 + ca * w * 0.3, x + ca * fl, y + sa * fl);
      c.quadraticCurveTo(x + ca * fl * 0.16 + sa * w * 0.3, y + sa * fl * 0.16 - ca * w * 0.3, x + sa * w, y - ca * w); c.closePath(); c.fill(); }
    c.restore();
  }
  if (R > 4) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = rgba(PAL.sunHi, 0.06);
    for (const ry of RAYS) { const a = ry.a + t * 0.01; c.beginPath(); c.moveTo(x + Math.cos(a - ry.w) * R, y + Math.sin(a - ry.w) * R); c.lineTo(x + Math.cos(a) * R * ry.l * 1.6, y + Math.sin(a) * R * ry.l * 1.6); c.lineTo(x + Math.cos(a + ry.w) * R, y + Math.sin(a + ry.w) * R); c.closePath(); c.fill(); }
    c.restore();
  }
  // flare rim: tiny curled crescents hugging the limb (exist only when larger than ~0.6 px)
  if (R * 0.022 > 0.6) {
    const hiP = new Path2D(), loP = new Path2D();
    for (const f of FLARES) {
      const sz = f.s * R; if (sz < 0.6) continue; const a = f.a + Math.sin(t * 0.7 + f.a * 5) * 0.004;
      const d = R * (1.0 + f.h) + sz * 0.25, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d, o = a + Math.PI * 0.5;
      const P = f.hi ? hiP : loP;
      P.moveTo(cx + Math.cos(o) * sz, cy + Math.sin(o) * sz);
      P.arc(cx, cy, sz, o, o + Math.PI * 1.15);
      P.arc(cx + Math.cos(a) * sz * 0.35, cy + Math.sin(a) * sz * 0.35, sz * 0.72, o + Math.PI * 1.15, o, true); P.closePath();
    }
    c.fillStyle = PAL.sunHi; c.fill(hiP); c.fillStyle = PAL.sunRim; c.fill(loP);
  }
  // disc, stacked flat fills (largest-star/02): orange rim band, gold body, a darker crescent away from the light, a lighter
  // inner disc toward it, spot rings, a flat highlight ellipse. A point keeps the same warm colours.
  c.save(); c.translate(x, y);
  c.fillStyle = PAL.sunRim; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
  c.save(); c.scale(R * 0.93, R * 0.93); c.fillStyle = PAL.sun; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill();
  if (R > 2) crescentFill(c, mix(PAL.sun, PAL.sunRim, 0.55), LIGHT[0] * 0.22, LIGHT[1] * 0.22);
  c.restore();
  c.fillStyle = PAL.sunHi; c.beginPath(); c.arc(LIGHT[0] * R * 0.16, LIGHT[1] * R * 0.16, R * 0.6, 0, TAU); c.fill();
  if (R > 3) {
    c.save(); c.beginPath(); c.arc(0, 0, R, 0, TAU); c.clip();
    if (R * 0.006 > 0.45) { c.fillStyle = rgba(PAL.sunRim, 0.5); c.beginPath(); for (const [sx, sy, sr] of SPECK) { const rr = sr * R; if (rr < 0.45) continue; c.moveTo(sx * R + rr, sy * R); c.arc(sx * R, sy * R, rr, 0, TAU); } c.fill(); }
    for (const sp of SPOTS) {
      const lon = sp.lon + t * 0.004, cx = Math.cos(sp.lat) * Math.sin(lon), cy = Math.sin(sp.lat), cz = Math.cos(sp.lat) * Math.cos(lon);
      if (cz < 0.05) continue; const sz = sp.s * R; if (sz < 0.6) continue;
      const ang = Math.atan2(cy, cx), px = cx * R, py = -cy * R;
      const ring = (k, col) => { if (sz * k < 0.5) return; c.fillStyle = col; c.beginPath(); c.ellipse(px, py, sz * k * cz, sz * k, -ang, 0, TAU); c.fill(); };
      ring(1, rgba(PAL.sunRim, 0.8)); ring(0.68, PAL.sunSpot); ring(0.42, PAL.sunRim); ring(0.2, PAL.sun);
    }
    c.restore();
    c.globalAlpha = 0.9; c.fillStyle = PAL.sunCore; c.beginPath(); c.ellipse(LIGHT[0] * R * 0.48, LIGHT[1] * R * 0.48, R * 0.2, R * 0.12, Math.atan2(LIGHT[1], LIGHT[0]) + Math.PI / 2, 0, TAU); c.fill(); c.globalAlpha = 1;
  }
  c.restore();
  glow(c, x - R * 0.05, y - R * 0.05, R * 0.6, PAL.sunCore, 0.45);
}
