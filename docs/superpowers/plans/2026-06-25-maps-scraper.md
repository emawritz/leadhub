# maps-scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CLI en TypeScript que extrae prospectos de negocios desde Google Maps con Playwright (sin API keys) y exporta CSV + JSON con columnas LocalCenter.

**Architecture:** CLI (commander) → orquestador `MapsScraper` → fases secuenciales (search → scroll → visit → enrich → export). Un contexto persistente de browser para Maps; contexto efímero por sitio en el enriquecimiento. Toda la lógica pura (parseo, filtros, dedup, mapeo) vive en módulos sin I/O y se testea con Vitest; el I/O de Playwright queda en los bordes sin tests unitarios.

**Tech Stack:** Node.js 20 + TypeScript strict, Playwright (chromium, `launchPersistentContext`), commander, csv-writer, cli-progress, chalk, dotenv, Vitest. Gestor: **pnpm**.

## Global Constraints

- TypeScript **strict mode** en `tsconfig.json`.
- Gestor de paquetes: **pnpm** (nunca npm/yarn para instalar).
- Sin API keys externas; toda la extracción vía Playwright.
- Browser via `chromium.launchPersistentContext('.cache/browser-profile', {...})` — **nunca** `launch` + `newContext` para Maps.
- `userAgent`, `viewport {1280,800}`, `locale: 'es-AR'`, `timezoneId: 'America/Argentina/Buenos_Aires'` y `args ['--no-sandbox','--disable-blink-features=AutomationControlled']` van dentro de `launchPersistentContext`.
- Output: con `--output` ruta exacta (base sin extensión); sin él, `output/{slug(query)}_{YYYY-MM-DD}`. **Siempre** se escriben ambos `.csv` y `.json`.
- `Lead.fuente` siempre `'Google Maps'`; `Lead.fechaExtraccion` ISO timestamp.
- Delay entre negocios: aleatorio `delay*0.8..1.2`, nunca fijo.
- Tests: solo lógica pura. Sin E2E contra Maps en CI.
- Commits: conventional commits, en español.

---

### Task 1: Scaffolding del proyecto

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`, `CLAUDE.md`
- Create dirs: `src/scraper/`, `src/utils/`, `src/exporters/`, `tests/`

**Interfaces:**
- Consumes: nada.
- Produces: scripts `pnpm test`, `pnpm build`, `pnpm dev`; bin `maps-scraper`.

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "maps-scraper",
  "version": "0.1.0",
  "type": "module",
  "bin": { "maps-scraper": "dist/cli.js" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Instalar dependencias**

```bash
pnpm add commander csv-writer cli-progress chalk dotenv playwright
pnpm add -D typescript tsx vitest @types/node @types/cli-progress
pnpm exec playwright install chromium
```

- [ ] **Step 3: Crear `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Crear `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
```

- [ ] **Step 5: Crear `.env.example` y `CLAUDE.md`**

`.env.example`:
```
# Sin secretos requeridos. Reservado para configuración futura.
```

`CLAUDE.md`:
```markdown
# maps-scraper
CLI de scraping de Google Maps con Playwright. Lógica pura en src/utils + src/exporters (testeada con Vitest); I/O de Playwright en src/scraper. Gestor: pnpm. Ver docs/superpowers/specs para el diseño.
```

- [ ] **Step 6: Verificar e instalar**

Run: `pnpm build` (puede fallar sin `src/cli.ts` aún — aceptable) y `pnpm test` (sin tests → exit 0).
Expected: dependencias instaladas, sin errores de instalación.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffolding del proyecto maps-scraper"
```

---

### Task 2: Tipos centrales

**Files:**
- Create: `src/types.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `Lead`, `ScraperOptions`, `RawBusiness`, `Enrichment`, `Socials`.

- [ ] **Step 1: Crear `src/types.ts`**

```typescript
export interface Lead {
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
  coordenadas: string; // "LAT,LNG"
  fuente: 'Google Maps';
  fechaExtraccion: string; // ISO
}

export interface ScraperOptions {
  query: string;
  location: string;
  max: number;
  enrich: boolean;
  headed: boolean;
  delay: number;
  output?: string;
  resume: boolean;
}

export interface RawBusiness {
  mapsUrl: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  website: string;
  rating: string;
  reviews: string;
  coordinates: string;
}

export interface Socials {
  instagram: string;
  facebook: string;
  whatsapp: string;
}

export interface Enrichment extends Socials {
  email: string;
}
```

- [ ] **Step 2: Verificar tipado**

Run: `pnpm exec tsc --noEmit`
Expected: PASS (sin errores).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: tipos centrales (Lead, ScraperOptions, RawBusiness, Enrichment)"
```

---

### Task 3: geo.ts — parseo de coordenadas

**Files:**
- Create: `src/utils/geo.ts`
- Test: `tests/geo.test.ts`

**Interfaces:**
- Produces: `parseCoordinates(url: string): string` — retorna `"LAT,LNG"` o `''`.

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from 'vitest';
import { parseCoordinates } from '../src/utils/geo.js';

describe('parseCoordinates', () => {
  it('extrae lat,lng del patrón @LAT,LNG,Zz', () => {
    const url = 'https://www.google.com/maps/place/X/@-34.7998,-58.3899,17z/data=!3m1';
    expect(parseCoordinates(url)).toBe('-34.7998,-58.3899');
  });

  it('retorna "" si la URL no tiene coordenadas', () => {
    expect(parseCoordinates('https://www.google.com/maps/place/X')).toBe('');
  });
});
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `pnpm exec vitest run tests/geo.test.ts`
Expected: FAIL (`parseCoordinates is not a function` / módulo no encontrado).

- [ ] **Step 3: Implementación mínima**

```typescript
const COORD_RE = /@(-?\d+\.\d+),(-?\d+\.\d+)/;

export function parseCoordinates(url: string): string {
  const m = url.match(COORD_RE);
  return m ? `${m[1]},${m[2]}` : '';
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `pnpm exec vitest run tests/geo.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/geo.ts tests/geo.test.ts
git commit -m "feat: parseo de coordenadas desde URL de Maps"
```

---

### Task 4: email-filter.ts — extracción y filtrado de emails

**Files:**
- Create: `src/utils/email-filter.ts`
- Test: `tests/email-filter.test.ts`

**Interfaces:**
- Produces:
  - `extractEmails(html: string): string[]` — todos los matches del regex.
  - `filterEmails(emails: string[]): string[]` — minúsculas, dedup, sin blocklist.
  - `EMAIL_BLOCKLIST: string[]`.

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from 'vitest';
import { extractEmails, filterEmails } from '../src/utils/email-filter.js';

describe('extractEmails', () => {
  it('extrae todos los emails del HTML', () => {
    const html = 'contacto: hola@negocio.com y ventas@negocio.com.ar';
    expect(extractEmails(html)).toEqual(['hola@negocio.com', 'ventas@negocio.com.ar']);
  });
});

describe('filterEmails', () => {
  it('elimina genéricos, normaliza a minúsculas y deduplica', () => {
    const input = ['Hola@Negocio.com', 'hola@negocio.com', 'noreply@wix.com', 'x@sentry.io'];
    expect(filterEmails(input)).toEqual(['hola@negocio.com']);
  });
});
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `pnpm exec vitest run tests/email-filter.test.ts`
Expected: FAIL (funciones no definidas).

- [ ] **Step 3: Implementación mínima**

```typescript
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export const EMAIL_BLOCKLIST = [
  'sentry', 'wix', 'wordpress', 'example', 'noreply', 'privacy', 'support@google',
];

export function extractEmails(html: string): string[] {
  return html.match(EMAIL_RE) ?? [];
}

export function filterEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const email = raw.toLowerCase();
    if (seen.has(email)) continue;
    if (EMAIL_BLOCKLIST.some((b) => email.includes(b))) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `pnpm exec vitest run tests/email-filter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/email-filter.ts tests/email-filter.test.ts
git commit -m "feat: extracción y filtrado de emails"
```

---

### Task 5: web-enricher (parte pura) — extracción de redes sociales

**Files:**
- Create: `src/scraper/web-enricher.ts`
- Test: `tests/socials.test.ts`

**Interfaces:**
- Consumes: `Socials` (types).
- Produces: `extractSocials(html: string): Socials` — primer `href` por red; `wa.me/` o `api.whatsapp.com/send` para whatsapp; campos faltantes = `''`.

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from 'vitest';
import { extractSocials } from '../src/scraper/web-enricher.js';

describe('extractSocials', () => {
  it('extrae instagram, facebook y whatsapp del HTML', () => {
    const html = `
      <a href="https://instagram.com/negocio">ig</a>
      <a href="https://facebook.com/negocio">fb</a>
      <a href="https://wa.me/5491122334455">wa</a>`;
    expect(extractSocials(html)).toEqual({
      instagram: 'https://instagram.com/negocio',
      facebook: 'https://facebook.com/negocio',
      whatsapp: 'https://wa.me/5491122334455',
    });
  });

  it('devuelve "" en redes ausentes', () => {
    expect(extractSocials('<a href="https://otro.com">x</a>')).toEqual({
      instagram: '', facebook: '', whatsapp: '',
    });
  });
});
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `pnpm exec vitest run tests/socials.test.ts`
Expected: FAIL (función no definida).

- [ ] **Step 3: Implementación mínima (solo la parte pura por ahora)**

```typescript
import type { Socials } from '../types.js';

const HREF_RE = /href=["']([^"']+)["']/gi;

function firstMatch(hrefs: string[], pred: (h: string) => boolean): string {
  return hrefs.find(pred) ?? '';
}

export function extractSocials(html: string): Socials {
  const hrefs = [...html.matchAll(HREF_RE)].map((m) => m[1]);
  return {
    instagram: firstMatch(hrefs, (h) => h.includes('instagram.com/')),
    facebook: firstMatch(hrefs, (h) => h.includes('facebook.com/')),
    whatsapp: firstMatch(hrefs, (h) => h.includes('wa.me/') || h.includes('api.whatsapp.com/send')),
  };
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `pnpm exec vitest run tests/socials.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scraper/web-enricher.ts tests/socials.test.ts
git commit -m "feat: extracción pura de redes sociales del HTML"
```

---

### Task 6: deduplicator.ts

**Files:**
- Create: `src/utils/deduplicator.ts`
- Test: `tests/deduplicator.test.ts`

**Interfaces:**
- Consumes: `Lead` (types).
- Produces:
  - `leadKey(name: string, address: string): string` — clave normalizada (lowercase + trim + colapso de espacios).
  - `dedupeLeads(leads: Lead[]): Lead[]` — conserva el primero por `leadKey`.
  - `dedupeMapsUrls(urls: string[], processed?: Set<string>): string[]` — únicos y no procesados (para `--resume`).

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from 'vitest';
import { leadKey, dedupeLeads, dedupeMapsUrls } from '../src/utils/deduplicator.js';
import type { Lead } from '../src/types.js';

const mk = (name: string, address: string): Lead => ({
  razonSocial: name, nombreFantasia: name, telefono: '', email: '', sitioWeb: '',
  direccion: address, localidad: '', provincia: '', categoria: '',
  calificacionGoogle: '', cantidadResenas: '', instagram: '', facebook: '',
  whatsapp: '', coordenadas: '', fuente: 'Google Maps', fechaExtraccion: 'x',
});

describe('leadKey', () => {
  it('normaliza mayúsculas y espacios', () => {
    expect(leadKey(' Gym  X ', 'Calle 1')).toBe(leadKey('gym x', 'calle 1'));
  });
});

describe('dedupeLeads', () => {
  it('elimina duplicados por nombre+dirección', () => {
    const out = dedupeLeads([mk('Gym X', 'Calle 1'), mk('gym x', 'calle 1'), mk('Gym Y', 'Calle 2')]);
    expect(out).toHaveLength(2);
  });
});

describe('dedupeMapsUrls', () => {
  it('quita duplicados y ya procesadas', () => {
    expect(dedupeMapsUrls(['a', 'a', 'b'], new Set(['b']))).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `pnpm exec vitest run tests/deduplicator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementación mínima**

```typescript
import type { Lead } from '../types.js';

const norm = (s: string): string => s.toLowerCase().trim().replace(/\s+/g, ' ');

export function leadKey(name: string, address: string): string {
  return `${norm(name)}|${norm(address)}`;
}

export function dedupeLeads(leads: Lead[]): Lead[] {
  const seen = new Set<string>();
  return leads.filter((l) => {
    const k = leadKey(l.nombreFantasia, l.direccion);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function dedupeMapsUrls(urls: string[], processed: Set<string> = new Set()): string[] {
  const seen = new Set<string>(processed);
  const out: string[] = [];
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `pnpm exec vitest run tests/deduplicator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/deduplicator.ts tests/deduplicator.test.ts
git commit -m "feat: deduplicación por nombre+dirección y por URL de Maps"
```

---

### Task 7: rate-limiter.ts

**Files:**
- Create: `src/utils/rate-limiter.ts`
- Test: `tests/rate-limiter.test.ts`

**Interfaces:**
- Produces:
  - `jitter(base: number, rng?: () => number): number` — `base * (0.8 + rng()*0.4)`.
  - `sleep(ms: number): Promise<void>`.

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from 'vitest';
import { jitter } from '../src/utils/rate-limiter.js';

describe('jitter', () => {
  it('rng=0 → base*0.8 (mínimo)', () => {
    expect(jitter(1000, () => 0)).toBe(800);
  });
  it('rng=1 → base*1.2 (máximo)', () => {
    expect(jitter(1000, () => 1)).toBeCloseTo(1200);
  });
  it('siempre dentro de [base*0.8, base*1.2]', () => {
    for (const r of [0.1, 0.5, 0.9]) {
      const v = jitter(2000, () => r);
      expect(v).toBeGreaterThanOrEqual(1600);
      expect(v).toBeLessThanOrEqual(2400);
    }
  });
});
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `pnpm exec vitest run tests/rate-limiter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementación mínima**

```typescript
export function jitter(base: number, rng: () => number = Math.random): number {
  return base * (0.8 + rng() * 0.4);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `pnpm exec vitest run tests/rate-limiter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/rate-limiter.ts tests/rate-limiter.test.ts
git commit -m "feat: rate limiter con jitter aleatorio"
```

---

### Task 8: safe-extract.ts

**Files:**
- Create: `src/utils/safe-extract.ts`
- Test: `tests/safe-extract.test.ts`

**Interfaces:**
- Produces: `safeExtract(resolver: (selector: string) => Promise<string | null>, selectors: string[], fallback?: string): Promise<string>` — retorna el primer valor no vacío; `fallback` (default `''`) si ninguno resuelve.

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from 'vitest';
import { safeExtract } from '../src/utils/safe-extract.js';

describe('safeExtract', () => {
  it('retorna el primer selector que resuelve valor', async () => {
    const map: Record<string, string | null> = { a: null, b: 'valor', c: 'otro' };
    const resolver = async (s: string) => map[s] ?? null;
    expect(await safeExtract(resolver, ['a', 'b', 'c'])).toBe('valor');
  });

  it('retorna fallback si ninguno resuelve', async () => {
    const resolver = async () => null;
    expect(await safeExtract(resolver, ['a', 'b'], 'NA')).toBe('NA');
  });

  it('ignora errores del resolver y sigue con el siguiente', async () => {
    const resolver = async (s: string) => {
      if (s === 'a') throw new Error('timeout');
      return 'ok';
    };
    expect(await safeExtract(resolver, ['a', 'b'])).toBe('ok');
  });
});
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `pnpm exec vitest run tests/safe-extract.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementación mínima**

```typescript
export async function safeExtract(
  resolver: (selector: string) => Promise<string | null>,
  selectors: string[],
  fallback = '',
): Promise<string> {
  for (const selector of selectors) {
    try {
      const value = await resolver(selector);
      if (value && value.trim()) return value.trim();
    } catch {
      // selector inválido o timeout — probar el siguiente
    }
  }
  return fallback;
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `pnpm exec vitest run tests/safe-extract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/safe-extract.ts tests/safe-extract.test.ts
git commit -m "feat: safeExtract con resolver inyectable y fallback"
```

---

### Task 9: captcha.ts

**Files:**
- Create: `src/scraper/captcha.ts`
- Test: `tests/captcha.test.ts`

**Interfaces:**
- Produces: `isCaptcha(title: string): boolean` — true si el título contiene "unusual traffic" (case-insensitive).

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from 'vitest';
import { isCaptcha } from '../src/scraper/captcha.js';

describe('isCaptcha', () => {
  it('detecta "unusual traffic"', () => {
    expect(isCaptcha('Our systems have detected unusual traffic')).toBe(true);
  });
  it('case-insensitive', () => {
    expect(isCaptcha('UNUSUAL TRAFFIC')).toBe(true);
  });
  it('false en títulos normales', () => {
    expect(isCaptcha('Restaurantes - Google Maps')).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `pnpm exec vitest run tests/captcha.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementación mínima**

```typescript
export function isCaptcha(title: string): boolean {
  return title.toLowerCase().includes('unusual traffic');
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `pnpm exec vitest run tests/captcha.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scraper/captcha.ts tests/captcha.test.ts
git commit -m "feat: detección de CAPTCHA por título de página"
```

---

### Task 10: output-path.ts — resolución de rutas de salida

**Files:**
- Create: `src/utils/output-path.ts`
- Test: `tests/output-path.test.ts`

**Interfaces:**
- Produces:
  - `slugify(text: string): string` — minúsculas, sin acentos, espacios → `_`.
  - `resolveOutputPaths(output: string | undefined, query: string, date: string): { csv: string; json: string }` — si `output`, usa su base sin extensión; si no, `output/{slug}_{date}`.

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, it, expect } from 'vitest';
import { slugify, resolveOutputPaths } from '../src/utils/output-path.js';

describe('slugify', () => {
  it('normaliza acentos y espacios', () => {
    expect(slugify('Adrogué Buenos Aires')).toBe('adrogue_buenos_aires');
  });
});

describe('resolveOutputPaths', () => {
  it('usa la base del --output sin extensión', () => {
    expect(resolveOutputPaths('./output/gimnasios.csv', 'gimnasios', '2026-06-25'))
      .toEqual({ csv: './output/gimnasios.csv', json: './output/gimnasios.json' });
  });
  it('autogenera con slug + fecha cuando no hay --output', () => {
    expect(resolveOutputPaths(undefined, 'restaurantes', '2026-06-25'))
      .toEqual({ csv: 'output/restaurantes_2026-06-25.csv', json: 'output/restaurantes_2026-06-25.json' });
  });
});
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `pnpm exec vitest run tests/output-path.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementación mínima**

```typescript
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function resolveOutputPaths(
  output: string | undefined,
  query: string,
  date: string,
): { csv: string; json: string } {
  const base = output
    ? output.replace(/\.(csv|json)$/i, '')
    : `output/${slugify(query)}_${date}`;
  return { csv: `${base}.csv`, json: `${base}.json` };
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `pnpm exec vitest run tests/output-path.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/output-path.ts tests/output-path.test.ts
git commit -m "feat: resolución de rutas de salida (flag manda, fecha si falta)"
```

---

### Task 11: exporters — csv.ts y json.ts

**Files:**
- Create: `src/exporters/csv.ts`, `src/exporters/json.ts`
- Test: `tests/csv.test.ts`

**Interfaces:**
- Consumes: `Lead` (types).
- Produces:
  - `leadToRow(lead: Lead): Record<string, string>` — mapeo a columnas LocalCenter.
  - `CSV_HEADER: { id: string; title: string }[]`.
  - `writeCsv(leads: Lead[], path: string): Promise<void>`.
  - `writeJson(leads: Lead[], path: string): Promise<void>`.

- [ ] **Step 1: Escribir el test que falla (solo el mapeo puro)**

```typescript
import { describe, it, expect } from 'vitest';
import { leadToRow } from '../src/exporters/csv.js';
import type { Lead } from '../src/types.js';

const lead: Lead = {
  razonSocial: 'Gym X', nombreFantasia: 'Gym X', telefono: '+541112345678',
  email: 'hola@gymx.com', sitioWeb: 'https://gymx.com', direccion: 'Calle 1',
  localidad: 'Adrogué', provincia: 'Buenos Aires', categoria: 'Gimnasio',
  calificacionGoogle: '4.5', cantidadResenas: '120', instagram: 'https://instagram.com/gymx',
  facebook: '', whatsapp: '', coordenadas: '-34.79,-58.38',
  fuente: 'Google Maps', fechaExtraccion: '2026-06-25T10:00:00.000Z',
};

describe('leadToRow', () => {
  it('mapea Lead a columnas LocalCenter', () => {
    const row = leadToRow(lead);
    expect(row.razon_social).toBe('Gym X');
    expect(row.calificacion_google).toBe('4.5');
    expect(row.cantidad_resenas).toBe('120');
    expect(row.fuente).toBe('Google Maps');
    expect(Object.keys(row)).toEqual([
      'razon_social', 'nombre_fantasia', 'telefono', 'email', 'sitio_web',
      'direccion', 'localidad', 'provincia', 'categoria', 'calificacion_google',
      'cantidad_resenas', 'instagram', 'facebook', 'whatsapp', 'coordenadas',
      'fuente', 'fecha_extraccion',
    ]);
  });
});
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `pnpm exec vitest run tests/csv.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/exporters/csv.ts`**

```typescript
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createObjectCsvWriter } from 'csv-writer';
import type { Lead } from '../types.js';

export const CSV_HEADER = [
  { id: 'razon_social', title: 'razon_social' },
  { id: 'nombre_fantasia', title: 'nombre_fantasia' },
  { id: 'telefono', title: 'telefono' },
  { id: 'email', title: 'email' },
  { id: 'sitio_web', title: 'sitio_web' },
  { id: 'direccion', title: 'direccion' },
  { id: 'localidad', title: 'localidad' },
  { id: 'provincia', title: 'provincia' },
  { id: 'categoria', title: 'categoria' },
  { id: 'calificacion_google', title: 'calificacion_google' },
  { id: 'cantidad_resenas', title: 'cantidad_resenas' },
  { id: 'instagram', title: 'instagram' },
  { id: 'facebook', title: 'facebook' },
  { id: 'whatsapp', title: 'whatsapp' },
  { id: 'coordenadas', title: 'coordenadas' },
  { id: 'fuente', title: 'fuente' },
  { id: 'fecha_extraccion', title: 'fecha_extraccion' },
];

export function leadToRow(lead: Lead): Record<string, string> {
  return {
    razon_social: lead.razonSocial,
    nombre_fantasia: lead.nombreFantasia,
    telefono: lead.telefono,
    email: lead.email,
    sitio_web: lead.sitioWeb,
    direccion: lead.direccion,
    localidad: lead.localidad,
    provincia: lead.provincia,
    categoria: lead.categoria,
    calificacion_google: lead.calificacionGoogle,
    cantidad_resenas: lead.cantidadResenas,
    instagram: lead.instagram,
    facebook: lead.facebook,
    whatsapp: lead.whatsapp,
    coordenadas: lead.coordenadas,
    fuente: lead.fuente,
    fecha_extraccion: lead.fechaExtraccion,
  };
}

export async function writeCsv(leads: Lead[], path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const writer = createObjectCsvWriter({ path, header: CSV_HEADER });
  await writer.writeRecords(leads.map(leadToRow));
}
```

- [ ] **Step 4: Implementar `src/exporters/json.ts`**

```typescript
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Lead } from '../types.js';

export async function writeJson(leads: Lead[], path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(leads, null, 2), 'utf8');
}
```

- [ ] **Step 5: Correr el test (debe pasar)**

Run: `pnpm exec vitest run tests/csv.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/exporters/ tests/csv.test.ts
git commit -m "feat: exportadores CSV (columnas LocalCenter) y JSON"
```

---

### Task 12: logger.ts

**Files:**
- Create: `src/utils/logger.ts`

**Interfaces:**
- Produces:
  - `logSuccess(msg: string): void` (verde), `logWarn(msg: string): void` (amarillo), `logError(msg: string): void` (rojo), `logInfo(msg: string): void`.
  - `createProgressBar(total: number): cliProgress.SingleBar`.

- [ ] **Step 1: Implementar `src/utils/logger.ts`**

```typescript
import chalk from 'chalk';
import cliProgress from 'cli-progress';

export const logSuccess = (msg: string): void => console.log(chalk.green(`✓ ${msg}`));
export const logWarn = (msg: string): void => console.log(chalk.yellow(`! ${msg}`));
export const logError = (msg: string): void => console.log(chalk.red(`✗ ${msg}`));
export const logInfo = (msg: string): void => console.log(chalk.cyan(`→ ${msg}`));

export function createProgressBar(total: number): cliProgress.SingleBar {
  const bar = new cliProgress.SingleBar(
    { format: 'Scraping [{bar}] {value}/{total} | {name}' },
    cliProgress.Presets.shades_classic,
  );
  bar.start(total, 0, { name: '' });
  return bar;
}
```

- [ ] **Step 2: Verificar tipado**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/utils/logger.ts
git commit -m "feat: logger con chalk y barra de progreso"
```

---

### Task 13: selectors.ts

**Files:**
- Create: `src/scraper/selectors.ts`

**Interfaces:**
- Produces: `SELECTORS` — objeto con arrays de candidatos por campo; `FEED`, `END_OF_LIST_TEXTS`, `COOKIE_BUTTONS`, `LISTING_LINKS`.

> Punto de partida; los arrays se ajustan contra el DOM real en la Task 18.

- [ ] **Step 1: Implementar `src/scraper/selectors.ts`**

```typescript
export const FEED = 'div[role="feed"]';
export const LISTING_LINKS = 'div[role="feed"] a[href*="/maps/place/"]';

export const COOKIE_BUTTONS = [
  'button[aria-label="Aceptar todo"]',
  'button[aria-label="Accept all"]',
  'form[action*="consent"] button',
];

export const END_OF_LIST_TEXTS = [
  'Se han llegado al final de la lista',
  'Llegaste al final de la lista',
  "You've reached the end of the list",
];

export const SELECTORS = {
  name: ['h1.DUwDvf', 'h1'],
  category: ['button.DkEaL', '[jsaction*="category"]'],
  address: ['[data-item-id="address"] .Io6YTe'],
  phone: ['[data-item-id^="phone:tel"] .Io6YTe'],
  websiteText: ['[data-item-id="authority"] .Io6YTe'],
  websiteHref: ['a[data-item-id="authority"]'],
  rating: ['div.F7nice > span[aria-hidden="true"]'],
  reviews: ['div.F7nice > span > span > span[aria-label]'],
} as const;
```

- [ ] **Step 2: Verificar tipado**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/scraper/selectors.ts
git commit -m "feat: objeto central de selectores de Google Maps"
```

---

### Task 14: browser.ts — contexto persistente

**Files:**
- Create: `src/scraper/browser.ts`

**Interfaces:**
- Consumes: nada de tasks previas.
- Produces: `launchBrowser(headed: boolean): Promise<BrowserContext>` — `chromium.launchPersistentContext('.cache/browser-profile', {...})` con anti-bot + initScript.

- [ ] **Step 1: Implementar `src/scraper/browser.ts`**

```typescript
import { chromium, type BrowserContext } from 'playwright';

const USER_DATA_DIR = '.cache/browser-profile';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export async function launchBrowser(headed: boolean): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: !headed,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  return context;
}
```

- [ ] **Step 2: Verificar tipado**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/scraper/browser.ts
git commit -m "feat: contexto persistente de browser con medidas anti-bot"
```

---

### Task 15: web-enricher (parte I/O) — enrichWebsite

**Files:**
- Modify: `src/scraper/web-enricher.ts`

**Interfaces:**
- Consumes: `extractEmails`, `filterEmails` (Task 4); `extractSocials` (Task 5); `Enrichment` (types); `BrowserContext` (playwright).
- Produces: `enrichWebsite(context: BrowserContext, url: string, timeoutMs?: number): Promise<Enrichment>` — abre página efímera, lee HTML, extrae email + redes; en error retorna `Enrichment` vacío y loguea en amarillo.

- [ ] **Step 1: Agregar la función I/O a `src/scraper/web-enricher.ts`**

Añadir imports al inicio y la función al final del archivo existente:

```typescript
import type { BrowserContext } from 'playwright';
import { extractEmails, filterEmails } from '../utils/email-filter.js';
import { logWarn } from '../utils/logger.js';
import type { Enrichment } from '../types.js';

const EMPTY: Enrichment = { email: '', instagram: '', facebook: '', whatsapp: '' };

export async function enrichWebsite(
  context: BrowserContext,
  url: string,
  timeoutMs = 10_000,
): Promise<Enrichment> {
  const page = await context.newPage();
  try {
    await page.goto(url, { timeout: timeoutMs, waitUntil: 'domcontentloaded' });
    const html = await page.content();
    const email = filterEmails(extractEmails(html))[0] ?? '';
    const socials = extractSocials(html);
    return { email, ...socials };
  } catch {
    logWarn(`No se pudo enriquecer: ${url}`);
    return EMPTY;
  } finally {
    await page.close();
  }
}
```

- [ ] **Step 2: Verificar que los tests puros siguen pasando**

Run: `pnpm exec vitest run tests/socials.test.ts`
Expected: PASS (la función pura no cambió).

- [ ] **Step 3: Verificar tipado**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/scraper/web-enricher.ts
git commit -m "feat: enriquecimiento I/O desde sitio web del negocio"
```

---

### Task 16: maps-scraper.ts — orquestador

**Files:**
- Create: `src/scraper/maps-scraper.ts`

**Interfaces:**
- Consumes: `launchBrowser` (14), `SELECTORS`/`FEED`/`LISTING_LINKS`/`COOKIE_BUTTONS`/`END_OF_LIST_TEXTS` (13), `safeExtract` (8), `parseCoordinates` (3), `isCaptcha` (9), `enrichWebsite` (15), `dedupeLeads`/`dedupeMapsUrls` (6), `jitter`/`sleep` (7), `logger` (12), tipos (2).
- Produces: `runScrape(options: ScraperOptions): Promise<Lead[]>`.

- [ ] **Step 1: Implementar `src/scraper/maps-scraper.ts`**

```typescript
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { BrowserContext, Page } from 'playwright';
import { launchBrowser } from './browser.js';
import { enrichWebsite } from './web-enricher.js';
import { isCaptcha } from './captcha.js';
import {
  SELECTORS, FEED, LISTING_LINKS, COOKIE_BUTTONS, END_OF_LIST_TEXTS,
} from './selectors.js';
import { safeExtract } from '../utils/safe-extract.js';
import { parseCoordinates } from '../utils/geo.js';
import { dedupeLeads, dedupeMapsUrls } from '../utils/deduplicator.js';
import { jitter, sleep } from '../utils/rate-limiter.js';
import { logSuccess, logWarn, logError, logInfo, createProgressBar } from '../utils/logger.js';
import { slugify } from '../utils/output-path.js';
import type { Lead, RawBusiness, ScraperOptions } from '../types.js';

const CHECKPOINT_EVERY = 10;
const CONSENT_HOSTS = ['consent.google.com'];

function checkpointPath(query: string, date: string): string {
  return `.cache/${slugify(query)}-${date}.json`;
}

async function loadProcessed(path: string): Promise<Set<string>> {
  try {
    const raw = await readFile(path, 'utf8');
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

async function saveCheckpoint(path: string, urls: string[]): Promise<void> {
  await mkdir('.cache', { recursive: true });
  await writeFile(path, JSON.stringify(urls, null, 2), 'utf8');
}

async function acceptCookies(page: Page): Promise<void> {
  for (const sel of COOKIE_BUTTONS) {
    const btn = page.locator(sel).first();
    if (await btn.count()) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(1000);
      return;
    }
  }
}

async function assertNoCaptcha(page: Page): Promise<void> {
  if (isCaptcha(await page.title())) {
    throw new Error('Google muestra CAPTCHA ("unusual traffic"). Bajá --max o subí --delay.');
  }
}

async function collectListingUrls(page: Page, max: number): Promise<string[]> {
  const feed = page.locator(FEED);
  await feed.waitFor({ timeout: 15_000 });
  let stale = 0;
  let prev = 0;
  const urls = new Set<string>();
  while (urls.size < max && stale < 3) {
    for (const href of await page.locator(LISTING_LINKS).evaluateAll(
      (els) => els.map((e) => (e as HTMLAnchorElement).href),
    )) {
      urls.add(href);
    }
    if (await page.getByText(new RegExp(END_OF_LIST_TEXTS.join('|'))).count()) break;
    await feed.evaluate((el) => el.scrollBy(0, el.scrollHeight));
    await page.waitForTimeout(1500);
    stale = urls.size === prev ? stale + 1 : 0;
    prev = urls.size;
  }
  return [...urls].slice(0, max);
}

async function textOf(page: Page, selectors: string[]): Promise<string> {
  return safeExtract(
    async (sel) => page.locator(sel).first().textContent({ timeout: 2000 }),
    selectors,
  );
}

async function scrapeBusiness(page: Page, url: string): Promise<RawBusiness> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 10_000 });
  await assertNoCaptcha(page);
  const websiteHref = await safeExtract(
    async (sel) => page.locator(sel).first().getAttribute('href', { timeout: 2000 }),
    SELECTORS.websiteHref,
  );
  return {
    mapsUrl: url,
    name: await textOf(page, [...SELECTORS.name]),
    category: await textOf(page, [...SELECTORS.category]),
    address: await textOf(page, [...SELECTORS.address]),
    phone: await textOf(page, [...SELECTORS.phone]),
    website: websiteHref || (await textOf(page, [...SELECTORS.websiteText])),
    rating: await textOf(page, [...SELECTORS.rating]),
    reviews: await textOf(page, [...SELECTORS.reviews]),
    coordinates: parseCoordinates(page.url()),
  };
}

function toLead(b: RawBusiness, enrichment: { email: string; instagram: string; facebook: string; whatsapp: string }, location: string, now: string): Lead {
  const parts = location.split(',').map((s) => s.trim());
  return {
    razonSocial: b.name,
    nombreFantasia: b.name,
    telefono: b.phone,
    email: enrichment.email,
    sitioWeb: b.website,
    direccion: b.address,
    localidad: parts[0] ?? '',
    provincia: parts[1] ?? '',
    categoria: b.category,
    calificacionGoogle: b.rating,
    cantidadResenas: b.reviews.replace(/[^\d]/g, ''),
    instagram: enrichment.instagram,
    facebook: enrichment.facebook,
    whatsapp: enrichment.whatsapp,
    coordenadas: b.coordinates,
    fuente: 'Google Maps',
    fechaExtraccion: now,
  };
}

export async function runScrape(options: ScraperOptions): Promise<Lead[]> {
  const date = new Date().toISOString().slice(0, 10);
  const cpPath = checkpointPath(options.query, date);
  const processed = options.resume ? await loadProcessed(cpPath) : new Set<string>();

  const context: BrowserContext = await launchBrowser(options.headed);
  const page = await context.newPage();
  const leads: Lead[] = [];
  const doneUrls: string[] = [...processed];

  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${options.query} ${options.location}`)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    if (CONSENT_HOSTS.some((h) => page.url().includes(h))) await acceptCookies(page);
    await acceptCookies(page);
    await assertNoCaptcha(page);

    logInfo(`Buscando "${options.query}" en "${options.location}"...`);
    const allUrls = await collectListingUrls(page, options.max);
    const urls = dedupeMapsUrls(allUrls, processed);
    logSuccess(`${urls.length} negocios para procesar (${processed.size} ya hechos).`);

    const bar = createProgressBar(urls.length);
    for (const [i, url] of urls.entries()) {
      try {
        const biz = await scrapeBusiness(page, url);
        const enrichment = options.enrich && biz.website
          ? await enrichWebsite(context, biz.website)
          : { email: '', instagram: '', facebook: '', whatsapp: '' };
        leads.push(toLead(biz, enrichment, options.location, new Date().toISOString()));
        bar.increment({ name: biz.name.slice(0, 30) });
      } catch (err) {
        if (err instanceof Error && err.message.includes('CAPTCHA')) { bar.stop(); throw err; }
        logError(`Falló ${url}: ${(err as Error).message}`);
      }
      doneUrls.push(url);
      if ((i + 1) % CHECKPOINT_EVERY === 0) await saveCheckpoint(cpPath, doneUrls);
      await sleep(jitter(options.delay));
    }
    bar.stop();
    await saveCheckpoint(cpPath, doneUrls);
  } finally {
    await context.close();
  }

  const deduped = dedupeLeads(leads);
  logSuccess(`${deduped.length} leads únicos extraídos.`);
  return deduped;
}
```

- [ ] **Step 2: Verificar tipado**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Verificar que toda la suite pura sigue verde**

Run: `pnpm test`
Expected: PASS (todos los tests de Tasks 3-11).

- [ ] **Step 4: Commit**

```bash
git add src/scraper/maps-scraper.ts
git commit -m "feat: orquestador de scraping (search, scroll, visit, enrich, checkpoint)"
```

---

### Task 17: cli.ts — entry point

**Files:**
- Create: `src/cli.ts`

**Interfaces:**
- Consumes: `runScrape` (16), `resolveOutputPaths` (10), `writeCsv` (11), `writeJson` (11), `ScraperOptions` (2), logger (12).
- Produces: bin ejecutable `maps-scraper search [flags]`.

- [ ] **Step 1: Implementar `src/cli.ts`**

```typescript
#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { runScrape } from './scraper/maps-scraper.js';
import { resolveOutputPaths } from './utils/output-path.js';
import { writeCsv } from './exporters/csv.js';
import { writeJson } from './exporters/json.js';
import { logSuccess, logError } from './utils/logger.js';
import type { ScraperOptions } from './types.js';

const program = new Command();

program
  .name('maps-scraper')
  .description('Extrae prospectos de negocios desde Google Maps');

program
  .command('search')
  .requiredOption('--query <string>', 'término de búsqueda')
  .requiredOption('--location <string>', 'ciudad/zona')
  .option('--max <number>', 'máximo de resultados', '50')
  .option('--enrich', 'visitar sitio web para email/redes', false)
  .option('--headed', 'mostrar el browser', false)
  .option('--delay <number>', 'ms base entre negocios', '2000')
  .option('--output <path>', 'ruta de salida (sin él: output/{query}_{fecha})')
  .option('--resume', 'continuar desde checkpoint', false)
  .action(async (opts) => {
    const options: ScraperOptions = {
      query: opts.query,
      location: opts.location,
      max: Number(opts.max),
      enrich: Boolean(opts.enrich),
      headed: Boolean(opts.headed),
      delay: Number(opts.delay),
      output: opts.output,
      resume: Boolean(opts.resume),
    };
    try {
      const leads = await runScrape(options);
      const date = new Date().toISOString().slice(0, 10);
      const { csv, json } = resolveOutputPaths(options.output, options.query, date);
      await writeCsv(leads, csv);
      await writeJson(leads, json);
      logSuccess(`Exportado: ${csv} y ${json}`);
    } catch (err) {
      logError((err as Error).message);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
```

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: PASS, genera `dist/cli.js`.

- [ ] **Step 3: Verificar el CLI**

Run: `node dist/cli.js search --help`
Expected: muestra los flags `--query`, `--location`, `--max`, `--enrich`, `--headed`, `--delay`, `--output`, `--resume`.

- [ ] **Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat: CLI con commander (comando search)"
```

---

### Task 18: Verificación en vivo de selectores + smoke run

**Files:**
- Modify (si hace falta): `src/scraper/selectors.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: selectores confirmados contra el DOM real; CSV+JSON de ejemplo.

> Esta task usa las herramientas de browser (Playwright) para confirmar que cada selector de `SELECTORS` matchea el DOM actual de Google Maps, ya que las clases ofuscadas cambian seguido. Es manual/interactiva, no automatizada.

- [ ] **Step 1: Login inicial en el perfil persistente**

Run: `node dist/cli.js search --query "cafés" --location "Adrogué, Buenos Aires, Argentina" --max 3 --headed`
Si aparece muro de consentimiento/login: aceptarlo manualmente en la ventana visible. Queda guardado en `.cache/browser-profile`.

- [ ] **Step 2: Confirmar selectores de la ficha de negocio**

Con el browser abierto en una ficha, verificar en consola que cada selector de `SELECTORS` (name, category, address, phone, websiteHref, rating, reviews) retorna el valor esperado. Si alguno falla, agregar el selector correcto **al principio** del array correspondiente en `selectors.ts` (safeExtract prueba en orden).

- [ ] **Step 3: Confirmar feed, scroll y fin de lista**

Verificar que `div[role="feed"]` existe, que `LISTING_LINKS` junta los hrefs, y que el texto de fin de lista o el estancamiento detienen el scroll. Ajustar `LISTING_LINKS` / `END_OF_LIST_TEXTS` si cambió el copy.

- [ ] **Step 4: Commit de ajustes (si hubo)**

```bash
git add src/scraper/selectors.ts
git commit -m "fix: ajustar selectores contra el DOM real de Google Maps"
```

- [ ] **Step 5: Smoke run del criterio de éxito**

Run:
```bash
node dist/cli.js search --query "restaurantes" --location "Buenos Aires, Argentina" --max 20 --enrich --headed
```
Expected: genera `output/restaurantes_<fecha>.csv` y `.json` con ~20 filas, columnas LocalCenter, emails y redes donde estén disponibles, browser visible durante el scraping.

- [ ] **Step 6: Verificar el output**

Run: `head -2 output/restaurantes_*.csv && cat output/restaurantes_*.json | head -20`
Expected: cabecera con las 17 columnas LocalCenter y filas con datos.

---

## Self-Review

**Spec coverage:**
- CLI + flags → Task 17 ✓
- Búsqueda/scroll/visit → Task 16 ✓
- safeExtract → Task 8 ✓
- Enriquecimiento (email/redes) → Tasks 4, 5, 15 ✓
- Anti-bot + perfil persistente → Task 14 ✓
- Output CSV+JSON (flag manda/fecha) → Tasks 10, 11, 17 ✓
- Columnas LocalCenter → Task 11 ✓
- Resiliencia (skip, checkpoint, resume, CAPTCHA) → Tasks 9, 16 ✓
- Coordenadas desde URL → Task 3 ✓
- Tests lógica pura → Tasks 3-11 ✓
- Verificación en vivo de selectores → Task 18 ✓

**Placeholder scan:** sin TBD/TODO; todo el código está completo.

**Type consistency:** `runScrape`, `enrichWebsite`, `safeExtract`, `resolveOutputPaths`, `leadToRow`, `extractSocials`, `extractEmails`/`filterEmails`, `dedupeLeads`/`dedupeMapsUrls`, `jitter`/`sleep`, `parseCoordinates`, `isCaptcha`, `launchBrowser` — nombres y firmas consistentes entre tasks productoras y consumidoras.
