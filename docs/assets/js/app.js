// app.js — arranque común de todas las páginas: color de banda (--band-color), aria-current de la nav
// por pathname, cascada/reveal de entrada, tick de 30 s y evento `pl:ready`. Las secciones son páginas
// reales (sin router); los módulos de cada página (dia/resumen/calendario/generacion.js) se enganchan
// vía window.PL y definen PL.tick.
import { store, ls } from './store.js';

const html = document.documentElement;
const body = document.body;
html.classList.add('js');
html.classList.remove('no-js');

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// ---------- color de banda ----------
const BAND = { g: 'green', o: 'orange', r: 'red', b: 'blue', green: 'green', orange: 'orange', red: 'red', blue: 'blue' };
function setBand(b) {
  const name = BAND[b] || 'blue';
  html.style.setProperty('--band-color', `var(--${name})`);
  body.dataset.band = b || 'b';
}

// ---------- animaciones de entrada (cascada de barras, reveal del calendario) ----------
function cascade(el) {
  if (!el) return;
  el.classList.remove('in');
  void el.offsetWidth; // fuerza el estado inicial (scaleX(0)) antes de transicionar; no depende de rAF
  el.classList.add('in');
}
function reveal(root = document) {
  $$('.bars, .cal', root).filter((el) => !el.closest('[hidden]')).forEach(cascade);
}

// ---------- nav: la página actual por pathname (cubre /manana/ y cualquier alias) ----------
function markCurrent() {
  const norm = (p) => p.replace(/index\.html$/, '');
  const here = norm(location.pathname);
  const links = $$('.nav a[data-tab]');
  const match = links.find((a) => norm(a.pathname) === here);
  if (!match) return; // sin coincidencia exacta: se respeta lo que puso build.py
  for (const a of links) a.setAttribute('aria-current', a === match ? 'page' : 'false');
}

// ---------- arranque ----------
let boot = null;
try { boot = JSON.parse($('#pl-boot')?.textContent || 'null'); } catch { boot = null; }
window.PL_BOOT = boot;

const tab = body.dataset.tab || $('.layout')?.dataset.tab || 'dia';
store.set({ tab, zone: ls.get('zone', null), selectedDay: (boot && boot.selected) || null });

markCurrent();
setBand(body.dataset.band || (boot && boot.bandNow) || 'b');
reveal();

// ---------- tick de 30 s + visibilitychange (los módulos definen PL.tick) ----------
let lastTick = Date.now();
function heartbeat() {
  lastTick = Date.now();
  store.set({ now: lastTick });
  try { window.PL?.tick?.(); } catch (e) { console.error(e); }
}
setInterval(heartbeat, 30_000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Date.now() - lastTick > 5_000) heartbeat();
});

window.PL = Object.assign(window.PL || {}, { setBand, cascade, reveal, store, ls });
document.dispatchEvent(new CustomEvent('pl:ready', { detail: { tab, boot } }));
