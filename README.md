# LeadHub

Monorepo para extraer, almacenar y explorar leads de negocios scrapeados de Google Maps.

`@leadhub/scraper` extrae negocios de Google Maps con Playwright y los deja en `output/*.json`.
`@leadhub/ingest` toma ese JSON y hace upsert idempotente contra Postgres.
`@leadhub/api` expone los leads vía HTTP (auth JWT, filtros, facets, export CSV) sobre esa misma base.
`@leadhub/web` es el explorador (login + tabla + filtros + facets + export) que consume la API.
`@leadhub/core` es la lógica pura (dedup, filtros, CSV/JSON, geo, CUIT, etc.) compartida por scraper, ingest, api y web.

## Mapa de paquetes

| Paquete | Ruta | Qué hace |
|---|---|---|
| `@leadhub/core` | `packages/core` | Lógica pura: dedup, filtros Zod (`leadFiltersSchema`), CUIT, email/URL, geo, export CSV/JSON. Sin I/O. |
| `@leadhub/scraper` | `apps/scraper` | CLI de scraping con Playwright (`maps-scraper search ...`). |
| `@leadhub/api` | `apps/api` | Fastify + Drizzle + JWT. Endpoints `/auth/login`, `/me`, `/leads`, `/leads/facets`, `/leads/export`. |
| `@leadhub/ingest` | `apps/ingest` | CLI que hace upsert idempotente de un JSON de leads a Postgres (`leadKey` como clave de dedup). |
| `@leadhub/web` | `apps/web` | React + Vite: login y explorador de leads (filtros, tabla, facets, sync con URL, export). |

## Prerrequisitos

- Node 20+
- pnpm
- Docker (para Postgres vía `docker-compose.yml`)

## Puesta en marcha

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Levantar Postgres

```bash
docker compose up -d db
```

Postgres queda expuesto en el **puerto host 5544** (remapeado desde el 5432 del contenedor porque el 5432
puede estar ocupado en el host — ver `docker-compose.yml`). Usuario/clave/DB: `leadhub` / `leadhub` / `leadhub`.

### 3. Crear la base de test

```bash
docker compose exec db psql -U leadhub -c "CREATE DATABASE leadhub_test;"
```

### 4. Configurar variables de entorno

Copiar `apps/api/.env.example` a `apps/api/.env`:

```bash
DATABASE_URL=postgres://leadhub:leadhub@localhost:5544/leadhub
DATABASE_URL_TEST=postgres://leadhub:leadhub@localhost:5544/leadhub_test
JWT_SECRET=dev-change-me
PORT=3001
```

`@leadhub/ingest` no tiene `.env.example` propio; crear `apps/ingest/.env` con las mismas dos primeras
líneas (`DATABASE_URL` y `DATABASE_URL_TEST`), que es todo lo que usa.

No commitear ningún `.env`.

### 5. Migrar ambas bases

```bash
pnpm --filter @leadhub/api migrate
DATABASE_URL=postgres://leadhub:leadhub@localhost:5544/leadhub_test pnpm --filter @leadhub/api migrate
```

La segunda invocación migra `leadhub_test` sobreescribiendo `DATABASE_URL` solo para ese comando (drizzle-kit
lee `DATABASE_URL` vía `apps/api/src/config.ts`).

### 6. Sembrar una cuenta

```bash
pnpm --filter @leadhub/api seed:account demo@leadhub.com demo1234 Demo
```

Cuenta de referencia usada en desarrollo y E2E: `demo@leadhub.com` / `demo1234`.

### 7. Ingestar leads

El CLI de ingest resuelve `--input` relativo a su propio cwd, así que conviene correrlo desde `apps/ingest`
con una ruta absoluta (o relativa desde ahí) al JSON generado por el scraper:

```bash
pnpm --filter @leadhub/ingest build
cd apps/ingest && pnpm dev -- --input /Users/ema/Desktop/google-maps-clients/output/localcenter_consolidado.json
```

El comando imprime cuántos leads insertó/actualizó (idempotente: correrlo de nuevo actualiza en vez de duplicar).

### 8. Levantar la API

```bash
pnpm --filter @leadhub/api dev
```

El **puerto 3001 puede estar ocupado** por otro servicio del host (en esta máquina lo usa un bridge de
WhatsApp gestionado por PM2 que se auto-reinicia). Si 3001 está tomado, arrancar la API en otro puerto:

```bash
PORT=4501 pnpm --filter @leadhub/api dev
```

### 9. Levantar el web

```bash
pnpm --filter @leadhub/web dev
```

El proxy de Vite (`/api` → API) apunta a `http://localhost:3001` por defecto. Si la API corre en otro
puerto (paso 8), indicárselo:

```bash
VITE_API_PROXY_TARGET=http://localhost:4501 pnpm --filter @leadhub/web dev
```

La app queda en `http://localhost:5173`.

## Tests

```bash
pnpm test
```

Corre `vitest run` en todos los paquetes (`pnpm -r test`). `@leadhub/api` y `@leadhub/ingest` necesitan
Postgres levantado y `DATABASE_URL_TEST` presente en el entorno (además de `DATABASE_URL` para scripts que
lo usan). Si esas variables no están seteadas en el shell —no alcanza con que estén solo en `apps/*/.env` para
`@leadhub/ingest`—, sus tests fallan al no poder conectarse. Ejemplo para correr todo con las variables
explícitas:

```bash
export DATABASE_URL=postgres://leadhub:leadhub@localhost:5544/leadhub
export DATABASE_URL_TEST=postgres://leadhub:leadhub@localhost:5544/leadhub_test
pnpm test
```

Por paquete:

```bash
pnpm --filter @leadhub/core test       # 27 tests, sin dependencias externas
pnpm --filter @leadhub/scraper test    # 20 tests, sin dependencias externas
pnpm --filter @leadhub/api test        # requiere Postgres + DATABASE_URL_TEST
pnpm --filter @leadhub/ingest test     # requiere Postgres + DATABASE_URL_TEST
pnpm --filter @leadhub/web test        # unit tests (vitest + jsdom)
```

Ver `apps/api/README.md` para el detalle de migraciones/seed/tests de la API.

## E2E

```bash
pnpm --filter @leadhub/web e2e
```

Playwright levanta la API compilada (`apps/api/dist/server.js`) en el puerto 4501 y el dev server del web en
5173 (ver `apps/web/playwright.config.ts`), y corre el flujo login → filtrar → exportar contra Postgres real.
Requiere haber corrido `pnpm --filter @leadhub/api build` antes y tener Postgres levantado con datos (o al
menos la cuenta sembrada en el paso 6).
