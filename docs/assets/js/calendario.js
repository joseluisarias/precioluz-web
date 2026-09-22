// calendario.js — pestaña Calendario: rejilla mensual (heatmap p30/p70), navegación
// de meses con listbox, selección de día y bloque "Día seleccionado". Mismo
// markup que render.calendar_card / _calendar_detail en precioluz/render.py.

import { stats, minimum, maximum } from './engine.js';
import { hourLabel, weekdayOf, parseDayKey, makeDayKey } from './tz.js';
import { fmtNumber, fmtEur, longDate, monthTitle, dayLevel, MONTHS } from './format.js';
import { icon, esc, reducedMotion, visible } from './dia.js';

// MARK: Valle / cresta (precioluz/calendar.py)

const VALLE = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
const CRESTA = new Set([10, 11, 12, 13, 18, 19, 20, 21]);

/** Hora de inicio según la etiqueta ("14-15" → 14); si no es numérica, el índice. */
export function labelHour(p) {
  const n = parseInt(String(p.label).slice(0, 2), 10);
  return Number.isFinite(n) ? n : p.index;
}

function mean(values) {
  if (!values.length) return null;
  let total = 0;
  for (const v of values) total += v;
  return total / values.length;
}

export const valleAvg = (points) => mean(points.filter((p) => VALLE.has(labelHour(p))).map((p) => p.eurKwh));
export const crestaAvg = (points) => mean(points.filter((p) => CRESTA.has(labelHour(p))).map((p) => p.eurKwh));

/** Claves de todos los días de "yyyy-MM". */
export function monthDays(month) {
  const [y, m] = month.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out = [];
  for (let d = 1; d <= n; d++) out.push(makeDayKey(y, m, d));
  return out;
}

// MARK: Markup

export function navHtml(month, months) {
  const idx = months.indexOf(month);
  const i = idx >= 0 ? idx : months.length - 1;
  const prevM = i > 0 ? months[i - 1] : null;
  const nextM = i + 1 < months.length ? months[i + 1] : null;
  return '<div class="cal-nav">'
    + `<a class="btn-sq" href="?m=${prevM || ''}" aria-label="Mes anterior"${prevM ? '' : ' aria-disabled="true"'}>${icon('chevron-left')}</a>`
    + `<button type="button" class="cal-month" id="cal-month" aria-haspopup="listbox" aria-expanded="false">${esc(monthTitle(month))}${icon('chevron-down')}</button>`
    + `<a class="btn-sq" href="?m=${nextM || ''}" aria-label="Mes siguiente"${nextM ? '' : ' aria-disabled="true"'}>${icon('chevron-right')}</a></div>`;
}

export function cellsHtml(month, daysJson, series, selected, maxDay) {
  const days = monthDays(month);
  const lead = (weekdayOf(days[0]) + 6) % 7;      // lunes = 0
  const mname = MONTHS[parseDayKey(days[0]).month - 1];
  const cells = [];
  for (let k = 0; k < lead; k++) cells.push('<li aria-hidden="true"></li>');
  days.forEach((d, k) => {
    const entry = (daysJson[d] || {})[series];
    const dnum = parseDayKey(d).day;
    const delay = `--d:${(k * 0.03).toFixed(2)}s`;
    if (entry) {
      const col = entry.color || '';
      const sel = d === selected;
      const valle = entry.valle !== null && entry.valle !== undefined ? `${fmtNumber(entry.valle, 2)}€` : '—';
      const cresta = entry.cresta !== null && entry.cresta !== undefined ? `${fmtNumber(entry.cresta, 2)}€` : '—';
      cells.push(`<li><button type="button" class="cell ${col}${sel ? ' sel' : ''}" data-day="${d}" style="${delay}"${sel ? ' aria-pressed="true"' : ''} `
        + `aria-label="${dnum} de ${mname}, media ${fmtNumber(entry.avg)} €/kWh">`
        + `<span class="d">${dnum}</span><span class="a">${fmtNumber(entry.avg, 2)}€</span>`
        + `<span class="m">${icon('clock-check')}${valle}</span><span class="m">${icon('bolt')}${cresta}</span></button></li>`);
    } else {
      const future = d > maxDay;
      cells.push(`<li><button type="button" class="cell empty${future ? ' future' : ''}" data-day="${d}" style="${delay}" disabled `
        + `aria-label="${dnum} de ${mname}, sin datos"><span class="d">${dnum}</span>—</button></li>`);
    }
  });
  return cells.join('');
}

export function detailHtml(day, zone, points) {
  const head = '<div class="row top"><div class="stack"><span class="caption semi sec">Día seleccionado</span>'
    + `<span class="subheadline semi" id="cal-sel-date">${esc(longDate(day))}</span></div>`;
  const foot = `<p class="caption sec">${icon('mappin')}Toca otro día para comparar rápidamente.</p>`;
  if (!points || !points.length) {
    return `${head}</div><p class="footnote sec">Aún no hay datos para este día. Prueba a cambiar de fecha o vuelve a cargar.</p>${foot}`;
  }
  const st = stats(points);
  const best = minimum(points);
  const worst = maximum(points);
  const v = valleAvg(points);
  const c = crestaAvg(points);
  const kv = [
    ['Media:', fmtEur(st.avg)],
    ['Mínimo:', `${fmtEur(st.min)} · ${hourLabel(best.start, zone.tz)}`],
    ['Máximo:', `${fmtEur(st.max)} · ${hourLabel(worst.start, zone.tz)}`],
    ['Valle (00:00–08:00):', v !== null ? fmtEur(v, 2) : '—'],
    ['Cresta (10–14 y 18–22):', c !== null ? fmtEur(c, 2) : '—'],
  ].map(([k, val]) => `<div class="kv"><span>${k}</span><span>${val}</span></div>`).join('');
  return `${head}<span class="badge xs">${dayLevel(st.avg).toUpperCase()}</span></div>`
    + `<div class="stack" id="cal-sel-detail" style="gap:6px">${kv}</div>${foot}`;
}

/** Interior de `<section class="card" id="calendar">` (render.calendar_card). */
export function calendarInner(month, daysJson, series, selected, maxDay, months, zone, selPoints) {
  const [y, m] = month.split('-').map(Number);
  return `<h2 class="lbl headline">${icon('calendar')}Calendario</h2>${navHtml(month, months)}`
    + '<div class="cal-wd" aria-hidden="true"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>'
    + `<ol class="cal" id="cal-grid" aria-label="Días de ${esc(MONTHS[m - 1])} de ${y}">${cellsHtml(month, daysJson, series, selected, maxDay)}</ol>`
    + `<hr class="sep">${detailHtml(selected, zone, selPoints)}`;
}

export function listboxHtml(months, current) {
  const items = months.slice(-12).reverse().map((m) =>
    `<li role="option" tabindex="-1" data-m="${m}" aria-selected="${m === current}">${esc(monthTitle(m))}</li>`);
  return `<ul class="cal-months" id="cal-months" role="listbox" aria-label="Mes" tabindex="-1" style="list-style:none;margin:0;padding:4px;display:grid;gap:2px">${items.join('')}</ul>`;
}

// MARK: Controlador

let ctx = null;
let painted = null;      // {month, series}
let timers = [];

const $ = (sel, root = document) => root.querySelector(sel);

function reveal(ol) {
  for (const t of timers) clearTimeout(t);
  timers = [];
  if (!ol) return;
  ol.classList.remove('in');
  void ol.offsetWidth;
  ol.classList.add('in');
  const cells = ol.querySelectorAll('.cell');
  if (reducedMotion()) {
    cells.forEach((c) => c.classList.add('in'));
    return;
  }
  cells.forEach((c) => {
    const d = parseFloat(c.style.getPropertyValue('--d')) || 0;
    timers.push(setTimeout(() => c.classList.add('in'), d * 1000));
  });
}

function closeList() {
  const ul = $('#cal-months');
  const btn = $('#cal-month');
  if (ul) ul.remove();
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function openList() {
  const btn = $('#cal-month');
  if (!btn || $('#cal-months')) return;
  const state = ctx.snapshot();
  btn.setAttribute('aria-expanded', 'true');
  btn.closest('.cal-nav').insertAdjacentHTML('afterend', listboxHtml(ctx.boot.months || [state.month], state.month));
  const cur = $('#cal-months [aria-selected="true"]') || $('#cal-months [role=option]');
  if (cur) cur.focus();
}

function onListKey(e) {
  const opts = Array.from(document.querySelectorAll('#cal-months [role=option]'));
  if (!opts.length) return;
  const i = opts.indexOf(document.activeElement);
  let j = null;
  if (e.key === 'ArrowDown') j = Math.min(opts.length - 1, i + 1);
  else if (e.key === 'ArrowUp') j = Math.max(0, i - 1);
  else if (e.key === 'Home') j = 0;
  else if (e.key === 'End') j = opts.length - 1;
  else if (e.key === 'Escape') { e.preventDefault(); closeList(); $('#cal-month')?.focus(); return; }
  else if ((e.key === 'Enter' || e.key === ' ') && i >= 0) { e.preventDefault(); pick(opts[i].dataset.m); return; }
  else return;
  e.preventDefault();
  opts[j].focus();
}

function pick(month) {
  closeList();
  $('#cal-month')?.focus();
  ctx.setMonth(month);
  $('#cal-month')?.focus();          // el re-render sustituye el botón
}

function replaceDetail(section, html) {
  const hr = section.querySelector('hr.sep');
  if (!hr) return;
  while (hr.nextSibling) hr.nextSibling.remove();
  hr.insertAdjacentHTML('afterend', html);
}

export function init(c) {
  ctx = c;
  const section = $('#calendar');
  if (!visible(section)) return false;
  const root = section.parentElement || section;
  root.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell[data-day]');
    if (cell && !cell.disabled) { ctx.selectDay(cell.dataset.day); return; }
    const nav = e.target.closest('.cal-nav a[href]');
    if (nav) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      e.preventDefault();
      const m = /[?&]m=(\d{4}-\d{2})/.exec(nav.getAttribute('href') || '');
      if (nav.getAttribute('aria-disabled') !== 'true' && m) ctx.setMonth(m[1]);
      return;
    }
    if (e.target.closest('#cal-month')) {
      if ($('#cal-months')) closeList(); else openList();
      return;
    }
    const opt = e.target.closest('#cal-months [role=option]');
    if (opt) pick(opt.dataset.m);
  });
  root.addEventListener('keydown', (e) => {
    if (e.target.closest('#cal-months')) onListKey(e);
    else if (e.target.id === 'cal-month' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); openList(); }
  });
  document.addEventListener('click', (e) => {
    if ($('#cal-months') && !e.target.closest('#cal-months, #cal-month')) closeList();
  });
  painted = { month: ctx.boot.selected ? ctx.boot.selected.slice(0, 7) : null, series: null };
  return true;
}

function rerender(stamp) {
  return (v) => { if (v && ctx && ctx.stamp() === stamp) render(ctx.snapshot()); };
}

export function render(state) {
  const section = $('#calendar');
  if (!section || !ctx) return;
  const { day, zone, month, now } = state;
  const series = zone.series;
  const stamp = ctx.stamp();
  const cal = ctx.calendar(month);
  if (cal === undefined) {
    ctx.ensureCalendar(month).then(rerender(stamp));
    return;
  }
  if (!ctx.has(day) && ctx.ensureDay) ctx.ensureDay(day).then(rerender(stamp));
  const pts = ctx.has(day) ? ctx.points(day, series) : [];
  const maxDay = ctx.maxDay(now);
  const grid = $('#cal-grid', section);
  if (grid && painted && painted.month === month && painted.series === series) {
    // Solo cambia la selección: no se vuelve a pintar la rejilla.
    grid.querySelectorAll('.cell.sel').forEach((c) => { c.classList.remove('sel'); c.removeAttribute('aria-pressed'); });
    const cell = grid.querySelector(`.cell[data-day="${day}"]`);
    if (cell) { cell.classList.add('sel'); cell.setAttribute('aria-pressed', 'true'); }
    replaceDetail(section, detailHtml(day, zone, pts));
    return;
  }
  const daysJson = (cal && cal.days) || {};
  const months = ctx.boot.months && ctx.boot.months.length ? ctx.boot.months : [month];
  const refocus = document.activeElement && document.activeElement.id === 'cal-month';
  section.innerHTML = calendarInner(month, daysJson, series, day, maxDay, months, zone, pts);
  painted = { month, series };
  if (refocus) $('#cal-month', section)?.focus();
  reveal($('#cal-grid', section));
}
