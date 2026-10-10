// EARTH: the terrain base under the city (z 0.5 →), the regional map, the globe and the shrinking dot (→ z 12.5).
// One drawing for all of it: real data on the WGS84 ellipsoid seen through the real camera (levels/earth-geo.js), the nested
// LOD chain of levels/earth-terrain.js, the cloud layer at 1.5–3 km (levels/earth-clouds.js), the real Sun (terminator, night).
// Nothing switches by zoom: the horizon becomes the limb, the map becomes the globe, the globe becomes a dot, by geometry.
import { PAL, rgba, mix, screenSpace, pointLaw, glow } from '../core/kit.js';
import { presence } from './solar-draw.js';
import { sunDir, P0, enuAxes } from '../core/world.js';
import { clamp } from '../core/m.js';
import { frameState, cap, Builder, arcStep, limbLoop, ecef3, WA, K } from './earth-geo.js';
import { loadTerrain, terrainPlan, drawTerrain, TERRAIN, T, setTerrainZ } from './earth-terrain.js';
import { cloudItems, drawClouds, drawCloudShadows } from './earth-clouds.js';
export { TERRAIN };

// main.js hands over assets/geo/world.json; the terrain chain (assets/earth/terrain.bin) already contains it, re-nested.
export function setWorld() {}
export function setLand() {}

const NIGHT_MUL = '#a8bfff'; // multiply: ocean #2d91cf -> ~#1e6dcf (PAL.oceanNight), land #48c671 -> ~#309571 (PAL.landNight), cloud -> lavender
let E = null; // P0 ENU frame in ECEF
function enuInfo() { const o = ecef3(P0.lat, P0.lon, 0), M = enuAxes(P0.lat, P0.lon); return { o, e: [M[0], M[3], M[6]], n: [M[1], M[4], M[7]], u: [M[2], M[5], M[8]] }; }

// night side on the visible cap: the terminator great circle (sphere space, normal = Sun with z scaled by K) clipped to the cap
function nightPath(S, Sun) {
  const c = cap(S, 0), s = [Sun[0], Sun[1], Sun[2] * K], sl = Math.hypot(s[0], s[1], s[2]); s[0] /= sl; s[1] /= sl; s[2] /= sl;
  const pick = Math.abs(s[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let u = [pick[1] * s[2] - pick[2] * s[1], pick[2] * s[0] - pick[0] * s[2], pick[0] * s[1] - pick[1] * s[0]]; const ul = Math.hypot(...u); u = u.map((v) => v / ul);
  const w = [s[1] * u[2] - s[2] * u[1], s[2] * u[0] - s[0] * u[2], s[0] * u[1] - s[1] * u[0]]; // u × w = s  →  walk with -θ so the night (−s) is on the left
  const st = arcStep(S, c), n = Math.min(4000, Math.ceil(2 * Math.PI / st)), ring = [];
  for (let k = 0; k < n; k++) { const th = -2 * Math.PI * k / n, co = Math.cos(th) * WA, si = Math.sin(th) * WA; ring.push([u[0] * co + w[0] * si, u[1] * co + w[1] * si, (u[2] * co + w[2] * si) / K]); }
  const b = new Builder(S, 0, 0); b.capLoop(ring, 1); return b.rings ? b.path : null;
}

// atmosphere halo: a radial glow from the limb (r = 0.645 of the sprite radius) out to 1.55 R, rendered once and scaled
let HALO = null;
function haloSprite() {
  if (HALO) return HALO; HALO = document.createElement('canvas'); HALO.width = HALO.height = 512; const c = HALO.getContext('2d'), r0 = 256 / 1.55;
  const g = c.createRadialGradient(256, 256, r0 * 0.98, 256, 256, 256);
  g.addColorStop(0, rgba('#2a56d8', 0.55)); g.addColorStop(0.12, rgba(PAL.atmo, 0.42)); g.addColorStop(0.45, rgba(PAL.atmo, 0.14)); g.addColorStop(1, rgba(PAL.atmo, 0));
  c.fillStyle = g; c.fillRect(0, 0, 512, 512); return HALO;
}

export default {
  id: 'earth', zr: [0.4, 13.2],
  async load(ctx) { await loadTerrain(ctx); E = enuInfo(); },
  draw(V, items, labels) {
    setTerrainZ(V.z);
    if (!T.ready) return;
    const S = frameState(V); const c0 = cap(S, 0);
    const Sun = sunDir('earth');
    // apparent size of the globe
    const ctr = V.cs('earth', [0, 0, 0]); const rpx = V.f * Math.tan(Math.asin(Math.min(1, WA / S.dC))) * (S.dC / Math.max(ctr[2], 1));
    const globe = S.alt > 2e5; // the limb can be in view: draw as one globe item (g 0) sorted with the Moon and planets
    // ---- the far dot: below ~2 px the globe is a point with the size law, still lit by phase
    // presence law shared with SOLAR (solar-draw.js): the far Earth stays a small lit ball (5 px to 1.5 AU, gone by 15 AU)
    const pres = presence(S.dC, 1.496e11, 24 * V.s, 1); // space v3: Earth (with the Moon) stays the clear subject until the Sun has drifted in (full to 1 AU, gone by 10 AU)
    if (rpx < Math.max(2.2, pres)) {
      if (ctr[2] <= 0) return;
      const sx = V.cx + ctr[0] * V.f / ctr[2], sy = V.cy - ctr[1] * V.f / ctr[2]; if (!V.onScreen(sx, sy, 12)) return;
      const R0 = Math.max(rpx, pres), r = Math.max(R0, 1.1), a = R0 >= 1.1 ? 1 : Math.pow(R0 / 1.1, 0.42);
      const er = V.c('earth'), sx3 = Sun[0] * er.r[0] + Sun[1] * er.r[1] + Sun[2] * er.r[2], sy3 = Sun[0] * er.u[0] + Sun[1] * er.u[1] + Sun[2] * er.u[2], sz3 = Sun[0] * er.b[0] + Sun[1] * er.b[1] + Sun[2] * er.b[2];
      const th = Math.atan2(-sy3, sx3), kz = Math.max(-1, Math.min(1, sz3)); // kz > 0: the Sun is behind the camera (mostly lit)
      const day = mix(PAL.ocean, PAL.land, 0.18);
      items.push({ name: 'earth', d: ctr[2], g: 0, draw(c) { screenSpace(c); c.globalAlpha = a;
        glow(c, sx, sy, r * 2.6, PAL.ocean, 0.2);
        c.fillStyle = PAL.oceanNight; c.beginPath(); c.arc(sx, sy, r, 0, 6.2832); c.fill();
        // lit part: the half disc toward the Sun plus/minus the terminator half-ellipse (flat fills, real phase)
        c.save(); c.translate(sx, sy); c.rotate(th); c.fillStyle = day; c.beginPath(); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
        c.ellipse(0, 0, Math.abs(kz) * r, r, 0, Math.PI / 2, -Math.PI / 2, kz < 0); c.fill(); c.restore(); } });
      return;
    }
    const plan = terrainPlan(S, E); if (!plan) return;
    const sx0 = V.cx + ctr[0] * V.f / ctr[2], sy0 = V.cy - ctr[1] * V.f / ctr[2];
    // depth-of-field for the ground seen from the street (aerial views are sharp)
    // the limb's screen circle: circumcircle of three projected limb points (exact for the circle the limb projects to)
    let ux = sx0, uy = sy0, ur = rpx;
    if (globe) { const LL = limbLoop(S, c0), q = [0, 1, 2].map((i) => V.P('earth', LL[Math.floor(i * LL.length / 3)]));
    const ax = q[0][0], ay = q[0][1], bx = q[1][0], by = q[1][1], cx2 = q[2][0], cy2 = q[2][1], dd = 2 * (ax * (by - cy2) + bx * (cy2 - ay) + cx2 * (ay - by));
    const ux2 = ((ax * ax + ay * ay) * (by - cy2) + (bx * bx + by * by) * (cy2 - ay) + (cx2 * cx2 + cy2 * cy2) * (ay - by)) / dd, uy2 = ((ax * ax + ay * ay) * (cx2 - bx) + (bx * bx + by * by) * (ax - cx2) + (cx2 * cx2 + cy2 * cy2) * (bx - ax)) / dd, r2 = Math.hypot(ax - ux2, ay - uy2); if (isFinite(r2) && r2 > 0) { ux = ux2; uy = uy2; ur = r2; } }
    const blur = V.dofA > 0 ? (globe ? V.coc(Math.max(plan.dmin, ctr[2] - WA)) : V.coc(Math.max(plan.dmin * 4, V.D * 6))) : 0; // a globe is blurred by the depth of its near surface (the focus), not its centre: no blur jump when the view becomes a globe
    const clouds = cloudItems(S, V, E);
    items.push({ name: 'terrain', d: globe ? ctr[2] : Math.max(plan.dmin, 1) * 50, g: globe ? 0 : -1.5, cover: plan.coversScreen, blur, draw(c) {
      screenSpace(c);
      if (globe) { const H = haloSprite(), k = ur * 1.55 / 256; c.drawImage(H, ux - 256 * k, uy - 256 * k, 512 * k, 512 * k); } // atmosphere halo (luminous)
      T.stats.verts = drawTerrain(c, S, plan);
      if (globe || blur >= 0.8) drawCloudShadows(c, S, clouds); // (multiply needs an opaque ground under it: inside this item when blurred)
      if (globe) drawClouds(c, S, clouds);
      if (globe) {
        const night = nightPath(S, Sun);
        if (night) { c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = NIGHT_MUL; c.fill(night); c.restore(); }
        // limb: Kurzgesagt flat crescents (no outline): a shade band on the side away from the Sun, a faint light band toward it.
        // The limb seen from here is a circle to < 1.5 px; the atmosphere band is the bright inner edge of the halo.
        const er = V.c('earth'), sr = Sun[0] * er.r[0] + Sun[1] * er.r[1] + Sun[2] * er.r[2], su = Sun[0] * er.u[0] + Sun[1] * er.u[1] + Sun[2] * er.u[2], sl = Math.hypot(sr, su) || 1;
        const dx = sr / sl, dy = -su / sl; // toward the Sun on screen
        const band = (k, col, mode) => { c.save(); c.beginPath(); c.arc(ux, uy, ur + 0.5, 0, 6.2832); c.clip(); c.beginPath(); c.arc(ux, uy, ur + 3, 0, 6.2832);
          c.arc(ux + dx * k * ur, uy + dy * k * ur, ur, 0, 6.2832, true); c.globalCompositeOperation = mode; c.fillStyle = col; c.fill(); c.restore(); };
        band(0.26, '#c3ccf3', 'multiply'); band(0.12, '#b4bff0', 'multiply'); band(-0.06, rgba('#ffffff', 0.12), 'source-over'); // stacked flat shade crescents away from the Sun
      }
    } });
    if (!globe) { // clouds are their own layers above the ground: shadows on the ground, clouds at their real depth
      if (clouds.list.length) {
        if (blur < 0.8) items.push({ name: 'cloudshadow', d: plan.dmin * 1.01, g: -0.95, blur, draw(c) { screenSpace(c); drawCloudShadows(c, S, clouds); } });
        items.push({ name: 'clouds', d: clouds.depth, g: 0, blur: V.dofA > 0 ? V.coc(clouds.depth) : 0, draw(c) { screenSpace(c); drawClouds(c, S, clouds); } });
      }
    }
    if (V.z > 6.95 && V.z < 8.7 && rpx > 20) labels.push({ x: ux + ur * 0.74 + 14, y: uy - ur * 0.74 - 10, text: 'Earth', sub: 'our home · 12,742 km wide' }); // beside the globe, upper right
  },
};
