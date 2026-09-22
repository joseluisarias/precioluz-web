// El markup de barras que produce dia.js es el mismo que escribe render.bars
// (Python): se compara contra las filas de docs/index.html (salida del build).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import { buildDay, bands as computeBands } from '../../docs/assets/js/engine.js';
import { madridDayStart, HOUR_MS } from '../../docs/assets/js/tz.js';
import { PENINSULA, CANARIAS, CEUTA } from '../../docs/assets/js/zones.js';
import { barsHtml, dayLabel, fixed, esc, icon, BOLT } from '../../docs/assets/js/dia.js';

const INDEX = new URL('../../docs/index.html', import.meta.url);
const html = existsSync(INDEX) ? readFileSync(INDEX, 'utf8') : null;
const rowsOf = (s) => s.match(/<li class="bar[^"]*"[^>]*>.*?<\/li>/g) || [];

function bootOf(h) {
  const m = /<script type="application\/json" id="pl-boot">(.*?)<\/script>/s.exec(h);
  return m ? JSON.parse(m[1].replace(/<\\\//g, '</')) : null;
}

test('fixed(): como f"{x:.nf}" de Python, incluidos los empates exactos', () => {
  assert.equal(fixed(0.18834, 4), '0.1883');
  assert.equal(fixed(0.03125, 4), '0.0312');     // empate exacto en binario → al par
  assert.equal(fixed(0.09375, 4), '0.0938');
  assert.equal(fixed(0.18825, 4), '0.1883');     // 0.18825 es 0.18825000000000000066… en binario (no es empate)
  assert.equal(fixed(0.18835, 4), '0.1883');     // 0.18835 queda por debajo en binario
  assert.equal(fixed(22 * 0.022, 3), '0.484');
  assert.equal(fixed(0.5, 0), '0');
  assert.equal(fixed(1.5, 0), '2');
});

test('esc() e icon()', () => {
  assert.equal(esc('a<b>&"c\''), 'a&lt;b&gt;&amp;&quot;c&#x27;');
  assert.equal(icon('leaf'), '<svg class="ic" aria-hidden="true"><use href="/assets/img/icons.svg#i-leaf"/></svg>');
});

test('barras: mismo número de filas, mismos --v y aria-labels que docs/index.html', { skip: !html && 'sin docs/index.html' }, () => {
  const boot = bootOf(html);
  assert.ok(boot, 'boot JSON');
  const day = boot.selected;
  const file = boot.days[day];
  assert.ok(file, `boot.days[${day}]`);
  const points = buildDay(file.hours, day, 'pcb');
  const bands = file.bands.pcb;
  const mine = rowsOf(barsHtml(points, bands, PENINSULA, dayLabel(day)));
  const ssr = rowsOf(html);
  assert.equal(ssr.length, points.length, `docs/index.html tiene ${ssr.length} filas`);
  assert.equal(mine.length, ssr.length);
  for (let k = 0; k < ssr.length; k++) {
    const v = (s) => /--v:([\d.]+)/.exec(s)[1];
    const label = (s) => /aria-label="([^"]*)"/.exec(s)[1];
    assert.equal(v(mine[k]), v(ssr[k]), `--v fila ${k}`);
    assert.equal(label(mine[k]), label(ssr[k]), `aria-label fila ${k}`);
    assert.equal(mine[k], ssr[k], `fila ${k}`);
  }
});

test('barras: la sección completa es idéntica a la del build', { skip: !html && 'sin docs/index.html' }, () => {
  const boot = bootOf(html);
  const day = boot.selected;
  const file = boot.days[day];
  const points = buildDay(file.hours, day, 'pcb');
  const section = /<section class="card chart"[^>]*><ol class="bars".*?<\/ol><\/section>/s.exec(html);
  assert.ok(section, 'sección del gráfico en docs/index.html');
  assert.equal(barsHtml(points, file.bands.pcb, PENINSULA, dayLabel(day)), section[0]);
});

test('barras: hora actual con rayo, Canarias una hora menos, Ceuta con su serie', () => {
  const day = '2026-09-22';
  const rows = [];
  for (let i = 0; i < 24; i++) rows.push({ i, h: `${String(i).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, pcb: 100 + i, cym: i === 10 ? 50 : 100 + i });
  const pts = buildDay(rows, day, 'pcb');
  const b = computeBands(pts);
  const out = barsHtml(pts, b, PENINSULA, dayLabel(day), 12);
  const row12 = rowsOf(out)[12];
  assert.match(row12, /class="bar [gor] now"/);
  assert.ok(row12.includes(BOLT));
  assert.match(row12, /aria-label="De 12:00 a 13:00, 0,112 €\/kWh, [a-z ]+ \(hora actual\)"/);
  assert.ok(rowsOf(out)[0].includes('class="bar g best"') && rowsOf(out)[0].includes('Hora más barata'));
  assert.ok(out.startsWith('<section class="card chart" aria-label="Precio de la luz por horas, martes, 22 de septiembre de 2026">'));

  const can = rowsOf(barsHtml(pts, b, CANARIAS, dayLabel(day)));
  assert.match(can[0], /aria-label="De 23:00 a 00:00/);
  assert.match(can[13], /<span class="h">12:00<\/span>/);

  const ceu = buildDay(rows, day, 'cym');
  const ceuRows = rowsOf(barsHtml(ceu, computeBands(ceu), CEUTA, dayLabel(day)));
  assert.match(ceuRows[10], /0,050 €\/kWh/);
  assert.ok(ceuRows[10].includes(' best'));
  assert.equal(pts[12].start, madridDayStart(day) + 12 * HOUR_MS);
});

test('barras: sin datos → tarjeta vacía', () => {
  assert.equal(barsHtml([], '', PENINSULA, 'x'),
    `<section class="card chart"><p class="empty">${icon('calendar')}Sin datos para esta fecha</p></section>`);
});
