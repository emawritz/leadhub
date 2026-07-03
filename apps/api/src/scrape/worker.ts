import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ProgressEvent } from '@leadhub/core';
import { scrapeJobs } from '../db/schema.js';

export type ScrapeJobRow = typeof scrapeJobs.$inferSelect;

export type RunJob = (
  job: ScrapeJobRow,
  hooks: { onProgress: (ev: ProgressEvent) => Promise<void> },
) => Promise<{ leadsFound: number; inserted: number; updated: number }>;

export function makeScrapeWorker(db: NodePgDatabase, runJob: RunJob) {
  const queue: string[] = [];
  let processing = false;

  async function processNext(): Promise<void> {
    if (processing || queue.length === 0) return;
    processing = true;
    const id = queue.shift()!;
    try {
      const [job] = await db.select().from(scrapeJobs).where(eq(scrapeJobs.id, id)).limit(1);
      if (!job) return;
      await db.update(scrapeJobs).set({ status: 'running', startedAt: new Date() }).where(eq(scrapeJobs.id, id));
      const onProgress = async (ev: ProgressEvent) => {
        await db.update(scrapeJobs).set({
          phase: ev.phase,
          ...(ev.done != null ? { done: ev.done } : {}),
          ...(ev.total != null ? { total: ev.total } : {}),
        }).where(eq(scrapeJobs.id, id));
      };
      try {
        const r = await runJob(job, { onProgress });
        await db.update(scrapeJobs).set({
          status: 'done', leadsFound: r.leadsFound, inserted: r.inserted, updated: r.updated,
          finishedAt: new Date(),
        }).where(eq(scrapeJobs.id, id));
      } catch (e) {
        await db.update(scrapeJobs).set({
          status: 'error', error: (e as Error).message.slice(0, 500), finishedAt: new Date(),
        }).where(eq(scrapeJobs.id, id));
      }
    } finally {
      processing = false;
      void processNext();
    }
  }

  return {
    enqueue(id: string): void {
      queue.push(id);
      void processNext();
    },
  };
}
