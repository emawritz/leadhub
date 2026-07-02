import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { leadFiltersSchema } from '@leadhub/core';
import { buildLeadsQuery } from './query.js';
import { requireAuth } from '../auth/require-auth.js';
import { exportCsv } from './export.js';
import { exportLogs } from '../db/schema.js';

async function facet(db: NodePgDatabase, col: 'provincia' | 'localidad' | 'categoria' | 'fuente') {
  const rows = await db.execute(sql`
    SELECT ${sql.raw(col)} AS value, count(*)::int AS count
    FROM leads WHERE ${sql.raw(col)} <> '' GROUP BY 1 ORDER BY 2 DESC LIMIT 200`);
  return rows.rows;
}

export function leadsRoutes(app: FastifyInstance, db: NodePgDatabase) {
  app.get('/leads', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = leadFiltersSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Filtros inválidos' });
    const f = parsed.data;
    const { rows, count } = buildLeadsQuery(db, f);
    const [items, [{ n }]] = await Promise.all([rows, count]);
    return { ok: true, data: { items, total: n, page: f.page, pageSize: f.pageSize } };
  });

  app.get('/leads/facets', { preHandler: [requireAuth] }, async () => {
    const [provincia, localidad, categoria, fuente] = await Promise.all([
      facet(db, 'provincia'), facet(db, 'localidad'), facet(db, 'categoria'), facet(db, 'fuente'),
    ]);
    return { ok: true, data: { provincia, localidad, categoria, fuente } };
  });

  app.post('/leads/export', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = leadFiltersSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Filtros inválidos' });
    const { csv, count } = await exportCsv(db, parsed.data);
    await db.insert(exportLogs).values({ accountId: (req.user as { sub: string }).sub, filtros: parsed.data, cantidad: count });
    reply.header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="leads.csv"').send(csv);
  });
}
