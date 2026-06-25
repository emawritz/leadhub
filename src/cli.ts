#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { runScrape } from './scraper/maps-scraper.js';
import { resolveOutputPaths } from './utils/output-path.js';
import { writeCsv } from './exporters/csv.js';
import { writeJson } from './exporters/json.js';
import { logSuccess, logError } from './utils/logger.js';
import type { ScraperOptions } from './types.js';

const program = new Command();

program
  .name('maps-scraper')
  .description('Extrae prospectos de negocios desde Google Maps');

program
  .command('search')
  .requiredOption('--query <string>', 'término de búsqueda')
  .requiredOption('--location <string>', 'ciudad/zona')
  .option('--max <number>', 'máximo de resultados', '50')
  .option('--enrich', 'visitar sitio web para email/redes', false)
  .option('--headed', 'mostrar el browser', false)
  .option('--delay <number>', 'ms base entre negocios', '2000')
  .option('--output <path>', 'ruta de salida (sin él: output/{query}_{fecha})')
  .option('--resume', 'continuar desde checkpoint', false)
  .action(async (opts) => {
    const options: ScraperOptions = {
      query: opts.query,
      location: opts.location,
      max: Number(opts.max),
      enrich: Boolean(opts.enrich),
      headed: Boolean(opts.headed),
      delay: Number(opts.delay),
      output: opts.output,
      resume: Boolean(opts.resume),
    };
    try {
      const leads = await runScrape(options);
      const date = new Date().toISOString().slice(0, 10);
      const { csv, json } = resolveOutputPaths(options.output, options.query, date);
      await writeCsv(leads, csv);
      await writeJson(leads, json);
      logSuccess(`Exportado: ${csv} y ${json}`);
    } catch (err) {
      logError((err as Error).message);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
