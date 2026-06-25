# maps-scraper — Diseño

**Fecha:** 2026-06-25
**Estado:** Aprobado para planificación

## Objetivo

CLI en TypeScript/Node.js (`maps-scraper`) que extrae prospectos de negocios
directamente desde Google Maps usando Playwright, sin ninguna API key externa.
Salida lista para LocalCenter en CSV + JSON.

## Decisiones del brainstorm

| Tema | Decisión |
|------|----------|
| Validación de selectores | Verificar **en vivo** contra Google Maps durante el build |
| Naming de output | **Flag manda, fecha si falta**: con `--output` ruta exacta; sin él, `output/{query}_{YYYY-MM-DD}.{csv,json}` |
| Formatos | **Siempre CSV + JSON** con el mismo nombre base |
| Sesión de browser | **Perfil persistente** en `.cache/browser-profile` (login/cookies una vez con `--headed`) |
| Gestor de paquetes | **pnpm** |
| Tests | **Solo lógica pura** (Vitest), sin E2E contra Maps |

## Ajustes sobre el spec original (reanálisis)

1. **Browser persistente, no `launch` + `newContext`.** Se usa
   `chromium.launchPersistentContext(userDataDir, {...})` en una sola llamada.
   `userAgent`, `viewport`, `locale`, `timezoneId` y los `args` anti-bot van ahí.
   No existe un objeto `browser` separado del `context` para Maps.
2. **Terminación de scroll por estancamiento (señal primaria).** Se cuentan los
   hijos de `div[role="feed"]`; si no crecen tras N rondas de scroll, se termina.
   El texto localizado de fin de lista es señal **secundaria**. Siempre se respeta `--max`.
3. **Stealth mínimo, robustez por perfil.** Se mantiene el `navigator.webdriver`
   override del spec, pero la resistencia real a la detección viene del perfil
   persistente + login manual + `--headed`, no del initScript. `playwright-extra`
   queda fuera de scope (se evalúa si hace falta).

## Tech stack

- Node.js + TypeScript (strict mode)
- Playwright (chromium), headless por defecto, `--headed` para debug
- commander (CLI), csv-writer, cli-progress, chalk, dotenv
- Vitest (tests de lógica pura)

## Arquitectura

CLI (commander) → orquestador `MapsScraper` → fases secuenciales.
Un único contexto persistente de browser para Maps; un **contexto efímero separado**
por sitio durante el enriquecimiento (no contamina el contexto de Maps).
Funciones puras aisladas y testeables; I/O confinado a los bordes.

```
src/
  cli.ts                  commander, parse de flags, valida query/location requeridos
  scraper/
    maps-scraper.ts       orquesta: search → scroll → visitar → (enrich) → export
    browser.ts            launchPersistentContext + stealth initScript + args anti-bot
    web-enricher.ts       contexto efímero, regex email + redes, timeout 10s
    selectors.ts          objeto central; cada campo = array de selectores (safeExtract)
  utils/
    safe-extract.ts       prueba selectores en orden, fallback ''        [PURA - test]
    deduplicator.ts       dedup por mapsUrl (resume) y por name+address  [PURA - test]
    email-filter.ts       regex + blocklist                              [PURA - test]
    geo.ts                parsea @LAT,LNG,Zz desde la URL                [PURA - test]
    rate-limiter.ts       sleep aleatorio delay*0.8..1.2                 [PURA - test]
    logger.ts             chalk verde/amarillo/rojo + cli-progress
    captcha.ts            detecta "unusual traffic" en page.title()
  exporters/
    csv.ts                mapea Lead → columnas LocalCenter (csv-writer) [mapeo PURA - test]
    json.ts               escribe el array de Lead
  types.ts                Lead, ScraperOptions, RawBusiness
output/                   resultados (gitignored)
.cache/                   browser-profile/ + checkpoints (gitignored)
.env.example
package.json
tsconfig.json             strict
CLAUDE.md
```

## Tipos centrales

```typescript
interface Lead {
  razonSocial: string;
  nombreFantasia: string;
  telefono: string;
  email: string;
  sitioWeb: string;
  direccion: string;
  localidad: string;
  provincia: string;
  categoria: string;
  calificacionGoogle: string;
  cantidadResenas: string;
  instagram: string;
  facebook: string;
  whatsapp: string;
  coordenadas: string;       // "LAT,LNG"
  fuente: 'Google Maps';
  fechaExtraccion: string;   // ISO timestamp
}

interface ScraperOptions {
  query: string;             // requerido
  location: string;          // requerido
  max: number;               // default 50
  enrich: boolean;
  headed: boolean;
  delay: number;             // ms, default 2000
  output?: string;           // ruta exacta; si falta → auto
  resume: boolean;
}
```

## Flujo de datos

1. **Search** — navega a `https://www.google.com/maps/search/{query}+{location}`,
   espera `div[role="feed"]`, acepta cookies si aparece el modal ("Aceptar todo" / "Accept all").
2. **Scroll** — scroll dentro del feed con `waitForTimeout(1500)` entre rondas;
   termina por estancamiento de hijos del feed (señal primaria), texto de fin
   (secundaria) o `--max`. Junta los `href` de `div[role="feed"] > div > div > a`.
3. **Visit** — por cada negocio navega a su URL y extrae con `safeExtract`
   (arrays de selectores candidatos). Coordenadas desde la URL (`@LAT,LNG,Zz`).
   CAPTCHA-check antes de continuar. Delay aleatorio `delay*0.8..1.2` entre negocios.
4. **Enrich** (`--enrich`) — contexto efímero por `sitioWeb`, timeout 10s:
   - Emails: regex `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g` sobre el HTML,
     filtrando genéricos (sentry, wix, wordpress, example, noreply, privacy, support@google).
   - Instagram / Facebook / WhatsApp: `href` que contengan los dominios respectivos
     (`wa.me/`, `api.whatsapp.com/send`).
   - Falla de navegación → skip silencioso, log en amarillo.
5. **Export** — dedup por `name+address` → CSV + JSON. `fuente="Google Maps"`,
   `fechaExtraccion` = ISO.

## Selectores (objeto central, arrays)

Punto de partida del spec; se ajustan contra el DOM real durante el build:

- Nombre: `h1.DUwDvf`, `h1`
- Categoría: `button.DkEaL`, `[jsaction*="category"]`
- Dirección: `[data-item-id="address"] .Io6YTe`
- Teléfono: `[data-item-id^="phone:tel"] .Io6YTe`
- Sitio web: `a[data-item-id="authority"]` (href), `[data-item-id="authority"] .Io6YTe`
- Rating: `div.F7nice > span[aria-hidden="true"]`
- Reseñas: `div.F7nice > span > span > span[aria-label]`

## Columnas del CSV (LocalCenter)

`razon_social, nombre_fantasia, telefono, email, sitio_web, direccion, localidad,
provincia, categoria, calificacion_google, cantidad_resenas, instagram, facebook,
whatsapp, coordenadas, fuente, fecha_extraccion`

## CLI

```
maps-scraper search \
  --query "gimnasios" \
  --location "Adrogué, Buenos Aires, Argentina" \
  --max 100 --enrich --headed --delay 2000 \
  --output ./output/gimnasios.csv
```

| Flag | Tipo | Default | Notas |
|------|------|---------|-------|
| `--query` | string | — | requerido |
| `--location` | string | — | requerido |
| `--max` | number | 50 | máximo de resultados |
| `--enrich` | boolean | false | visitar sitio para email/redes |
| `--headed` | boolean | false | mostrar browser |
| `--delay` | number | 2000 | ms base entre negocios |
| `--output` | string | auto | sin él → `output/{query}_{YYYY-MM-DD}` |
| `--resume` | boolean | false | continuar desde checkpoint |

## Anti-bot

Dentro de `launchPersistentContext`:

```typescript
const context = await chromium.launchPersistentContext(userDataDir, {
  headless: !options.headed,
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 800 },
  locale: 'es-AR',
  timezoneId: 'America/Argentina/Buenos_Aires',
});
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});
```

Delay aleatorio entre negocios (`delay*0.8..1.2`), nunca fijo.

## Resiliencia

- Negocio falla → log rojo + continuar con el siguiente.
- Checkpoint cada 10 negocios en `.cache/{query}-{date}.json`.
- `--resume` lee el checkpoint y saltea por `mapsUrl` ya procesada.
- CAPTCHA detectado (`page.title()` contiene "unusual traffic") → error descriptivo
  sugiriendo bajar `--max` o subir `--delay`.

## Tests (Vitest, AAA)

Unitarios sobre lógica pura: `safe-extract`, `deduplicator`, `email-filter`,
`geo`, `rate-limiter` (rango del delay) y el mapeo `Lead → CSV`.
Sin E2E contra Maps (flaky por diseño).

## Criterio de éxito

```
maps-scraper search --query "restaurantes" --location "Buenos Aires, Argentina" \
  --max 20 --enrich --headed
```

Genera `output/restaurantes_2026-06-25.{csv,json}` con ~20 filas, columnas de
LocalCenter, emails y redes donde estén disponibles, y browser visible durante el scraping.

## Riesgos conocidos

- Los selectores ofuscados de Google Maps cambian seguido; mitigado con `safeExtract`
  (arrays de candidatos) y verificación en vivo durante el build.
- Detección anti-bot de Google; mitigada con perfil persistente + login manual + delays
  aleatorios, no con stealth pesado.
- Scraping de Google Maps puede violar sus Términos de Servicio; uso bajo
  responsabilidad del usuario para prospección de datos públicos de negocios.
```
