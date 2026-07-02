# LeadHub Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el scraper CLI en un producto: monorepo con un catálogo de leads en Postgres, una API Fastify para filtrar/exportar, y una UI React para explorar y exportar CSV.

**Architecture:** Monorepo pnpm. La lógica pura ya testeada se extrae a `packages/core`. El scraper (`apps/scraper`) queda como back-office. `apps/ingest` vuelca los JSON del scraper a Postgres (upsert idempotente). `apps/api` (Fastify + Drizzle) sirve un catálogo compartido de leads con auth JWT. `apps/web` (React + Vite) filtra y exporta.

**Tech Stack:** Node 20, TypeScript strict (ESM), pnpm workspaces, PostgreSQL 16, Drizzle ORM + drizzle-kit, Fastify + @fastify/jwt, Zod, argon2, Vitest, React 18 + Vite + TanStack Query + react-router + Tailwind, Playwright (E2E, ya en el repo).

## Global Constraints

- TypeScript **strict** en todos los paquetes; ESM (`"type": "module"`), `moduleResolution: NodeNext`, imports con extensión `.js`.
- Gestor: **pnpm** (workspaces). Nunca npm/yarn.
- Nombres de paquetes: `@leadhub/core`, `@leadhub/scraper`, `@leadhub/api`, `@leadhub/ingest`, `@leadhub/web`.
- Envelope de API: `{ ok: boolean, data?: T, error?: string }`.
- Validación de entrada con **Zod** en cada endpoint.
- Auth: **JWT** (Bearer). Hash de password con **argon2id**. Cuentas **sembradas** (sin signup público).
- DB: PostgreSQL. Conexión por `DATABASE_URL`; tests usan `DATABASE_URL_TEST`.
- `leads` es catálogo **compartido de solo lectura** para clientes; dedup por `dedup_key` = `norm(nombre_fantasia)+'|'+norm(direccion)` donde `norm` = lowercase + trim + colapso de espacios.
- `fuente` ∈ {`Google Maps`, `OpenStreetMap`, `CADAM`} (string abierto).
- Sin límite de export en este slice; `export_logs` se escribe igual (base para cuotas futuras).
- Los 44 tests existentes deben seguir verdes tras la mudanza a monorepo.

---

### Task 1: Scaffolding del monorepo pnpm

**Files:**
- Create: `pnpm-workspace.yaml`, `tsconfig.base.json`
- Modify: `package.json` (raíz → privado, workspace root)
- Create dirs: `packages/core/src`, `apps/api/src`, `apps/ingest/src`, `apps/web/src`

**Interfaces:**
- Produces: workspace pnpm con scripts raíz `build`, `test`.

- [ ] **Step 1: Crear `pnpm-workspace.yaml`**

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

- [ ] **Step 2: Reemplazar `package.json` raíz**

```json
{
  "name": "leadhub",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test"
  }
}
```

- [ ] **Step 3: Crear `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 4: Crear directorios**

Run: `mkdir -p packages/core/src apps/api/src apps/ingest/src apps/web/src`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffolding monorepo pnpm"
```

---

### Task 2: Extraer `@leadhub/core` (lógica pura + tests)

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts`
- Move (git mv): `src/types.ts`→`packages/core/src/types.ts`; `src/utils/{deduplicator,cuit,email-filter,url,geo,output-path}.ts`→`packages/core/src/`; `src/exporters/{csv,json}.ts`→`packages/core/src/`
- Move tests: `tests/{deduplicator,cuit,email-filter,url,geo,output-path,csv}.test.ts`→`packages/core/tests/`

**Interfaces:**
- Produces: paquete `@leadhub/core` que exporta `Lead`, `ScraperOptions`, `RawBusiness`, `Socials`, `Enrichment`, `leadKey`, `dedupeLeads`, `dedupeMapsUrls`, `isValidCuit`, `formatCuit`, `extractCuit`, `extractEmails`, `filterEmails`, `EMAIL_BLOCKLIST`, `normalizeUrl`, `parseCoordinates`, `slugify`, `resolveOutputPaths`, `CSV_HEADER`, `leadToRow`, `writeCsv`, `writeJson`.

- [ ] **Step 1: Crear `packages/core/package.json`**

```json
{
  "name": "@leadhub/core",
  "version": "0.1.0",
  "type": "module",
  "exports": { ".": "./dist/index.js" },
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": { "csv-writer": "^1.6.0" },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^4.1.0", "@types/node": "^20.0.0" }
}
```

- [ ] **Step 2: Crear `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 3: Crear `packages/core/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], environment: 'node' } });
```

- [ ] **Step 4: Mover los archivos fuente con git mv**

Run:
```bash
git mv src/types.ts packages/core/src/types.ts
git mv src/utils/deduplicator.ts packages/core/src/deduplicator.ts
git mv src/utils/cuit.ts packages/core/src/cuit.ts
git mv src/utils/email-filter.ts packages/core/src/email-filter.ts
git mv src/utils/url.ts packages/core/src/url.ts
git mv src/utils/geo.ts packages/core/src/geo.ts
git mv src/utils/output-path.ts packages/core/src/output-path.ts
git mv src/exporters/csv.ts packages/core/src/csv.ts
git mv src/exporters/json.ts packages/core/src/json.ts
```

- [ ] **Step 5: Corregir imports internos de core**

En `packages/core/src/deduplicator.ts`, `csv.ts`, `json.ts` el import de tipos pasa de `'../types.js'` a `'./types.js'`. Editar cada uno:
- `deduplicator.ts`: `import type { Lead } from './types.js';`
- `csv.ts`: `import type { Lead } from './types.js';`
- `json.ts`: `import type { Lead } from './types.js';`

- [ ] **Step 6: Crear `packages/core/src/index.ts`**

```typescript
export * from './types.js';
export * from './deduplicator.js';
export * from './cuit.js';
export * from './email-filter.js';
export * from './url.js';
export * from './geo.js';
export * from './output-path.js';
export * from './csv.js';
export * from './json.js';
```

- [ ] **Step 7: Mover los tests y corregir sus imports**

Run:
```bash
mkdir -p packages/core/tests
git mv tests/deduplicator.test.ts packages/core/tests/
git mv tests/cuit.test.ts packages/core/tests/
git mv tests/email-filter.test.ts packages/core/tests/
git mv tests/url.test.ts packages/core/tests/
git mv tests/geo.test.ts packages/core/tests/
git mv tests/output-path.test.ts packages/core/tests/
git mv tests/csv.test.ts packages/core/tests/
```
En cada test movido, reemplazar los imports `'../src/...js'` por `'../src/<archivo>.js'` con la nueva ubicación plana. Ejemplo en `deduplicator.test.ts`: `from '../src/deduplicator.js'` y `from '../src/types.js'`. En `csv.test.ts`: `from '../src/csv.js'` y `from '../src/types.js'`.

- [ ] **Step 8: Instalar y compilar core**

Run: `pnpm install && pnpm --filter @leadhub/core build`
Expected: compila sin errores; genera `packages/core/dist`.

- [ ] **Step 9: Correr los tests de core**

Run: `pnpm --filter @leadhub/core test`
Expected: PASS (7 archivos: deduplicator, cuit, email-filter, url, geo, output-path, csv).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: extraer @leadhub/core (lógica pura + tests)"
```

---

### Task 3: Mover el scraper a `apps/scraper` y recablear a core

**Files:**
- Create: `apps/scraper/package.json`, `apps/scraper/tsconfig.json`, `apps/scraper/vitest.config.ts`
- Move: `src/cli.ts`, `src/scraper/*`, `src/sources/*`, `src/utils/{logger,rate-limiter,safe-extract}.ts` → `apps/scraper/src/...`
- Move tests: `tests/{socials,safe-extract,captcha,rate-limiter,osm,chains}.test.ts` → `apps/scraper/tests/`
- Delete leftover: `src/`, `tests/`, root `tsconfig.json`, root `vitest.config.ts` (si quedaron vacíos)

**Interfaces:**
- Consumes: `@leadhub/core` (todo lo exportado en Task 2).
- Produces: `@leadhub/scraper` con el mismo comportamiento CLI de antes.

- [ ] **Step 1: Crear `apps/scraper/package.json`**

```json
{
  "name": "@leadhub/scraper",
  "version": "0.1.0",
  "type": "module",
  "bin": { "maps-scraper": "dist/cli.js" },
  "scripts": { "build": "tsc", "dev": "tsx src/cli.ts", "test": "vitest run" },
  "dependencies": {
    "@leadhub/core": "workspace:*",
    "chalk": "^5.3.0", "cli-progress": "^3.12.0", "commander": "^12.0.0",
    "dotenv": "^16.4.0", "playwright": "^1.48.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0", "tsx": "^4.19.0", "vitest": "^4.1.0",
    "@types/node": "^20.0.0", "@types/cli-progress": "^3.11.0"
  }
}
```

- [ ] **Step 2: Crear `apps/scraper/tsconfig.json` y `vitest.config.ts`**

`tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```
`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], environment: 'node' } });
```

- [ ] **Step 3: Mover los archivos del scraper**

Run:
```bash
mkdir -p apps/scraper/src/scraper apps/scraper/src/sources apps/scraper/src/utils apps/scraper/tests
git mv src/cli.ts apps/scraper/src/cli.ts
git mv src/scraper/browser.ts apps/scraper/src/scraper/browser.ts
git mv src/scraper/captcha.ts apps/scraper/src/scraper/captcha.ts
git mv src/scraper/chains.ts apps/scraper/src/scraper/chains.ts
git mv src/scraper/maps-scraper.ts apps/scraper/src/scraper/maps-scraper.ts
git mv src/scraper/selectors.ts apps/scraper/src/scraper/selectors.ts
git mv src/scraper/web-enricher.ts apps/scraper/src/scraper/web-enricher.ts
git mv src/sources/osm.ts apps/scraper/src/sources/osm.ts
git mv src/utils/logger.ts apps/scraper/src/utils/logger.ts
git mv src/utils/rate-limiter.ts apps/scraper/src/utils/rate-limiter.ts
git mv src/utils/safe-extract.ts apps/scraper/src/utils/safe-extract.ts
git mv tests/socials.test.ts apps/scraper/tests/
git mv tests/safe-extract.test.ts apps/scraper/tests/
git mv tests/captcha.test.ts apps/scraper/tests/
git mv tests/rate-limiter.test.ts apps/scraper/tests/
git mv tests/osm.test.ts apps/scraper/tests/
git mv tests/chains.test.ts apps/scraper/tests/
```

- [ ] **Step 4: Recablear imports a `@leadhub/core`**

En los archivos de `apps/scraper/src`, reemplazar los imports de módulos que ahora viven en core por `@leadhub/core`. Mapa exacto:
- `web-enricher.ts`: `import { extractEmails, filterEmails, extractCuit } from '@leadhub/core';` y `import type { Enrichment, Socials } from '@leadhub/core';` (antes `../utils/email-filter.js`, `../utils/cuit.js`, `../types.js`).
- `maps-scraper.ts`: de core → `import { safeExtract } ...` NO (safeExtract es local); core aporta `parseCoordinates, dedupeLeads, dedupeMapsUrls, normalizeUrl, slugify` y tipos `Enrichment, Lead, RawBusiness, ScraperOptions`. Dejar locales: `./browser.js`, `./web-enricher.js`, `./captcha.js`, `./chains.js`, `./selectors.js`, `../utils/safe-extract.js`, `../utils/rate-limiter.js`, `../utils/logger.js`. Reemplazar el import de `../utils/geo.js`→`@leadhub/core`, `../utils/deduplicator.js`→`@leadhub/core`, `../utils/rate-limiter.js` queda local, `../utils/output-path.js`→`@leadhub/core`, `../utils/url.js`→`@leadhub/core`, `../types.js`→`@leadhub/core`.
- `osm.ts`: `import type { Lead } from '@leadhub/core';`
- `cli.ts`: `import { resolveOutputPaths, writeCsv, writeJson } from '@leadhub/core';` y `import type { ScraperOptions } from '@leadhub/core';` (antes `./utils/output-path.js`, `./exporters/csv.js`, `./exporters/json.js`, `./types.js`). Mantener `./scraper/maps-scraper.js` y `./utils/logger.js` locales.
- Tests movidos: `socials.test.ts`, `safe-extract.test.ts`, `captcha.test.ts`, `rate-limiter.test.ts`, `osm.test.ts`, `chains.test.ts` — sus imports a `../src/...` siguen válidos salvo `osm.test.ts` que importa `Lead` indirectamente (no lo hace; usa el mapper). Ajustar sólo rutas relativas que hayan cambiado de profundidad (siguen siendo `../src/...`).

- [ ] **Step 5: Borrar restos vacíos**

Run: `rm -rf src tests tsconfig.json vitest.config.ts` (del root; ya movidos). Mantener `package.json` raíz (workspace) y `pnpm-workspace.yaml`.

- [ ] **Step 6: Instalar, compilar y testear scraper**

Run: `pnpm install && pnpm --filter @leadhub/scraper build && pnpm --filter @leadhub/scraper test`
Expected: build OK; tests PASS (socials, safe-extract, captcha, rate-limiter, osm, chains).

- [ ] **Step 7: Verificar suite completa**

Run: `pnpm test`
Expected: core + scraper verdes (todos los tests migrados pasan).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: mover scraper a apps/scraper e importar @leadhub/core"
```

---

### Task 4: Scaffolding de `apps/api` (Fastify) + Postgres local

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/.env.example`, `apps/api/src/config.ts`, `apps/api/src/db/client.ts`, `apps/api/src/app.ts`, `apps/api/src/server.ts`
- Create: `docker-compose.yml` (raíz, Postgres 16)

**Interfaces:**
- Produces: `buildApp()` (Fastify instance sin escuchar), `getDb()` (Drizzle client), `config`.

- [ ] **Step 1: Crear `docker-compose.yml` (raíz)**

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: leadhub
      POSTGRES_PASSWORD: leadhub
      POSTGRES_DB: leadhub
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
volumes: { pgdata: {} }
```

- [ ] **Step 2: Crear `apps/api/package.json`**

```json
{
  "name": "@leadhub/api",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "migrate": "drizzle-kit migrate",
    "generate": "drizzle-kit generate",
    "test": "vitest run"
  },
  "dependencies": {
    "@leadhub/core": "workspace:*",
    "fastify": "^5.0.0", "@fastify/jwt": "^9.0.0", "@fastify/cors": "^10.0.0",
    "drizzle-orm": "^0.36.0", "pg": "^8.13.0", "argon2": "^0.41.0",
    "zod": "^3.23.0", "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0", "tsx": "^4.19.0", "vitest": "^4.1.0",
    "drizzle-kit": "^0.28.0", "@types/node": "^20.0.0", "@types/pg": "^8.11.0"
  }
}
```

- [ ] **Step 3: Crear `apps/api/tsconfig.json` y `vitest.config.ts`**

`tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist", "rootDir": "src" }, "include": ["src"] }
```
`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], environment: 'node', fileParallelism: false } });
```

- [ ] **Step 4: Crear `apps/api/.env.example`**

```
DATABASE_URL=postgres://leadhub:leadhub@localhost:5432/leadhub
DATABASE_URL_TEST=postgres://leadhub:leadhub@localhost:5432/leadhub_test
JWT_SECRET=dev-change-me
PORT=3001
```

- [ ] **Step 5: Crear `apps/api/src/config.ts`**

```typescript
import 'dotenv/config';

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseUrlTest: process.env.DATABASE_URL_TEST ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-change-me',
  port: Number(process.env.PORT ?? 3001),
};
```

- [ ] **Step 6: Crear `apps/api/src/db/client.ts`**

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export function makeDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  return { db: drizzle(pool), pool };
}
```

- [ ] **Step 7: Crear `apps/api/src/app.ts` y `server.ts`**

`app.ts`:
```typescript
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  app.register(cors, { origin: true });
  app.get('/health', async () => ({ ok: true, data: { status: 'up' } }));
  return app;
}
```
`server.ts`:
```typescript
import { buildApp } from './app.js';
import { config } from './config.js';

const app = buildApp();
app.listen({ port: config.port, host: '0.0.0.0' })
  .then(() => console.log(`API on :${config.port}`))
  .catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 8: Instalar, compilar, levantar Postgres**

Run: `pnpm install && docker compose up -d db && pnpm --filter @leadhub/api build`
Expected: build OK; Postgres corriendo en 5432. Crear la DB de test: `docker compose exec db psql -U leadhub -c "CREATE DATABASE leadhub_test;"` (si falla por existente, ignorar).

- [ ] **Step 9: Smoke del health**

Run: inicia `pnpm --filter @leadhub/api dev` en una terminal y en otra `curl localhost:3001/health`.
Expected: `{"ok":true,"data":{"status":"up"}}`.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(api): scaffolding Fastify + Postgres (docker-compose)"
```

---

### Task 5: Schema Drizzle + migraciones (`leads`, `accounts`, `export_logs`)

**Files:**
- Create: `apps/api/src/db/schema.ts`, `apps/api/drizzle.config.ts`
- Create (generado): `apps/api/drizzle/*` (migración SQL)

**Interfaces:**
- Consumes: `makeDb` (Task 4).
- Produces: tablas `leads`, `accounts`, `export_logs` (Drizzle `pgTable` exports), migración aplicable con `drizzle-kit migrate`.

- [ ] **Step 1: Crear `apps/api/src/db/schema.ts`**

```typescript
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  dedupKey: text('dedup_key').notNull().unique(),
  razonSocial: text('razon_social').notNull(),
  nombreFantasia: text('nombre_fantasia').notNull(),
  telefono: text('telefono').default('').notNull(),
  email: text('email').default('').notNull(),
  cuit: text('cuit').default('').notNull(),
  sitioWeb: text('sitio_web').default('').notNull(),
  direccion: text('direccion').default('').notNull(),
  localidad: text('localidad').default('').notNull(),
  provincia: text('provincia').default('').notNull(),
  categoria: text('categoria').default('').notNull(),
  calificacionGoogle: text('calificacion_google').default('').notNull(),
  cantidadResenas: integer('cantidad_resenas').default(0).notNull(),
  instagram: text('instagram').default('').notNull(),
  facebook: text('facebook').default('').notNull(),
  whatsapp: text('whatsapp').default('').notNull(),
  coordenadas: text('coordenadas').default('').notNull(),
  fuente: text('fuente').notNull(),
  fechaExtraccion: timestamp('fecha_extraccion', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nombre: text('nombre'),
  rol: text('rol').default('client').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const exportLogs = pgTable('export_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  filtros: jsonb('filtros'),
  cantidad: integer('cantidad').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Columnas generadas + tsvector + índices se agregan por SQL crudo en la migración (Step 3).
export const EXTRA_SQL = sql``;
```

- [ ] **Step 2: Crear `apps/api/drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit';
import { config } from './src/config.js';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: config.databaseUrl },
});
```

- [ ] **Step 3: Generar la migración base**

Run: `pnpm --filter @leadhub/api generate`
Expected: crea `apps/api/drizzle/0000_*.sql` con las tres tablas.

- [ ] **Step 4: Agregar columnas generadas, tsvector e índices a la migración**

Editar el `.sql` generado y agregar al final (Postgres soporta columnas generadas `STORED`):
```sql
ALTER TABLE "leads" ADD COLUMN "has_email" boolean GENERATED ALWAYS AS (email <> '') STORED;
ALTER TABLE "leads" ADD COLUMN "has_telefono" boolean GENERATED ALWAYS AS (telefono <> '') STORED;
ALTER TABLE "leads" ADD COLUMN "has_whatsapp" boolean GENERATED ALWAYS AS (whatsapp <> '') STORED;
ALTER TABLE "leads" ADD COLUMN "has_web" boolean GENERATED ALWAYS AS (sitio_web <> '') STORED;
ALTER TABLE "leads" ADD COLUMN "has_cuit" boolean GENERATED ALWAYS AS (cuit <> '') STORED;
ALTER TABLE "leads" ADD COLUMN "search_tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('spanish', coalesce(nombre_fantasia,'') || ' ' || coalesce(categoria,''))) STORED;
CREATE INDEX "leads_provincia_idx" ON "leads" ("provincia");
CREATE INDEX "leads_localidad_idx" ON "leads" ("localidad");
CREATE INDEX "leads_categoria_idx" ON "leads" ("categoria");
CREATE INDEX "leads_fuente_idx" ON "leads" ("fuente");
CREATE INDEX "leads_has_email_idx" ON "leads" ("has_email");
CREATE INDEX "leads_search_idx" ON "leads" USING GIN ("search_tsv");
```

- [ ] **Step 5: Aplicar la migración**

Run: `pnpm --filter @leadhub/api migrate`
Expected: aplica sin errores contra la DB local.

- [ ] **Step 6: Verificar el schema**

Run: `docker compose exec db psql -U leadhub -c "\d leads"`
Expected: muestra columnas incluyendo `has_email`, `search_tsv` y los índices.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(api): schema Drizzle + migración (leads/accounts/export_logs, generadas, tsvector, índices)"
```

---

### Task 6: Zod filtros en `core` + `buildLeadsQuery` puro

**Files:**
- Create: `packages/core/src/filters.ts`; export en `packages/core/src/index.ts`
- Create: `packages/core/tests/filters.test.ts`
- Create: `apps/api/src/leads/query.ts`; `apps/api/tests/query.test.ts`

**Interfaces:**
- Produces (core): `leadFiltersSchema` (Zod), `type LeadFilters`.
- Produces (api): `buildLeadsQuery(db, filters): { rows: SQL, count: SQL }` — construye la query Drizzle (sin ejecutar), inspeccionable con `.toSQL()`.

- [ ] **Step 1: Escribir el test de `leadFiltersSchema` (core)**

`packages/core/tests/filters.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { leadFiltersSchema } from '../src/filters.js';

describe('leadFiltersSchema', () => {
  it('aplica defaults de paginación', () => {
    const f = leadFiltersSchema.parse({});
    expect(f.page).toBe(1);
    expect(f.pageSize).toBe(50);
    expect(f.sort).toBe('nombre');
  });
  it('coacciona booleanos y limita pageSize a 100', () => {
    const f = leadFiltersSchema.parse({ hasEmail: 'true', pageSize: 500 });
    expect(f.hasEmail).toBe(true);
    expect(f.pageSize).toBe(100);
  });
  it('acepta arrays de facetas', () => {
    const f = leadFiltersSchema.parse({ provincia: ['Buenos Aires'], categoria: ['Mayorista'] });
    expect(f.provincia).toEqual(['Buenos Aires']);
  });
});
```

- [ ] **Step 2: Correr → falla**

Run: `pnpm --filter @leadhub/core test tests/filters.test.ts`
Expected: FAIL (módulo inexistente). (Agregar `zod` a `packages/core/package.json` dependencies: `"zod": "^3.23.0"`, luego `pnpm install`.)

- [ ] **Step 3: Implementar `packages/core/src/filters.ts`**

```typescript
import { z } from 'zod';

const boolish = z.union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true').optional();
const strArray = z.union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : [v])).optional();

export const leadFiltersSchema = z.object({
  q: z.string().trim().min(1).optional(),
  provincia: strArray,
  localidad: strArray,
  categoria: strArray,
  fuente: strArray,
  hasEmail: boolish,
  hasTelefono: boolish,
  hasWhatsapp: boolish,
  hasWeb: boolish,
  hasCuit: boolish,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.enum(['nombre', 'localidad', 'fecha']).default('nombre'),
});

export type LeadFilters = z.infer<typeof leadFiltersSchema>;
```
Agregar a `packages/core/src/index.ts`: `export * from './filters.js';`

- [ ] **Step 4: Correr → pasa; build core**

Run: `pnpm --filter @leadhub/core test tests/filters.test.ts && pnpm --filter @leadhub/core build`
Expected: PASS; build OK.

- [ ] **Step 5: Escribir el test de `buildLeadsQuery` (api)**

`apps/api/tests/query.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { leadFiltersSchema } from '@leadhub/core';
import { buildLeadsQuery } from '../src/leads/query.js';
import { makeDb } from '../src/db/client.js';
import { config } from '../src/config.js';

const { db } = makeDb(config.databaseUrlTest);

describe('buildLeadsQuery', () => {
  it('sin filtros: sin WHERE, con LIMIT/OFFSET', () => {
    const f = leadFiltersSchema.parse({});
    const { rows } = buildLeadsQuery(db, f);
    const sql = rows.toSQL().sql.toLowerCase();
    expect(sql).toContain('limit');
    expect(sql).toContain('offset');
  });
  it('hasEmail + provincia agregan condiciones', () => {
    const f = leadFiltersSchema.parse({ hasEmail: true, provincia: ['Buenos Aires'] });
    const { rows } = buildLeadsQuery(db, f);
    const sql = rows.toSQL().sql.toLowerCase();
    expect(sql).toContain('has_email');
    expect(sql).toContain('provincia');
  });
  it('q usa full-text', () => {
    const f = leadFiltersSchema.parse({ q: 'mayorista' });
    const { rows } = buildLeadsQuery(db, f);
    expect(rows.toSQL().sql.toLowerCase()).toContain('search_tsv');
  });
});
```

- [ ] **Step 6: Correr → falla**

Run: `pnpm --filter @leadhub/api test tests/query.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 7: Implementar `apps/api/src/leads/query.ts`**

```typescript
import { and, or, eq, inArray, desc, asc, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { LeadFilters } from '@leadhub/core';
import { leads } from '../db/schema.js';

function conditions(f: LeadFilters) {
  const c = [];
  if (f.q) c.push(sql`${leads.searchTsv} @@ plainto_tsquery('spanish', ${f.q})`);
  if (f.provincia?.length) c.push(inArray(leads.provincia, f.provincia));
  if (f.localidad?.length) c.push(inArray(leads.localidad, f.localidad));
  if (f.categoria?.length) c.push(inArray(leads.categoria, f.categoria));
  if (f.fuente?.length) c.push(inArray(leads.fuente, f.fuente));
  if (f.hasEmail) c.push(eq(leads.hasEmail, true));
  if (f.hasTelefono) c.push(eq(leads.hasTelefono, true));
  if (f.hasWhatsapp) c.push(eq(leads.hasWhatsapp, true));
  if (f.hasWeb) c.push(eq(leads.hasWeb, true));
  if (f.hasCuit) c.push(eq(leads.hasCuit, true));
  return c.length ? and(...c) : undefined;
}

const SORTS = {
  nombre: asc(leads.nombreFantasia),
  localidad: asc(leads.localidad),
  fecha: desc(leads.fechaExtraccion),
};

export function buildLeadsQuery(db: NodePgDatabase, f: LeadFilters) {
  const where = conditions(f);
  const rows = db.select().from(leads).where(where)
    .orderBy(SORTS[f.sort]).limit(f.pageSize).offset((f.page - 1) * f.pageSize);
  const count = db.select({ n: sql<number>`count(*)::int` }).from(leads).where(where);
  return { rows, count };
}
```
Nota: agregar a `schema.ts` los campos generados para que Drizzle los conozca (columnas `has_*` y `search_tsv`), como columnas de solo lectura:
```typescript
// dentro de leads pgTable, agregar:
hasEmail: boolean('has_email').notNull(),
hasTelefono: boolean('has_telefono').notNull(),
hasWhatsapp: boolean('has_whatsapp').notNull(),
hasWeb: boolean('has_web').notNull(),
hasCuit: boolean('has_cuit').notNull(),
searchTsv: text('search_tsv'), // se filtra vía sql`` ; tipo aproximado
```
(Estas columnas ya existen en la DB por la migración de Task 5; se agregan al schema solo para referencia en queries. No regenerar migración.)

- [ ] **Step 8: Correr → pasa**

Run: `pnpm --filter @leadhub/api test tests/query.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: filtros Zod en core + buildLeadsQuery puro"
```

---

### Task 7: Auth — hashing argon2, JWT, `/auth/login`

**Files:**
- Create: `apps/api/src/auth/password.ts`, `apps/api/src/auth/jwt-plugin.ts`, `apps/api/src/auth/routes.ts`, `apps/api/src/auth/require-auth.ts`
- Create: `apps/api/tests/password.test.ts`
- Modify: `apps/api/src/app.ts` (registrar jwt + rutas auth)

**Interfaces:**
- Produces: `hashPassword(pw): Promise<string>`, `verifyPassword(hash, pw): Promise<boolean>`; plugin JWT; ruta `POST /auth/login`; `requireAuth` (preHandler).

- [ ] **Step 1: Escribir test de password (puro)**

`apps/api/tests/password.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';

describe('password', () => {
  it('hashea y verifica correctamente', async () => {
    const h = await hashPassword('secreto123');
    expect(h).not.toBe('secreto123');
    expect(await verifyPassword(h, 'secreto123')).toBe(true);
    expect(await verifyPassword(h, 'otra')).toBe(false);
  });
});
```

- [ ] **Step 2: Correr → falla**

Run: `pnpm --filter @leadhub/api test tests/password.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `password.ts`**

```typescript
import argon2 from 'argon2';
export const hashPassword = (pw: string) => argon2.hash(pw, { type: argon2.argon2id });
export const verifyPassword = (hash: string, pw: string) => argon2.verify(hash, pw);
```

- [ ] **Step 4: Correr → pasa**

Run: `pnpm --filter @leadhub/api test tests/password.test.ts`
Expected: PASS.

- [ ] **Step 5: Implementar `jwt-plugin.ts` y `require-auth.ts`**

`jwt-plugin.ts`:
```typescript
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { config } from '../config.js';

export const jwtPlugin = fp(async (app) => {
  app.register(jwt, { secret: config.jwtSecret });
});
```
`require-auth.ts`:
```typescript
import type { FastifyReply, FastifyRequest } from 'fastify';

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ ok: false, error: 'No autorizado' });
  }
}
```
(Agregar `fastify-plugin` a dependencies.)

- [ ] **Step 6: Implementar `auth/routes.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { accounts } from '../db/schema.js';
import { verifyPassword } from './password.js';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export function authRoutes(app: FastifyInstance, db: NodePgDatabase) {
  app.post('/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Datos inválidos' });
    const { email, password } = parsed.data;
    const [acc] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
    if (!acc || !(await verifyPassword(acc.passwordHash, password))) {
      return reply.code(401).send({ ok: false, error: 'Credenciales inválidas' });
    }
    const token = app.jwt.sign({ sub: acc.id, email: acc.email, rol: acc.rol });
    return { ok: true, data: { token } };
  });

  app.get('/me', { preHandler: [async (r, rep) => {
    try { await r.jwtVerify(); } catch { rep.code(401).send({ ok: false, error: 'No autorizado' }); }
  }] }, async (req) => ({ ok: true, data: req.user }));
}
```

- [ ] **Step 7: Registrar en `app.ts`**

`buildApp` pasa a recibir `db` y registrar jwt + rutas:
```typescript
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { jwtPlugin } from './auth/jwt-plugin.js';
import { authRoutes } from './auth/routes.js';

export function buildApp(db: NodePgDatabase): FastifyInstance {
  const app = Fastify({ logger: false });
  app.register(cors, { origin: true });
  app.register(jwtPlugin);
  app.get('/health', async () => ({ ok: true, data: { status: 'up' } }));
  app.after(() => authRoutes(app, db));
  return app;
}
```
Actualizar `server.ts` para construir `db` con `makeDb(config.databaseUrl)` y pasarlo a `buildApp(db)`.

- [ ] **Step 8: Compilar**

Run: `pnpm --filter @leadhub/api build`
Expected: OK.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(api): auth argon2 + JWT + /auth/login + /me"
```

---

### Task 8: Endpoints `/leads` y `/leads/facets` (integración)

**Files:**
- Create: `apps/api/src/leads/routes.ts`; `apps/api/tests/helpers/db.ts`; `apps/api/tests/leads.test.ts`
- Modify: `apps/api/src/app.ts` (registrar rutas de leads)

**Interfaces:**
- Consumes: `buildLeadsQuery` (Task 6), `requireAuth` (Task 7), `leadFiltersSchema` (core).
- Produces: `GET /leads` (`{ items, total, page, pageSize }`), `GET /leads/facets`.

- [ ] **Step 1: Helper de test DB `apps/api/tests/helpers/db.ts`**

```typescript
import { makeDb } from '../../src/db/client.js';
import { config } from '../../src/config.js';
import { leads, accounts } from '../../src/db/schema.js';
import { hashPassword } from '../../src/auth/password.js';

export const testDbCtx = makeDb(config.databaseUrlTest);

export async function resetDb() {
  await testDbCtx.pool.query('TRUNCATE leads, accounts, export_logs RESTART IDENTITY CASCADE');
}

export async function seedLead(over: Partial<typeof leads.$inferInsert> = {}) {
  await testDbCtx.db.insert(leads).values({
    dedupKey: over.dedupKey ?? `k-${Math.round(Math.abs(Math.sin(Date.now()) * 1e9))}`,
    razonSocial: over.razonSocial ?? 'Distribuidora Test',
    nombreFantasia: over.nombreFantasia ?? 'Distribuidora Test',
    fuente: over.fuente ?? 'Google Maps',
    ...over,
  });
}

export async function seedAccount(email = 'client@test.com', pw = 'secreto123') {
  const [a] = await testDbCtx.db.insert(accounts)
    .values({ email, passwordHash: await hashPassword(pw), rol: 'client' }).returning();
  return a;
}
```
(Antes de estos tests: la DB de test debe tener las migraciones aplicadas. Agregar script raíz o correr `DATABASE_URL=$DATABASE_URL_TEST pnpm --filter @leadhub/api migrate` una vez. Documentar en el README de api.)

- [ ] **Step 2: Escribir `apps/api/tests/leads.test.ts`**

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { testDbCtx, resetDb, seedLead, seedAccount } from './helpers/db.js';

const app = buildApp(testDbCtx.db);
let token = '';

beforeAll(async () => { await app.ready(); });
beforeEach(async () => {
  await resetDb();
  await seedAccount();
  await seedLead({ dedupKey: 'a', nombreFantasia: 'Mayorista Uno', provincia: 'Buenos Aires', email: 'a@x.com' });
  await seedLead({ dedupKey: 'b', nombreFantasia: 'Ferretería Dos', provincia: 'Córdoba' });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'client@test.com', password: 'secreto123' } });
  token = res.json().data.token;
});

describe('GET /leads', () => {
  it('401 sin token', async () => {
    const res = await app.inject({ method: 'GET', url: '/leads' });
    expect(res.statusCode).toBe(401);
  });
  it('lista con total', async () => {
    const res = await app.inject({ method: 'GET', url: '/leads', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.total).toBe(2);
  });
  it('filtra por provincia y hasEmail', async () => {
    const res = await app.inject({ method: 'GET', url: '/leads?provincia=Buenos Aires&hasEmail=true', headers: { authorization: `Bearer ${token}` } });
    expect(res.json().data.total).toBe(1);
    expect(res.json().data.items[0].nombreFantasia).toBe('Mayorista Uno');
  });
});

describe('GET /leads/facets', () => {
  it('devuelve provincias con conteo', async () => {
    const res = await app.inject({ method: 'GET', url: '/leads/facets', headers: { authorization: `Bearer ${token}` } });
    const provincias = res.json().data.provincia;
    expect(provincias).toContainEqual({ value: 'Buenos Aires', count: 1 });
  });
});
```

- [ ] **Step 3: Correr → falla**

Run: `pnpm --filter @leadhub/api test tests/leads.test.ts`
Expected: FAIL (rutas inexistentes).

- [ ] **Step 4: Implementar `apps/api/src/leads/routes.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { leadFiltersSchema } from '@leadhub/core';
import { leads } from '../db/schema.js';
import { buildLeadsQuery } from './query.js';
import { requireAuth } from '../auth/require-auth.js';

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
}
```

- [ ] **Step 5: Registrar en `app.ts`**

En `buildApp`, dentro de `app.after(() => { authRoutes(app, db); leadsRoutes(app, db); })`.

- [ ] **Step 6: Correr → pasa**

Run: `pnpm --filter @leadhub/api test tests/leads.test.ts`
Expected: PASS (401, lista, filtro, facets).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(api): GET /leads (filtros+paginación) y /leads/facets"
```

---

### Task 9: `POST /leads/export` (CSV stream + export_logs)

**Files:**
- Create: `apps/api/src/leads/export.ts`; `apps/api/tests/export.test.ts`
- Modify: `apps/api/src/leads/routes.ts` (registrar la ruta)

**Interfaces:**
- Consumes: `buildLeadsQuery`, `leadToRow`/`CSV_HEADER` (core), `requireAuth`.
- Produces: `POST /leads/export` → `text/csv` con los leads filtrados (sin paginar; cap de seguridad 50k) + fila en `export_logs`.

- [ ] **Step 1: Escribir `apps/api/tests/export.test.ts`**

```typescript
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { testDbCtx, resetDb, seedLead, seedAccount } from './helpers/db.js';

const app = buildApp(testDbCtx.db);
let token = '';
beforeAll(async () => { await app.ready(); });
beforeEach(async () => {
  await resetDb(); await seedAccount();
  await seedLead({ dedupKey: 'a', nombreFantasia: 'Mayorista Uno', provincia: 'Buenos Aires', email: 'a@x.com' });
  await seedLead({ dedupKey: 'b', nombreFantasia: 'Ferretería Dos', provincia: 'Córdoba' });
  token = (await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'client@test.com', password: 'secreto123' } })).json().data.token;
});

describe('POST /leads/export', () => {
  it('devuelve CSV con header y filas filtradas', async () => {
    const res = await app.inject({ method: 'POST', url: '/leads/export?provincia=Buenos Aires', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const body = res.body;
    expect(body.split('\n')[0]).toContain('razon_social');
    expect(body).toContain('Mayorista Uno');
    expect(body).not.toContain('Ferretería Dos');
  });
  it('registra en export_logs', async () => {
    await app.inject({ method: 'POST', url: '/leads/export', headers: { authorization: `Bearer ${token}` } });
    const { rows } = await testDbCtx.pool.query('SELECT count(*)::int n FROM export_logs');
    expect(rows[0].n).toBe(1);
  });
});
```

- [ ] **Step 2: Correr → falla**

Run: `pnpm --filter @leadhub/api test tests/export.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `apps/api/src/leads/export.ts`**

```typescript
import { createObjectCsvStringifier } from 'csv-writer';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CSV_HEADER, leadToRow, type Lead } from '@leadhub/core';
import { leads } from '../db/schema.js';
import { buildLeadsQuery } from './query.js';
import type { LeadFilters } from '@leadhub/core';

const EXPORT_CAP = 50_000;

export async function exportCsv(db: NodePgDatabase, f: LeadFilters): Promise<{ csv: string; count: number }> {
  const wide = { ...f, page: 1, pageSize: EXPORT_CAP };
  const { rows } = buildLeadsQuery(db, wide);
  const items = (await rows) as unknown as Lead[];
  const stringifier = createObjectCsvStringifier({ header: CSV_HEADER });
  const csv = stringifier.getHeaderString() + stringifier.stringifyRecords(items.map(leadToRow));
  return { csv, count: items.length };
}
```

- [ ] **Step 4: Registrar la ruta en `routes.ts`**

Agregar dentro de `leadsRoutes`:
```typescript
import { exportCsv } from './export.js';
import { exportLogs } from '../db/schema.js';

app.post('/leads/export', { preHandler: [requireAuth] }, async (req, reply) => {
  const parsed = leadFiltersSchema.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Filtros inválidos' });
  const { csv, count } = await exportCsv(db, parsed.data);
  await db.insert(exportLogs).values({ accountId: (req.user as { sub: string }).sub, filtros: parsed.data, cantidad: count });
  reply.header('content-type', 'text/csv; charset=utf-8')
    .header('content-disposition', 'attachment; filename="leads.csv"').send(csv);
});
```

- [ ] **Step 5: Correr → pasa**

Run: `pnpm --filter @leadhub/api test tests/export.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(api): POST /leads/export (CSV) + export_logs"
```

---

### Task 10: Script de seed de cuentas

**Files:**
- Create: `apps/api/src/scripts/seed-account.ts`
- Modify: `apps/api/package.json` (script `seed:account`)

**Interfaces:**
- Produces: comando `pnpm --filter @leadhub/api seed:account -- <email> <password> [nombre]` que crea/actualiza una cuenta cliente.

- [ ] **Step 1: Implementar `seed-account.ts`**

```typescript
import { makeDb } from '../db/client.js';
import { config } from '../config.js';
import { accounts } from '../db/schema.js';
import { hashPassword } from '../auth/password.js';

const [email, password, nombre] = process.argv.slice(2);
if (!email || !password) { console.error('uso: seed:account <email> <password> [nombre]'); process.exit(1); }

const { db, pool } = makeDb(config.databaseUrl);
const passwordHash = await hashPassword(password);
await db.insert(accounts).values({ email, passwordHash, nombre: nombre ?? null, rol: 'client' })
  .onConflictDoUpdate({ target: accounts.email, set: { passwordHash } });
console.log(`Cuenta lista: ${email}`);
await pool.end();
```

- [ ] **Step 2: Agregar script**

En `apps/api/package.json` scripts: `"seed:account": "tsx src/scripts/seed-account.ts"`.

- [ ] **Step 3: Probar**

Run: `pnpm --filter @leadhub/api seed:account -- demo@leadhub.com demo1234 Demo`
Expected: "Cuenta lista: demo@leadhub.com".

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(api): script seed:account"
```

---

### Task 11: `apps/ingest` — upsert de leads a Postgres

**Files:**
- Create: `apps/ingest/package.json`, `apps/ingest/tsconfig.json`, `apps/ingest/vitest.config.ts`, `apps/ingest/src/upsert.ts`, `apps/ingest/src/cli.ts`, `apps/ingest/tests/upsert.test.ts`

**Interfaces:**
- Consumes: `leadKey`, tipo `Lead` (core); tabla `leads` (via drizzle-orm + pg).
- Produces: `upsertLeads(db, leads): Promise<{ inserted, updated }>`; CLI `ingest --input <json>`.

- [ ] **Step 1: Crear `apps/ingest/package.json`, `tsconfig.json`, `vitest.config.ts`**

`package.json`:
```json
{
  "name": "@leadhub/ingest",
  "version": "0.1.0",
  "type": "module",
  "bin": { "ingest": "dist/cli.js" },
  "scripts": { "build": "tsc", "dev": "tsx src/cli.ts", "test": "vitest run" },
  "dependencies": {
    "@leadhub/core": "workspace:*", "drizzle-orm": "^0.36.0", "pg": "^8.13.0", "dotenv": "^16.4.0"
  },
  "devDependencies": { "typescript": "^5.6.0", "tsx": "^4.19.0", "vitest": "^4.1.0", "@types/node": "^20.0.0", "@types/pg": "^8.11.0" }
}
```
`tsconfig.json`: extends base, outDir dist, rootDir src, include src.
`vitest.config.ts`: include tests, node env, `fileParallelism: false`.

> Nota: `upsert.ts` importa la definición de tabla `leads` desde la API. Para evitar dependencia cruzada apps→apps, copiar el `pgTable` de `leads` a `apps/ingest/src/schema.ts` (misma definición de columnas insertables que en Task 5; las generadas NO se incluyen). DRY se mantiene en `core` para la lógica; el schema Drizzle es específico por app.

- [ ] **Step 2: Escribir `apps/ingest/tests/upsert.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { upsertLeads } from '../src/upsert.js';
import { leads } from '../src/schema.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_TEST });
const db = drizzle(pool);
const mk = (over = {}) => ({
  razonSocial: 'D', nombreFantasia: 'D', telefono: '', email: '', cuit: '', sitioWeb: '',
  direccion: 'Calle 1', localidad: '', provincia: '', categoria: '', calificacionGoogle: '',
  cantidadResenas: '0', instagram: '', facebook: '', whatsapp: '', coordenadas: '',
  fuente: 'Google Maps', fechaExtraccion: '2026-06-26T00:00:00.000Z', ...over,
});

beforeEach(async () => { await pool.query('TRUNCATE leads RESTART IDENTITY CASCADE'); });

describe('upsertLeads', () => {
  it('inserta nuevos', async () => {
    const r = await upsertLeads(db, [mk(), mk({ nombreFantasia: 'E', direccion: 'Calle 2' })]);
    expect(r.inserted).toBe(2);
  });
  it('no duplica y completa campos vacíos', async () => {
    await upsertLeads(db, [mk()]);
    const r = await upsertLeads(db, [mk({ email: 'nuevo@x.com' })]);
    expect(r.inserted).toBe(0);
    expect(r.updated).toBe(1);
    const { rows } = await pool.query("SELECT email FROM leads WHERE direccion='Calle 1'");
    expect(rows[0].email).toBe('nuevo@x.com');
  });
});
```

- [ ] **Step 3: Correr → falla**

Run: `DATABASE_URL_TEST=postgres://leadhub:leadhub@localhost:5432/leadhub_test pnpm --filter @leadhub/ingest test`
Expected: FAIL. (La DB de test ya tiene la tabla `leads` por Task 5/8.)

- [ ] **Step 4: Implementar `apps/ingest/src/schema.ts`**

Copiar el `pgTable('leads', {...})` de Task 5 **sin** las columnas generadas (`has_*`, `search_tsv`). Exportar `leads`.

- [ ] **Step 5: Implementar `apps/ingest/src/upsert.ts`**

```typescript
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { leadKey, type Lead } from '@leadhub/core';
import { leads } from './schema.js';

export async function upsertLeads(db: NodePgDatabase, input: Lead[]): Promise<{ inserted: number; updated: number }> {
  let inserted = 0, updated = 0;
  for (const l of input) {
    const dedupKey = leadKey(l.nombreFantasia, l.direccion);
    const values = {
      dedupKey, razonSocial: l.razonSocial, nombreFantasia: l.nombreFantasia,
      telefono: l.telefono, email: l.email, cuit: l.cuit, sitioWeb: l.sitioWeb,
      direccion: l.direccion, localidad: l.localidad, provincia: l.provincia, categoria: l.categoria,
      calificacionGoogle: l.calificacionGoogle, cantidadResenas: Number(l.cantidadResenas) || 0,
      instagram: l.instagram, facebook: l.facebook, whatsapp: l.whatsapp, coordenadas: l.coordenadas,
      fuente: l.fuente, fechaExtraccion: l.fechaExtraccion ? new Date(l.fechaExtraccion) : null,
    };
    const res = await db.insert(leads).values(values).onConflictDoUpdate({
      target: leads.dedupKey,
      // completa solo si el existente está vacío (no pisa datos buenos)
      set: {
        telefono: sql`CASE WHEN ${leads.telefono} = '' THEN excluded.telefono ELSE ${leads.telefono} END`,
        email: sql`CASE WHEN ${leads.email} = '' THEN excluded.email ELSE ${leads.email} END`,
        cuit: sql`CASE WHEN ${leads.cuit} = '' THEN excluded.cuit ELSE ${leads.cuit} END`,
        sitioWeb: sql`CASE WHEN ${leads.sitioWeb} = '' THEN excluded.sitio_web ELSE ${leads.sitioWeb} END`,
        instagram: sql`CASE WHEN ${leads.instagram} = '' THEN excluded.instagram ELSE ${leads.instagram} END`,
        facebook: sql`CASE WHEN ${leads.facebook} = '' THEN excluded.facebook ELSE ${leads.facebook} END`,
        whatsapp: sql`CASE WHEN ${leads.whatsapp} = '' THEN excluded.whatsapp ELSE ${leads.whatsapp} END`,
        updatedAt: sql`now()`,
      },
    }).returning({ inserted: sql<boolean>`(xmax = 0)` });
    if (res[0]?.inserted) inserted++; else updated++;
  }
  return { inserted, updated };
}
```

- [ ] **Step 6: Correr → pasa**

Run: `DATABASE_URL_TEST=postgres://leadhub:leadhub@localhost:5432/leadhub_test pnpm --filter @leadhub/ingest test`
Expected: PASS.

- [ ] **Step 7: Implementar `apps/ingest/src/cli.ts`**

```typescript
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { Lead } from '@leadhub/core';
import { upsertLeads } from './upsert.js';

const idx = process.argv.indexOf('--input');
const file = idx >= 0 ? process.argv[idx + 1] : '';
if (!file) { console.error('uso: ingest --input <archivo.json>'); process.exit(1); }

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
const leads = JSON.parse(await readFile(file, 'utf8')) as Lead[];
const r = await upsertLeads(db, leads);
console.log(`Ingesta: ${r.inserted} insertados, ${r.updated} actualizados (${leads.length} entrada)`);
await pool.end();
```

- [ ] **Step 8: Probar contra la DB real**

Run: `pnpm --filter @leadhub/ingest build && pnpm --filter @leadhub/ingest dev -- --input output/localcenter_consolidado.json`
Expected: "Ingesta: 1584 insertados, 0 actualizados" (primera corrida). Correr de nuevo → 0 insertados, 1584 actualizados (idempotente).

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(ingest): upsert idempotente de leads a Postgres"
```

---

### Task 12: Scaffolding de `apps/web` (Vite + React) + login

**Files:**
- Create: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/api.ts`, `apps/web/src/auth.tsx`, `apps/web/src/pages/Login.tsx`, `apps/web/tailwind.config.js`, `apps/web/src/index.css`

**Interfaces:**
- Consumes: API (`/auth/login`, `/me`, `/leads`, `/leads/facets`, `/leads/export`).
- Produces: app React con router, cliente API tipado, contexto de auth, página de login.

- [ ] **Step 1: `apps/web/package.json`**

```json
{
  "name": "@leadhub/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite", "build": "tsc && vite build", "preview": "vite preview", "test": "vitest run" },
  "dependencies": {
    "@leadhub/core": "workspace:*",
    "react": "^18.3.0", "react-dom": "^18.3.0", "react-router-dom": "^6.27.0",
    "@tanstack/react-query": "^5.59.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0", "vite": "^5.4.0", "@vitejs/plugin-react": "^4.3.0",
    "@types/react": "^18.3.0", "@types/react-dom": "^18.3.0", "vitest": "^4.1.0",
    "tailwindcss": "^3.4.0", "postcss": "^8.4.0", "autoprefixer": "^10.4.0"
  }
}
```

- [ ] **Step 2: Config Vite/TS/Tailwind**

`vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:3001', rewrite: (p) => p.replace(/^\/api/, '') } } },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'] },
});
```
`tsconfig.json`: extends base, `jsx: react-jsx`, `moduleResolution: Bundler`, include src.
`tailwind.config.js`: content `['./index.html','./src/**/*.{ts,tsx}']`. `src/index.css` con las 3 directivas `@tailwind`. `index.html` con `<div id="root">` y `<script type="module" src="/src/main.tsx">`.

- [ ] **Step 3: Cliente API `apps/web/src/api.ts`**

```typescript
import type { Lead } from '@leadhub/core';

let token: string | null = localStorage.getItem('token');
export const setToken = (t: string | null) => { token = t; t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); };
export const getToken = () => token;

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error ?? 'Error');
  return json.data as T;
}

export const login = (email: string, password: string) => req<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export type Facets = Record<'provincia' | 'localidad' | 'categoria' | 'fuente', { value: string; count: number }[]>;
export const getFacets = () => req<Facets>('/leads/facets');
export const getLeads = (qs: string) => req<{ items: Lead[]; total: number; page: number; pageSize: number }>(`/leads?${qs}`);
export const exportUrl = (qs: string) => `/api/leads/export?${qs}`;
```

- [ ] **Step 4: Auth context `apps/web/src/auth.tsx`**

```tsx
import { createContext, useContext, useState, type ReactNode } from 'react';
import { getToken, setToken } from './api.js';

const Ctx = createContext<{ authed: boolean; signIn: (t: string) => void; signOut: () => void }>({ authed: false, signIn: () => {}, signOut: () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(!!getToken());
  return <Ctx.Provider value={{
    authed,
    signIn: (t) => { setToken(t); setAuthed(true); },
    signOut: () => { setToken(null); setAuthed(false); },
  }}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 5: `main.tsx` + `pages/Login.tsx`**

`main.tsx` monta `QueryClientProvider` + `BrowserRouter` + `AuthProvider`, con rutas `/login` → `<Login/>` y `/` → (Task 13) protegida (si `!authed` redirige a `/login`).
`Login.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api.js';
import { useAuth } from '../auth.js';

export default function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    try { const { token } = await login(email, pw); signIn(token); nav('/'); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <form onSubmit={submit} className="max-w-sm mx-auto mt-24 space-y-3 p-6">
      <h1 className="text-2xl font-bold">LeadHub</h1>
      <input className="border p-2 w-full" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="border p-2 w-full" type="password" placeholder="Contraseña" value={pw} onChange={(e) => setPw(e.target.value)} />
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <button className="bg-black text-white px-4 py-2 rounded w-full">Entrar</button>
    </form>
  );
}
```

- [ ] **Step 6: Instalar y correr dev**

Run: `pnpm install && pnpm --filter @leadhub/web dev` (con la API corriendo en :3001).
Expected: abre :5173; login con la cuenta sembrada (Task 10) redirige a `/` sin error de red.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(web): scaffolding Vite+React, cliente API, auth y login"
```

---

### Task 13: UI — explorador (filtros + tabla + facets + URL sync)

**Files:**
- Create: `apps/web/src/pages/Explorer.tsx`, `apps/web/src/components/Filters.tsx`, `apps/web/src/components/LeadsTable.tsx`, `apps/web/src/useFilters.ts`, `apps/web/src/useFilters.test.ts`
- Modify: `apps/web/src/main.tsx` (ruta `/` protegida → `<Explorer/>`)

**Interfaces:**
- Consumes: `getLeads`, `getFacets` (Task 12), `leadFiltersSchema` (core).
- Produces: hook `useFilters()` (sincroniza filtros ↔ query params) y las pantallas.

- [ ] **Step 1: Escribir `apps/web/src/useFilters.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { filtersToQuery, queryToFilters } from './useFilters.js';

describe('useFilters serialización', () => {
  it('filtros → query string', () => {
    const qs = filtersToQuery({ provincia: ['Buenos Aires'], hasEmail: true, page: 2 });
    expect(qs).toContain('provincia=Buenos+Aires');
    expect(qs).toContain('hasEmail=true');
    expect(qs).toContain('page=2');
  });
  it('query string → filtros (arrays repetidos)', () => {
    const f = queryToFilters(new URLSearchParams('provincia=A&provincia=B&hasEmail=true'));
    expect(f.provincia).toEqual(['A', 'B']);
    expect(f.hasEmail).toBe(true);
  });
});
```

- [ ] **Step 2: Correr → falla**

Run: `pnpm --filter @leadhub/web test src/useFilters.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `apps/web/src/useFilters.ts`**

```typescript
import { useSearchParams } from 'react-router-dom';

export type UiFilters = {
  q?: string; provincia?: string[]; localidad?: string[]; categoria?: string[]; fuente?: string[];
  hasEmail?: boolean; hasTelefono?: boolean; hasWhatsapp?: boolean; hasWeb?: boolean; hasCuit?: boolean;
  page?: number; sort?: string;
};
const ARRAYS = ['provincia', 'localidad', 'categoria', 'fuente'] as const;
const BOOLS = ['hasEmail', 'hasTelefono', 'hasWhatsapp', 'hasWeb', 'hasCuit'] as const;

export function filtersToQuery(f: UiFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  for (const k of ARRAYS) (f[k] ?? []).forEach((v) => p.append(k, v));
  for (const k of BOOLS) if (f[k]) p.set(k, 'true');
  if (f.page && f.page > 1) p.set('page', String(f.page));
  if (f.sort) p.set('sort', f.sort);
  return p.toString();
}
export function queryToFilters(p: URLSearchParams): UiFilters {
  const f: UiFilters = {};
  if (p.get('q')) f.q = p.get('q')!;
  for (const k of ARRAYS) { const vs = p.getAll(k); if (vs.length) f[k] = vs; }
  for (const k of BOOLS) if (p.get(k) === 'true') f[k] = true;
  if (p.get('page')) f.page = Number(p.get('page'));
  if (p.get('sort')) f.sort = p.get('sort')!;
  return f;
}
export function useFilters(): [UiFilters, (f: UiFilters) => void] {
  const [params, setParams] = useSearchParams();
  return [queryToFilters(params), (f) => setParams(filtersToQuery(f))];
}
```

- [ ] **Step 4: Correr → pasa**

Run: `pnpm --filter @leadhub/web test src/useFilters.test.ts`
Expected: PASS.

- [ ] **Step 5: Implementar `Filters.tsx`, `LeadsTable.tsx`, `Explorer.tsx`**

`Filters.tsx`: recibe `facets` y `[filters, setFilters]`; input de texto (setea `q`), grupos de checkboxes para provincia/localidad/categoría/fuente (desde facets, con conteo), y toggles para los `has*`. Cada cambio llama `setFilters({ ...filters, <campo>, page: 1 })`.
`LeadsTable.tsx`: recibe `items` y renderiza `<table>` con columnas razón social, categoría, localidad/provincia, teléfono, email, CUIT, fuente; links a IG/FB/WA si existen.
`Explorer.tsx`:
```tsx
import { useQuery } from '@tanstack/react-query';
import { getFacets, getLeads, exportUrl } from '../api.js';
import { useFilters, filtersToQuery } from '../useFilters.js';
import Filters from '../components/Filters.js';
import LeadsTable from '../components/LeadsTable.js';

export default function Explorer() {
  const [filters, setFilters] = useFilters();
  const qs = filtersToQuery(filters);
  const facets = useQuery({ queryKey: ['facets'], queryFn: getFacets });
  const leads = useQuery({ queryKey: ['leads', qs], queryFn: () => getLeads(qs) });
  return (
    <div className="flex gap-6 p-6">
      <aside className="w-72 shrink-0">
        {facets.data && <Filters facets={facets.data} filters={filters} setFilters={setFilters} />}
      </aside>
      <main className="flex-1">
        <div className="flex justify-between items-center mb-3">
          <span>{leads.data?.total ?? 0} resultados</span>
          <a href={exportUrl(qs)} className="bg-black text-white px-4 py-2 rounded">Exportar CSV</a>
        </div>
        {leads.data && <LeadsTable items={leads.data.items} />}
      </main>
    </div>
  );
}
```
(Nota: el link de export debe incluir el token. Como es una `<a>` GET-visible y la ruta es POST con auth Bearer, cambiar el botón por un handler que hace `fetch(exportUrl, { method:'POST', headers:{authorization} })`, recibe el blob y dispara descarga. Implementar `downloadCsv(qs)` en `api.ts` que hace el POST con el header y `URL.createObjectURL`.)

- [ ] **Step 6: Implementar `downloadCsv` en `api.ts`**

```typescript
export async function downloadCsv(qs: string) {
  const res = await fetch(`/api/leads/export?${qs}`, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} });
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'leads.csv'; a.click();
  URL.revokeObjectURL(a.href);
}
```
Y en `Explorer.tsx` reemplazar la `<a>` por `<button onClick={() => downloadCsv(qs)}>`.

- [ ] **Step 7: Ruta protegida en `main.tsx`**

Ruta `/` renderiza `<Explorer/>` solo si `useAuth().authed`, si no `<Navigate to="/login" />`.

- [ ] **Step 8: Verificar build + dev**

Run: `pnpm --filter @leadhub/web build`
Expected: compila. En dev: login → se ven facets, tabla poblada, filtros actualizan la URL y la tabla, botón exporta CSV.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(web): explorador con filtros, tabla, facets, URL sync y export"
```

---

### Task 14: E2E login → filtrar → exportar (Playwright)

**Files:**
- Create: `apps/web/e2e/flow.spec.ts`, `apps/web/playwright.config.ts`
- Modify: `apps/web/package.json` (script `e2e`)

**Interfaces:**
- Consumes: API + web corriendo; cuenta sembrada.
- Produces: test E2E del flujo crítico.

- [ ] **Step 1: `playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
});
```
Agregar script `"e2e": "playwright test"` y devDep `@playwright/test`.

- [ ] **Step 2: Escribir `apps/web/e2e/flow.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test('login, filtra y exporta', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('demo@leadhub.com');
  await page.getByPlaceholder('Contraseña').fill('demo1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText(/resultados/)).toBeVisible();
  await page.getByLabel('con email').check();
  await expect(page).toHaveURL(/hasEmail=true/);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('leads.csv');
});
```
(Requisito: el toggle "con email" debe tener `aria-label="con email"` en `Filters.tsx`.)

- [ ] **Step 3: Correr E2E**

Run: con API (:3001), web (:5173) y DB sembrada corriendo: `pnpm --filter @leadhub/web e2e`
Expected: PASS (login, filtro refleja en URL, descarga `leads.csv`).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test(web): E2E login → filtrar → exportar"
```

---

### Task 15: README y verificación end-to-end

**Files:**
- Create: `README.md` (raíz, cómo levantar todo), `apps/api/README.md` (migraciones/seed/test DB)

**Interfaces:**
- Produces: documentación de arranque y un checklist verificado.

- [ ] **Step 1: Escribir `README.md` raíz**

Documentar: requisitos (Node 20, pnpm, Docker), pasos: `pnpm install`, `docker compose up -d db`, crear DB de test, `pnpm --filter @leadhub/api migrate`, `... seed:account`, `... ingest --input output/localcenter_consolidado.json`, `pnpm --filter @leadhub/api dev`, `pnpm --filter @leadhub/web dev`. Incluir el mapa de paquetes.

- [ ] **Step 2: Verificar el criterio de éxito del spec**

Ejecutar en orden y confirmar:
```bash
pnpm install
docker compose up -d db
docker compose exec db psql -U leadhub -c "CREATE DATABASE leadhub_test;" || true
pnpm --filter @leadhub/api migrate
DATABASE_URL=$DATABASE_URL_TEST pnpm --filter @leadhub/api migrate
pnpm --filter @leadhub/api seed:account -- demo@leadhub.com demo1234 Demo
pnpm --filter @leadhub/ingest build && pnpm --filter @leadhub/ingest dev -- --input output/localcenter_consolidado.json
pnpm test
```
Expected: ingesta ~1584 insertados; toda la suite (core+scraper+api+ingest+web) verde.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "docs: README de arranque + verificación end-to-end"
```

---

## Self-Review

**Spec coverage:**
- Monorepo + extracción core → Tasks 1–3 ✓
- DB (leads/accounts/export_logs, generadas, tsvector, índices) → Task 5 ✓
- Filtros Zod compartidos + buildLeadsQuery → Task 6 ✓
- Auth JWT + argon2 + login → Task 7 ✓
- `/leads` + `/leads/facets` → Task 8 ✓
- `/leads/export` + export_logs → Task 9 ✓
- Cuentas sembradas → Task 10 ✓
- Ingesta upsert idempotente → Task 11 ✓
- UI login → Task 12 ✓; explorador filtros/tabla/facets/URL/export → Task 13 ✓
- Testing (core movido, api integración, ingest, web unit + E2E) → Tasks 2,3,6–9,11,13,14 ✓
- Fuera de alcance (billing/signup/on-demand) → respetado (no hay tareas) ✓

**Placeholder scan:** sin TBD/TODO; código completo en cada step.

**Type consistency:** `leadFiltersSchema`/`LeadFilters` (core) consumidos por `buildLeadsQuery` (api) y `useFilters` (web); `leadKey`, `leadToRow`, `CSV_HEADER`, `Lead` de core usados por ingest/api; tabla `leads` con las mismas columnas insertables en api (Task 5) e ingest (Task 11); envelope `{ ok, data, error }` consistente en todos los endpoints.

**Nota de riesgo conocida:** la columna `search_tsv` se referencia en `schema.ts` (Task 6) como `text` aproximado solo para poder filtrar vía `sql\`\``; el filtro real usa `plainto_tsquery`. Si Drizzle se queja del tipo, filtrar con `sql\`search_tsv @@ ...\`` por nombre de columna en vez de la referencia tipada.
