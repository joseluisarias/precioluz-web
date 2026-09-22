// format.js — textos y formatos, gemelo de precioluz/copy.py. Puro (sin DOM).
//
//  · coma decimal en todo el sitio ("0,052 €/kWh"), sin separador de miles
//  · niveles del día (0,12 / 0,18) y del spread (0,03 / 0,06) como en la app
//  · 9 consejos: los 8 de la app tal cual (con {bestHour}) + caro×medio
//  · nombres en castellano codificados a mano (sin depender del locale)
//
// `Number.prototype.toFixed` redondea half-up sobre el valor binario exacto; el
// Python del build hace lo mismo con Decimal, así el HTML y el cliente escriben
// el mismo número.

import { parseDayKey, weekdayOf } from './tz.js';

export const DAY_CHEAP_MAX = 0.12;
export const DAY_NORMAL_MAX = 0.18;
export const SPREAD_FLAT_MAX = 0.03;
export const SPREAD_MEDIUM_MAX = 0.06;

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const CONSEJOS = {
  'barato|plano': {
    title: 'Barra libre de energía',
    summary: 'Hoy la luz está tirada de precio todo el día. Es uno de esos días donde no hace falta mirar el reloj ni preocuparse por la factura.',
    action: 'Aprovecha para poner todas las lavadoras y lavavajillas pendientes cuando tú quieras.',
  },
  'barato|alto': {
    title: 'Chollo con hora exacta',
    summary: 'El día es muy barato en general, pero hay un momento específico que es casi gratis. Si puedes programar tus aparatos, el ahorro será total.',
    action: 'Programa los electrodomésticos más potentes alrededor de las {bestHour} para maximizar el ahorro.',
  },
  'normal|medio': {
    title: 'Día tranquilo con truco',
    summary: 'Ni muy caro ni muy barato, precios bastante estándar. Sin embargo, hay un hueco barato que merece la pena aprovechar para bajar la media.',
    action: 'Si estás en casa, intenta cocinar o planchar cerca de las {bestHour}.',
  },
  'caro|alto': {
    title: '¡Cuidado con la factura!',
    summary: 'Hoy la electricidad está por las nubes y hay picos que asustan. Usar el horno o la calefacción a lo loco te saldrá caro.',
    action: 'Evita las horas centrales y, si es urgente, programa el consumo para la hora más barata ({bestHour}).',
  },
  'caro|plano': {
    title: 'Toca apretarse el cinturón',
    summary: 'Mal día para el consumo intensivo. Los precios están altos desde que te levantas hasta que te acuestas y no hay escapatoria.',
    action: 'Limítate a lo imprescindible y pospón las lavadoras grandes para mañana si puedes.',
  },
  'normal|plano': {
    title: 'Sin sorpresas ni sobresaltos',
    summary: 'Un día muy estable con precios razonables. No vas a encontrar grandes ofertas, pero tampoco te van a clavar por poner la tele.',
    action: 'Haz tu vida normal y usa los electrodomésticos cuando te venga bien por comodidad.',
  },
  'normal|alto': {
    title: 'La paciencia tiene premio',
    summary: 'El día no pinta mal, pero la diferencia de precio entre unas horas y otras es notable. La paciencia hoy tiene premio.',
    action: 'Aguanta un poco y deja la lavadora o el lavavajillas para la hora más barata, sobre las {bestHour}.',
  },
  'barato|medio': {
    title: 'Día de limpieza general',
    summary: 'Tenemos precios bajos con alguna pequeña subida sin importancia. Es el momento perfecto para adelantar tareas del hogar sin agobios.',
    action: 'Dale caña a la plancha y la cocina, intentando evitar solo los picos más altos.',
  },
  'caro|medio': {
    title: 'Día caro con un respiro',
    summary: 'La luz está cara casi todo el día, pero hay una ventana limitada en la que baja algo. No es un chollo, pero se nota en la factura.',
    action: 'Concentra los consumos más potentes cerca de las {bestHour} y deja el resto para otro día.',
  },
};

const LEVEL_WORDS = { barato: 'barata', normal: 'a un precio normal', caro: 'cara' };
const SPREAD_WORDS = { plano: 'apenas cambia', medio: 'cambia algo', alto: 'cambia mucho' };

// MARK: Niveles

export function dayLevel(avg) {
  if (avg <= DAY_CHEAP_MAX) return 'barato';
  if (avg <= DAY_NORMAL_MAX) return 'normal';
  return 'caro';
}

export function spreadLevel(spread) {
  if (spread <= SPREAD_FLAT_MAX) return 'plano';
  if (spread <= SPREAD_MEDIUM_MAX) return 'medio';
  return 'alto';
}

/** "BARATO · PLANO" */
export function levelBadge(dayLvl, spreadLvl) {
  return `${dayLvl.toUpperCase()} · ${spreadLvl.toUpperCase()}`;
}

// MARK: Consejo

/** {title, summary, action} con {bestHour} sustituido. */
export function consejo(dayLvl, spreadLvl, bestHourLabel) {
  const text = CONSEJOS[`${dayLvl}|${spreadLvl}`];
  if (!text) throw new Error(`combinación desconocida: ${dayLvl} × ${spreadLvl}`);
  const out = {};
  for (const k of Object.keys(text)) out[k] = text[k].split('{bestHour}').join(bestHourLabel);
  return out;
}

export function consejoFrame(dayLvl, spreadLvl) {
  return `Consejo del día: hoy la luz está ${LEVEL_WORDS[dayLvl]} y ${SPREAD_WORDS[spreadLvl]} entre unas horas y otras.`;
}

export function tipText(spread, bestHourLabel) {
  if (spread >= SPREAD_MEDIUM_MAX) {
    return `Hoy hay mucha diferencia entre horas. Si puedes, concentra consumos en ${bestHourLabel}.`;
  }
  return 'Día bastante plano. No hay grandes diferencias entre horas.';
}

// MARK: Números

/** "0,052": coma decimal, sin miles; "—" si no es finito. */
export function fmtNumber(value, decimals = 3) {
  if (!Number.isFinite(value)) return '—';
  let s = value.toFixed(decimals);
  if (s[0] === '-' && !/[1-9]/.test(s)) s = s.slice(1);   // "-0.000" → "0.000"
  return s.replace('.', ',');
}

export function fmtEur(value, decimals = 3) {
  return `${fmtNumber(value, decimals)} €/kWh`;
}

export function fmtEurBare(value, decimals = 3) {
  return fmtNumber(value, decimals);
}

export function fmtPct(value, decimals = 1) {
  return `${fmtNumber(value, decimals)} %`;
}

// MARK: Fechas

export function isWeekend(dayKey) {
  const wd = weekdayOf(dayKey);
  return wd === 0 || wd === 6;
}

/** "Laborable · Lun 22 Sep" / "Finde · Sáb 27 Sep" */
export function dayBadge(dayKey) {
  const { month, day } = parseDayKey(dayKey);
  const wd = weekdayOf(dayKey);
  const kind = (wd === 0 || wd === 6) ? 'Finde' : 'Laborable';
  return `${kind} · ${WEEKDAYS_SHORT[wd]} ${day} ${MONTHS_SHORT[month - 1]}`;
}

/** "Lunes, 22 de septiembre de 2026" */
export function longDate(dayKey) {
  const { year, month, day } = parseDayKey(dayKey);
  return `${WEEKDAYS[weekdayOf(dayKey)]}, ${day} de ${MONTHS[month - 1]} de ${year}`;
}

/** "22/09" */
export function shortDate(dayKey) {
  const { month, day } = parseDayKey(dayKey);
  return `${day < 10 ? '0' : ''}${day}/${month < 10 ? '0' : ''}${month}`;
}

/** "Septiembre 2026" a partir de "2026-09" */
export function monthTitle(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const name = MONTHS[m - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
}

// MARK: Comparativa

/** "↑ 12,4 % vs típico (laborable)"; null si falta alguna media. */
export function comparisonText(avg, baseline, isWeekendDay) {
  if (!(avg > 0) || !(baseline > 0)) return null;
  const diff = avg - baseline;
  const pct = (diff / baseline) * 100;
  const arrow = diff >= 0 ? '↑' : '↓';
  return `${arrow} ${fmtPct(Math.abs(pct))} vs típico (${isWeekendDay ? 'finde' : 'laborable'})`;
}

/** "un 57 % por debajo de la media de hoy" (PriceCopy.comparisonToAverage). */
export function comparisonToAverage(windowAvg, dayAverage) {
  if (!(dayAverage > 0) || windowAvg >= dayAverage) return null;
  const pct = Math.round(((dayAverage - windowAvg) / dayAverage) * 100);
  if (pct < 5) return null;
  return `un ${pct} % por debajo de la media de hoy`;
}
