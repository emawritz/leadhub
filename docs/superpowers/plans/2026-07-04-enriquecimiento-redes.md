# Enriquecimiento de leads por perfiles de redes (FB+IG) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rellenar campos vacíos de contacto (email/teléfono/sitioWeb/WhatsApp/dirección) de cada lead visitando su página pública de Facebook y su perfil público de Instagram, inline en el scrape de Google Maps.

**Architecture:** Parsers puros en `packages/core` (extraen `SocialProfileData` de HTML, testeados con fixtures). Capa I/O delgada en `apps/scraper/src/scraper/social-enricher.ts` (Playwright, best-effort). Enganche en `maps-scraper.ts` después de `enrichWebsite`, combinando con una función pura `fillEmptyFields` (Maps/web ganan, redes rellenan huecos).

**Tech Stack:** TypeScript ESM (NodeNext, imports con extensión `.js`), Playwright, Vitest, pnpm workspace. El scraper importa core por el barrel `@leadhub/core` (ver `web-enricher.ts`).

## Global Constraints

- **Pura vs I/O:** toda la lógica de parsing va en `packages/core` (pura, testeada con Vitest); la navegación Playwright va en `apps/scraper/src/scraper`. Igual que `extractSocials` (puro) vs `enrichWebsite` (I/O).
- **Best-effort estricto:** `enrichSocials` y sus helpers de I/O **nunca** lanzan al caller ni afectan el estado del job; en el peor caso devuelven `{}`. `try/catch/finally` que cierra la página; timeout por perfil; muro de login/captcha → `{}`.
- **Precedencia rellena-vacíos:** los datos de Maps y del sitio web ganan; los de redes solo se aplican a campos cuyo valor actual es `''`.
- **Sin cambios de:** esquema de `leads`, clave de dedup (`nombre|direccion`), campo `fuente` (sigue `'Google Maps'`), API (`scrapeJobs`/`input.ts`), ni UI. Se reutiliza el flag `enrich` existente.
- **Nuevos exports de core** deben agregarse a `packages/core/src/index.ts`.
- **Sin columnas nuevas**, sin seguidores, sin login, sin cambios en lead scoring.
- Fixtures de test: strings HTML representativos inline (no archivos externos), con los marcadores que los parsers buscan.

---

### Task 1: Extractor de teléfono puro

**Files:**
- Create: `packages/core/src/phone.ts`
- Modify: `packages/core/src/index.ts` (agregar export)
- Test: `packages/core/tests/phone.test.ts`

**Interfaces:**
- Produces: `extractPhone(html: string): string` — primero busca un link `tel:`; si no hay, un patrón de teléfono AR en el texto. Devuelve el string tal cual (trim) o `''`.

- [ ] **Step 1: Escribir el test que falla**

Crear `packages/core/tests/phone.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractPhone } from '../src/phone.js';

describe('extractPhone', () => {
  it('extrae de un link tel:', () => {
    expect(extractPhone('<a href="tel:+541144445555">Llamar</a>')).toBe('+541144445555');
  });
  it('prioriza el link tel: sobre el texto', () => {
    const html = 'Antes 011 9999-8888 <a href="tel:+541144445555">x</a>';
    expect(extractPhone(html)).toBe('+541144445555');
  });
  it('extrae un teléfono AR formateado del texto cuando no hay tel:', () => {
    expect(extractPhone('<p>Tel: +54 11 4444-5555</p>')).toBe('+54 11 4444-5555');
  });
  it('devuelve "" cuando no hay teléfono reconocible', () => {
    expect(extractPhone('<p>Sin datos de contacto</p>')).toBe('');
  });
  it('no confunde una fecha o número suelto con teléfono', () => {
    expect(extractPhone('<p>Fundado en 2020, 15 años</p>')).toBe('');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @leadhub/core test phone`
Expected: FAIL (`extractPhone` no existe).

- [ ] **Step 3: Implementar**

Crear `packages/core/src/phone.ts`:

```ts
// Teléfono argentino: opcional +54 / 0, código de área, y 6-8 dígitos con separador.
// Requiere al menos un separador (espacio/punto/guion) o el prefijo +54 para
// evitar falsos positivos con números sueltos (años, cantidades).
const TEL_HREF_RE = /href=["']tel:([^"']+)["']/i;
const PHONE_TEXT_RE = /(\+?54[\s.-]?)?(?:0?\d{2,4}[\s.-]+)\d{3,4}[\s.-]?\d{4}/;

export function extractPhone(html: string): string {
  const href = html.match(TEL_HREF_RE);
  if (href) return href[1].trim();
  const text = html.replace(/<[^>]+>/g, ' ');
  const m = text.match(PHONE_TEXT_RE);
  return m ? m[0].trim() : '';
}
```

Agregar a `packages/core/src/index.ts` (al final de la lista de exports):

```ts
export * from './phone.js';
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @leadhub/core test phone`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/phone.ts packages/core/src/index.ts packages/core/tests/phone.test.ts
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(core): extractPhone puro para enriquecimiento"
```

---

### Task 2: Tipo `SocialProfileData` + parser de Facebook

**Files:**
- Create: `packages/core/src/social-profile.ts`
- Modify: `packages/core/src/index.ts` (agregar export)
- Test: `packages/core/tests/social-profile.test.ts`

**Interfaces:**
- Consumes: `extractPhone` (Task 1); `extractEmails`, `filterEmails`, `normalizeUrl` (existentes en core).
- Produces:
  - `interface SocialProfileData { email?: string; telefono?: string; sitioWeb?: string; whatsapp?: string; direccion?: string }`
  - `parseFacebookProfile(html: string): SocialProfileData` — extrae de la página pública de FB; ante muro de login o HTML sin datos devuelve `{}`; omite claves no encontradas.
  - Helpers puros internos exportados para reuso por IG (Task 3): `isSocialLoginWall(html): boolean`, `extractWhatsappLink(html): string`, `extractFacebookExternalUrl(html): string`.

- [ ] **Step 1: Escribir el test que falla**

Crear `packages/core/tests/social-profile.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseFacebookProfile } from '../src/social-profile.js';

const FB_FULL = `
<html><head><title>Panadería La Espiga</title></head><body>
  <a href="mailto:hola@laespiga.com.ar">Email</a>
  <a href="tel:+541144445555">Teléfono</a>
  <a href="https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.laespiga.com.ar%2F&h=xyz">Sitio web</a>
  <a href="https://api.whatsapp.com/send?phone=5491133334444">WhatsApp</a>
  <div>Dirección: Av. Rivadavia 1234, CABA</div>
</body></html>`;

const FB_LOGIN = `
<html><body>
  <form action="/login/device-based/regular/login/"><input name="email"></form>
  <div>Iniciá sesión en Facebook para continuar</div>
</body></html>`;

describe('parseFacebookProfile', () => {
  it('extrae email, teléfono, sitio web y whatsapp de una página pública', () => {
    const r = parseFacebookProfile(FB_FULL);
    expect(r.email).toBe('hola@laespiga.com.ar');
    expect(r.telefono).toBe('+541144445555');
    expect(r.sitioWeb).toBe('https://www.laespiga.com.ar/');
    expect(r.whatsapp).toBe('https://wa.me/5491133334444');
  });
  it('devuelve {} ante un muro de login', () => {
    expect(parseFacebookProfile(FB_LOGIN)).toEqual({});
  });
  it('omite las claves que no encuentra (sin inventar)', () => {
    const r = parseFacebookProfile('<html><body>Sin contacto</body></html>');
    expect(r).toEqual({});
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @leadhub/core test social-profile`
Expected: FAIL (`parseFacebookProfile` no existe).

- [ ] **Step 3: Implementar**

Crear `packages/core/src/social-profile.ts`:

```ts
import { extractEmails, filterEmails } from './email-filter.js';
import { normalizeUrl } from './url.js';
import { extractPhone } from './phone.js';

export interface SocialProfileData {
  email?: string;
  telefono?: string;
  sitioWeb?: string;
  whatsapp?: string;
  direccion?: string;
}

// Marcadores robustos a acento: se busca el fragmento sin el prefijo
// "inicia/iniciá" para matchear ambas variantes ("Iniciá sesión", "Inicia sesión").
const LOGIN_MARKERS = [
  '/login/device-based/',
  'accounts/login',
  'checkpoint',
  'log in to facebook',
  'sesión en facebook',
  'sesión para ver',
];

export function isSocialLoginWall(html: string): boolean {
  const low = html.toLowerCase();
  return LOGIN_MARKERS.some((m) => low.includes(m));
}

const WA_RE = /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\+?\d{6,})/i;

export function extractWhatsappLink(html: string): string {
  const m = html.match(WA_RE);
  return m ? `https://wa.me/${m[1].replace(/\D/g, '')}` : '';
}

// FB envuelve los links salientes en l.facebook.com/l.php?u=<encoded>.
const FB_OUT_RE = /l\.facebook\.com\/l\.php\?u=([^"&]+)/i;

export function extractFacebookExternalUrl(html: string): string {
  const m = html.match(FB_OUT_RE);
  if (!m) return '';
  try {
    const url = decodeURIComponent(m[1]);
    if (/facebook\.com|instagram\.com|whatsapp/i.test(url)) return '';
    return normalizeUrl(url);
  } catch {
    return '';
  }
}

const ADDR_RE = /Direcci[oó]n:\s*([^<\n]{6,120})/i;

function extractFacebookAddress(html: string): string {
  const m = html.match(ADDR_RE);
  return m ? m[1].trim() : '';
}

export function parseFacebookProfile(html: string): SocialProfileData {
  if (isSocialLoginWall(html)) return {};
  const email = filterEmails(extractEmails(html))[0] ?? '';
  const telefono = extractPhone(html);
  const sitioWeb = extractFacebookExternalUrl(html);
  const whatsapp = extractWhatsappLink(html);
  const direccion = extractFacebookAddress(html);
  const out: SocialProfileData = {};
  if (email) out.email = email;
  if (telefono) out.telefono = telefono;
  if (sitioWeb) out.sitioWeb = sitioWeb;
  if (whatsapp) out.whatsapp = whatsapp;
  if (direccion) out.direccion = direccion;
  return out;
}
```

Agregar a `packages/core/src/index.ts`:

```ts
export * from './social-profile.js';
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @leadhub/core test social-profile`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/social-profile.ts packages/core/src/index.ts packages/core/tests/social-profile.test.ts
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(core): SocialProfileData + parseFacebookProfile"
```

---

### Task 3: Parser de Instagram

**Files:**
- Modify: `packages/core/src/social-profile.ts` (agregar `parseInstagramProfile`)
- Test: `packages/core/tests/social-profile.test.ts` (agregar casos IG)

**Interfaces:**
- Consumes: `isSocialLoginWall`, `extractWhatsappLink`, `SocialProfileData` (Task 2); `extractEmails`, `filterEmails`, `normalizeUrl` (core).
- Produces: `parseInstagramProfile(html: string): SocialProfileData` — extrae del JSON embebido del perfil público de IG (`external_url`, `business_email`, `biography`); ante muro de login o HTML sin datos devuelve `{}`.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `packages/core/tests/social-profile.test.ts` (importar también `parseInstagramProfile`):

```ts
import { parseInstagramProfile } from '../src/social-profile.js';

const IG_FULL = `
<html><body><script type="application/json">
{"biography":"Panadería artesanal. Pedidos: hola@laespiga.com.ar","external_url":"https://www.laespiga.com.ar/","business_email":"ventas@laespiga.com.ar"}
</script></body></html>`;

const IG_LOGIN = `<html><body><div>Iniciá sesión para ver esta foto</div></body></html>`;

describe('parseInstagramProfile', () => {
  it('extrae sitio web (external_url) y email de negocio del JSON del perfil', () => {
    const r = parseInstagramProfile(IG_FULL);
    expect(r.sitioWeb).toBe('https://www.laespiga.com.ar/');
    expect(r.email).toBe('ventas@laespiga.com.ar');
  });
  it('cae al email de la biografía si no hay business_email', () => {
    const html = `<script>{"biography":"Escribinos a hola@laespiga.com.ar","external_url":"","business_email":""}</script>`;
    expect(parseInstagramProfile(html).email).toBe('hola@laespiga.com.ar');
  });
  it('devuelve {} ante muro de login', () => {
    expect(parseInstagramProfile(IG_LOGIN)).toEqual({});
  });
  it('omite claves ausentes', () => {
    expect(parseInstagramProfile('<html><body>x</body></html>')).toEqual({});
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @leadhub/core test social-profile`
Expected: FAIL (`parseInstagramProfile` no existe).

- [ ] **Step 3: Implementar**

Agregar al final de `packages/core/src/social-profile.ts`:

```ts
function jsonField(html: string, key: string): string {
  const re = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

export function parseInstagramProfile(html: string): SocialProfileData {
  if (isSocialLoginWall(html)) return {};
  const externalUrl = jsonField(html, 'external_url');
  const businessEmail = jsonField(html, 'business_email');
  const biography = jsonField(html, 'biography');
  const email = businessEmail || filterEmails(extractEmails(biography))[0] || '';
  const sitioWeb = externalUrl ? normalizeUrl(externalUrl) : '';
  const whatsapp = extractWhatsappLink(biography) || extractWhatsappLink(html);
  const out: SocialProfileData = {};
  if (email) out.email = email;
  if (sitioWeb) out.sitioWeb = sitioWeb;
  if (whatsapp) out.whatsapp = whatsapp;
  return out;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @leadhub/core test social-profile`
Expected: PASS (todos los casos FB + IG).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/social-profile.ts packages/core/tests/social-profile.test.ts
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(core): parseInstagramProfile"
```

---

### Task 4: Merge puro rellena-vacíos

**Files:**
- Modify: `packages/core/src/social-profile.ts` (agregar `fillEmptyFields`)
- Test: `packages/core/tests/social-profile.test.ts` (agregar casos de merge)

**Interfaces:**
- Consumes: `Lead` (de `./types.js`), `SocialProfileData` (Task 2).
- Produces: `fillEmptyFields(lead: Lead, data: SocialProfileData): Lead` — devuelve un **nuevo** Lead (inmutable) donde `email/telefono/sitioWeb/whatsapp/direccion` toman el valor de `data` **solo si** el campo del lead es `''`. No pisa valores existentes.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `packages/core/tests/social-profile.test.ts` (importar `fillEmptyFields` y el tipo `Lead`):

```ts
import { fillEmptyFields } from '../src/social-profile.js';
import type { Lead } from '../src/types.js';

const baseLead = (over: Partial<Lead> = {}): Lead => ({
  razonSocial: 'La Espiga', nombreFantasia: 'La Espiga', telefono: '', email: '',
  cuit: '', sitioWeb: '', direccion: '', localidad: '', provincia: '', categoria: '',
  calificacionGoogle: '', cantidadResenas: '0', instagram: '', facebook: '', whatsapp: '',
  coordenadas: '', fuente: 'Google Maps', fechaExtraccion: '2026-07-04T00:00:00Z', ...over,
});

describe('fillEmptyFields', () => {
  it('rellena solo los campos vacíos', () => {
    const r = fillEmptyFields(baseLead(), { email: 'a@b.com', telefono: '011', sitioWeb: 'https://x' });
    expect(r.email).toBe('a@b.com');
    expect(r.telefono).toBe('011');
    expect(r.sitioWeb).toBe('https://x');
  });
  it('no pisa valores existentes', () => {
    const r = fillEmptyFields(baseLead({ email: 'real@lead.com' }), { email: 'a@b.com' });
    expect(r.email).toBe('real@lead.com');
  });
  it('ignora claves ausentes en data', () => {
    const r = fillEmptyFields(baseLead(), {});
    expect(r.email).toBe('');
  });
  it('no muta el lead original', () => {
    const lead = baseLead();
    fillEmptyFields(lead, { email: 'a@b.com' });
    expect(lead.email).toBe('');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @leadhub/core test social-profile`
Expected: FAIL (`fillEmptyFields` no existe).

- [ ] **Step 3: Implementar**

Agregar al final de `packages/core/src/social-profile.ts` (importar `Lead` arriba: `import type { Lead } from './types.js';`):

```ts
const SOCIAL_FILLABLE = ['email', 'telefono', 'sitioWeb', 'whatsapp', 'direccion'] as const;

export function fillEmptyFields(lead: Lead, data: SocialProfileData): Lead {
  const out: Lead = { ...lead };
  for (const key of SOCIAL_FILLABLE) {
    const value = data[key];
    if (value && out[key] === '') out[key] = value;
  }
  return out;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @leadhub/core test social-profile`
Expected: PASS (todos los casos).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/social-profile.ts packages/core/tests/social-profile.test.ts
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(core): fillEmptyFields (merge rellena-vacíos)"
```

---

### Task 5: Capa I/O `enrichSocials` (Playwright, best-effort)

**Files:**
- Create: `apps/scraper/src/scraper/social-enricher.ts`

**Interfaces:**
- Consumes: `parseFacebookProfile`, `parseInstagramProfile`, `SocialProfileData`, `normalizeUrl` (de `@leadhub/core`); `sleep`, `jitter` (de `../utils/rate-limiter.js`); `logWarn` (de `../utils/logger.js`); `BrowserContext` (playwright).
- Produces:
  ```ts
  enrichSocials(
    context: BrowserContext,
    socials: { instagram?: string; facebook?: string },
    opts?: { timeoutMs?: number },
  ): Promise<SocialProfileData>
  ```
  Visita FB (primero) e IG; combina con **FB ganando** sobre IG. Nunca lanza; ante error/timeout/login devuelve lo que haya (o `{}`). No tiene test unitario (I/O de Playwright, igual que `enrichWebsite`); su verificación es el build/type-check y el smoke de Task 6.

- [ ] **Step 1: Implementar**

Crear `apps/scraper/src/scraper/social-enricher.ts`:

```ts
import type { BrowserContext } from 'playwright';
import { parseFacebookProfile, parseInstagramProfile, normalizeUrl, type SocialProfileData } from '@leadhub/core';
import { sleep, jitter } from '../utils/rate-limiter.js';
import { logWarn } from '../utils/logger.js';

const LOGIN_URL_RE = /login|accounts\/login|checkpoint/i;

async function fetchProfile(
  context: BrowserContext,
  rawUrl: string,
  parse: (html: string) => SocialProfileData,
  timeoutMs: number,
): Promise<SocialProfileData> {
  const url = normalizeUrl(rawUrl);
  const page = await context.newPage();
  try {
    await page.goto(url, { timeout: timeoutMs, waitUntil: 'domcontentloaded' });
    if (LOGIN_URL_RE.test(page.url())) return {};
    const html = await page.content();
    return parse(html);
  } catch {
    logWarn(`No se pudo enriquecer perfil: ${url}`);
    return {};
  } finally {
    await page.close();
  }
}

export async function enrichSocials(
  context: BrowserContext,
  socials: { instagram?: string; facebook?: string },
  opts: { timeoutMs?: number } = {},
): Promise<SocialProfileData> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  let data: SocialProfileData = {};
  if (socials.facebook) {
    data = await fetchProfile(context, socials.facebook, parseFacebookProfile, timeoutMs);
  }
  if (socials.instagram) {
    if (socials.facebook) await sleep(jitter(1000));
    const ig = await fetchProfile(context, socials.instagram, parseInstagramProfile, timeoutMs);
    data = { ...ig, ...data }; // FB gana sobre IG
  }
  return data;
}
```

- [ ] **Step 2: Verificar type-check/build**

Run: `pnpm --filter @leadhub/scraper build`
Expected: compila sin errores de TS.

- [ ] **Step 3: Commit**

```bash
git add apps/scraper/src/scraper/social-enricher.ts
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(scraper): enrichSocials (I/O best-effort FB+IG)"
```

---

### Task 6: Enganche en el scrape

**Files:**
- Modify: `apps/scraper/src/scraper/maps-scraper.ts:196-200` (loop por listing)

**Interfaces:**
- Consumes: `enrichSocials` (Task 5); `fillEmptyFields` (Task 4); `context` y `options.enrich` ya en scope en `runScrape`.

**Contexto:** hoy el bloque `else` del loop es:
```ts
} else {
  const enrichment = options.enrich && biz.website
    ? await enrichWebsite(context, biz.website)
    : { email: '', cuit: '', instagram: '', facebook: '', whatsapp: '' };
  leads.push(toLead(biz, enrichment, options.location, new Date().toISOString()));
  ...
}
```
`enrichWebsite` devuelve `Enrichment` con `instagram`/`facebook` (los handles descubiertos en el sitio web). `toLead` produce el Lead base con los datos de Maps + email/cuit/socials del sitio. El enriquecimiento por redes rellena huecos **después** de `toLead`.

- [ ] **Step 1: Agregar los imports**

En `apps/scraper/src/scraper/maps-scraper.ts`, junto al import de `enrichWebsite` (línea 4):

```ts
import { enrichWebsite } from './web-enricher.js';
import { enrichSocials } from './social-enricher.js';
```

`fillEmptyFields` es un **valor** (no un tipo). `maps-scraper.ts` ya tiene una línea de import de valor de core (línea 13):

```ts
import { parseCoordinates, dedupeLeads, normalizeUrl, slugify } from '@leadhub/core';
```

Sumar `fillEmptyFields` a esa línea:

```ts
import { parseCoordinates, dedupeLeads, normalizeUrl, slugify, fillEmptyFields } from '@leadhub/core';
```

(No agregarlo a la línea `import type { ... }` de abajo — es un valor, no un tipo.)

- [ ] **Step 2: Modificar el bloque `else` del loop**

Reemplazar:
```ts
        } else {
          const enrichment = options.enrich && biz.website
            ? await enrichWebsite(context, biz.website)
            : { email: '', cuit: '', instagram: '', facebook: '', whatsapp: '' };
          leads.push(toLead(biz, enrichment, options.location, new Date().toISOString()));
```
por:
```ts
        } else {
          const enrichment = options.enrich && biz.website
            ? await enrichWebsite(context, biz.website)
            : { email: '', cuit: '', instagram: '', facebook: '', whatsapp: '' };
          let lead = toLead(biz, enrichment, options.location, new Date().toISOString());
          if (options.enrich && (enrichment.instagram || enrichment.facebook)) {
            const social = await enrichSocials(context, {
              instagram: enrichment.instagram,
              facebook: enrichment.facebook,
            });
            lead = fillEmptyFields(lead, social);
          }
          leads.push(lead);
```
(el resto del bloque —`bar?.increment`, `onProgress?.(...)`— queda igual).

- [ ] **Step 3: Verificar build de scraper + api**

Run: `pnpm --filter @leadhub/scraper build && pnpm --filter @leadhub/api build`
Expected: ambos compilan (el scraper es un subproceso del api; su contrato de salida `Lead[]` no cambió).

- [ ] **Step 4: Correr toda la suite del monorepo**

Run: `pnpm -r test`
Expected: verde. Nota: `@leadhub/api` y `@leadhub/ingest` requieren `DATABASE_URL_TEST` exportada (DB de test en `localhost:5544/leadhub_test`); si falla por credenciales, exportarla desde `apps/api/.env` antes de correr — no es una falla de este cambio.

- [ ] **Step 5: Commit**

```bash
git add apps/scraper/src/scraper/maps-scraper.ts
git -c user.name="Emanuel Cejas" -c user.email="emanuel.cejas.ar@gmail.com" commit -m "feat(scraper): enriquecer leads con perfiles FB/IG inline"
```

---

## Notas para el smoke del controlador (verificación final)

- **Comportamiento esperado:** con `enrich` activo, un lead cuyo sitio web expone un `@instagram`/URL de Facebook queda con email/teléfono/sitioWeb/WhatsApp/dirección completados desde el perfil **solo donde estaban vacíos**.
- **Best-effort:** un perfil caído/con login/captcha no rompe el scrape ni cambia el estado del job (queda `done`).
- **Sin regresiones:** el flujo Maps → web-enricher → upsert intacto; `fuente` sigue `'Google Maps'`; dedup por `nombre|direccion` sin cambios; API/UI sin tocar.
- **Opcional (smoke real):** correr un scrape chico (`max` bajo) sobre un rubro con presencia en redes y confirmar en la tabla `leads` que se rellenaron huecos sin pisar datos.
