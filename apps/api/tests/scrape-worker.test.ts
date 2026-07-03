import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDbCtx, resetDb, seedAccount } from './helpers/db.js';
import { scrapeJobs } from '../src/db/schema.js';
import { makeScrapeWorker, type RunJob } from '../src/scrape/worker.js';

const db = testDbCtx.db;

beforeEach(async () => { await resetDb(); });

async function insertJob(accountId: string) {
  const [j] = await db.insert(scrapeJobs)
    .values({ accountId, query: 'farmacias', location: 'Lomas' }).returning();
  return j;
}

describe('makeScrapeWorker', () => {
  it('lleva un job de queued a done, reporta progreso y conteos', async () => {
    const acc = await seedAccount();
    const job = await insertJob(acc.id);
    const runJob: RunJob = async (_job, hooks) => {
      await hooks.onProgress({ phase: 'collect', total: 5 });
      await hooks.onProgress({ phase: 'visit', done: 5, total: 5 });
      return { leadsFound: 5, inserted: 4, updated: 1 };
    };
    const worker = makeScrapeWorker(db, runJob);
    worker.enqueue(job.id);
    await vi.waitFor(async () => {
      const [row] = await db.select().from(scrapeJobs).where(eq(scrapeJobs.id, job.id));
      expect(row.status).toBe('done');
      expect(row.total).toBe(5);
      expect(row.leadsFound).toBe(5);
      expect(row.inserted).toBe(4);
    });
  });

  it('marca error si runJob lanza', async () => {
    const acc = await seedAccount();
    const job = await insertJob(acc.id);
    const runJob: RunJob = async () => { throw new Error('boom'); };
    const worker = makeScrapeWorker(db, runJob);
    worker.enqueue(job.id);
    await vi.waitFor(async () => {
      const [row] = await db.select().from(scrapeJobs).where(eq(scrapeJobs.id, job.id));
      expect(row.status).toBe('error');
      expect(row.error).toContain('boom');
    });
  });

  it('serializa: dos jobs corren de a uno', async () => {
    const acc = await seedAccount();
    const a = await insertJob(acc.id); const b = await insertJob(acc.id);
    let concurrent = 0; let maxConcurrent = 0;
    const runJob: RunJob = async () => {
      concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 30));
      concurrent--;
      return { leadsFound: 0, inserted: 0, updated: 0 };
    };
    const worker = makeScrapeWorker(db, runJob);
    worker.enqueue(a.id); worker.enqueue(b.id);
    await vi.waitFor(async () => {
      const rows = await db.select().from(scrapeJobs);
      expect(rows.every((r) => r.status === 'done')).toBe(true);
    });
    expect(maxConcurrent).toBe(1);
  });
});
