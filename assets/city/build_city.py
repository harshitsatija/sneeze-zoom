# Builds assets/city/city.json from assets/geo/{street,ues,manhattan}.json (no downloads).
#   python3 -I assets/city/build_city.py   (run from the sneeze/ directory)
# Output coordinates: ints x 0.1 m, x east / y north, local TM centred on P0 (same as assets/geo).
import json, math, random, sys
from pyproj import Transformer
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union
from shapely.prepared import prep
from shapely import STRtree

S = 0.1
street = json.load(open('assets/geo/street.json'))
ues = json.load(open('assets/geo/ues.json'))
man = json.load(open('assets/geo/manhattan.json'))
B = math.radians(29.0); SB, CB = math.sin(B), math.cos(B)
def ring(flat): return [(flat[i] * S, flat[i + 1] * S) for i in range(0, len(flat), 2)]
def poly(p):
    try:
        g = Polygon(ring(p[0]), [ring(h) for h in p[1:] if len(h) >= 6])
        return g if g.is_valid else g.buffer(0)
    except Exception: return Polygon()
def q(v): return int(round(v / S))
def flat(coords): out = []; [out.extend((q(x), q(y))) for x, y in coords]; return out
def to_st(x, y): return (x * SB + y * CB, x * CB - y * SB)
rnd = random.Random(1234)

# ---------- 1. park trees: dense in wood polygons, sparse in other park lawns ----------
wood = unary_union([poly(p) for p in ues['areas']['wood']] + [poly(p) for p in street['areas']['wood']]).buffer(0)
park = unary_union([poly(p) for p in ues['areas']['park']]).buffer(0)
openA = unary_union([poly(p) for k in ('grass', 'pitch', 'water') for p in ues['areas'][k]] + [poly(p) for k in ('sand', 'playground', 'water', 'fountain', 'pitch', 'grass') for p in street['areas'][k]]).buffer(2)
bld = unary_union([poly(p) for b in ues['buildings'] for p in b[3]]).buffer(1.5)
roads = unary_union([LineString(ring(r[5])).buffer(r[2] * S / 2 + 1.5) for r in ues['roads'] if len(r[5]) >= 4])
paths = unary_union([LineString(ring(p[1])).buffer(2.2) for p in ues['paths'] if len(p[1]) >= 4])
hard = unary_union([poly(p) for k in ('plaza', 'pedestrian_area', 'sidewalk', 'roadbed', 'median') for p in street['areas'][k]] + [Polygon(ring(street['met']['steps'][0]))]).buffer(3)
block_out = unary_union([openA, bld, roads, paths, hard]).buffer(0)   # no generated trees on plazas, sidewalks, the Met steps
wood_ok = prep(wood.difference(block_out)); park_ok = prep(park.difference(unary_union([block_out, wood])))
trees = []
def scatter(region_prep, bounds, sp, rmin, rmax, kind):
    x0, y0, x1, y1 = bounds; n = 0
    y = y0
    while y < y1:
        x = x0
        while x < x1:
            px, py = x + (rnd.random() - 0.5) * sp * 0.8, y + (rnd.random() - 0.5) * sp * 0.8
            if px * px + py * py < 2950 ** 2 and region_prep.contains(Point(px, py)):
                r = rmin + (rmax - rmin) * rnd.random() ** 1.5
                trees.append([q(px), q(py), q(r), kind]); n += 1
            x += sp
        y += sp
    return n
nw = scatter(wood_ok, wood.bounds, 7.5, 3.2, 6.0, 2)
npk = scatter(park_ok, park.bounds, 17.0, 3.0, 6.5, 3)
print('park trees: wood', nw, 'lawn', npk)

# ---------- 1b. street trees outside street.json's +-420 m square: 2015 Street Tree Census (download, see SOURCES.md) ----------
census = []
if len(sys.argv) > 1:
    tf = Transformer.from_crs('EPSG:4326', street['header']['origin']['proj'], always_xy=True)
    for t in json.load(open(sys.argv[1])):
        try: lat, lon, dbh = float(t['latitude']), float(t['longitude']), float(t['tree_dbh'])
        except Exception: continue
        x, y = tf.transform(lon, lat)
        if math.hypot(x, y) > 3000 or (abs(x) < 420 and abs(y) < 420): continue
        r = min(14, max(1, 0.5 * (1.5 + 0.2 * dbh * 2.54)))
        census.append([q(x), q(y), q(r)])
print('census trees outside the street square', len(census))

# ---------- 2. Central Park perimeter wall (stone, ~1 m), with gaps at entrances ----------
cp = max([poly(p) for p in ues['areas']['park']], key=lambda g: g.area)
print('central park area km2', cp.area / 1e6)
edge = cp.exterior
gaps = unary_union([LineString(ring(p[1])).buffer(3.0) for p in ues['paths'] if len(p[1]) >= 4] +
                   [LineString(ring(r[5])).buffer(r[2] * S / 2 + 2) for r in ues['roads'] if len(r[5]) >= 4])
# no wall along the Met frontage (plaza) -- street-frame box |x| < 160, z > -40
mf = Polygon([( (sx * SB + sz * CB), (sx * CB - sz * SB) ) for sx, sz in ((-160, -40), (160, -40), (160, 30), (-160, 30))])
wall = edge.difference(gaps).difference(mf)
segs = [list(g.coords) for g in getattr(wall, 'geoms', [wall]) if g.length > 2]
print('wall pieces', len(segs), 'length km', sum(LineString(s).length for s in segs) / 1000)

# ---------- 2b. NYC roadbed cut into 200 m tiles with 4 simplification levels (so it can be culled and LOD-ed) ----------
rb = unary_union([poly(p) for p in ues['areas']['roadbed']]).buffer(0)
tiles = []
TS = 200
for ix in range(-16, 16):
    for iy in range(-16, 16):
        bx = box(ix * TS, iy * TS, (ix + 1) * TS, (iy + 1) * TS)
        if bx.distance(Point(0, 0)) > 3000: continue
        g = rb.intersection(bx)
        if g.is_empty: continue
        lods = []
        for tol in (0.0, 0.6, 2.5, 8.0):
            h = g.simplify(tol, preserve_topology=True) if tol else g
            ps = [h] if h.geom_type == 'Polygon' else [x for x in getattr(h, 'geoms', []) if x.geom_type == 'Polygon']
            lods.append([[flat(p.exterior.coords[:-1])] + [flat(r.coords[:-1]) for r in p.interiors] for p in ps if p.area > 0.5])
        tiles.append(lods)
print('roadbed tiles', len(tiles), 'verts lod0', sum(len(r) // 2 for t in tiles for p in t[0] for r in p))

# ---------- 3. blocks: coverage + height from real footprints where available ----------
blocks = man['blocks']; bpolys = [poly(b[2]) for b in blocks]
tree_idx = STRtree(bpolys)
ub = ues['buildings']; assign = [-1] * len(ub)
cov = [0.0] * len(blocks); hsum = [0.0] * len(blocks)
for i, b in enumerate(ub):
    g = unary_union([poly(p) for p in b[3]]);
    if g.is_empty: continue
    c = g.representative_point(); cand = tree_idx.query(c)
    for j in cand:
        if bpolys[j].contains(c): assign[i] = int(j); a = g.area; cov[j] += a; hsum[j] += a * max(b[0] * S, 3.0); break
inside = [(not bp.is_empty) and all(math.hypot(x, y) < 2990 for x, y in bp.envelope.exterior.coords) for bp in bpolys]
parks_u = unary_union([poly(p) for p in man['parks']] + [poly(p) for p in ues['areas']['park']]).buffer(0)
parks_p = prep(parks_u)
def park_frac(bp):
    if bp.is_empty: return 0
    if not parks_p.intersects(bp): return 0
    try: return bp.intersection(parks_u).area / max(bp.area, 1)
    except Exception: return 0
out_blocks = []
for j, b in enumerate(blocks):
    A = bpolys[j].area or 1
    if inside[j] and cov[j] > 0:
        c = min(cov[j] / A, 1.0); h = hsum[j] / cov[j]; src = 1
    else:
        c = b[1][0] / 100 if b[1][0] >= 0 else -1; h = b[0] * S if b[0] >= 0 else -1; src = 0
    out_blocks.append([q(h) if h >= 0 else -1, int(round(c * 100)) if c >= 0 else -1, max(b[1][1], int(round(100 * park_frac(bpolys[j])))), 1 if inside[j] else 0, src])
print('assigned buildings', sum(1 for a in assign if a >= 0), '/', len(ub))
json.dump({
  'header': {'product': 'city', 'scale': S, 'note': 'derived from assets/geo (see SOURCES.md). x east, y north, local TM on P0, ints x 0.1 m.',
             'schema': {'trees': '[x, y, canopy_r, kind] kind 2 = generated in OSM wood, 3 = generated on other park land',
                        'street_trees': '[x, y, canopy_r] 2015 Street Tree Census, alive, inside 3 km but outside street.json square; r = 0.5*(1.5+0.2*DBH_cm) clamp 1..14',
                        'wall': 'Central Park perimeter wall polylines (flat [x0,y0,...]), gaps at paths/roads, none along the Met plaza',
                        'blocks': 'parallel to manhattan.json blocks: [h (0.1 m, -1 unknown), coverage %, park %, inside_ues_circle, src (1 = from ues footprints, 0 = manhattan PLUTO)]',
                        'bld_block': 'parallel to ues.json buildings: index of the manhattan block containing the building (-1 none)'}},
  'trees': trees, 'street_trees': census, 'roadbed_tiles': tiles, 'wall': [flat(s) for s in segs], 'blocks': out_blocks, 'bld_block': assign,
}, open('assets/city/city.json', 'w'), separators=(',', ':'))
print('ok')

# ---------- 4. roof triangulation (constrained Delaunay) for the WebGL renderer -> assets/city/tri.bin ----------
# Order = the order in which levels/city-geo.js builds its prisms: for each ues building, either its 3D-model roof
# tiers (street.json parts, same BIN) or its own footprint polygons; then every manhattan block (outer ring only).
# Per polygon: uint32 ntri, then 3*ntri uint32 indices into the polygon's concatenated ring vertices (rings with < 3
# vertices dropped, as in the JS).
import struct, shapely
from shapely.geometry import Polygon as SPoly
def tri_indices(rings):
    pts = [(rings[k][i], rings[k][i + 1]) for k in range(len(rings)) for i in range(0, len(rings[k]), 2)]
    idx = {}
    for i, p in enumerate(pts): idx.setdefault(p, i)
    try:
        g = SPoly([(x * S, y * S) for x, y in ring_pts(rings[0])], [[(x * S, y * S) for x, y in ring_pts(r)] for r in rings[1:]])
        if not g.is_valid: g = shapely.make_valid(g)
        tris = shapely.constrained_delaunay_triangles(g)
    except Exception:
        return []
    out = []
    for t in getattr(tris, 'geoms', []):
        if t.geom_type != 'Polygon': continue
        c = list(t.exterior.coords)[:3]; ii = []
        for x, y in c:
            k = idx.get((int(round(x / S)), int(round(y / S))))
            if k is None: break
            ii.append(k)
        if len(ii) == 3 and g.contains(t.representative_point()): out.extend(ii)
    return out
def ring_pts(r): return [(r[i], r[i + 1]) for i in range(0, len(r), 2)]
parts = {b[3]: b[7] for b in street['buildings'] if b[7]}
buf = bytearray(); npoly = 0; ntri = 0; bad = 0
def emit(rings):
    global buf, npoly, ntri, bad
    rings = [r for r in rings if len(r) >= 6]
    if not rings: return
    t = tri_indices(rings); npoly += 1; ntri += len(t) // 3
    if not t: bad += 1
    buf += struct.pack('<I', len(t) // 3) + struct.pack('<%dI' % len(t), *t)
for b in ues['buildings']:
    pp = parts.get(b[2])
    if pp:
        for p in pp: emit(p[2])
    else:
        for poly_ in b[3]: emit(poly_)
nb_poly = npoly
for b in man['blocks']: emit([b[2][0]])
open('assets/city/tri.bin', 'wb').write(bytes(buf))
print('triangulated polys', nb_poly, '+ blocks', npoly - nb_poly, 'tris', ntri, 'failed', bad, 'bytes', len(buf))

# ---------- 5. ground details, triangulated -> assets/city/ground.bin (float32 [x, z, material] per vertex, street frame) ----------
# materials: 0 sidewalk, 1 plaza / pedestrian area, 2 median, 3 roadbed. Drawn in this order.
def street_xz(x, y): return (x * SB + y * CB, x * CB - y * SB)
gbuf = []; counts = [0, 0, 0, 0]
def tri_geom(g, mat):
    if g.is_empty: return
    for part in getattr(g, 'geoms', [g]):
        if part.geom_type != 'Polygon' or part.area < 0.05: continue
        for t in getattr(shapely.constrained_delaunay_triangles(part), 'geoms', []):
            for x, y in list(t.exterior.coords)[:3]:
                sx, sz = street_xz(x, y); gbuf.extend((sx, sz, float(mat)))
            counts[mat] += 1
for mat, keys in ((0, ['sidewalk']), (1, ['plaza', 'pedestrian_area']), (2, ['median'])):
    g = unary_union([poly(p) for k in keys for p in street['areas'][k]]).buffer(0)
    tri_geom(g, mat)
tri_geom(rb, 3)
open('assets/city/ground.bin', 'wb').write(struct.pack('<%df' % len(gbuf), *gbuf))
print('ground triangles', counts, 'bytes', len(gbuf) * 4)
