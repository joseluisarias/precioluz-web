// Escenarios de PriceEngineTests.swift sobre el motor JS (el coloreado día a
// día se cubre en bands.test.js contra los fixtures de Python).
import test from 'node:test';
import assert from 'node:assert/strict';

import { madridDayStart, HOUR_MS, MINUTE_MS, hourLabel } from '../../docs/assets/js/tz.js';
import {
  buildDay, bands, average, minimum, maximum, current, remainingCheapest, bestContiguousRun,
  upcomingCheapWindow, dayCheapWindow, stats, isWorthAnnouncing, bandsByIndex, dayStatsJson,
} from '../../docs/assets/js/engine.js';

const DAY = '2026-08-11';
const REPORTED = [
  0.120, 0.115, 0.110, 0.038, 0.105, 0.100,
  0.108, 0.112, 0.118, 0.125, 0.130, 0.128,
  0.120, 0.115, 0.052, 0.110, 0.118, 0.125,
  0.150, 0.201, 0.190, 0.185, 0.178, 0.166,
];

function rows(values) {
  const out = [];
  values.forEach((v, i) => {
    if (v === null) return;
    const mwh = Math.round(v * 1000 * 1e6) / 1e6;
    out.push({ i, h: `${String(i).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, pcb: mwh, cym: mwh });
  });
  return out;
}

const makeDay = (values, day = DAY, series = 'pcb') => buildDay(rows(values), day, series);
const at = (h, m = 0, day = DAY) => madridDayStart(day) + h * HOUR_MS + m * MINUTE_MS;
const near = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('buildDay ancla por índice y descarta filas sin serie', () => {
  const hours = makeDay(Array(24).fill(0.10));
  assert.equal(hours.length, 24);
  assert.equal(hourLabel(hours[14].start), '14:00');
  assert.equal(hours[23].end, madridDayStart('2026-08-12'));
  assert.deepEqual(buildDay([{ i: 0, h: '00-01', pcb: 100, cym: null }, { i: 1, h: '01-02', pcb: 100, cym: 50 }], DAY, 'cym').map((p) => p.index), [1]);
  assert.deepEqual(makeDay(Array(48).fill(0.1)), []);
  assert.throws(() => buildDay([], DAY, 'xyz'));
});

test('precio corrupto fuera; gratis y negativo dentro', () => {
  const values = Array(24).fill(0.20);
  values[5] = null;
  values[6] = 0.0;
  const hours = makeDay(values);
  assert.equal(hours.length, 23);
  assert.ok(!hours.some((h) => h.index === 5));
  assert.equal(minimum(hours).index, 6);
  values[6] = -0.005;
  near(minimum(makeDay(values)).eurKwh, -0.005, 1e-9);
});

test('empates: mínimo y máximo al índice menor', () => {
  const values = Array(24).fill(0.20);
  values[3] = 0.040; values[15] = 0.040;
  values[5] = 0.400; values[9] = 0.400;
  const hours = makeDay(values);
  assert.equal(minimum(hours).index, 3);
  assert.equal(maximum(hours).index, 5);
  const st = stats(hours);
  assert.equal(st.minIdx, 3);
  assert.equal(st.maxIdx, 5);
  assert.equal(stats([]), null);
  assert.equal(average([]), 0);
});

test('ventana con horquilla: contigua, ambos lados, tope y agujero', () => {
  let values = Array(24).fill(0.20);
  values[14] = 0.050; values[15] = 0.051; values[16] = 0.052;
  let w = upcomingCheapWindow(makeDay(values), at(6));
  assert.equal(w.hourCount, 3); assert.equal(w.start, at(14)); assert.equal(w.end, at(17));

  values = Array(24).fill(0.20);
  values[13] = 0.051; values[14] = 0.050; values[15] = 0.052;
  w = upcomingCheapWindow(makeDay(values), at(6));
  assert.equal(w.hourCount, 3); assert.equal(w.start, at(13));

  values = Array(24).fill(0.50);
  for (let i = 8; i <= 17; i++) values[i] = 0.050 + (i - 8) * 0.001;
  w = upcomingCheapWindow(makeDay(values), at(6), { tolerance: 0.02, maxHours: 6 });
  assert.equal(w.hourCount, 6); assert.equal(w.start, at(8));

  values = Array(24).fill(0.50);
  for (let i = 8; i <= 15; i++) values[i] = 0.050;
  w = upcomingCheapWindow(makeDay(values), at(6), { maxHours: 3 });
  assert.equal(w.hourCount, 3); assert.equal(w.start, at(8));
  assert.equal(upcomingCheapWindow(makeDay(values), at(6), { maxHours: 0 }).hourCount, 1);

  values = Array(24).fill(0.50);
  values[13] = 0.051; values[14] = null; values[15] = 0.050; values[16] = 0.052;
  w = upcomingCheapWindow(makeDay(values), at(6));
  assert.equal(w.start, at(15)); assert.equal(w.hourCount, 2);

  assert.equal(upcomingCheapWindow(makeDay(Array(24).fill(0.100)), at(6)), null);
});

test('escenario reportado: 08:10 → 14:00; 13:40 → nada; nunca una hora cara', () => {
  const hours = makeDay(REPORTED);
  const avg = average(hours);
  let w = upcomingCheapWindow(hours, at(8, 10));
  assert.equal(w.start, at(14)); near(w.avgEurKwh, 0.052);
  assert.equal(upcomingCheapWindow(hours, at(13, 20)).start, at(14));
  assert.equal(upcomingCheapWindow(hours, at(13, 40)), null);
  assert.equal(upcomingCheapWindow(hours, at(18)), null);
  assert.equal(upcomingCheapWindow(hours, at(23, 50)), null);
  for (let h = 0; h <= 22; h++) {
    w = upcomingCheapWindow(hours, at(h));
    if (w) assert.ok(w.avgEurKwh <= avg * 0.85);
  }
  const dw = dayCheapWindow(hours);
  assert.equal(dw.start, at(3)); near(dw.minEurKwh, 0.038);
});

test('cambio de hora: 23 h y 25 h', () => {
  let values = Array(23).fill(0.20); values[2] = 0.040;
  let hours = makeDay(values, '2026-03-29');
  assert.equal(hours.length, 23);
  assert.equal(hourLabel(hours[2].start), '03:00');
  assert.equal(hours[22].end, madridDayStart('2026-03-30'));
  assert.equal(hourLabel(upcomingCheapWindow(hours, madridDayStart('2026-03-29'), { tolerance: 0 }).start), '03:00');

  values = Array(25).fill(0.20); values[3] = 0.040;
  hours = makeDay(values, '2026-10-25');
  assert.equal(hours.length, 25);
  assert.equal(hourLabel(hours[2].start), '02:00');
  assert.equal(hourLabel(hours[3].start), '02:00');
  assert.equal(hours[24].end, madridDayStart('2026-10-26'));
  const w = upcomingCheapWindow(hours, madridDayStart('2026-10-25'), { tolerance: 0 });
  assert.equal(w.start, hours[3].start);
  assert.ok(w.start > hours[2].start);

  values = Array(25).fill(0.10); values[2] = 0.050; values[3] = 0.080;
  hours = makeDay(values, '2026-10-25');
  assert.equal(current(hours, hours[2].start + 600000).eurKwh, 0.050);
  assert.equal(current(hours, hours[3].start + 600000).eurKwh, 0.080);
  assert.equal(current(hours, madridDayStart('2026-10-26')), null);
});

test('remainingCheapest nunca mira atrás', () => {
  const hours = makeDay(REPORTED);
  const r = remainingCheapest(hours, at(20), 3);
  assert.ok(!r.some((h) => h.index === 3));
  assert.ok(r.every((h) => h.end > at(20)));
  assert.deepEqual(r.map((h) => h.index), [...r.map((h) => h.index)].sort((a, b) => a - b));
  const late = remainingCheapest(hours, at(23, 59), 3);
  assert.deepEqual(late.map((h) => h.index), [23]);
  assert.deepEqual(remainingCheapest(hours, madridDayStart('2026-08-12'), 3), []);
  assert.deepEqual(remainingCheapest(hours, at(6), 0), []);

  const values = Array(24).fill(0.20); values[14] = 0.050;
  const day = makeDay(values);
  assert.equal(remainingCheapest(day, at(14, 10), 1)[0].index, 14);
  assert.notEqual(remainingCheapest(day, at(14, 5), 1, { includingCurrent: false, leadMinutes: 30 })[0].index, 14);
  assert.equal(remainingCheapest(day, at(13), 1, { includingCurrent: false, leadMinutes: 30 })[0].index, 14);
});

test('bestContiguousRun: mejor par, nil a las 23:xx, umbral aparte', () => {
  let values = Array(24).fill(0.20);
  values[10] = 0.060; values[11] = 0.061; values[19] = 0.20; values[20] = 0.050; values[21] = 0.20;
  const run = bestContiguousRun(makeDay(values), 2, at(6));
  assert.equal(run.hourCount, 2); assert.equal(run.start, at(10)); assert.equal(run.end, at(12));
  assert.equal(bestContiguousRun(makeDay(Array(24).fill(0.10)), 2, at(23, 30)), null);
  values = Array(24).fill(0.30); values[22] = 0.10; values[23] = 0.10;
  assert.equal(bestContiguousRun(makeDay(values), 2, at(22, 30)).start, at(22));

  const hours = makeDay(REPORTED);
  const avg = average(hours);
  const late = bestContiguousRun(hours, 2, at(18));
  assert.ok(late.avgEurKwh > avg);
  assert.equal(isWorthAnnouncing(late, avg), false);
  assert.equal(isWorthAnnouncing(upcomingCheapWindow(hours, at(8)), avg), true);
});

test('bands: mínimos garantizados, rareza de naranjas, día plano, JSON', () => {
  const hours = makeDay(REPORTED);
  const s = bands(hours);
  assert.equal(s.length, 24);
  assert.ok((s.match(/g/g) || []).length >= 4);
  assert.equal(s[3], 'g');
  assert.equal(s[19], 'r');
  assert.equal(bandsByIndex(hours).get(3), 'g');

  const quirk = [...Array(4).fill(0.05), ...Array(2).fill(0.15), ...Array(18).fill(0.25)];
  assert.equal(bands(makeDay(quirk)), `gggg${'oo'}${'r'.repeat(18)}`);
  assert.equal(bands(makeDay(Array(24).fill(0.100))), 'g'.repeat(24));
  assert.equal(bands(makeDay(Array(24).fill(0.0))), '');
  assert.equal(bands([]), '');

  const chain = Array(24).fill(0.100);
  [0.060, 0.064, 0.068, 0.072, 0.076, 0.080].forEach((v, k) => { chain[1 + k] = v; });
  assert.equal(bands(makeDay(chain)).slice(1, 7), 'gggggg');
  assert.equal((bands(makeDay(chain), 0).match(/g/g) || []).length, 4);

  const extras = dayStatsJson(rows(REPORTED), DAY);
  assert.deepEqual(Object.keys(extras), ['stats', 'bands']);
  assert.deepEqual(Object.keys(extras.stats), ['pcb', 'cym']);
  assert.equal(extras.stats.pcb.minIdx, 3);
  assert.equal(extras.stats.pcb.maxIdx, 19);
  assert.equal(extras.bands.pcb, s);
});
