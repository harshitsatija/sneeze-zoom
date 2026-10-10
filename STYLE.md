# SNEEZE style spec (from refs/kz, research/STYLE-REFERENCE.md)

Kurzgesagt 2019+ look, 2.5D: flat vector shapes on real depth layers, real-depth depth-of-field. One artist, one session.

## Palette (core/kit.js `PAL` is the only source of colour)
| Use | Hex |
|---|---|
| Body background deep / deeper / far | `#1d033b` / `#0f0020` / `#3a1670` |
| Tissue ring / lit lip / cytoplasm | `#9b0885` / `#c61885` / `#1a0149` |
| Nucleus / lit / spec | `#1f70ab` / `#52b8d5` / `#a8f0ff` |
| Macrophage / dark / lit core / granules | `#d5207b` / `#8b0167` / `#ec4f9f` / `#f07ab8` |
| Neutrophil body / spikes | `#640b52` / `#ec6451` |
| Lymphocyte ring / rim / core | `#1c70a9` / `#72c5de` / `#202a58` |
| Virus / mesa | `#e50a68` / `#48cedd` |
| Inflamed glow / hot | `#f0f47e` / `#fffbe0` |
| Mucus (constant alpha material) | `#7fe3c4` |
| Skin / shade plane / deep / cold nose | `#f49065` / `#e2725e` / `#c4504f` / `#ec5f55` |
| Hair / jacket / jacket shade / jeans | `#2f0a47` / `#e86531` / `#c2452c` / `#2a2a7a` |
| Sky top / mid / horizon | `#2f8fd8` / `#5fb8ec` / `#bfe9ff` |
| City: road / walk / wall / roof / park canopy | `#2c2470` / `#8b7fd6` / `#6142c4` / `#cdb7f8` / `#2f9a78` |
| Ocean day / night, land day / night, ice | `#2d91cf` / `#1e69ca`, `#48c671` / `#2f9a78`, `#e8f2ff` |
| Space | `#0b1435` |
| Sun / rim / hot | `#f7d72d` / `#e49926` / `#fffbd0` |

Max ~5 hues per frame. Darks are saturated violet or navy, never grey or black.

## Shading
- Objects use stacked flat fills, never multi-stop gradients: base, a darker crescent on the far side (shape offset toward the light, XOR-clipped) and a lighter crescent or flat highlight ellipse toward the light.
- Cells get a bright membrane ring and a darker interior offset toward the light. People get hard two-tone planes (lit face, shaded jaw/neck).
- No outlines. Thin round-capped strokes only for linear things (cilia, hair, DNA, orbits).
- **One light.** The real Sun at 12:30 EDT, 15 Apr 2026 (az 168°, el 59°). In the side view that is the upper left, and `kit.UL` converts it into every drawing's own unit space. Planets are lit from the actual Sun.
- Glow (additive radial) only on luminous or active things: infected cells, the Sun, stars, the atmosphere rim.

## Depth
- Real perspective (fov 34°).
- Blur = 18 px × |1 − D_focus / d| (at 1600 px width, capped at 58 px). It is on for body and face scales and ramps to 0 over z 1.0 → 2.2. Aerial and space views are sharp.
- Foreground silhouettes are real objects at real heights (airborne debris, hairs, mucus rafts), so they fly past the camera.
- Vignette: corners about 30% darker. Constant; it belongs to the lens.

## Shape language
- Organic shapes are rounded blobs (5–7 low-frequency lobes, ±6–12% radius).
- Macrophages have constant-width tentacles with round tips. Neutrophils are spiky balls. Epithelium is rounded Voronoi cells with dark gaps.
- Detail appears only when it is larger than a pixel. There are never two drawings of one object: raster LOD tiles are rendered by the same code as the vector version.

## Density
- Body frames: one hero, 3–8 supporting actors, a field of background cells, 0–3 blurred foreground shapes.
- At most 2 labels, plain text.

## Forbidden
Opacity cross-fades between scales. Discs, rings or rectangles around inner scales. Visible switches to a finer version. Inner backdrops. Outlines. Grey. Pure black. More than 2 labels. UI graphics in the scene. Primitive stand-ins.
