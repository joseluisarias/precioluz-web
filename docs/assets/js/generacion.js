// generacion.js — pestaña Generación: segmentado "Hoy (hasta ahora) | Ayer"
// (apidatos no ofrece el mix por horas: el "tiempo real" de la app necesita el token de ESIOS),
// donut SVG (misma geometría que render.donut_svg), KPIs, lista de tecnologías,
// selección de tecnología, botón Actualizar y esqueleto. Mismo markup que
// render.generacion_card en precioluz/render.py.

import { clockLabel } from './tz.js';
import { fmtNumber, fmtPct, shortDate } from './format.js';
import { icon, esc, visible } from './dia.js';

// MARK: Markup

/** Sector anular entre ángulos a0→a1 (radianes, 0 = las 12, sentido horario). */
export function arc(cx, cy, rOut, rIn, a0, a1) {
  const pt = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const f = (n) => n.toFixed(2);
  const [x0, y0] = pt(rOut, a0);
  const [x1, y1] = pt(rOut, a1);
  const [xi1, yi1] = pt(rIn, a1);
  const [xi0, yi0] = pt(rIn, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${f(x0)} ${f(y0)} A${f(rOut)} ${f(rOut)} 0 ${large} 1 ${f(x1)} ${f(y1)} `
    + `L${f(xi1)} ${f(yi1)} A${f(rIn)} ${f(rIn)} 0 ${large} 0 ${f(xi0)} ${f(yi0)} Z`;
}

/** render.donut_svg; `selected` marca un path con .sel y el resto con .dim. */
export function donutSvg(entries, selected = null) {
  const cx = 140;
  const cy = 140;
  const rOut = 138;
  const rIn = 138 * 0.618;
  let total = 0;
  for (const e of entries) total += e.v;
  if (!total) total = 1;
  let a = 0;
  const paths = entries.map((e) => {
    const frac = e.v / total;
    const a1 = a + frac * 2 * Math.PI;
    const d = frac >= 0.9999
      ? `${arc(cx, cy, rOut, rIn, 0, Math.PI)} ${arc(cx, cy, rOut, rIn, Math.PI, 2 * Math.PI - 1e-6)}`
      : arc(cx, cy, rOut, rIn, a, a1);
    a = a1;
    const cls = selected === null ? '' : (e.t === selected ? ' class="sel"' : ' class="dim"');
    return `<path d="${d}" fill="${esc(e.color || '#8E8E93')}" data-t="${esc(e.t)}"${cls}><title>${esc(e.t)}: ${fmtPct(e.pct)}</title></path>`;
  });
  return `<svg class="donut-svg" viewBox="0 0 280 280" role="img" aria-label="Mix de generación">${paths.join('')}</svg>`;
}

/** "789,0 GWh" / "955 MWh" (render.fmt_energy); unidad 'W' para potencia (MW/GW). */
export function fmtEnergy(v, unit = 'Wh') {
  return v >= 1000 ? `${fmtNumber(v / 1000, 1)} G${unit}` : `${fmtNumber(v, 0)} M${unit}`;
}

export const SEGMENTED = (mode) => '<div class="segmented" role="group" aria-label="Modo">'
  + `<button type="button" data-mode="now" aria-selected="${mode === 'now'}">Hoy (hasta ahora)</button>`
  + `<button type="button" data-mode="day" aria-selected="${mode === 'day'}">Ayer</button></div>`;

export const SKELETON = '<div class="skel" aria-busy="true" aria-label="Cargando generación"><div class="skel-donut"></div>'
  + '<div class="skel-row"></div><div class="skel-row"></div><div class="skel-row"></div></div>';

function centerHtml(gen, unit, selected) {
  const e = selected ? gen.entries.find((x) => x.t === selected) : null;
  if (e) {
    return `<div class="center"><span class="t">${esc(e.t)}</span><span class="v">${fmtEnergy(e.v, unit)}</span>`
      + `<span class="s" style="color:${esc(e.color)}">${fmtPct(e.pct)}</span></div>`;
  }
  return `<div class="center"><span class="t">Total</span><span class="v">${fmtEnergy(gen.total, unit)}</span>`
    + `<span class="s">${fmtPct(gen.renewablePct)} renovable</span></div>`;
}

/**
 * Interior de `<section class="card" id="generacion">` (render.generacion_card).
 * mode 'day' → título "Generación acumulada · dd/MM" y MWh; 'now' → "Generación
 * ahora", badge con la hora del dato en el reloj de la zona y MW.
 */
export function generacionInner(gen, mode, { zone = null, selected = null } = {}) {
  const seg = SEGMENTED(mode);
  if (!gen || !gen.entries || !gen.entries.length) {
    return `${seg}<div class="row"><h2 class="lbl headline" id="gen-title">${icon('bolt')}Generación</h2>`
      + `<span class="badge" id="gen-badge">Sin datos</span></div>${SKELETON}`;
  }
  const unit = 'Wh';
  const entries = gen.entries;
  const totalTxt = fmtEnergy(gen.total, unit);
  const dom = entries[0];
  let title;
  let badge;
  if (mode === 'now') {
    const at = Date.parse(gen.datetime || '');
    title = `Generación de hoy · hasta ahora`;
    badge = gen.day ? `${esc(gen.day.slice(8, 10))}/${esc(gen.day.slice(5, 7))}` : (Number.isFinite(at) ? clockLabel(at, zone ? zone.tz : undefined) : '—');
  } else {
    title = `Generación de ayer · ${esc(shortDate(gen.day))}`;
    badge = `${esc(gen.day.slice(8, 10))}/${esc(gen.day.slice(5, 7))}`;
  }
  const rows = entries.map((e) =>
    `<li><button type="button" data-t="${esc(e.t)}" style="--sw:${esc(e.color)}" aria-pressed="${e.t === selected}">`
    + `<span class="n">${esc(e.t)}</span><span class="v">${fmtEnergy(e.v, unit)}</span>`
    + `<span class="pc">${fmtPct(e.pct)}</span></button></li>`).join('');
  return `
  ${seg}
  <div class="row"><h2 class="lbl headline" id="gen-title">${icon('bolt')}${title}</h2><span class="badge" id="gen-badge">${badge}</span></div>
  <div class="donut" id="gen-donut">${donutSvg(entries, selected)}${centerHtml(gen, unit, selected)}</div>
  <div class="kpis">
    <div class="kpi">${icon('bolt')}<span class="stack"><span class="t">Total</span><span class="v">${totalTxt}</span></span></div>
    <div class="kpi" style="--tint:var(--green)">${icon('leaf')}<span class="stack"><span class="t">Renovable</span><span class="v">${fmtPct(gen.renewablePct)}</span></span></div>
    <div class="kpi" style="--tint:${esc(dom.color)}">${icon('star')}<span class="stack"><span class="t">Dominante</span><span class="v">${esc(dom.t)}</span></span></div>
  </div>
  <hr class="sep">
  <ul class="tech" id="gen-list">${rows}</ul>
  <div class="row end"><button type="button" class="btn sm" id="gen-refresh">${icon('refresh')}Actualizar</button></div>
`;
}

// MARK: Controlador

let ctx = null;
let section = null;
let mode = 'day';

/** "2026-09-22" → "2026-09-21" (aritmética UTC sobre el mediodía: sin líos de DST). */
function yesterdayOf(day) {
  return new Date(Date.parse(`${day}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);
}
let selected = null;
let seq = 0;
let loadedOnce = false;
let nowAt = 0;                         // instante de la última carga de "Ahora"
let shown = null;                      // {gen, mode} de lo que está pintado (SSR incluido)
const data = { now: null, day: null };

const $ = (sel, root = document) => root.querySelector(sel);

function paint() {
  const gen = data[mode];
  if (!gen) return;
  if (selected && !gen.entries.some((e) => e.t === selected)) selected = null;
  shown = { gen, mode };
  section.innerHTML = generacionInner(gen, mode, { zone: ctx.snapshot().zone, selected });
}

function setSegmented(m) {
  section.querySelectorAll('.segmented [data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
}

/** Cambia la selección sin re-pintar todo: aria-pressed, .sel/.dim y el centro. */
function select(t) {
  selected = selected === t ? null : t;
  const gen = shown && shown.gen;
  if (!gen) return;
  section.querySelectorAll('#gen-list button[data-t]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === selected)));
  section.querySelectorAll('#gen-donut path[data-t]').forEach((p) => {
    p.classList.toggle('sel', selected !== null && p.dataset.t === selected);
    p.classList.toggle('dim', selected !== null && p.dataset.t !== selected);
  });
  const center = $('#gen-donut .center', section);
  if (center) center.outerHTML = centerHtml(gen, 'Wh', selected);
}

function setBadge(text) {
  const b = $('#gen-badge', section);
  if (b) b.textContent = text;
}

/**
 * Carga un modo. Mientras llega el dato se mantiene lo que ya está pintado (SSR u
 * otro modo) con el badge "Cargando…"; el esqueleto solo aparece si no hay nada.
 * Si falla, se conserva lo que había, el segmentado vuelve a lo que se ve y el
 * badge dice "No disponible". Devuelve true si se pintó dato nuevo.
 */
async function load(m, { force = false } = {}) {
  if (!ctx || !section) return false;
  const my = ++seq;
  const before = { html: section.innerHTML, shown, mode };
  mode = m;
  loadedOnce = true;
  if (!shown) {
    section.innerHTML = `${SEGMENTED(m)}<div class="row"><h2 class="lbl headline" id="gen-title">${icon('bolt')}`
      + `${m === 'now' ? 'Generación de hoy · hasta ahora' : 'Generación de ayer'}</h2><span class="badge" id="gen-badge">Cargando…</span></div>${SKELETON}`;
  } else {
    setSegmented(m);
    setBadge('Cargando…');
  }
  section.setAttribute('aria-busy', 'true');
  const gen = m === 'now'
    ? await ctx.api.fetchGenerationDay(ctx.today(), { force })
    : await ctx.api.fetchGenerationDay(yesterdayOf(ctx.today()), { force });
  if (my !== seq) return false;
  section.removeAttribute('aria-busy');
  if (gen) {
    data[m] = gen;
    if (m === 'now') nowAt = Date.now();
    paint();
    return true;
  }
  section.innerHTML = before.html;
  shown = before.shown;
  mode = before.mode;
  setSegmented(mode);
  setBadge('No disponible');
  return false;
}

/** Carga "Ahora" la primera vez que el panel se muestra. */
export function ensureLoaded() {
  if (!loadedOnce) load('now');
}

export function init(c) {
  ctx = c;
  section = $('#generacion');
  if (!visible(section)) { section = null; return false; }
  // El SSR trae el acumulado de AYER; el modo "día" en vivo pide el de hoy.
  if (ctx.boot && ctx.boot.generation && ctx.boot.generation.entries) shown = { gen: ctx.boot.generation, mode: 'day' };
  section.addEventListener('click', (e) => {
    const seg = e.target.closest('.segmented [data-mode]');
    if (seg) { if (seg.dataset.mode !== mode || !data[seg.dataset.mode]) load(seg.dataset.mode); return; }
    if (e.target.closest('#gen-refresh')) { load(mode, { force: true }); return; }
    const btn = e.target.closest('#gen-list button[data-t]');
    if (btn) { select(btn.dataset.t); return; }
    const path = e.target.closest('#gen-donut path[data-t]');
    if (path) { select(path.dataset.t); return; }
    if (e.target.closest('#gen-donut .center') && selected) select(selected);
  });
  // En /generacion/ el SSR trae el acumulado de ayer: con JS se arranca en "Ahora" y, si
  // apidatos no sirve la hora (hoy responde 400 a time_trunc=hour), en el acumulado de hoy.
  if (ctx.boot.tab === 'generacion' || /^\/generacion\/?/.test(location.pathname)) {
    load('now').then((ok) => { if (!ok && !data.day) load('day'); });
  } else {
    document.addEventListener('pl:tab', (e) => { if (e.detail && e.detail.tab === 'generacion') ensureLoaded(); });
  }
  return true;
}

/** Cambio de zona: el badge de "Ahora" va en el reloj de la zona. */
export function render() {
  if (section && data[mode]) paint();
}

/** "Ahora" caduca a los 10 min: si el panel sigue visible, se refresca solo. */
export function tick(state) {
  if (!section || mode !== 'now' || !data.now || section.getAttribute('aria-busy') === 'true') return;
  if (state.now - nowAt > 10 * 60000) load('now');
}
