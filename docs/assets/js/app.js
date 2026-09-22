// app.js — router de pestañas (pushState por URL), teclado en el tablist, popstate,
// color de banda (--band-color) y tick de 30 s. Independiente del motor: los módulos
// de cada pestaña (dia/resumen/calendario/generacion.js) se enganchan vía window.PL.
import { store, ls } from './store.js';

const html = document.documentElement;
const body = document.body;
html.classList.add('js');
html.classList.remove('no-js');

const TABS = { dia: '/', generacion: '/generacion/', resumen: '/resumen/', calendario: '/calendario/' };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const tabs = () => $$('[role=tab][data-tab]');
const order = () => { const o = tabs().map((a) => a.dataset.tab); return o.length ? o : Object.keys(TABS); };
const panel = (t) => $('#panel-' + t);

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
function reveal(t) {
  const p = panel(t);
  if (!p) return;
  $$('.bars, .cal', p).forEach(cascade);
  document.dispatchEvent(new CustomEvent('pl:tab', { detail: { tab: t } }));
}

// ---------- pestañas ----------
function tabFromPath(path) {
  path = path.replace(/index\.html$/, '');
  for (const [t, u] of Object.entries(TABS)) if (u === path) return t;
  return null;
}
function activate(t, { push = true, focus = false } = {}) {
  if (!panel(t)) return false; // el panel no está en esta página: navegación normal
  for (const a of tabs()) {
    const on = a.dataset.tab === t;
    a.setAttribute('aria-selected', on ? 'true' : 'false');
    a.tabIndex = on ? 0 : -1;
    if (on && focus) a.focus();
  }
  for (const k of order()) { const p = panel(k); if (p) p.hidden = k !== t; }
  body.dataset.tab = t;
  store.set({ tab: t });
  const a = tabs().find((x) => x.dataset.tab === t);
  if (a && a.dataset.title) document.title = a.dataset.title;
  const url = TABS[t];
  if (push && url && body.dataset.nav !== 'off' && location.pathname !== url && 'pushState' in history) {
    history.pushState({ tab: t }, '', url + location.search);
  }
  reveal(t);
  return true;
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('[role=tab][data-tab]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
  if (activate(a.dataset.tab)) e.preventDefault();
});

$('[role=tablist]')?.addEventListener('keydown', (e) => {
  const o = order();
  const i = o.indexOf(document.activeElement?.dataset?.tab);
  if (i < 0) return;
  let j;
  if (e.key === 'ArrowRight') j = (i + 1) % o.length;
  else if (e.key === 'ArrowLeft') j = (i - 1 + o.length) % o.length;
  else if (e.key === 'Home') j = 0;
  else if (e.key === 'End') j = o.length - 1;
  else return;
  e.preventDefault();
  activate(o[j], { focus: true });
});

window.addEventListener('popstate', (e) => {
  const t = (e.state && e.state.tab) || tabFromPath(location.pathname) || body.dataset.tab || 'dia';
  activate(t, { push: false });
});

// ---------- arranque ----------
let boot = null;
try { boot = JSON.parse($('#pl-boot')?.textContent || 'null'); } catch { boot = null; }
window.PL_BOOT = boot;

store.set({ zone: ls.get('zone', null), selectedDay: (boot && boot.selected) || null });

const initial = body.dataset.tab || tabFromPath(location.pathname) || 'dia';
if (panel(initial)) {
  activate(initial, { push: false });
  if ('replaceState' in history) history.replaceState({ tab: initial }, '');
} else {
  reveal(initial);
}
setBand(body.dataset.band || (boot && boot.bandNow) || 'b');

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

window.PL = Object.assign(window.PL || {}, { activate, setBand, cascade, store, ls, TABS });
