import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Lead } from '@leadhub/core';
import { upsertLeads } from '@leadhub/ingest';
import { parseProgressLine } from './progress.js';
import { scrapeJobs } from '../db/schema.js';
import type { RunJob } from './worker.js';

const REPO_ROOT = process.cwd();
const SCRAPER_CLI = path.resolve(REPO_ROOT, 'apps/scraper/dist/cli.js');

export function spawnScraperAndIngest(db: NodePgDatabase): RunJob {
  return async (job, hooks) => {
    const outputPath = `output/jobs/${job.id}.json`;
    await db.update(scrapeJobs).set({ outputPath }).where(eq(scrapeJobs.id, job.id));

    const args = [
      SCRAPER_CLI, 'search',
      '--query', job.query, '--location', job.location, '--max', String(job.max),
      '--progress-json', '--output', outputPath,
    ];
    if (job.enrich) args.push('--enrich');
    if (job.excludeChains) args.push('--exclude-chains');

    const child = spawn('node', args, { cwd: REPO_ROOT });
    let stderr = '';
    const rl = createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      const ev = parseProgressLine(line);
      if (ev) void hooks.onProgress(ev);
    });
    child.stderr.on('data', (d) => { stderr += String(d); });

    const code: number = await new Promise((resolve) => child.on('close', (c) => resolve(c ?? 1)));
    if (code !== 0) {
      const captcha = /captcha|unusual traffic/i.test(stderr);
      throw new Error(captcha
        ? 'Google pidió verificación — corré el scraper con --headed una vez para reautenticar el perfil.'
        : `El scraper falló (código ${code}). ${stderr.slice(-300)}`);
    }

    const leads = JSON.parse(await readFile(path.join(REPO_ROOT, outputPath), 'utf8')) as Lead[];
    const r = await upsertLeads(db, leads);
    return { leadsFound: leads.length, inserted: r.inserted, updated: r.updated };
  };
}
