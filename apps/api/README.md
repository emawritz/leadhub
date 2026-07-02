# @leadhub/api

Fastify + Drizzle + JWT. Expone los leads ingestados en Postgres.

## Endpoints

- `POST /auth/login` — `{ email, password }` → `{ ok, data: { token } }`
- `GET /me` — requiere `Authorization: Bearer <token>`
- `GET /leads` — filtros vía querystring (`leadFiltersSchema` de `@leadhub/core`), paginado
- `GET /leads/facets` — conteos por `provincia`, `localidad`, `categoria`, `fuente`
- `POST /leads/export` — mismos filtros que `/leads`, devuelve CSV y registra en `export_logs`

## Configuración

Variables de entorno (`apps/api/.env`, copiar desde `.env.example`):

```bash
DATABASE_URL=postgres://leadhub:leadhub@localhost:5544/leadhub
DATABASE_URL_TEST=postgres://leadhub:leadhub@localhost:5544/leadhub_test
JWT_SECRET=dev-change-me
PORT=3001
```

Postgres corre vía `docker compose up -d db` desde la raíz del repo, expuesto en el **puerto host 5544**
(no 5432).

Si el puerto 3001 está ocupado en el host, arrancar con otro puerto: `PORT=4501 pnpm dev` (así lo hace
también `apps/web/playwright.config.ts` para los E2E).

## Migraciones

Schema en `src/db/schema.ts`, migraciones generadas en `drizzle/`.

Generar una migración nueva a partir de cambios en el schema:

```bash
pnpm --filter @leadhub/api generate
```

Aplicar migraciones a la base de desarrollo (usa `DATABASE_URL` del `.env`):

```bash
pnpm --filter @leadhub/api migrate
```

Aplicar las mismas migraciones a la base de test, sobreescribiendo `DATABASE_URL` solo para ese comando
(`drizzle.config.ts` lee la URL desde `src/config.ts`, que lee `DATABASE_URL`):

```bash
DATABASE_URL=postgres://leadhub:leadhub@localhost:5544/leadhub_test pnpm --filter @leadhub/api migrate
```

La base de test debe existir antes de migrarla:

```bash
docker compose exec db psql -U leadhub -c "CREATE DATABASE leadhub_test;"
```

## Seed

Crea o actualiza una cuenta (upsert por email):

```bash
pnpm --filter @leadhub/api seed:account <email> <password> [nombre]
# ej.
pnpm --filter @leadhub/api seed:account demo@leadhub.com demo1234 Demo
```

No anteponer `--` antes de los argumentos: con pnpm 9.x, `pnpm --filter <pkg> <script> -- <args>` reenvía ese
`--` literal al script (`src/scripts/seed-account.ts -- demo@leadhub.com ...`), y como el script lee los
argumentos por posición (`process.argv.slice(2)`), termina interpretando `--` como el email. Pasar los
argumentos directamente, sin `--`.

## Tests de integración

Los tests (`tests/*.test.ts`) usan `config.databaseUrlTest`, es decir `DATABASE_URL_TEST`, y truncan
`leads`, `accounts`, `export_logs` antes de cada caso (ver `tests/helpers/db.ts`). Requieren:

1. Postgres levantado (`docker compose up -d db`, puerto 5544).
2. Base `leadhub_test` creada y migrada (ver arriba).
3. `DATABASE_URL_TEST` presente en el entorno del proceso que corre vitest. Como `src/config.ts` hace
   `import 'dotenv/config'`, alcanza con tenerla en `apps/api/.env`; si se corre `pnpm test` desde la raíz
   del monorepo y por algún motivo ese `.env` no se carga, exportarla explícitamente:

```bash
export DATABASE_URL_TEST=postgres://leadhub:leadhub@localhost:5544/leadhub_test
pnpm --filter @leadhub/api test
```

`fileParallelism: false` en `vitest.config.ts` evita carreras entre tests que comparten la misma base.
