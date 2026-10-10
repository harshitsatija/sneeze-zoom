# SNEEZE: transitions v2 (written before any change; this is the plan every builder follows)

The user's verdict on v1: "Good attempt. Style needs to be more consistent. Space looks very different from the going-inside
style (which I like). Zooming in from the knees is jarring. Where we zoom in is very apparent. The man-sneezing frame has
lots of people and detail not in the same style. The man looks janky and stutters. It should read as one world. Think about
where transitions happen and how to make them less apparent."

## 1. One world: the four things that are identical at EVERY scale
1. **One vocabulary.** Everything is made from the inside-style primitives the user likes:
   - soft blobs with stacked flat fills;
   - a dark crescent on the far side and a flat highlight toward the light;
   - saturated violet/magenta/cyan/gold;
   - bokeh discs for out-of-focus things.
   No hairline geometry, no white noise speckle, no flat UI ellipses. Space objects (stars, planets, nebulae, galaxy arms, the web) are built from the SAME blob/crescent/bokeh pieces as cells and organelles.
2. **One depth language.** The same depth-of-field law at every scale, space included (it currently switches off at z 2.2):
   - a sharp focus plane, blurred near and far layers;
   - a few big soft bokeh shapes in the foreground;
   - the same vignette.
   Only the aerial city/map span (z 2.2–6.5) keeps light DOF, because a map must read.
3. **One medium colour.** The film's background tone is a single continuous function of scale:
   - violet-magenta inside the body;
   - warm daylight at human scale;
   - deep violet-indigo in space (`#170b45`).
   Space is no longer navy-black.
4. **One light.** Upper left everywhere (the real Sun).

## 2. Rules for every boundary
- **Never telegraph the destination.** The thing we enter is an ordinary, small, natural feature of the outer scene. It only becomes "a way in" in the last ~0.4 decade. Any special detail inside it (bright colour, contents) must be hidden by geometry until then, using occlusion, darkness or a bend.
- **The camera path never jumps framing.** The focus moves along one smooth curve. The subject stays near the centre and is never cut by the frame edge while it is the subject.
- **The hand-off frame is shared.** The last frame of scale A and the first of scale B contain the same objects in the same colours. The colour change happens over ≥ 1 decade, never inside one boundary window.
- **Something always passes the camera** (a foreground layer) in every boundary window. It masks the moment of entry and sells the 2.5D.

## 3. Boundary choreography (what changes vs v1)
| Boundary | v1 problem | v2 shot |
|---|---|---|
| body → face (z 0.6 → -0.4) | the head is cut off at z 0.3; the focus slides from chest to face | The focus stays on the HEAD from z 0.8 inward (eye level), so the man shrinks around his head. One key at z 0.8 at head height, and nothing between it and the face key. |
| face → nostril (z -0.6 → -2.2) | a big dark hole with lit contents is visible from z 0 | The nostril is drawn like any Kurzgesagt profile nostril: a small dark curved slit under the nose wing, with NO visible interior. The vestibule is a **bent tunnel**: from outside, every line of sight hits a dark wall. The camera ducks under the wing and follows the bend. The warm lit cavity (light through thin nasal skin glows red-pink) opens up only after the bend. Nose hairs pass the camera at the bend. |
| nostril → lining → cells | (v2 fixed the portal; keep it) | The mucus thins toward the battle, as now. |
| inside scales | liked by the user | Keep. Only fix colour jumps between scales. |
| space (z 7 → 27) | navy, thin lines, speckle: a different film | Restyled in the inside vocabulary:<br>• **Planets and Sun:** stacked-fill balls with crescents and soft glow halos, like the infected-cell glow.<br>• **Stars:** small flat glowing discs (bright ones with a 4-point flare, as in Kurzgesagt); background stars as soft dots, not 1 px noise.<br>• **Nebulae and galaxy arms:** chains of overlapping translucent blobs, like chromatin or mucus.<br>• **The cosmic web:** blob filaments, like the vessel network.<br>• **Space dust motes:** near-camera bokeh in magenta/cyan, the same as the body's floating particles.<br>• **Orbits:** soft wide coloured ribbons. |
| man sneezing frame | detailed people and Met in a different style | The background is drawn in the SAME character language as the man, but simpler, fewer and depth-tinted. People are full Kurzgesagt figures (same proportions and shading as the man), 6–10 of them, at mid and far depth, coloured toward the background tone. The Met is big simple shapes: columns, arches, banners, steps, warm stone. Built for blur. |
| the man | crude box jacket, blocky jaw facets | A high-fidelity Kurzgesagt character:<br>• **Face:** a refined profile with a soft jaw, layered hair with a highlight shape, eye with brow, ear and lips.<br>• **Clothing:** a jacket with collar, seams, sleeve folds and cuffs, plus jeans and sneakers.<br>• **Hands:** proper mitten hands.<br>• **Motion:** the sneeze acted out (anticipation, a head snap, a body recoil).<br>Cached paths, so it costs no more than now. |
| spray | pink speckle noise | Flat shaded droplets (disc + highlight) for the big ones, plus a soft mist made of a few translucent blobs. No speckle noise. |
| performance at street scale | stutters | Fewer blur runs (group the background into ≤ 3 depth bins), cached character paths, a cheap backdrop. Target ≤ 12 ms per frame at 1440×900 @1.5×. |

## 4. Acceptance
- Strips of every boundary, side by side with an inside-style frame (z -4).
- Sweep: no FAIL.
- Blind reviewers get one extra question: "does this window look drawn by the same artist as `shots/ref_inside.png`?"

## v3 — night rework ("it jitters, the camera moves a lot, things go in and out of focus")
- Camera is centrally owned (core/anchors.js setPath). Level keys below z 16.5 are ignored.
  - Inward from z -0.75 to -34.6: ONE straight zoom onto one point, the hero quark. Zero pan and zero rotation. Every nested scene (nostril, mucosa, macrophage, nucleus, nucleosome, atom, proton, quark) lies on that line; MUC was moved to the nostril slit centre.
  - Outward: a few long, constant-speed moves. The crane runs 0.8 → 2.9, then a roll to north-up 2.9 → 5.6, one turn Earth → Sun 7 → 16, and one turn up over the galactic disc 16 → 20. Max pan is 0.23 widths/decade.
  - No camera drift.
- Focus: DOF is at half strength, and the blur law is soft-saturating (coc = 1.4·dofA·x/(1+x), so near-lens layers don't swing into mush). Space DOF is ~0.08. Blurred runs render at a continuous resolution k = 2.5/blur (no quality steps).
- Near-lens clutter removed everywhere: space dust and haze clouds; sub-field bubbles are kept ≥11 radii off the axis; the proton's quark sea is thinned; the electron-cloud lobes thin out as the camera passes; the crane-path street trees are dropped.
- There is always one centred subject: the glowing carbon nucleus at -10.5…-13; the Sun's minimum brightness and its named neighbours at 16–19.4; Andromeda brought in nearer the centre.
- Tools: tools/campath.mjs (camera pan/rotation per decade).
