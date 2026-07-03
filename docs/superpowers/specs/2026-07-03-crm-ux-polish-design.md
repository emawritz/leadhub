# Pasada de pulido UX del CRM — Diseño

**Fecha:** 2026-07-03
**Estado:** Aprobado para planificación
**Base:** App LeadHub con estilo Apple (tokens CSS vars, `.btn/.input/.card`, un acento, hairlines, dark mode).

## Objetivo

Pulido de conjunto sobre lo que creció desde la Fase 2 de UX: feedback consistente, estados vacíos/carga,
densidad de Explorar y layout del drawer. Todo dentro del sistema Apple existente. Sin cambios de esquema/API.

## Decisiones del brainstorm

| Área | Decisión |
|------|----------|
| Feedback | **Toasts** propios (sin dependencias), cableados a todas las mutaciones (éxito + error) |
| Estados | **Empty & loading** consistentes en todas las vistas |
| Explorar | Tabla más densa/coherente: **10 → ~6 columnas** apilando lo secundario |
| Drawer | Reorganizar en **secciones con jerarquía** (divisores hairline) |
| Testing | **Sin tests automatizados** (política); build + smoke visual claro/oscuro |

## Feature 1 — Toasts

Sistema propio liviano en `apps/web/src/toast.tsx`:
- `ToastProvider` (context + estado + auto-dismiss ~3s) que envuelve `App` y renderiza el contenedor de toasts
  (esquina inferior derecha, stack, click para cerrar).
- `useToast()` → `{ success, error, info }`.
- Estilo con tokens: `.card` (`bg-surface` + hairline) + **borde izquierdo de color por tipo** (éxito
  `stageColor('ganado')`, error `stageColor('perdido')`, info accent) + una sombra suave (es overlay flotante,
  no chrome). Import de `stageColor` por `@leadhub/core/stages`.

**Cableado:** todas las mutaciones disparan toast en `onSuccess` y `onError`:
- Explorar: `addToPipeline` ("Agregado al pipeline"), **bulk** ("N agregados · M ya estaban") — reemplaza el `<p>` pegado.
- Drawer: mover etapa, reasignar dueño, sacar del pipeline, agregar tarea/actividad, outreach.
- Board: `move` (error → "No se pudo mover"; el rollback ya existe).
- Buscar: `createScrape` ("Búsqueda encolada").
- Errores: cualquier `onError` → toast de error con el mensaje.

`ToastProvider` se monta en `main.tsx` envolviendo `<App/>` (dentro de los providers existentes) para que
`useToast` esté disponible en todas las páginas.

## Feature 2 — Empty & loading states

Componentes compartidos:
- `apps/web/src/components/EmptyState.tsx` — ícono (emoji) + título + hint, centrado, con tokens.
- `apps/web/src/components/Loading.tsx` — indicador de carga consistente (texto/spinner con tokens).

Aplicados en:
- **Explorar:** cargando → `Loading`; `total === 0` → `EmptyState` ("Sin resultados", "Probá otros filtros").
- **Board:** cargando → `Loading`; sin tarjetas → `EmptyState` ("Pipeline vacío", "Agregá leads desde Explorar").
- **Tareas:** cargando → `Loading`; sin tareas → mantener/normalizar el estado vacío.
- **Dashboard:** cargando → `Loading` (hoy "Cargando…" pelado).
- **Buscar (JobsList):** sin jobs → `EmptyState` ("Sin búsquedas todavía").
- **Drawer:** cargando → `Loading`.

## Feature 3 — Explorar más denso/coherente

`LeadsTable` pasa de **10 columnas a ~6**, apilando lo secundario y mejorando jerarquía. Conserva ScoreBadge,
el estado con color y la lógica (props `items`/`pipelineByLead`/`onAdd`, tooltip de desglose):

| Columna | Contenido |
|---|---|
| **Lead** | Razón social/nombre (fuerte, `text-ink`) + categoría (`text-muted` chico) debajo |
| **Ubicación** | localidad, provincia (`text-muted`) |
| **Contacto** | teléfono (`text-ink`) + email (`text-muted` chico) + redes (IG/FB/WA `text-accent`) compactos |
| **Datos** | CUIT + fuente (`text-muted` chico) apilados |
| **Prioridad** | `ScoreBadge` |
| **Estado** | punto de color + etapa / botón "→ Pipeline" |

Header `border-b border-hairline text-muted`; filas `border-t border-hairline hover:bg-parchment`; padding y
alineación consistentes; `truncate` donde haga falta.

## Feature 4 — Layout del drawer del pipeline

`LeadDrawer` se reorganiza en secciones claras separadas por hairline, sin cambiar la lógica (todas las
mutaciones, normalización de `vence`, timeline con `ACTIVITY_META`, invalidaciones):
- **Cabecera:** nombre + metadatos + **outreach** (WhatsApp/Email) como acciones destacadas.
- **Meta:** etapa + dueño agrupados (chips/selects alineados) con divisor.
- **Tareas:** composer + lista, con ritmo.
- **Actividad:** composer + timeline.
Cada sección con su título y separación clara; se conservan los `disabled` por `isPending`.

## Fuera de alcance

- Librería de toasts externa (se hace propio).
- Rediseño de datos/lógica; cambios de esquema o API.
- Cambiar la paleta o el sistema de tokens Apple.

## Criterio de éxito

1. Toda mutación muestra un toast de éxito o error consistente; el bulk ya no deja texto pegado.
2. Cada vista tiene estado de carga y vacío consistentes (Explorar/Board/Tareas/Dashboard/Buscar/Drawer).
3. La tabla de Explorar tiene ~6 columnas con mejor jerarquía, sin perder score/estado/acciones ni la lógica.
4. El drawer se lee en secciones claras; toda la lógica intacta.
5. Los tres paquetes compilan; drag optimista, filtros en URL, export y flujos existentes intactos; tests del monorepo verdes.
6. Smoke visual OK en claro y oscuro.

## Riesgos

- **Cableado de toasts disperso**: toca varias superficies; mitigado con un hook único y cambios mecánicos por mutación.
- **Reescritura de `LeadsTable`/`LeadDrawer`**: riesgo de tocar lógica; mitigado con la regla "solo markup/estilo, conservar hooks/mutaciones" y review por-tarea.
- **Sombra del toast**: es overlay flotante (no chrome), se permite una sombra suave para legibilidad sobre el contenido.
