import type { FastifyInstance } from 'fastify';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { accounts } from '../db/schema.js';
import { requireAuth } from '../auth/require-auth.js';

export function accountsRoutes(app: FastifyInstance, db: NodePgDatabase) {
  app.get('/accounts', { preHandler: [requireAuth] }, async () => {
    const rows = await db.select({ id: accounts.id, email: accounts.email, nombre: accounts.nombre }).from(accounts);
    return { ok: true, data: rows };
  });
}
