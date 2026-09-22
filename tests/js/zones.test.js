import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ZONES, PENINSULA, CANARIAS, BALEARES, CEUTA, MELILLA, byId, detect, isDataClock,
  publicationLocalMinutes, publicationLabel,
} from '../../docs/assets/js/zones.js';

test('cinco zonas con serie, reloj y subtítulo', () => {
  assert.deepEqual(ZONES.map((z) => z.id), ['peninsula', 'canarias', 'baleares', 'ceuta', 'melilla']);
  assert.deepEqual(ZONES.map((z) => z.code), ['PEN', 'CAN', 'BAL', 'CEU', 'MEL']);
  assert.deepEqual(ZONES.map((z) => z.series), ['pcb', 'pcb', 'pcb', 'cym', 'cym']);
  assert.equal(PENINSULA.subtitle, 'PVPC — datos oficiales');
  assert.equal(CANARIAS.subtitle, 'PVPC · Canarias (hora local)');
  assert.equal(BALEARES.subtitle, 'PVPC · Baleares');
  assert.equal(CEUTA.subtitle, 'PVPC · Ceuta');
  assert.equal(MELILLA.subtitle, 'PVPC · Melilla');
  assert.equal(CANARIAS.tz, 'Atlantic/Canary');
  assert.equal(isDataClock(CANARIAS), false);
  assert.equal(isDataClock(CEUTA), true);
});

test('detección y búsqueda', () => {
  assert.equal(detect('Atlantic/Canary'), CANARIAS);
  assert.equal(detect('Europe/Madrid'), PENINSULA);
  assert.equal(detect(undefined), PENINSULA);
  assert.equal(byId('melilla'), MELILLA);
  assert.equal(byId('nope'), PENINSULA);
});

test('20:20 de Madrid son las 19:20 en Canarias, verano e invierno', () => {
  for (const now of [Date.UTC(2026, 6, 1, 12), Date.UTC(2026, 0, 15, 12), Date.UTC(2026, 2, 29, 12)]) {
    assert.equal(publicationLocalMinutes(PENINSULA, now), 20 * 60 + 20);
    assert.equal(publicationLocalMinutes(CANARIAS, now), 19 * 60 + 20);
    assert.equal(publicationLabel(CANARIAS, now), '19:20');
    assert.equal(publicationLabel(BALEARES, now), '20:20');
  }
});
