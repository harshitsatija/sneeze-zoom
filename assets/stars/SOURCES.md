# assets/stars — sources

## hyg.bin / hyg.json — HYG Database v4.1 (astronexus)
- URL: https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv (downloaded 2026-10-09)
- Licence: CC BY-SA 4.0 (David Nash, astronexus.com). Compiled from Hipparcos, Yale Bright Star, Gliese catalogues.
- Processing (`assets/galaxies/build_cosmos.py`): dropped the Sun (id 0; levels/solar.js draws it) and rows with no
  valid distance (dist ≥ 100000 pc); kept stars with 0 < dist < 1000 pc AND (V < 8.0 OR dist < 30 pc) → 42,422 stars.
  Stored as Float32 [x, y, z (pc, J2000 equatorial, Sun at origin), absmag (V), B−V]; missing B−V = 0.65.
  Sorted by absolute magnitude (brightest first) so the renderer can stop early.
  The browser rotates equatorial → galactic with core/world.js (rot('helio','galaxy') · rotX(−OBL)).
- hyg.json: the labelled nearby stars (index into hyg.bin) with label texts; distances from research/SCIENCE.md O-13.
