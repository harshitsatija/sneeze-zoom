# Sneeze — from a sneeze on Fifth Avenue to the Planck length and the edge of the universe

An interactive continuous zoom (Kurzgesagt-style 2.5D) across 62 orders of magnitude, centred on a man sneezing in front
of the Metropolitan Museum of Art, New York, on 23 April 2026 at 12:30 EDT.

Run: `python3 -m http.server 8790` in this folder, open http://localhost:8790. Scroll / ↑↓ / buttons to zoom.
URL params: `z` (log10 field width in metres), `t` (seconds), `freeze`, `only`, `hide`, `nolabels`, `dpr`, `blur=0`.

## What is real
- Geometry: NYC building footprints + heights (NYC Open Data, 2014 3D model roof tiers), OSM streets/parks/water/coast,
  street-tree census, Natural Earth land/ice/urban/desert, PDB 1KX5 nucleosome atoms, HYG v4.1 stars, Local Volume Database
  + 2MRS galaxies (filaments = MST of real density peaks).
- Astronomy: real Sun/Moon/planet positions and Earth orientation for the instant (JPL approximate elements, Meeus Moon);
  the Sun lights every scale from its real direction (upper-left in the side view).
- Sizes: every object is at real size and position, except where marked below.
## What is illustrative / enlarged
- Planets, the Moon, Earth (from far) and Local Group galaxies use a documented minimum on-screen size ("presence law").
- Cell interiors, chromatin layout, sneeze droplet distribution, vacuum-fluctuation "bubbles", Planck foam: stylised from
  the literature (see research/SCIENCE.md), not measured structures. Quarks have no measured size (< 4.3e-19 m).
- The cosmic web beyond ~160 Mpc is statistical. Background star exposure deepens with zoom (a camera-exposure model).
## Sources and licences
See assets/*/SOURCES.md (ODbL for OpenStreetMap, NYC Open Data terms, Natural Earth public domain, RCSB PDB, HYG CC BY-SA,
2MRS, LVDB CC0). Style references (Kurzgesagt stills in refs/kz) are for internal reference only and are not part of the build.

## Structure
core/ (engine, camera, frames, kit), levels/ (one file per scale + helpers), shared/ (objects drawn at two scales),
tools/ (shot, strip, sweep, film, realtime harness). Design: DESIGN.md, STYLE.md, CONTRACT.md.
