// zones.js — sistemas eléctricos de REE (espejo de PriceZone.swift y de precioluz/zones.py).
// Puro (sin DOM).
//
//  · Península, Baleares y Canarias comparten la serie `pcb`; Ceuta y Melilla usan `cym`.
//  · Todos los sellos horarios de REE van en hora peninsular: en Canarias solo
//    cambia el reloj (una hora menos), no el dato.

import { DATA_TZ, localParts, localToEpoch, madridTodayKey, parseDayKey } from './tz.js';

export { DATA_TZ };

export const PENINSULA = Object.freeze({ id: 'peninsula', name: 'Península', code: 'PEN', series: 'pcb', tz: DATA_TZ, subtitle: 'PVPC — datos oficiales', path: '/' });
export const CANARIAS = Object.freeze({ id: 'canarias', name: 'Canarias', code: 'CAN', series: 'pcb', tz: 'Atlantic/Canary', subtitle: 'PVPC · Canarias (hora local)', path: '/canarias/' });
export const BALEARES = Object.freeze({ id: 'baleares', name: 'Baleares', code: 'BAL', series: 'pcb', tz: DATA_TZ, subtitle: 'PVPC · Baleares', path: '/baleares/' });
export const CEUTA = Object.freeze({ id: 'ceuta', name: 'Ceuta', code: 'CEU', series: 'cym', tz: DATA_TZ, subtitle: 'PVPC · Ceuta', path: '/ceuta-melilla/' });
export const MELILLA = Object.freeze({ id: 'melilla', name: 'Melilla', code: 'MEL', series: 'cym', tz: DATA_TZ, subtitle: 'PVPC · Melilla', path: '/ceuta-melilla/' });

export const ZONES = Object.freeze([PENINSULA, CANARIAS, BALEARES, CEUTA, MELILLA]);

/** Zona por id crudo; Península si no existe. */
export function byId(id, fallback = PENINSULA) {
  return ZONES.find((z) => z.id === id) || fallback;
}

/** Detección por zona horaria: solo Canarias es detectable. */
export function detect(tzName) {
  return tzName === 'Atlantic/Canary' ? CANARIAS : PENINSULA;
}

/** Zona horaria del navegador (o null si Intl no la expone). */
export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** ¿El reloj de la zona coincide con el de los datos? (todas menos Canarias) */
export function isDataClock(zone) {
  return zone.tz === DATA_TZ;
}

/**
 * Minutos desde medianoche (reloj de la zona) a los que REE ya suele haber
 * publicado los precios de mañana: 20:20 peninsular → 19:20 en Canarias.
 */
export function publicationLocalMinutes(zone, now = Date.now()) {
  const { year, month, day } = parseDayKey(madridTodayKey(now));
  const published = localToEpoch(year, month, day, 20, 20, DATA_TZ);
  const p = localParts(published, zone.tz);
  return p.hour * 60 + p.minute;
}

/** "20:20" / "19:20" para los textos "Disponible a las …". */
export function publicationLabel(zone, now = Date.now()) {
  const m = publicationLocalMinutes(zone, now);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h < 10 ? '0' : ''}${h}:${mm < 10 ? '0' : ''}${mm}`;
}
