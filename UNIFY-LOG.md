# UNIFY log (one owner, sequential)

## Phase A: below the nucleus (z -5.5 to -34.6)
Films: before `shots/film_uni_A_before.jpg`, after `shots/film_uni_A_after.jpg` (z -34.5 to -4.5, step 0.5, t 4.2).
Sweeps (step 0.05, nolabels): t 4.2: `sweep_uni_A1` (-4.4 to -12), `uni_A2` (-12 to -22), `uni_A3` (-22 to -34.6); t 6: `uni_A_t6a`, `uni_A_t6b`. 0 FAIL, 0 flags. Frame time ≤ 8.5 ms (1600×1000).
Library additions (core/look.js, existing exports kept): `f3`, `sinkFam`, `deepFam`, `interior`.

### Nucleus envelope (z -4.6 to -6.3): levels/nucleus.js, nuc-shell.js
- Changed: the envelope is FAM.cyan with ONE screen-space crescent on the silhouette (the per-slice crescents made the topo-map rings). Annuli overlap 0.6 bin, so no floor gaps. The scratch canvas is now cleared (the clear was commented out by accident). Inner floor opaque; interior = look(-6.3) warmed by violet/cyan (#231352). Face-on membrane alpha is 0.45 (was 0.7). Nucleolus and speckles use body()/FAM.
- Strips: before `strip_uni_nucA.jpg`, after `strip_uni_nucB.jpg`. -4.05 still matches ref_inside.
- Still wrong: crossing the membrane at -5.5 is still a blue veil (lighter, not teal), and it steps to dark over ~0.2 decade.

### Chromatin / nucleosome / DNA (z -6.3 to -9.4): shared/nucleosome.js, nuc-gl.js, nuc-chain (via nucleus.js), dna.js
- Changed: atom groups = FAM.cyan (backbone), FAM.gold (bases), FAM.magenta (histones); each family's own dark is used for the crescent. The 1.45 saturation boost is now 1.15. Linkers are plain cyan (the cyan+gold average read khaki-grey). A GL depth sink is continuous per pixel: far toward look(z).haze, near (L0) toward look(z).deep. Every non-hero atom is drawn at 0.8 radius, the same for sprites, linker strip and atoms, so the LOD switch is unchanged and the medium shows between atoms.
- Strips: `strip_uni_dnaA.jpg` (before) → `strip_uni_dnaC.jpg`.
- Still wrong: -8.0 (inside the nucleosome) and -8.8 (base pairs at the focus) are still wall-to-wall saturated atoms; it is real geometry, but denser than the reference.

### Carbon atom (z -9.4 to -13): nuc-gl.js hero shader, nucleus12.js
- Changed: the hero carbon is a Kurzgesagt CELL. It has a bright cyan ring (the edge-on cloud), a dark interior = look(-11) (#1f0e55), 2p lobes as cyan gel (one lobe = one shape, so no seam), and 2s/1s shells in violet. The near halves of the shells are sunk toward the interior, so no pastel wash. There is one group crescent on the lobes (the spike artifact is gone). The C-12 glow is coral at 0.24.
- Strips: `strip_uni_dnaB.jpg` (atom entry).
- Still wrong: -9.9 to -10.4 is a layered translucent passage (lobe gel + 2s veil); calm, but a little flat. The medium inside the atom is slightly lighter than look(-12).

### C-12 nucleus / proton / quark (z -13 to -19): shared/nucleon.js, quarks.js, nucleus12.js, sub-field.js
- Changed: nucleons are cells: coral protons and cyan neutrons, a family ring plus a dark interior from look(-15.4), with their 3 quarks as small orb "nuclei" (like the reference epithelium). The hero proton's front is drawn as the ring only (the pasted opaque skin and its hole are gone). Quarks use FAM coral/lime/cyan; the hero up quark is coral, so its cloud's interior is warm plum, not green. Gluon tube = FAM.gold with a softer glow; QCD lumps at half alpha.
- Strip: `strip_uni_subA.jpg`.
- Still wrong: -15.5 (entering the proton): the gold Y tube near the lens is loud.

### Desert to Planck (z -19 to -34.6): sub-field.js
- Changed: each nest level is a cell in its decade's family. The family ramp `famAt` runs coral, magenta, violet, cyan. The interior = look(u+0.3) warmed 20 %, so the frame is always the continuous medium; no palette flips. Siblings are sunk orbs. Field bubbles are gel (no soap-bubble rims). One idea per decade: pair, nucleus, ring of orbs, cluster, twin lobes, a lone cell (the desert), string loops (string scale), packed foam (Planck). Fixed the pop at -30.7: the nucleus orb no longer vanishes when its cell covers.
- Strips: `strip_uni_desA.jpg`.
- Still wrong: the ring-in-ring framing still repeats every decade (the nest mechanic); the labels sit beside small cells and read better, but are not re-checked at t 6.

## Phase B: city and map (z 1.5 to 7)
Films: before `shots/film_uni_B_before.jpg`, after `shots/film_uni_B_after.jpg` (z 1.0 to 7.6, step 0.2, t 4.2).
Sweeps (step 0.05, nolabels): `sweep_uni_B` (1.5 to 7.2, t 4.2): 0 pops. `sweep_uni_B_t6` (0.8 to 7.6, t 6): 0 FAIL, 1 flag at z 1.25. That flag is the street's depth of field switching off between 1.20 and 1.25 (blurred to sharp); pre-existing, phase D range. Frame time ≤ 10 ms, except the globe at 7.0–7.2 (~14 ms, pre-existing).

### City (z 1.5 to 4.2): levels/city-geo.js COL, city-gl.js
- Changed: every COL entry now comes from look()/FAM:
  - ground: asphalt look(1.5).deep/violet.dark; sidewalks and plaza in saturated violets, with light curbs;
  - buildings: bluish-violet lit walls, FAM.violet.dark shade, lit roofs in violet / pink / teal lights, gold windows, FAM.skin water towers;
  - the Met: ONE FAM.skin stone family on facade, roof tiers and steps (the cream-facade vs pink-roof "swap" is gone), cyan skylights;
  - trees and parks: lime/cyan teal-green.
- Strips: `strip_uni_cityA.jpg`.
- Still wrong: roofs are flat fills (no lit crescent); the blocks read as many small pink/violet tiles at 3.0–3.6.

### Map and region (z 4 to 7): levels/earth-terrain.js, earth.js, earth-clouds.js
- Changed:
  - land colour: Kurzgesagt nuke-all-earth/07 violet at city/region scale; setTerrainZ drifts it violet → saturated dark teal → green between 5.0 and 6.6 (an RGB mix went grey). Urban is the blocks' violet at city scale and converges to a light tint of the land by 5.3, which removes the purple slab and the fine-data square seam.
  - crescent coast: a deep extrusion under the shadow-side coast, a lit rim on the lit-side coast, and bank shade inside lakes and rivers. All of it is clipped to each product's extent, so no square edges.
  - globe blur: the globe was blurred by its centre depth (a blur jump at altitude 200 km); it now uses its near surface.
  - clouds: one body() look (lilac shade crescent away from the Sun, near-white base, white core toward it) at every scale, with clear zones around the label anchors (Manhattan, NYC, UES, Baltimore).
- Still wrong: 5.4–5.7 is the dull middle of the land drift (slate teal-violet); clouds are still pill clusters, readable but generic.

## Phase C: space (z 7 to 27.2)
Films: before `shots/film_uni_C_before.jpg`, after `shots/film_uni_C_after.jpg` (z 7 to 27.2, step 0.4, t 4.2).
Sweeps (step 0.05, nolabels): `sweep_uni_C` (t 4.2) and `sweep_uni_C_t6` (t 6), 405 frames each: 0 FAIL, 1 mild flag at z 13.05 (diff 3.3, ratio 1.5, pre-existing). Frame time ≤ 14 ms (the globe at 7.0 is ~20 ms, pre-existing).

- Soup: space-dust.js has fewer motes (12 per decade, was 22). Far haze clouds are 6 % (was 18 %), at alpha 0.12–0.2 and sunk toward look(15).haze. Dust and ice colours are FAM sunk 25–35 %. Near bokeh is smaller (the "pasted cyan disc" was a big near ice mote). space-kit SPC = FAM, so every space level takes the same families. The medium now reads as the dark look() indigo.
- Sun: the camera key that arrives on the Sun moved from z 10.45 to 11.05 (zf 11.6 → 11.75). The camera used to fly to 0.3 AU from the Sun and back (disc 6 → 16 → 6 px); it now never gets closer than Earth's distance, and the disc holds about 5.5 px and then shrinks.
- Labels: a planet label is never placed on the Sun (distance plus label-box check). The Moon label window ends at 8.85, while the Moon is still visible.
- Web: its exposure is a two-decade ramp (22.3 to 24.5), replacing the star-law exposure jump of 2.6 mag over 0.7 decade (that was the pop-in at 23.5). Near filaments are gel chains, not additive; the chain/ribbon switch is at 3 px (was 6). Filament colours from FAM.
- Edge: the CMB shell is a CELL ring (body() with crescents and a highlight). The inner limb is the projected inner sphere, so the frame never fills with the band. The glow is clipped outside the shell (it lit the whole face and gave a sweep FAIL at 26.45, now fixed). The face is clear, so the web shows inside.
- Still wrong: the heliosphere (13.8–14.2) is still a soft thin ring; z 8.8–9.2 is nearly empty; the Milky Way changes from big blurred near clouds (19.8) to crisp beads (20.4) to the spiral (21), consistent in families but abrupt in feel; Andromeda's minimum size of 90 px is an enlargement; the thinning of the 2MRS web at 25 is the survey edge (real) and reads as a lighter blob in the centre.

## Phase D: face to nucleus polish (z 1.0 to -5.5) + final cleanup
Film: before `shots/film_uni_D_before.jpg`; after: see the full film `shots/film_uni_FINAL.jpg`.
- Street medium: the Met's stone is now a lilac-pink family (city-geo COL), not the phase-B peach. The side view's huge background had the man's skin and jacket hue, so he vanished; now the street is the saturated lilac of look(-1) and the orange man pops. It is the same Met family on facade, roofs and steps, from street to map.
- The man: the jacket and upper-arm crescents are deeper (so 0.075, lit 0.026); the head gets an orb crescent (shade along chin and jaw away from the upper-left light, lit rim on the skull); the hand gets finger creases (hero LOD).
- His label is anchored in the moving 'head' frame, behind the back of his head (the side clear of the spray), with a fallback in front of the face; it was 0.22 m off to the right before.
- Lining: the dark "spotlight" is gone. The epithelium follows a detail-density law by cell size: under 40 px/cell it takes a flat coat of its own average colour (far cells = ring + core, no static of nuclei); under 8 px it takes the lining tone, so the thinning mucus never opens onto a dark disc.
- Labels: Nasal lining (-2.2…-3.1), Macrophage (-3.5…-4.6); the "Immune cells vs a cold" label in between is removed (three swaps became one).
- DOF step at z 1.25: two causes in street.js. (1) Fixed slice edges just behind the focus (the Met steps crossed 1.3 m and jumped from blur 1.0 to 2.9): finer edges 1.12/1.25/1.45/1.62 m (the merge rule drops the redundant ones). (2) The ground merge factor switched 4 → 1.3 when the pitch left side view: now 1.3 always. Sweep 0.6–2.0 (t 6): no flag (was 1.78).
- Cleanup:
  - End frame: the z 27 key now centres the observable universe on us; the sphere is whole and centred at 27.2 with its label beside the rim.
  - Land drift: four saturated stops (violet → indigo #3c3cb4 → teal-green #1f8a72 → green), no slate band.
  - Earth's clouds on the globe: systems 170–480 km (were 300–900), half the shade offset, tones closer.
  - z 8.8–11: the zodiacal dust disc (real: interplanetary dust inside 0.7 AU in the ecliptic), a soft warm gel band through the Sun.
  - z -11 to -13: ~1.8× virtual-pair gel bubbles inside the atom.
  - z -15.5: the gluon tube is a warm gold-coral core, with half the additive heat and glow.
  - z -8: the near-layer sink reaches 0.95 of the focus distance (atoms in front of the hero go dark like L0 silhouettes).
- Final checks:
  - full sweep `sweep_uni_FULL` (-34.6 → 27.2, step 0.05, t 4.2, nolabels, 1237 frames): 0 FAIL. Two mild flags: z -2.35 (ratio 1.63, the nostril tunnel's dark wall leaving the frame: geometry) and z 13.05 (ratio 1.54, diff 3.3, pre-existing). The only frame over 30 ms is the cold first frame at -34.6.
  - full film at step 1: `shots/film_uni_FINAL.jpg` (it ends at 26.4); the end frame: `shots/uni_END_27.2.png`.

## Integration fixes (blind-review bugs, t = 2)
1. Zodiacal band removed (it read as a hard smear).
2. Moon: the Earth+Moon key moved 8.5 → 8.78 (at 8.47 they are 1.3 frame widths apart, so both cannot be in frame); presence 7 → 11 px; a light lilac face and a violet night side; label window 8.6–9.05.
3. Planet labels: the "Jupiter" label was on Jupiter (the small dot by the Sun; the ringed dot at the right is Saturn). Jupiter's presence 7 → 10 px so it reads as the label's object; labels stay beside their own object (plus the Sun-overlap check).
4. Flare cap 78 → 38 px·s; no extra flare for named stars; the Oort cloud is drawn as icy clump chains (gel blobs ~1,500 AU, built from its own points).
5. Man label: width from the actual text (not a 230 px guess), anchored 0.1 m behind the head in the moving head frame.
6. White sliver at z 1.0 = a crosswalk stripe entering the frame; zebra paint toned to light lilac.
7. z -12.6: the C-12 glow 0.24 → 0.5 (the nucleus is the lit subject); vacuum-bubble boost 1.8× → 1.35×.
8. In-focus subjects: z -2.08 an airborne mucus droplet in the tunnel air (the focus racks to it; it sits 12 % of the focus distance from the lens, off-axis); z -5.47 a nuclear speckle (a cluster of cyan orbs) at the focus, off-axis. New helper levels/body-util.js focusAnchor().
- Perf: the web chain/ribbon switch is back to 6 px (3 px cost ~8 ms at z 23–24); the web sweep 22–26.5 is still clean.
- Sweeps (step 0.05, t 2 and t 4.2): 7.6–13.4, 14.4–18.2, 0.3–1.6, -13.2…-11.8, -2.5…-1.7, -5.9…-5.1, plus 22–26.5 at t 4.2: 0 FAIL. Flags only the known ones (13.05 ratio 1.5; -2.35 tunnel wall exit ~1.6; 1.25 ratio 1.50 at t 4.2).
- Film: `shots/film_uni_FINAL2.jpg` (step 1, -33.8 → 27.2, includes the end frame).
