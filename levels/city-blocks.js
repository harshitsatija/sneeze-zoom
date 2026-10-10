// b-ues-man: Manhattan blocks (manhattan.json, mean real height, area-weighted roof/ground colour) replace the
// individual buildings of a block once the block is small on screen (each block has its own threshold between 13 and
// 27 px, so the hand-off is spread over z ≈ 3.8 … 4.2 instead of happening everywhere at once). Outside the 3 km
// building circle a block is always a block. Park blocks never switch. The GL renderer reads this state per block.
import { G } from './city-geo.js';
let STATE = null;
export function blockMode(V, C) {
  if (!STATE) STATE = new Uint8Array(Math.ceil(G.nBlocksRaw / 256) * 256);
  STATE.fill(0);
  if (V.z < 3.2) return STATE;
  const k = C.f / Math.max(1, V.D) / V.s;   // block size in 1600-px-wide reference pixels (same look at any resolution)
  for (const b of G.blocks) {
    if (b.h <= 0.5 || b.park > 0.5) continue;
    if (!b.inside) { STATE[b.j] = 255; continue; }
    // near the edge of the 3 km building circle blocks switch earlier (up to 44 px), so the circle never shows against
    // the blocks outside it; the hand-off runs inward from the circle edge as the view widens
    const r = Math.hypot(b.x, b.z), thr = b.thr + 24 * Math.min(1, Math.max(0, (r - 1900) / 1000));
    const px = Math.sqrt(b.area) * k; if (px < thr) STATE[b.j] = 255;
  }
  return STATE;
}
