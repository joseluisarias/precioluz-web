#!/usr/bin/env node
// Imprime la cadena de bandas ('g'/'o'/'r' por hora) de un día guardado, con el
// motor JS del sitio. Lo usa tools/parity.py para compararlo con Python.
//
//   node tools/bands_cli.js docs/data/pvpc/2026-09-22.json [pcb|cym]

import { readFileSync } from 'node:fs';
import { buildDay, bands } from '../docs/assets/js/engine.js';

const [file, series = 'pcb'] = process.argv.slice(2);
if (!file) {
  console.error('uso: node tools/bands_cli.js docs/data/pvpc/YYYY-MM-DD.json [pcb|cym]');
  process.exit(2);
}
const day = JSON.parse(readFileSync(file, 'utf8'));
process.stdout.write(`${bands(buildDay(day.hours, day.day, series))}\n`);
