// engine.js — port EXACTO de PriceEngine.swift (la app) y gemelo de precioluz/engine.py.
// Puro (sin DOM). tools/parity.py comprueba que `bands` coincide con Python en
// todos los días guardados; cualquier cambio aquí debe hacerse también allí.
//
// Modelo: una fila del JSON del sitio es {i, h, pcb, cym} en €/MWh; un "punto"
// es {index, label, eurKwh, start, end} con start/end en epoch ms, anclados por
// ÍNDICE desde la medianoche de Madrid (nunca por la etiqueta). Así el día de
// 23 h pone el índice 2 en las 03:00 reales y el de 25 h distingue las dos 02:00.

import { madridDayStart, HOUR_MS, MINUTE_MS } from './tz.js';

export const LEAD_MINUTES = 30;
export const TOLERANCE_EUR_KWH = 0.01;
export const MAX_WINDOW_HOURS = 6;
export const MAX_RATIO_VS_AVERAGE = 0.85;
export const MAX_HOURS_PER_DAY = 25;
export const PROXIMITY_EUR_KWH = 0.005;

const GREEN_BELOW = 0.65;
const ORANGE_UPTO = 0.85;
const MIN_GREENS = 4;
const MIN_ORANGES = 4;

export const GREEN = 'g';
export const ORANGE = 'o';
export const RED = 'r';

// MARK: Construcción

/** Puntos del día para una serie ('pcb' | 'cym'); las filas sin esa serie se saltan. */
export function buildDay(rows, dayKey, series = 'pcb') {
  if (series !== 'pcb' && series !== 'cym') throw new Error(`serie desconocida: ${series}`);
  if (!Array.isArray(rows) || rows.length > MAX_HOURS_PER_DAY) return [];
  const base = madridDayStart(dayKey);
  const out = [];
  for (const r of rows) {
    const mwh = series === 'cym' ? r.cym : r.pcb;
    if (mwh === null || mwh === undefined) continue;
    const value = Number(mwh) / 1000;
    if (!Number.isFinite(value)) continue;
    const start = base + r.i * HOUR_MS;
    out.push({ index: r.i, label: r.h, eurKwh: value, start, end: start + HOUR_MS });
  }
  return out;
}

// MARK: Métricas

/** Media sumando en orden (misma aritmética que Swift y Python). */
export function average(points) {
  if (!points.length) return 0;
  let total = 0;
  for (const p of points) total += p.eurKwh;
  return total / points.length;
}

function byPrice(a, b) {
  return a.eurKwh === b.eurKwh ? a.index - b.index : a.eurKwh - b.eurKwh;
}

function byIndex(a, b) {
  return a.index - b.index;
}

/** Hora más barata; empate → índice menor. */
export function minimum(points) {
  let best = null;
  for (const p of points) if (best === null || byPrice(p, best) < 0) best = p;
  return best;
}

/** Hora más cara; empate → índice menor (el primer máximo, como `max(by:)`). */
export function maximum(points) {
  let best = null;
  for (const p of points) {
    if (best === null || p.eurKwh > best.eurKwh || (p.eurKwh === best.eurKwh && p.index < best.index)) best = p;
  }
  return best;
}

/** La hora que contiene `now` (comparación por instantes). */
export function current(points, now) {
  for (const p of points) if (p.start <= now && now < p.end) return p;
  return null;
}

/** {avg, min, max, minIdx, maxIdx} en €/kWh, o null sin horas. */
export function stats(points) {
  if (!points.length) return null;
  const lo = minimum(points);
  const hi = maximum(points);
  return { avg: average(points), min: lo.eurKwh, max: hi.eurKwh, minIdx: lo.index, maxIdx: hi.index };
}

// MARK: Disponibilidad

function available(points, now, { includingCurrent = true, leadMinutes = 0 } = {}) {
  if (includingCurrent) return points.filter((p) => p.end > now);
  const cutoff = now + leadMinutes * MINUTE_MS;
  return points.filter((p) => p.start >= cutoff);
}

/** Las `count` horas más baratas que quedan, en orden temporal. Nunca mira atrás. */
export function remainingCheapest(points, now, count, opts = {}) {
  if (!(count > 0)) return [];
  const cheapest = available(points, now, opts).sort(byPrice).slice(0, count);
  return cheapest.sort(byIndex);
}

/** Mejor tramo CONTIGUO de `length` horas que queda (sin umbral de baratura). */
export function bestContiguousRun(points, length, now, opts = {}) {
  if (!(length > 0) || points.length < length) return null;
  const startable = new Set(available(points, now, opts).map((p) => p.index));
  const map = new Map(points.map((p) => [p.index, p]));

  let best = null;
  for (const p of [...points].sort(byIndex)) {
    if (!startable.has(p.index)) continue;
    const run = [];
    for (let offset = 0; offset < length; offset++) {
      const next = map.get(p.index + offset);
      if (!next) break;
      run.push(next);
    }
    if (run.length !== length) continue;
    let total = 0;
    for (const q of run) total += q.eurKwh;
    const avg = total / length;
    if (best === null || avg < best.avg) best = { avg, run };
  }
  if (!best) return null;
  const run = best.run;
  return {
    start: run[0].start, end: run[run.length - 1].end, hourCount: run.length,
    minEurKwh: Math.min(...run.map((q) => q.eurKwh)), avgEurKwh: best.avg,
  };
}

/** ¿Merece la pena llamar "barato" a este tramo? */
export function isWorthAnnouncing(window, dayAverage, maxRatio = MAX_RATIO_VS_AVERAGE) {
  if (!(dayAverage > 0)) return false;
  return window.avgEurKwh <= dayAverage * maxRatio;
}

// MARK: Ventana con horquilla

function windowAround(anchor, pool, tolerance, maxHours) {
  const ceiling = anchor.eurKwh + tolerance;
  const map = new Map(pool.map((p) => [p.index, p]));
  if (!map.has(anchor.index)) return null;

  let lo = anchor.index;
  let hi = anchor.index;
  while (map.has(lo - 1) && map.get(lo - 1).eurKwh <= ceiling) lo -= 1;
  while (map.has(hi + 1) && map.get(hi + 1).eurKwh <= ceiling) hi += 1;

  const cap = Math.max(1, maxHours);
  while (hi - lo + 1 > cap) {
    const leftVal = map.has(lo) ? map.get(lo).eurKwh : -Infinity;
    const rightVal = map.has(hi) ? map.get(hi).eurKwh : -Infinity;
    if (lo === anchor.index) hi -= 1;
    else if (hi === anchor.index) lo += 1;
    else if (leftVal >= rightVal) lo += 1;
    else hi -= 1;
  }

  const run = [];
  for (let i = lo; i <= hi; i++) if (map.has(i)) run.push(map.get(i));
  if (!run.length) return null;
  let total = 0;
  for (const q of run) total += q.eurKwh;
  return {
    start: run[0].start, end: run[run.length - 1].end, hourCount: run.length,
    minEurKwh: anchor.eurKwh, avgEurKwh: total / run.length,
  };
}

/** Tramo barato FUTURO con antelación y umbral; null si nada califica. */
export function upcomingCheapWindow(points, now, {
  leadMinutes = LEAD_MINUTES, tolerance = TOLERANCE_EUR_KWH,
  maxHours = MAX_WINDOW_HOURS, maxRatio = MAX_RATIO_VS_AVERAGE,
} = {}) {
  const dayAvg = average(points);
  if (!(dayAvg > 0)) return null;
  const cutoff = now + (leadMinutes + 1) * MINUTE_MS;
  const candidates = points.filter((p) => p.start >= cutoff);
  const anchor = minimum(candidates);
  if (!anchor) return null;
  const window = windowAround(anchor, candidates, tolerance, maxHours);
  if (!window) return null;
  if (window.avgEurKwh > dayAvg * maxRatio) return null;
  return window;
}

/** Tramo más barato del día SIN filtro temporal ni umbral. */
export function dayCheapWindow(points, { tolerance = TOLERANCE_EUR_KWH, maxHours = MAX_WINDOW_HOURS } = {}) {
  const anchor = minimum(points);
  if (!anchor) return null;
  return windowAround(anchor, points, tolerance, maxHours);
}

// MARK: Color

/**
 * Un carácter por hora, en el orden de `points`: 'g' verde, 'o' naranja, 'r' rojo.
 * Port fiel de PriceEngine.bands / ContentView.assignColors, incluida la rareza
 * del relleno de naranjas (no salta las que ya son naranjas y decrementa igual).
 * Devuelve "" sin horas o con media no positiva.
 */
export function bands(points, proximity = PROXIMITY_EUR_KWH) {
  if (!points.length) return '';
  const avg = average(points);
  if (!(avg > 0)) return '';

  const out = new Map();
  for (const p of points) {
    const ratio = p.eurKwh / avg;
    out.set(p.index, ratio < GREEN_BELOW ? GREEN : (ratio <= ORANGE_UPTO ? ORANGE : RED));
  }

  const sortedByPrice = [...points].sort(byPrice);

  // Mínimo de 4 verdes.
  const targetGreens = Math.min(MIN_GREENS, points.length);
  let greens = 0;
  for (const b of out.values()) if (b === GREEN) greens += 1;
  let i = 0;
  while (greens < targetGreens && i < sortedByPrice.length) {
    const p = sortedByPrice[i];
    i += 1;
    if (out.get(p.index) !== GREEN) { out.set(p.index, GREEN); greens += 1; }
  }

  // Expansión por proximidad a los verdes.
  expand(GREEN, out, points, sortedByPrice, proximity, (b) => b !== GREEN);

  // Relleno de naranjas (rareza replicada a propósito).
  const targetOranges = Math.min(MIN_ORANGES, points.length);
  let currentOranges = 0;
  for (const b of out.values()) if (b === ORANGE) currentOranges += 1;
  if (currentOranges < targetOranges) {
    let needed = targetOranges - currentOranges;
    for (const p of sortedByPrice) {
      if (needed <= 0) break;
      if (out.get(p.index) === GREEN) continue;
      out.set(p.index, ORANGE);
      needed -= 1;
    }
  }

  // Expansión por proximidad a los naranjas (solo desde rojo).
  expand(ORANGE, out, points, sortedByPrice, proximity, (b) => b === RED);

  let s = '';
  for (const p of points) s += out.get(p.index);
  return s;
}

function expand(band, out, points, sortedByPrice, threshold, isEligible) {
  if (!(threshold > 0)) return;
  const queue = [];
  for (const p of sortedByPrice) if (out.get(p.index) === band) queue.push(p.eurKwh);
  let cursor = 0;
  while (cursor < queue.length) {
    const reference = queue[cursor];
    cursor += 1;
    for (const p of points) {
      if (!isEligible(out.get(p.index))) continue;
      if (Math.abs(p.eurKwh - reference) <= threshold) {
        out.set(p.index, band);
        queue.push(p.eurKwh);
      }
    }
  }
}

/** Misma clasificación como Map índice → banda. */
export function bandsByIndex(points, proximity = PROXIMITY_EUR_KWH) {
  const s = bands(points, proximity);
  const map = new Map();
  if (s) points.forEach((p, k) => map.set(p.index, s[k]));
  return map;
}

/** Bloques `stats` y `bands` del JSON de un día, para las dos series. */
export function dayStatsJson(rows, dayKey) {
  const st = {};
  const bd = {};
  for (const series of ['pcb', 'cym']) {
    const pts = buildDay(rows, dayKey, series);
    const s = stats(pts);
    if (!s) continue;
    st[series] = s;
    bd[series] = bands(pts);
  }
  return { stats: st, bands: bd };
}
