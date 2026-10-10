"""Build assets/earth/terrain.bin: ONE nested chain of terrain products (street -> ues -> manhattan -> region -> world pyramid).

Every product carries the same layers (land, urban, park, water, + ice/desert on the world levels). A coarser product contains
the finer product's content inside the finer extent, re-simplified at its own tolerance, so switching from product j to j+1
changes the picture by at most err[j+1] metres (the DP tolerance). The renderer switches when err * px_per_m < 0.3 px.

Inputs: assets/geo/{street,ues,manhattan,region,world}.json (see assets/geo/SOURCES.md) and Natural Earth 10m
urban_areas + geography_regions_polys (public domain) from a download directory given on the command line.
Run:  python3 -I assets/earth/build/build_terrain.py <ne_download_dir>
"""
import sys, os, json, math, struct
import numpy as np
import shapely
import shapely.geometry as G
from shapely.ops import unary_union
from shapely.validation import make_valid
from shapely.strtree import STRtree
from pyproj import Transformer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
GEO = os.path.join(ROOT, 'assets', 'geo')
OUT = os.path.join(ROOT, 'assets', 'earth', 'terrain.bin')
NE_DIR = sys.argv[1]

origin = json.load(open(os.path.join(GEO, 'origin.json')))
PROJ = origin['proj']
_inv = Transformer.from_crs(PROJ, 'EPSG:4326', always_xy=True)
_fwd = Transformer.from_crs('EPSG:4326', PROJ, always_xy=True)
def to_ll(g): return shapely.transform(g, lambda a: np.column_stack(_inv.transform(a[:, 0], a[:, 1])))
def to_xy(g): return shapely.transform(g, lambda a: np.column_stack(_fwd.transform(a[:, 0], a[:, 1])))
def mv(g): return g if g.is_valid else make_valid(g)
def polys_only(g):
    out = []
    if g is None or g.is_empty: return out
    if g.geom_type == 'Polygon': return [g]
    if hasattr(g, 'geoms'):
        for h in g.geoms: out += polys_only(h)
    return out
def mp(g): return G.MultiPolygon(polys_only(g)) if not g.is_empty else G.MultiPolygon()

def rings_to_poly(rings, sc):
    rr = [np.asarray(r, dtype=np.float64).reshape(-1, 2) * sc for r in rings if len(r) >= 6]
    if not rr: return None
    return mv(G.Polygon(rr[0], rr[1:]))
def layer(polys, sc): return mv(unary_union([p for p in (rings_to_poly(x, sc) for x in polys) if p is not None and not p.is_empty]))

def small(r, tol):
    x0, y0, x1, y1 = r.bounds; return math.hypot(x1 - x0, y1 - y0) < tol
def simp(g, tol):
    """DP at tol, then drop rings (islands, holes) smaller than tol: both change the picture by < tol."""
    g = shapely.simplify(mv(g), tol, preserve_topology=True)
    out = []
    for p in polys_only(mv(g)):
        if small(p.exterior, tol): continue
        out.append(G.Polygon(p.exterior.coords, [h.coords for h in p.interiors if not small(h, tol)]))
    return mp(mv(G.MultiPolygon(out))) if out else G.MultiPolygon()
def circle(r, n=1440): return G.Polygon([(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)])
def square(h, n=200):
    pts = []
    for i in range(n): pts.append((-h + 2 * h * i / n, -h))
    for i in range(n): pts.append((h, -h + 2 * h * i / n))
    for i in range(n): pts.append((h - 2 * h * i / n, h))
    for i in range(n): pts.append((-h, h - 2 * h * i / n))
    return G.Polygon(pts)

def nest(fine, ext_fine, coarse_src):
    """content: coarse source outside the finer extent, the finer content inside it"""
    return mv(unary_union([mv(coarse_src).difference(ext_fine), mv(fine).intersection(ext_fine)]))

print('load city + region ...', flush=True)
S = json.load(open(os.path.join(GEO, 'street.json'))); sS = S['header']['scale']
U = json.load(open(os.path.join(GEO, 'ues.json'))); sU = U['header']['scale']
M = json.load(open(os.path.join(GEO, 'manhattan.json'))); sM = M['header']['scale']
R = json.load(open(os.path.join(GEO, 'region.json'))); sR = R['header']['scale']
W = json.load(open(os.path.join(GEO, 'world.json'))); sW = W['header']['scale']

# NE urban + desert (lon/lat)
print('load NE ...', flush=True)
def ne(name, pred=lambda p: True):
    out = []
    for f in json.load(open(os.path.join(NE_DIR, name + '.geojson')))['features']:
        if f.get('geometry') and pred(f['properties']): out.append(mv(G.shape(f['geometry'])))
    return out
urban_raw = ne('ne_10m_urban_areas')
# NE urban areas come from 1 km MODIS cells and swallow whole suburbs: erode ~3.5 km and regrow ~3 km (keeps the dense cores,
# drops thin sprawl and small towns), keep places >= 20 km2. Inside New York City the built-up area comes from real blocks instead.
urban_ll = []
for g in urban_raw:
    for q in polys_only(mv(g.buffer(-0.035, 4).buffer(0.03, 4))):
        lat = q.centroid.y; km2 = q.area * 111.32 ** 2 * math.cos(math.radians(lat))
        if km2 >= 40: urban_ll.append(mv(q.simplify(0.002)))
desert_ll = ne('ne_10m_geography_regions_polys', lambda p: p.get('FEATURECLA') == 'Desert')
# forest / highland proxy (two-tone land): Natural Earth mountain ranges + the forested uplands of the north-east and Canada
FOREST_NAMES = {'CANADIAN SHIELD', 'ALLEGHENY PLATEAU', 'CUMBERLAND PLAT.', 'LES LAURENTIDES', 'Superior Upland', 'Ozark Plateau', 'PIEDMONT'}
forest_ll = ne('ne_10m_geography_regions_polys', lambda p: p.get('FEATURECLA') == 'Range/mtn' or p.get('NAME') in FOREST_NAMES)
forest_ll = [mv(mv(g.buffer(0.4, 8).buffer(-0.4, 8)).simplify(0.01)) for g in forest_ll]  # rounded, no crude straight edges
print('urban', len(urban_ll), 'desert', len(desert_ll), 'forest', len(forest_ll))

# ---------------- city / region products (TM metres) ----------------
EXT_S = square(420.0); EXT_U = circle(3000.0); EXT_M = square(15000.0); EXT_RF = square(100000.0); EXT_R = square(300000.0)
box_ll = to_ll(shapely.segmentize(EXT_R, 3000.0))
urban_tree = STRtree(urban_ll)
def urban_xy(ext):
    e_ll = to_ll(shapely.segmentize(ext, 1000.0))
    idx = urban_tree.query(e_ll, predicate='intersects')
    parts = [urban_ll[i].intersection(e_ll) for i in idx]
    return mv(to_xy(shapely.segmentize(mv(unary_union(parts)), 0.005))) if parts else G.MultiPolygon()
URB_R = urban_xy(EXT_R)  # NE urban in TM, region box
_ft = STRtree(forest_ll); _e = to_ll(shapely.segmentize(EXT_R, 1000.0))
FOR_R = mv(to_xy(shapely.segmentize(mv(unary_union([forest_ll[i].intersection(_e) for i in _ft.query(_e, predicate='intersects')])), 0.005)))
# New York City (PLUTO-covered blocks, +-15 km): built-up = blocks with >= 5 % building cover and < 50 % park, streets between them
# closed (+-14 m); New Jersey blocks have no PLUTO (-1), there the eroded NE urban stays.
_B = [(b[1][0], b[1][1], rings_to_poly(b[2] if isinstance(b[2][0], list) else [b[2]], sM)) for b in json.load(open(os.path.join(GEO, 'manhattan.json')))['blocks']]
_bu = mv(unary_union([g for c, pk, g in _B if g is not None and c >= 5 and pk < 50])).buffer(120, 2).buffer(-120, 2)
_nj = mv(unary_union([g for c, pk, g in _B if g is not None and c < 0])).buffer(20, 2)
URB_R = mv(unary_union([URB_R.difference(EXT_M), _bu.intersection(EXT_M), URB_R.intersection(EXT_M).intersection(_nj)]))
print('urban (blocks in NYC) area km2', URB_R.area / 1e6, flush=True)
print('urban in region box: area km2', URB_R.area / 1e6)

A = S['areas']
S_land = EXT_S
S_park = layer(A['park'] + A['nyc_park'] + A['grass'] + A['wood'] + A['pitch'], sS).intersection(EXT_S)
S_water = layer(A['water'] + A['nyc_water'] + A['fountain'], sS).intersection(EXT_S)
B = U['areas']
U_land = nest(S_land, EXT_S, layer(B['land'], sU).intersection(EXT_U))
U_park = simp(nest(S_park, EXT_S, layer(B['park'] + B['grass'] + B['wood'] + B['pitch'], sU).intersection(EXT_U)), 0.5)
U_water = simp(nest(S_water, EXT_S, layer(B['water'], sU).intersection(EXT_U)), 0.5)
U_land = simp(U_land, 0.25)

M_land_src = layer(M['coast'][0]['land'], sM)
M_park_src = layer(M['parks'] and [[r] for r in M['parks']] if isinstance(M['parks'][0][0], int) else M['parks'], sM)
M_water_src = layer([[r] for r in M['water']] if isinstance(M['water'][0][0], int) else M['water'], sM)
def chain(first, tols):
    out = [first]
    for t in tols: out.append({k: simp(v, t) for k, v in out[-1].items()})
    return out
MT = [0.5, 0.8, 1.2, 2.0, 3.0, 5.0]
M1 = dict(land=simp(nest(U_land, EXT_U, M_land_src), 0.5), park=simp(nest(U_park, EXT_U, M_park_src), 0.5), water=simp(nest(U_water, EXT_U, M_water_src), 0.5))
MS = chain(M1, MT[1:]); M3 = MS[-1]
print('M done', flush=True)
def rl(i): return layer(R['coast'][i]['land_xy'], sR)
R_lakes = layer([[r] for r in R['lakes_xy']] if isinstance(R['lakes_xy'][0][0], int) else R['lakes_xy'], sR)
RFT = [5.0, 8.0, 12.0, 18.0]; RMT = [25.0, 40.0, 60.0]
RF = dict(land=simp(nest(M3['land'], EXT_M, rl(0).intersection(EXT_RF)), 5.0), park=simp(M3['park'], 5.0), water=simp(nest(M3['water'], EXT_M, R_lakes.intersection(EXT_RF)), 5.0))
RFS = chain(RF, RFT[1:]); RF = RFS[-1]
RM = dict(land=simp(nest(RF['land'], EXT_RF, rl(1)), 25.0), park=simp(RF['park'], 25.0), water=simp(nest(RF['water'], EXT_RF, R_lakes), 25.0))
RMS = chain(RM, RMT[1:]); RM = RMS[-1]
RC = {k: simp(v, 100.0) for k, v in RM.items()}
print('R done', flush=True)

def with_urban(P, ext, tol):
    P = dict(P)
    P['forest'] = simp(FOR_R.intersection(ext).intersection(P['land']), max(tol, 5.0)) if FOR_R.intersects(ext) else G.MultiPolygon()
    if ext.bounds[2] <= 3000: P['urban'] = mp(mv(P['land']))  # street + ues extents: all of it is built-up Manhattan (parks drawn on top)
    else: P['urban'] = simp(mv(unary_union([URB_R.intersection(ext), EXT_U])).intersection(P['land']), tol)
    P['sea'] = mp(mv(ext.difference(P['land'])))  # ext = land + sea exactly: an inner product repaints its extent with no clip
    return P
city = [
    ('street', 0.0, EXT_S, with_urban(dict(land=mp(S_land), park=mp(S_park), water=mp(S_water)), EXT_S, 0)),
    ('ues', 0.55, EXT_U, with_urban(dict(land=U_land, park=U_park, water=U_water), EXT_U, 0.5)),
] + [(f'm{t}', t, EXT_M, with_urban(P, EXT_M, t)) for t, P in zip(MT, MS)] \
  + [(f'r{t:g}', t, EXT_RF, with_urban(P, EXT_RF, t)) for t, P in zip(RFT, RFS)] \
  + [(f'r{t:g}', t, EXT_R, with_urban(P, EXT_R, t)) for t, P in zip(RMT, RMS)]
RC = with_urban(RC, EXT_R, 100.0)

# ---------------- world products (lon/lat degrees) ----------------
print('world ...', flush=True)
WF = W['lods'][0]
def wl(key): return [mv(G.Polygon(np.asarray(p[0]).reshape(-1, 2) * sW, [np.asarray(h).reshape(-1, 2) * sW for h in p[1:]])) for p in WF[key] if len(p[0]) >= 6]
def outside_box(geoms):
    out = []
    for g in geoms:
        if not g.intersects(box_ll): out.append(g)
        else:
            d = g.difference(box_ll)
            if not d.is_empty: out.append(d)
    return out
RC_ll = {k: mv(to_ll(shapely.segmentize(v, 2000.0))) for k, v in RC.items()}
w_land = mp(mv(unary_union(outside_box(wl('land')) + [RC_ll['land']])))
w_lakes = mp(mv(unary_union(outside_box(wl('lakes')) + [RC_ll['water']])))
w_ice = mp(mv(unary_union(wl('ice'))))
w_park = mp(RC_ll['park'])
print('world land polys', len(w_land.geoms), flush=True)
# urban + desert clipped to world land
land_parts = list(w_land.geoms); land_tree = STRtree(land_parts)
def clip_land(geoms, skip_box=True):
    out = []
    for g in geoms:
        if skip_box and g.within(box_ll): continue
        idx = land_tree.query(g, predicate='intersects')
        for i in idx:
            x = g.intersection(land_parts[i])
            if not x.is_empty: out.append(x)
    return out
w_urban = mp(mv(unary_union([mv(unary_union(clip_land(outside_box(urban_ll))))] + [RC_ll['urban']])))
w_desert = mp(mv(unary_union(clip_land(desert_ll, False))))
w_forest = mp(mv(unary_union(clip_land(outside_box(forest_ll)) + [RC_ll['forest']])))
print('world urban/desert done', flush=True)
T100 = 100.0 / 111320.0
world = [('w100', 100.0, dict(land=w_land, urban=simp(w_urban, T100), desert=simp(w_desert, T100), forest=simp(w_forest, T100), park=w_park, water=w_lakes, ice=w_ice))]
for tol in (600.0, 1000.0, 1600.0, 2500.0, 4000.0, 6500.0, 10000.0, 16000.0, 25000.0, 40000.0, 60000.0):
    prev = world[-1][2]
    world.append((f'w{int(tol)}', tol, {k: simp(v, tol / 111320.0) for k, v in prev.items()}))
    print('  w', tol, flush=True)

# ---------------- write ----------------
# Encoding per layer (bytes): varint ring lengths, one flag byte per ring (0 outer CCW, 1 hole CW), then per ring zigzag-varint
# lon,lat in 1e-7 deg: the first point absolute, the rest as deltas.
LAYERS = ['sea', 'land', 'forest', 'urban', 'desert', 'park', 'water', 'ice']
chunks = []; pos = [0]
def varint(z):
    z = np.asarray(z, dtype=np.uint64); nb = np.ones(len(z), dtype=np.int64)
    for k in range(1, 10): nb += (z >= (np.uint64(1) << np.uint64(7 * k))).astype(np.int64)
    out = np.zeros(int(nb.sum()), dtype=np.uint8); st = np.concatenate([[0], np.cumsum(nb)[:-1]])
    for k in range(10):
        m = nb > k
        if not m.any(): break
        byte = ((z[m] >> np.uint64(7 * k)) & np.uint64(127)).astype(np.uint8) | np.where(nb[m] > k + 1, 128, 0).astype(np.uint8)
        out[st[m] + k] = byte
    return out
def zz(v): v = np.asarray(v, dtype=np.int64); return ((v << 1) ^ (v >> 63)).astype(np.uint64)
def emit(rings):
    lens = np.asarray([len(a) for _, a in rings], dtype=np.int64); flags = np.asarray([f for f, _ in rings], dtype=np.uint8)
    coords = np.concatenate([a for _, a in rings]) if rings else np.zeros((0, 2))
    q = np.round(coords * 1e7).astype(np.int64); assert np.abs(q).max(initial=0) < 2**31
    d = q.copy(); d[1:] -= q[:-1]; starts = np.concatenate([[0], np.cumsum(lens)[:-1]]).astype(np.int64); d[starts] = q[starts]
    b = np.concatenate([varint(lens), flags, varint(zz(d.ravel()))])
    ent = {'off': pos[0], 'bytes': int(len(b)), 'n': int(len(lens)), 'pts': int(len(coords))}; chunks.append(b); pos[0] += len(b); return ent
def geom_rings_ll(g, drop_south=False):
    out = []
    g = shapely.orient_polygons(g, exterior_cw=False)
    for p in polys_only(g):
        if drop_south and p.bounds[3] < -60: continue  # Antarctica: never in view while the globe is large (the camera is over New York)
        ex = np.asarray(p.exterior.coords)[:-1]
        if len(ex) >= 3: out.append((0, ex))
        for h in p.interiors:
            a = np.asarray(h.coords)[:-1]
            if len(a) >= 3: out.append((1, a))
    return out
products = []
for name, err, ext, P in city:
    ent = {'name': name, 'err': err, 'half': ext.bounds[2], 'kind': 'circle' if name == 'ues' else 'square', 'ext': emit(geom_rings_ll(to_ll(shapely.segmentize(ext, 200.0)))), 'layers': {}}
    for k in LAYERS:
        if k in P and not P[k].is_empty: ent['layers'][k] = emit(geom_rings_ll(to_ll(shapely.segmentize(P[k], 2000.0))))
    products.append(ent); print(name, {k: v['pts'] for k, v in ent['layers'].items()}, flush=True)
for name, err, P in world:
    ent = {'name': name, 'err': err, 'ext': None, 'layers': {}}
    for k in LAYERS:
        if k in P and not P[k].is_empty: ent['layers'][k] = emit(geom_rings_ll(P[k], drop_south=err < 16000))
    products.append(ent); print(name, {k: v['pts'] for k, v in ent['layers'].items()}, flush=True)
hdr = json.dumps({'scale': 1e-7, 'encoding': 'see build_terrain.py: varint lens, flag bytes, zigzag varint delta lon/lat (1e-7 deg) per ring; off/bytes are byte offsets from the data start', 'products': products}).encode()
with open(OUT, 'wb') as f:
    f.write(b'EAR2'); f.write(struct.pack('<I', len(hdr))); f.write(hdr)
    for b in chunks: f.write(b.tobytes())
print('wrote', OUT, os.path.getsize(OUT) / 1e6, 'MB')
