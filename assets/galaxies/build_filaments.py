# Filaments + nodes for the cosmic web, from the processed assets (run: python3 -I build_filaments.py <sneeze/assets>)
import sys
import numpy as np
OUT = sys.argv[1]
puffs = np.fromfile(f'{OUT}/galaxies/puffs2mrs.bin', dtype=np.float32).reshape(-1, 5)
far = np.fromfile(f'{OUT}/galaxies/webfar.bin', dtype=np.float32).reshape(-1, 7)

# ---------------- 5. filaments: minimum spanning tree of density peaks (Barrow, Bhavsar & Sonoda 1985) ----------------
def mst(P):
    n = len(P); inT = np.zeros(n, bool); inT[0] = True
    best = np.linalg.norm(P - P[0], axis=1); par = np.zeros(n, int); edges = []
    best[0] = np.inf
    for _ in range(n - 1):
        j = int(np.argmin(np.where(inT, np.inf, best))); inT[j] = True; edges.append((par[j], j, best[j]))
        d = np.linalg.norm(P - P[j], axis=1); upd = (~inT) & (d < best); best[upd] = d[upd]; par[upd] = j
    return edges
segs = []
# real: 2MRS density peaks (cells with >= 4 galaxies), edges longer than 16 Mpc pruned
pk = puffs[puffs[:, 4] >= np.log(4)]
for a, b, L in mst(pk[:, :3].astype(np.float64)):
    if L < 16: segs.append([*pk[a, :3], *pk[b, :3], (pk[a, 4] + pk[b, 4]) / 2, 0])
nreal = len(segs)
# statistical: per far shell, MST of its structures, edges longer than 1.6 x the shell's web scale pruned
for k in range(7):
    m = far[:, 6] == k; P = far[m][:, :3].astype(np.float64); lam = min(60.0 * 2 ** k, 420.0)
    for a, b, L in mst(P):
        if L < 1.6 * lam: segs.append([*P[a], *P[b], 1.0, k + 1])
segs = np.array(segs, dtype=np.float32); segs.tofile(f'{OUT}/galaxies/filaments.bin')
print('filaments', nreal, 'real', len(segs) - nreal, 'statistical')
# nodes: the richest 2MRS cells (clusters: Virgo, Coma, Perseus-Pisces, Centaurus, Norma ...)
nodes = puffs[np.argsort(-puffs[:, 4])][:260]
nodes.tofile(f'{OUT}/galaxies/nodes.bin')
print('nodes', len(nodes), 'min logN', nodes[:, 4].min())
