# Rediseño Apple del CRM — Diseño

**Fecha:** 2026-07-03
**Estado:** Aprobado para planificación
**Referencia autoritativa:** `~/.claude/design-md-lib/design-md/apple/DESIGN.md`

## Objetivo

Re-skin de toda la app LeadHub al lenguaje de diseño de Apple, **traducido de galería de
producto a UI de app de datos**. Sistema themeable de raíz con **toggle claro/oscuro**.

## Decisiones del brainstorm

| Tema | Decisión |
|------|----------|
| Alcance | **Toda la app**: Nav, Login, Explorar, Buscar, Pipeline (board+drawer), Tareas, Dashboard |
| Colores de etapa | **Mantener** los 6 (data-viz funcional) pero **retuneados a tono Apple apagado**; solo como punto/acento. Todo lo interactivo = Action Blue |
| Modo | **Claro + oscuro con toggle** (persistido, respeta `prefers-color-scheme` la 1ª vez) |
| Testing | **Sin tests automatizados** (política del proyecto); verificación por build + **smoke visual en ambos temas** |

## Principios Apple aplicados

- **Un solo acento**: Action Blue `#0066cc` (claro) / Sky Blue `#2997ff` (oscuro) para *todo* lo interactivo. Cero segundo color de marca.
- **Tipografía SF Pro** vía `system-ui, -apple-system` (SF Pro real en macOS, sin web font). Letter-spacing negativo en tamaños ≥17px ("Apple tight"). Body a 17px/400. Pesos 400/600 (500 ausente).
- **Superficies, no sombras**: profundidad por cambio de superficie + hairline 1px; **sin sombras en chrome** (Apple usa exactamente una, para fotos de producto — no aplica acá). El drawer, al ser overlay, mantiene el dim de fondo.
- **Radios**: `pill` para acciones e inputs, `lg` (18px) para utility cards, `sm` (8px) para botones utilitarios. Nada intermedio.
- **Aire**: espaciado generoso; densidad baja pero adaptada a app de datos.
- **Nav negro** (`#000`) en ambos modos — firma Apple.
- **Micro-interacción**: `transform: scale(0.95)` en el press de los botones; respeta `prefers-reduced-motion`.

## Arquitectura de theming (clave)

**Tokens como CSS custom properties** en `apps/web/src/index.css`:
- `:root` define el tema **claro**; `[data-theme="dark"]` sobreescribe para **oscuro**.
- **Tailwind** (`tailwind.config.js`) se extiende para exponer los tokens como **utilidades semánticas** que apuntan a las variables (`bg-canvas`, `text-ink`, `text-muted`, `text-accent`, `bg-accent`, `border-hairline`, `rounded-pill`, `font-sans`).
- **Cambiar de tema = cambiar variables** en `<html data-theme>`. No se usa el prefijo `dark:` de Tailwind salvo casos puntuales; la mayoría de los componentes solo usan utilidades semánticas que se re-resuelven solas.
- **DRY**: `@layer components` en `index.css` define `.btn`, `.btn-ghost`, `.btn-utility`, `.input`, `.card` sobre los tokens, así los componentes no repiten strings de estilo.

### Tokens (valores)

**Claro (`:root`):**
```
--color-canvas: #ffffff;      --color-parchment: #f5f5f7;   --color-surface: #ffffff;
--color-ink: #1d1d1f;         --color-muted: #6e6e73;       --color-faint: #86868b;
--color-accent: #0066cc;      --color-accent-focus: #0071e3;
--color-hairline: #d2d2d7;    --color-divider: #f0f0f0;     --color-nav: #000000;
--color-on-accent: #ffffff;   --color-on-nav: #f5f5f7;
```
**Oscuro (`[data-theme="dark"]`):**
```
--color-canvas: #000000;      --color-parchment: #1d1d1f;   --color-surface: #1d1d1f;
--color-ink: #f5f5f7;         --color-muted: #a1a1a6;       --color-faint: #6e6e73;
--color-accent: #2997ff;      --color-accent-focus: #2997ff;
--color-hairline: #424245;    --color-divider: #2a2a2c;     --color-nav: #000000;
--color-on-accent: #ffffff;   --color-on-nav: #f5f5f7;
```

**Tipografía / radios (Tailwind extend):**
```
fontFamily.sans: ['-apple-system','system-ui','"SF Pro Text"','"SF Pro Display"','Inter','sans-serif']
borderRadius: { none:0, xs:5px, sm:8px, md:11px, lg:18px, pill:9999px }
```
Base en `@layer base`: `body { background: canvas; color: ink; font: 17px/1.47; letter-spacing: -0.01em; -webkit-font-smoothing: antialiased; }`. Títulos con weight 600 y tracking `-0.02em`.

**Colores de etapa (core, retuneados a tono Apple apagado):**
```
nuevo #8e8e93 · contactado #0071a8 · interesado #6e5aa8 · negociacion #b06d1f · ganado #1a7f52 · perdido #b23b3b
```
Se aplican por `style` inline (igual que hoy), funcionan en claro y oscuro como acento pequeño.

## Gramática de componentes (`@layer components`)

- `.btn` — pill Action Blue: `bg-accent text-on-accent rounded-pill px-5 py-2`, `active:scale-95`, focus ring `--color-accent-focus`.
- `.btn-ghost` — pill secundario: transparente, borde `1px accent`, texto `accent`, `rounded-pill`.
- `.btn-utility` — tinta: `bg-ink text-canvas rounded-sm px-3 py-1.5` (para acciones utilitarias, ej. Salir/Exportar).
- `.input` — pill: `bg-surface border border-hairline rounded-pill px-4 h-11 text-ink` + focus ring accent. (Selects/checkboxes toman los mismos hairline/tokens.)
- `.card` — utility card: `bg-surface border border-hairline rounded-lg` (18px), sin sombra.
- `.hairline` — borde 1px `--color-hairline` para tablas/separadores.

## Superficies

Cada superficie se reescribe para usar tokens/clases semánticas (nada de `slate-*`/`gray-*` hardcodeado):

- **Nav**: barra negra (`--color-nav`), links en `nav-link` (12px), **toggle de tema** (☀️/🌙) + Salir como `btn-utility`.
- **Login**: card centrada, inputs pill, botón `.btn`.
- **Explorar**: tabla con hairlines (sin fondo gris), search/filtros pill, acciones en Action Blue / `.btn-ghost`; botón "→ Pipeline" como link azul; export como `.btn-utility`.
- **Buscar**: formulario con inputs pill, botón `.btn`; lista de jobs como `.card` con barra de progreso en accent.
- **Pipeline**: columnas sobre `parchment`/`surface` con **borde superior en color de etapa** + punto; tarjetas `.card` (hairline, 18px), tipografía tight; `BoardFilters` con `.input` pill + selects hairline; `DragOverlay` sin sombra pesada (usa surface + hairline). Se conserva el drag optimista.
- **LeadDrawer**: panel `surface` con secciones separadas por hairline; chip de etapa (punto de color), inputs pill, acciones (WhatsApp/Email/Sacar) en la gramática de botones; timeline con borde izquierdo en color de actividad. Se conserva toda la lógica.
- **Tareas**: items como `.card`, vencidas con el rojo de etapa (`perdido`), check nativo estilizado.
- **Dashboard**: métricas como `.card` (utility), embudo con barras en color de etapa apagado; conversión/vencidas con acento.

## Estado del tema

`apps/web/src/theme.ts`: `useTheme()` → lee `localStorage.theme` o `prefers-color-scheme`, setea `document.documentElement.dataset.theme`, expone `theme` + `toggle()`. Persiste en `localStorage`. Se aplica lo antes posible (en `main.tsx` un script inline evita el flash).

## Fuera de alcance

- Rediseño de datos/lógica (solo estilo).
- Animaciones scrollytelling / fotografía de producto (no aplica a una app de datos).
- Cambios de esquema o de API.

## Criterio de éxito

1. Toggle claro/oscuro funciona en toda la app y persiste; sin flash al recargar.
2. Todo lo interactivo usa el único Action Blue; cero segundo acento (salvo los puntos de etapa como data-viz).
3. Tipografía SF Pro tight, body 17px, superficies + hairline sin sombras en chrome.
4. Ninguna superficie conserva `slate-*`/`gray-*` hardcodeado; todo por tokens.
5. Los tres paquetes compilan; el drag optimista, las mutaciones y los flujos existentes siguen intactos; tests del monorepo verdes.
6. Smoke visual OK en **claro y oscuro** a 1440/1024/768.

## Riesgos

- **Volumen de reescritura**: muchas superficies; se acota reusando `@layer components` (DRY) y utilidades semánticas.
- **Flash de tema** al cargar: mitigado aplicando `data-theme` antes del render (script inline en `index.html`/`main.tsx`).
- **Contraste en oscuro**: el accent pasa a Sky Blue `#2997ff` y la tinta a `#f5f5f7`; verificar contraste AA en el smoke.
- **Colores de etapa vs "un solo acento"**: se preserva como data-viz apagado (decisión explícita), no como segundo color de marca.
