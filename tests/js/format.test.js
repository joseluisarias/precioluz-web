import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fmtEur, fmtEurBare, fmtNumber, fmtPct, dayLevel, spreadLevel, consejo, CONSEJOS, consejoFrame,
  tipText, levelBadge, dayBadge, comparisonText, comparisonToAverage, longDate, shortDate,
  monthTitle, isWeekend,
} from '../../docs/assets/js/format.js';

test('€/kWh con coma decimal y sin miles', () => {
  assert.equal(fmtEur(0.052), '0,052 €/kWh');
  assert.equal(fmtEur(0.05, 2), '0,05 €/kWh');
  assert.equal(fmtEurBare(0.052), '0,052');
  assert.equal(fmtEur(1234.5, 2), '1234,50 €/kWh');
  assert.equal(fmtEur(NaN), '— €/kWh');
  assert.equal(fmtEur(Infinity), '— €/kWh');
  assert.equal(fmtEurBare(NaN), '—');
  assert.equal(fmtEur(0.0625), '0,063 €/kWh');          // half-up, igual que Decimal en Python
  assert.equal(fmtEur(1.005, 2), '1,00 €/kWh');         // 1.005 es 1.00499… en binario
  assert.equal(fmtEurBare(-0.0004), '0,000');            // sin "-0,000"
  assert.equal(fmtEurBare(-0.005), '-0,005');
  assert.equal(fmtNumber(12, 0), '12');
});

test('porcentajes y comparativa', () => {
  assert.equal(fmtPct(12.44), '12,4 %');
  assert.equal(fmtPct(3, 0), '3 %');
  assert.equal(comparisonText(0.1124, 0.1, false), '↑ 12,4 % vs típico (laborable)');
  assert.equal(comparisonText(0.09, 0.1, true), '↓ 10,0 % vs típico (finde)');
  assert.equal(comparisonText(0.1, 0.1, false), '↑ 0,0 % vs típico (laborable)');
  assert.equal(comparisonText(0, 0.1, false), null);
  assert.equal(comparisonText(0.1, 0, false), null);
  assert.equal(comparisonToAverage(0.05, 0.115), 'un 57 % por debajo de la media de hoy');
  assert.equal(comparisonToAverage(0.05, 0.051), null);
  assert.equal(comparisonToAverage(0.2, 0.1), null);
});

test('niveles del día y del spread', () => {
  assert.equal(dayLevel(0.12), 'barato');
  assert.equal(dayLevel(0.1201), 'normal');
  assert.equal(dayLevel(0.18), 'normal');
  assert.equal(dayLevel(0.1801), 'caro');
  assert.equal(spreadLevel(0.03), 'plano');
  assert.equal(spreadLevel(0.0301), 'medio');
  assert.equal(spreadLevel(0.06), 'medio');
  assert.equal(spreadLevel(0.0601), 'alto');
  assert.equal(levelBadge('barato', 'plano'), 'BARATO · PLANO');
});

test('9 consejos con {bestHour} sustituido', () => {
  assert.equal(Object.keys(CONSEJOS).length, 9);
  for (const day of ['barato', 'normal', 'caro']) {
    for (const spread of ['plano', 'medio', 'alto']) {
      const c = consejo(day, spread, '14:00');
      assert.deepEqual(Object.keys(c), ['title', 'summary', 'action']);
      assert.ok(c.title && c.summary && c.action);
      assert.ok(!`${c.title}${c.summary}${c.action}`.includes('{bestHour}'));
    }
  }
  assert.equal(consejo('barato', 'plano', '14:00').title, 'Barra libre de energía');
  assert.ok(consejo('barato', 'alto', '02:00').action.includes('02:00'));
  assert.ok(consejo('caro', 'alto', '04:00').action.endsWith('(04:00).'));
  assert.equal(consejo('caro', 'medio', '04:00').title, 'Día caro con un respiro');
  assert.throws(() => consejo('carísimo', 'plano', '14:00'));
  assert.equal(consejoFrame('barato', 'plano'),
    'Consejo del día: hoy la luz está barata y apenas cambia entre unas horas y otras.');
  assert.equal(consejoFrame('normal', 'medio'),
    'Consejo del día: hoy la luz está a un precio normal y cambia algo entre unas horas y otras.');
  assert.equal(tipText(0.10, '14:00'), 'Hoy hay mucha diferencia entre horas. Si puedes, concentra consumos en 14:00.');
  assert.equal(tipText(0.02, '14:00'), 'Día bastante plano. No hay grandes diferencias entre horas.');
});

test('fechas en castellano sin depender del locale', () => {
  assert.equal(dayBadge('2026-09-22'), 'Laborable · Mar 22 Sep');   // martes
  assert.equal(dayBadge('2026-09-21'), 'Laborable · Lun 21 Sep');
  assert.equal(dayBadge('2026-09-26'), 'Finde · Sáb 26 Sep');
  assert.equal(dayBadge('2026-09-20'), 'Finde · Dom 20 Sep');
  assert.equal(dayBadge('2026-03-04'), 'Laborable · Mié 4 Mar');
  assert.equal(longDate('2026-09-22'), 'Martes, 22 de septiembre de 2026');
  assert.equal(longDate('2026-09-21'), 'Lunes, 21 de septiembre de 2026');
  assert.equal(longDate('2026-01-03'), 'Sábado, 3 de enero de 2026');
  assert.equal(shortDate('2026-09-22'), '22/09');
  assert.equal(shortDate('2026-01-03'), '03/01');
  assert.equal(monthTitle('2026-09'), 'Septiembre 2026');
  assert.equal(isWeekend('2026-09-19'), true);
  assert.equal(isWeekend('2026-09-22'), false);
});
