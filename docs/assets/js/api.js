// api.js — acceso a datos: JSON del sitio primero y, de respaldo, REE en vivo
// (ESIOS archivo 70 para el PVPC, apidatos para la generación). Los parsers son
// puros y gemelos de precioluz/archive70.py y precioluz/generation.py; el resto
// nunca lanza: ante red caída, timeout o JSON raro devuelve null.
//
// Caché local (store.ls, prefijo pl.v1.):
//   pvpc.<día>                 respaldo de ESIOS (el JSON del sitio no se cachea)
//   gen.hour.<yyyy-MM-ddTHH>   10 min
//   gen.day.<día>              60 min
// y poda de todo lo anterior a 7 días.

import { ls } from './store.js';
import { dayStatsJson } from './engine.js';
import { madridTodayKey, addDays, localParts, pad2 } from './tz.js';

export const TIMEOUT_MS = 15000;
export const KEEP_DAYS = 7;
const GEN_HOUR_TTL = 10 * 60000;
const GEN_DAY_TTL = 60 * 60000;

export const esiosUrl = (day) => `https://api.esios.ree.es/archives/70/download_json?date=${day}`;
export const apidatosUrl = (day, trunc) =>
  'https://apidatos.ree.es/es/datos/generacion/estructura-generacion' +
  `?start_date=${day}T00:00&end_date=${day}T23:59&time_trunc=${trunc}`;

// MARK: Archivo 70 (precioluz/archive70.py)

/** '216,88' → 216.88; null si no es un número (la app también lo descarta). */
export function parsePrice(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (s.includes(',')) s = s.split('.').join('').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** '9-10' → '09-10'; acepta guion largo. Devuelve el original si no encaja. */
export function normalizeLabel(raw) {
  const parts = String(raw).replace('–', '-').split(' ').join('').split('-');
  if (parts.length !== 2 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) return String(raw);
  return `${pad2(Number(parts[0]))}-${pad2(Number(parts[1]))}`;
}

/**
 * JSON del archivo 70 → filas [{i, h, pcb, cym}] (€/MWh) o null si el día no está
 * publicado ({"message": …}) o la respuesta no es un día utilizable (23–25 filas).
 */
export function parseArchive70(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.PVPC)) return null;
  const rows = obj.PVPC;
  if (rows.length < 23 || rows.length > 25) return null;
  const out = [];
  rows.forEach((row, i) => {
    const pcb = parsePrice(row && row.PCB);
    if (pcb === null) return;
    out.push({ i, h: normalizeLabel((row && row.Hora) || ''), pcb, cym: parsePrice(row.CYM) });
  });
  return out.length ? out : null;
}

/** Misma forma que docs/data/pvpc/<día>.json (con stats y bands). */
export function dayFile(day, rows, fetchedAt = new Date().toISOString()) {
  return { day, n: rows.length, fetchedAt, hours: rows, ...dayStatsJson(rows, day) };
}

// MARK: apidatos (precioluz/generation.py)

export const RENEWABLE = new Set([
  'Eólica', 'Hidráulica', 'Solar fotovoltaica', 'Solar térmica', 'Biomasa',
  'Otras renovables', 'Residuos renovables', 'Térmica renovable',
]);

export const APP_COLORS = {
  'Eólica': '#7CC33F', 'Nuclear': '#7B2D8E', 'Hidráulica': '#3498DB',
  'Solar fotovoltaica': '#F5B700', 'Solar térmica': '#FFD700', 'Ciclo combinado': '#E67E22',
  'Cogeneración': '#9B59B6', 'Cogeneración y residuos': '#9B59B6', 'Carbón': '#2C3E50',
  'Residuos no renovables': '#E74C3C', 'Biomasa': '#27AE60', 'Turbinación bombeo': '#1ABC9C',
  'Otras renovables': '#2ECC71', 'Residuos renovables': '#66BB6A', 'Generación auxiliar': '#78909C',
  'Motores diésel': '#455A64', 'Motor diésel': '#455A64', 'Turbina de gas': '#FF7043',
  'Turbina de vapor': '#AB47BC', 'Térmica renovable': '#2ECC71',
};

const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Respuesta de estructura-generacion → {total, renewablePct, datetime, entries:[{t,v,pct,color}]}
 * (último valor de cada tecnología, sin "Generación total" ni |v| ≤ 0,1, orden
 * descendente, pct recalculado). null si no hay tecnologías con valor.
 */
export function parseGeneration(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.included)) return null;
  const entries = [];
  let latest = '';
  for (const inc of obj.included) {
    const attrs = (inc && inc.attributes) || {};
    const title = attrs.title || '';
    const values = Array.isArray(attrs.values) ? attrs.values : [];
    if (!values.length || title === 'Generación total') continue;
    const last = values[values.length - 1] || {};
    const v = Number(last.value || 0);
    if (!Number.isFinite(v) || Math.abs(v) <= 0.1) continue;
    const dt = String(last.datetime || '');
    if (dt > latest) latest = dt;
    entries.push({ t: title, v: round2(v), color: APP_COLORS[title] || attrs.color || '#8E8E93' });
  }
  if (!entries.length) return null;
  let total = 0;
  for (const e of entries) total += e.v;
  for (const e of entries) e.pct = round2((e.v / total) * 100);
  entries.sort((a, b) => b.v - a.v);
  let renewable = 0;
  for (const e of entries) if (RENEWABLE.has(e.t)) renewable += e.v;
  return { total: round2(total), renewablePct: round2((renewable / total) * 100), datetime: latest, entries };
}

// MARK: Red

/** GET JSON; null ante cualquier fallo (red, timeout, HTTP ≠ 2xx, JSON inválido). */
export async function fetchJson(url, { timeout = TIMEOUT_MS, cache } = {}) {
  if (typeof fetch !== 'function') return null;
  try {
    const opts = { headers: { Accept: 'application/json' } };
    if (cache) opts.cache = cache;
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opts.signal = AbortSignal.timeout(timeout);
    const res = await fetch(url, opts);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Borra las cachés de más de KEEP_DAYS días. */
export function prune(today = madridTodayKey()) {
  const floor = addDays(today, -KEEP_DAYS);
  ls.prune('pvpc.', (k) => k.slice('pvpc.'.length, 'pvpc.'.length + 10) >= floor);
  ls.prune('gen.', (k) => (k.match(/\d{4}-\d{2}-\d{2}/) || [''])[0] >= floor);
}

/**
 * Día PVPC con la forma de docs/data/pvpc/<día>.json: primero el JSON del sitio
 * (salvo `site: false`, para días fuera del índice del build), después la caché
 * local del respaldo y, por último, ESIOS en vivo. null si no está publicado o no hay red.
 */
export async function fetchDay(day, { force = false, site = true } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const own = site ? await fetchJson(`/data/pvpc/${day}.json`, { cache: force ? 'reload' : undefined }) : null;
  if (own && Array.isArray(own.hours) && own.hours.length) {
    return own.stats && own.bands ? own : dayFile(day, own.hours, own.fetchedAt);
  }
  prune();
  const key = `pvpc.${day}`;
  if (!force) {
    const cached = ls.get(key);
    if (cached && Array.isArray(cached.hours) && cached.hours.length) return cached;
  }
  const raw = await fetchJson(esiosUrl(day));
  const rows = parseArchive70(raw);
  if (!rows) return null;
  const file = dayFile(day, rows);
  ls.set(key, file);
  return file;
}

/** docs/data/calendar/<mes>.json o null. */
export async function fetchCalendar(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const obj = await fetchJson(`/data/calendar/${month}.json`);
  return obj && obj.days ? obj : null;
}

function cachedGen(key, ttl, force) {
  if (force) return null;
  const c = ls.get(key);
  return c && c.data && Date.now() - c.at < ttl ? c.data : null;
}

/** Mix acumulado de un día (MWh). apidatos en vivo → JSON del sitio de respaldo. */
export async function fetchGenerationDay(day = madridTodayKey(), { force = false } = {}) {
  const key = `gen.day.${day}`;
  const hit = cachedGen(key, GEN_DAY_TTL, force);
  if (hit) return hit;
  const g = parseGeneration(await fetchJson(apidatosUrl(day, 'day')));
  if (g) {
    const data = { day, trunc: 'day', ...g };
    ls.set(key, { at: Date.now(), data });
    prune();
    return data;
  }
  const site = await fetchJson(`/data/generacion/${day}.json`);
  return site && Array.isArray(site.entries) && site.entries.length ? site : null;
}

/** Última hora disponible del mix (MW): hoy y, si aún no hay nada, ayer. */
export async function fetchGenerationHour({ force = false, now = Date.now() } = {}) {
  const today = madridTodayKey(now);
  const key = `gen.hour.${today}T${pad2(localParts(now).hour)}`;
  const hit = cachedGen(key, GEN_HOUR_TTL, force);
  if (hit) return hit;
  for (const day of [today, addDays(today, -1)]) {
    const g = parseGeneration(await fetchJson(apidatosUrl(day, 'hour')));
    if (!g) continue;
    const data = { day, trunc: 'hour', ...g };
    ls.set(key, { at: Date.now(), data });
    prune();
    return data;
  }
  return null;
}
