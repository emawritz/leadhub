# CRM Robustez (Fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los 7 hallazgos de robustez/correctitud diferidos del review del CRM, sin cambios de esquema.

**Architecture:** Cambios acotados en `apps/api/src/pipeline/` (validación de UUID, DELETE 404, insert atómico), en el cliente web (`apps/web/src`: tipos + key + marcado de cerrados) y en `packages/core/package.json` (exports condicionales). No hay migraciones ni tablas nuevas.

**Tech Stack:** Fastify + Zod + Drizzle (node-postgres) en API; React 18 + TanStack Query + Tailwind en web; TypeScript ESM (NodeNext, imports con `.js`).

## Global Constraints

- **Sin tests automatizados del CRM** (decisión del proyecto). Verificación por **typecheck/build verde** + **smoke manual con curl**. No agregar archivos de test para este trabajo. No romper los tests existentes del monorepo (core/scraper/ingest).
- Envelope de API uniforme: `{ ok: true, data }` en éxito, `{ ok: false, error }` en error. Toda ruta con `requireAuth`.
- **Value-imports de `@leadhub/core` desde web DEBEN usar el subpath `@leadhub/core/stages`** (el barrel raíz arrastra `csv.ts`/`json.ts` que usan Node y rompen el build de Vite).
- API corre en **puerto 4501**; el dev server de web proxea `/api` a `http://localhost:4501`. Usuario demo: `demo@leadhub.com` / `demo1234`. Postgres en `localhost:5544`.
- Commits en español con formato convencional, usando exactamente:
  `git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "..."`
- No cambiar rutas resueltas por los `exports` de core; solo su forma (agregar keys condicionales).

## File Structure

- **Crear** `apps/api/src/pipeline/params.ts` — helper puro de validación de UUID de params.
- **Modificar** `apps/api/src/pipeline/routes.ts` — guard de UUID en rutas `:id`; DELETE con 404; POST con insert atómico → 409.
- **Modificar** `apps/api/src/pipeline/activity-task-routes.ts` — guard de UUID en rutas `:id`/`:taskId`.
- **Modificar** `packages/core/package.json` — `exports` con keys condicionales `{ types, import }`.
- **Modificar** `apps/web/src/api.ts` — tipo de retorno fiel de `updatePipeline`.
- **Modificar** `apps/web/src/components/LeadsTable.tsx` — key = `lead.id`; marcado de leads en etapa cerrada.
- **Modificar** `apps/web/src/pages/Explorer.tsx` — derivar mapa `leadId → stage` y pasarlo a la tabla.
- **Modificar** `README.md` — alinear la descripción de leads `ganado`/`perdido` en Explorar con la implementación real.

---

### Task 1: Validación de UUID en params

**Files:**
- Create: `apps/api/src/pipeline/params.ts`
- Modify: `apps/api/src/pipeline/routes.ts` (rutas `:id`)
- Modify: `apps/api/src/pipeline/activity-task-routes.ts` (rutas `:id` / `:taskId`)

**Interfaces:**
- Produces: `isUuid(value: string): boolean` — `true` si `value` es un UUID válido según Zod.

**Contexto:** hoy un `:id` malformado llega a Postgres y tira `500` (`invalid input syntax for type uuid`). Con un guard temprano devolvemos `400` con el envelope estándar. Se sigue el patrón existente (validación manual en el handler, no schema de ruta de Fastify).

- [ ] **Step 1: Crear el helper**

Crear `apps/api/src/pipeline/params.ts`:

```ts
import { z } from 'zod';

const uuidSchema = z.string().uuid();

/** Devuelve true si `value` es un UUID válido. */
export function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}
```

- [ ] **Step 2: Aplicar el guard en `routes.ts`**

En `apps/api/src/pipeline/routes.ts`, agregar el import (junto a los otros imports de arriba):

```ts
import { isUuid } from './params.js';
```

Y en cada handler que lee `:id` (`PATCH /pipeline/:id`, `DELETE /pipeline/:id`, `GET /pipeline/:id`), inmediatamente después de `const { id } = req.params as { id: string };`, agregar:

```ts
    if (!isUuid(id)) return reply.code(400).send({ ok: false, error: 'id inválido' });
```

Nota: `DELETE /pipeline/:id` hoy tiene firma `async (req) => {...}` sin `reply`. Cambiarla a `async (req, reply) => {...}` para poder responder 400 (la corrección del 404 va en Task 2, pero la firma con `reply` ya se necesita acá).

- [ ] **Step 3: Aplicar el guard en `activity-task-routes.ts`**

En `apps/api/src/pipeline/activity-task-routes.ts`, agregar el import:

```ts
import { isUuid } from './params.js';
```

En `POST /pipeline/:id/activities` y `POST /pipeline/:id/tasks`, tras `const { id } = req.params as { id: string };`:

```ts
    if (!isUuid(id)) return reply.code(400).send({ ok: false, error: 'id inválido' });
```

En `PATCH /tasks/:taskId`, tras `const { taskId } = req.params as { taskId: string };`:

```ts
    if (!isUuid(taskId)) return reply.code(400).send({ ok: false, error: 'id inválido' });
```

- [ ] **Step 4: Build de la API (typecheck)**

Run: `pnpm --filter @leadhub/api build`
Expected: termina sin errores de TypeScript.

- [ ] **Step 5: Smoke — UUID inválido devuelve 400 (no 500)**

Con la API compilada corriendo en :4501 (si no está: `pnpm --filter @leadhub/api build && (lsof -ti:4501 | xargs kill -9 2>/dev/null; PORT=4501 node apps/api/dist/server.js &) ; sleep 2`), obtener token y probar:

```bash
B=http://localhost:4501
TOKEN=$(curl -s -X POST $B/auth/login -H 'content-type: application/json' -d '{"email":"demo@leadhub.com","password":"demo1234"}' | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).data.token))')
curl -s -o /dev/null -w "GET  /pipeline/no-uuid -> %{http_code}\n" "$B/pipeline/no-uuid" -H "authorization: Bearer $TOKEN"
curl -s -o /dev/null -w "PATCH /tasks/no-uuid -> %{http_code}\n" -X PATCH "$B/tasks/no-uuid" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"hecha":true}'
```
Expected: ambas líneas terminan en `-> 400`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/pipeline/params.ts apps/api/src/pipeline/routes.ts apps/api/src/pipeline/activity-task-routes.ts
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "fix(api): validar UUID de params en rutas del pipeline (400 en vez de 500)"
```

---

### Task 2: DELETE 404 + POST atómico (409 sin 500)

**Files:**
- Modify: `apps/api/src/pipeline/routes.ts`

**Interfaces:**
- Consumes: `isUuid` (Task 1) — ya importado y el guard de UUID ya presente en `DELETE /pipeline/:id`.
- Produces: sin cambios de firma pública; solo semántica de status codes.

**Contexto:**
- `DELETE /pipeline/:id` hoy responde `200` aunque el id no exista. Debe responder `404` cuando no borra nada.
- `POST /pipeline` hace `select exists` y luego `insert`: dos requests concurrentes del mismo `leadId` pasan ambos el select y el segundo viola `unique(lead_id)` → `500`. Se reemplaza por un insert atómico con `onConflictDoNothing`.

- [ ] **Step 1: DELETE con 404**

En `apps/api/src/pipeline/routes.ts`, reemplazar el cuerpo del handler `DELETE /pipeline/:id`. Debe quedar (el guard de UUID de Task 1 se conserva):

```ts
  app.delete('/pipeline/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ ok: false, error: 'id inválido' });
    const [row] = await db.delete(pipelineLeads).where(eq(pipelineLeads.id, id)).returning({ id: pipelineLeads.id });
    if (!row) return reply.code(404).send({ ok: false, error: 'No encontrado' });
    return { ok: true, data: { id } };
  });
```

- [ ] **Step 2: POST atómico con 409**

En el handler `POST /pipeline`, reemplazar el bloque que hace `select exists` + `insert` (desde `const { leadId, ownerId } = parsed.data;` hasta el `return { ok: true, data: row };`) por:

```ts
    const { leadId, ownerId } = parsed.data;
    const [row] = await db
      .insert(pipelineLeads)
      .values({ leadId, ownerId: ownerId ?? null })
      .onConflictDoNothing({ target: pipelineLeads.leadId })
      .returning();
    if (!row) return reply.code(409).send({ ok: false, error: 'El lead ya está en el pipeline' });
    return { ok: true, data: row };
```

- [ ] **Step 3: Build de la API (typecheck)**

Run: `pnpm --filter @leadhub/api build`
Expected: sin errores de TypeScript (confirma que `onConflictDoNothing` tipa bien con node-postgres).

- [ ] **Step 4: Smoke — DELETE inexistente → 404; doble POST → 200 + 409 (nunca 500)**

Reiniciar la API con el build nuevo (`lsof -ti:4501 | xargs kill -9 2>/dev/null; PORT=4501 node apps/api/dist/server.js & sleep 2`), luego:

```bash
B=http://localhost:4501
TOKEN=$(curl -s -X POST $B/auth/login -H 'content-type: application/json' -d '{"email":"demo@leadhub.com","password":"demo1234"}' | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).data.token))')
AUTH="authorization: Bearer $TOKEN"
# DELETE de un UUID válido pero inexistente -> 404
curl -s -o /dev/null -w "DELETE inexistente -> %{http_code}\n" -X DELETE "$B/pipeline/00000000-0000-4000-8000-000000000000" -H "$AUTH"
# Doble POST concurrente del mismo lead: uno 200/otro 409, ninguno 500
LEAD=$(curl -s "$B/leads?pageSize=1&page=7" -H "$AUTH" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).data.items[0].id))')
curl -s -o /dev/null -w "POST A -> %{http_code}\n" -X POST "$B/pipeline" -H "$AUTH" -H 'content-type: application/json' -d "{\"leadId\":\"$LEAD\"}" &
curl -s -o /dev/null -w "POST B -> %{http_code}\n" -X POST "$B/pipeline" -H "$AUTH" -H 'content-type: application/json' -d "{\"leadId\":\"$LEAD\"}" &
wait
```
Expected: `DELETE inexistente -> 404`; los dos POST imprimen `200` y `409` (en cualquier orden), nunca `500`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/pipeline/routes.ts
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "fix(api): DELETE /pipeline/:id devuelve 404 y POST usa insert atómico (409)"
```

---

### Task 3: Exports condicionales en core

**Files:**
- Modify: `packages/core/package.json`

**Interfaces:**
- Produces: mismos entrypoints (`.` y `./stages`) resolviendo a los mismos `dist/*.js`, ahora con resolución de tipos explícita por subpath.

**Contexto:** `exports` usa strings planos, así que la resolución de `.d.ts` para `@leadhub/core/stages` depende de que el `.d.ts` quede colocado al lado del `.js`. Con keys condicionales `{ types, import }` la resolución es explícita y robusta ante distintos `moduleResolution`.

- [ ] **Step 1: Reescribir `exports`**

En `packages/core/package.json`, reemplazar la línea `"exports": { ".": "./dist/index.js", "./stages": "./dist/stages.js" },` por:

```json
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./stages": { "types": "./dist/stages.d.ts", "import": "./dist/stages.js" }
  },
```

Dejar el `"types": "./dist/index.d.ts"` de nivel superior tal cual (fallback inofensivo para resolvers viejos).

- [ ] **Step 2: Rebuild de core y verificación de consumidores**

Run:
```bash
pnpm --filter @leadhub/core build && pnpm --filter @leadhub/api build && pnpm --filter @leadhub/web build
```
Expected: los tres builds terminan sin errores. En particular el build de web (Vite + tsc) resuelve `@leadhub/core/stages` con sus tipos, confirmando que las keys condicionales no rompieron nada.

- [ ] **Step 3: Commit**

```bash
git add packages/core/package.json
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "chore(core): exports con keys condicionales (types/import) por subpath"
```

---

### Task 4: Web — tipo de `updatePipeline`, key de tabla y marcado de cerrados

**Files:**
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/components/LeadsTable.tsx`
- Modify: `apps/web/src/pages/Explorer.tsx`

**Interfaces:**
- Consumes: `CLOSED_STAGES` y `stageLabel` desde `@leadhub/core/stages` (subpath obligatorio).
- Produces:
  - `PipelineLeadRow` interface en `api.ts`; `updatePipeline(...) => Promise<PipelineLeadRow>`.
  - `LeadsTable` con prop `pipelineByLead: Map<string, string>` (leadId → stage) en lugar de `pipelineLeadIds: Set<string>`.

**Contexto:**
- `updatePipeline` declara retorno `PipelineCard`, pero `PATCH /pipeline/:id` hace `.returning()` sobre `pipeline_leads` y devuelve `{ id, leadId, ownerId, stage, createdAt, updatedAt }` (sin `nombre`/`categoria`/`pendientes`). Ningún caller usa el valor (ambos invalidan), pero el tipo debe ser fiel.
- `LeadsTable` usa `razonSocial-índice` como React key; `lead.id` ya está disponible y es estable.
- Los leads cuyo `pipeline_lead.stage ∈ {ganado, perdido}` se consideran **cerrados**: siguen visibles en Explorar, marcados como cerrados y **no re-agregables** (no se ocultan ni se borran del catálogo).

- [ ] **Step 1: Tipo fiel de `updatePipeline` en `api.ts`**

En `apps/web/src/api.ts`, agregar la interface (cerca de `PipelineCard`, después de su definición):

```ts
export interface PipelineLeadRow {
  id: string; leadId: string; ownerId: string | null; stage: string; createdAt: string; updatedAt: string;
}
```

Y cambiar la firma de `updatePipeline` de `req<PipelineCard>` a `req<PipelineLeadRow>`:

```ts
export const updatePipeline = (id: string, body: { stage?: string; ownerId?: string | null }) => req<PipelineLeadRow>(`/pipeline/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
```

- [ ] **Step 2: `LeadsTable` con key estable y marcado de cerrados**

En `apps/web/src/components/LeadsTable.tsx`:

Reemplazar el import y el tipo `Props`:

```tsx
import { CLOSED_STAGES, stageLabel } from '@leadhub/core/stages';
import type { LeadRow } from '../api.js';

type Props = { items: LeadRow[]; pipelineByLead: Map<string, string>; onAdd: (leadId: string) => void };

export default function LeadsTable({ items, pipelineByLead, onAdd }: Props) {
```

Reemplazar la key de la fila:

```tsx
            <tr key={lead.id} className="border-t">
```

Reemplazar la celda de Pipeline (el bloque `{pipelineLeadIds.has(lead.id) ? ... }`) por:

```tsx
              <td className="p-2">
                {(() => {
                  const stage = pipelineByLead.get(lead.id);
                  if (stage === undefined) return <button onClick={() => onAdd(lead.id)} className="text-sm underline">→ Pipeline</button>;
                  if ((CLOSED_STAGES as readonly string[]).includes(stage)) return <span className="text-gray-500 text-sm">✓ {stageLabel(stage)}</span>;
                  return <span className="text-green-600 text-sm">✓ en pipeline</span>;
                })()}
              </td>
```

- [ ] **Step 3: `Explorer` deriva el mapa leadId → stage**

En `apps/web/src/pages/Explorer.tsx`, reemplazar la línea que arma `ids`:

```tsx
  const ids = new Set((pipeline.data ?? []).map((p) => p.leadId));
```

por:

```tsx
  const pipelineByLead = new Map((pipeline.data ?? []).map((p) => [p.leadId, p.stage] as const));
```

Y actualizar el uso en el render:

```tsx
          <LeadsTable items={leads.data.items} pipelineByLead={pipelineByLead} onAdd={(id) => add.mutate(id)} />
```

- [ ] **Step 4: Build de web (typecheck + Vite)**

Run: `pnpm --filter @leadhub/web build`
Expected: sin errores de TypeScript ni de Vite. Confirma que `@leadhub/core/stages` exporta `CLOSED_STAGES` y `stageLabel`, y que el subpath no arrastra Node-only.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/api.ts apps/web/src/components/LeadsTable.tsx apps/web/src/pages/Explorer.tsx
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "fix(web): tipo fiel de updatePipeline, key por lead.id y marcado de leads cerrados en Explorar"
```

---

### Task 5: Smoke consolidado + README

**Files:**
- Modify: `README.md`

**Contexto:** cerrar la fase con un smoke end-to-end de los cambios de status y alinear el README con la implementación real de los leads cerrados (no dice "ya no aparecen en Explorar" sino que quedan marcados como cerrados y no re-agregables).

- [ ] **Step 1: Localizar y corregir el texto del README**

Buscar la afirmación sobre `ganado`/`perdido` en Explorar:

```bash
grep -n -iE "ganado|perdido|Explorar" README.md
```

Reemplazar la frase que afirma que los leads en `ganado`/`perdido` "ya no aparecen en Explorar" por una descripción fiel, por ejemplo:

> Los leads que ya están en el pipeline se muestran en Explorar como **✓ en pipeline**; los que llegaron a una etapa que cierra (**Ganado**/**Perdido**) se marcan como cerrados (**✓ Ganado** / **✓ Perdido**) y no se pueden volver a agregar. El lead sigue en el catálogo.

(Adaptar la redacción al estilo del README existente; el punto es que describa el marcado real, no el ocultamiento.)

- [ ] **Step 2: Smoke consolidado de los cambios de status**

Con la API compilada corriendo en :4501, correr:

```bash
B=http://localhost:4501
TOKEN=$(curl -s -X POST $B/auth/login -H 'content-type: application/json' -d '{"email":"demo@leadhub.com","password":"demo1234"}' | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).data.token))')
AUTH="authorization: Bearer $TOKEN"
echo "UUID inválido:"
curl -s -o /dev/null -w "  GET /pipeline/xx -> %{http_code} (esperado 400)\n" "$B/pipeline/xx" -H "$AUTH"
echo "DELETE inexistente:"
curl -s -o /dev/null -w "  -> %{http_code} (esperado 404)\n" -X DELETE "$B/pipeline/00000000-0000-4000-8000-000000000000" -H "$AUTH"
echo "Board sigue respondiendo:"
curl -s -o /dev/null -w "  GET /pipeline -> %{http_code} (esperado 200)\n" "$B/pipeline" -H "$AUTH"
```
Expected: `400`, `404`, `200` respectivamente.

- [ ] **Step 3: Commit**

```bash
git add README.md
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "docs: alinear README con el marcado de leads cerrados en Explorar"
```

---

## Notas de verificación final (para el review de rama)

- Ningún endpoint del CRM responde `500` por input malformado (UUID inválido → 400).
- `DELETE /pipeline/:id` → 404 si no existe; `POST /pipeline` concurrente → 200 + 409, nunca 500.
- Los tres paquetes compilan; los tests existentes del monorepo (core/scraper/ingest) siguen verdes.
- Web: `updatePipeline` tipado fiel, key por `lead.id`, leads cerrados marcados.
