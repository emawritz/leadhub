# Pasada de accesibilidad (WCAG 2.1 AA) — Diseño

**Fecha:** 2026-07-03
**Estado:** Aprobado para planificación
**Base:** Auditoría de código (accessibility-expert) + scan axe-core en vivo (claro/oscuro). Alcance: **toda la app, WCAG 2.1 AA**.

## Objetivo

Llevar el frontend de LeadHub a WCAG 2.1 AA: operable por teclado, anunciado por lectores de pantalla,
contraste suficiente en claro y oscuro, y semántica/labels correctos. Solo web; sin cambios de esquema/API.

## Hallazgos (de la auditoría + axe) y fixes, agrupados

### A. Contraste (tokens + componentes)
- `--color-faint` falla AA como texto en ambos temas (claro #86868b/blanco=3.62; oscuro #6e6e73/negro=4.14).
  → Retunear: **claro muted `#565659` / faint `#6a6a6e`; oscuro muted `#a1a1a6` (ok) / faint `#8a8a8f`** (faint sigue por debajo de muted en jerarquía, ambos ≥4.5 sobre canvas y parchment).
- `ScoreBadge`: número de color de tier sobre fondo `${color}1f` (mismo tono) falla en ambos temas.
  → Rediseño AA: **texto `text-ink`** (alto contraste) + **borde 1px del color del tier** + fondo tint; el color comunica por el borde/tint, el número queda legible.
- `stageColor('perdido')` usado como **texto** (vencidas en KanbanCard/Tareas/LeadDrawer, "Sacar", "queued") falla en oscuro (~2.4:1).
  → Nuevo token **`--color-danger` (claro `#b23b3b` / oscuro `#f87171`)**; esos textos usan `text-danger`. `stageColor` se conserva para **puntos/barras/bordes** (no texto).
- Botón primario en oscuro: blanco sobre accent `#2997ff` = 3.01.
  → Nuevo token **`--color-accent-btn` (claro `#0066cc` / oscuro `#0067ce`)** para el **fondo** de `.btn`; `--color-accent` (#2997ff dark) se reserva para **texto/links** (`.btn-ghost`, `text-accent`) y el focus ring.

### B. Teclado — Kanban
- `KanbanCard` (`div` con `onClick`, sin `onKeyDown`): agregar `onKeyDown` Enter/Espacio → `onOpen(card.id)`, y `aria-label` descriptivo (nombre + prioridad + "vencida" si aplica).
- `KanbanBoard`: agregar `KeyboardSensor` (drag por teclado); `DndContext accessibility={{ announcements }}` en **español** usando `stageLabel`; columnas con `role="list"`/tarjetas `role="listitem"` y encabezado de columna como heading.

### C. Drawer como diálogo modal — LeadDrawer + Pipeline
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (al `<h2>` con `id`).
- **Escape** cierra (listener en `useEffect`).
- **Focus trap** + **foco inicial** al abrir (primer interactivo o el `<h2>` con `tabIndex={-1}`).
- **Retorno de foco** a la tarjeta disparadora al cerrar (Pipeline guarda el elemento activo antes de abrir).

### D. Status messages (aria-live)
- `toast.tsx`: contenedor `role="status" aria-live="polite"` (y `assertive` para errores); el dismiss como `<button aria-label="Cerrar notificación">`; pausar auto-dismiss en hover/focus (opcional).
- `Loading.tsx`: `role="status" aria-live="polite"`, spinner `aria-hidden`, `motion-reduce:animate-none`.
- `JobsList`: estado/progreso de cada job en `aria-live="polite"`.

### E. Labels, landmarks, headings, link purpose
- **Login**: `<label>` (sr-only) para email/pass + `autoComplete="email"`/`current-password`; error como `role="alert"`.
- **Inputs sin label** (`SearchForm`, `BoardFilters`, composer del `LeadDrawer`, `datetime-local`): `<label>`/`aria-label`. Selects de etapa/dueño/tipo: `aria-label`.
- **Botones icono-solo** (`✕`, `+` tarea/actividad del drawer): `aria-label`; emojis decorativos `aria-hidden`.
- **Explorar**: agregar `<h1>` ("Explorador de leads").
- **Landmarks**: envolver el contenido de `Buscar`/`Pipeline`/`Tareas`/`Dashboard` en `<main>`.
- **LeadsTable**: `<caption className="sr-only">` + `<th scope="col">`; links IG/FB/WA con `aria-label` por lead.
- **Nav**: link "Saltar al contenido" (`sr-only focus:not-sr-only`) + `id="main"` en los `<main>`; emojis del toggle `aria-hidden`.

## Ya correcto (verificado, sin acción)
- `<html lang="es">` (index.html); `aria-current` del NavLink activo (react-router); focus ring `focus-visible:ring-accent-focus` en KanbanCard (contraste ok); nav text opacity-70 sobre negro (~9:1). Sin `outline:none` global.

## Fuera de alcance
- Instalar tooling de CI (`eslint-plugin-jsx-a11y`, `@axe-core/playwright`) — recomendado pero aparte.
- Reestructurar el Kanban a `SortableContext` (se logra teclado con `KeyboardSensor` + el drawer accesible como camino principal de cambio de etapa).
- WCAG AAA.

## Criterio de éxito
1. **Teclado**: se puede abrir el detalle de un lead y cambiar su etapa (vía drawer) sin mouse; el drawer atrapa foco, cierra con Escape y devuelve el foco.
2. **Lectores**: toasts, cargas y el diálogo se anuncian (`aria-live`/`role=dialog`).
3. **Contraste**: axe no reporta `color-contrast` en claro ni oscuro sobre las superficies principales; los badges y textos de estado pasan AA.
4. **Labels/semántica**: sin inputs sin nombre accesible; `<h1>` y `<main>` presentes; tabla con `th scope`.
5. Los tres paquetes compilan; toda la lógica intacta; tests del monorepo verdes.
6. Verificación: build + **re-scan axe** (claro/oscuro) sin violaciones críticas/serias, y smoke de teclado.

## Riesgos
- **Colores exactos**: los hexes de los tokens son cálculos; el controlador re-corre axe en el smoke y ajusta cualquier residual.
- **Focus trap manual**: hay que evitar romper el drag/selects del drawer; se implementa acotado (Tab/Shift+Tab dentro del panel + Escape).
- **KeyboardSensor sin Sortable**: drag por teclado básico; el camino accesible principal es el drawer (select de etapa), que queda garantizado por el fix de teclado de la tarjeta.
