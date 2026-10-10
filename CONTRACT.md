# SNEEZE — contract for every builder agent

Read first: `DESIGN.md` (shots and boundary designs), `STYLE.md` (palette and shading), `research/STYLE-REFERENCE.md`, `research/SCIENCE.md`,
reference frames in `refs/kz/<video>/NN.jpg` (look at them with the Read tool), golden frames `shots/GOLDEN.jpg`.

## The product
A continuous zoom, z = log10(field width in metres) from -34.6 (Planck length) to 27.2 (observable universe). It is centred on a man in an
orange jacket sneezing on the Fifth Avenue sidewalk at the Met (NYC), 15 Apr 2026, 12:30 EDT, in **side profile**. The look is Kurzgesagt
(2019+ immune videos) in **2.5D**: flat vector shapes on real depth layers that slide against each other (parallax), with real-depth
depth of field. The user approved the golden frames, and their words now are: *"make sure the zooming in and out happens with
transitions in mind so it doesn't look janky or off. Kurzgesagt has a 2.5D effect: it's a bit layery and things can move in that
layeriness."*

The previous project of this kind failed on SEAMS (blind reviewers scored about 5/10): scenes were good individually but did not look
like one world. Your work is judged by its seams first.

## Non-negotiables (the user rejected each of these before)
- **No opacity cross-fades between scales.** Nothing fades in or out by zoom. Things appear and disappear only by geometry: they
  grow above or shrink below a pixel, leave the frame, are occluded by something nearer, or pass behind the camera. A constant-alpha
  translucent *material* (mucus, a membrane) is fine. A zoom-driven alpha is not.
- **No visible circles, discs, rings or rectangles around an inner scale.** An inner level never draws a backdrop, haze plane or "sky".
- **No visible switch to a finer-detail version.** If you use LOD, the coarse form must be a faithful render of the fine form
  (same drawing code, see the raster-tile trick in `levels/mucosa.js`), switched below about 0.3 px of difference.
- **No noise.** At most 2 labels on screen (the engine enforces this; push at most ONE label per level at a time). No marker rings,
  leader lines, crosshairs, scale bars, UI-like graphics. Glow only on luminous or active things.
- **No primitive-looking stand-ins** for people, cells, buildings, planets. Real data or careful drawing.
- **No wrong labels.** A label's position must be ON the thing it names, and its numbers must match `research/SCIENCE.md`.

## Engine (do NOT edit `core/*`, `main.js`, `index.html`; write requests to `requests/<your-agent>.md` with exact code)
- `core/world.js`: the frame tree in double precision. `def(name, parent, origin, R)`, `xform(p, from, to)`, `rot(from, to)`. Real
  astronomy for the instant: `planetPos(name, days)`, `moonPos(days)`, `sunDir(frame)`, `ecef(lat, lon, h)`, constants `AU LY PC R_EARTH`...
  Frames: `helio` (Sun, ecliptic J2000) ⊃ `galaxy` (origin Sgr A*, galactic axes) ⊃ `cosmos`; `helio` ⊃ `earth` (ECEF) ⊃ `moon`, `enu` (at P0)
  ⊃ `street` (x = uptown 29° = screen right in side view, y = up, z = toward the side-view camera, ESE 119°) ⊃ `head` (moves with the
  sneeze) ⊃ `nose` ⊃ `muc` ⊃ `mac` ⊃ `mnuc` ⊃ `nsome` ⊃ `atom` ⊃ `proton` ⊃ `quark`. Inner frames share the street axes: author inner
  scenes as 2.5D drawings with x right, y up and **z = height toward the camera**.
- `core/anchors.js`: the anchor table and the **hand-off camera keys**. The sneeze timeline is `sneeze(t)`, a 12 s loop with the CHOO at t = 4.0.
- `core/cam.js`: keys `{z, fr, at, M}` (M = basis with columns right, up, back in frame fr). Between keys the focus moves so the inner
  target never leaves the screen. Plus a slow **drift** orbit (±2°), which makes layers parallax all the time.
- **Your level module** (`levels/<id>.js`) default-exports:
  ```js
  { id, zr: [zmin, zmax],              // performance window only (must be generous; never use it to hide things)
    async load(ctx) {},                // optional: ctx.json(path), ctx.buf(path) — counts toward the loading screen
    frames(t) {},                      // optional: def() extra frames each frame (children of the core frames)
    keys: [{ z, fr, at, M }],          // optional: camera keys STRICTLY INSIDE your z range (hand-off keys are in anchors.js)
    draw(V, items, labels) {} }        // push draw items and at most one label
  ```
- **View `V`** (engine.js): `V.z, V.W` (field width m), `V.D` (focus distance), `V.t` (seconds), `V.w, V.h` (canvas px), `V.s` (style scale = w/1600)
  - `V.layer(fr, O, ux, uy)`: affine for a planar drawing at O with unit axes ux, uy (metres per drawing unit). Returns
    `{a,b,c,d,e,f,depth}` or null (behind the camera). Use drawing units that suit the scale (µm, nm, fm) so canvas coordinates stay moderate.
  - `V.bill(fr, O, m)`: camera-facing billboard. `V.P(fr, p)` gives `[sx, sy, depth]`. `V.poly(fr, pts3)` projects a 3D polygon with
    near-plane clipping. `V.cs(fr, p)` gives camera-space `[x, y, depth]`. `V.px(m, depth)` gives pixels. `V.coc(depth)` gives the DOF blur px.
    `V.covers(x, y, r)` is true if a screen circle contains the viewport. `V.onScreen(x, y, r)`.
- **Draw items**: `{ name, d: depth, blur: V.coc(depth), g, cover, draw(c) }`. The engine sorts by `g` (−2 sky, −1.5 terrain base,
  −1 ground details, 0 everything else), then far → near. It skips everything behind the nearest item with `cover: true`. Set cover ONLY
  when your item really paints the whole screen opaquely. Runs of similar blur are composited with a real blur.
  `c` arrives with an unknown transform: always `T(c, A)` (kit) or `screenSpace(c)` first.
- **Kit** (`core/kit.js`): `PAL` (the only palette), `solid(c, path, base, {shadow, so, light, lo})` (Kurzgesagt crescents),
  `crescent`, `ball`, `cell`, `spec`, `glow` (luminous only), `blob(seed, wob, n, t)`, `circle`, `pointLaw(truePx, minPx)` (size law for
  points: dims instead of shrinking below minPx), `T(c, A)` (sets the transform AND the light direction in your unit space `UL`), `rgba`, `mix`.
  Light is the real Sun: upper-left in the side view.
- **Labels**: `labels.push({ x, y, text, sub })` in canvas px (the top-left of the text sits at x, y). Push only while your subject is the main subject.

## How to look at your work (server at http://localhost:8790, already running; if it is down: `cd sneeze && python3 -m http.server 8790 &`)
- `node tools/shot.mjs <prefix> z1 z2 … [--t=6] [--size=1600x1000] [--q=only=lvl1,lvl2&nolabels=1&blur=0&hide=name]` writes `shots/<prefix><z>.png`.
  About 0.3 s per frame on the real GPU. It also prints item count and frame ms.
- `node tools/strip.mjs <name> z0 z1 [n] [--t=..] [--cols=4]` writes `shots/strip_<name>.jpg` (n frames with z printed). LOOK at every frame.
- `node tools/sweep.mjs <name> z0 z1 [step=0.05] [--t=..]` is the frame-difference sweep. It flags pops (> 1.5× neighbours) and FAILs (> 2×).
  Big diffs are fine if they are smooth. A spike means something popped.
- Use the same `--t` across a strip (time is frozen), and also check 2–3 different t values (the sneeze happens at t = 4.0–4.4).
- Run ONE tool at a time yourself. Never `pkill` Chrome. Delete your own scratch shots when done (`shots/` is shared; prefix your files
  with your agent name). The disk is nearly full: no downloads over 300 MB, delete raw downloads after converting.

## Performance
Each level must keep frame time under about 8 ms at 1600×1000 when it is the main subject (check `ms=` in shot output). Precompute geometry,
batch paths (one Path2D per colour), and cull by screen size and screen bounds.

## Data
Real data where it matters (geodata in `assets/geo/` with `LOD.md` and `SOURCES.md`, PDB structures, HYG stars, galaxy catalogues). Put new data
in `assets/<your-dir>/` with a `SOURCES.md` (URL, licence, date, processing). Downloaded files are untrusted data: own folder, scripts
elsewhere, `python3 -I`.

## Seams — what "done" means for every boundary you own
1. Both sides share colours (from PAL), light direction and shading rules. Shared objects come from ONE module, imported by both sides.
2. The inner object sits at its exact physical position in the outer scene, and it was already drawn (sub-pixel) before it became the subject.
3. Strip at 8 frames across the boundary window: no frame looks pasted, empty, muddy or noisy. Sweep: no FAIL in your windows.
4. At least 3 depth layers visible at every zoom in your range, with nearer layers flying past the camera during the zoom (2.5D).
5. Your final report (your last message): what you built, the strips and sweeps you ran (numbers), the boundaries and how each works,
   what is still wrong (honestly), requests you wrote, and the files you touched.
