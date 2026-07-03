import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { scrapeInputSchema } from './input.js';
import { scrapeJobs } from '../db/schema.js';
import { requireAuth } from '../auth/require-auth.js';

interface Worker { enqueue(id: string): void; }

export function scrapeRoutes(app: FastifyInstance, db: NodePgDatabase, worker: Worker) {
  app.post('/scrape', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = scrapeInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Datos inválidos' });
    const { query, location, max, enrich, excludeChains } = parsed.data;
    const accountId = (req.user as { sub: string }).sub;
    const [job] = await db.insert(scrapeJobs)
      .values({ accountId, query, location, max, enrich, excludeChains }).returning();
    worker.enqueue(job.id);
    return { ok: true, data: job };
  });

  app.get('/scrape', { preHandler: [requireAuth] }, async () => {
    const rows = await db.select().from(scrapeJobs).orderBy(desc(scrapeJobs.createdAt)).limit(50);
    return { ok: true, data: rows };
  });

  app.get('/scrape/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await db.select().from(scrapeJobs).where(eq(scrapeJobs.id, id)).limit(1);
    if (!row) return reply.code(404).send({ ok: false, error: 'No encontrado' });
    return { ok: true, data: row };
  });
}
