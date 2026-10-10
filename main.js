// SNEEZE — entry. Builds the world, loads every level (each may export async load(ctx)), merges camera keys, starts.
import { buildFrames } from './core/world.js';
import { updateFrames, setPath } from './core/anchors.js';
import { addLevel, start, go, Q, onFrame, warm } from './core/engine.js';
import man from './levels/man.js';
import mantop from './levels/mantop.js';
import street from './levels/street.js';
import nose from './levels/nose.js';
import mucosa from './levels/mucosa.js';
import macrophage from './levels/macrophage.js';
import nucleus from './levels/nucleus.js';
import dna from './levels/dna.js';
import nucleus12 from './levels/nucleus12.js';
import quarks from './levels/quarks.js';
import region from './levels/region.js';
import earth from './levels/earth.js';
import solar from './levels/solar.js';
import stars from './levels/stars.js';
import galaxy from './levels/galaxy.js';

const LEVELS = [galaxy, stars, solar, earth, region, street, mantop, man, nose, mucosa, macrophage, nucleus, nucleus12, quarks, dna]; // dna last: it can skip GL work hidden behind the proton (V.coverDepth)
const $ = (id) => document.getElementById(id);
let loaded = 0, total = 0;
const progress = (p) => { const el = $('load'); if (el) el.textContent = `loading… ${Math.round(p * 100)}%`; };
async function fetchTracked(p, kind) { const r = await fetch(p); if (!r.ok) throw new Error(p + ' ' + r.status); const v = await (kind === 'buf' ? r.arrayBuffer() : r.json()); loaded++; progress(loaded / Math.max(total, 1)); return v; }
const ctx = { json: (p) => (total++, fetchTracked(p, 'json')), buf: (p) => (total++, fetchTracked(p, 'buf')) };

async function boot() {
  let origin = null; try { origin = await (await fetch('assets/geo/origin.json')).json(); } catch (e) { console.warn('origin', e); }
  buildFrames(origin);
  onFrame(updateFrames); // frames that move with time (the head) are rebuilt every frame
  await Promise.all(LEVELS.map(async (L) => { if (L.load) try { await L.load(ctx); } catch (e) { console.error('load', L.id, e); } }));
  LEVELS.forEach(addLevel);
  // camera keys: the hand-off keys live in core/anchors.js; each level may add keys strictly inside its own range
  setPath(LEVELS.flatMap((L) => L.keys || []));
  if (Q.has('shot')) document.body.classList.add('shot');
  $('binfo').onclick = () => { $('notes').hidden = !$('notes').hidden; };
  $('bin').onclick = () => go(-1); $('bout').onclick = () => go(1);
  start();
  if (!Q.has('shot') && !Q.has('nowarm')) { await warm(0.5, (p) => { const el = $('load'); if (el) el.textContent = `preparing the zoom… ${Math.round(p * 100)}%`; }); }
  window.__warm = true;
  if (Q.has('shot')) $('load').remove(); else { $('load').style.opacity = 0; setTimeout(() => $('load').remove(), 700); }
}
boot();
