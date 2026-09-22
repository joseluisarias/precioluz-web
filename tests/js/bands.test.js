// Paridad del coloreado JS con Python: fixtures exportados por
// tests/py/test_bands_fixtures.py (ejecutar pytest antes si faltan).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import { buildDay, bands } from '../../docs/assets/js/engine.js';

const dir = new URL('../fixtures/bands/', import.meta.url);
let files = [];
try {
  files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
} catch {
  files = [];
}

test('hay fixtures de bandas exportados por pytest', () => {
  assert.ok(files.length >= 20, 'faltan fixtures: ejecuta `.venv/bin/python -m pytest -q` primero');
});

for (const file of files) {
  test(`bands ${file}`, () => {
    const fx = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    const points = buildDay(fx.rows, fx.day, fx.series);
    assert.equal(points.length, fx.expected.length);
    assert.equal(bands(points), fx.expected);
  });
}
