# Rediseño Apple del CRM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin de toda la app LeadHub al lenguaje Apple, themeable de raíz con toggle claro/oscuro.

**Architecture:** Tokens como CSS custom properties (`:root` claro / `[data-theme="dark"]` oscuro) en `index.css`; Tailwind extendido para exponerlos como utilidades semánticas (`bg-canvas`, `text-ink`, `text-accent`, `border-hairline`, `rounded-pill`, `font-sans`). Clases DRY (`.btn`, `.btn-ghost`, `.btn-utility`, `.input`, `.card`) en `@layer components`. Cada superficie se reescribe usando SOLO tokens/clases semánticas. Toggle persistido; `data-theme` aplicado antes del render para evitar flash.

**Tech Stack:** React 18 + Vite + Tailwind (CSS vars + `@layer`), TypeScript ESM. SF Pro vía `system-ui`.

## Global Constraints

- **SIN tests automatizados** (política del proyecto). Verificación por **build verde** + **smoke visual en claro Y oscuro**. No agregar tests. No romper tests del monorepo.
- **Nada de colores hardcodeados `slate-*`/`gray-*`/`bg-black`/`text-red-600` etc.** en las superficies: usar utilidades semánticas (`bg-canvas`, `text-ink`, `text-muted`, `text-accent`, `bg-accent`, `border-hairline`, `bg-parchment`, `bg-surface`) o las clases `.btn/.input/.card`. Excepción: los **colores de etapa/actividad** siguen por `style` inline (hex de core), y el rojo de "vencida" usa el hex de etapa `perdido` vía `stageColor('perdido')` o el token de peligro si se define.
- **Value-imports de `@leadhub/core` desde web SOLO por `@leadhub/core/stages`**.
- **Un solo acento**: todo lo interactivo usa `accent` (Action Blue claro / Sky Blue oscuro vía token). Cero segundo color de marca.
- Conservar TODA la lógica existente (auth, queries, mutaciones, drag optimista, normalización de vence, filtros en URL). Esto es SOLO estilo.
- Micro-interacción: `active:scale-95` en botones; respetar `prefers-reduced-motion` donde ya se respeta.
- Commits en español, formato convencional, usando EXACTAMENTE:
  `git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "..."`

## File Structure

- **Modificar** `apps/web/src/index.css` — tokens (vars claro/oscuro) + `@layer base` + `@layer components`.
- **Modificar** `apps/web/tailwind.config.js` — extend colors→vars, fontFamily, borderRadius.
- **Modificar** `apps/web/index.html` — script inline anti-flash de tema.
- **Modificar** `packages/core/src/stages.ts` — `STAGE_COLORS` retuneados a tono Apple.
- **Crear** `apps/web/src/theme.ts` — `useTheme()` (toggle + persistencia).
- **Modificar** por superficie: `components/Nav.tsx`, `pages/Login.tsx`, `pages/Explorer.tsx`, `components/LeadsTable.tsx`, `components/Filters.tsx`, `pages/Buscar.tsx`, `components/SearchForm.tsx`, `components/JobsList.tsx`, `components/KanbanBoard.tsx`, `components/KanbanCard.tsx`, `components/BoardFilters.tsx`, `components/LeadDrawer.tsx`, `pages/Tareas.tsx`, `pages/Dashboard.tsx`.

---

### Task 1: Fundación — tokens, Tailwind, base y clases de componente

**Files:**
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/tailwind.config.js`
- Modify: `apps/web/index.html`
- Modify: `packages/core/src/stages.ts`

**Interfaces:**
- Produces: utilidades semánticas de Tailwind (`bg-canvas`, `bg-parchment`, `bg-surface`, `text-ink`, `text-muted`, `text-faint`, `text-accent`, `bg-accent`, `text-on-accent`, `border-hairline`, `border-divider`, `bg-nav`, `text-on-nav`, `rounded-pill|lg|md|sm|xs`, `font-sans`) y clases `.btn`, `.btn-ghost`, `.btn-utility`, `.input`, `.card`.

- [ ] **Step 1: Reescribir `apps/web/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-canvas: #ffffff;
  --color-parchment: #f5f5f7;
  --color-surface: #ffffff;
  --color-ink: #1d1d1f;
  --color-muted: #6e6e73;
  --color-faint: #86868b;
  --color-accent: #0066cc;
  --color-accent-focus: #0071e3;
  --color-hairline: #d2d2d7;
  --color-divider: #f0f0f0;
  --color-nav: #000000;
  --color-on-accent: #ffffff;
  --color-on-nav: #f5f5f7;
}
[data-theme="dark"] {
  --color-canvas: #000000;
  --color-parchment: #1d1d1f;
  --color-surface: #1d1d1f;
  --color-ink: #f5f5f7;
  --color-muted: #a1a1a6;
  --color-faint: #6e6e73;
  --color-accent: #2997ff;
  --color-accent-focus: #2997ff;
  --color-hairline: #424245;
  --color-divider: #2a2a2c;
  --color-nav: #000000;
  --color-on-accent: #ffffff;
  --color-on-nav: #f5f5f7;
}

@layer base {
  html { color-scheme: light dark; }
  body {
    background-color: var(--color-canvas);
    color: var(--color-ink);
    font-family: theme('fontFamily.sans');
    font-size: 17px;
    line-height: 1.47;
    letter-spacing: -0.01em;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  h1, h2, h3 { font-weight: 600; letter-spacing: -0.02em; }
}

@layer components {
  .btn {
    @apply inline-flex items-center justify-center gap-1.5 bg-accent text-on-accent rounded-pill px-5 py-2 text-[15px] transition-transform active:scale-95 disabled:opacity-40 disabled:active:scale-100;
  }
  .btn:focus-visible { outline: 2px solid var(--color-accent-focus); outline-offset: 2px; }
  .btn-ghost {
    @apply inline-flex items-center justify-center gap-1.5 bg-transparent text-accent border border-accent rounded-pill px-5 py-2 text-[15px] transition-transform active:scale-95 disabled:opacity-40;
  }
  .btn-utility {
    @apply inline-flex items-center justify-center gap-1.5 bg-ink text-canvas rounded-sm px-3 py-1.5 text-[13px] transition-transform active:scale-95 disabled:opacity-40;
  }
  .input {
    @apply bg-surface border border-hairline rounded-pill px-4 h-9 text-[15px] text-ink placeholder:text-faint;
  }
  .input:focus-visible { outline: 2px solid var(--color-accent-focus); outline-offset: 0; }
  .card { @apply bg-surface border border-hairline rounded-lg; }
}
```

- [ ] **Step 2: Reescribir `apps/web/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-canvas)',
        parchment: 'var(--color-parchment)',
        surface: 'var(--color-surface)',
        ink: 'var(--color-ink)',
        muted: 'var(--color-muted)',
        faint: 'var(--color-faint)',
        accent: 'var(--color-accent)',
        'accent-focus': 'var(--color-accent-focus)',
        hairline: 'var(--color-hairline)',
        divider: 'var(--color-divider)',
        nav: 'var(--color-nav)',
        'on-accent': 'var(--color-on-accent)',
        'on-nav': 'var(--color-on-nav)',
      },
      fontFamily: {
        sans: ['-apple-system', 'system-ui', '"SF Pro Text"', '"SF Pro Display"', 'Inter', 'sans-serif'],
      },
      borderRadius: { none: '0', xs: '5px', sm: '8px', md: '11px', lg: '18px', pill: '9999px' },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Anti-flash de tema en `apps/web/index.html`**

Agregar dentro de `<head>` (antes del `</head>`):

```html
    <script>
      (function () {
        try {
          var t = localStorage.getItem('theme');
          if (t !== 'light' && t !== 'dark') {
            t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          }
          document.documentElement.dataset.theme = t;
        } catch (e) {}
      })();
    </script>
```

- [ ] **Step 4: Retunear `STAGE_COLORS` en core**

En `packages/core/src/stages.ts`, reemplazar el objeto `STAGE_COLORS` y el fallback de `stageColor` por tonos Apple apagados:

```ts
export const STAGE_COLORS: Record<StageId, string> = {
  nuevo: '#8e8e93',
  contactado: '#0071a8',
  interesado: '#6e5aa8',
  negociacion: '#b06d1f',
  ganado: '#1a7f52',
  perdido: '#b23b3b',
};

/** Hex de la etapa; gris neutro si el id no matchea. */
export function stageColor(id: string): string {
  return (STAGE_COLORS as Record<string, string>)[id] ?? '#8e8e93';
}
```

(No tocar `ACTIVITY_META` ni el resto.)

- [ ] **Step 5: Build**

Run: `pnpm --filter @leadhub/core build && pnpm --filter @leadhub/web build`
Expected: ambos verdes. (Confirma que `@apply` de las clases resuelve las utilidades semánticas y que el `theme('fontFamily.sans')` compila.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/index.css apps/web/tailwind.config.js apps/web/index.html packages/core/src/stages.ts
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(web): fundación de tokens Apple (CSS vars claro/oscuro, Tailwind, clases DRY) + etapas retuneadas"
```

---

### Task 2: Toggle de tema + Nav

**Files:**
- Create: `apps/web/src/theme.ts`
- Modify: `apps/web/src/components/Nav.tsx`

**Interfaces:**
- Consumes: utilidades/clases de Task 1.
- Produces: `useTheme(): { theme: 'light' | 'dark'; toggle: () => void }`.

- [ ] **Step 1: Crear `apps/web/src/theme.ts`**

```ts
import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
}
```

- [ ] **Step 2: Reescribir `apps/web/src/components/Nav.tsx`**

Barra negra Apple (`bg-nav`), links en 13px, `NavLink` activo con acento, botón de toggle (☀️/🌙) y Salir como `.btn-utility`. Reemplazar el contenido por:

```tsx
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.js';
import { useTheme } from '../theme.js';

export default function Nav() {
  const { signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const cls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-sm text-[13px] tracking-tight transition-colors ${isActive ? 'text-on-nav font-semibold' : 'text-on-nav/70 hover:text-on-nav'}`;
  return (
    <nav className="flex items-center gap-1 bg-nav px-6 h-12">
      <span className="font-semibold text-on-nav mr-4 tracking-tight">LeadHub</span>
      <NavLink to="/" className={cls} end>Explorar</NavLink>
      <NavLink to="/buscar" className={cls}>Buscar</NavLink>
      <NavLink to="/pipeline" className={cls}>Pipeline</NavLink>
      <NavLink to="/tareas" className={cls}>Tareas</NavLink>
      <NavLink to="/dashboard" className={cls}>Dashboard</NavLink>
      <div className="ml-auto flex items-center gap-3">
        <button onClick={toggle} aria-label="Cambiar tema" className="text-on-nav/70 hover:text-on-nav text-[15px]">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button onClick={signOut} className="btn-utility">Salir</button>
      </div>
    </nav>
  );
}
```

Nota: `text-on-nav/70` usa la sintaxis de opacidad de Tailwind sobre el color var; si el build fallara con esa opacidad sobre CSS var, reemplazar por una clase `text-[#f5f5f7cc]` o quitar la opacidad (usar `text-on-nav` liso). Verificar en el build.

- [ ] **Step 3: Build**

Run: `pnpm --filter @leadhub/web build`
Expected: verde.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/theme.ts apps/web/src/components/Nav.tsx
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(web): toggle de tema (claro/oscuro persistido) + nav negro Apple"
```

---

### Task 3: Login

**Files:**
- Modify: `apps/web/src/pages/Login.tsx`

**Contexto:** conservar la lógica de `submit`/`login`/`signIn`. Solo estilo Apple. Archivo actual usa `border p-2`, `bg-black`.

- [ ] **Step 1: Reescribir el markup de `Login.tsx`** (mantener imports, estado y `submit` idénticos; cambiar solo el `return`):

```tsx
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <form onSubmit={submit} className="w-full max-w-sm card p-8 space-y-4">
        <h1 className="text-3xl font-semibold text-ink tracking-tight">LeadHub</h1>
        <input className="input w-full" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input w-full" type="password" placeholder="Contraseña" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p className="text-[13px]" style={{ color: '#b23b3b' }}>{err}</p>}
        <button className="btn w-full">Entrar</button>
      </form>
    </div>
  );
```

- [ ] **Step 2: Build** — `pnpm --filter @leadhub/web build` → verde.
- [ ] **Step 3: Commit** — `git add apps/web/src/pages/Login.tsx && git -c ... commit -m "feat(web): login con estilo Apple"`.

---

### Task 4: Explorar (Explorer + LeadsTable + Filters)

**Files:**
- Modify: `apps/web/src/pages/Explorer.tsx`
- Modify: `apps/web/src/components/LeadsTable.tsx`
- Modify: `apps/web/src/components/Filters.tsx`

**Contexto:** conservar TODA la lógica (queries, filtros en URL, mutación addToPipeline, `pipelineByLead`, marcado de cerrados). Reemplazar clases hardcodeadas por tokens.

**Reglas de reskin (aplican a los 3 archivos):**
- Contenedores/paneles: `bg-canvas`/`bg-surface`; texto `text-ink`, secundario `text-muted`, terciario `text-faint`.
- Tabla: quitar `bg-gray-100`; header con `border-b border-hairline text-muted text-[13px]`; filas con `border-t border-hairline`; hover de fila `hover:bg-parchment`.
- Search / inputs de filtro: clase `.input` (pill). Checkboxes/labels con `text-muted`.
- Botón "Exportar CSV": `.btn` (Action Blue pill) o `.btn-utility` (elegir `.btn` para acción primaria).
- Celda Pipeline: "→ Pipeline" como `text-accent` link; "✓ en pipeline" en `text-accent`; cerrados (`stageLabel`) en `text-muted` con el punto de color de etapa por `style` (opcional).
- Links de redes (IG/FB/WA): `text-accent`.
- Nada de `slate-*`/`gray-*`/`text-blue-600`/`bg-black` debe quedar.

- [ ] **Step 1:** Reescribir `Explorer.tsx` (layout `bg-canvas`, header con conteo en `text-muted`, botón export `.btn`, mantener `<Filters>` y `<LeadsTable>` y su cableado).
- [ ] **Step 2:** Reescribir `LeadsTable.tsx` (tabla con hairlines, celda Pipeline con `text-accent`, mantener props `pipelineByLead`/`onAdd` y la lógica de 3 estados; conservar el import `@leadhub/core/stages`).
- [ ] **Step 3:** Reescribir `Filters.tsx` (inputs/checkboxes con tokens; mantener props y lógica).
- [ ] **Step 4: Build** — `pnpm --filter @leadhub/web build` → verde.
- [ ] **Step 5: Commit** — `git add apps/web/src/pages/Explorer.tsx apps/web/src/components/LeadsTable.tsx apps/web/src/components/Filters.tsx && git -c ... commit -m "feat(web): Explorar con estilo Apple (tabla hairline, search pill, acento único)"`.

---

### Task 5: Buscar (Buscar + SearchForm + JobsList)

**Files:**
- Modify: `apps/web/src/pages/Buscar.tsx`
- Modify: `apps/web/src/components/SearchForm.tsx`
- Modify: `apps/web/src/components/JobsList.tsx`

**Contexto:** conservar la lógica (mutación createScrape, polling de jobs, estados). Solo estilo.

**Reglas de reskin:**
- Layout `bg-canvas`, títulos `text-ink`.
- Formulario: inputs/number/checkbox con `.input`/tokens; botón "Buscar en Google Maps" como `.btn`.
- Lista de jobs: cada job como `.card` con padding; `query @ location` en `text-ink`, metadatos en `text-muted`; **badge de estado** con color por estado usando `style` inline (queued=faint, running=accent, done=stageColor('ganado'), error=stageColor('perdido')) — no clases de color hardcodeadas; **barra de progreso** en `bg-accent` sobre `bg-parchment`; botón "Ver en el explorador" como `.btn-ghost`.
- Nada de `slate-*`/`gray-*` debe quedar.

- [ ] **Step 1:** Reescribir `Buscar.tsx`.
- [ ] **Step 2:** Reescribir `SearchForm.tsx`.
- [ ] **Step 3:** Reescribir `JobsList.tsx`.
- [ ] **Step 4: Build** → verde.
- [ ] **Step 5: Commit** — `... commit -m "feat(web): Buscar con estilo Apple (form pill, jobs como cards)"`.

---

### Task 6: Pipeline board (KanbanBoard + KanbanCard + BoardFilters)

**Files:**
- Modify: `apps/web/src/components/KanbanBoard.tsx`
- Modify: `apps/web/src/components/KanbanCard.tsx`
- Modify: `apps/web/src/components/BoardFilters.tsx`
- Modify: `apps/web/src/pages/Pipeline.tsx`

**Contexto:** conservar TODO (mutación `move` optimista, `DragOverlay`, `useReducedMotion`, filtro client-side + URL, `stageColor`/`CLOSED_STAGES`). Solo estilo.

**Reglas de reskin:**
- `Pipeline.tsx`: título `text-ink` tracking-tight; contenedor `bg-canvas`.
- `BoardFilters.tsx`: search con `.input`; selects/labels con tokens (`border-hairline`, `text-muted`); "Limpiar" como `text-accent`.
- `KanbanBoard.tsx` (Column): columna sobre `bg-parchment` (`bg-surface` al `isOver`), `rounded-lg`; **borde superior de color de etapa** por `style` (se conserva); header `text-ink` con conteo `text-faint`; estado vacío con `border-hairline` dashed y `text-faint`. `DragOverlay`: la tarjeta levantada usa `.card` con un realce leve (borde acento o superficie), SIN sombra pesada.
- `KanbanCard.tsx`: `.card` (hairline, `rounded-lg`), nombre `text-ink` semibold, metadatos `text-muted`; chip de categoría `bg-parchment text-muted`; avatar de dueño se mantiene (color por `style`); chip de vencimiento: vencida con `stageColor('perdido')` por `style` (fondo tenue), futura `text-muted`; badge de tareas con `bg-accent/10 text-accent` o `style`. `hover:border-hairline`→ usar realce sutil; focus-visible ring `accent-focus`.
- Nada de `slate-*`/`amber-*`/`red-*` hardcodeado; el rojo de vencida sale de `stageColor('perdido')`.

- [ ] **Step 1:** Reescribir `Pipeline.tsx` (solo el header/contenedor; mantener `BoardFilters`+`KanbanBoard`+`LeadDrawer` y el estado de filtros en URL).
- [ ] **Step 2:** Reescribir `BoardFilters.tsx` (tokens; mantener props y `getAccounts`).
- [ ] **Step 3:** Reescribir `KanbanBoard.tsx` (Column con tokens + acento de etapa; conservar `move`/`DragOverlay`/`useReducedMotion`/filtro).
- [ ] **Step 4:** Reescribir `KanbanCard.tsx` (`.card` + tokens; conservar `useDraggable`, avatar, vencimiento vía `stageColor('perdido')`).
- [ ] **Step 5: Build** → verde.
- [ ] **Step 6: Commit** — `... commit -m "feat(web): tablero Pipeline con estilo Apple (cards hairline, acento único, etapa apagada)"`.

---

### Task 7: LeadDrawer

**Files:**
- Modify: `apps/web/src/components/LeadDrawer.tsx`

**Contexto:** conservar TODAS las mutaciones (act/task/toggle/stage/owner/del/outreach), la normalización de `vence`, los `disabled` por `isPending`, el timeline con `ACTIVITY_META`, la invalidación de `['pipeline-stats']`. Solo estilo.

**Reglas de reskin:**
- Overlay: mantener `fixed inset-0` con dim de fondo (`bg-black/30` es aceptable para el scrim del overlay); panel `bg-surface` con `border-l border-hairline`, `h-full`, `overflow-y-auto`.
- Header: nombre `text-ink` semibold tracking-tight; metadatos `text-muted`; botón ✕ `text-faint hover:text-ink`.
- Outreach: WhatsApp/Email como `.btn` (o `.btn-ghost`) — el WhatsApp puede mantener su verde de marca por `style` inline (excepción de marca externa) o unificarse a `.btn`; preferir `.btn` para coherencia Apple, con ícono. Email como `.btn-ghost`.
- Etapa/Dueño: selects con `border-hairline bg-surface text-ink rounded-md`; chip de etapa con punto de color por `style`; "Sacar" como `text-accent` o `text-[perdido]` (usar `text-accent` para acción; el color destructivo puede ir con `stageColor('perdido')` por `style`).
- Tareas/Actividad: inputs `.input` (o `border-hairline` rects si el pill se ve raro en el composer — preferir hairline rect `rounded-md` para los campos del composer, y `.btn`/`+` con `bg-accent`); timeline con borde izquierdo en color de actividad (`ACTIVITY_META`, se conserva) y texto `text-ink`/`text-faint`.
- Nada de `slate-*`/`bg-slate-800` hardcodeado; los `+` usan `bg-accent text-on-accent`.

- [ ] **Step 1:** Reescribir el markup de `LeadDrawer.tsx` con tokens (mantener TODO el bloque de hooks/mutaciones intacto).
- [ ] **Step 2: Build** → verde.
- [ ] **Step 3: Commit** — `... commit -m "feat(web): drawer con estilo Apple (surface, hairline, acento único)"`.

---

### Task 8: Tareas + Dashboard + smoke visual

**Files:**
- Modify: `apps/web/src/pages/Tareas.tsx`
- Modify: `apps/web/src/pages/Dashboard.tsx`

**Contexto:** conservar la lógica. Solo estilo.

**Reglas de reskin:**
- `Tareas.tsx`: título `text-ink`; items como `.card` con padding; título de tarea `text-ink`, lead `text-muted`; vencida con `stageColor('perdido')` por `style`; estado vacío `text-faint`.
- `Dashboard.tsx`: métricas como `.card` (el borde superior de acento se mantiene por `style`, ahora usando el token — para "conversión" usar `stageColor('ganado')`, para "vencidas" `stageColor('perdido')`); embudo con barras en color de etapa por `style` sobre `bg-parchment`; textos `text-ink`/`text-muted`; título `text-ink`.
- Nada de `slate-*` hardcodeado.

- [ ] **Step 1:** Reescribir `Tareas.tsx`.
- [ ] **Step 2:** Reescribir `Dashboard.tsx`.
- [ ] **Step 3: Build** — `pnpm --filter @leadhub/web build` → verde.
- [ ] **Step 4: Smoke visual (lo corre el CONTROLADOR):** levantar web + API, capturar en **claro y oscuro** a 1440/1024/768: Nav (negro + toggle), Login, Explorar, Buscar, Pipeline + drawer, Tareas, Dashboard. Verificar: un solo acento azul, tipografía tight, hairlines sin sombras de chrome, contraste AA en oscuro, toggle persiste sin flash.
- [ ] **Step 5: Commit** — `git add apps/web/src/pages/Tareas.tsx apps/web/src/pages/Dashboard.tsx && git -c ... commit -m "feat(web): Tareas y Dashboard con estilo Apple"`.

---

## Notas de verificación final (para el review de rama)

- Toggle claro/oscuro funciona en toda la app, persiste, sin flash (script anti-flash en `index.html`).
- Ninguna superficie conserva `slate-*`/`gray-*`/`bg-black`/`text-red-600` hardcodeado; todo por tokens/clases. Los colores de etapa/actividad y el rojo de "vencida" salen de `stageColor(...)`/`ACTIVITY_META` por `style` inline.
- Value-imports de core en web solo por `@leadhub/core/stages`.
- Drag optimista, mutaciones, filtros en URL, normalización de vence e invalidaciones intactos.
- Los tres paquetes compilan; tests del monorepo verdes.
- Smoke visual OK en claro y oscuro a 1440/1024/768.
