# CRM — Mejoras (robustez · UX · features) — Diseño

**Fecha:** 2026-07-03
**Estado:** Aprobado para planificación
**Base:** CRM Pipeline core (spec 2026-06-26), ya mergeado a `main`.

## Objetivo

Elevar el CRM de outreach de "funciona" a "pulido y confiable" en tres ejes,
ejecutados como fases independientes y mergeables por separado:

1. **Robustez** — cerrar la deuda de correctitud detectada en el review final.
2. **UX del tablero** — Kanban y drawer con jerarquía, densidad y estados diseñados.
3. **Features** — búsqueda/filtros, reasignar dueño, acción rápida de outreach, dashboard de embudo.

Cada fase es una rama propia (`feat/crm-robustez` → `feat/crm-ux` → `feat/crm-features`),
con su plan y ejecución subagent-driven, mergeando entre fases.

**Testing:** el CRM se mantiene **sin tests automatizados** (decisión del proyecto).
Verificación por typecheck/build + smoke manual del flujo afectado en cada fase.
Se respetan los tests existentes del monorepo (core/scraper/ingest) — no deben romperse.

---

## Fase 1 — Robustez

Cierra los 7 hallazgos MINOR diferidos del review final de la rama del CRM.
Cambios acotados de backend + tipos; bajo riesgo.

| # | Problema | Fix |
|---|----------|-----|
| 1 | `DELETE /pipeline/:id` responde 200 aunque el id no exista | Usar `.returning()`; si no borró filas → **404** con envelope de error |
| 2 | `:id` / `:taskId` inválidos llegan a Postgres → **500 crudo** (`invalid input syntax for type uuid`) | Validar params con Zod (`z.string().uuid()`); si falla → **400 "id inválido"** |
| 3 | `POST /pipeline` hace check-then-insert → dos adds concurrentes del mismo lead → **500** por violación de `unique` | Insert atómico con `onConflictDoNothing({ target: pipelineLeads.leadId })` + `.returning()`; si no devuelve fila → **409** |
| 4 | `updatePipeline` (web) declara retorno `PipelineCard`, pero el `PATCH` devuelve el row de `pipeline_leads` (sin `nombre`/`categoria`/`pendientes`) | Corregir el tipo de retorno a un `PipelineLeadRow` fiel; los callers ya invalidan, no usan el valor |
| 5 | `LeadsTable` usa `razonSocial-índice` como React key | Usar `lead.id` (ya disponible) |
| 6 | `core/package.json` exports con strings planos | Migrar a keys condicionales (`{ types, import }`) por subpath, sin cambiar rutas resueltas |
| 7 | README dice que leads `ganado`/`perdido` no aparecen en Explorar, pero no está implementado | Implementar el filtro real: el botón "→ Pipeline" / estado "✓ en pipeline" considera cerrados; el board excluye de "disponibles". Alinear impl con la doc |

**Detalle #2 (validación de params):** un helper reutilizable en `apps/api/src/pipeline/`
que parsea `req.params` con un schema Zod de UUID y responde 400 con el envelope estándar
antes de tocar la DB. Se aplica a todas las rutas con `:id`/`:taskId`.

**Detalle #7:** hoy la tabla de Explorar marca "✓ en pipeline" por membresía. Se mantiene,
y además los leads cuyo `pipeline_lead.stage ∈ {ganado, perdido}` se consideran "cerrados":
siguen marcados pero no re-agregables. No se borra el lead del catálogo. (Alternativa mínima
aceptable si el filtro resulta más grande de lo previsto: bajar la afirmación del README a la
realidad actual — se decide en el plan, preferencia por implementar.)

**Smoke Fase 1:** DELETE inexistente → 404; GET/PATCH con UUID inválido → 400; dos POST /pipeline
concurrentes del mismo lead → uno 200 y otro 409 (nunca 500); build de los 3 paquetes verde.

---

## Fase 2 — UX del tablero

**Dirección de estilo:** B2B **claro y denso, con carácter**. No dark por defecto, no
template genérico. Tokens Tailwind (color/espaciado/tipografía), color **semántico por etapa**,
jerarquía por contraste de escala, y estados hover/focus/active diseñados. Se apoya en las
reglas de `design-quality` (evitar card-grids uniformes sin jerarquía; profundidad por sombra/superficie;
data-viz como parte del sistema).

### Tarjetas del Kanban (ricas, no filas planas)
- Nombre del lead con peso tipográfico; badge de **categoría**; `📍 localidad`.
- **Avatar** con iniciales del dueño (color derivado del id) o placeholder "sin dueño".
- **Vencimiento** de la tarea más próxima: `⏰ <fecha>`, en **rojo** si está vencida.
- Contador de **tareas pendientes** (badge).
- Profundidad: superficie con sombra sutil; hover eleva; focus visible (accesible por teclado).

### Columnas
- Header con **conteo** y acento de color por etapa (paleta de 6 etapas como tokens).
- `ganado`/`perdido` diferenciadas visualmente (etapas que cierran).
- **Estado vacío** con mensaje por columna.

### Drag & drop
- **`DragOverlay`** de @dnd-kit: la tarjeta "levanta" con sombra al arrastrar.
- Columna destino se **resalta** al pasar por encima.
- Transiciones compositor-friendly (transform/opacity), respetando `prefers-reduced-motion`.
- Se conserva el update **optimista con rollback** ya existente.

### Drawer de detalle
- Timeline con mejor ritmo vertical; cada **tipo de actividad** con ícono/color (nota/llamada/email/whatsapp/etapa).
- Composer más claro (selector de tipo + textarea con estados de foco).
- Sección de tareas con vencimiento resaltado.

**Smoke Fase 2:** revisión visual en 1440/1024/768; teclado (tab por tarjetas, foco visible);
`prefers-reduced-motion` desactiva animaciones del drag; drag sigue moviendo etapa + registrando actividad.

---

## Fase 3 — Features

### 3.1 Filtrar / buscar en el board
- Barra de búsqueda por **nombre** + filtros: **dueño** (select), **con vencidas** (toggle).
- **Client-side** sobre el board ya cargado (no nuevas queries): filtra las tarjetas por columna.
- Estado en la **URL** (`?q=&owner=&vencidas=1`) — compartible y navegable (regla URL-as-state).

### 3.2 Reasignar dueño
- Nuevo **`GET /accounts`** → `[{ id, email }]` (equipo) para poblar selects. `requireAuth`.
- Selector de dueño en la **tarjeta** (menú) y en el **drawer**; usa el `PATCH /pipeline/:id { ownerId }` existente.
- `ownerId: null` = "sin asignar".

### 3.3 Acción rápida de outreach
- En tarjeta/drawer: botones **WhatsApp** y **Email** cuando el lead tiene `telefono`/`email`.
- WhatsApp: abre `https://wa.me/<tel-normalizado>?text=<plantilla>`; Email: `mailto:<email>?subject=&body=<plantilla>`.
- Plantilla editable simple (saludo con nombre del lead). El link abre la app externa.
- Al abrir, **registra una actividad** (`tipo='whatsapp'|'email'`, cuerpo "Mensaje iniciado por …")
  vía `POST /pipeline/:id/activities` — queda en el timeline.
- Normalización de teléfono a dígitos (E.164 sin `+` para `wa.me`); si no hay teléfono/email válido, el botón no se muestra.

### 3.4 Dashboard de embudo
- Nuevo **`GET /pipeline/stats`** → `{ porEtapa: Record<stage, number>, total, ganado, perdido, conversion, tareasVencidas }`.
  `conversion = ganado / (ganado + perdido)` (0 si denominador 0). `requireAuth`. Una sola query agregada por etapa + una de tareas vencidas.
- Página **`/dashboard`** (nav): embudo por etapa (barras proporcionales tratadas como parte del sistema de diseño),
  tarjetas de métrica (total en pipeline, conversión %, tareas vencidas), color por etapa consistente con el Kanban.
- Nav pasa a: **Explorar · Buscar · Pipeline · Tareas · Dashboard**.

**Smoke Fase 3:** filtrar por nombre/dueño/vencidas actualiza el board y la URL; reasignar dueño
persiste y refleja en la tarjeta; WhatsApp/Email abre link correcto y registra actividad; `/dashboard`
muestra conteos coherentes con el board.

---

## Modelo de datos

**Sin cambios de esquema.** Las tres fases operan sobre las tablas existentes
(`pipeline_leads`, `activities`, `tasks`, `accounts`, `leads`). No hay migraciones nuevas.

## API — resumen de cambios

| Fase | Método | Ruta | Cambio |
|------|--------|------|--------|
| 1 | DELETE | `/pipeline/:id` | 404 si no existe |
| 1 | (varias) | `/pipeline/:id`, `/tasks/:taskId` | validación de UUID → 400 |
| 1 | POST | `/pipeline` | insert atómico → 409 sin 500 |
| 3 | GET | `/accounts` | listar equipo `[{id, email}]` |
| 3 | GET | `/pipeline/stats` | agregados para el dashboard |

Todas con `requireAuth`, Zod, envelope `{ ok, data, error }`.

## Fuera de alcance

- Cambios de esquema / migraciones.
- Envío real de email/WhatsApp (la acción rápida abre la app externa; el envío lo hace el usuario).
- Etapas configurables, permisos por rol, forecasting con montos.
- Tests automatizados del CRM (decisión del proyecto).

## Criterio de éxito (global)

1. **Fase 1:** ningún endpoint del CRM responde 500 por input malformado; DELETE/insert con status correctos; build verde; tests del monorepo intactos.
2. **Fase 2:** el tablero se ve intencional (no template), con jerarquía, color por etapa y estados diseñados; accesible por teclado; drag pulido con overlay.
3. **Fase 3:** las 4 features funcionan end-to-end con smoke manual; estado de filtros en la URL; el dashboard es coherente con el board.

## Riesgos

- **Fase 1 #7 (filtro ganado/perdido):** si tocar el flujo de Explorar resulta más grande de lo previsto,
  la caída aceptable es alinear el README a la realidad actual (documentado arriba).
- **Fase 2:** riesgo de over-engineering visual / scope creep; se acota a las tarjetas, columnas, drag y drawer.
- **Fase 3 outreach:** no hay confirmación real de envío; la actividad se registra al **abrir** el link (optimista). Aceptable para uso propio.
- **`GET /accounts`:** expone emails del equipo a cualquier usuario autenticado; consistente con el modelo de pipeline compartido (no es un leak entre tenants).
