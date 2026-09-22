// main.js — arranque de la hidratación: lee el JSON de #pl-boot, construye el
// estado compartido (store.js), detecta qué paneles hay en la página, inicializa
// dia/resumen/calendario/generacion.js, registra window.PL.tick y atiende ?d=/?m=.
//
// Se registra solo: si app.js ya corrió (window.PL.store) arranca al momento; si
// no, espera a `pl:ready` (o a `load` como red de seguridad). Importarlo en node
// no toca el DOM.

import { store, ls } from './store.js';
import * as api from './api.js';
import { buildDay, bands as computeBands, stats as computeStats } from './engine.js';
import { madridTodayKey, addDays, maxAllowedDay, minutesOfDay, TOMORROW_UNLOCK_MINUTES } from './tz.js';
import { byId, detect, browserTimeZone, PENINSULA } from './zones.js';
import * as dia from './dia.js';
import * as resumen from './resumen.js';
import * as calendario from './calendario.js';
import * as generacion from './generacion.js';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const MISS_TTL = 5 * 60000;          // reintento de un día no publicado (mañana desde las 20:16)

const days = new Map();              // día → fichero | null
const missAt = new Map();            // día → último intento fallido
const inflight = new Map();          // día → Promise
const calendars = new Map();         // mes → JSON | null
const calInflight = new Map();
const pts = new Map();               // "día|serie" → puntos

let boot = null;
let today = null;
let has = { dia: false, resumen: false, cal: false, gen: false };
let started = false;

// MARK: Contexto compartido por los módulos

export const ctx = {
  api, store, ls,
  get boot() { return boot; },
  today: () => today,
  maxDay(now = Date.now()) {
    const allowed = maxAllowedDay(now);
    const tomorrow = addDays(today, 1);
    return this.has(tomorrow) && tomorrow > allowed ? tomorrow : allowed;
  },
  has: (day) => Boolean(days.get(day)),
  file: (day) => days.get(day) || null,
  points(day, series) {
    const key = `${day}|${series}`;
    let p = pts.get(key);
    if (!p) {
      const f = days.get(day);
      p = f && Array.isArray(f.hours) ? buildDay(f.hours, day, series) : [];
      if (f) pts.set(key, p);
    }
    return p;
  },
  bands(day, series) {
    const f = days.get(day);
    if (f && f.bands && typeof f.bands[series] === 'string') return f.bands[series];
    return computeBands(this.points(day, series));
  },
  stats(day, series) {
    const f = days.get(day);
    if (!f) return null;
    if (f.stats && f.stats[series]) return f.stats[series];
    return computeStats(this.points(day, series));
  },
  /** Fichero del día (boot → caché → api.fetchDay). Nunca rechaza. */
  ensureDay(day, { force = false } = {}) {
    if (!DAY_RE.test(day)) return Promise.resolve(null);
    if (!force && days.get(day)) return Promise.resolve(days.get(day));
    if (inflight.has(day)) return inflight.get(day);
    const now = Date.now();
    if (!force && day > maxAllowedDay(now)) return Promise.resolve(null);
    if (!force && missAt.has(day) && now - missAt.get(day) < MISS_TTL) return Promise.resolve(null);
    const idx = boot && boot.index;
    const site = !idx || !idx.first || !idx.latest || (day >= idx.first && day <= idx.latest);
    const p = api.fetchDay(day, { force, site }).then((f) => {
      inflight.delete(day);
      if (f) { days.set(day, f); pts.forEach((_, k) => { if (k.startsWith(`${day}|`)) pts.delete(k); }); }
      else missAt.set(day, Date.now());
      return f;
    }).catch(() => { inflight.delete(day); missAt.set(day, Date.now()); return null; });
    inflight.set(day, p);
    return p;
  },
  calendar: (month) => calendars.get(month),
  calendarEntry(day, series) {
    const c = calendars.get(day.slice(0, 7));
    if (c === undefined) return undefined;
    const e = c && c.days && c.days[day];
    return (e && e[series]) || null;
  },
  ensureCalendar(month) {
    if (!MONTH_RE.test(month)) return Promise.resolve(null);
    if (calendars.has(month)) return Promise.resolve(calendars.get(month));
    if (calInflight.has(month)) return calInflight.get(month);
    const p = api.fetchCalendar(month).then((c) => {
      calInflight.delete(month);
      calendars.set(month, c || null);
      return c;
    }).catch(() => { calInflight.delete(month); calendars.set(month, null); return null; });
    calInflight.set(month, p);
    return p;
  },
  snapshot() {
    const day = store.state.selectedDay || today;
    return {
      day, zone: byId(store.state.zone), now: Date.now(), today,
      month: store.state.month || day.slice(0, 7), loading: inflight.has(day),
    };
  },
  stamp() {
    return `${store.state.selectedDay}|${store.state.zone}|${store.state.month}|${today}`;
  },
  setDay(day, { url = true } = {}) {
    if (!DAY_RE.test(day)) return;
    store.set({ selectedDay: day, month: day.slice(0, 7) });
    if (url && has.dia && typeof history !== 'undefined' && history.replaceState) {
      history.replaceState(history.state, '', `?d=${day}${location.hash}`);
    }
    const p = this.ensureDay(day);
    renderAll();
    if (!this.has(day)) p.then(() => { if (store.state.selectedDay === day) renderAll(); });
  },
  setZone(id) {
    const z = byId(id);
    ls.set('zone', z.id);
    store.set({ zone: z.id });
    renderAll();
  },
  setMonth(month) {
    if (!MONTH_RE.test(month)) return;
    store.set({ month });
    if (!has.dia && has.cal && history.replaceState) history.replaceState(history.state, '', `?m=${month}${location.hash}`);
    if (has.cal) calendario.render(this.snapshot());
  },
  /** Clic en una celda del calendario. */
  selectDay(day) {
    this.setDay(day, { url: has.dia });
  },
};

function renderAll() {
  const s = ctx.snapshot();
  if (has.dia) dia.render(s);
  if (has.resumen) resumen.render(s);
  if (has.cal) calendario.render(s);
  if (has.gen) generacion.render(s);
}

// MARK: Tick (30 s + visibilitychange, lo llama app.js)

function tick() {
  const now = Date.now();
  const t = madridTodayKey(now);
  if (t !== today) {
    const old = today;
    today = t;
    const explicit = /[?&]d=/.test(location.search);
    if (store.state.selectedDay === old && !explicit) { ctx.setDay(t, { url: false }); return; }
  }
  const s = ctx.snapshot();
  if (has.dia) dia.tick(s);
  if (has.resumen) resumen.tick(s);
  if (has.gen) generacion.tick(s);
  const tomorrow = addDays(today, 1);
  if (!ctx.has(tomorrow) && minutesOfDay(now) >= TOMORROW_UNLOCK_MINUTES) {
    ctx.ensureDay(tomorrow).then((f) => {
      if (!f) return;
      if (isMananaPage() && store.state.selectedDay !== tomorrow) { ctx.setDay(tomorrow); return; }
      const s2 = ctx.snapshot();
      if (has.dia) dia.tick(s2);
      if (has.resumen) resumen.render(s2);
      if (has.cal) calendario.render(s2);
    });
  }
}

function isMananaPage() {
  return location.pathname.replace(/index\.html$/, '') === '/manana/' || (boot && boot.selected === boot.tomorrow);
}

// MARK: Arranque

function start() {
  if (started || typeof document === 'undefined') return;
  started = true;
  try { boot = JSON.parse(document.getElementById('pl-boot')?.textContent || 'null'); } catch { boot = null; }
  if (!boot || !boot.today) return;
  today = madridTodayKey();
  for (const [d, f] of Object.entries(boot.days || {})) if (f && f.hours) days.set(d, f);
  if (boot.calendar && boot.calendar.month) calendars.set(boot.calendar.month, boot.calendar);

  const q = new URLSearchParams(location.search);
  const qd = q.get('d');
  const qm = q.get('m');
  const day = qd && DAY_RE.test(qd) ? qd : boot.selected;
  const month = qm && MONTH_RE.test(qm) ? qm : day.slice(0, 7);
  const stored = ls.get('zone', null);
  const zone = byId(stored, null) || (boot.zone !== PENINSULA.id ? byId(boot.zone) : detect(browserTimeZone()));
  store.set({ selectedDay: day, zone: zone.id, month });

  has = {
    dia: dia.init(ctx), resumen: resumen.init(ctx), cal: calendario.init(ctx), gen: generacion.init(ctx),
  };
  window.PL = Object.assign(window.PL || {}, { tick, ctx, setDay: (d) => ctx.setDay(d), setZone: (z) => ctx.setZone(z) });

  const same = day === boot.selected && zone.id === boot.zone && month === boot.selected.slice(0, 7);
  if (same) {
    tick();                                   // hora actual, banda, flecha de mañana, próxima oportunidad
    if (has.resumen) resumen.render(ctx.snapshot());   // la tile "Próxima oportunidad" depende de la hora
  } else {
    const p = ctx.ensureDay(day);
    renderAll();
    if (!ctx.has(day)) p.then(() => { if (store.state.selectedDay === day) renderAll(); });
    if (has.dia) dia.tick(ctx.snapshot());
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (window.PL && window.PL.store) start();
  else {
    document.addEventListener('pl:ready', start, { once: true });
    if (document.readyState === 'complete') setTimeout(start, 0);
    else window.addEventListener('load', () => setTimeout(start, 0), { once: true });
  }
}
