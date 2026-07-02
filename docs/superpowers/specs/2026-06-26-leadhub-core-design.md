# LeadHub Core — Diseño (DB + API + UI)

**Fecha:** 2026-06-26
**Estado:** Aprobado para planificación
**Slice:** Core del SaaS (primer entregable). Billing, cuotas, signup público y back-office avanzado son slices posteriores.

## Objetivo

Convertir el scraper `maps-scraper` (CLI) en producto: un marketplace de leads donde
clientes autenticados **filtran y exportan** prospectos de un catálogo central.
El scraping sigue siendo **back-office** (no cambia) y alimenta la base mediante una ingesta.

## Decisiones del brainstorm

| Tema | Decisión |
|------|----------|
| Modelo de negocio | SaaS multi-tenant, **marketplace de base de leads** (no scraping on-demand por cliente) |
| Primer slice | Core: **DB + API + UI de filtrado/export** con auth básica |
| Backend / DB | **Node/TS (Fastify) + PostgreSQL** (Drizzle ORM + migraciones) |
| Frontend | **React + Vite** |
| Auth | **email/password + JWT**, cuentas **sembradas** (sin signup público aún); cuenta = tenant |
| Gating | **Sin límite de export** por ahora; modelo de datos listo para cuotas |
| Estructura | **Monorepo pnpm**; se extrae la lógica pura ya testeada a `packages/core` |

## Arquitectura / monorepo

```
packages/core/     types (Lead), deduplicator, cuit, email-filter, url, geo, csv-map, filtros (Zod)  [ya testeado]
apps/scraper/      Playwright + CLI actual (importa core)
apps/ingest/       comando: lee output JSON → upsert a Postgres
apps/api/          Fastify + Postgres (Drizzle + migraciones)
apps/web/          React + Vite (tabla, filtros, export)
```

La lógica pura ya testeada (types, deduplicator, cuit, email-filter, url, geo, output-path,
y el mapeo `leadToRow`) se **muda a `packages/core` sin cambios de comportamiento**. El scraper y
la API la importan. Los tests existentes (44) se mueven con el código.

**Multi-tenancy liviana:** los `leads` son **catálogo compartido de solo lectura** para todos los
tenants. El tenant solo tiene su cuenta y su historial de exports. Las cuotas futuras se calculan
sobre `export_logs`.

## Modelo de datos (PostgreSQL / Drizzle)

### `leads`
```
id                  uuid pk default gen_random_uuid()
dedup_key           text unique not null    -- norm(nombre)+'|'+norm(direccion)
razon_social        text not null
nombre_fantasia     text not null
telefono            text default ''
email               text default ''
cuit                text default ''
sitio_web           text default ''
direccion           text default ''
localidad           text default ''
provincia           text default ''
categoria           text default ''
calificacion_google text default ''
cantidad_resenas    integer default 0
instagram           text default ''
facebook            text default ''
whatsapp            text default ''
coordenadas         text default ''          -- "lat,lng"
fuente              text not null            -- Google Maps | OpenStreetMap | CADAM
fecha_extraccion    timestamptz
created_at          timestamptz default now()
updated_at          timestamptz default now()
has_email           boolean generated as (email <> '')
has_telefono        boolean generated as (telefono <> '')
has_whatsapp        boolean generated as (whatsapp <> '')
has_web             boolean generated as (sitio_web <> '')
has_cuit            boolean generated as (cuit <> '')
search_tsv          tsvector                 -- to_tsvector('spanish', nombre_fantasia || ' ' || categoria)
```
Índices: btree en `provincia`, `localidad`, `categoria`, `fuente`, y en los `has_*`;
GIN en `search_tsv`; único en `dedup_key`.

### `accounts`
```
id            uuid pk
email         text unique not null
password_hash text not null            -- argon2id
nombre        text
rol           text default 'client'    -- client | admin
created_at    timestamptz default now()
```

### `export_logs`
```
id         uuid pk
account_id uuid fk -> accounts.id
filtros    jsonb
cantidad   integer
created_at timestamptz default now()
```

## API (Fastify + JWT)

Envelope de respuesta consistente: `{ ok: boolean, data?: T, error?: string }`.
Validación de entrada con **Zod** en cada endpoint. JWT (access token) en `Authorization: Bearer`.

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/login` | no | `{email,password}` → `{ token }` (verifica argon2) |
| GET | `/me` | sí | datos de la cuenta actual |
| GET | `/leads` | sí | lista paginada + `total`; acepta filtros |
| GET | `/leads/facets` | sí | valores distintos con conteo (provincia, localidad, categoría, fuente) |
| POST | `/leads/export` | sí | CSV (stream) del resultado filtrado; escribe `export_logs` |

### Filtros (compartidos por `/leads` y `/leads/export`)
Definidos como **Zod schema en `core`** (compartido con el front):
```
q?: string                 // full-text sobre search_tsv
provincia?: string[]
localidad?: string[]
categoria?: string[]
fuente?: string[]
hasEmail?: boolean
hasTelefono?: boolean
hasWhatsapp?: boolean
hasWeb?: boolean
hasCuit?: boolean
page?: number (default 1)
pageSize?: number (default 50, máx 100)
sort?: 'nombre' | 'localidad' | 'fecha'   // default 'nombre'
```

### Núcleo testeable
`buildLeadsQuery(filters)` **puro**: traduce el objeto de filtros a una query Drizzle
(sin ejecutar I/O), testeable inspeccionando el SQL generado (`.toSQL()`). El handler solo valida (Zod), llama a
`buildLeadsQuery`, ejecuta y arma el envelope.

### Errores
- 400: validación Zod (mensaje claro por campo).
- 401: token ausente/ inválido.
- 429: reservado para cuotas (no activo en este slice).
- 500: error interno (log detallado en server, mensaje genérico al cliente).

## UI (React + Vite)

SPA "tabla + filtros + export", diseño intencional (no template genérico) pero acotado al MVP.

- **Login**: email/password → JWT (en memoria; refresh liviano en `localStorage`). Redirige al explorador.
- **Explorador** (pantalla principal):
  - **Panel de filtros**: búsqueda de texto; multiselect de provincia / localidad / categoría / fuente
    (poblados desde `/leads/facets`); toggles `con email / teléfono / WhatsApp / web / CUIT`.
  - **Tabla** paginada server-side: razón social, categoría, localidad/provincia, teléfono, email,
    CUIT, fuente, íconos de redes. Ordenable; `total` visible.
  - **Acciones**: "Exportar CSV" (respeta filtros activos), contador de resultados.
- **Estado**: TanStack Query para server-state; **filtros en la URL** (query params) → búsquedas
  compartibles/bookmarkeables.
- **Cliente API tipado** que reusa el Zod schema de filtros de `core`.
- Estilos con Tailwind + tabla propia (sin librería de componentes pesada).

## Ingesta (`apps/ingest`)

```
ingest --input output/localcenter_consolidado.json
```
- Lee el JSON de salida del scraper (array de `Lead`).
- Calcula `dedup_key` reusando `deduplicator` de `core`.
- **Upsert** por `dedup_key` (`INSERT ... ON CONFLICT (dedup_key) DO UPDATE`):
  - nuevos → insert;
  - existentes → **completa solo campos vacíos** (no pisa datos con valores vacíos), refresca `updated_at`.
- Deriva `search_tsv`; castea `cantidad_resenas` (int) y `fecha_extraccion` (timestamptz);
  `has_*` son columnas generadas (no se setean).
- Reporta: insertados / actualizados / sin cambios. Idempotente (correrlo dos veces no duplica).

## Testing

- **`core`**: 44 tests existentes se mueven sin cambios.
- **`api`**:
  - `buildLeadsQuery(filters)` puro → unit tests por filtro y combinaciones.
  - Integración de `/auth/login`, `/leads` (paginación + filtros), `/leads/export` (CSV) contra
    un **Postgres de test** (Testcontainers o DB dedicada) con seed fijo.
- **`ingest`**: upsert (inserta / completa vacíos / no duplica) contra DB de test.
- **`web`**: unit del sync filtros↔URL; E2E liviano (Playwright, ya en el repo) login → filtrar → exportar.
- Runner: Vitest. Cobertura foco en lógica de filtros y flujos críticos.

## Fuera de alcance (slices posteriores)

- Billing, planes y cuotas de export (el modelo de datos ya lo soporta vía `export_logs`).
- Signup público y verificación de email.
- Scraping on-demand por cliente / cola de jobs.
- Panel de back-office avanzado (hoy la ingesta es por comando).

## Criterio de éxito

1. `ingest --input output/localcenter_consolidado.json` carga los 1.584 leads a Postgres (idempotente).
2. Login con una cuenta sembrada devuelve JWT.
3. `GET /leads?provincia=Buenos Aires&hasEmail=true&categoria=Mayorista` devuelve resultados
   paginados con `total` correcto.
4. La UI permite filtrar por rubro/zona/contacto y **exportar un CSV** que respeta los filtros.
5. Re-ingestar no duplica y completa campos faltantes.

## Riesgos

- **Mudanza a monorepo**: mover `core` puede romper imports/paths del scraper; se hace con cuidado,
  verificando que los 44 tests siguen verdes antes de avanzar.
- **Full-text español**: `search_tsv` requiere configuración `spanish`; validar acentos/stemming.
- **Export grande**: el CSV debe streamear (no cargar todo en memoria) para filtros amplios.
