# assets/city — derived city data (CITY agent)

Built by `python3 -I assets/city/build_city.py <trees3k.json>` from `assets/geo/{street,ues,manhattan}.json` plus one download.
Coordinates: ints × 0.1 m, x east / y north, local TM on P0 (same as assets/geo), except ground.bin (float32, street frame).

| file | content | source / processing |
|---|---|---|
| city.json `trees` | 15.3k park trees (kind 2 in OSM `wood`, 7.5 m jittered grid; kind 3 on other park land, 17 m) | generated inside ues.json wood/park polygons minus grass, pitches, water, buildings, roads, paths. Not individual surveyed trees. |
| city.json `street_trees` | 25.4k street trees, 0.42–3 km from P0 | **2015 NYC Street Tree Census** (`uvpi-gqnh`, status Alive), https://data.cityofnewyork.us, NYC Open Data terms, fetched 2026-10-09 (bbox query, raw file deleted). r = 0.5·(1.5 + 0.2·DBH_cm) clamp 1–14 m, as street.json. |
| city.json `wall` | Central Park perimeter wall polylines | exterior of the largest ues.json park polygon, minus 3 m around paths/roads, minus the Met plaza frontage. |
| city.json `roadbed_tiles` | NYC roadbed cut into 200 m tiles, 4 simplification levels | ues.json `areas.roadbed`, shapely. |
| city.json `blocks`, `bld_block` | per manhattan.json block: mean height + coverage (from real footprints inside the 3 km circle, else PLUTO); building → block index | shapely point-in-polygon of each footprint's representative point. |
| tri.bin | constrained-Delaunay roof triangles for every prism (ues footprints / street.json roof tiers) and every block outer ring | shapely 2.1 `constrained_delaunay_triangles`; 348k triangles, 0 failures. |
| ground.bin | triangulated sidewalks, plaza + pedestrian areas, medians (street.json) and roadbed (ues.json) | same. |

Licences: NYC Open Data terms of use; OSM-derived parts ODbL (© OpenStreetMap contributors). Attribution as in assets/geo/SOURCES.md.
Approximate / designed (not surveyed): the Met steps and Hunt-facade details (levels/city-met.js), tree heights (2.6 + 2.15·r m).
