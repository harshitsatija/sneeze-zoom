# UNIFY: one artist, every scale (the unification pass)

The user approved this pass after blind reviewers kept scoring 3–6/10, with "different artist" at almost every scale. Only z -3.8 … -4.6 (the macrophage battle) was judged "same artist as the reference". The cause: parallel builders, each with its own palette and shading. This pass is done by ONE owner, sequentially, through `core/look.js`.

## The reference (what "the same artist" means)
`shots/ref_inside-4.05.png` and refs/kz/immune-actually/05.jpg, 11.jpg. Swatch of the library: `shots/swatch.png`.
- **A DARK SATURATED MEDIUM** fills the frame. Its colour is `look(z).medium`, one ramp over all 62 decades, drifting slowly. Not grey, not near-black navy, never a hard palette flip between neighbouring scales.
- **Objects come from the same accent FAMILIES at every scale** (`FAM.magenta`, `cyan`, `gold`, `violet`, `coral`, `lime`, `skin`). A frame uses 2–3 families plus the medium.
- **Every solid object is drawn with `body()` / `orb()`:** base, darker crescent away from the light, lighter crescent toward it, small flat highlight, optional lighter core. No smooth gradients on objects, no glossy specular, no outlines, no hairline strokes as the main shape.
- **Depth uses three layers:**
  - **Far:** objects sunk toward `look(z).haze` (use `sink()`, 50–70 %) and blurred by the engine's depth of field. Cool families only; gold and coral sunk turn brown.
  - **Hero:** sharp, saturated, at the focus.
  - **Near:** 1–3 big soft `bokeh()` shapes that pass the camera.
- **Translucent materials** (mucus, gas, membranes, nebulae) use `gel()`: one constant alpha with a lighter core.
- **Glow** (`halo()`) only on luminous or active things: the Sun, stars, infected cells, quarks.
- **Light** comes from the upper left (`UL` in unit space).
- **Density per frame:** 1 hero, 3–8 supporting objects, a sunk far layer, 1–3 near bokeh. Never an empty wash; never wall-to-wall clutter.
- **Each decade needs a distinct idea** (no repeated motif for decades), but always built from these same pieces.
- **Labels:** ≤ 1 per level, beside the object, never over empty space, never on the wrong object.

## The method for each scale
1. Render the current frames (tools/film.mjs or strip.mjs).
2. Place the frame next to ref_inside and the swatch.
3. Replace that level's custom colours and shading with `look` / `FAM` / `body` / `orb` / `gel` / `bokeh` / `sink` / `halo`. Keep the real geometry, data, positions and transition mechanics.
4. Strip both neighbouring boundaries; sweep with no FAIL.
5. Write 3 lines in UNIFY-LOG.md: what changed, the before/after strip paths, what is still wrong.

## Phases (sequential, same owner)
- **A. Below the nucleus, z -5.5 → -34.6 (worst).** Files:
  - levels/nucleus.js, nuc-*.js, dna.js, shared/nucleosome.js (chromatin, nucleosome, DNA, atom);
  - levels/nucleus12.js, quarks.js, sub-field.js, shared/nucleon.js (nucleus, proton, quark, desert, Planck).

  Known defects:
  - the nucleus becomes topo-map contour rings (z -4.9 … -5.2);
  - a muddy teal fog at -5.47 and a snap to violet;
  - chromatin is pink beads wired with blue lines, like a molecular viewer;
  - clutter at -7 … -8;
  - glossy specular atoms; the hero atom is a pasted navy ball;
  - an empty blue wash at -10.1;
  - a palette flip at almost every decade below -10;
  - the quark → Planck range is all the same soap-bubble motif;
  - the proton interior is pasted on;
  - LHC and desert labels float.
- **B. City and map, z 1.5 → 7.**
  - Files: street.js, city-*.js, earth.js, earth-*.js, region.js.
  - Known defects: pale lavender "GIS map" look; Met model swap at z 2.0–2.7; purple slab at 4.8–5.3; cloud look swap at 6.7–7.1; clouds over labels; no crescent shading on roofs or land.
  - Target: Kurzgesagt nuke-city/02 and nuke-all-earth/07 saturation, with roofs lit and walls shaded by `FAM`-based materials.
- **C. Space, z 7 → 27.2.**
  - Files: solar*.js, stars.js, galaxy.js, space-*.js, shared/star.js, galaxy.js.
  - Known defects:
    - muddy violet bokeh soup (too much haze; make the medium darker and subjects crisper);
    - Jupiter label on the Sun; the Moon label with no visible Moon;
    - the Sun's size jumps at 10.2 → 10.6 → 11.0;
    - the Milky Way's look switches at 19.8 / 20.4 / 21.1;
    - Andromeda pops; the web pops in at 23.5 → 23.9 and collapses at 24.9 → 25.3;
    - a pasted cyan bokeh disc;
    - the edge-of-universe shell is a thin ring.
- **D. Face → nucleus, z 1.0 → -5.5 (liked; polish only).**
  - Files: man.js, hero-figure.js, nose.js, mucosa.js, body-septum.js, macrophage.js, shared/immune.js, city-life.js, city-met.js.
  - Known defects:
    - the street is a chalky pale lavender (it needs the saturated lilac `look(-1)` medium);
    - the man has too little crescent shading;
    - the label floats away from him;
    - the raised hand is a floating mitten;
    - a dark purple "spotlight" shows the destination in the lining from -2.3;
    - the epithelium reads as static noise at -3.0 … -3.4;
    - labels swap three times.
