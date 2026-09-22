// resumen.js — pestaña Resumen: comparativa Ayer/Hoy/Mañana, tiles, callout
// "vs típico" y consejo del día. Mismo markup que render.comparativa e
// render.insights en precioluz/render.py.

import { minimum, maximum, remainingCheapest } from './engine.js';
import { hourLabel, addDays } from './tz.js';
import {
  fmtEur, fmtNumber, dayBadge, dayLevel, spreadLevel, levelBadge, consejo, comparisonText, isWeekend,
} from './format.js';
import { publicationLabel } from './zones.js';
import { icon, esc, replaceEl, visible } from './dia.js';

// MARK: Markup

function compCol(title, ic, st, state, cls, pub) {
  const head = `<div class="t">${icon(ic)}${esc(title)}</div>`;
  let body;
  if (st) {
    body = `<div class="v">${fmtNumber(st.avg)}</div><div class="s">€/kWh media</div>`
      + `<div class="s">${fmtNumber(st.min)}–${fmtNumber(st.max)}</div>`;
  } else if (state === 'future') {
    body = `<div class="v">—</div><div class="s">Disponible<br>a las ${pub}</div>`;
    cls += ' future';
  } else {
    body = '<div class="v">—</div><div class="s">Sin datos</div>';
    cls += ' future';
  }
  return `<div class="${cls.trim()}">${head}${body}</div>`;
}

/** render.comparativa; `pub` = hora de publicación en el reloj de la zona ("20:20"). */
export function comparativaHtml(stPrev, stDay, stNext, nextState, pub = '20:20') {
  return `<section class="card" id="comparativa"><h2 class="lbl headline">${icon('timeline')}Comparativa</h2>`
    + `<div class="comp">${compCol('Ayer', 'clock-arrow', stPrev, 'none', '', pub)}`
    + `${compCol('Hoy', 'sun', stDay, 'none', 'today', pub)}`
    + `${compCol('Mañana', 'arrow-circle', stNext, nextState, '', pub)}</div></section>`;
}

export function tile(cls, ic, title, value, sub, dimmed = false) {
  return `<div class="tile ${cls}${dimmed ? ' dim' : ''}"><div class="t">${icon(ic)}${esc(title)}</div>`
    + `<div class="v">${esc(value)}</div><div class="s">${esc(sub)}</div></div>`;
}

const bare = (s) => s.replace(' €/kWh', ' €');

/**
 * render.insights. `nextPoint` es la próxima oportunidad (hoy: remainingCheapest);
 * null → la mejor hora del día, como el SSR.
 */
export function insightsHtml(day, zone, points, st, comparison, nextPoint = null) {
  const badge = dayBadge(day);
  let tiles;
  let advice = '';
  if (!points.length || !st) {
    tiles = [['g', 'clock-check', 'Hora más barata'], ['r', 'warning', 'Hora más cara'],
      ['t', 'clock-arrow', 'Próxima oportunidad'], ['o', 'arrows-lr', 'Rango del día']]
      .map(([c, i, t]) => tile(c, i, t, '—', 'Sin datos', true)).join('');
  } else {
    const best = minimum(points);
    const worst = maximum(points);
    const bl = hourLabel(best.start, zone.tz);
    const wl = hourLabel(worst.start, zone.tz);
    const nxt = nextPoint || best;
    tiles = tile('g', 'clock-check', 'Hora más barata', bare(fmtEur(best.eurKwh, 3)), bl)
      + tile('r', 'warning', 'Hora más cara', bare(fmtEur(worst.eurKwh)), wl)
      + `<div class="tile t" id="tile-next"><div class="t">${icon('clock-arrow')}Próxima oportunidad</div>`
      + `<div class="v">${fmtNumber(nxt.eurKwh)} €</div><div class="s">${hourLabel(nxt.start, zone.tz)}</div></div>`
      + tile('o', 'arrows-lr', 'Rango del día', `${fmtNumber(st.max - st.min)} €`, 'máx - mín');
    const dl = dayLevel(st.avg);
    const sl = spreadLevel(st.max - st.min);
    const c = consejo(dl, sl, bl);
    advice = `<div class="advice">
  <div class="row"><span class="lbl caption semi sec">${icon('bolt')}Consejo del día</span><span class="badge xs">${esc(levelBadge(dl, sl))}</span></div>
  <div class="callout">${icon('quote')}<div class="stack"><div class="t">${esc(c.title)}</div><div class="x">${esc(c.summary)}</div></div></div>
  <div class="callout">${icon('checkmark')}<div class="stack"><div class="t">Acción</div><div class="x">${esc(c.action)} Mejor hora: ${bl}. Peor hora: ${wl}.</div></div></div>
</div>`;
  }
  const comp = comparison
    ? `<div class="callout" id="comparison">${icon('trend')}<div class="stack"><div class="t">Comparativa</div><div class="x">${esc(comparison)}</div></div></div>`
    : '';
  return `<section class="card" id="insights"><div class="row"><h2 class="lbl headline">${icon('sparkles')}Resumen del día</h2>`
    + `<span class="badge">${esc(badge)}</span></div><div class="tiles">${tiles}</div>${comp}${advice}<hr class="sep"></section>`;
}

/** Próxima oportunidad de hoy: la hora más barata que queda (la actual incluida). */
export function nextOpportunity(points, now) {
  const r = remainingCheapest(points, now, 1, { includingCurrent: true });
  return r.length ? r[0] : null;
}

// MARK: Controlador

let ctx = null;

function $(sel) {
  return document.querySelector(sel);
}

export function init(c) {
  ctx = c;
  return visible($('#comparativa')) || visible($('#insights'));
}

function rerender(stamp) {
  return (value) => {
    if (value && ctx && ctx.stamp() === stamp) render(ctx.snapshot());
  };
}

export function render(state) {
  if (!ctx) return;
  const comp = $('#comparativa');
  const ins = $('#insights');
  if (!comp && !ins) return;
  const { day, zone, now, today } = state;
  const series = zone.series;
  const prev = addDays(day, -1);
  const next = addDays(day, 1);
  const stamp = ctx.stamp();

  const st = ctx.stats(day, series);
  const stPrev = ctx.stats(prev, series);
  const stNext = ctx.stats(next, series);
  if (!ctx.has(prev)) ctx.ensureDay(prev).then(rerender(stamp));
  if (!ctx.has(next)) ctx.ensureDay(next).then(rerender(stamp));
  const nextState = !stNext && next > today ? 'future' : 'none';

  let entry = ctx.calendarEntry(day, series);
  if (entry === undefined) {
    ctx.ensureCalendar(day.slice(0, 7)).then(rerender(stamp));
    entry = null;
  }
  const weekend = isWeekend(day);
  const baseline = entry ? (weekend ? entry.typWe : entry.typWd) : 0;
  const comparison = st ? comparisonText(st.avg, baseline, weekend) : null;

  const pts = ctx.points(day, series);
  const nextPoint = day === today && pts.length ? nextOpportunity(pts, now) : null;

  if (comp) replaceEl(comp, comparativaHtml(stPrev, st, stNext, nextState, publicationLabel(zone, now)));
  if (ins) replaceEl(ins, insightsHtml(day, zone, pts, st, comparison, nextPoint));
}

/** Tick: solo la tile "Próxima oportunidad" cambia con la hora. */
export function tick(state) {
  const t = $('#tile-next');
  if (!t || state.day !== state.today) return;
  const pts = ctx.points(state.day, state.zone.series);
  const p = pts.length ? nextOpportunity(pts, state.now) || minimum(pts) : null;
  if (!p) return;
  const v = t.querySelector('.v');
  const s = t.querySelector('.s');
  const label = hourLabel(p.start, state.zone.tz);
  if (v) v.textContent = `${fmtNumber(p.eurKwh)} €`;
  if (s && s.textContent !== label) s.textContent = label;
}
