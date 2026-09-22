// dia.js — pestaña Día: gráfico de barras, cabecera (zona, fecha, flechas), hora
// actual (rayo + banda), swipe y cascada. Mismo markup que render.bars y
// render.header_card en precioluz/render.py: la hidratación es un re-render.
//
// Las funciones de markup son puras (se prueban en node); todo acceso al DOM
// vive dentro de init/render/tick.

import { current, minimum } from './engine.js';
import { hourLabel, maxAllowedDay, addDays } from './tz.js';
import { fmtEur, longDate } from './format.js';
import { publicationLabel } from './zones.js';

// MARK: Helpers compartidos (los importan resumen/calendario/generacion.js)

export const BAND_WORD = { g: 'barata', o: 'precio medio', r: 'cara' };
export const BOLT = '<svg class="ic bolt" aria-hidden="true"><use href="/assets/img/icons.svg#i-bolt"/></svg><span class="sr-only">Hora actual</span>';

export function icon(name) {
  return `<svg class="ic" aria-hidden="true"><use href="/assets/img/icons.svg#i-${name}"/></svg>`;
}

/** html.escape(s, quote=True) de Python. */
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c]));
}

/**
 * `f"{x:.{d}f}"` de Python: como toFixed salvo en los empates exactos del
 * binario (0,03125 → "0.0312"), donde Python redondea al par y toFixed hacia arriba.
 */
export function fixed(x, d) {
  const s = x.toFixed(d);
  const long = x.toFixed(Math.min(100, d + 25));
  const cut = long.indexOf('.') + 1 + d;
  if (/^50*$/.test(long.slice(cut))) {
    const trunc = long.slice(0, d === 0 ? cut - 1 : cut);
    if (Number(trunc[trunc.length - 1]) % 2 === 0) return trunc;
  }
  return s;
}

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** ¿Está el elemento en un panel visible? (en las páginas reales los otros paneles van `hidden`). */
export const visible = (el) => Boolean(el) && !el.closest('[hidden]');

/** Sustituye un elemento por el markup dado y devuelve el nuevo nodo. */
export function replaceEl(el, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  const node = tpl.content.firstElementChild;
  el.replaceWith(node);
  return node;
}

// MARK: Markup (render.bars / render.header_card)

/** Etiqueta del `aria-label` de la sección: "martes, 22 de septiembre de 2026". */
export const dayLabel = (day) => longDate(day).toLowerCase();

export function barsHtml(points, bands, zone, label, nowIndex = null) {
  if (!points.length) {
    return `<section class="card chart"><p class="empty">${icon('calendar')}Sin datos para esta fecha</p></section>`;
  }
  let vmax = -Infinity;
  for (const p of points) if (p.eurKwh > vmax) vmax = p.eurKwh;
  const best = minimum(points);
  const rows = points.map((p, k) => {
    const band = k < bands.length ? bands[k] : 'o';
    const isBest = best !== null && p.index === best.index;
    const isNow = nowIndex !== null && p.index === nowIndex;
    const classes = `bar ${band}${isBest ? ' best' : ''}${isNow ? ' now' : ''}`;
    const h0 = hourLabel(p.start, zone.tz);
    const h1 = hourLabel(p.end, zone.tz);
    const price = fmtEur(p.eurKwh);
    const extra = (isBest ? `<span class="leaf" title="Hora más barata">${icon('leaf')}<span class="sr-only">Hora más barata</span></span>` : '')
      + (isNow ? BOLT : '');
    return `<li class="${classes}" data-i="${p.index}" style="--v:${fixed(p.eurKwh, 4)};--d:${fixed(k * 0.022, 3)}s" `
      + `aria-label="De ${h0} a ${h1}, ${price}, ${BAND_WORD[band]}${isNow ? ' (hora actual)' : ''}">`
      + `<span class="h">${h0}</span><span class="track"><i class="fill"></i><span class="p">${price}${extra}</span></span></li>`;
  });
  return `<section class="card chart" aria-label="Precio de la luz por horas, ${esc(label)}">`
    + `<ol class="bars" id="bars" style="--max:${fixed(vmax, 4)}">${rows.join('')}</ol></section>`;
}

// MARK: Controlador

let ctx = null;
let timers = [];
let swipe = null;

function $(sel, root = document) {
  return root.querySelector(sel);
}

function cascade(ol) {
  for (const t of timers) clearTimeout(t);
  timers = [];
  if (!ol) return;
  ol.classList.remove('in');
  void ol.offsetWidth;
  ol.classList.add('in');
  const bars = ol.querySelectorAll('.bar');
  if (reducedMotion()) {
    bars.forEach((b) => b.classList.add('in'));
    return;
  }
  bars.forEach((b) => {
    const d = parseFloat(b.style.getPropertyValue('--d')) || 0;
    timers.push(setTimeout(() => b.classList.add('in'), d * 1000));
  });
}

/** Último día navegable: mañana desde las 20:16 de Madrid, o antes si ya tenemos su fichero. */
function maxDay(state) {
  const allowed = maxAllowedDay(state.now);
  const tomorrow = addDays(state.today, 1);
  return ctx.has(tomorrow) && tomorrow > allowed ? tomorrow : allowed;
}

function setBadge(kind, text) {
  const b = $('#status-badge');
  if (!b) return;
  b.className = `badge${kind ? ` ${kind}` : ''}`;
  b.innerHTML = `<i class="dot"></i>${text}`;
}

function renderHeader(state) {
  const { day, zone } = state;
  const sub = $('#zone-subtitle');
  if (sub) sub.textContent = zone.subtitle;
  const sel = $('#zone-select');
  if (sel && sel.value !== zone.id) sel.value = zone.id;
  const max = maxDay(state);
  const input = $('#day-input');
  if (input) {
    input.value = day;
    input.max = max;
    if (ctx.boot && ctx.boot.index && ctx.boot.index.first) input.min = ctx.boot.index.first;
  }
  const prev = $('#day-prev');
  if (prev) prev.setAttribute('href', `?d=${addDays(day, -1)}`);
  const next = $('#day-next');
  if (next) {
    const nextDay = addDays(day, 1);
    const enabled = nextDay <= max;
    next.setAttribute('href', `?d=${nextDay}`);
    if (enabled) next.removeAttribute('aria-disabled');
    else next.setAttribute('aria-disabled', 'true');
    next.setAttribute('aria-label', enabled ? 'Día siguiente'
      : `Día siguiente (mañana se publica a las ${publicationLabel(zone, state.now)})`);
  }
}

/** Banda de la hora actual (serie de la zona) → body[data-band]; '' sin dato. */
function applyBand(state) {
  const pts = ctx.points(state.today, state.zone.series);
  const cur = pts.length ? current(pts, state.now) : null;
  let band = '';
  if (cur) {
    const k = pts.indexOf(cur);
    const bands = ctx.bands(state.today, state.zone.series);
    band = k >= 0 && k < bands.length ? bands[k] : '';
  }
  if (document.body.dataset.band !== band) {
    document.body.dataset.band = band;
    try { window.PL && typeof window.PL.setBand === 'function' && window.PL.setBand(band || 'b'); } catch { /* nada */ }
  }
  return band;
}

function nowIndexFor(state) {
  if (state.day !== state.today) return null;
  const cur = current(ctx.points(state.day, state.zone.series), state.now);
  return cur ? cur.index : null;
}

/** Mueve la marca de hora actual sin re-render (tick). */
function markNow(state) {
  const ol = $('#bars');
  if (!ol) return;
  const idx = nowIndexFor(state);
  const old = ol.querySelector('.bar.now');
  if (old && Number(old.dataset.i) === idx) return;
  if (old) {
    old.classList.remove('now');
    old.querySelectorAll('.bolt, .p > .sr-only').forEach((n) => n.remove());
    old.setAttribute('aria-label', old.getAttribute('aria-label').replace(' (hora actual)', ''));
  }
  if (idx === null) return;
  const li = ol.querySelector(`.bar[data-i="${idx}"]`);
  if (!li) return;
  li.classList.add('now');
  li.querySelector('.p').insertAdjacentHTML('beforeend', BOLT);
  li.setAttribute('aria-label', `${li.getAttribute('aria-label')} (hora actual)`);
}

function onPointerDown(e) {
  if (!e.target.closest('.card.chart') || (e.pointerType === 'mouse' && e.button !== 0)) return;
  swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
}

function onPointerUp(e) {
  if (!swipe || e.pointerId !== swipe.id) return;
  const dx = e.clientX - swipe.x;
  const dy = e.clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) < 60 || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
  const state = ctx.snapshot();
  const target = addDays(state.day, dx < 0 ? 1 : -1);
  if (dx < 0 && target > maxDay(state)) return;
  ctx.setDay(target);
}

export function init(c) {
  ctx = c;
  const panel = $('#panel-dia');
  if (!visible(panel)) return false;
  panel.addEventListener('click', (e) => {
    const a = e.target.closest('#day-prev, #day-next');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault();
    if (a.getAttribute('aria-disabled') === 'true') return;
    const m = /[?&]d=(\d{4}-\d{2}-\d{2})/.exec(a.getAttribute('href') || '');
    if (m) ctx.setDay(m[1]);
  });
  panel.addEventListener('change', (e) => {
    if (e.target.id === 'day-input') {
      const v = e.target.value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v <= maxDay(ctx.snapshot())) ctx.setDay(v);
      else e.target.value = ctx.snapshot().day;
    } else if (e.target.id === 'zone-select') {
      ctx.setZone(e.target.value);
    }
  });
  panel.addEventListener('pointerdown', onPointerDown);
  panel.addEventListener('pointerup', onPointerUp);
  panel.addEventListener('pointercancel', () => { swipe = null; });
  const chart = $('.card.chart', panel);
  if (chart) chart.style.touchAction = 'pan-y';
  return true;
}

/** Re-render completo del panel para {day, zone, now, today, loading}. */
export function render(state) {
  const panel = $('#panel-dia');
  if (!panel || !ctx) return;
  renderHeader(state);
  applyBand(state);
  const has = ctx.has(state.day);
  if (state.loading && !has) {
    setBadge('', 'Cargando…');
    return;
  }
  const pts = has ? ctx.points(state.day, state.zone.series) : [];
  const bands = has ? ctx.bands(state.day, state.zone.series) : '';
  const html = barsHtml(pts, bands, state.zone, dayLabel(state.day), nowIndexFor(state));
  const old = $('.card.chart', panel);
  let node;
  if (old) {
    node = replaceEl(old, html);
  } else {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    node = tpl.content.firstElementChild;
    const hdr = $('.hdr', panel);
    if (hdr) hdr.insertAdjacentElement('afterend', node);
    else panel.insertAdjacentElement('afterbegin', node);
  }
  node.style.touchAction = 'pan-y';
  setBadge(pts.length ? 'g' : 'o', pts.length ? 'Actualizado' : 'Sin datos');
  cascade($('#bars', node));
}

/** Cada 30 s y al volver a la pestaña: hora actual, banda y flecha de mañana. */
export function tick(state) {
  if (!ctx || !$('#panel-dia')) return;
  markNow(state);
  applyBand(state);
  renderHeader(state);
}
