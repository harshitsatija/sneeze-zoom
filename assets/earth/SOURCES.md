# assets/earth — sources and processing

## terrain.bin (built 2026-10-09 by `assets/earth/build/build_terrain.py`)
One nested chain of terrain products, finest first: `street` (±420 m) → `ues` (r 3 km) → `m0.5 … m5.0` (±15 km) →
`r5 … r18` (±100 km) → `r25 … r60` (±300 km) → `w100 … w60000` (globe). Each product holds the layers
`sea` (city/region products only: extent minus land), `land`, `urban`, `desert` (world only), `park`, `water`, `ice` (world only).

Inputs
- `assets/geo/street.json, ues.json, manhattan.json, region.json, world.json` — see `assets/geo/SOURCES.md`
  (OpenStreetMap ODbL "(c) OpenStreetMap contributors"; NYC Open Data; Natural Earth public domain).
- Urban (built-up) layer, fix round 1: inside the ues circle (r 3 km) all land is built-up (parks are drawn on top). Inside
  New York City (±15 km, PLUTO-covered manhattan.json blocks) built-up = blocks with coverage_pct >= 5 and park_pct < 50, streets and
  plazas closed by ±120 m. Elsewhere (and New Jersey blocks, which have no PLUTO) Natural Earth 10m `ne_10m_urban_areas`
  (public domain, https://github.com/nvkelso/natural-earth-vector/ geojson/, fetched 2026-10-09) eroded ~3.5 km and regrown
  ~3 km (dense cores only, no thin sprawl), places < 40 km² dropped, DP 0.002°, clipped to each product's land.
- Natural Earth 10m `ne_10m_geography_regions_polys` (public domain), same repository and date: features with
  `FEATURECLA == 'Desert'` (Sahara, Sonoran, Chihuahuan, Atacama, Kalahari, Gobi, …), clipped to land.
- Raw downloads were kept outside the project and deleted after the build.

Processing (shapely 2.1, pyproj 3.8)
- Layers: street parks = park + nyc_park + grass + wood + pitch; street water = water + nyc_water + fountain;
  ues parks = park + grass + wood + pitch; manhattan parks/water as given; region lakes (NE 10m).
- Nesting: product j+1 = (its own source outside product j's extent) ∪ (product j's content inside it), then Douglas–Peucker at
  product j+1's tolerance (`err`) with topology preserved, then rings (islands, holes) smaller than `err` are dropped. So
  switching j → j+1 moves no boundary by more than `err` metres (Hausdorff), and the renderer switches when
  `err × px_per_m(nearest visible ground) < 0.3 px`. City and region products are built in the local TM of `origin.json` and
  converted exactly to lon/lat with pyproj; world products are simplified in degrees (tolerance = err / 111,320 m).
- Antarctica (polygons lying entirely south of −60°) is only in products ≥ w16000: from above New York it is never in view while the
  globe is larger than ~120 px.
- Encoding: header JSON + per layer: varint ring lengths, one flag byte per ring (0 outer CCW, 1 hole CW), zigzag-varint
  lon/lat in 1e-7° (first point absolute, then deltas). Decoded in `levels/earth-geo.js` (`decodeLayer`) to ECEF on WGS84,
  stored as float32 relative to each ring's bounding-sphere centre.

Rebuild: `python3 -I assets/earth/build/build_terrain.py <dir with the two NE geojson files>` (~2.5 min).

## Measured switch errors (symmetric-difference width between consecutive products, steps of 0.5 × tol; ±97 % of the finer extent)
Switch happens when tol × px/m = 0.3 px (top-down: W = tol × 5333). Worst layer per switch, as a multiple of tol:
ues→m0.5 1.5 (park) · m0.5→m0.8 1.5 · m0.8→m1.2 1.5 (park) · m1.2→m2 1.5 (park, urban) · m2→m3 1.5 · m3→m5 2.0 (park) ·
m5→r5 1.0 · r5→r8 2.0 (water) · r8→r12 1.5 · r12→r18 2.0 (park, urban) · r18→r25 2.0 (park, urban) · r25→r40 2.0 (land) ·
r40→r60 2.0 (urban). So at the switch instant the widest sliver is 0.3–0.6 px (most edges move < 0.3 px). World levels
(w100 … w60000, DP in degrees, i.e. ≤ tol metres) were not measured (too slow at globe extents).
