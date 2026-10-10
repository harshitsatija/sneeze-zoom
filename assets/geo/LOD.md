# Level-of-detail guide for the sneeze zoom

How it's measured: **W** is the horizontal field width of the view in metres, drawn on a 1600 px canvas, so 1 px = W/1600 m. A layer whose geometric error is **e** stays below **0.3 px** when

    W >= e * 1600 / 0.3  =  5333 * e

The camera is always centred on P0 (origin.json). A layer can only be used while the frame fits inside its extent. For a 16:9 frame that means W <= 2 * half-size for a square clip, and W <= 1.74 * R for a circle of radius R.

"Error" covers two things: the Douglas-Peucker tolerance, which was **measured** afterwards as the maximum vertex deviation of each polygon from its unsimplified original, and the quantisation (half a unit). Features smaller than the tolerance are dropped, so their size is also no larger than e.

## Table

| product / LOD | max error e | usable from (0.3 px) | usable up to (extent) | replaces next finer at W = |
|---|---|---|---|---|
| street.json (everything) | 0.1 m (0.05 simplify + 0.05 quant.) | finest product: nothing finer exists. 0.1 m is > 0.3 px below W = 533 m, but the sources themselves are only accurate to ~0.3-1 m | W <= 840 m (square +-420 m) | - |
| ues.json buildings | foveated: clamp(r/2667 - 0.05, 0.1, 0.5) m + 0.05 quantisation, r = distance from P0 | any W >= 840 m (by construction: a point at r is first seen at W = 2r, where 0.3 px = r/2667) | W <= 5.2 km (circle 3 km) | 840 m (street ends) |
| ues.json land / roadbed / parks | 0.3 / 0.15 / 0.55 m (incl. quantisation) | 1.6 km* / 0.8 km / 2.9 km* | W <= 5.2 km | 840 m |
| manhattan.json coast L1 | 0.5 m | 2.7 km | W <= 30 km | 2.7 km (or 5.2 km, end of ues) |
| manhattan.json coast L2 | 2.0 m | 10.7 km | W <= 30 km | 10.7 km |
| manhattan.json coast L3 | 5.0 m | 26.7 km | W <= 30 km | 26.7 km |
| manhattan.json blocks | 0.5 m (simplify) | 2.7 km | W <= 30 km | ~3-5 km, where single buildings get smaller than ~2 px |
| region.json fine | 5 m | 26.7 km | W <= 200 km (+-100 km) | 26.7-30 km (end of manhattan) |
| region.json mid | 25 m | 133 km | W <= 600 km | 133 km |
| region.json coarse | 100 m | 533 km | W <= 600 km | 533 km |
| world.json fine | 100 m inside the region box (identical to region coarse); 278 m DP outside, plus Natural Earth's own inaccuracy | 533 km inside box / 1,480 km outside | globe | 533-600 km (end of region) |
| world.json coarse | 1,670 m (0.015 deg DP) | 8,900 km | globe | 8,900 km (whole-disc view is ~13-14,000 km) |

\* Rows marked with * still hold for the P0-centred camera. The nearest coastline (East River, ~1.2 km away) only comes into view once W >= 2.4 km, and at that width 0.3 px is already 0.45 m. The nearest park polygons are inside the street.json square.

## Measured agreement between neighbouring products

These numbers come from `research/geo-build/check_agreement.py`. The metric is the width of the thickest part of the symmetric difference between the two rendered land masks, which is what you would see as a sliver when the layers cross-fade.

| pair | disagreement | stated errors |
|---|---|---|
| ues land vs manhattan L1 | 0.5 m | 0.25 + 0.5 |
| manhattan L1 vs L2 | 2.1 m | 0.5 + 2 |
| manhattan L2 vs L3 | 5.1 m | 2 + 5 |
| **manhattan L3 vs region fine** (inside the 30 km box) | **5.2 m** | 5 + 5 (both use the same OSM coastline, the same algorithm and the same tolerance; the residue is 1 m quantisation) |
| region fine vs mid | 30.9 m | 5 + 25 |
| region mid vs coarse | 100 m | 25 + 100 |
| **region coarse vs world fine** (inside the region box) | **10.2 m** | identical geometry; the residue is world's 1e-4 deg quantisation |
| world fine vs coarse | 5.5 km (measured in degrees x 111 km, which overstates it at high latitude) | 0.28 + 1.67 km, plus narrow fjords and channels that close |

## Known limits

- **Seam in world fine.** Natural Earth 10m is used outside the region box and OSM (100 m) inside it. Where the coast crosses the box edge (Chesapeake mouth near 38.0 N, the Delmarva coast, Cape Cod Bay near 70.3 W) there is a small jog of a few hundred metres. That is under 0.3 px for W >= ~1,500 km and is off-centre anyway.
- **Natural Earth vs OSM** inside the region box: NE vertices sit a median 236 m from the OSM coast, with p90 3.3 km and max 40 km. The big values are estuaries and tidal rivers that NE draws as land and the OSM coastline treats as sea (Hudson, Delaware and Potomac reaches, marsh channels). So outside the box, world fine is only "NE-accurate". The strict 0.3 px rule against reality can't be guaranteed there below roughly W = 5,000 km.
- **Narrow water closes.** In coarser LODs, channels narrower than about 2x the tolerance may close: the polygons simply overlap. That is inside the disagreement figures above.
- **No usable Hudson upstream of NYC.** The OSM coastline ends near the harbour. region.rivers (NE 10m centrelines) can draw the river as a line.
- **Suggested blending.** Cross-fade over about 20 % of W past each "usable from" threshold. Between 840 m and ~2 km, draw street.json inside its square and ues.json outside it; they share the same NYC footprints and BINs. Below ~5 km use ues buildings, and from about 3-5 km switch to manhattan blocks (h, coverage).
