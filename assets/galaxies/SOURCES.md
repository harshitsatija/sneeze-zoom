# assets/galaxies — sources

All built by `build_cosmos.py` (this folder; run `python3 -I build_cosmos.py <downloads-dir> <sneeze/assets>`).
Positions are stored in J2000 equatorial cartesian coordinates; the browser converts to the 'galaxy' frame with core/world.js.

## localgroup.json — Local Group members
- Dwarfs: Local Volume Database (A. Pace et al. 2024), `data/dwarf_all.csv`,
  https://github.com/apace7/local_volume_database (CC0 1.0), downloaded 2026-10-09.
  Kept confirmed galaxies with distance < 1.6 Mpc and M_V < −6.5 (67 objects incl. LMC, SMC, Sagittarius dSph, M32,
  NGC 205/185/147, IC 10, NGC 6822, IC 1613, WLM …). Radius = 2.2 × physical half-light radius (LMC 5.5, SMC 3.0 kpc,
  drawing values); ellipticity and position angle from the database; HI detection → irregular.
- Hand-entered (literature values, research/SCIENCE.md O-15): M31 (765 kpc, M_V −21.5, i 77°, PA 38°, R 23 kpc),
  M33 (840 kpc, M_V −18.8, i 56°, PA 23°, R 9 kpc). The Milky Way itself is built in levels/galaxy.js
  (R0 = 8.18 kpc, 4 arms with pitch 12.5°, bar 4.5 kpc at 27°, Local Arm pitch 11.4°; SCIENCE.md O-14).

## web2mrs.bin, puffs2mrs.bin — 2MASS Redshift Survey v2.4 (Huchra et al. 2012, ApJS 199, 26)
- URL: http://tdc-www.harvard.edu/2mrs/2mrs_v240.tgz (catalog/2mrs_1175_done.dat), downloaded 2026-10-09; public survey data.
- Distance = cz / 70 km/s/Mpc (Hubble law), except ~24 nearby galaxies with literature distances (M81, NGC 253, Cen A …);
  Local Group members removed (they come from localgroup.json); kept 1.8 < d < 215 Mpc.
  M_V ≈ M_K + 3.0 from the K_s magnitude. Zone of avoidance (|b| < 5°, < 8° toward the bulge) filled by reflecting the
  adjacent strip (standard "cloning", flagged in column 7). Position angle unknown → a fixed random one; inclination from b/a.
  41,746 galaxies (3,082 clones). The renderer keeps a fixed random subset with probability min(1, (60 Mpc / r)^2.3) so the
  survey's depth limit does not read as a sphere.
- puffs2mrs.bin: smoothed galaxy density (6 Mpc cells with ≥ 3 galaxies) → soft glow puffs along the filaments.

## webfar.bin — procedural far web (statistical, NOT a catalogue)
- From 150 Mpc to the comoving edge (14.26 Gpc = 46.5 Gly): 7 radial shells (doubling), 1,700 points each, radius drawn
  log-uniformly (density ∝ r⁻³, continuous with the thinned 2MRS), positions accepted by a Voronoi filament / node
  density (cell 60 Mpc in the first shell, growing to 420 Mpc). Each point stands for a cluster / supercluster region;
  luminosity M = −20.75 − 4.5 log10(R / 150 Mpc) + 0.7 σ (a flux-limited selection: far away only the brightest
  structures are drawn). Seeded RNG (20260415) — reproducible.

## filaments.bin, nodes.bin — the visible cosmic web (`build_filaments.py`, run on the processed assets)
- Real filaments: minimum spanning tree of the 2MRS density peaks (6 Mpc cells with ≥ 4 galaxies), edges > 16 Mpc pruned
  (the MST filament finder of Barrow, Bhavsar & Sonoda 1985). 2,265 segments. Stored [x1,y1,z1,x2,y2,z2 (Mpc, J2000 eq.),
  weight = mean log N, shell = 0].
- Statistical filaments: MST of each far-web shell, edges > 1.6 × the shell's web scale pruned (9,245 segments, shell = k+1).
- Nodes: the 260 richest 2MRS cells (galaxy clusters: Virgo, Coma, Perseus–Pisces, Centaurus, Norma …), drawn as warm glows.
