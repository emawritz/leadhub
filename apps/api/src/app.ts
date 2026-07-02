import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { jwtPlugin } from './auth/jwt-plugin.js';
import { authRoutes } from './auth/routes.js';
import { leadsRoutes } from './leads/routes.js';

export function buildApp(db: NodePgDatabase): FastifyInstance {
  const app = Fastify({ logger: false });
  app.register(cors, { origin: true });
  app.register(jwtPlugin);
  app.get('/health', async () => ({ ok: true, data: { status: 'up' } }));
  app.after(() => { authRoutes(app, db); leadsRoutes(app, db); });
  return app;
}
