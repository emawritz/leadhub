# CRM Pipeline (core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un CRM de outreach sobre el catálogo de leads: un tablero Kanban compartido donde los leads se mueven por etapas, con timeline de actividades y tareas de seguimiento.

**Architecture:** 3 tablas nuevas en la API (`pipeline_leads`, `activities`, `tasks`); constantes + Zod en `@leadhub/core`; endpoints `/pipeline`, `/pipeline/:id/*`, `/tasks` en Fastify; y en la web nuevas pestañas Pipeline (Kanban con @dnd-kit) y Tareas + botón "→ Pipeline" en Explorar.

**Tech Stack:** Node 20 + TS strict (ESM), Fastify + Drizzle + PostgreSQL, Zod, React + Vite + TanStack Query + @dnd-kit, Tailwind.

## Global Constraints

- **Sin tests automatizados** (decisión del usuario). Verificación por tarea: `pnpm --filter <pkg> build`/`tsc --noEmit` en verde. Smoke manual del flujo completo en la última tarea. Los reviewers evalúan spec-compliance + calidad de código, no cobertura.
- TypeScript **strict**; ESM (`type: module`), imports con `.js`.
- Gestor **pnpm**; paquetes: `@leadhub/core`, `@leadhub/api`, `@leadhub/web` (+scraper/ingest sin cambios).
- Envelope de API `{ ok, data, error }`; validación **Zod**; `requireAuth` (JWT) en todos los endpoints nuevos; `accountId` = JWT `sub`.
- Postgres en host port **5544**; migrar `leadhub` y `leadhub_test`. La API corre en **4501** (3001 ocupado).
- Etapas **fijas**: `nuevo · contactado · interesado · negociacion · ganado · perdido` (ganado/perdido cierran).
- Tipos de actividad: `nota · llamada · email · whatsapp · etapa` (los usuarios crean todos menos `etapa`, que es interno/auto).
- Pipeline **compartido** por el equipo; `lead_id` único en `pipeline_leads` (un lead entra una vez).
- Nota drizzle: `generate` re-emite ALTERs espurios sobre `leads` (columnas `has_*`/`search_tsv` creadas por SQL crudo) — **stripearlos** de la migración generada, dejar solo las tablas nuevas.

---

### Task 1: Migración — tablas `pipeline_leads`, `activities`, `tasks`

**Files:**
- Modify: `apps/api/src/db/schema.ts` (agregar 3 pgTables)
- Create (generado + editado): `apps/api/drizzle/0002_*.sql`

**Interfaces:**
- Produces: `pipelineLeads`, `activities`, `tasks` (Drizzle pgTables) + `$inferSelect` types.

- [ ] **Step 1: Agregar las tablas a `apps/api/src/db/schema.ts`**

Al final del archivo. Verificá que `boolean`, `integer`, `timestamp`, `uuid`, `text` estén importados de `drizzle-orm/pg-core`.
```typescript
export const pipelineLeads = pgTable('pipeline_leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().unique().references(() => leads.id),
  ownerId: uuid('owner_id').references(() => accounts.id),
  stage: text('stage').notNull().default('nuevo'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  pipelineLeadId: uuid('pipeline_lead_id').notNull().references(() => pipelineLeads.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  tipo: text('tipo').notNull(),
  cuerpo: text('cuerpo').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  pipelineLeadId: uuid('pipeline_lead_id').notNull().references(() => pipelineLeads.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  titulo: text('titulo').notNull(),
  vence: timestamp('vence', { withTimezone: true }),
  hecha: boolean('hecha').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
```

- [ ] **Step 2: Generar la migración**

Run: `pnpm --filter @leadhub/api generate`
Expected: crea `apps/api/drizzle/0002_*.sql` con las 3 CREATE TABLE + FKs.

- [ ] **Step 3: Stripear ALTERs espurios y agregar índices**

En el `.sql` generado, **borrar** cualquier línea `ALTER TABLE "leads" ADD COLUMN ...` (has_email/has_telefono/has_whatsapp/has_web/has_cuit/search_tsv) — ya existen en la DB. Dejar solo las 3 CREATE TABLE + sus constraints FK. Agregar al final:
```sql
CREATE INDEX "pipeline_leads_stage_idx" ON "pipeline_leads" ("stage");
CREATE INDEX "activities_pipeline_lead_idx" ON "activities" ("pipeline_lead_id");
CREATE INDEX "tasks_pipeline_lead_idx" ON "tasks" ("pipeline_lead_id");
CREATE INDEX "tasks_pendientes_idx" ON "tasks" ("hecha", "vence");
```

- [ ] **Step 4: Aplicar a ambas DBs**

Run:
```bash
pnpm --filter @leadhub/api migrate
DATABASE_URL=postgres://leadhub:leadhub@localhost:5544/leadhub_test pnpm --filter @leadhub/api migrate
```
Expected: aplica sin errores en `leadhub` y `leadhub_test`.

- [ ] **Step 5: Verificar + build**

Run: `docker compose exec -T db psql -U leadhub -c "\d pipeline_leads" && pnpm --filter @leadhub/api build`
Expected: muestra la tabla; build tsc limpio.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle
git commit -m "feat(api): tablas pipeline_leads/activities/tasks + migración"
```

---

### Task 2: `@leadhub/core` — constantes de etapas/actividad + Zod

**Files:**
- Create: `packages/core/src/stages.ts`, `packages/core/src/crm.ts`
- Modify: `packages/core/src/index.ts` (reexportar)

**Interfaces:**
- Produces: `STAGES`, `STAGE_IDS`, `CLOSED_STAGES`, `type StageId`, `stageLabel(id)`; `ACTIVITY_TYPES`, `USER_ACTIVITY_TYPES`, `type ActivityType`; Zod: `pipelineCreateSchema`, `pipelineUpdateSchema`, `activityCreateSchema`, `taskCreateSchema`, `taskUpdateSchema` + sus `type`.

- [ ] **Step 1: Crear `packages/core/src/stages.ts`**

```typescript
export const STAGES = [
  { id: 'nuevo', label: 'Nuevo' },
  { id: 'contactado', label: 'Contactado' },
  { id: 'interesado', label: 'Interesado' },
  { id: 'negociacion', label: 'Negociación' },
  { id: 'ganado', label: 'Ganado' },
  { id: 'perdido', label: 'Perdido' },
] as const;

export type StageId = (typeof STAGES)[number]['id'];
export const STAGE_IDS = STAGES.map((s) => s.id) as [StageId, ...StageId[]];
export const CLOSED_STAGES: StageId[] = ['ganado', 'perdido'];
export function stageLabel(id: string): string {
  return STAGES.find((s) => s.id === id)?.label ?? id;
}

export const ACTIVITY_TYPES = ['nota', 'llamada', 'email', 'whatsapp', 'etapa'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const USER_ACTIVITY_TYPES = ['nota', 'llamada', 'email', 'whatsapp'] as const;
```

- [ ] **Step 2: Crear `packages/core/src/crm.ts`**

```typescript
import { z } from 'zod';
import { STAGE_IDS, USER_ACTIVITY_TYPES } from './stages.js';

export const pipelineCreateSchema = z.object({
  leadId: z.string().uuid(),
  ownerId: z.string().uuid().optional(),
});
export const pipelineUpdateSchema = z.object({
  stage: z.enum(STAGE_IDS).optional(),
  ownerId: z.string().uuid().nullable().optional(),
});
export const activityCreateSchema = z.object({
  tipo: z.enum(USER_ACTIVITY_TYPES),
  cuerpo: z.string().trim().min(1),
});
export const taskCreateSchema = z.object({
  titulo: z.string().trim().min(1),
  vence: z.string().datetime().optional(),
});
export const taskUpdateSchema = z.object({ hecha: z.boolean() });

export type PipelineCreate = z.infer<typeof pipelineCreateSchema>;
export type PipelineUpdate = z.infer<typeof pipelineUpdateSchema>;
export type ActivityCreate = z.infer<typeof activityCreateSchema>;
export type TaskCreate = z.infer<typeof taskCreateSchema>;
```

- [ ] **Step 3: Reexportar en `packages/core/src/index.ts`**

Agregar: `export * from './stages.js';` y `export * from './crm.js';`

- [ ] **Step 4: Build**

Run: `pnpm --filter @leadhub/core build`
Expected: tsc limpio.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): constantes de etapas/actividad + Zod del CRM"
```

---

### Task 3: API — rutas de pipeline (board + CRUD + auto-actividad)

**Files:**
- Create: `apps/api/src/pipeline/routes.ts`
- Modify: `apps/api/src/app.ts` (registrar `pipelineRoutes`)

**Interfaces:**
- Consumes: `pipelineCreateSchema`, `pipelineUpdateSchema`, `stageLabel` (core); `pipelineLeads`, `activities`, `tasks`, `leads`, `accounts` (schema); `requireAuth`.
- Produces: `GET /pipeline`, `POST /pipeline`, `PATCH /pipeline/:id`, `DELETE /pipeline/:id`, `GET /pipeline/:id`; `pipelineRoutes(app, db)`.

- [ ] **Step 1: Implementar `apps/api/src/pipeline/routes.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { pipelineCreateSchema, pipelineUpdateSchema, stageLabel } from '@leadhub/core';
import { pipelineLeads, activities, tasks, leads, accounts } from '../db/schema.js';
import { requireAuth } from '../auth/require-auth.js';

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
    const [exists] = await db.select({ id: pipelineLeads.id }).from(pipelineLeads).where(eq(pipelineLeads.leadId, leadId)).limit(1);
    if (exists) return reply.code(409).send({ ok: false, error: 'El lead ya está en el pipeline' });
    const [row] = await db.insert(pipelineLeads).values({ leadId, ownerId: ownerId ?? null }).returning();
    return { ok: true, data: row };
  });

  app.patch('/pipeline/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
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

  app.delete('/pipeline/:id', { preHandler: [requireAuth] }, async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(pipelineLeads).where(eq(pipelineLeads.id, id));
    return { ok: true, data: { id } };
  });

  app.get('/pipeline/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const [pl] = await db.select().from(pipelineLeads).where(eq(pipelineLeads.id, id)).limit(1);
    if (!pl) return reply.code(404).send({ ok: false, error: 'No encontrado' });
    const [lead] = await db.select().from(leads).where(eq(leads.id, pl.leadId)).limit(1);
    const acts = await db.select().from(activities).where(eq(activities.pipelineLeadId, id)).orderBy(desc(activities.createdAt));
    const tks = await db.select().from(tasks).where(eq(tasks.pipelineLeadId, id)).orderBy(desc(tasks.createdAt));
    return { ok: true, data: { pipeline: pl, lead, activities: acts, tasks: tks } };
  });
}
```

- [ ] **Step 2: Registrar en `apps/api/src/app.ts`**

Importar `import { pipelineRoutes } from './pipeline/routes.js';` y agregar dentro de `app.after(() => { ... })`: `pipelineRoutes(app, db);`

- [ ] **Step 3: Build**

Run: `pnpm --filter @leadhub/core build && pnpm --filter @leadhub/api build`
Expected: tsc limpio.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/pipeline/routes.ts apps/api/src/app.ts
git commit -m "feat(api): rutas de pipeline (board, add, move con auto-actividad, detalle, delete)"
```

---

### Task 4: API — rutas de actividades y tareas

**Files:**
- Create: `apps/api/src/pipeline/activity-task-routes.ts`
- Modify: `apps/api/src/app.ts` (registrar)

**Interfaces:**
- Consumes: `activityCreateSchema`, `taskCreateSchema`, `taskUpdateSchema` (core); `activities`, `tasks`, `pipelineLeads`, `leads` (schema); `requireAuth`.
- Produces: `POST /pipeline/:id/activities`, `POST /pipeline/:id/tasks`, `PATCH /tasks/:taskId`, `GET /tasks`.

- [ ] **Step 1: Implementar `apps/api/src/pipeline/activity-task-routes.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { activityCreateSchema, taskCreateSchema, taskUpdateSchema } from '@leadhub/core';
import { activities, tasks, pipelineLeads, leads } from '../db/schema.js';
import { requireAuth } from '../auth/require-auth.js';

export function activityTaskRoutes(app: FastifyInstance, db: NodePgDatabase) {
  app.post('/pipeline/:id/activities', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = activityCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Datos inválidos' });
    const accountId = (req.user as { sub: string }).sub;
    const [row] = await db.insert(activities)
      .values({ pipelineLeadId: id, accountId, tipo: parsed.data.tipo, cuerpo: parsed.data.cuerpo }).returning();
    return { ok: true, data: row };
  });

  app.post('/pipeline/:id/tasks', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
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
      .orderBy(desc(tasks.vence));
    return { ok: true, data: rows };
  });
}
```
Nota: `orderBy(desc(tasks.vence))` pone las de vencimiento más lejano primero; en la UI se resaltan las vencidas — el orden fino se puede ajustar después (fuera de alcance).

- [ ] **Step 2: Registrar en `apps/api/src/app.ts`**

Importar y agregar dentro de `app.after`: `activityTaskRoutes(app, db);`

- [ ] **Step 3: Build**

Run: `pnpm --filter @leadhub/api build`
Expected: tsc limpio.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/pipeline/activity-task-routes.ts apps/api/src/app.ts
git commit -m "feat(api): rutas de actividades y tareas del pipeline"
```

---

### Task 5: Web — cliente API + nav + botón "→ Pipeline" en Explorar

**Files:**
- Modify: `apps/web/src/api.ts` (tipos + funciones CRM)
- Modify: `apps/web/src/components/Nav.tsx` (pestañas Pipeline y Tareas)
- Modify: `apps/web/src/main.tsx` (rutas `/pipeline` y `/tareas` protegidas, con placeholders)
- Modify: `apps/web/src/components/LeadsTable.tsx` (botón "→ Pipeline")
- Create: `apps/web/src/pages/Pipeline.tsx` (placeholder), `apps/web/src/pages/Tareas.tsx` (placeholder)

**Interfaces:**
- Produces: tipos `PipelineCard`, `PipelineDetail`, `Activity`, `Task`, `PendingTask`; funciones `getPipeline`, `addToPipeline`, `updatePipeline`, `removeFromPipeline`, `getPipelineDetail`, `addActivity`, `addTask`, `toggleTask`, `getPendingTasks`.

- [ ] **Step 1: Agregar tipos + funciones en `apps/web/src/api.ts`**

```typescript
export interface PipelineCard {
  id: string; stage: string; ownerId: string | null; ownerNombre: string | null;
  leadId: string; nombre: string; categoria: string; localidad: string; telefono: string; email: string;
  pendientes: number;
}
export interface Activity { id: string; tipo: string; cuerpo: string; createdAt: string; }
export interface Task { id: string; titulo: string; vence: string | null; hecha: boolean; completedAt: string | null; }
export interface PipelineDetail { pipeline: { id: string; stage: string; ownerId: string | null }; lead: Lead; activities: Activity[]; tasks: Task[]; }
export interface PendingTask { id: string; titulo: string; vence: string | null; hecha: boolean; pipelineLeadId: string; leadNombre: string; }

export const getPipeline = () => req<PipelineCard[]>('/pipeline');
export const addToPipeline = (leadId: string) => req<{ id: string }>('/pipeline', { method: 'POST', body: JSON.stringify({ leadId }) });
export const updatePipeline = (id: string, body: { stage?: string; ownerId?: string | null }) => req<PipelineCard>(`/pipeline/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const removeFromPipeline = (id: string) => req<{ id: string }>(`/pipeline/${id}`, { method: 'DELETE' });
export const getPipelineDetail = (id: string) => req<PipelineDetail>(`/pipeline/${id}`);
export const addActivity = (id: string, body: { tipo: string; cuerpo: string }) => req<Activity>(`/pipeline/${id}/activities`, { method: 'POST', body: JSON.stringify(body) });
export const addTask = (id: string, body: { titulo: string; vence?: string }) => req<Task>(`/pipeline/${id}/tasks`, { method: 'POST', body: JSON.stringify(body) });
export const toggleTask = (taskId: string, hecha: boolean) => req<Task>(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ hecha }) });
export const getPendingTasks = () => req<PendingTask[]>('/tasks');
```

- [ ] **Step 2: Nav — pestañas Pipeline y Tareas**

En `apps/web/src/components/Nav.tsx`, agregar tras el link de Buscar:
```tsx
      <NavLink to="/pipeline" className={cls}>Pipeline</NavLink>
      <NavLink to="/tareas" className={cls}>Tareas</NavLink>
```

- [ ] **Step 3: Rutas protegidas + placeholders en `main.tsx`**

Crear `apps/web/src/pages/Pipeline.tsx` y `apps/web/src/pages/Tareas.tsx` como placeholders:
```tsx
export default function Pipeline() { return <div className="p-6">Pipeline (en construcción)</div>; }
```
```tsx
export default function Tareas() { return <div className="p-6">Tareas (en construcción)</div>; }
```
En `main.tsx`, agregar dos rutas protegidas (mismo patrón `RequireAuth` + `<Nav/>` arriba que Explorer/Buscar): `/pipeline` → `<Pipeline/>`, `/tareas` → `<Tareas/>`.

- [ ] **Step 4: Botón "→ Pipeline" en `LeadsTable.tsx`**

`LeadsTable` recibe una prop nueva `pipelineLeadIds: Set<string>` y `onAdd: (leadId: string) => void`. Por fila, agregar una celda:
```tsx
{pipelineLeadIds.has(lead.id)
  ? <span className="text-green-600 text-sm">✓ en pipeline</span>
  : <button onClick={() => onAdd(lead.id)} className="text-sm underline">→ Pipeline</button>}
```
En `Explorer.tsx`, agregar `const pipeline = useQuery({ queryKey:['pipeline'], queryFn: getPipeline });` y `const add = useMutation({ mutationFn: addToPipeline, onSuccess: () => qc.invalidateQueries({ queryKey:['pipeline'] }) });`, derivar `const ids = new Set((pipeline.data ?? []).map(p => p.leadId));`, y pasar `pipelineLeadIds={ids}` + `onAdd={(id)=>add.mutate(id)}` a `<LeadsTable/>`. (Importar `useMutation`, `useQueryClient`, `getPipeline`, `addToPipeline`.)

- [ ] **Step 5: Build**

Run: `pnpm --filter @leadhub/web build`
Expected: tsc + vite limpio; en dev, Explorar muestra "→ Pipeline" por fila y las pestañas Pipeline/Tareas cargan los placeholders.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): cliente CRM, pestañas Pipeline/Tareas, botón → Pipeline en Explorar"
```

---

### Task 6: Web — tablero Kanban con @dnd-kit

**Files:**
- Modify: `apps/web/package.json` (deps `@dnd-kit/core`, `@dnd-kit/sortable`)
- Create: `apps/web/src/components/KanbanBoard.tsx`, `apps/web/src/components/KanbanCard.tsx`
- Modify: `apps/web/src/pages/Pipeline.tsx` (usar el board)

**Interfaces:**
- Consumes: `getPipeline`, `updatePipeline`, `PipelineCard` (Task 5); `STAGES` (core).
- Produces: `Pipeline` page con Kanban drag&drop; cada tarjeta expone `onOpen(pipelineId)` (usado en Task 7).

- [ ] **Step 1: Instalar deps**

Run: `pnpm --filter @leadhub/web add @dnd-kit/core @dnd-kit/sortable`

- [ ] **Step 2: `KanbanCard.tsx`**

```tsx
import { useDraggable } from '@dnd-kit/core';
import type { PipelineCard } from '../api.js';

export default function KanbanCard({ card, onOpen }: { card: PipelineCard; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={() => onOpen(card.id)}
      className={`border rounded bg-white p-2 mb-2 cursor-grab shadow-sm ${isDragging ? 'opacity-50' : ''}`}>
      <div className="font-medium text-sm">{card.nombre}</div>
      <div className="text-xs text-gray-500">{card.categoria} · {card.localidad}</div>
      <div className="flex justify-between items-center mt-1 text-xs">
        <span className="text-gray-400">{card.ownerNombre ?? 'sin dueño'}</span>
        {card.pendientes > 0 && <span className="bg-amber-100 text-amber-700 px-1.5 rounded">{card.pendientes} tareas</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `KanbanBoard.tsx` (columnas droppables + drag optimista)**

```tsx
import { DndContext, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STAGES } from '@leadhub/core';
import { getPipeline, updatePipeline, type PipelineCard } from '../api.js';
import KanbanCard from './KanbanCard.js';

function Column({ stageId, label, cards, onOpen }: { stageId: string; label: string; cards: PipelineCard[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  return (
    <div ref={setNodeRef} className={`w-64 shrink-0 rounded p-2 ${isOver ? 'bg-blue-50' : 'bg-gray-50'}`}>
      <div className="font-semibold text-sm mb-2 flex justify-between"><span>{label}</span><span className="text-gray-400">{cards.length}</span></div>
      {cards.map((c) => <KanbanCard key={c.id} card={c} onOpen={onOpen} />)}
    </div>
  );
}

export default function KanbanBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const pipeline = useQuery({ queryKey: ['pipeline'], queryFn: getPipeline });
  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => updatePipeline(id, { stage }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: ['pipeline'] });
      const prev = qc.getQueryData<PipelineCard[]>(['pipeline']);
      qc.setQueryData<PipelineCard[]>(['pipeline'], (old) => (old ?? []).map((c) => (c.id === id ? { ...c, stage } : c)));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['pipeline'], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['pipeline'] }),
  });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const cards = pipeline.data ?? [];
  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const stage = e.over ? String(e.over.id) : null;
    if (!stage) return;
    const card = cards.find((c) => c.id === id);
    if (card && card.stage !== stage) move.mutate({ id, stage });
  }
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto p-4">
        {STAGES.map((s) => (
          <Column key={s.id} stageId={s.id} label={s.label} cards={cards.filter((c) => c.stage === s.id)} onOpen={onOpen} />
        ))}
      </div>
    </DndContext>
  );
}
```
Nota: la `activationConstraint: { distance: 5 }` deja que el click (abrir detalle) y el drag coexistan.

- [ ] **Step 4: `Pipeline.tsx`**

```tsx
import { useState } from 'react';
import KanbanBoard from '../components/KanbanBoard.js';
// El drawer de detalle se agrega en la Task 7; por ahora onOpen solo guarda el id seleccionado.
export default function Pipeline() {
  const [, setSelected] = useState<string | null>(null);
  return (
    <div>
      <h1 className="text-xl font-bold px-4 pt-4">Pipeline</h1>
      <KanbanBoard onOpen={setSelected} />
    </div>
  );
}
```

- [ ] **Step 5: Build**

Run: `pnpm --filter @leadhub/web build`
Expected: compila; en dev el tablero muestra columnas por etapa y se pueden arrastrar tarjetas entre columnas (la etapa persiste vía PATCH).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/src pnpm-lock.yaml
git commit -m "feat(web): tablero Kanban con @dnd-kit (drag&drop optimista de etapa)"
```

---

### Task 7: Web — drawer de detalle (timeline + actividades + tareas)

**Files:**
- Create: `apps/web/src/components/LeadDrawer.tsx`
- Modify: `apps/web/src/pages/Pipeline.tsx` (abrir el drawer al seleccionar)

**Interfaces:**
- Consumes: `getPipelineDetail`, `addActivity`, `addTask`, `toggleTask`, `updatePipeline`, `removeFromPipeline` (Task 5); `STAGES`, `USER_ACTIVITY_TYPES` (core).
- Produces: `LeadDrawer({ pipelineId, onClose })`.

- [ ] **Step 1: `LeadDrawer.tsx`**

```tsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STAGES, USER_ACTIVITY_TYPES } from '@leadhub/core';
import { getPipelineDetail, addActivity, addTask, toggleTask, updatePipeline, removeFromPipeline } from '../api.js';

export default function LeadDrawer({ pipelineId, onClose }: { pipelineId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ['pipeline', pipelineId], queryFn: () => getPipelineDetail(pipelineId) });
  const inval = () => { qc.invalidateQueries({ queryKey: ['pipeline', pipelineId] }); qc.invalidateQueries({ queryKey: ['pipeline'] }); };
  const [tipo, setTipo] = useState('nota');
  const [cuerpo, setCuerpo] = useState('');
  const [titulo, setTitulo] = useState('');
  const [vence, setVence] = useState('');
  const actMut = useMutation({ mutationFn: () => addActivity(pipelineId, { tipo, cuerpo }), onSuccess: () => { setCuerpo(''); inval(); } });
  const taskMut = useMutation({ mutationFn: () => addTask(pipelineId, { titulo, vence: vence || undefined }), onSuccess: () => { setTitulo(''); setVence(''); inval(); } });
  const toggleMut = useMutation({ mutationFn: (t: { id: string; hecha: boolean }) => toggleTask(t.id, t.hecha), onSuccess: inval });
  const stageMut = useMutation({ mutationFn: (stage: string) => updatePipeline(pipelineId, { stage }), onSuccess: inval });
  const delMut = useMutation({ mutationFn: () => removeFromPipeline(pipelineId), onSuccess: () => { onClose(); qc.invalidateQueries({ queryKey: ['pipeline'] }); } });

  const d = detail.data;
  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={onClose}>
      <div className="w-[28rem] bg-white h-full overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        {!d ? <p>Cargando…</p> : (
          <>
            <div className="flex justify-between items-start">
              <div><h2 className="font-bold text-lg">{d.lead.nombreFantasia}</h2>
                <p className="text-sm text-gray-500">{d.lead.categoria} · {d.lead.localidad}</p>
                <p className="text-sm">{d.lead.telefono} · {d.lead.email}</p></div>
              <button onClick={onClose} className="text-gray-400">✕</button>
            </div>
            <div className="my-3">
              <label className="text-sm mr-2">Etapa</label>
              <select value={d.pipeline.stage} onChange={(e) => stageMut.mutate(e.target.value)} className="border p-1 text-sm">
                {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <button onClick={() => delMut.mutate()} className="ml-3 text-sm text-red-600 underline">Sacar del pipeline</button>
            </div>

            <h3 className="font-semibold mt-4">Tareas</h3>
            <div className="flex gap-1 my-2">
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nueva tarea" className="border p-1 text-sm flex-1" />
              <input type="datetime-local" value={vence} onChange={(e) => setVence(e.target.value)} className="border p-1 text-sm" />
              <button disabled={!titulo} onClick={() => taskMut.mutate()} className="bg-black text-white px-2 rounded text-sm">+</button>
            </div>
            <ul className="text-sm">
              {d.tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={t.hecha} onChange={(e) => toggleMut.mutate({ id: t.id, hecha: e.target.checked })} />
                  <span className={t.hecha ? 'line-through text-gray-400' : ''}>{t.titulo}</span>
                  {t.vence && <span className="text-gray-400 text-xs">{new Date(t.vence).toLocaleDateString()}</span>}
                </li>
              ))}
            </ul>

            <h3 className="font-semibold mt-4">Actividad</h3>
            <div className="flex gap-1 my-2">
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="border p-1 text-sm">
                {USER_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} placeholder="Registrar…" className="border p-1 text-sm flex-1" />
              <button disabled={!cuerpo} onClick={() => actMut.mutate()} className="bg-black text-white px-2 rounded text-sm">+</button>
            </div>
            <ul className="text-sm space-y-1">
              {d.activities.map((a) => (
                <li key={a.id} className="border-l-2 pl-2">
                  <span className="text-xs uppercase text-gray-400">{a.tipo}</span> {a.cuerpo}
                  <div className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Abrir el drawer en `Pipeline.tsx`**

```tsx
import { useState } from 'react';
import KanbanBoard from '../components/KanbanBoard.js';
import LeadDrawer from '../components/LeadDrawer.js';

export default function Pipeline() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div>
      <h1 className="text-xl font-bold px-4 pt-4">Pipeline</h1>
      <KanbanBoard onOpen={setSelected} />
      {selected && <LeadDrawer pipelineId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `pnpm --filter @leadhub/web build`
Expected: compila; en dev, clickear una tarjeta abre el drawer con timeline, se puede registrar actividad, crear/completar tareas, cambiar etapa y sacar del pipeline.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): drawer de detalle (timeline de actividades + tareas + etapa)"
```

---

### Task 8: Web — vista Tareas

**Files:**
- Modify: `apps/web/src/pages/Tareas.tsx`

**Interfaces:**
- Consumes: `getPendingTasks`, `toggleTask` (Task 5).

- [ ] **Step 1: Implementar `apps/web/src/pages/Tareas.tsx`**

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPendingTasks, toggleTask } from '../api.js';

export default function Tareas() {
  const qc = useQueryClient();
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: getPendingTasks });
  const toggle = useMutation({
    mutationFn: (id: string) => toggleTask(id, true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
  const now = Date.now();
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-4">Tareas pendientes</h1>
      <ul className="space-y-2">
        {(tasks.data ?? []).map((t) => {
          const vencida = t.vence != null && new Date(t.vence).getTime() < now;
          return (
            <li key={t.id} className="flex items-center gap-3 border rounded p-2">
              <input type="checkbox" onChange={() => toggle.mutate(t.id)} />
              <div className="flex-1">
                <div>{t.titulo}</div>
                <div className="text-xs text-gray-500">{t.leadNombre}</div>
              </div>
              {t.vence && <span className={`text-xs ${vencida ? 'text-red-600 font-medium' : 'text-gray-400'}`}>{new Date(t.vence).toLocaleDateString()}</span>}
            </li>
          );
        })}
        {tasks.data?.length === 0 && <li className="text-gray-400">Sin tareas pendientes 🎉</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @leadhub/web build`
Expected: compila; la pestaña Tareas lista las pendientes con vencidas resaltadas y check para completar.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Tareas.tsx
git commit -m "feat(web): vista Tareas (pendientes con vencidas resaltadas)"
```

---

### Task 9: README + smoke manual end-to-end

**Files:**
- Modify: `README.md` (sección "CRM / Pipeline")

**Interfaces:**
- Produces: doc + verificación manual.

- [ ] **Step 1: Documentar en `README.md`**

Agregar una sección "## CRM / Pipeline": qué es (tablero de outreach sobre los leads), cómo se usa (Explorar → "→ Pipeline"; Kanban con drag&drop; drawer con actividades/tareas; pestaña Tareas), y que las etapas son fijas y el pipeline es compartido por el equipo.

- [ ] **Step 2: Smoke manual real**

Con Postgres arriba, la API compilada+reiniciada (`PORT=4501`, cwd raíz) y la web (`VITE_API_PROXY_TARGET=http://localhost:4501`):
1. En Explorar, apretar "→ Pipeline" en un lead → aparece en la columna **Nuevo** del Pipeline.
2. Arrastrar la tarjeta a **Contactado** → persiste; abrir el drawer → el timeline muestra la actividad `etapa` "Nuevo → Contactado".
3. En el drawer, registrar una **nota** y una **llamada**; crear una **tarea con vencimiento**.
4. Ir a **Tareas** → la tarea aparece; marcarla hecha → desaparece.
5. Reintentar "→ Pipeline" sobre el mismo lead → no se duplica (409, la fila muestra "✓ en pipeline").
Registrar los resultados en el reporte.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: sección CRM / Pipeline + verificación"
```

---

## Self-Review

**Spec coverage:**
- 3 tablas (pipeline_leads/activities/tasks) → Task 1 ✓
- Etapas fijas + tipos de actividad + Zod → Task 2 ✓
- Board + add(409) + move con auto-actividad `etapa` + detalle + delete → Task 3 ✓
- Actividades + tareas + toggle + pendientes → Task 4 ✓
- Cliente web + nav + "→ Pipeline" en Explorar → Task 5 ✓
- Kanban drag&drop optimista → Task 6 ✓
- Drawer (timeline + composer + tareas + etapa + sacar) → Task 7 ✓
- Vista Tareas (vencidas resaltadas) → Task 8 ✓
- README + smoke → Task 9 ✓
- Sin tests (por decisión del usuario) → cada tarea verifica con build/typecheck; smoke en Task 9 ✓

**Placeholder scan:** los únicos placeholders son las páginas `Pipeline`/`Tareas` de Task 5, reemplazadas en Tasks 6-8 (explícito, con código real). Sin TBD/TODO.

**Type consistency:** `StageId`/`STAGES`/`stageLabel` (core) usados por api (auto-actividad) y web (columnas/selector); `pipelineCreate/Update/activityCreate/taskCreate/taskUpdate` Zod (core) consumidos por las rutas api; `PipelineCard`/`PipelineDetail`/`Activity`/`Task`/`PendingTask` (web) reflejan lo que devuelven `/pipeline`, `/pipeline/:id`, `/tasks`; `updatePipeline(id,{stage})` usado por el drag optimista y el selector del drawer; `pipeline_leads.lead_id` único garantiza el 409.
