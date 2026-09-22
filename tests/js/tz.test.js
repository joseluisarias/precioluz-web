import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOUR_MS, DATA_TZ, madridDayStart, hourLabel, madridTodayKey, maxAllowedDay, addDays,
  weekdayOf, offsetMinutes, dayKeyOf, minutesOfDay, localToEpoch, clockLabel,
} from '../../docs/assets/js/tz.js';

test('medianoche de Madrid en verano e invierno', () => {
  assert.equal(madridDayStart('2026-08-11'), Date.UTC(2026, 7, 10, 22));   // CEST = UTC+2
  assert.equal(madridDayStart('2026-01-15'), Date.UTC(2026, 0, 14, 23));   // CET = UTC+1
  assert.equal(madridDayStart('2026-03-29'), Date.UTC(2026, 2, 28, 23));   // día de 23 h (aún CET)
  assert.equal(madridDayStart('2026-10-25'), Date.UTC(2026, 9, 24, 22));   // día de 25 h (aún CEST)
});

test('offset de Madrid: 120 en verano, 60 en invierno', () => {
  assert.equal(offsetMinutes(Date.UTC(2026, 6, 1, 12), DATA_TZ), 120);
  assert.equal(offsetMinutes(Date.UTC(2026, 0, 1, 12), DATA_TZ), 60);
  assert.equal(offsetMinutes(Date.UTC(2026, 6, 1, 12), 'Atlantic/Canary'), 60);
  assert.equal(offsetMinutes(Date.UTC(2026, 6, 1, 12, 0, 0, 500), DATA_TZ), 120);
});

test('día de 23 h: el slot 2 cae en las 03:00 reales', () => {
  const base = madridDayStart('2026-03-29');
  assert.equal(hourLabel(base + 1 * HOUR_MS), '01:00');
  assert.equal(hourLabel(base + 2 * HOUR_MS), '03:00');
  assert.equal(hourLabel(base + 23 * HOUR_MS), '00:00');
  assert.equal(base + 23 * HOUR_MS, madridDayStart('2026-03-30'));
});

test('día de 25 h: los slots 2 y 3 son las dos 02:00', () => {
  const base = madridDayStart('2026-10-25');
  assert.equal(hourLabel(base + 2 * HOUR_MS), '02:00');
  assert.equal(hourLabel(base + 3 * HOUR_MS), '02:00');
  assert.equal(hourLabel(base + 4 * HOUR_MS), '03:00');
  assert.equal(base + 25 * HOUR_MS, madridDayStart('2026-10-26'));
});

test('Canarias: el slot 0 se etiqueta 23:00 (hora local)', () => {
  assert.equal(hourLabel(madridDayStart('2026-09-22'), 'Atlantic/Canary'), '23:00');
  assert.equal(hourLabel(madridDayStart('2026-01-15'), 'Atlantic/Canary'), '23:00');
  assert.equal(hourLabel(madridDayStart('2026-09-22') + 13 * HOUR_MS, 'Atlantic/Canary'), '12:00');
  assert.equal(hourLabel(madridDayStart('2026-09-22') + 13 * HOUR_MS), '13:00');
});

test('la hora 23 + 1 h es 00:00, nunca 24:00', () => {
  assert.equal(hourLabel(madridDayStart('2026-08-11') + 24 * HOUR_MS), '00:00');
  assert.equal(clockLabel(madridDayStart('2026-08-11') + 24 * HOUR_MS - 60000), '23:59');
});

test('clave de hoy en hora de Madrid', () => {
  assert.equal(madridTodayKey(Date.UTC(2026, 8, 21, 22, 30)), '2026-09-22');   // 00:30 Madrid
  assert.equal(madridTodayKey(Date.UTC(2026, 8, 21, 21, 30)), '2026-09-21');   // 23:30 Madrid
  assert.equal(dayKeyOf(Date.UTC(2026, 8, 21, 22, 30), 'Atlantic/Canary'), '2026-09-21');
});

test('maxAllowedDay: mañana desde las 20:16 de Madrid', () => {
  assert.equal(maxAllowedDay(Date.UTC(2026, 8, 22, 18, 15)), '2026-09-22');    // 20:15 CEST
  assert.equal(maxAllowedDay(Date.UTC(2026, 8, 22, 18, 16)), '2026-09-23');    // 20:16 CEST
  assert.equal(maxAllowedDay(Date.UTC(2026, 0, 15, 19, 15)), '2026-01-15');    // 20:15 CET
  assert.equal(maxAllowedDay(Date.UTC(2026, 0, 15, 19, 16)), '2026-01-16');    // 20:16 CET
  assert.equal(maxAllowedDay(Date.UTC(2026, 11, 31, 22, 0)), '2027-01-01');    // 23:00 del 31/12
  assert.equal(minutesOfDay(Date.UTC(2026, 8, 22, 18, 16)), 20 * 60 + 16);
});

test('addDays y weekdayOf son de calendario puro', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-09-22', -35), '2026-08-18');
  assert.equal(weekdayOf('2026-09-22'), 2);      // martes
  assert.equal(weekdayOf('2026-09-20'), 0);      // domingo
});

test('localToEpoch respeta el offset del propio instante', () => {
  assert.equal(localToEpoch(2026, 3, 29, 3, 0, DATA_TZ), Date.UTC(2026, 2, 29, 1));   // 03:00 CEST
  assert.equal(localToEpoch(2026, 3, 29, 1, 0, DATA_TZ), Date.UTC(2026, 2, 29, 0));   // 01:00 CET
  assert.equal(localToEpoch(2026, 9, 22, 20, 20, DATA_TZ), Date.UTC(2026, 8, 22, 18, 20));
});
