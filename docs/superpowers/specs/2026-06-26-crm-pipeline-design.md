# CRM Pipeline (core) — Diseño

**Fecha:** 2026-06-26
**Estado:** Aprobado para planificación
**Slice:** Core del CRM — pipeline de outreach sobre el catálogo de leads. Reportes, email/WhatsApp real, etapas configurables y asignación avanzada son slices posteriores.

## Objetivo

Una capa de CRM sobre LeadHub: desde **Explorar** se empuja un lead al **Pipeline** (tablero Kanban
compartido del equipo); ahí se lo mueve por etapas, se registra actividad (nota/llamada/email/WhatsApp)
en un timeline, y se crean tareas de seguimiento con vencimiento.

## Decisiones del brainstorm

| Tema | Decisión |
|------|----------|
| Propósito | Trabajar los leads scrapeados (**pipeline de outreach**), no un CRM multi-tenant |
| Alcance core | Pipeline + notas + tareas + **registro de actividad** |
| Vista | **Kanban** (columnas por etapa, drag&drop) |
| Etapas | **Fijas**: Nuevo · Contactado · Interesado · Negociación · Ganado · Perdido (Ganado/Perdido cierran) |
| Pipeline | **Compartido** por el equipo; cada lead en pipeline tiene un **dueño**; un lead entra una vez |
| Testing | **Sin tests automatizados** (decisión explícita del usuario) — verificación manual + typecheck/build |

## Arquitectura (reusa el monorepo)

```
packages/core/  + STAGES (constante) + ACTIVITY_TYPES + Zod schemas (pipeline/activity/task) + tipos
apps/api/       + módulo src/pipeline: schema (3 tablas) + rutas
apps/web/       + pestaña Pipeline (Kanban con @dnd-kit) + drawer de detalle
                + botón "→ Pipeline" en Explorar + vista Tareas + nav actualizado
```

## Modelo de datos (3 tablas nuevas, no toca las existentes)

### `pipeline_leads` — un lead en el tablero (entra una vez)
```
id           uuid pk default gen_random_uuid()
lead_id      uuid not null unique references leads(id)
owner_id     uuid references accounts(id)              -- null = sin asignar
stage        text not null default 'nuevo'             -- nuevo|contactado|interesado|negociacion|ganado|perdido
created_at   timestamptz not null default now()
updated_at   timestamptz not null default now()
```

### `activities` — timeline unificado (notas + log de actividad + cambios de etapa)
```
id                uuid pk
pipeline_lead_id  uuid not null references pipeline_leads(id) on delete cascade
account_id        uuid not null references accounts(id)       -- quién la registró
tipo              text not null                               -- nota|llamada|email|whatsapp|etapa
cuerpo            text not null default ''
created_at        timestamptz not null default now()
```
Cambiar la etapa de un lead **auto-registra** una actividad `tipo='etapa'` con cuerpo tipo "Nuevo → Contactado".

### `tasks` — seguimientos
```
id                uuid pk
pipeline_lead_id  uuid not null references pipeline_leads(id) on delete cascade
account_id        uuid not null references accounts(id)
titulo            text not null
vence             timestamptz                                 -- null = sin vencimiento
hecha             boolean not null default false
created_at        timestamptz not null default now()
completed_at      timestamptz
```

Índices: `pipeline_leads(stage)`, `pipeline_leads(lead_id)` único, `activities(pipeline_lead_id)`,
`tasks(pipeline_lead_id)`, `tasks(hecha, vence)`.

### Constantes en `core`
```
STAGES = ['nuevo','contactado','interesado','negociacion','ganado','perdido']  (con labels + cuáles cierran)
ACTIVITY_TYPES = ['nota','llamada','email','whatsapp','etapa']
```

## API (Fastify + JWT)

Todas con `requireAuth`, validación **Zod**, envelope `{ ok, data, error }`.

| Método | Ruta | Body/Query | Descripción |
|---|---|---|---|
| GET | `/pipeline` | — | tablero: `pipeline_leads` con datos del lead (nombre, categoría, localidad, tel, email), dueño y conteo de tareas pendientes; para agrupar por etapa en la UI |
| POST | `/pipeline` | `{ leadId, ownerId? }` | agrega el lead al tablero (409 si ya está); registra actividad inicial opcional |
| PATCH | `/pipeline/:id` | `{ stage?, ownerId? }` | mueve de etapa y/o reasigna; cambio de etapa **auto-registra** actividad `etapa` |
| DELETE | `/pipeline/:id` | — | saca el lead del tablero (cascade borra activities/tasks) |
| GET | `/pipeline/:id` | — | detalle: pipeline_lead + lead + timeline de actividades (desc) + tareas |
| POST | `/pipeline/:id/activities` | `{ tipo, cuerpo }` | registra nota/llamada/email/whatsapp |
| POST | `/pipeline/:id/tasks` | `{ titulo, vence? }` | crea una tarea |
| PATCH | `/tasks/:taskId` | `{ hecha }` | marca hecha/pendiente (setea/limpia `completed_at`) |
| GET | `/tasks?estado=pendientes` | — | tareas pendientes (hecha=false) ordenadas por `vence`, con datos del lead |

`accountId` sale del JWT `sub`. Zod: `stage` ∈ STAGES; `tipo` ∈ ACTIVITY_TYPES (sin `etapa`, que es interno);
`titulo` no vacío; `vence` ISO opcional.

## UI (React + Vite)

Nav: **Explorar · Buscar · Pipeline · Tareas** (se extiende el `Nav.tsx` existente).

- **`/pipeline` (Kanban):** columnas = las 6 etapas, tarjetas = leads (nombre, categoría, localidad,
  iniciales del dueño, badge de tareas pendientes). **Drag&drop** entre columnas con `@dnd-kit/core` +
  `@dnd-kit/sortable` → `PATCH /pipeline/:id { stage }` **optimista** (rollback si falla) + invalidar.
- **Drawer de detalle** (al clickear una tarjeta): datos del lead, **timeline de actividades** con un
  composer (selector de tipo + textarea → `POST activities`), **tareas** (lista + agregar con vencimiento +
  check para completar), selector de **dueño** y de **etapa**.
- **Explorar:** botón **"→ Pipeline"** por fila → `POST /pipeline`; si el lead ya está, muestra tilde/deshabilitado.
- **`/tareas`:** lista de tareas pendientes (título, lead, vencimiento con resaltado de **vencidas**) +
  check para completar.

Estado con **TanStack Query** (invalidación tras mutaciones; update optimista en el drag). Estilos Tailwind.
Dependencia nueva: `@dnd-kit/core`, `@dnd-kit/sortable`.

## Conexión con lo existente

El botón "→ Pipeline" en el explorador es el puente: los leads del catálogo (scrapeados / OSM / CADAM)
entran al pipeline. El pipeline referencia `leads(id)`; borrar del tablero no borra el lead del catálogo.

## Fuera de alcance (slices posteriores)

- Reportes / dashboard (conversión por etapa, embudo).
- Integración real de email/WhatsApp (hoy la actividad se registra a mano).
- Etapas configurables (hoy fijas).
- Asignación multi-usuario avanzada / permisos por rol.
- Valor/monto de la oportunidad y forecasting.

## Criterio de éxito

1. Desde Explorar, "→ Pipeline" agrega un lead; aparece en la columna **Nuevo** del Kanban.
2. Arrastrar la tarjeta a otra columna cambia la etapa y **registra una actividad** `etapa` en el timeline.
3. En el detalle se puede agregar una **nota/llamada/email/whatsapp** y verla en el timeline.
4. Se puede crear una **tarea con vencimiento** y marcarla hecha; aparece en **Tareas** mientras esté pendiente.
5. Un lead no puede entrar dos veces al pipeline (409).

## Riesgos

- **Drag&drop optimista**: si el `PATCH` falla, hay que revertir la tarjeta a su columna original.
- **Sin tests**: mayor riesgo de regresiones; se compensa con typecheck estricto, build verde y smoke manual
  del flujo completo (agregar → mover → actividad → tarea).
- **Cascade de borrado**: sacar un lead del tablero borra sus activities/tasks (esperado); el lead del catálogo queda.
