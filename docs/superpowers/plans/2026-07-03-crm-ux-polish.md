# Pulido UX del CRM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulido de conjunto: toasts consistentes, empty/loading states, densidad de Explorar y layout del drawer. Dentro del sistema Apple. Sin cambios de esquema/API.

**Architecture:** Sistema de toasts propio (`toast.tsx`, `ToastProvider`/`useToast`) montado en `main.tsx`; componentes compartidos `EmptyState`/`Loading`; cableado de toasts a todas las mutaciones; reescritura de `LeadsTable` (densidad) y del layout de `LeadDrawer` (secciones), solo estilo/markup.

**Tech Stack:** React 18 + TanStack Query + Tailwind (tokens Apple). TypeScript ESM.

## Global Constraints

- **SIN tests automatizados** (política). Verificación por build verde + smoke visual claro/oscuro. No agregar tests. No romper tests del monorepo.
- **Value-imports de `@leadhub/core` desde web SOLO por subpaths** (`/stages`, `/score`).
- Usar el sistema Apple: `.btn/.btn-ghost/.input/.card`, tokens `bg-canvas/bg-surface/bg-parchment/text-ink/text-muted/text-faint/text-accent/border-hairline/rounded-*`. NADA de `slate-*`/`gray-*` hardcodeado. Colores de etapa/tipo por `style` inline (`stageColor`).
- **Conservar TODA la lógica** (queries, mutaciones, drag optimista, normalización de vence, filtros en URL, invalidaciones). Reescrituras de `LeadsTable`/`LeadDrawer` = solo markup/estilo.
- Commits en español, formato convencional, usando EXACTAMENTE:
  `git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "..."`

## File Structure

- **Crear** `apps/web/src/toast.tsx` — `ToastProvider`, `useToast`.
- **Modificar** `apps/web/src/main.tsx` — montar `ToastProvider`.
- **Crear** `apps/web/src/components/EmptyState.tsx`, `apps/web/src/components/Loading.tsx`.
- **Modificar** `apps/web/src/pages/Explorer.tsx`, `apps/web/src/components/KanbanBoard.tsx`, `apps/web/src/pages/Tareas.tsx`, `apps/web/src/pages/Dashboard.tsx`, `apps/web/src/components/JobsList.tsx`, `apps/web/src/components/LeadDrawer.tsx` — empty/loading + toasts.
- **Modificar** `apps/web/src/components/LeadsTable.tsx` — densidad (10→6 columnas).

---

### Task 1: Sistema de toasts

**Files:**
- Create: `apps/web/src/toast.tsx`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Produces: `ToastProvider`, `useToast(): { success(msg), error(msg), info(msg) }`.

- [ ] **Step 1: Crear `apps/web/src/toast.tsx`**

```tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { stageColor } from '@leadhub/core/stages';

type Kind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: Kind; msg: string };
type Ctx = { push: (kind: Kind, msg: string) => void };

const ToastCtx = createContext<Ctx | null>(null);

const KIND_COLOR: Record<Kind, string> = {
  success: stageColor('ganado'),
  error: stageColor('perdido'),
  info: 'var(--color-accent)',
};

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((kind: Kind, msg: string) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, kind, msg }]);
    setTimeout(() => remove(id), 3000);
  }, [remove]);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => remove(t.id)}
            className="card bg-surface px-4 py-2.5 text-[13px] text-ink shadow-lg cursor-pointer max-w-xs"
            style={{ borderLeft: `3px solid ${KIND_COLOR[t.kind]}` }}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast fuera de ToastProvider');
  return {
    success: (msg: string) => ctx.push('success', msg),
    error: (msg: string) => ctx.push('error', msg),
    info: (msg: string) => ctx.push('info', msg),
  };
}
```

- [ ] **Step 2: Montar en `apps/web/src/main.tsx`**

Agregar el import:
```tsx
import { ToastProvider } from './toast.js';
```
Envolver `<App />` con `<ToastProvider>` DENTRO de `<AuthProvider>`:
```tsx
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
```

- [ ] **Step 3: Build de web**

Run: `pnpm --filter @leadhub/web build`
Expected: verde.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/toast.tsx apps/web/src/main.tsx
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(web): sistema de toasts (ToastProvider/useToast)"
```

---

### Task 2: Componentes EmptyState + Loading y su aplicación

**Files:**
- Create: `apps/web/src/components/EmptyState.tsx`
- Create: `apps/web/src/components/Loading.tsx`
- Modify: `apps/web/src/pages/Explorer.tsx`
- Modify: `apps/web/src/components/KanbanBoard.tsx`
- Modify: `apps/web/src/pages/Tareas.tsx`
- Modify: `apps/web/src/pages/Dashboard.tsx`
- Modify: `apps/web/src/components/JobsList.tsx`
- Modify: `apps/web/src/components/LeadDrawer.tsx`

**Interfaces:**
- Produces: `EmptyState({ icon?, title, hint? })`, `Loading({ label? })`.

- [ ] **Step 1: Crear `apps/web/src/components/EmptyState.tsx`**

```tsx
export default function EmptyState({ icon = '—', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-ink font-medium">{title}</p>
      {hint && <p className="text-muted text-[13px] mt-1">{hint}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Crear `apps/web/src/components/Loading.tsx`**

```tsx
export default function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted text-[15px]">
      <span className="inline-block w-4 h-4 rounded-pill border-2 border-hairline border-t-accent animate-spin" />
      {label}
    </div>
  );
}
```

- [ ] **Step 3: Aplicar en las vistas**

En cada archivo, importar lo que corresponda y reemplazar los estados sueltos por estos componentes, conservando la lógica:
- **`Explorer.tsx`:** mientras `leads.isLoading` (o `!leads.data`) → `<Loading />`; si `leads.data && leads.data.total === 0` → `<EmptyState icon="🔍" title="Sin resultados" hint="Probá con otros filtros" />` en lugar de la tabla. (Mantener el header con el conteo/acciones.)
- **`KanbanBoard.tsx`:** si `pipeline.isLoading` → `<Loading />`; si `!pipeline.isLoading && all.length === 0` → `<EmptyState icon="📋" title="Pipeline vacío" hint="Agregá leads desde Explorar" />` en lugar del tablero. (No tocar la mutación `move` ni el `DragOverlay`.)
- **`Tareas.tsx`:** `tasks.isLoading` → `<Loading />`; el estado vacío existente ("Sin tareas pendientes 🎉") pasarlo a `<EmptyState icon="🎉" title="Sin tareas pendientes" />`.
- **`Dashboard.tsx`:** el `!s ? <p>Cargando…</p>` pasa a `<Loading />`.
- **`JobsList.tsx`:** si `jobs.length === 0` → `<EmptyState icon="🔎" title="Sin búsquedas todavía" hint="Lanzá una búsqueda arriba" />`.
- **`LeadDrawer.tsx`:** el `!d ? <p>Cargando…</p>` pasa a `<Loading />`.

- [ ] **Step 4: Build de web**

Run: `pnpm --filter @leadhub/web build`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/EmptyState.tsx apps/web/src/components/Loading.tsx apps/web/src/pages/Explorer.tsx apps/web/src/components/KanbanBoard.tsx apps/web/src/pages/Tareas.tsx apps/web/src/pages/Dashboard.tsx apps/web/src/components/JobsList.tsx apps/web/src/components/LeadDrawer.tsx
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(web): estados de carga y vacío consistentes (EmptyState/Loading)"
```

---

### Task 3: Cablear toasts a las mutaciones

**Files:**
- Modify: `apps/web/src/pages/Explorer.tsx`
- Modify: `apps/web/src/components/LeadDrawer.tsx`
- Modify: `apps/web/src/components/KanbanBoard.tsx`
- Modify: `apps/web/src/pages/Buscar.tsx`

**Interfaces:**
- Consumes: `useToast` (Task 1).

**Contexto:** agregar `onSuccess`/`onError` con toasts a las mutaciones existentes SIN cambiar su `mutationFn` ni sus invalidaciones. Donde una mutación ya tiene `onSuccess` (ej. invalida queries), sumar la llamada al toast dentro de ese callback (no reemplazarlo).

- [ ] **Step 1: `Explorer.tsx`**

`const toast = useToast();` en el componente. En la mutación `add`: `onError: (e) => toast.error((e as Error).message)` y en su `onSuccess` existente agregar `toast.success('Agregado al pipeline')`. En la mutación `bulk`: en `onSuccess` agregar `toast.success(\`${data.added} agregados · ${data.skipped} ya estaban\`)` (recibí `data` en el callback) y `onError: (e) => toast.error((e as Error).message)`; **eliminar el `<p>` de feedback** (`{bulk.data && ...}`) ya que ahora lo muestra el toast.

- [ ] **Step 2: `LeadDrawer.tsx`**

`const toast = useToast();`. Agregar a cada mutación un toast:
- `stageMut` → success "Etapa actualizada"; `ownerMut` → success "Dueño actualizado"; `delMut` → success "Sacado del pipeline"; `taskMut` → success "Tarea agregada"; `actMut` → success "Actividad registrada"; `outreachMut` → mantener (registra actividad; opcional success "Actividad registrada").
- A cada una, `onError: (e) => toast.error((e as Error).message)`.
Sumar el toast dentro del `onSuccess` existente (que hace `inval`/`setX('')`), sin romperlo.

- [ ] **Step 3: `KanbanBoard.tsx`**

`const toast = useToast();`. En la mutación `move`, en el `onError` existente (que hace rollback) agregar `toast.error('No se pudo mover la tarjeta')` (mantener el rollback). No tocar `onMutate`/`onSettled`.

- [ ] **Step 4: `Buscar.tsx`**

`const toast = useToast();`. En la mutación de `createScrape`, `onSuccess` → `toast.success('Búsqueda encolada')` (sumar al callback existente si lo hay), `onError: (e) => toast.error((e as Error).message)`.

- [ ] **Step 5: Build de web**

Run: `pnpm --filter @leadhub/web build`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/Explorer.tsx apps/web/src/components/LeadDrawer.tsx apps/web/src/components/KanbanBoard.tsx apps/web/src/pages/Buscar.tsx
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(web): toasts de éxito/error en todas las mutaciones (reemplaza el feedback pegado del bulk)"
```

---

### Task 4: Densidad de la tabla de Explorar

**Files:**
- Modify: `apps/web/src/components/LeadsTable.tsx`

**Interfaces:**
- Consumes: `ScoreBadge`, `scoreLead` (`/score`), `stageColor`/`stageLabel` (`/stages`).

**Contexto:** reescribir SOLO el markup de la tabla para pasar de 10 columnas a 6, apilando lo secundario. Conservar props (`items`/`pipelineByLead`/`onAdd`), `ScoreBadge`, el tooltip `breakdown`, y la lógica de estado (undefined→botón, resto→punto+etiqueta). Nada de lógica nueva.

**Columnas (6):** Header `border-b border-hairline text-muted text-[13px]`; filas `border-t border-hairline hover:bg-parchment`; celdas `p-2 align-top`.
1. **Lead:** `<div className="text-ink font-medium truncate max-w-[16rem]">{razonSocial||nombreFantasia}</div>` + `<div className="text-muted text-[12px] truncate">{categoria}</div>`.
2. **Ubicación:** `text-muted text-[13px]` con `{localidad}{, provincia}`.
3. **Contacto:** teléfono (`text-ink text-[13px]`) + email (`text-muted text-[12px] truncate`) + fila de redes IG/FB/WA (`text-accent text-[12px]`) — compacto, apilado.
4. **Datos:** CUIT (`text-ink text-[13px]`) + fuente (`text-muted text-[12px]`) apilados.
5. **Prioridad:** `<ScoreBadge score={lead.score} title={breakdown(lead)} />`.
6. **Estado:** el mismo bloque IIFE actual (sin pipeline → "→ Pipeline"; en pipeline → punto `stageColor(stage)` + `stageLabel(stage)`).

Se puede quitar `overflow-x-auto` si con 6 columnas ya no desborda a anchos normales; si desborda, dejarlo. Nada de `slate-*`/`gray-*`.

- [ ] **Step 1: Reescribir el markup de `LeadsTable.tsx`** (conservando imports/props/`breakdown`/estado, cambiando solo la estructura de `<thead>`/`<tbody>` a las 6 columnas).
- [ ] **Step 2: Build** — `pnpm --filter @leadhub/web build` → verde.
- [ ] **Step 3: Grep de control** — `grep -nE "slate-|gray-" apps/web/src/components/LeadsTable.tsx` vacío.
- [ ] **Step 4: Commit** — `git add apps/web/src/components/LeadsTable.tsx && git -c ... commit -m "feat(web): tabla de Explorar más densa (6 columnas, jerarquía apilada)"`.

---

### Task 5: Layout del drawer del pipeline

**Files:**
- Modify: `apps/web/src/components/LeadDrawer.tsx`

**Contexto:** reorganizar el markup en secciones claras separadas por hairline, SIN tocar la lógica (las mutaciones y sus toasts de Task 3, la normalización de `vence`, el timeline con `ACTIVITY_META`, invalidaciones, los `disabled` por `isPending`, el `Loading` de Task 2).

**Estructura objetivo (secciones separadas por `border-t border-hairline pt-4 mt-4`):**
- **Cabecera:** nombre (`text-lg font-semibold text-ink tracking-tight`) + metadatos (`text-muted`) + botón ✕; debajo, los botones de **outreach** (WhatsApp/Email) destacados.
- **Meta:** "Etapa" (chip de color + select) y "Dueño" (select) alineados en una sección con su separador.
- **Tareas:** título de sección + composer + lista.
- **Actividad:** título de sección + composer + timeline (borde izquierdo por `ACTIVITY_META`).

Mantener clases/tokens Apple; solo mejora de agrupación/ritmo. Nada de `slate-*`/`gray-*`.

- [ ] **Step 1: Reescribir el markup del `return` de `LeadDrawer.tsx`** (conservando TODO el bloque de hooks/mutaciones/estado intacto).
- [ ] **Step 2: Build** — `pnpm --filter @leadhub/web build` → verde.
- [ ] **Step 3: Grep de control** — `grep -nE "slate-|gray-" apps/web/src/components/LeadDrawer.tsx` vacío (el `bg-black/30` del scrim está permitido).
- [ ] **Step 4: Smoke visual (lo corre el controlador):** claro y oscuro — toasts al agregar/mover/sacar; empty/loading en Explorar/Board/Tareas/Buscar; tabla de 6 columnas; drawer en secciones.
- [ ] **Step 5: Commit** — `git add apps/web/src/components/LeadDrawer.tsx && git -c ... commit -m "feat(web): drawer del pipeline reorganizado en secciones"`.

---

## Notas de verificación final (para el review de rama)

- Toda mutación dispara toast de éxito/error; el bulk ya no deja el `<p>` pegado; `ToastProvider` montado.
- Empty/loading consistentes en las 6 vistas.
- Tabla de Explorar en 6 columnas sin perder score/estado/acciones ni la lógica.
- Drawer en secciones; toda la lógica (mutaciones/vence/timeline/invalidaciones/disabled) intacta.
- Value-imports de core por subpath; nada de `slate-*`/`gray-*`.
- Drag optimista, filtros en URL, export y flujos existentes intactos; los tres paquetes compilan; tests del monorepo verdes.
