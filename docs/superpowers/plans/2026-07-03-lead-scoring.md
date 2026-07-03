# Lead Scoring (priorización) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score de prioridad 0–100 por lead (señales objetivas), usado para ordenar/filtrar en Explorar y ordenar tarjetas en el Board. Sin cambios de esquema.

**Architecture:** Pesos en `packages/core` (`SCORE_WEIGHTS`) + `scoreLead()`/`scoreTier()` puros. La API importa los pesos y genera la expresión SQL (`leadScoreSql`) para agregar `score` computado a `GET /leads` (con sort `prioridad` y filtro `soloAlto`) y al board de `GET /pipeline`. La UI muestra el badge por tier y ordena.

**Tech Stack:** Drizzle/Postgres (expresión SQL) + Fastify; React + Tailwind (tokens Apple ya existentes); TypeScript ESM.

## Global Constraints

- **SIN tests automatizados** (política del proyecto). Verificación por build verde + smoke curl/visual. No agregar tests. No romper tests del monorepo.
- **Value-imports de `@leadhub/core` desde web SOLO por subpaths** (`@leadhub/core/stages`, y el nuevo `@leadhub/core/score`) — NUNCA el barrel raíz (rompe Vite). El server (api) sí puede usar el barrel.
- **Sin cambios de esquema / migraciones.** `score` se computa en la query.
- Los pesos viven UNA vez en core; el SQL se genera desde ellos; la condición de "presente" es `campo <> ''` en SQL y `!== ''` en `scoreLead` (deben coincidir).
- Colores de tier por `style` inline con tonos de la paleta de etapas (`stageColor`), no clases dinámicas.
- Commits en español, formato convencional, usando EXACTAMENTE:
  `git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "..."`

## File Structure

- **Crear** `packages/core/src/score.ts` — `SCORE_WEIGHTS`, `scoreLead`, `scoreTier`, `ScoreTier`.
- **Modificar** `packages/core/src/index.ts` — `export * from './score.js'`.
- **Modificar** `packages/core/package.json` — subpath `./score`.
- **Modificar** `packages/core/src/filters.ts` — sort `'prioridad'` + filtro `soloAlto`.
- **Crear** `apps/api/src/leads/score.ts` — `leadScoreSql()`.
- **Modificar** `apps/api/src/leads/query.ts` — score en select, sort prioridad, filtro soloAlto.
- **Modificar** `apps/api/src/pipeline/routes.ts` — score en el board.
- **Modificar** `apps/web/src/api.ts` — `LeadRow.score`, `PipelineCard.score`.
- **Crear** `apps/web/src/components/ScoreBadge.tsx` — badge por tier.
- **Modificar** `apps/web/src/useFilters.ts` — `soloAlto`.
- **Modificar** `apps/web/src/pages/Explorer.tsx`, `apps/web/src/components/Filters.tsx`, `apps/web/src/components/LeadsTable.tsx` — orden + toggle + badge.
- **Modificar** `apps/web/src/components/KanbanCard.tsx`, `apps/web/src/components/KanbanBoard.tsx` — badge + orden por score.

---

### Task 1: core — pesos, funciones y schema

**Files:**
- Create: `packages/core/src/score.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/package.json`
- Modify: `packages/core/src/filters.ts`

**Interfaces:**
- Produces: `SCORE_WEIGHTS`, `scoreLead(lead): number`, `scoreTier(score): 'alto'|'medio'|'bajo'`, tipo `ScoreTier`. Subpath `@leadhub/core/score`. `leadFiltersSchema.sort` incluye `'prioridad'`; `leadFiltersSchema` gana `soloAlto`.

- [ ] **Step 1: Crear `packages/core/src/score.ts`**

```ts
export const SCORE_WEIGHTS = {
  telefono: 20,
  whatsapp: 15,
  email: 15,
  web: 15,
  redes: 10,
  cuit: 10,
  fuenteGoogle: 15,
} as const;

type ScorableLead = {
  telefono?: string; whatsapp?: string; email?: string; sitioWeb?: string;
  instagram?: string; facebook?: string; cuit?: string; fuente?: string;
};

const present = (v: string | undefined): boolean => (v ?? '') !== '';

/** Score de prioridad 0–100 desde señales objetivas del lead. */
export function scoreLead(lead: ScorableLead): number {
  let s = 0;
  if (present(lead.telefono)) s += SCORE_WEIGHTS.telefono;
  if (present(lead.whatsapp)) s += SCORE_WEIGHTS.whatsapp;
  if (present(lead.email)) s += SCORE_WEIGHTS.email;
  if (present(lead.sitioWeb)) s += SCORE_WEIGHTS.web;
  if (present(lead.instagram) || present(lead.facebook)) s += SCORE_WEIGHTS.redes;
  if (present(lead.cuit)) s += SCORE_WEIGHTS.cuit;
  if (lead.fuente === 'Google Maps') s += SCORE_WEIGHTS.fuenteGoogle;
  return s;
}

export type ScoreTier = 'alto' | 'medio' | 'bajo';
export function scoreTier(score: number): ScoreTier {
  if (score >= 70) return 'alto';
  if (score >= 40) return 'medio';
  return 'bajo';
}
```

- [ ] **Step 2: Export en `packages/core/src/index.ts`**

Agregar junto a los otros exports:
```ts
export * from './score.js';
```

- [ ] **Step 3: Subpath `./score` en `packages/core/package.json`**

En `exports`, agregar la entrada `./score` con el mismo formato condicional que `./stages`:
```json
    "./score": { "types": "./dist/score.d.ts", "import": "./dist/score.js" }
```
(Dejar `.` y `./stages` tal cual.)

- [ ] **Step 4: Extender `packages/core/src/filters.ts`**

Cambiar la línea del `sort` para incluir `'prioridad'`:
```ts
  sort: z.enum(['nombre', 'localidad', 'fecha', 'prioridad']).default('nombre'),
```
Y agregar el filtro `soloAlto` dentro del objeto (después de `hasCuit: boolish,`):
```ts
  soloAlto: boolish,
```

- [ ] **Step 5: Build de core**

Run: `pnpm --filter @leadhub/core build`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/score.ts packages/core/src/index.ts packages/core/package.json packages/core/src/filters.ts
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(core): score de prioridad (pesos, scoreLead/scoreTier) + sort prioridad y filtro soloAlto"
```

---

### Task 2: api leads — score en /leads (sort + filtro)

**Files:**
- Create: `apps/api/src/leads/score.ts`
- Modify: `apps/api/src/leads/query.ts`
- Modify: `apps/web/src/api.ts`

**Interfaces:**
- Consumes: `SCORE_WEIGHTS` (core, barrel en server), `LeadFilters` con `sort:'prioridad'`/`soloAlto`.
- Produces: `leadScoreSql(): SQL<number>`; `GET /leads` items con `score`; `LeadRow` gana `score: number`.

- [ ] **Step 1: Crear `apps/api/src/leads/score.ts`**

```ts
import { sql, type SQL } from 'drizzle-orm';
import { SCORE_WEIGHTS } from '@leadhub/core';
import { leads } from '../db/schema.js';

/** Expresión SQL del score de prioridad (0–100), construida desde SCORE_WEIGHTS. */
export function leadScoreSql(): SQL<number> {
  return sql<number>`(
    ${SCORE_WEIGHTS.telefono} * (${leads.hasTelefono})::int +
    ${SCORE_WEIGHTS.whatsapp} * (${leads.hasWhatsapp})::int +
    ${SCORE_WEIGHTS.email} * (${leads.hasEmail})::int +
    ${SCORE_WEIGHTS.web} * (${leads.hasWeb})::int +
    ${SCORE_WEIGHTS.redes} * ((${leads.instagram} <> '' OR ${leads.facebook} <> ''))::int +
    ${SCORE_WEIGHTS.cuit} * (${leads.hasCuit})::int +
    ${SCORE_WEIGHTS.fuenteGoogle} * ((${leads.fuente} = 'Google Maps'))::int
  )::int`;
}
```

- [ ] **Step 2: Modificar `apps/api/src/leads/query.ts`**

Ampliar el import de drizzle para incluir `getTableColumns`:
```ts
import { and, inArray, eq, desc, asc, sql, getTableColumns } from 'drizzle-orm';
```
Agregar el import del helper:
```ts
import { leadScoreSql } from './score.js';
```
En `conditions(f)`, agregar (después del `if (f.hasCuit) ...`):
```ts
  if (f.soloAlto) c.push(sql`${leadScoreSql()} >= 70`);
```
En `SORTS`, agregar la clave `prioridad`:
```ts
const SORTS = {
  nombre: asc(leads.nombreFantasia),
  localidad: asc(leads.localidad),
  fecha: desc(leads.fechaExtraccion),
  prioridad: desc(leadScoreSql()),
};
```
En `buildLeadsQuery`, cambiar el select de `rows` para incluir `score`:
```ts
  const rows = db.select({ ...getTableColumns(leads), score: leadScoreSql() }).from(leads).where(where)
    .orderBy(SORTS[f.sort]).limit(f.pageSize).offset(offsetSql);
```

- [ ] **Step 3: Extender `LeadRow` en `apps/web/src/api.ts`**

Cambiar el tipo `LeadRow` para sumar `score`:
```ts
export type LeadRow = Lead & { id: string; score: number };
```

- [ ] **Step 4: Build de api y web**

Run: `pnpm --filter @leadhub/api build && pnpm --filter @leadhub/web build`
Expected: ambos verdes. (Confirma que `getTableColumns` tipa y que `score` no rompe el export CSV — `export.ts` usa su propia query o ignora el shape.)

- [ ] **Step 5: Smoke — sort prioridad + soloAlto + score presente**

Reiniciar la API (`pnpm --filter @leadhub/api build && (lsof -ti:4501 | xargs kill -9 2>/dev/null; PORT=4501 node apps/api/dist/server.js &) ; sleep 2`), luego:

```bash
B=http://localhost:4501
TOKEN=$(curl -s -X POST $B/auth/login -H 'content-type: application/json' -d '{"email":"demo@leadhub.com","password":"demo1234"}' | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).data.token))')
AUTH="authorization: Bearer $TOKEN"
echo "sort=prioridad: los primeros scores deben venir en orden desc y 0..100"
curl -s "$B/leads?sort=prioridad&pageSize=5" -H "$AUTH" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const it=JSON.parse(d).data.items;console.log(it.map(x=>x.score).join(" "));const desc=it.every((x,i)=>i===0||it[i-1].score>=x.score);const rango=it.every(x=>x.score>=0&&x.score<=100);console.log("desc:",desc,"| rango 0-100:",rango)})'
echo "soloAlto: todos >= 70"
curl -s "$B/leads?soloAlto=true&pageSize=10" -H "$AUTH" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const it=JSON.parse(d).data.items;console.log("n:",it.length,"| todos>=70:",it.every(x=>x.score>=70))})'
```
Expected: la lista de scores desc, `desc: true | rango 0-100: true`; en soloAlto `todos>=70: true`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/leads/score.ts apps/api/src/leads/query.ts apps/web/src/api.ts
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(api): score de prioridad en /leads (sort prioridad, filtro soloAlto)"
```

---

### Task 3: api board — score por tarjeta

**Files:**
- Modify: `apps/api/src/pipeline/routes.ts`
- Modify: `apps/web/src/api.ts`

**Interfaces:**
- Consumes: `leadScoreSql` (Task 2).
- Produces: cada tarjeta del board suma `score: number`; `PipelineCard` gana `score`.

- [ ] **Step 1: Agregar `score` al select del board**

En `apps/api/src/pipeline/routes.ts`, agregar el import:
```ts
import { leadScoreSql } from '../leads/score.js';
```
En el `.select({...})` del handler `GET /pipeline`, agregar (después de `proximoVence:`):
```ts
        score: leadScoreSql(),
```
(La query ya hace `innerJoin(leads, ...)`, así que las columnas de `leads` que usa `leadScoreSql` están disponibles.)

- [ ] **Step 2: Extender `PipelineCard` en `apps/web/src/api.ts`**

En la interface `PipelineCard`, agregar:
```ts
  score: number;
```

- [ ] **Step 3: Build de api y web**

Run: `pnpm --filter @leadhub/api build && pnpm --filter @leadhub/web build`
Expected: ambos verdes.

- [ ] **Step 4: Smoke — el board trae score**

Reiniciar la API y:
```bash
B=http://localhost:4501
TOKEN=$(curl -s -X POST $B/auth/login -H 'content-type: application/json' -d '{"email":"demo@leadhub.com","password":"demo1234"}' | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>process.stdout.write(JSON.parse(d).data.token))')
curl -s "$B/pipeline" -H "authorization: Bearer $TOKEN" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const j=JSON.parse(d).data;console.log("cards:",j.length,"| primer score:",j[0]?.score,"| todos 0-100:",j.every(c=>c.score>=0&&c.score<=100))})'
```
Expected: imprime scores válidos (0–100).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/pipeline/routes.ts apps/web/src/api.ts
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(api): score de prioridad por tarjeta en el board"
```

---

### Task 4: web Explorar — orden, filtro y badge

**Files:**
- Create: `apps/web/src/components/ScoreBadge.tsx`
- Modify: `apps/web/src/useFilters.ts`
- Modify: `apps/web/src/pages/Explorer.tsx`
- Modify: `apps/web/src/components/Filters.tsx`
- Modify: `apps/web/src/components/LeadsTable.tsx`

**Interfaces:**
- Consumes: `scoreTier`, `scoreLead` de `@leadhub/core/score` (subpath); `stageColor` de `@leadhub/core/stages`.
- Produces: `ScoreBadge({ score, breakdown? })`.

**Contexto:** `UiFilters` ya tiene `sort?: string`; `useFilters` serializa `sort` y una lista `BOOLS` a la URL. Hay que sumar `soloAlto` a `BOOLS`, un selector de orden en Explorar, un toggle "Solo Alto" en Filters, y una columna "Prioridad" con badge en la tabla.

- [ ] **Step 1: Crear `apps/web/src/components/ScoreBadge.tsx`**

```tsx
import { scoreTier } from '@leadhub/core/score';
import { stageColor } from '@leadhub/core/stages';

const TIER_COLOR: Record<string, string> = {
  alto: stageColor('ganado'),      // verde apagado
  medio: stageColor('negociacion'),// ámbar apagado
  bajo: '#8e8e93',                 // gris
};

export default function ScoreBadge({ score, title }: { score: number; title?: string }) {
  const tier = scoreTier(score);
  const color = TIER_COLOR[tier];
  return (
    <span
      title={title}
      className="inline-flex items-center justify-center min-w-[2.25rem] px-1.5 py-0.5 rounded-pill text-[12px] font-semibold"
      style={{ color, backgroundColor: `${color}1f` }}
    >
      {score}
    </span>
  );
}
```
(`${color}1f` = el hex + alfa ~12% para el fondo tenue.)

- [ ] **Step 2: `soloAlto` en `apps/web/src/useFilters.ts`**

Agregar `'soloAlto'` al array `BOOLS`:
```ts
const BOOLS = ['hasEmail', 'hasTelefono', 'hasWhatsapp', 'hasWeb', 'hasCuit', 'soloAlto'] as const;
```
Y agregar `soloAlto?: boolean;` al tipo `UiFilters`.

- [ ] **Step 3: Selector de orden en `apps/web/src/pages/Explorer.tsx`**

En el header (junto al conteo de resultados y el botón Exportar), agregar un `<select>` de orden que setea `filters.sort`:
```tsx
        <select
          value={filters.sort ?? 'nombre'}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value, page: 1 })}
          className="input"
        >
          <option value="prioridad">Prioridad</option>
          <option value="nombre">Nombre</option>
          <option value="localidad">Localidad</option>
          <option value="fecha">Fecha</option>
        </select>
```
(Mantener el resto del layout y el cableado de `<Filters>`/`<LeadsTable>` sin cambios.)

- [ ] **Step 4: Toggle "Solo Alto" en `apps/web/src/components/Filters.tsx`**

Agregar, junto a los otros toggles de booleanos, un checkbox "Solo prioridad Alta" que togglea `filters.soloAlto` (usar el mismo patrón `toggleBool`/`setFilters` que ya usan `hasEmail` etc., con `page: 1`).

- [ ] **Step 5: Columna "Prioridad" en `apps/web/src/components/LeadsTable.tsx`**

Importar y usar `ScoreBadge` + `scoreLead` (de `@leadhub/core/score`) para el tooltip de desglose. Agregar una columna al `thead` ("Prioridad") y, por fila, una celda con:
```tsx
              <td className="p-2"><ScoreBadge score={lead.score} title={breakdown(lead)} /></td>
```
donde `breakdown(lead)` arma un texto tipo `"tel ✓ · email ✓ · web ✗ · redes ✓ · cuit ✗ · GMaps ✓"` a partir de los campos del lead (podés calcular presencia con los mismos criterios que `scoreLead`, o simplemente listar las señales presentes). Mantené el resto de la tabla y la lógica intactas.

- [ ] **Step 6: Build de web**

Run: `pnpm --filter @leadhub/web build`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ScoreBadge.tsx apps/web/src/useFilters.ts apps/web/src/pages/Explorer.tsx apps/web/src/components/Filters.tsx apps/web/src/components/LeadsTable.tsx
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(web): orden por Prioridad, filtro Solo Alto y badge de score en Explorar"
```

---

### Task 5: web Board — badge y orden por score

**Files:**
- Modify: `apps/web/src/components/KanbanCard.tsx`
- Modify: `apps/web/src/components/KanbanBoard.tsx`

**Interfaces:**
- Consumes: `ScoreBadge` (Task 4), `PipelineCard.score` (Task 3).

**Contexto:** conservar TODO (drag optimista, DragOverlay, filtro client-side). Solo agregar el badge y el orden por score dentro de la columna.

- [ ] **Step 1: Badge en `apps/web/src/components/KanbanCard.tsx`**

Importar `ScoreBadge` y renderizarlo en la tarjeta (junto al badge de tareas / en la fila de metadatos), pasando `score={card.score}`. No cambiar la lógica de `useDraggable`/`onOpen`/vencimiento.

- [ ] **Step 2: Orden por score dentro de la columna en `apps/web/src/components/KanbanBoard.tsx`**

En el render de columnas, cambiar el filtrado por etapa para además ordenar por score desc:
```tsx
          <Column key={s.id} stageId={s.id} label={s.label} cards={cards.filter((c) => c.stage === s.id).sort((a, b) => b.score - a.score)} onOpen={onOpen} />
```
(No tocar la mutación `move`, el `DragOverlay`, ni el filtro client-side.)

- [ ] **Step 3: Build de web**

Run: `pnpm --filter @leadhub/web build`
Expected: verde.

- [ ] **Step 4: Smoke visual (lo corre el controlador):** levantar web + API, entrar con demo, verificar en Explorar el orden por Prioridad + toggle Solo Alto + badges por fila con tier; en el Board los badges por tarjeta y el orden por score dentro de cada columna. Chequear claro y oscuro.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/KanbanCard.tsx apps/web/src/components/KanbanBoard.tsx
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(web): badge de score y orden por prioridad en el board"
```

---

## Notas de verificación final (para el review de rama)

- `GET /leads?sort=prioridad` ordena por score desc; `soloAlto=true` filtra `>=70`; cada item trae `score` 0–100. El board trae `score` por tarjeta.
- El número del SQL y el de `scoreLead` coinciden (mismos pesos de core, misma condición `<> ''`).
- Value-imports de core en web solo por subpaths (`/score`, `/stages`); el server usa el barrel.
- Export CSV, drag optimista, filtros en URL y flujos existentes intactos.
- Los tres paquetes compilan; tests del monorepo verdes.
