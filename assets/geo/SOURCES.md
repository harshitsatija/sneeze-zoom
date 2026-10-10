# Sources, licences and processing

Everything was fetched on **2026-10-09**. The build scripts are in `research/geo-build/`, and each one re-downloads its inputs. Raw downloads were deleted after conversion because disk space is tight.

## Licences and attribution

| source | licence | attribution to show |
|---|---|---|
| OpenStreetMap (via Overpass API) | ODbL 1.0, https://www.openstreetmap.org/copyright | "(c) OpenStreetMap contributors". The derived coastlines, land polygons, blocks, paths, parks and water are Produced Works or Derivative Databases under ODbL |
| NYC Open Data (Socrata, data.cityofnewyork.us) | NYC Open Data Terms of Use, https://www.nyc.gov/home/terms-of-use.page: free use, no warranty, no endorsement | "Data: NYC Open Data / NYC OTI, DCP, Parks" |
| NYC 3D Building Model 2014 (NYC DoITT, now OTI) | NYC Open Data terms (as above) | "NYC 3D Building Model, NYC OTI" |
| Natural Earth | public domain, https://www.naturalearthdata.com/about/terms-of-use/ | optional: "Made with Natural Earth" |

## Per file

### origin.json
- P0 = 40.7790097 N, -73.9624352 E.
- Sources: OSM ways 332132158 (Fifth Ave west sidewalk, footway=sidewalk), 552699591 and 552699597 (the Met plaza fountains), and 68668532 (5th Avenue centreline, used for the grid bearing). Overpass `out geom`.
- Processing: midpoint of the two fountain centroids, projected perpendicular onto the sidewalk centreline. Projection: `+proj=tmerc` with k = 1 on WGS84, centred on P0.

### street.json (square +-420 m, 0.1 m ints)
- **Buildings:** NYC Open Data *BUILDING* (footprints), dataset `5zhs-2jue`, https://data.cityofnewyork.us/resource/5zhs-2jue.geojson, filtered with `within_circle(the_geom, P0, 3200)`.
  - Fields: height_roof and ground_elevation (ft converted to m), bin, feature_code, construction_year. Features marked for demolition were dropped.
- **Building parts (roof tiers):** NYC 3D Building Model (CityGML LOD2), https://maps.nyc.gov/download/3dmodel/DA_WISE_GML.zip (916 MB zip).
  - Only the DA13 member (44 MB compressed) was streamed, using HTTP range requests (`remotezip.py`, `fetch_met3d.py`). Buildings within 610 m of P0 were kept.
  - Roof surfaces were converted from EPSG:2263 to WGS84 to local coordinates. They are shifted (0, +1.0) m to register with the footprints; that shift was fitted on the Met (overlap 0.999).
  - Faces are grouped into 1 m height tiers (face mid-height minus ground) and unioned per tier.
  - This gives the Met 165 real roof tiers from 8 to 38 m. All BIN-matched buildings get tiers: 2,051 parts in total.
- **Roadbed, Sidewalk, Median, Public Plazas, Open Space (Parks), Hydrography:** NYC Planimetric Database datasets `i36f-5ih7`, `52n9-sdep`, `ees7-4ufv`, `ue2e-9jm2`, `y6ja-fw4f` and `pjs3-c3z5`, each filtered with `within_circle`. Per layer they were unioned and clipped, then simplified 0.05 m.
- **Street trees:** 2015 Street Tree Census, `uvpi-gqnh`, bbox filter. Only live trees are kept (979).
  - Canopy radius = 0.5 x (1.5 + 0.2 x DBH_cm) m, clamped to 1-14 m. This is a generic urban broadleaf allometry, not species-specific.
- **OSM** (Overpass, every element in bbox 40.7736,-73.9696,40.7844,-73.9553):
  - road centrelines, with width measured from the NYC roadbed polygons (median perpendicular cross-section)
  - paths, sidewalks, crossings (114)
  - park, grass, wood, pitch, playground, sand, water, fountains, pedestrian areas
  - natural=tree nodes: 112 that are not within 3 m of a census tree, mostly in Central Park and the Met plaza tree rows
  - the Met outline (relation 3698894) and entrances (nodes 5618087851, 5618087855, 5618087853)
- **Met steps:** *derived*, because no steps polygon exists in OSM or NYC planimetrics. It is the plaza strip between the inner edges of the two fountains (63 m wide), from the fountains' curb-side edge to the Met facade, clipped to the NYC plaza polygon.

### ues.json (circle 3 km, 0.1 m ints)
- Same NYC footprints (17,978 buildings), NYC roadbed, parks and hydrography as street.json.
- OSM (Overpass): leisure, natural and landuse areas, highway centrelines (motorway to pedestrian), and footpaths inside Central Park.
- Land comes from the OSM coastline (see manhattan.json).
- Building tolerance is foveated, clamp(r/2667 - 0.05, 0.1, 0.5) m (see LOD.md). Road widths are measured from NYC roadbed, or a class default when that fails.

### manhattan.json (square +-15 km, 0.1 m ints)
- **Land:** OSM `natural=coastline` ways, fetched from Overpass in 1x1 degree tiles (`fetch_coast.sh`, 48 tiles, 72 MB, 11,807 ways).
  - Processing: projected, clipped (with a 20 m overshoot so the clip edge nodes exactly), noded with the clip boundary, polygonised. Faces are classified as land with OSM's "land on the left" rule, using votes from sampled coastline segments.
  - Three Douglas-Peucker LODs at 0.5, 2 and 5 m, with the measured error stored in the header.
  - osmdata.openstreetmap.de land-polygons were **not** used: the split download is about 900 MB and there is no tiled access.
- **Parks / landcover:** OSM leisure=park/nature_reserve/golf_course, landuse=cemetery/forest/recreation_ground, natural=wood/wetland. **Water:** OSM natural=water clipped to land.
- **Highways:** OSM motorway/trunk (+links) and primary/secondary bridges.
- **Blocks:** land minus OSM streets buffered to typical right-of-way widths, minus inland water: 29,747 blocks.
  - Heights come from **PLUTO** (`64uk-42ks`: numfloors, bldgarea, lot lat/lon, bbox filter, 504k lots).
  - Block h = footprint-weighted mean of h_lot = 3.341 x floors + 2.153 m. That fit was made against NYC footprint heights for 16,277 UES lots, with median absolute residual 1.7 m.
  - Coverage = sum of lot footprints / block area. h_max is also stored.
  - New Jersey blocks have h = -1 because there is no PLUTO equivalent.

### region.json (square +-300 km in local TM, xy at 1 m and ll at 1e-5 deg)
- **Land:** the same OSM coastline tiles, polygonised over the whole box. NE 10m land is used only as a fallback classifier for faces that get no coastline vote.
  - LODs: fine 5 m (cropped to +-100 km), mid 25 m, coarse 100 m. Measured errors are in the header.
- **Lakes, rivers, state borders:** Natural Earth 10m, from https://github.com/nvkelso/natural-earth-vector (geojson/): `ne_10m_lakes`, `ne_10m_lakes_north_america`, `ne_10m_rivers_lake_centerlines`, `ne_10m_rivers_north_america`, `ne_10m_admin_1_states_provinces_lines`. Borders are clipped to land and lakes to land; all simplified 25 m.

### world.json (lon/lat, 1e-4 deg ints)
- Natural Earth 10m `ne_10m_land` + `ne_10m_minor_islands`, `ne_10m_lakes`, `ne_10m_glaciated_areas` + `ne_10m_antarctic_ice_shelves_polys`, from the same GitHub repository (master branch).
- LODs: Douglas-Peucker 0.0025 deg (fine) and 0.015 deg (coarse). In the fine LOD, the land inside the region box is replaced by region.json's coarse OSM land, so the two products coincide.
- The NE vs OSM discrepancy inside the box is recorded in the header.

### Helper scripts (research/geo-build/)
- `common.py`: projection and IO
- `overpass.sh`: retries across Overpass mirrors
- `fetch_nyc.sh`, `fetch_osm.sh`, `fetch_coast.sh`, `fetch_met3d.py` + `remotezip.py`: downloads
- `coast.py`: coastline polygonisation
- `build_*.py`: one per product
- `check_agreement.py`: LOD agreement checks
- `preview.py`: PIL renders, written to `research/geo-build/preview/`
- Overpass mirrors used: overpass-api.de, overpass.kumi.systems, maps.mail.ru, overpass.private.coffee.
