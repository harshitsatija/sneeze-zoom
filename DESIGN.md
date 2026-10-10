# SNEEZE — design: shots, frames, transitions (written before any scene code)

One continuous world. A man stands on the Fifth Avenue sidewalk in front of the Metropolitan Museum of Art steps, mid-April,
~15:30 EDT, sunny. He looks up toward the bright afternoon sky (photic sneeze reflex) and sneezes. He has a rhinovirus cold.
The camera starts on his face in **side profile** and zooms continuously in (to the Planck length) or out (to the observable
universe). z = log10(field width in metres at the focus point). Range z ∈ [-34.6, 27.2], start z = -0.55.

## 0. The one rule for every transition
Nothing ever fades by zoom. Every object exists in one 3D world at its real position and real size; it leaves the frame only by
(a) shrinking below a pixel, (b) leaving the frame edge, (c) being occluded by something nearer, or (d) passing behind the camera.
Every boundary below is designed as a camera move through a real feature (strategy B) or as physical nesting of a real
sub-part that was already drawn (strategy C). Shared objects are defined once (`/shared/*.js`) and drawn by both sides.

## 1. Engine model (what makes the transitions possible)
- Real perspective camera (fov 34° horizontal), positioned at distance D = W / (2 tan 17°) ≈ 1.64 W from the focus point.
  Zooming in = the camera physically flies toward the focus. Layers nearer than the focus grow faster and fly past the camera
  (that is the Kurzgesagt fly-through look and our main transition tool). Layers behind the camera are not drawn.
- Frame tree in double precision (each frame: parent, origin in parent metres, rotation). Camera pose is authored in the
  frame that is active at that zoom and transformed to every other frame. No global float positions.
- Everything is flat vector art drawn with Canvas2D (crisp at any magnification). Two primitive kinds:
  1. *Planar layers* (a 2D drawing on a plane in 3D): drawn with an affine transform from 3 projected points. Cells,
     the man, the face, facades, planets-as-discs, galaxies.
  2. *Projected geometry* (ground maps, building walls/roofs, orbits): per-vertex projection with near-plane clipping.
- One global painter's sort by camera distance across all levels. Inner content behind an opaque outer surface is simply
  drawn first and covered. Items behind the nearest full-screen opaque item are skipped (performance only).
- Depth of field from real depth: blur px = A · |1 − D_focus / d|, applied per item (Kurzgesagt foreground/background blur).
- One light: the real Sun direction for 40.779 N, 73.963 W, 15 Apr, 15:30 EDT (from the SW, ~40° up). In side view this
  lights everything from the upper right, slightly in front. Inner scales use the same view-space direction (upper right).
  Space scales light planets from the actual Sun position.

## 2. Shot list (z windows are where each subject is the main subject; neighbours overlap physically)

| # | Subject | z window | Frame | Camera |
|---|---|---|---|---|
| S25 | Observable universe, CMB shell, cosmic web | 23.3 … 27.2 | cosmos | slow orbit, oblique |
| S24 | Local Group (MW, M31, M33, LMC/SMC + dwarfs) | 21.6 … 23.3 | cosmos | oblique |
| S23 | Milky Way (Sun in Orion Spur, 26 kly from centre) | 19.0 … 21.6 | galaxy | 50° above the disc |
| S22 | Nearest stars (real HYG positions) | 16.3 … 19.0 | galaxy | |
| S21 | Heliosphere, Oort cloud | 13.5 … 16.3 | helio | |
| S20 | Outer solar system | 12.0 … 13.5 | helio | 35° above ecliptic |
| S19 | Sun + inner planets (real positions for the date) | 9.5 … 12.0 | helio | orientation turns from "down on NYC" to ecliptic-oblique |
| S18 | Earth + Moon | 8.0 … 9.5 | earth | |
| S17 | Earth disc, NYC in afternoon light, clouds | 6.3 … 8.0 | earth | straight down on NYC |
| S16 | NE US coast, Long Island, NJ | 4.8 … 6.3 | earth | straight down |
| S15 | Manhattan + boroughs | 3.9 … 4.8 | enu | straight down |
| S14 | Upper East Side, Central Park, Met roof | 2.8 … 3.9 | enu | straight down (pitch 90°) |
| S13 | Fifth Ave + Met facade, crane up | 1.4 … 2.8 | enu | pitch 0° → 90°, rising |
| S12 | The man on the sidewalk, Met behind, taxi in front | -0.4 … 1.4 | enu | side view, eye level, looking east |
| S11 | Face in profile, mid-sneeze | -1.6 … -0.4 | head | side view |
| S10 | Into the nostril: vestibule tunnel, hairs | -2.2 … -1.6 | head | flying in through the nostril |
| S9  | Septum mucosa, mucus rafts, trapped virions/pollen | -3.0 … -2.2 | mucosa | facing the wall |
| S8  | Epithelium battlefield: ciliated cells, infected cells bursting, neutrophils, macrophages | -4.3 … -3.0 | mucosa | |
| S7  | Inside a macrophage: phagosomes with virions, lysosomes, mitochondria, nucleus | -5.2 … -4.3 | mac | through the top membrane |
| S6  | Nucleus: chromatin, nuclear pores | -7.7 … -5.2 | mac | through the nuclear envelope |
| S5  | Nucleosome / DNA double helix (real PDB atoms) | -9.8 … -7.7 | dna | |
| S4  | A carbon atom: electron cloud, "empty" | -13.8 … -9.8 | atom | |
| S3  | Carbon-12 nucleus: 6 p + 6 n | -15.3 … -13.8 | atom | |
| S2  | Proton: 3 valence quarks, gluon flux tubes, sea quarks | -19.0 … -15.3 | atom | |
| S1  | "The desert": vacuum fluctuations, self-similar | -33.0 … -19.0 | atom | |
| S0  | Planck length, spacetime foam | -34.6 … -33.0 | atom | end |

## 3. Boundaries (designed as shots)

| ID | Pair | z window | Strategy | Mechanism |
|---|---|---|---|---|
| b-face-man | S11/S12 | -0.9 … 0.2 | C (one object) | The man is ONE character drawing; the head IS the face. Features < 0.6 px are skipped, so detail comes and goes by size only. Background Met facade (real position, 14 m behind) gets sharper as the focus distance grows (DOF follows physics). |
| b-man-crane | S12/S13 | 0.8 … 2.0 | C (one 3D scene) | Camera rises and pitches down. The man is a vertical cutout plus a horizontal "top" cutout (cross-billboard). Both are drawn always; each is edge-on in the view where it would look wrong. Pitch only changes once he is < 40 px tall. Met facade and roof come from one shared `met.js` building. |
| b-crane-ues | S13/S14 | 2.0 … 3.2 | C | Same buildings (one dataset), camera finishes the pitch to 90°. Street trees and people shrink below a pixel. Sky leaves the frame top as the horizon rotates out of view. |
| b-ues-man | S14/S15 | 3.4 … 4.4 | A (pixel-error LOD) | Individual buildings → block extrusions only when a block is < 4 px; the block's colour is the area-weighted mix of its buildings and ground. Coastline LOD switches only when the error is < 0.3 px. |
| b-man-region | S15/S16 | 4.4 … 5.4 | A | Same coastline at coarser LOD below 0.3 px error. Cloud layer (real altitude 1.5–3 km) passes the camera: clouds fly past as we zoom out. |
| b-region-earth | S16/S17 | 5.6 … 7.0 | C | The map is drawn on the sphere from the start (lon/lat → ECEF), so curvature appears by itself. Limb, atmosphere rim and terminator come in by geometry. |
| b-earth-moon | S17/S18 | 7.8 … 8.8 | C | Real Moon position for the date. |
| b-moon-sun | S18/S19 | 9.0 … 10.6 | C + camera turn | Focus slides from Earth to the Sun; orientation slerps from NYC-down to the ecliptic-oblique view. Earth's disc → point by size law. |
| b-inner-outer | S19/S20 | 11.6 … 12.4 | C | Real orbits as projected ellipses (thin, subtle). |
| b-ss-oort | S20/S21 | 13.2 … 14.2 | C | Heliopause as a faint shell; Oort cloud as sparse icy points (physical size law). |
| b-oort-stars | S21/S22 | 15.6 … 16.8 | C | The Sun becomes one star among HYG stars (same star renderer, size law follows camera width). |
| b-stars-mw | S22/S23 | 18.4 … 19.6 | C | Galaxy star clouds are large faint physical blobs, the camera is inside them near the Sun; real stars stay sharp points. |
| b-mw-lg | S23/S24 | 21.2 … 22.0 | C | One `galaxy.js` renders the MW and every Local Group galaxy. |
| b-lg-web | S24/S25 | 22.8 … 23.8 | C | The web's galaxy list contains the Local Group galaxies (one shared list). |
| b-face-nostril | S11/S10 | -2.0 … -1.2 | B (pass through a hole) | The face layer has a real nostril hole (evenodd). Behind it, at real depths, the vestibule is a stack of ring layers (a tunnel) with hairs. The camera flies through the hole; the face passes behind the camera only after the hole covers the whole frame. |
| b-nostril-mucosa | S10/S9 | -2.6 … -1.9 | B | Tunnel rings fly past; the far wall (septum mucosa) 15 mm deep grows to fill the frame. |
| b-mucosa-epi | S9/S8 | -3.4 … -2.6 | C + B | Mucus rafts (a translucent material, constant alpha) sit 8 µm above the cells, with gaps; camera descends through a gap. Cells were already drawn under the mucus at every zoom (sub-pixel until here). |
| b-epi-mac | S8/S7 | -4.7 … -4.0 | B (through a membrane) | The macrophage's top membrane is a dome built from nested annuli at real heights, translucent; as the camera descends a hole opens at the centre and grows outward. The organelles were visible through the membrane before. |
| b-mac-nuc | S7/S6 | -5.8 … -5.0 | B | Same dome pass through the nuclear envelope (double membrane with pores). |
| b-nuc-dna | S6/S5 | -8.0 … -7.0 | A (pixel LOD on a real structure) | Chromatin strands are chains of nucleosomes; a chain whose beads are < 1.5 px is drawn as a stroke of the same width and colour. The hero nucleosome is PDB 1KX5 (atoms). |
| b-dna-atom | S5/S4 | -10.2 … -9.4 | C | Atoms are soft electron-cloud spheres from the start; the camera dives into one carbon (C1′). Neighbouring atom clouds overlap at bonds. |
| b-atom-nuc | S4/S3 | -14.2 … -13.4 | C | The nucleus is drawn at all zooms; it is a bright point with a physical-size glow law, then 12 nucleons. |
| b-nuc-proton | S3/S2 | -15.6 … -14.8 | C | Dive into one proton (soft sphere); quarks + flux tubes were inside it all along. |
| b-proton-desert | S2/S1 | -19.4 … -18.4 | C | Dive into a quark's glow; vacuum fluctuation bubbles exist at every octave (lifetime ∝ size, real Δt ≈ size/c logic). |
| b-desert-planck | S1/S0 | -33.4 … -32.6 | C | Bubbles become spacetime foam: same generator, distortion grows near the Planck length. |

## 4. Time
A 12 s loop. 0–4 s "ah…": inhale, head tilts back 12°, eyes squeeze. 4.0–4.25 s "CHOO": spray cone (≈40 k droplets, 1 µm–1 mm,
real speeds up to ~ 30 m/s first 0.1 s, slowing), head snaps forward. 4.25–12 s cloud drifts and settles. Cells: cilia beat
12 Hz (rendered slowed), neutrophils crawl ~ 0.2 µm/s ×(time scaling), a macrophage slowly engulfs a virion clump.
Orbits are accelerated at solar scale; stars frozen.

## 5. Labels
Max 2 on screen, plain text, nearest the centre, each label tied to a position in its own frame and a z window.
Bottom readout: field width only ("Field of view · 25 cm"). Nothing else on screen.

## 6. Verification plan
puppeteer (one persistent Chrome on the real GPU) → `tools/strip.js` (8-frame filmstrip per boundary, z printed),
`tools/sweep.js` (step 0.05 over [-34.6, 27.2], mean abs diff, pop flags 1.5×/2×), `tools/bisect.js` (hide items), real-time check, blind reviewers.
