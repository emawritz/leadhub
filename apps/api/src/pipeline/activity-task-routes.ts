import type { FastifyInstance } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { activityCreateSchema, taskCreateSchema, taskUpdateSchema } from '@leadhub/core';
import { activities, tasks, pipelineLeads, leads } from '../db/schema.js';
import { requireAuth } from '../auth/require-auth.js';
import { isUuid } from './params.js';

export function activityTaskRoutes(app: FastifyInstance, db: NodePgDatabase) {
  app.post('/pipeline/:id/activities', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ ok: false, error: 'id inválido' });
    const parsed = activityCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Datos inválidos' });
    const accountId = (req.user as { sub: string }).sub;
    const [row] = await db.insert(activities)
      .values({ pipelineLeadId: id, accountId, tipo: parsed.data.tipo, cuerpo: parsed.data.cuerpo }).returning();
    return { ok: true, data: row };
  });

  app.post('/pipeline/:id/tasks', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ ok: false, error: 'id inválido' });
    const parsed = taskCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Datos inválidos' });
    const accountId = (req.user as { sub: string }).sub;
    const [row] = await db.insert(tasks).values({
      pipelineLeadId: id, accountId, titulo: parsed.data.titulo,
      vence: parsed.data.vence ? new Date(parsed.data.vence) : null,
    }).returning();
    return { ok: true, data: row };
  });

  app.patch('/tasks/:taskId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { taskId } = req.params as { taskId: string };
    if (!isUuid(taskId)) return reply.code(400).send({ ok: false, error: 'id inválido' });
    const parsed = taskUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Datos inválidos' });
    const [row] = await db.update(tasks)
      .set({ hecha: parsed.data.hecha, completedAt: parsed.data.hecha ? new Date() : null })
      .where(eq(tasks.id, taskId)).returning();
    if (!row) return reply.code(404).send({ ok: false, error: 'No encontrado' });
    return { ok: true, data: row };
  });

  // Tareas pendientes con datos del lead (para la vista Tareas)
  app.get('/tasks', { preHandler: [requireAuth] }, async () => {
    const rows = await db
      .select({
        id: tasks.id, titulo: tasks.titulo, vence: tasks.vence, hecha: tasks.hecha,
        pipelineLeadId: tasks.pipelineLeadId, leadNombre: leads.nombreFantasia,
      })
      .from(tasks)
      .innerJoin(pipelineLeads, eq(pipelineLeads.id, tasks.pipelineLeadId))
      .innerJoin(leads, eq(leads.id, pipelineLeads.leadId))
      .where(eq(tasks.hecha, false))
      .orderBy(asc(tasks.vence));
    return { ok: true, data: rows };
  });
}
