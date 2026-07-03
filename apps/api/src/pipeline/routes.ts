import type { FastifyInstance } from 'fastify';
import { desc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { pipelineCreateSchema, pipelineUpdateSchema, stageLabel } from '@leadhub/core';
import { pipelineLeads, activities, tasks, leads, accounts } from '../db/schema.js';
import { requireAuth } from '../auth/require-auth.js';
import { isUuid } from './params.js';

export function pipelineRoutes(app: FastifyInstance, db: NodePgDatabase) {
  // Tablero: pipeline_leads + datos del lead + dueño + conteo de tareas pendientes
  app.get('/pipeline', { preHandler: [requireAuth] }, async () => {
    const rows = await db
      .select({
        id: pipelineLeads.id,
        stage: pipelineLeads.stage,
        ownerId: pipelineLeads.ownerId,
        ownerNombre: accounts.nombre,
        leadId: leads.id,
        nombre: leads.nombreFantasia,
        categoria: leads.categoria,
        localidad: leads.localidad,
        telefono: leads.telefono,
        email: leads.email,
        pendientes: sql<number>`(select count(*)::int from ${tasks} t where t.pipeline_lead_id = ${pipelineLeads.id} and t.hecha = false)`,
        proximoVence: sql<string | null>`(select min(t.vence) from ${tasks} t where t.pipeline_lead_id = ${pipelineLeads.id} and t.hecha = false)`,
      })
      .from(pipelineLeads)
      .innerJoin(leads, eq(leads.id, pipelineLeads.leadId))
      .leftJoin(accounts, eq(accounts.id, pipelineLeads.ownerId))
      .orderBy(desc(pipelineLeads.updatedAt));
    return { ok: true, data: rows };
  });

  app.post('/pipeline', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = pipelineCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Datos inválidos' });
    const { leadId, ownerId } = parsed.data;
    const [row] = await db
      .insert(pipelineLeads)
      .values({ leadId, ownerId: ownerId ?? null })
      .onConflictDoNothing({ target: pipelineLeads.leadId })
      .returning();
    if (!row) return reply.code(409).send({ ok: false, error: 'El lead ya está en el pipeline' });
    return { ok: true, data: row };
  });

  app.patch('/pipeline/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ ok: false, error: 'id inválido' });
    const parsed = pipelineUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Datos inválidos' });
    const [current] = await db.select().from(pipelineLeads).where(eq(pipelineLeads.id, id)).limit(1);
    if (!current) return reply.code(404).send({ ok: false, error: 'No encontrado' });
    const accountId = (req.user as { sub: string }).sub;
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.ownerId !== undefined) set.ownerId = parsed.data.ownerId;
    if (parsed.data.stage && parsed.data.stage !== current.stage) {
      set.stage = parsed.data.stage;
      await db.insert(activities).values({
        pipelineLeadId: id, accountId, tipo: 'etapa',
        cuerpo: `${stageLabel(current.stage)} → ${stageLabel(parsed.data.stage)}`,
      });
    }
    const [row] = await db.update(pipelineLeads).set(set).where(eq(pipelineLeads.id, id)).returning();
    return { ok: true, data: row };
  });

  app.delete('/pipeline/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ ok: false, error: 'id inválido' });
    const [row] = await db.delete(pipelineLeads).where(eq(pipelineLeads.id, id)).returning({ id: pipelineLeads.id });
    if (!row) return reply.code(404).send({ ok: false, error: 'No encontrado' });
    return { ok: true, data: { id } };
  });

  app.get('/pipeline/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ ok: false, error: 'id inválido' });
    const [pl] = await db.select().from(pipelineLeads).where(eq(pipelineLeads.id, id)).limit(1);
    if (!pl) return reply.code(404).send({ ok: false, error: 'No encontrado' });
    const [lead] = await db.select().from(leads).where(eq(leads.id, pl.leadId)).limit(1);
    const acts = await db.select().from(activities).where(eq(activities.pipelineLeadId, id)).orderBy(desc(activities.createdAt));
    const tks = await db.select().from(tasks).where(eq(tasks.pipelineLeadId, id)).orderBy(desc(tasks.createdAt));
    return { ok: true, data: { pipeline: pl, lead, activities: acts, tasks: tks } };
  });
}
