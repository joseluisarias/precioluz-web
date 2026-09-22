// Paridad de resumen.js, calendario.js y generacion.js con render.py, contra el
// HTML que escribe el build (docs/index.html y docs/generacion/index.html).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import { buildDay, stats } from '../../docs/assets/js/engine.js';
import { addDays, madridDayStart, HOUR_MS } from '../../docs/assets/js/tz.js';
import { comparisonText, isWeekend } from '../../docs/assets/js/format.js';
import { PENINSULA, CANARIAS } from '../../docs/assets/js/zones.js';
import { comparativaHtml, insightsHtml, nextOpportunity } from '../../docs/assets/js/resumen.js';
import { calendarInner, detailHtml, valleAvg, crestaAvg, monthDays, listboxHtml } from '../../docs/assets/js/calendario.js';
import { donutSvg, generacionInner, fmtEnergy, arc } from '../../docs/assets/js/generacion.js';

const read = (rel) => {
  const u = new URL(rel, import.meta.url);
  return existsSync(u) ? readFileSync(u, 'utf8') : null;
};
const index = read('../../docs/index.html');
const genPage = read('../../docs/generacion/index.html');

function bootOf(h) {
  const m = /<script type="application\/json" id="pl-boot">(.*?)<\/script>/s.exec(h);
  return m ? JSON.parse(m[1].replace(/<\\\//g, '</')) : null;
}
const pick = (h, re) => { const m = re.exec(h); return m ? m[0] : null; };

test('comparativa e insights idénticos al build', { skip: !index && 'sin docs/index.html' }, () => {
  const boot = bootOf(index);
  const day = boot.selected;
  const file = boot.days[day];
  const prev = boot.days[addDays(day, -1)];
  const next = boot.days[addDays(day, 1)];
  const st = file.stats.pcb;
  const stPrev = prev ? prev.stats.pcb : null;
  const stNext = next ? next.stats.pcb : null;
  const nextState = !stNext && addDays(day, 1) > boot.today ? 'future' : 'none';
  const ssrComp = pick(index, /<section class="card" id="comparativa">.*?<\/section>/s);
  assert.equal(comparativaHtml(stPrev, st, stNext, nextState), ssrComp);

  const pts = buildDay(file.hours, day, 'pcb');
  const entry = boot.calendar.days[day].pcb;
  const baseline = isWeekend(day) ? entry.typWe : entry.typWd;
  const comparison = comparisonText(st.avg, baseline, isWeekend(day));
  const ssrIns = pick(index, /<section class="card" id="insights">.*?<hr class="sep"><\/section>/s);
  assert.equal(insightsHtml(day, PENINSULA, pts, st, comparison), ssrIns);
});

test('insights: sin datos, y próxima oportunidad nunca mira atrás', () => {
  const html = insightsHtml('2026-09-27', PENINSULA, [], null, null);
  assert.ok(html.includes('Finde · Dom 27 Sep'));
  assert.equal((html.match(/tile [gr t o]+ dim/g) || []).length, 4);
  assert.ok(!html.includes('advice'));

  const day = '2026-09-22';
  const rows = [];
  for (let i = 0; i < 24; i++) rows.push({ i, h: `${i}-${i + 1}`, pcb: i === 3 ? 10 : i === 20 ? 30 : 100, cym: null });
  const pts = buildDay(rows, day, 'pcb');
  const noon = madridDayStart(day) + 12 * HOUR_MS;
  const nxt = nextOpportunity(pts, noon);
  assert.equal(nxt.index, 20);
  const out = insightsHtml(day, PENINSULA, pts, stats(pts), null, nxt);
  assert.match(out, /id="tile-next">.*?<div class="v">0,030 €<\/div><div class="s">20:00<\/div>/);
  assert.match(out, /Mejor hora: 03:00\. Peor hora: 00:00\./);
  assert.equal(nextOpportunity(pts, madridDayStart(addDays(day, 1))), null);
});

test('calendario idéntico al build (rejilla, nav y día seleccionado)', { skip: !index && 'sin docs/index.html' }, () => {
  const boot = bootOf(index);
  const day = boot.selected;
  const pts = buildDay(boot.days[day].hours, day, 'pcb');
  const maxDay = boot.days[boot.tomorrow] ? boot.tomorrow : boot.today;
  const mine = `<section class="card" id="calendar">${calendarInner(day.slice(0, 7), boot.calendar.days, 'pcb', day, maxDay, boot.months, PENINSULA, pts)}</section>`;
  const ssr = pick(index, /<section class="card" id="calendar">.*?Toca otro día para comparar rápidamente\.<\/p><\/section>/s);
  // render.py escribe href="?m=None" cuando no hay mes siguiente; el JS deja "?m=".
  assert.equal(mine, ssr.replace('href="?m=None"', 'href="?m="'));
});

test('calendario: valle/cresta por etiqueta, días del mes, listbox', () => {
  const day = '2026-09-22';
  const rows = [];
  for (let i = 0; i < 24; i++) rows.push({ i, h: `${String(i).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, pcb: (i + 1) * 10, cym: null });
  const pts = buildDay(rows, day, 'pcb');
  assert.ok(Math.abs(valleAvg(pts) - 0.045) < 1e-12);
  assert.ok(Math.abs(crestaAvg(pts) - 0.165) < 1e-12);
  assert.equal(monthDays('2026-02').length, 28);
  assert.equal(monthDays('2024-02').length, 29);
  assert.equal(monthDays('2026-09')[0], '2026-09-01');
  const d = detailHtml(day, CANARIAS, pts);
  assert.ok(d.includes('Mínimo:</span><span>0,010 €/kWh · 23:00'));
  assert.ok(d.includes('<span class="badge xs">NORMAL</span>'));     // media 0,125
  assert.ok(detailHtml(day, CANARIAS, []).includes('Aún no hay datos'));
  const lb = listboxHtml(['2025-01', '2026-07', '2026-08', '2026-09'], '2026-09');
  assert.match(lb, /^<ul class="cal-months" id="cal-months" role="listbox"/);
  assert.equal((lb.match(/role="option"/g) || []).length, 4);
  assert.match(lb, /data-m="2026-09" aria-selected="true">Septiembre 2026/);
});

test('generación idéntica al build (donut, KPIs, lista)', { skip: !genPage && 'sin docs/generacion/index.html' }, () => {
  const boot = bootOf(genPage);
  const gen = boot.generation;
  assert.ok(gen && gen.entries.length);
  const ssr = pick(genPage, /<section class="card" id="generacion">.*?<\/section>/s);
  const mine = `<section class="card" id="generacion">${generacionInner(gen, 'day')}</section>`;
  assert.equal(mine, ssr);
  const svg = pick(ssr, /<svg class="donut-svg".*?<\/svg>/s);
  assert.equal(donutSvg(gen.entries), svg);
});

test('generación: selección, modo hoy/ayer y unidades', () => {
  const gen = {
    day: '2026-09-22', datetime: '2026-09-22T17:00:00.000+02:00', total: 28500, renewablePct: 60.5,
    entries: [{ t: 'Eólica', v: 18000, pct: 63.16, color: '#7CC33F' }, { t: 'Nuclear', v: 10500, pct: 36.84, color: '#7B2D8E' }],
  };
  assert.equal(fmtEnergy(789031.89), '789,0 GWh');
  assert.equal(fmtEnergy(955.9), '956 MWh');
  assert.equal(fmtEnergy(28500, 'W'), '28,5 GW');
  const now = generacionInner(gen, 'now', { zone: CANARIAS, selected: 'Nuclear' });
  assert.ok(now.includes('<h2 class="lbl headline" id="gen-title"><svg class="ic" aria-hidden="true"><use href="/assets/img/icons.svg#i-bolt"/></svg>Generación de hoy · hasta ahora</h2>'));
  assert.ok(now.includes('<span class="badge" id="gen-badge">22/09</span>'));
  assert.ok(now.includes('data-t="Nuclear" class="sel"') && now.includes('data-t="Eólica" class="dim"'));
  assert.ok(now.includes('<div class="center"><span class="t">Nuclear</span><span class="v">10,5 GWh</span><span class="s" style="color:#7B2D8E">36,8 %</span></div>'));
  assert.ok(now.includes('data-t="Nuclear" style="--sw:#7B2D8E" aria-pressed="true"'));
  assert.ok(now.includes('data-mode="now" aria-selected="true"'));
  const one = donutSvg([{ t: 'Solo', v: 1, pct: 100, color: '#000' }]);
  assert.equal((one.match(/<path /g) || []).length, 1);
  assert.match(one, /A138\.00 138\.00 0 0 1 140\.00 278\.00/);
  assert.equal(arc(140, 140, 138, 85.284, 0, Math.PI / 2), 'M140.00 2.00 A138.00 138.00 0 0 1 278.00 140.00 L225.28 140.00 A85.28 85.28 0 0 0 140.00 54.72 Z');
  assert.ok(generacionInner(null, 'day').includes('Sin datos'));
});
