// tz.js — zonas horarias sin librerías: offsets vía Intl.DateTimeFormat.formatToParts.
// Puro (sin DOM). Todo instante es epoch ms; toda clave de día es "yyyy-MM-dd".
//
// Regla: la identidad del día (clave, medianoche para anclar) es SIEMPRE hora
// de Madrid (la de los datos de REE); la etiqueta que ve el usuario va en el
// reloj de su zona (Canarias = una hora menos).

export const DATA_TZ = 'Europe/Madrid';
export const HOUR_MS = 3600000;
export const MINUTE_MS = 60000;
// A partir de este minuto del reloj de Madrid se ofrece "mañana" en el selector.
export const TOMORROW_UNLOCK_MINUTES = 20 * 60 + 16;

const formatters = new Map();

function formatter(tz) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

export function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Componentes de reloj de `epochMs` en `tz`: {year, month(1-12), day, hour, minute, second}. */
export function localParts(epochMs, tz = DATA_TZ) {
  const out = {};
  for (const p of formatter(tz).formatToParts(new Date(epochMs))) {
    if (p.type !== 'literal') out[p.type] = parseInt(p.value, 10);
  }
  if (out.hour === 24) out.hour = 0;   // algunos motores escriben "24" a medianoche
  return out;
}

/** Desfase de `tz` respecto a UTC en ese instante, en minutos (Madrid: 60 o 120). */
export function offsetMinutes(epochMs, tz = DATA_TZ) {
  const whole = Math.floor(epochMs / 1000) * 1000;
  const p = localParts(whole, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - whole) / MINUTE_MS);
}

/** Epoch ms del reloj local (year, month 1-12, day, hour, minute) en `tz`. */
export function localToEpoch(year, month, day, hour = 0, minute = 0, tz = DATA_TZ) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const off = offsetMinutes(guess, tz);
  let candidate = guess - off * MINUTE_MS;
  const off2 = offsetMinutes(candidate, tz);
  if (off2 !== off) candidate = guess - off2 * MINUTE_MS;
  return candidate;
}

export function parseDayKey(dayKey) {
  const [year, month, day] = String(dayKey).split('-').map(Number);
  return { year, month, day };
}

export function makeDayKey(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Medianoche de Madrid del día, en epoch ms. Es el ancla de `buildDay` (slot i = +i·3600 s). */
export function madridDayStart(dayKey) {
  const { year, month, day } = parseDayKey(dayKey);
  return localToEpoch(year, month, day, 0, 0, DATA_TZ);
}

/** Clave "yyyy-MM-dd" de un instante en `tz`. */
export function dayKeyOf(epochMs, tz = DATA_TZ) {
  const p = localParts(epochMs, tz);
  return makeDayKey(p.year, p.month, p.day);
}

export function madridTodayKey(now = Date.now()) {
  return dayKeyOf(now, DATA_TZ);
}

/** "14:00" derivado del instante en el reloj de `tz` (la hora 23 + 1 h es "00:00", nunca "24:00"). */
export function hourLabel(epochMs, tz = DATA_TZ) {
  return `${pad2(localParts(epochMs, tz).hour)}:00`;
}

/** "14:05" (para el pie "Última actualización"). */
export function clockLabel(epochMs, tz = DATA_TZ) {
  const p = localParts(epochMs, tz);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Minutos desde la medianoche local de `tz`. */
export function minutesOfDay(epochMs, tz = DATA_TZ) {
  const p = localParts(epochMs, tz);
  return p.hour * 60 + p.minute;
}

/** Suma `n` días (calendario puro, sin zonas) a una clave. */
export function addDays(dayKey, n) {
  const { year, month, day } = parseDayKey(dayKey);
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return makeDayKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Día de la semana de una clave: 0 = domingo … 6 = sábado (como Date.getUTCDay). */
export function weekdayOf(dayKey) {
  const { year, month, day } = parseDayKey(dayKey);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Último día seleccionable: mañana desde las 20:16 de Madrid, hoy antes. */
export function maxAllowedDay(now = Date.now()) {
  const today = madridTodayKey(now);
  return minutesOfDay(now, DATA_TZ) >= TOMORROW_UNLOCK_MINUTES ? addDays(today, 1) : today;
}

/** Compara claves "yyyy-MM-dd" (lexicográfico = cronológico). */
export function compareDayKeys(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
