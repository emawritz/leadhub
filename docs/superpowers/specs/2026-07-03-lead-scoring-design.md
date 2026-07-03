# Lead Scoring (priorización) — Diseño

**Fecha:** 2026-07-03
**Estado:** Aprobado para planificación
**Slice:** Puntaje objetivo de prioridad por lead, para decidir a quién contactar primero. Fit de rubro, scoring configurable y ML quedan fuera.

## Objetivo

Dar un **score 0–100** a cada lead a partir de señales objetivas (contactabilidad + completitud de
datos), y usarlo para priorizar en **Explorar** (ordenar/filtrar los 1584) y en el **Board** (ordenar
las tarjetas dentro de cada columna). Sin cambios de esquema.

## Decisiones del brainstorm

| Tema | Decisión |
|------|----------|
| Superficies | **Explorar + Board** |
| Señales | **Solo objetivas** (sin fit de rubro) |
| Cómputo | Pesos en **core** (fuente única); la API genera la expresión SQL desde esos pesos |
| Persistencia | **Sin columna ni migración**: `score` se computa en la query |
| Testing | **Sin tests automatizados** (política del proyecto); build + smoke |

## Señales y pesos

Definidos una sola vez en `packages/core` (`SCORE_WEIGHTS`). Todos derivan de campos existentes de la
tabla `leads` (varios ya tienen columnas booleanas generadas: `has_telefono/has_email/has_whatsapp/
has_web/has_cuit`).

| Señal | Condición | Peso |
|---|---|---|
| Teléfono | `has_telefono` (`telefono <> ''`) | 20 |
| WhatsApp | `has_whatsapp` (`whatsapp <> ''`) | 15 |
| Email | `has_email` (`email <> ''`) | 15 |
| Web | `has_web` (`sitio_web <> ''`) | 15 |
| Redes | `instagram <> '' OR facebook <> ''` | 10 |
| CUIT | `has_cuit` (`cuit <> ''`) | 10 |
| Fuente Google Maps | `fuente = 'Google Maps'` | 15 |

`score = Σ(peso × señal)` → **0–100**. **Tier:** Alto `≥70` · Medio `40–69` · Bajo `<40`.

## Arquitectura

```
packages/core/  + SCORE_WEIGHTS (const) + scoreLead(lead) (fn pura, 0–100) + scoreTier(score)
                + leadFiltersSchema extendido: sort 'prioridad' + filtro soloAlto
apps/api/       + src/leads/score.ts: leadScoreSql() — expresión SQL construida desde SCORE_WEIGHTS (import de core)
                + query.ts: score en el select, sort 'prioridad' (score desc), filtro soloAlto (score>=70)
                + pipeline/routes.ts: board suma score por tarjeta (misma leadScoreSql, leads ya está joineado)
apps/web/       + LeadRow.score y PipelineCard.score
                + Explorar: selector de orden (Prioridad), toggle "Solo Alto", badge de score por fila + tooltip de desglose (scoreLead)
                + Board: badge de score en la tarjeta + orden por score desc dentro de cada columna
```

**DRY:** los pesos viven en core; la API los importa y genera el SQL; el cliente muestra el número que
devuelve la API y calcula el **desglose** (qué señales sumaron) con `scoreLead` sobre los campos que ya
tiene la fila en Explorar. La definición de "presente" es idéntica en SQL y en `scoreLead` (campo `<> ''`),
así ambos dan el mismo número.

## API

Sin rutas nuevas. `GET /leads` gana:
- Campo `score` computado en cada item.
- `sort=prioridad` → `ORDER BY score DESC` (respeta paginación de los 1584).
- Filtro `soloAlto=true` → `WHERE score >= 70`.

`GET /pipeline` (board) gana `score` por tarjeta (la subquery/expresión referencia `leads`, ya joineado).

`leadFiltersSchema` (core, Zod): `sort` suma `'prioridad'`; se agrega `soloAlto` bool opcional. `useFilters`
en web serializa/deserializa `soloAlto` (lista de bools) y `sort` (ya pasa como string) a la URL.

## UI

- **Explorar:** control de **orden** ("Prioridad · Nombre · Localidad · Fecha") + toggle **"Solo Alto"** en
  el panel de filtros; en la tabla, un **badge de score** por fila (color/tier: Alto verde-apagado, Medio
  ámbar-apagado, Bajo gris — con los tonos de la paleta Apple, por `style` inline) con el número; hover
  muestra el **desglose** (señales que sumaron) via `scoreLead`.
- **Board:** cada `KanbanCard` muestra el badge de score; dentro de cada columna las tarjetas se ordenan
  por `score` desc (lo prioritario arriba). Se conserva el drag optimista y el filtro client-side.

## Fuera de alcance

- Fit de rubro / pesos configurables por el usuario.
- Persistir el score (columna/migración) o histórico.
- Recalcular en background; el score es siempre en vivo desde la query.

## Criterio de éxito

1. `GET /leads?sort=prioridad` devuelve los leads ordenados por score desc, con `score` en cada item; `soloAlto=true` filtra `>=70`.
2. En Explorar se puede ordenar por Prioridad y filtrar "Solo Alto"; cada fila muestra su badge de score con tier.
3. El board muestra el score por tarjeta y ordena por score dentro de cada columna.
4. El score del SQL y el desglose de `scoreLead` coinciden en el número total.
5. Los tres paquetes compilan; export de CSV y flujos existentes intactos; tests del monorepo verdes.

## Riesgos

- **Doble definición del cómputo (SQL vs `scoreLead`)**: mitigado con pesos únicos en core y la misma
  condición de "presente" (`campo <> ''`) en ambos lados; el smoke compara un caso.
- **Cambiar el shape del select de `/leads`** (para agregar `score`) podría afectar el export CSV:
  verificar que `export.ts` no dependa del shape (usa su propia query o ignora `score`).
- **Valor exacto de `fuente`**: el peso de "Google Maps" asume `fuente = 'Google Maps'` (verificado en las
  facetas: "Google Maps" / "OpenStreetMap").
