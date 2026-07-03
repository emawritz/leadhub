# Integración catálogo ↔ CRM — Diseño

**Fecha:** 2026-07-03
**Estado:** Aprobado para planificación
**Slice:** Hacer que catálogo (Explorar) y pipeline se sientan una sola cosa: estado con color + agregar leads al pipeline en lote.

## Objetivo

Que los leads generados por las búsquedas de Google Maps queden ligados al CRM de forma **intuitiva**:
(1) el estado del lead en el CRM se ve **con color** en Explorar, y (2) se pueden **agregar todos los leads
de una búsqueda / de un filtro al pipeline en un click**.

## Decisiones del brainstorm

| Tema | Decisión |
|------|----------|
| Colores por estado | **Estado CRM con color en Explorar** (punto de color + etiqueta de etapa); se mantiene la paleta apagada Apple (no subir saturación) |
| Ligar leads al CRM | **Botón "Agregar todos al pipeline"** (bulk) desde el filtro vigente de Explorar; Buscar linkea a Explorar prefiltrado |
| Esquema | **Sin cambios de esquema / migración** |
| Testing | **Sin tests automatizados** (política del proyecto); build + smoke |

## Feature 1 — Estado CRM con color en Explorar

La celda **Pipeline** de `LeadsTable` deja de ser texto plano:
- **Sin pipeline:** botón "→ Pipeline" (acento azul).
- **En pipeline:** `● {etiqueta de etapa}` con un punto en `stageColor(stage)` — mismo sistema de color que el
  board. Ganado sale verde, Perdido rojo, etc. De un vistazo se ve el estado de cada lead del catálogo.

Usa `stageColor`/`stageLabel` de `@leadhub/core/stages` (ya disponible en el archivo). Se elimina el caso
especial de `CLOSED_STAGES` (el color del punto ya distingue ganado/perdido).

## Feature 2 — Agregar al pipeline en lote

**API — `POST /pipeline/bulk`** (`requireAuth`): toma los **mismos filtros que `GET /leads`** (query string,
`leadFiltersSchema`), selecciona todos los `leads.id` que matchean (la MISMA cláusula WHERE), e inserta en
`pipeline_leads` con `onConflictDoNothing` (saltea los que ya están). Devuelve
`{ matched, added, skipped }`. Opera sobre **todo el resultado filtrado**, no solo la página.

Para DRY, la función de condiciones de `leads/query.ts` se **exporta** (`leadWhere`) y la reusa tanto
`buildLeadsQuery` como la ruta bulk.

**Web — Explorar:** botón **"→ Agregar N al pipeline"** junto a "Exportar CSV" (`N` = total del filtro
vigente), que llama a `bulkAddToPipeline(qs)` con la query de filtros actual. Al terminar, invalida
`['pipeline']` y `['pipeline-stats']` (así la columna de estado con color se actualiza sola) y muestra
`"{added} agregados · {skipped} ya estaban"`. Deshabilitado si no hay resultados o mientras corre.

## Feature 3 — Flujo intuitivo búsqueda → CRM

En **Buscar** (`JobsList`), el link **"Ver en el explorador"** de un job `done` navega a Explorar
**prefiltrado por la query** de esa búsqueda (`/?q=<query>`), en vez de a `/` pelado. Así: búsqueda termina →
"Ver en el explorador" → ves esos leads → "Agregar N al pipeline". La búsqueda de Google Maps queda ligada
al CRM en dos clics.

## API — resumen

| Método | Ruta | Body/Query | Descripción |
|---|---|---|---|
| POST | `/pipeline/bulk` | filtros (query string, `leadFiltersSchema`) | agrega al pipeline todos los leads del filtro; devuelve `{ matched, added, skipped }` |

Registrada antes de `/pipeline/:id` (Fastify prioriza rutas estáticas de todos modos).

## Fuera de alcance

- Ligar cada lead a la búsqueda que lo generó (requeriría migración).
- Tope al bulk (decisión: sin tope; se controla con filtros).
- Botón de bulk directo en Buscar (se pasa por Explorar prefiltrado).
- Cambiar la saturación de la paleta Apple.

## Criterio de éxito

1. En Explorar cada lead en pipeline muestra su estado con **punto de color + etiqueta de etapa**; sin pipeline muestra "→ Pipeline".
2. `POST /pipeline/bulk` con filtros agrega todos los leads que matchean (saltea los ya presentes) y devuelve `{matched, added, skipped}` coherente.
3. En Explorar el botón "→ Agregar N al pipeline" opera sobre el filtro vigente y refleja los estados con color al terminar.
4. "Ver en el explorador" de un job lleva a Explorar prefiltrado por la query de esa búsqueda.
5. Los tres paquetes compilan; el drag optimista, filtros en URL y flujos existentes intactos; tests del monorepo verdes.

## Riesgos

- **Bulk grande**: agregar cientos de leads infla "Nuevo"; es intencional y controlado por el filtro (el usuario decide). El insert es una sola sentencia multi-row (ok para ~1600 filas).
- **`q` de la búsqueda vs full-text**: el prefiltrado usa `plainto_tsquery('spanish', query)`; para una búsqueda tipo "farmacias en Lomas" matchea por categoría/localidad/razón — aproximado pero útil.
- **DRY del WHERE**: exportar `leadWhere` evita duplicar las condiciones entre `/leads` y `/pipeline/bulk`.
