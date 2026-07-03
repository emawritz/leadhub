# Scrape-on-demand desde la UI — Diseño

**Fecha:** 2026-06-26
**Estado:** Aprobado para planificación
**Slice:** Operar el scraper desde la web (buscar en Google Maps y ver el job en vivo). Se suma a LeadHub Core (catálogo/explorador), no lo reemplaza.

## Objetivo

Dar una superficie **Buscar** en la web: cargar query + zona + flags, apretar "Buscar en
Google Maps", ver el job correr **en vivo** (contador de progreso), y que al terminar los
leads entren solos a la base y aparezcan en **Explorar**.

## Decisiones del brainstorm

| Tema | Decisión |
|------|----------|
| Progreso | **Vivo** (contador done/total en tiempo real) vía NDJSON del scraper → DB → polling en la UI |
| Browser | **Headless** por defecto (perfil persistente logueado); CAPTCHA → job en error con hint |
| Ejecución | **Worker in-process, concurrencia 1** (serializa: anti-bot + un solo perfil de Google) |
| Cola | En memoria + fila `scrape_jobs` en DB como fuente de verdad (historial sobrevive reinicio) |
| Ingesta | **Automática** al terminar, importando `upsertLeads` de `@leadhub/ingest` (sin subproceso) |
| Transporte UI | **Polling** cada 2s (sin SSE) |

## Arquitectura

```
apps/api/  (nuevo módulo src/scrape/)
   schema: tabla scrape_jobs
   rutas:  POST /scrape (crea+encola), GET /scrape (lista), GET /scrape/:id   [requireAuth]
   worker: cola en memoria, 1 job a la vez
     → spawn: node <scraper>/dist/cli.js search --query .. --location .. --max ..
              [--enrich] [--exclude-chains] --progress-json --output output/jobs/<id>.json
     → parsea NDJSON de stdout del scraper → update scrape_jobs (phase/done/total)
     → al cerrar 0: lee el JSON, upsertLeads(db, leads) → inserted/updated/leadsFound → status done
     → al cerrar !=0 o CAPTCHA: status error + mensaje
apps/scraper/  (flag --progress-json)
   runScrape gana onProgress?(ev) opcional; el CLI, con --progress-json, emite NDJSON a stdout
   y manda los logs humanos (chalk/barra) a stderr para no ensuciar el stdout
apps/web/  (página /buscar)
   form (query, location, max, enrich, exclude-chains) + botón "Buscar en Google Maps"
   lista de jobs con badge de estado + barra done/total (poll 2s); al done link a Explorar
```

Requisito de despliegue: la API y el scraper corren en la **misma máquina** (la que tiene el
perfil de browser). El worker spawnea el scraper con `cwd = raíz del repo` para que `.cache/`
y `output/` resuelvan igual que en la CLI.

## Modelo de datos

### `scrape_jobs`
```
id             uuid pk
account_id     uuid fk -> accounts.id      -- quién lo lanzó
query          text not null
location       text not null
max            integer not null default 40
enrich         boolean not null default true
exclude_chains boolean not null default true
status         text not null default 'queued'   -- queued | running | done | error
phase          text not null default ''          -- collect | visit | enrich | export
done           integer not null default 0
total          integer not null default 0
leads_found    integer not null default 0
inserted       integer not null default 0
updated        integer not null default 0
error          text not null default ''
output_path    text not null default ''
created_at     timestamptz not null default now()
started_at     timestamptz
finished_at    timestamptz
```
Migración Drizzle nueva (no toca las tablas existentes).

## Protocolo de progreso (NDJSON)

El scraper con `--progress-json` emite **una línea JSON por evento** a stdout:
```
{"phase":"collect","total":40}
{"phase":"visit","done":1,"total":40}
{"phase":"visit","done":23,"total":40}
{"phase":"done","leadsFound":37}
```
- `parseProgressLine(line): ProgressEvent | null` (puro): parsea una línea; devuelve `null`
  si no es JSON válido o no tiene `phase` (así ignora ruido).
- El worker actualiza `scrape_jobs.phase/done/total` en cada evento (throttle ~1/seg para no
  martillar la DB). Los logs humanos van por **stderr** (no interfieren).

## API (Fastify, JWT)

Envelope `{ ok, data, error }`; validación Zod; `requireAuth` en todas.

| Método | Ruta | Body/Params | Descripción |
|---|---|---|---|
| POST | `/scrape` | `{ query, location, max?, enrich?, excludeChains? }` | crea job (status `queued`), lo encola, devuelve el job |
| GET | `/scrape` | — | lista los últimos 50 jobs (más nuevos primero) |
| GET | `/scrape/:id` | — | un job (para polling) |

`scrapeInputSchema` (Zod): `query` y `location` requeridos no vacíos; `max` int 1..120 default 40;
`enrich`/`excludeChains` bool default true.

## Worker

`src/scrape/worker.ts`: cola en memoria (array de jobIds) + flag `processing`. Al encolar, si no
hay job corriendo, arranca el siguiente. Concurrencia 1.

**Runner inyectable** para testeo: `createWorker({ db, runJob })` donde `runJob(job, hooks)`
hace el trabajo real. En tests se inyecta un `runJob` falso (no spawnea Playwright); en producción
`runJob` = `spawnScraperAndIngest` (spawn + parseo NDJSON + `upsertLeads`).

**Real (`spawnScraperAndIngest`):**
1. `status=running`, `started_at=now`.
2. spawn del scraper CLI con los flags + `--progress-json --output output/jobs/<id>.json`, `cwd=repoRoot`.
3. por cada línea de stdout: `parseProgressLine` → si evento, update `phase/done/total` (throttle).
4. cierre 0 → leer el JSON de salida → `upsertLeads(db, leads)` → set `leadsFound/inserted/updated`,
   `status=done`, `finished_at`.
5. cierre !=0 → `status=error`, `error` = últimas líneas de stderr; si contiene "CAPTCHA" o "unusual
   traffic", mensaje amigable: "Google pidió verificación — corré el scraper con --headed una vez
   para reautenticar el perfil".

## UI (React + Vite)

Nueva ruta **`/buscar`** (protegida) + nav entre **Explorar** y **Buscar**.

- **Formulario**: `query`, `location` (texto), `max` (número, default 40), `enrich` (checkbox,
  default on), `exclude-chains` (checkbox, default on). Botón "Buscar en Google Maps" → `POST /scrape`.
- **Lista de jobs** (debajo): `GET /scrape` con `refetchInterval: 2000` (TanStack Query). Cada job:
  `query @ location`, badge de estado, barra `done/total` cuando corre, `"N encontrados · X nuevos"`
  cuando `done`, y el `error` cuando falla. En `done`, botón **"Ver en el explorador"** → navega a `/`.
- `api.ts`: `createScrape(body)`, `listScrapes()`.

## Testing

- `parseProgressLine` (puro, en api `src/scrape/progress.ts`) → unit: JSON válido, línea de ruido → null,
  falta `phase` → null.
- `scrapeInputSchema` (Zod) → unit: defaults, requeridos, cap de `max`.
- Worker/endpoints → integración contra `leadhub_test` con `runJob` **inyectado falso**: `POST /scrape`
  crea la fila `queued`; el worker la lleva a `done` con los conteos que el fake reporta; `GET /scrape`
  la lista. Sin spawnear Playwright.
- Web: form + render de la lista (unit liviano con el cliente mockeado).
- Smoke manual real: un rubro chico (ej. "farmacias en Lomas de Zamora") end-to-end desde `/buscar`
  → job corre con contador → aparece en Explorar.

## Fuera de alcance (slices posteriores)

- Búsquedas recurrentes/agendadas.
- Cancelar un job en curso.
- Multi-worker / varios perfiles de Google en paralelo.
- SSE/websockets (hoy polling).

## Criterio de éxito

1. Desde `/buscar`, cargar query + location y "Buscar" crea un job que pasa `queued → running → done`
   con contador vivo `done/total`.
2. Al `done`, los leads quedan en la DB (upsert) y se ven en Explorar; el job muestra `N encontrados · X nuevos`.
3. Dos jobs lanzados seguidos corren **de a uno** (el segundo espera).
4. CAPTCHA/login → job en `error` con mensaje claro y hint de reautenticar headed.

## Riesgos

- **Stdout mezclado**: si los logs humanos van a stdout, ensucian el NDJSON. Mitigado enviando NDJSON
  a stdout y chalk/barra a stderr en modo `--progress-json`.
- **Perfil no logueado / CAPTCHA**: el job falla limpio con hint; la reautenticación es manual (headed),
  fuera del flujo web (aceptable para uso propio).
- **Path del scraper**: el worker resuelve `apps/scraper/dist/cli.js`; requiere el scraper compilado.
  Documentar en README.
