# Build the COSMOS assets (run with python3 -I). Inputs are the untrusted downloads in scratchpad/dl_*; outputs go to
# sneeze/assets/stars and sneeze/assets/galaxies. Everything is stored in J2000 EQUATORIAL cartesian coordinates
# (x -> RA 0h, z -> north celestial pole); the browser converts to the galactic frame with core/world.js, so the
# frame math lives in one place.
import csv, json, math, struct, sys, os
import numpy as np

S = sys.argv[1]            # scratchpad dir (downloads)
OUT = sys.argv[2]          # sneeze/assets
rng = np.random.default_rng(20260415)

def eq_unit(ra_deg, dec_deg):
    ra, de = np.radians(ra_deg), np.radians(dec_deg)
    return np.stack([np.cos(de) * np.cos(ra), np.cos(de) * np.sin(ra), np.sin(de)], -1)

# ---------------- 1. HYG v4.1 stars ----------------
rows = []
named = {}
LABELS = {  # proper name in HYG -> (label, sub) ; distances from research/SCIENCE.md O-13
    'Proxima Centauri': ('Proxima Centauri', '4.25 light-years · the nearest star'),
    'Rigil Kentaurus': ('Alpha Centauri A/B', '4.34 light-years'),
    "Barnard's Star": ("Barnard's Star", '5.96 light-years'),
    'Wolf 359': ('Wolf 359', '7.86 light-years'),
    'Lalande 21185': ('Lalande 21185', '8.30 light-years'),
    'Sirius': ('Sirius', '8.7 light-years'),
    'Ran': ('Epsilon Eridani', '10.5 light-years'),
    'Procyon': ('Procyon', '11.5 light-years'),
}
with open(f'{S}/dl_hyg/hyg41.csv') as f:
    for r in csv.DictReader(f):
        if r['id'] == '0':
            continue  # the Sun is drawn separately (same law)
        d = float(r['dist'])
        if not (0 < d < 1000):
            continue
        mag = float(r['mag'])
        if not (mag < 8.0 or d < 30):
            continue
        ci = r['ci']
        ci = float(ci) if ci not in ('', None) else 0.65
        x, y, z = float(r['x']), float(r['y']), float(r['z'])
        am = float(r['absmag'])
        rows.append((x, y, z, am, ci, r['proper']))
rows.sort(key=lambda t: t[3])  # brightest absolute magnitude first (lets the renderer stop early)
arr = np.array([t[:5] for t in rows], dtype=np.float32)
arr.tofile(f'{OUT}/stars/hyg.bin')
for i, t in enumerate(rows):
    if t[5] in LABELS:
        named[LABELS[t[5]][0]] = {'i': i, 'text': LABELS[t[5]][0], 'sub': LABELS[t[5]][1]}
json.dump({'count': len(rows), 'fields': ['x_pc', 'y_pc', 'z_pc', 'absmag', 'ci'], 'frame': 'J2000 equatorial, Sun at origin', 'named': list(named.values())}, open(f'{OUT}/stars/hyg.json', 'w'), indent=1)
print('hyg', len(rows), 'named', list(named))

# ---------------- 2. Local Group (LVDB, Pace 2024) + hand-entered big members ----------------
lg = []
def add(name, ra, dec, dkpc, MV, kind, Rkpc, inc=None, pa=None, extra=None):
    g = {'name': name, 'ra': ra, 'dec': dec, 'd': dkpc, 'MV': MV, 'kind': kind, 'R': Rkpc}
    if inc is not None: g['inc'] = inc
    if pa is not None: g['pa'] = pa
    if extra: g.update(extra)
    lg.append(g)
# big members (literature values; see SOURCES.md)
add('Andromeda (M31)', 10.68471, 41.26875, 765, -21.5, 'spiral', 23.0, 77, 38, {'label': 'Andromeda', 'sub': '2.5 million light-years', 'arms': 2, 'pitch': 7})
add('Triangulum (M33)', 23.46210, 30.65994, 840, -18.8, 'spiral', 9.0, 56, 23, {'label': 'Triangulum (M33)', 'sub': '2.7 million light-years', 'arms': 2, 'pitch': 22})
seen = set()
with open(f'{S}/dl_lg/dwarf_all.csv') as f:
    for r in csv.DictReader(f):
        try:
            if r['confirmed_galaxy'] != '1': continue
            d = float(r['distance']); MV = float(r['M_V'])
        except ValueError:
            continue
        if not (d < 1600 and MV < -6.5): continue
        name = r['name'].strip()
        if name in seen: continue
        seen.add(name)
        rh = float(r['rhalf_physical']) / 1000 if r['rhalf_physical'] else 0.3
        ell = float(r['ellipticity']) if r['ellipticity'] else 0.2
        pa = float(r['position_angle']) if r['position_angle'] else 0.0
        hi = r['flux_HI'] not in ('', None) and r['flux_HI_ul'] in ('', '0', None)
        kind = 'sph'
        if name in ('LMC',): kind = 'lmc'
        elif name in ('SMC',): kind = 'irr'
        elif name in ('M 32', 'NGC 205', 'NGC 185', 'NGC 147'): kind = 'ell'
        elif hi: kind = 'irr'
        R = max(rh * 2.2, 0.15)
        extra = {'ell': ell}
        if name == 'LMC': R = 5.5; extra.update({'label': 'Large Magellanic Cloud', 'sub': '163,000 light-years'})
        if name == 'SMC': R = 3.0; extra.update({'label': 'Small Magellanic Cloud', 'sub': '200,000 light-years'})
        if name == 'Sagittarius': extra.update({'label': 'Sagittarius Dwarf', 'sub': 'being torn apart by the Milky Way'})
        add(name, float(r['ra']), float(r['dec']), d, MV, kind, R, 30 if name == 'LMC' else None, pa, extra)
json.dump(lg, open(f'{OUT}/galaxies/localgroup.json', 'w'), indent=0)
print('local group', len(lg))

# ---------------- 3. 2MRS (Huchra et al. 2012) -> the real nearby cosmic web ----------------
H0 = 70.0
NEAR = {  # galaxies whose Hubble distance is wrong (peculiar velocities dominate): literature distances in Mpc
    'MESSIER_081': 3.6, 'MESSIER_082': 3.5, 'NGC_0253': 3.5, 'NGC_5128': 3.8, 'NGC_4945': 3.7, 'MESSIER_083': 4.7,
    'IC_0342': 3.3, 'MESSIER_101': 6.9, 'MESSIER_094': 4.7, 'NGC_0055': 2.1, 'NGC_0300': 2.0, 'NGC_2403': 3.2,
    'NGC_4258': 7.6, 'MESSIER_051A': 8.6, 'MESSIER_104': 9.6, 'NGC_6946': 7.7, 'MAFFEI_1': 3.0, 'MAFFEI_2': 3.4,
    'CIRCINUS_GALAXY': 4.2, 'NGC_1313': 4.3, 'NGC_7793': 3.9, 'NGC_4736': 4.7, 'NGC_5236': 4.7, 'NGC_3031': 3.6,
}
LG_NAMES = {'MESSIER_031', 'MESSIER_033', 'MESSIER_032', 'MESSIER_110', 'NGC_0205', 'NGC_0185', 'NGC_0147', 'IC_0010', 'NGC_6822', 'IC_1613', 'LMC', 'SMC'}
gal = []
with open(f'{S}/dl_2mrs/catalog/2mrs_1175_done.dat') as f:
    for line in f:
        if line.startswith('#'): continue
        p = line.split()
        if len(p) < 28: continue
        ra, dec, gl, gb, k = float(p[1]), float(p[2]), float(p[3]), float(p[4]), float(p[5])
        ba = float(p[20]); typ = p[22]; v = float(p[24]); cat = p[28] if len(p) > 28 else ''
        if cat in LG_NAMES: continue
        d = NEAR.get(cat, v / H0)
        if d < 1.8 or d > 215: continue
        try:
            T = int(typ[:2]) if typ[:2].lstrip('-').isdigit() else int(typ[:1]) if typ[:1].isdigit() else 98
        except ValueError:
            T = 98
        MK = k - 5 * math.log10(d * 1e6 / 10)
        gal.append([ra, dec, gl, gb, d, MK + 3.0, T, ba, 0])
gal = np.array(gal, dtype=np.float64)
# Zone of avoidance (2MRS: |b| < 5 deg, < 8 deg toward the bulge): fill by reflecting the adjacent strip (cloning)
lw = np.where((np.abs(((gal[:, 2] + 180) % 360) - 180) < 30), 8.0, 5.0)
src = (np.abs(gal[:, 3]) > lw) & (np.abs(gal[:, 3]) < 2 * lw)
clone = gal[src].copy()
clone[:, 3] = np.sign(clone[:, 3]) * (2 * lw[src] - np.abs(clone[:, 3]))
clone[:, 8] = 1
# convert cloned galactic (l, b) back to RA/Dec (IAU J2000 galactic -> equatorial)
Mgal = np.array([[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.4448296300, 0.7469822445], [-0.8676661490, -0.1980763734, 0.4559837762]])
lr, br = np.radians(clone[:, 2]), np.radians(clone[:, 3])
vg = np.stack([np.cos(br) * np.cos(lr), np.cos(br) * np.sin(lr), np.sin(br)], -1)
ve = vg @ Mgal  # galactic -> equatorial (Mgal maps eq -> gal as rows)
clone[:, 0] = np.degrees(np.arctan2(ve[:, 1], ve[:, 0])) % 360
clone[:, 1] = np.degrees(np.arcsin(np.clip(ve[:, 2], -1, 1)))
gal = np.concatenate([gal, clone])
u = eq_unit(gal[:, 0], gal[:, 1]) * gal[:, 4:5]
# random but fixed position angle; b/a gives the inclination
out = np.zeros((len(gal), 7), dtype=np.float32)
out[:, 0:3] = u; out[:, 3] = gal[:, 5]; out[:, 4] = gal[:, 6]; out[:, 5] = gal[:, 7]; out[:, 6] = gal[:, 8]
order = np.argsort(out[:, 3])  # brightest first
out = out[order]
out.tofile(f'{OUT}/galaxies/web2mrs.bin')
print('2mrs', len(out), 'clones', int(out[:, 6].sum()))

# filament glow: smoothed galaxy density (cells of 6 Mpc) -> soft puffs
cell = 6.0
key = np.floor(out[:, :3] / cell).astype(np.int64)
uk, inv, cnt = np.unique(key, axis=0, return_inverse=True, return_counts=True)
cen = np.zeros((len(uk), 3)); np.add.at(cen, inv.ravel(), out[:, :3]); cen /= cnt[:, None]
keep = cnt >= 3
puffs = np.zeros((keep.sum(), 5), dtype=np.float32)
puffs[:, 0:3] = cen[keep]; puffs[:, 3] = cell * (0.9 + 0.25 * np.log(cnt[keep])); puffs[:, 4] = np.log(cnt[keep])
puffs.tofile(f'{OUT}/galaxies/puffs2mrs.bin')
print('puffs', len(puffs))

# ---------------- 4. procedural far web (beyond the 2MRS depth, to the edge of the observable universe) ----------------
R_OBS = 14260.0  # Mpc, comoving radius 46.5 Gly
def hash3(ix, iy, iz, s):
    h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (s * 2654435761)
    h = h & 0xffffffff
    h = (h ^ (h >> 16)) * 0x45d9f3b & 0xffffffff
    h = (h ^ (h >> 16)) * 0x45d9f3b & 0xffffffff
    h = h ^ (h >> 16)
    return (h & 0xffffff) / float(0x1000000)
def web_weight(p, lam):
    c = np.floor(p / lam).astype(np.int64)
    ds = []
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                ix, iy, iz = c[:, 0] + dx, c[:, 1] + dy, c[:, 2] + dz
                sp = np.stack([(ix + 0.15 + 0.7 * hash3(ix, iy, iz, 1)), (iy + 0.15 + 0.7 * hash3(ix, iy, iz, 2)), (iz + 0.15 + 0.7 * hash3(ix, iy, iz, 3))], -1) * lam
                ds.append(np.linalg.norm(p - sp, axis=1))
    ds = np.sort(np.stack(ds, -1), axis=1)
    f1, f2, f3, f4 = ds[:, 0], ds[:, 1], ds[:, 2], ds[:, 3]
    w = lam * 0.075
    return 0.85 * np.exp(-((f3 - f1) / w) ** 2) + 0.6 * np.exp(-((f4 - f1) / (w * 1.4)) ** 2) + 0.12 * np.exp(-((f2 - f1) / w) ** 2) + 0.01
far = []
k = 0; R0 = 150.0
while R0 * 2 ** k < R_OBS:
    ra_, rb_ = R0 * 2 ** k, min(R0 * 2 ** (k + 1), R_OBS)
    lam = min(60.0 * 2 ** k, 420.0)
    N = 1700; got = []
    while sum(len(g) for g in got) < N:
        n = 40000
        r3 = np.exp(rng.uniform(np.log(ra_), np.log(rb_), n))  # log-uniform: density ~ r^-3, continuous across shells
        v = rng.normal(size=(n, 3)); v /= np.linalg.norm(v, axis=1)[:, None]
        p = v * r3[:, None]
        if k == 0:  # blend with the 2MRS depth: probability ramps up from 150 to 260 Mpc (by position, not by zoom)
            keepr = rng.uniform(size=n) < np.clip((r3 - 150) / 60, 0, 1)
            p = p[keepr]
        wgt = web_weight(p, lam)
        acc = rng.uniform(size=len(p)) < wgt
        got.append(p[acc])
    pts = np.concatenate(got)[:N]
    rr = np.linalg.norm(pts, axis=1)
    w = web_weight(pts, lam)
    for i in range(len(pts)):
        far.append([pts[i, 0], pts[i, 1], pts[i, 2], rr[i], rng.normal(), lam * (0.18 + 0.25 * min(1, w[i])), k])
    print('shell', k, ra_, rb_, 'lam', lam, len(pts))
    k += 1
far = np.array(far, dtype=np.float32)
far.tofile(f'{OUT}/galaxies/webfar.bin')
json.dump({'webfar': {'fields': ['x', 'y', 'z', 'R', 'gauss', 'puffR', 'shell'], 'unit': 'Mpc', 'count': len(far)},
           'web2mrs': {'fields': ['x', 'y', 'z', 'MV', 'T', 'b/a', 'zoaClone'], 'unit': 'Mpc', 'count': int(len(out))},
           'puffs2mrs': {'fields': ['x', 'y', 'z', 'R', 'logN'], 'unit': 'Mpc', 'count': int(len(puffs))}}, open(f'{OUT}/galaxies/web.json', 'w'), indent=1)
print('far', len(far))

