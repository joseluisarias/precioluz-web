// store.js — estado mínimo con pub/sub y localStorage versionado (pl.v1.*).
// Sin dependencias; todo acceso a localStorage va en try/catch (Safari privado, cuota, etc.).

const PREFIX = 'pl.v1.';

export const ls = {
  key: (k) => PREFIX + k,
  get(k, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + k);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; }
    catch { return false; }
  },
  del(k) {
    try { localStorage.removeItem(PREFIX + k); } catch { /* nada */ }
  },
  /** Borra las claves `pl.v1.<prefix>*` para las que keep(subclave) sea falso. */
  prune(prefix, keep) {
    try {
      for (const full of Object.keys(localStorage)) {
        if (!full.startsWith(PREFIX + prefix)) continue;
        if (!keep(full.slice(PREFIX.length))) localStorage.removeItem(full);
      }
    } catch { /* nada */ }
  },
};

const subs = new Set();

export const store = {
  state: { zone: null, selectedDay: null, tab: 'dia', now: Date.now() },
  get(k) { return this.state[k]; },
  /** Aplica un parche; solo notifica si algo cambió. */
  set(patch) {
    const prev = { ...this.state };
    const changed = Object.keys(patch).filter((k) => this.state[k] !== patch[k]);
    if (!changed.length) return;
    Object.assign(this.state, patch);
    for (const fn of subs) {
      try { fn(this.state, changed, prev); } catch (e) { console.error(e); }
    }
  },
  /** subscribe(fn[, keys]) → función para darse de baja. */
  subscribe(fn, keys) {
    const w = keys ? (s, c, p) => { if (c.some((k) => keys.includes(k))) fn(s, c, p); } : fn;
    subs.add(w);
    return () => subs.delete(w);
  },
};
