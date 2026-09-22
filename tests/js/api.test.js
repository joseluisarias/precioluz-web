// Parsers puros de api.js contra los fixtures reales (archivo 70 y apidatos) y
// paridad con lo que escribe el build (docs/data/pvpc/<día>.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import {
  parsePrice, normalizeLabel, parseArchive70, dayFile, parseGeneration, RENEWABLE, APP_COLORS,
  esiosUrl, apidatosUrl,
} from '../../docs/assets/js/api.js';

const fx = (rel) => JSON.parse(readFileSync(new URL(`../fixtures/${rel}`, import.meta.url), 'utf8'));

test('parsePrice: coma decimal, punto de miles, basura', () => {
  assert.equal(parsePrice('216,88'), 216.88);
  assert.equal(parsePrice('1.216,88'), 1216.88);
  assert.equal(parsePrice('12.5'), 12.5);
  assert.equal(parsePrice(' 7 '), 7);
  assert.equal(parsePrice(''), null);
  assert.equal(parsePrice('n/a'), null);
  assert.equal(parsePrice(null), null);
});

test('normalizeLabel: "9-10" → "09-10", guion largo, raro se respeta', () => {
  assert.equal(normalizeLabel('9-10'), '09-10');
  assert.equal(normalizeLabel('14–15'), '14-15');
  assert.equal(normalizeLabel('23-24'), '23-24');
  assert.equal(normalizeLabel('x'), 'x');
});

test('archivo 70: laborable con CYM ≠ PCB en las horas frontera', () => {
  const rows = parseArchive70(fx('archive70/2026-09-16.json'));
  assert.equal(rows.length, 24);
  assert.deepEqual(rows.map((r) => r.i), [...Array(24).keys()]);
  assert.equal(rows[0].h, '00-01');
  const differ = rows.filter((r) => r.cym !== r.pcb).map((r) => r.i);
  assert.deepEqual(differ, [10, 14, 18, 22]);
});

test('archivo 70: 23 filas (marzo) y 25 filas (octubre)', () => {
  assert.equal(parseArchive70(fx('archive70/2026-03-29.json')).length, 23);
  assert.equal(parseArchive70(fx('archive70/2025-10-26.json')).length, 25);
});

test('archivo 70: no publicado y respuestas inválidas → null', () => {
  assert.equal(parseArchive70(fx('archive70/not-published.json')), null);
  assert.equal(parseArchive70(null), null);
  assert.equal(parseArchive70({}), null);
  assert.equal(parseArchive70({ PVPC: [] }), null);
  assert.equal(parseArchive70({ PVPC: Array(48).fill({ Hora: '00-01', PCB: '1,0' }) }), null);
});

test('archivo 70: una fila sin PCB se descarta sin desplazar el índice', () => {
  const obj = fx('archive70/2026-09-20.json');
  obj.PVPC[3] = { ...obj.PVPC[3], PCB: '' };
  const rows = parseArchive70(obj);
  assert.equal(rows.length, 23);
  assert.deepEqual(rows.slice(2, 5).map((r) => r.i), [2, 4, 5]);
});

test('dayFile: misma forma (filas, stats y bands) que docs/data/pvpc/2026-09-20.json', () => {
  const rows = parseArchive70(fx('archive70/2026-09-20.json'));
  const file = dayFile('2026-09-20', rows, '2026-09-22T18:15:24+02:00');
  assert.equal(file.day, '2026-09-20');
  assert.equal(file.n, 24);
  assert.deepEqual(Object.keys(file.stats), ['pcb', 'cym']);
  assert.equal(file.bands.pcb.length, 24);
  const site = new URL('../../docs/data/pvpc/2026-09-20.json', import.meta.url);
  if (existsSync(site)) {
    const built = JSON.parse(readFileSync(site, 'utf8'));
    assert.deepEqual(file.hours, built.hours);
    assert.deepEqual(file.bands, built.bands);
    for (const s of ['pcb', 'cym']) {
      for (const k of ['avg', 'min', 'max']) assert.ok(Math.abs(file.stats[s][k] - built.stats[s][k]) < 1e-12, `${s}.${k}`);
      assert.equal(file.stats[s].minIdx, built.stats[s].minIdx);
      assert.equal(file.stats[s].maxIdx, built.stats[s].maxIdx);
    }
  }
});

test('apidatos: día real → sin total, orden descendente, pct recalculado, paleta de la app', () => {
  const g = parseGeneration(fx('apidatos/day-2026-09-21.json'));
  const names = g.entries.map((e) => e.t);
  assert.ok(!names.includes('Generación total'));
  assert.equal(names[0], 'Solar fotovoltaica');
  assert.deepEqual(g.entries, [...g.entries].sort((a, b) => b.v - a.v));
  const sum = g.entries.reduce((s, e) => s + e.pct, 0);
  assert.ok(Math.abs(sum - 100) < 0.5, `pct suma ${sum}`);
  assert.ok(g.renewablePct > 0 && g.renewablePct < 100);
  assert.equal(g.entries[0].color, '#F5B700');
  assert.equal(g.datetime, '2026-09-21T00:00:00.000+02:00');
  const site = new URL('../../docs/data/generacion/2026-09-21.json', import.meta.url);
  if (existsSync(site)) {
    const built = JSON.parse(readFileSync(site, 'utf8'));
    assert.equal(g.total, built.total);
    assert.equal(g.renewablePct, built.renewablePct);
    assert.deepEqual(g.entries, built.entries);
  }
});

test('apidatos: descarta |v| ≤ 0,1 y el total, recalcula pct; sin datos → null', () => {
  const g = parseGeneration({ included: [
    { attributes: { title: 'Generación total', values: [{ value: 1000, percentage: 1 }] } },
    { attributes: { title: 'Eólica', values: [{ value: 600, percentage: 0.6, datetime: '2026-09-21T00:00:00.000+02:00' }] } },
    { attributes: { title: 'Nuclear', values: [{ value: 400, percentage: 0.4, datetime: '2026-09-21T00:00:00.000+02:00' }] } },
    { attributes: { title: 'Carbón', values: [{ value: 0.05, percentage: 0 }] } },
    { attributes: { title: 'Vacía', values: [] } },
    { attributes: { title: 'Rara', color: '#123456', values: [{ value: 5, percentage: 0 }] } },
  ] });
  assert.deepEqual(g.entries.map((e) => e.t), ['Eólica', 'Nuclear', 'Rara']);
  assert.equal(g.total, 1005);
  assert.equal(g.entries[0].pct, 59.7);
  assert.equal(g.entries[2].color, '#123456');
  assert.ok(RENEWABLE.has('Eólica') && !RENEWABLE.has('Nuclear'));
  assert.equal(APP_COLORS['Nuclear'], '#7B2D8E');
  assert.equal(parseGeneration({ included: [] }), null);
  assert.equal(parseGeneration(null), null);
  assert.equal(parseGeneration({ message: 'error' }), null);
});

test('URLs de REE', () => {
  assert.equal(esiosUrl('2026-09-23'), 'https://api.esios.ree.es/archives/70/download_json?date=2026-09-23');
  assert.equal(apidatosUrl('2026-09-22', 'hour'),
    'https://apidatos.ree.es/es/datos/generacion/estructura-generacion?start_date=2026-09-22T00:00&end_date=2026-09-22T23:59&time_trunc=hour');
});
