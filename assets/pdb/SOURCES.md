# assets/pdb — sources

## 1kx5.bin / 1kx5.json — nucleosome core particle
- Source: RCSB PDB entry **1KX5**, "X-ray structure of the nucleosome core particle at 1.9 Å resolution" (Davey, Sargent, Luger,
  Maeder, Richmond, J. Mol. Biol. 319:1097, 2002). 147 bp palindromic DNA (chains I, J) wrapped 1.65 turns around the histone
  octamer (H3 A/E, H4 B/F, H2A C/G, H2B D/H).
- URL: https://files.rcsb.org/download/1KX5.pdb (downloaded 2026-10-09). Licence: PDB data are public domain (CC0 1.0),
  https://www.rcsb.org/pages/usage-policy
- Processing (`python3 -I conv.py`, script kept outside this folder): all 13,607 `ATOM` records (no hydrogens, no alternate
  locations in this entry; waters/ions in `HETATM` dropped). Coordinates moved to a canonical nucleosome frame:
  origin = centroid of the histone atoms, z = superhelical axis (normal of the best plane through the DNA phosphorus atoms,
  smallest principal axis), y = dyad (toward base pair I:0 / J:0), x = y × z. The original origin and axes are in `1kx5.json.frame`.
- Binary layout (little endian, 12 bytes per atom, file order = PDB order):
  `int16 x, y, z` (units of 0.01 Å) · `uint8 type` (0 DNA backbone, 1 DNA base, 2 H3, 3 H4, 4 H2A, 5 H2B) ·
  `uint8 element` (0 C, 1 N, 2 O, 3 P, 4 S) · `uint8 chain index` (DNA: 0 = I, 1 = J; protein: index in "ABCDEFGH") ·
  `uint8 name code` (1 C1', 2 C2', 3 C3', 4 C4', 5 C5', 6 P, 7 O4', 8 CA, 0 other) · `int16 residue number`.
- The raw PDB file was deleted after conversion.
