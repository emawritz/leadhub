# CRM Features (Fase 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar 4 features al CRM — filtrar/buscar en el board, reasignar dueño, acción rápida de outreach (WhatsApp/email) y dashboard de embudo — sin cambios de esquema.

**Architecture:** Dos endpoints de lectura nuevos en la API (`GET /accounts`, `GET /pipeline/stats`). En web: barra de filtros del board con estado en la URL (client-side sobre el board ya cargado), selector de dueño en el drawer (usa el `PATCH /pipeline/:id { ownerId }` existente), botones de outreach en el drawer que abren `wa.me`/`mailto` prellenados y registran una actividad, y una página `/dashboard` con el embudo.

**Tech Stack:** Fastify + Drizzle (agregados); React 18 + Vite + TanStack Query + react-router (URL state) + Tailwind; TypeScript ESM.

## Global Constraints

- **SIN tests automatizados** (decisión del proyecto). Verificación por **build verde** + **smoke** (curl para la API, manual/visual para web). No agregar archivos de test. No romper los tests existentes del monorepo.
- **Value-imports de `@leadhub/core` desde web SOLO por `@leadhub/core/stages`** (el barrel raíz rompe Vite). En el server (api) el barrel `@leadhub/core` sí se puede usar (Node).
- Colores por etapa por `style` inline (hex de `stageColor`), no clases Tailwind dinámicas.
- Envelope `{ ok, data, error }`; todas las rutas con `requireAuth`; `accountId = (req.user as { sub: string }).sub`.
- **Sin cambios de esquema / migraciones.** Se opera sobre `accounts`, `pipeline_leads`, `activities`, `tasks`, `leads`.
- Estado de filtros del board en la **URL** (`?q=&owner=&vencidas=1`).
- El outreach **abre** la app externa (no envía); la actividad se registra al abrir (optimista).
- Commits en español, formato convencional, usando EXACTAMENTE:
  `git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "..."`

## File Structure

- **Crear** `apps/api/src/accounts/routes.ts` — `GET /accounts`.
- **Modificar** `apps/api/src/pipeline/routes.ts` — `GET /pipeline/stats` (antes de las rutas `:id`; Fastify prioriza estáticas, pero lo agregamos temprano por claridad).
- **Modificar** `apps/api/src/app.ts` — registrar `accountsRoutes`.
- **Modificar** `apps/web/src/api.ts` — clientes `getAccounts`, `getPipelineStats` + tipos `Account`, `PipelineStats`.
- **Crear** `apps/web/src/components/BoardFilters.tsx` — barra de búsqueda + filtros del board.
- **Modificar** `apps/web/src/pages/Pipeline.tsx` — estado de filtros en URL + barra + pasa filtro a `KanbanBoard`.
- **Modificar** `apps/web/src/components/KanbanBoard.tsx` — aplica el filtro a las tarjetas.
- **Modificar** `apps/web/src/components/LeadDrawer.tsx` — selector de dueño + botones de outreach.
- **Crear** `apps/web/src/pages/Dashboard.tsx` — embudo.
- **Modificar** `apps/web/src/main.tsx` — ruta `/dashboard`.
- **Modificar** `apps/web/src/components/Nav.tsx` — link `Dashboard`.

---

### Task 1: API `GET /accounts` + cliente web

**Files:**
- Create: `apps/api/src/accounts/routes.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/web/src/api.ts`

**Interfaces:**
- Produces (api): `GET /accounts` → `{ ok, data: Array<{ id: string; email: string; nombre: string | null }> }`.
- Produces (web): `interface Account { id: string; email: string; nombre: string | null }`; `getAccounts(): Promise<Account[]>`.

**Contexto:** para poblar los selectores de dueño (filtro del board y reasignación en el drawer) se necesita listar el equipo. Modelo de pipeline compartido: cualquier usuario autenticado ve la lista de cuentas (no es un leak entre tenants).

- [ ] **Step 1: Crear `accounts/routes.ts`**

```ts
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
```

- [ ] **Step 2: Registrar en `app.ts`**

En `apps/api/src/app.ts`, agregar el import junto a los otros:

```ts
import { accountsRoutes } from './accounts/routes.js';
```

Y dentro del `app.after(() => {...})`, agregar la línea (después de `authRoutes(app, db);`):

```ts
    accountsRoutes(app, db);
```

- [ ] **Step 3: Cliente + tipo en `api.ts`**

En `apps/web/src/api.ts`, agregar (cerca de las otras interfaces del pipeline):

```ts
export interface Account { id: string; email: string; nombre: string | null; }
export const getAccounts = () => req<Account[]>('/accounts');
```

- [ ] **Step 4: Build de api y web**

Run: `pnpm --filter @leadhub/api build && pnpm --filter @leadhub/web build`
Expected: ambos verdes.

- [ ] **Step 5: Smoke — `GET /accounts` responde 200 con lista**

Reiniciar la API (`pnpm --filter @leadhub/api build && (lsof -ti:4501 | xargs kill -9 2>/dev/null; PORT=4501 node apps/api/dist/server.js &) ; sleep 2`), luego:

```bash
B=http://localhost:4501
TOKEN=$(curl -s -X POST $B/auth/login -H 'content-type: application/json' -d '{"email":"demo@leadhub.com","password":"demo1234"}' | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).data.token))')
curl -s "$B/accounts" -H "authorization: Bearer $TOKEN" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d);console.log("ok:",j.ok,"| cuentas:",j.data.length,"| primer email:",j.data[0]?.email)})'
```
Expected: `ok: true`, al menos 1 cuenta, imprime un email (ej. `demo@leadhub.com`).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/accounts/routes.ts apps/api/src/app.ts apps/web/src/api.ts
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(api): GET /accounts para listar el equipo"
```

---

### Task 2: API `GET /pipeline/stats` + cliente web

**Files:**
- Modify: `apps/api/src/pipeline/routes.ts`
- Modify: `apps/web/src/api.ts`

**Interfaces:**
- Produces (api): `GET /pipeline/stats` → `{ ok, data: { porEtapa: Record<string, number>; total: number; ganado: number; perdido: number; conversion: number; tareasVencidas: number } }`. `conversion = ganado / (ganado + perdido)` (0 si el denominador es 0).
- Produces (web): `interface PipelineStats {...}`; `getPipelineStats(): Promise<PipelineStats>`.

**Contexto:** el dashboard necesita conteos por etapa, conversión y tareas vencidas. Se resuelve con una query agregada por etapa + una de tareas vencidas. `porEtapa` se inicializa con las 6 etapas en 0 (usando `STAGE_IDS` de core, disponible en el server vía el barrel `@leadhub/core`).

- [ ] **Step 1: Agregar imports en `routes.ts`**

En `apps/api/src/pipeline/routes.ts`, ampliar los imports existentes:
- de `drizzle-orm`, sumar `and` y `lt`: la línea `import { desc, eq, sql } from 'drizzle-orm';` pasa a `import { and, desc, eq, lt, sql } from 'drizzle-orm';`
- de `@leadhub/core`, sumar `STAGE_IDS`: la línea `import { pipelineCreateSchema, pipelineUpdateSchema, stageLabel } from '@leadhub/core';` pasa a `import { pipelineCreateSchema, pipelineUpdateSchema, stageLabel, STAGE_IDS } from '@leadhub/core';`

- [ ] **Step 2: Agregar el handler `GET /pipeline/stats`**

En `apps/api/src/pipeline/routes.ts`, dentro de `pipelineRoutes`, agregar este handler ANTES del handler `GET /pipeline/:id` (para legibilidad; Fastify de todos modos prioriza rutas estáticas sobre `:id`):

```ts
  app.get('/pipeline/stats', { preHandler: [requireAuth] }, async () => {
    const porEtapaRows = await db
      .select({ stage: pipelineLeads.stage, count: sql<number>`count(*)::int` })
      .from(pipelineLeads)
      .groupBy(pipelineLeads.stage);
    const porEtapa: Record<string, number> = {};
    for (const id of STAGE_IDS) porEtapa[id] = 0;
    for (const r of porEtapaRows) porEtapa[r.stage] = r.count;
    const total = Object.values(porEtapa).reduce((a, b) => a + b, 0);
    const ganado = porEtapa['ganado'] ?? 0;
    const perdido = porEtapa['perdido'] ?? 0;
    const cerrados = ganado + perdido;
    const conversion = cerrados > 0 ? ganado / cerrados : 0;
    const [venc] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(tasks)
      .where(and(eq(tasks.hecha, false), lt(tasks.vence, new Date())));
    return { ok: true, data: { porEtapa, total, ganado, perdido, conversion, tareasVencidas: venc?.n ?? 0 } };
  });
```

- [ ] **Step 3: Cliente + tipo en `api.ts`**

En `apps/web/src/api.ts`, agregar:

```ts
export interface PipelineStats {
  porEtapa: Record<string, number>; total: number; ganado: number; perdido: number; conversion: number; tareasVencidas: number;
}
export const getPipelineStats = () => req<PipelineStats>('/pipeline/stats');
```

- [ ] **Step 4: Build de api y web**

Run: `pnpm --filter @leadhub/api build && pnpm --filter @leadhub/web build`
Expected: ambos verdes.

- [ ] **Step 5: Smoke — `GET /pipeline/stats` coherente**

Reiniciar la API y:

```bash
B=http://localhost:4501
TOKEN=$(curl -s -X POST $B/auth/login -H 'content-type: application/json' -d '{"email":"demo@leadhub.com","password":"demo1234"}' | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).data.token))')
curl -s "$B/pipeline/stats" -H "authorization: Bearer $TOKEN" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const s=JSON.parse(d).data;const sum=Object.values(s.porEtapa).reduce((a,b)=>a+b,0);console.log("total:",s.total,"| suma porEtapa:",sum,"| conversion:",s.conversion,"| vencidas:",s.tareasVencidas,"| total==suma:",s.total===sum)})'
```
Expected: `total == suma: true`; `conversion` entre 0 y 1; `vencidas` un entero ≥ 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/pipeline/routes.ts apps/web/src/api.ts
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(api): GET /pipeline/stats (embudo, conversión, tareas vencidas)"
```

---

### Task 3: Filtrar / buscar en el board

**Files:**
- Create: `apps/web/src/components/BoardFilters.tsx`
- Modify: `apps/web/src/pages/Pipeline.tsx`
- Modify: `apps/web/src/components/KanbanBoard.tsx`

**Interfaces:**
- Consumes: `getAccounts` (Task 1), `Account`.
- Produces:
  - `type BoardFilter = { q: string; owner: string; vencidas: boolean }`.
  - `KanbanBoard` gana prop opcional `filter?: BoardFilter` que se aplica a las tarjetas.

**Contexto:** filtrar el board client-side (sobre el board ya cargado por `KanbanBoard`), con estado en la URL (`?q=&owner=&vencidas=1`). `Pipeline` posee el estado (via `useSearchParams`), renderiza la barra y pasa el filtro a `KanbanBoard`.

- [ ] **Step 1: Crear `BoardFilters.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query';
import { getAccounts } from '../api.js';

export type BoardFilter = { q: string; owner: string; vencidas: boolean };

export default function BoardFilters({ value, onChange }: { value: BoardFilter; onChange: (f: BoardFilter) => void }) {
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <input
        value={value.q}
        onChange={(e) => onChange({ ...value, q: e.target.value })}
        placeholder="Buscar por nombre…"
        className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 w-56"
      />
      <select
        value={value.owner}
        onChange={(e) => onChange({ ...value, owner: e.target.value })}
        className="border border-slate-300 rounded px-2 py-1 text-sm"
      >
        <option value="">Todos los dueños</option>
        <option value="none">Sin dueño</option>
        {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nombre ?? a.email}</option>)}
      </select>
      <label className="flex items-center gap-1.5 text-sm text-slate-600">
        <input type="checkbox" checked={value.vencidas} onChange={(e) => onChange({ ...value, vencidas: e.target.checked })} />
        Con vencidas
      </label>
      {(value.q || value.owner || value.vencidas) && (
        <button onClick={() => onChange({ q: '', owner: '', vencidas: false })} className="text-sm text-slate-500 hover:underline">Limpiar</button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `KanbanBoard` aplica el filtro**

En `apps/web/src/components/KanbanBoard.tsx`:

Importar el tipo (agregar al import de `./BoardFilters.js` — o declararlo en la firma). Cambiar la firma del componente y aplicar el filtro. Reemplazar la línea `export default function KanbanBoard({ onOpen }: { onOpen: (id: string) => void }) {` por:

```tsx
import type { BoardFilter } from './BoardFilters.js';

export default function KanbanBoard({ onOpen, filter }: { onOpen: (id: string) => void; filter?: BoardFilter }) {
```

(El `import type` va arriba con los otros imports, no en medio de la función. Poné `import type { BoardFilter } from './BoardFilters.js';` junto a los demás imports del tope del archivo.)

Y reemplazar la línea `const cards = pipeline.data ?? [];` por:

```tsx
  const all = pipeline.data ?? [];
  const cards = all.filter((c) => {
    if (filter?.q && !c.nombre.toLowerCase().includes(filter.q.toLowerCase())) return false;
    if (filter?.owner === 'none' && c.ownerId != null) return false;
    if (filter?.owner && filter.owner !== 'none' && c.ownerId !== filter.owner) return false;
    if (filter?.vencidas) { const v = c.proximoVence ? new Date(c.proximoVence).getTime() : null; if (v == null || v >= Date.now()) return false; }
    return true;
  });
```

(El resto del componente sigue usando `cards`, incluido `activeCard = ... cards.find(...)` y el `cards.filter((c) => c.stage === s.id)` por columna — no hace falta tocar nada más.)

- [ ] **Step 3: `Pipeline` posee el filtro en la URL**

Reemplazar el contenido de `apps/web/src/pages/Pipeline.tsx` por:

```tsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import KanbanBoard from '../components/KanbanBoard.js';
import LeadDrawer from '../components/LeadDrawer.js';
import BoardFilters, { type BoardFilter } from '../components/BoardFilters.js';

export default function Pipeline() {
  const [selected, setSelected] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const filter: BoardFilter = { q: params.get('q') ?? '', owner: params.get('owner') ?? '', vencidas: params.get('vencidas') === '1' };
  const setFilter = (f: BoardFilter) => {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    if (f.owner) p.set('owner', f.owner);
    if (f.vencidas) p.set('vencidas', '1');
    setParams(p);
  };
  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-xl font-bold text-slate-800">Pipeline</h1>
      </div>
      <BoardFilters value={filter} onChange={setFilter} />
      <KanbanBoard onOpen={setSelected} filter={filter} />
      {selected && <LeadDrawer pipelineId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
```

- [ ] **Step 4: Build de web**

Run: `pnpm --filter @leadhub/web build`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/BoardFilters.tsx apps/web/src/components/KanbanBoard.tsx apps/web/src/pages/Pipeline.tsx
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(web): filtrar/buscar en el board (nombre, dueño, vencidas) con estado en la URL"
```

---

### Task 4: Reasignar dueño en el drawer

**Files:**
- Modify: `apps/web/src/components/LeadDrawer.tsx`

**Interfaces:**
- Consumes: `getAccounts` (Task 1), `updatePipeline(id, { ownerId })` (ya existe y acepta `ownerId: string | null`).

**Contexto:** el drawer suma un selector de **dueño** debajo del de etapa. `updatePipeline` ya soporta `ownerId`. `ownerId` vacío en el select = sin asignar (`null`). El `PipelineDetail.pipeline` incluye `ownerId` (ya está en el tipo).

- [ ] **Step 1: Agregar el import de `getAccounts` y la query**

En `apps/web/src/components/LeadDrawer.tsx`:

Ampliar el import de `../api.js` para incluir `getAccounts`:
```tsx
import { getPipelineDetail, addActivity, addTask, toggleTask, updatePipeline, removeFromPipeline, getAccounts } from '../api.js';
```

Dentro del componente, junto a las otras queries/mutaciones, agregar:
```tsx
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const ownerMut = useMutation({ mutationFn: (ownerId: string | null) => updatePipeline(pipelineId, { ownerId }), onSuccess: inval });
```

- [ ] **Step 2: Agregar el selector de dueño en el markup**

En el bloque de Etapa (después del `<button>` de "Sacar" que cierra ese `<div>`), agregar un nuevo bloque para el dueño, justo después del `</div>` que cierra la fila de etapa:

```tsx
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Dueño</span>
              <select
                value={d.pipeline.ownerId ?? ''}
                onChange={(e) => ownerMut.mutate(e.target.value === '' ? null : e.target.value)}
                className={inputCls}
              >
                <option value="">Sin asignar</option>
                {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.nombre ?? a.email}</option>)}
              </select>
            </div>
```

- [ ] **Step 3: Build de web**

Run: `pnpm --filter @leadhub/web build`
Expected: verde.

- [ ] **Step 4: Smoke — reasignar persiste**

Con la API en :4501 y web dev corriendo, o por API directa:
```bash
B=http://localhost:4501
TOKEN=$(curl -s -X POST $B/auth/login -H 'content-type: application/json' -d '{"email":"demo@leadhub.com","password":"demo1234"}' | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).data.token))')
AUTH="authorization: Bearer $TOKEN"
PID=$(curl -s "$B/pipeline" -H "$AUTH" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).data[0].id))')
ACC=$(curl -s "$B/accounts" -H "$AUTH" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).data[0].id))')
curl -s -X PATCH "$B/pipeline/$PID" -H "$AUTH" -H 'content-type: application/json' -d "{\"ownerId\":\"$ACC\"}" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>console.log("ownerId asignado:",JSON.parse(d).data.ownerId))'
```
Expected: imprime el `ownerId` asignado (== `$ACC`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/LeadDrawer.tsx
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(web): reasignar dueño desde el drawer"
```

---

### Task 5: Acción rápida de outreach

**Files:**
- Modify: `apps/web/src/components/LeadDrawer.tsx`

**Interfaces:**
- Consumes: `addActivity(id, { tipo, cuerpo })` (ya existe), `d.lead.telefono`, `d.lead.email`, `d.lead.nombreFantasia`.

**Contexto:** en el drawer, botones **WhatsApp** y **Email** cuando el lead tiene `telefono`/`email`. Abren `wa.me`/`mailto` con una plantilla prellenada y registran una actividad (`whatsapp`/`email`) que queda en el timeline. El teléfono se normaliza a dígitos (para `wa.me`). Si no hay teléfono/email válido, el botón no se muestra.

- [ ] **Step 1: Agregar helpers y la mutación de outreach**

En `apps/web/src/components/LeadDrawer.tsx`, agregar arriba (después de la constante `NEUTRAL` o cerca del tope del archivo, fuera del componente):

```tsx
function soloDigitos(tel: string | null | undefined): string { return (tel ?? '').replace(/\D/g, ''); }
```

Dentro del componente, agregar la mutación que registra la actividad de outreach:
```tsx
  const outreachMut = useMutation({ mutationFn: (v: { tipo: string; cuerpo: string }) => addActivity(pipelineId, v), onSuccess: inval });
```

- [ ] **Step 2: Agregar los botones de outreach en el header**

Insertar una fila de acciones rápidas **inmediatamente después del `</div>` que cierra el header** — el `<div className="flex justify-between items-start">…</div>` que contiene el bloque de título/metadatos del lead **y** el botón `✕` — y **antes del bloque de Etapa** (`<div className="mt-4 flex items-center gap-2">`). Es decir: header → (este bloque de outreach) → Etapa → Dueño → Tareas → Actividad:

```tsx
            <div className="mt-3 flex gap-2">
              {soloDigitos(d.lead.telefono) && (
                <a
                  href={`https://wa.me/${soloDigitos(d.lead.telefono)}?text=${encodeURIComponent(`Hola ${d.lead.nombreFantasia ?? ''}, `)}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => outreachMut.mutate({ tipo: 'whatsapp', cuerpo: 'Mensaje iniciado por WhatsApp' })}
                  className="inline-flex items-center gap-1 text-sm bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700"
                >
                  💬 WhatsApp
                </a>
              )}
              {d.lead.email && (
                <a
                  href={`mailto:${d.lead.email}?subject=${encodeURIComponent('Contacto')}&body=${encodeURIComponent(`Hola ${d.lead.nombreFantasia ?? ''}, `)}`}
                  onClick={() => outreachMut.mutate({ tipo: 'email', cuerpo: 'Mensaje iniciado por email' })}
                  className="inline-flex items-center gap-1 text-sm bg-slate-700 text-white px-3 py-1 rounded hover:bg-slate-800"
                >
                  ✉️ Email
                </a>
              )}
            </div>
```

- [ ] **Step 3: Build de web**

Run: `pnpm --filter @leadhub/web build`
Expected: verde.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/LeadDrawer.tsx
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(web): acción rápida de outreach (WhatsApp/email) con registro de actividad"
```

---

### Task 6: Dashboard de embudo

**Files:**
- Create: `apps/web/src/pages/Dashboard.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/components/Nav.tsx`

**Interfaces:**
- Consumes: `getPipelineStats` (Task 2), `STAGES`, `stageColor` de `@leadhub/core/stages`.

**Contexto:** página `/dashboard` con el embudo por etapa (barras proporcionales con el color de la etapa), tarjetas de métrica (total en pipeline, conversión %, tareas vencidas). Nav pasa a incluir **Dashboard**.

- [ ] **Step 1: Crear `Dashboard.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query';
import { STAGES, stageColor } from '@leadhub/core/stages';
import { getPipelineStats } from '../api.js';

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex-1" style={accent ? { borderTop: `3px solid ${accent}` } : undefined}>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const stats = useQuery({ queryKey: ['pipeline-stats'], queryFn: getPipelineStats });
  const s = stats.data;
  const max = s ? Math.max(1, ...Object.values(s.porEtapa)) : 1;
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold text-slate-800 mb-4">Dashboard</h1>
      {!s ? <p className="text-slate-400">Cargando…</p> : (
        <>
          <div className="flex gap-3 mb-6">
            <Metric label="En pipeline" value={String(s.total)} />
            <Metric label="Conversión" value={`${Math.round(s.conversion * 100)}%`} accent="#10b981" />
            <Metric label="Tareas vencidas" value={String(s.tareasVencidas)} accent={s.tareasVencidas > 0 ? '#ef4444' : undefined} />
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Embudo por etapa</h2>
            <div className="space-y-2">
              {STAGES.map((st) => {
                const n = s.porEtapa[st.id] ?? 0;
                const pct = Math.round((n / max) * 100);
                return (
                  <div key={st.id} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-28 shrink-0">{st.label}</span>
                    <div className="flex-1 bg-slate-100 rounded h-5 overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: stageColor(st.id) }} />
                    </div>
                    <span className="text-sm text-slate-500 w-8 text-right">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Ruta en `main.tsx`**

En `apps/web/src/main.tsx`, agregar el import:
```tsx
import Dashboard from './pages/Dashboard.js';
```
Y agregar la `<Route>` (después de la de `/tareas`):
```tsx
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Nav />
            <Dashboard />
          </RequireAuth>
        }
      />
```

- [ ] **Step 3: Link en `Nav.tsx`**

En `apps/web/src/components/Nav.tsx`, agregar el `NavLink` después del de Tareas:
```tsx
      <NavLink to="/dashboard" className={cls}>Dashboard</NavLink>
```

- [ ] **Step 4: Build de web**

Run: `pnpm --filter @leadhub/web build`
Expected: verde.

- [ ] **Step 5: Smoke visual (lo corre el controlador)**

El controlador levanta web + API, entra con demo, y verifica en `/dashboard`: las 3 métricas (total, conversión %, vencidas) y el embudo con barras proporcionales de color por etapa. Verifica que los conteos coincidan con el board.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/Dashboard.tsx apps/web/src/main.tsx apps/web/src/components/Nav.tsx
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(web): dashboard de embudo (conversión, tareas vencidas, conteo por etapa)"
```

---

## Notas de verificación final (para el review de rama)

- `GET /accounts` y `GET /pipeline/stats` responden 200 con datos coherentes (`total == suma porEtapa`).
- El filtro del board opera client-side y persiste en la URL (`?q=&owner=&vencidas=1`); "Sin dueño" filtra `ownerId == null`.
- Reasignar dueño desde el drawer persiste (`PATCH { ownerId }`) y refleja en la tarjeta.
- Outreach abre `wa.me`/`mailto` prellenado y registra actividad `whatsapp`/`email`; los botones no aparecen si falta teléfono/email.
- `/dashboard` muestra embudo + métricas coherentes con el board; nav incluye Dashboard.
- Value-imports de core en web solo por `@leadhub/core/stages`; los tres paquetes compilan; tests del monorepo intactos.
