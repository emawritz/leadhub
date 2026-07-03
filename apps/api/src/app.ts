import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { jwtPlugin } from './auth/jwt-plugin.js';
import { authRoutes } from './auth/routes.js';
import { leadsRoutes } from './leads/routes.js';
import { makeScrapeWorker, type RunJob } from './scrape/worker.js';
import { scrapeRoutes } from './scrape/routes.js';
import { spawnScraperAndIngest } from './scrape/runner.js';

export function buildApp(db: NodePgDatabase, opts: { scrapeRunJob?: RunJob } = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  app.register(cors, { origin: true });
  app.register(jwtPlugin);
  app.get('/health', async () => ({ ok: true, data: { status: 'up' } }));
  const runJob = opts.scrapeRunJob ?? spawnScraperAndIngest(db);
  const worker = makeScrapeWorker(db, runJob);
  app.after(() => {
    authRoutes(app, db);
    leadsRoutes(app, db);
    scrapeRoutes(app, db, worker);
  });
  return app;
}
