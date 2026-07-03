# Integración catálogo ↔ CRM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estado del lead en el CRM con color en Explorar + agregar leads al pipeline en lote desde el filtro vigente + link intuitivo búsqueda→Explorar. Sin cambios de esquema.

**Architecture:** Nuevo `POST /pipeline/bulk` que reusa la cláusula WHERE de `/leads` (exportada como `leadWhere`) e inserta en `pipeline_leads` con `onConflictDoNothing`. La UI de Explorar suma un botón de bulk y colorea el estado CRM por etapa; Buscar linkea a Explorar prefiltrado.

**Tech Stack:** Fastify + Drizzle; React + TanStack Query + Tailwind (tokens Apple ya existentes); TypeScript ESM.

## Global Constraints

- **SIN tests automatizados** (política del proyecto). Verificación por build verde + smoke curl/visual. No agregar tests. No romper tests del monorepo.
- **Value-imports de `@leadhub/core` desde web SOLO por subpaths** (`/stages`, `/score`); el server usa el barrel.
- **Sin cambios de esquema / migración.**
- Colores de etapa por `style` inline con `stageColor(...)`, no clases dinámicas.
- Envelope `{ ok, data, error }`; rutas con `requireAuth`.
- Conservar TODA la lógica existente (queries, filtros en URL, drag optimista, mutaciones).
- Commits en español, formato convencional, usando EXACTAMENTE:
  `git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "..."`

## File Structure

- **Modificar** `apps/api/src/leads/query.ts` — exportar `leadWhere` (las condiciones de filtro).
- **Modificar** `apps/api/src/pipeline/routes.ts` — `POST /pipeline/bulk`.
- **Modificar** `apps/web/src/api.ts` — `bulkAddToPipeline(qs)`.
- **Modificar** `apps/web/src/pages/Explorer.tsx` — botón "Agregar N al pipeline" + feedback.
- **Modificar** `apps/web/src/components/LeadsTable.tsx` — estado CRM con color.
- **Modificar** `apps/web/src/components/JobsList.tsx` — "Ver en el explorador" prefiltrado por query.

---

### Task 1: API — `POST /pipeline/bulk`

**Files:**
- Modify: `apps/api/src/leads/query.ts`
- Modify: `apps/api/src/pipeline/routes.ts`
- Modify: `apps/web/src/api.ts`

**Interfaces:**
- Produces: `leadWhere(f: LeadFilters)` exportada; `POST /pipeline/bulk` → `{ ok, data: { matched, added, skipped } }`; web `bulkAddToPipeline(qs): Promise<{ matched: number; added: number; skipped: number }>`.

- [ ] **Step 1: Exportar `leadWhere` en `apps/api/src/leads/query.ts`**

Renombrar la función privada `conditions` a `leadWhere` y exportarla; actualizar su uso en `buildLeadsQuery`.
- Cambiar `function conditions(f: LeadFilters) {` por `export function leadWhere(f: LeadFilters) {`.
- En `buildLeadsQuery`, cambiar `const where = conditions(f);` por `const where = leadWhere(f);`.

(No cambiar la lógica de las condiciones.)

- [ ] **Step 2: Ruta `POST /pipeline/bulk` en `apps/api/src/pipeline/routes.ts`**

Agregar los imports que falten al tope del archivo:
```ts
import { leadFiltersSchema } from '@leadhub/core';
import { leadWhere } from '../leads/query.js';
```
(`leads`, `pipelineLeads`, `sql` ya están importados; `leadFiltersSchema` viene del barrel — es server, OK.)

Dentro de `pipelineRoutes`, agregar el handler ANTES de `GET /pipeline/:id` (Fastify prioriza estáticas de todos modos):
```ts
  app.post('/pipeline/bulk', { preHandler: [requireAuth] }, async (req, reply) => {
    const parsed = leadFiltersSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Filtros inválidos' });
    const where = leadWhere(parsed.data);
    const matched = await db.select({ id: leads.id }).from(leads).where(where);
    if (matched.length === 0) return { ok: true, data: { matched: 0, added: 0, skipped: 0 } };
    const inserted = await db
      .insert(pipelineLeads)
      .values(matched.map((m) => ({ leadId: m.id })))
      .onConflictDoNothing({ target: pipelineLeads.leadId })
      .returning({ id: pipelineLeads.id });
    return { ok: true, data: { matched: matched.length, added: inserted.length, skipped: matched.length - inserted.length } };
  });
```

- [ ] **Step 3: Cliente en `apps/web/src/api.ts`**

Agregar (cerca de `addToPipeline`):
```ts
export const bulkAddToPipeline = (qs: string) =>
  req<{ matched: number; added: number; skipped: number }>(`/pipeline/bulk?${qs}`, { method: 'POST' });
```

- [ ] **Step 4: Build de api y web**

Run: `pnpm --filter @leadhub/api build && pnpm --filter @leadhub/web build`
Expected: ambos verdes.

- [ ] **Step 5: Smoke — bulk agrega e idempotencia**

Reiniciar la API (`pnpm --filter @leadhub/api build && (lsof -ti:4501 | xargs kill -9 2>/dev/null; PORT=4501 node apps/api/dist/server.js &) ; sleep 2`), luego:
```bash
B=http://localhost:4501
TOKEN=$(curl -s -X POST $B/auth/login -H 'content-type: application/json' -d '{"email":"demo@leadhub.com","password":"demo1234"}' | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).data.token))')
AUTH="authorization: Bearer $TOKEN"
echo "bulk con un filtro chico (ej. una localidad) — primera vez agrega, segunda todo skipped"
curl -s -X POST "$B/pipeline/bulk?localidad=Quilmes&pageSize=100" -H "$AUTH" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const x=JSON.parse(d).data;console.log("1ra:",JSON.stringify(x),"| matched==added+skipped:",x.matched===x.added+x.skipped)})'
curl -s -X POST "$B/pipeline/bulk?localidad=Quilmes&pageSize=100" -H "$AUTH" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const x=JSON.parse(d).data;console.log("2da:",JSON.stringify(x),"| added==0 (idempotente):",x.added===0)})'
```
Expected: 1ra con `added>0`, `matched==added+skipped: true`; 2da con `added==0` (idempotente, todos skipped).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/leads/query.ts apps/api/src/pipeline/routes.ts apps/web/src/api.ts
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(api): POST /pipeline/bulk (agregar leads filtrados al pipeline, idempotente)"
```

---

### Task 2: web Explorar — bulk add + estado con color

**Files:**
- Modify: `apps/web/src/pages/Explorer.tsx`
- Modify: `apps/web/src/components/LeadsTable.tsx`

**Interfaces:**
- Consumes: `bulkAddToPipeline` (Task 1); `stageColor`/`stageLabel` de `@leadhub/core/stages`.

**Contexto:** conservar TODA la lógica de Explorar (queries facets/leads/pipeline, mutación addToPipeline, `pipelineByLead`, filtros en URL) y de LeadsTable (props, ScoreBadge, tooltip). Solo se agrega el botón bulk y se colorea el estado.

- [ ] **Step 1: Botón bulk + feedback en `Explorer.tsx`**

Ampliar el import de `../api.js` para incluir `bulkAddToPipeline`:
```ts
import { getFacets, getLeads, downloadCsv, getPipeline, addToPipeline, bulkAddToPipeline } from '../api.js';
```
Agregar la mutación (junto a `add`):
```tsx
  const bulk = useMutation({
    mutationFn: () => bulkAddToPipeline(qs),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipeline'] }); qc.invalidateQueries({ queryKey: ['pipeline-stats'] }); },
  });
```
En el cluster de acciones del header (el `<div className="flex gap-2 items-center">` que tiene el `<select>` y "Exportar CSV"), agregar el botón bulk y el feedback, ANTES o DESPUÉS del botón de exportar:
```tsx
            <button
              onClick={() => bulk.mutate()}
              disabled={bulk.isPending || !(leads.data?.total)}
              className="btn-ghost"
            >
              {bulk.isPending ? 'Agregando…' : `→ Agregar ${leads.data?.total ?? 0} al pipeline`}
            </button>
```
Y debajo del header (o al lado), mostrar el resultado cuando exista:
```tsx
        {bulk.data && (
          <p className="text-[13px] text-muted mb-3">{bulk.data.added} agregados · {bulk.data.skipped} ya estaban</p>
        )}
```
(Ubicá el `<p>` dentro del `<main>`, después del `<div>` del header y antes de la tabla.)

- [ ] **Step 2: Estado CRM con color en `LeadsTable.tsx`**

Ampliar el import de stages para incluir `stageColor` (y sacar `CLOSED_STAGES` si queda sin uso):
```ts
import { stageColor, stageLabel } from '@leadhub/core/stages';
```
Reemplazar la celda de Pipeline (el bloque IIFE `{(() => { const stage = ... })()}`) por:
```tsx
              <td className="p-2">
                {(() => {
                  const stage = pipelineByLead.get(lead.id);
                  if (stage === undefined) return <button onClick={() => onAdd(lead.id)} className="text-sm text-accent underline">→ Pipeline</button>;
                  return (
                    <span className="inline-flex items-center gap-1.5 text-sm text-ink">
                      <span className="w-2 h-2 rounded-pill shrink-0" style={{ backgroundColor: stageColor(stage) }} />
                      {stageLabel(stage)}
                    </span>
                  );
                })()}
              </td>
```
(Si `CLOSED_STAGES` queda sin usar tras el cambio, sacalo del import para no dejar import muerto.)

- [ ] **Step 3: Build de web**

Run: `pnpm --filter @leadhub/web build`
Expected: verde.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/Explorer.tsx apps/web/src/components/LeadsTable.tsx
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(web): agregar al pipeline en lote y estado CRM con color en Explorar"
```

---

### Task 3: web Buscar — "Ver en el explorador" prefiltrado

**Files:**
- Modify: `apps/web/src/components/JobsList.tsx`

**Contexto:** conservar todo (estados de job, barra de progreso). Solo cambia el destino del link "Ver en el explorador" para que prefiltre Explorar por la query de la búsqueda.

- [ ] **Step 1: Link prefiltrado en `JobsList.tsx`**

Reemplazar el `<Link to="/" ...>Ver en el explorador</Link>` por uno que lleve la query del job como filtro `q`:
```tsx
          {j.status === 'done' && <Link to={`/?q=${encodeURIComponent(j.query)}`} className="btn-ghost mt-3 inline-flex px-4 py-1.5 text-[13px]">Ver en el explorador</Link>}
```

- [ ] **Step 2: Build de web**

Run: `pnpm --filter @leadhub/web build`
Expected: verde.

- [ ] **Step 3: Smoke visual (lo corre el controlador):** levantar web + API, entrar con demo. Verificar: en Explorar cada lead en pipeline muestra `● etapa` con color (ganado verde, perdido rojo, etc.) y los sin pipeline "→ Pipeline"; el botón "→ Agregar N al pipeline" agrega el filtro vigente y la columna de estado se colorea sola; en Buscar, "Ver en el explorador" de un job lleva a Explorar con la query prefiltrada. Chequear claro y oscuro.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/JobsList.tsx
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(web): 'Ver en el explorador' prefiltra por la query de la búsqueda"
```

---

## Notas de verificación final (para el review de rama)

- `POST /pipeline/bulk` agrega los leads del filtro (idempotente, `matched==added+skipped`); reusa `leadWhere` (DRY, sin duplicar condiciones).
- En Explorar el estado CRM se ve con color por etapa; el botón bulk opera sobre el filtro vigente e invalida pipeline + stats.
- "Ver en el explorador" prefiltra por la query del job.
- Value-imports de core en web solo por subpaths; el server usa el barrel.
- Drag optimista, filtros en URL, export CSV y flujos existentes intactos.
- Los tres paquetes compilan; tests del monorepo verdes.
