// REGION: the NYC region and the US East Coast (z 4.6 … 6.7). The terrain, clouds and globe are ONE drawing in levels/earth.js
// (the regional map is the same nested terrain chain that becomes the globe); this level only names what is on screen.
// One label at a time, anchored ON the thing it names (numbers from research/SCIENCE.md O-5 / O-6).
import { P0 } from '../core/world.js';
import { ecef3 } from './earth-geo.js';

const NYC = () => ecef3(P0.lat - 0.05, P0.lon + 0.02, 0);      // Midtown / East River, inside the city
const COAST = ecef3(39.3, -76.6, 0);                           // Baltimore, on land in the middle of the coastal corridor

export default {
  id: 'region', zr: [4.6, 6.8],
  draw(V, items, labels) {
    const put = (p, text, sub) => { const s = V.P('earth', p); if (s[2] > 0) labels.push({ x: s[0] + 6, y: s[1] - 4, text, sub }); };
    if (V.z > 4.75 && V.z < 5.6) put(NYC(), 'New York City', '8.5 million people');
    else if (V.z >= 5.75 && V.z < 6.65) put(COAST, 'US East Coast', 'Maine to Florida');
  },
};
