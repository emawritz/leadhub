# Enriquecimiento de leads por perfiles de redes (Facebook + Instagram) — Diseño

**Fecha:** 2026-07-04
**Estado:** Aprobado para planificación
**Base:** El scraper de Google Maps ya enriquece cada lead visitando su **sitio web** (`apps/scraper/src/scraper/web-enricher.ts` → `enrichWebsite` + `extractSocials`), extrayendo email, CUIT y handles de redes. Este slice suma los **perfiles públicos de Facebook e Instagram** como fuente adicional de enriquecimiento inline.

## Objetivo

Que un lead descubierto por Google Maps quede con más datos de contacto **rellenando los campos que hoy quedan vacíos** (email, teléfono, sitio web, WhatsApp, dirección), visitando su página pública de Facebook y su perfil público de Instagram cuando el lead ya tiene esos handles. Sin buscar en FB/IG, sin login, sin cambios de esquema.

## Decisiones del brainstorm

| Tema | Decisión |
|------|----------|
| Acceso a FB/IG | **Enriquecer, no buscar.** Solo visitar perfiles que el lead ya tiene (descubiertos por Maps o por el enrich del sitio web). |
| Disparador | **Inline en el scrape**, enganchado al flag `enrich` existente. Sin API/UI nuevas. |
| Plataformas | **Facebook + Instagram.** FB rinde mucho (sección pública "Información"); IG es best-effort (bio + `og:description`, sin login). |
| Datos | **Solo rellenar huecos.** Extraer email/teléfono/sitioWeb/WhatsApp/dirección; completar únicamente campos vacíos. **Sin columnas nuevas.** |
| Acceso técnico | **Público/anónimo, best-effort.** Sin login; si hay muro de login, se abandona el perfil. Riesgo de ban casi nulo. |
| Testing | **Sin tests automatizados de I/O**; parsers puros con fixtures de HTML (política del repo: pura vs I/O). Build + smoke. |

## Arquitectura (pura vs I/O, siguiendo el patrón del repo)

### Parsers puros — `packages/core`

Testeables sin browser, junto a `extractSocials`/`email-filter`/`url`. Reutilizan los helpers puros existentes (`filtrado de emails`, `normalizeUrl`, y un extractor de teléfono/WhatsApp).

- `parseFacebookProfile(html: string): Partial<Enrichment>`
  Extrae de la página pública de FB: **email** (`mailto:` + texto), **teléfono** (`tel:` + patrón AR), **sitioWeb** (link externo del intro, normalizado), **whatsapp** (`wa.me`/`api.whatsapp.com`), **dirección** (bloque de dirección del intro/"Información"). Tolerante a que cualquiera falte.
- `parseInstagramProfile(html: string): Partial<Enrichment>`
  Extrae del perfil público de IG: **sitioWeb** (link externo de la bio), y **email**/**whatsapp** si figuran en el texto de la bio o en `og:description`. IG sin login expone poco; devolver lo que haya.

Ambos devuelven `Partial<Enrichment>` (subconjunto de `{ email, telefono, sitioWeb, whatsapp, direccion }`), nunca lanzan, y omiten claves que no encontraron. El tipo `Enrichment` de `packages/core/src/types.ts` se amplía si hace falta para incluir `telefono`/`direccion` como campos opcionales (hoy `Enrichment` = `Socials & { email; cuit }`); la ampliación es aditiva y opcional, sin romper `enrichWebsite`.

### Capa I/O — `apps/scraper/src/scraper/social-enricher.ts`

```ts
enrichSocials(
  context: BrowserContext,
  socials: { instagram?: string; facebook?: string },
  opts?: { timeoutMs?: number },
): Promise<Partial<Enrichment>>
```

- Para cada handle presente (facebook primero, luego instagram): normaliza el handle a URL de perfil, abre una página nueva en el `context` existente, espera el HTML, y llama al parser puro correspondiente.
- **Best-effort estricto:** cada perfil va envuelto en `try/catch` con timeout (`timeoutMs`, default ~15 s); ante error/timeout/muro de login/captcha se descarta ese perfil y se sigue. Cierra la página siempre (`finally`).
- **Detección de muro de login:** si la URL final redirige a `login`/`/accounts/login` o el HTML no contiene marcadores de perfil, devuelve `{}` para ese perfil.
- Entre perfiles usa el `jitter/sleep` existente para no martillar.
- Devuelve el merge de lo obtenido de FB e IG (**FB gana sobre IG** al combinar, ya que rinde datos más estructurados).

## Flujo y merge

```
listing Maps → scrapeBusiness (RawBusiness)
  → enrichWebsite (sitio web → email/cuit/socials)     [ya existe]
  → si (instagram || facebook) presente y enrich activo:
       enrichSocials(context, { instagram, facebook })  [nuevo]
  → merge "rellena-vacíos": base (Maps+web) gana; redes solo tapan huecos
  → toLead → Lead (fuente 'Google Maps', sin cambios)
  → upsert (rellena-vacíos en DB)                        [ya existe]
```

- El enrich del sitio web es quien **descubre** los handles en la mayoría de los casos, por eso `enrichSocials` corre después de `enrichWebsite`.
- **Precedencia de datos:** lo scrapeado de Maps y del sitio web tiene prioridad; los datos de redes solo se aplican a campos aún vacíos. Coherente con la estrategia del upsert (`CASE WHEN x='' THEN excluded.x ELSE x`). Evita que FB/IG (menos confiable) pise dato bueno.
- **Punto de enganche exacto:** en `apps/scraper/src/scraper/maps-scraper.ts`, dentro del loop por listing, después de la llamada a `enrichWebsite` y antes de `toLead`. Se combina el `Enrichment` del sitio con el `Partial<Enrichment>` de las redes usando la regla rellena-vacíos.
- **Control:** se reutiliza el flag `enrich` existente (ya default `true`; ya significa "visitar páginas externas para más datos"). Sin campo nuevo en `scrapeJobs`, en el zod de `input.ts`, ni en la UI.

## Errores y robustez (crítico)

- `enrichSocials` **nunca** propaga excepción al `maps-scraper` ni afecta el estado del job; en el peor caso devuelve `{}`.
- Timeout por perfil; `try/catch/finally` que cierra la página; degradación explícita ante login/captcha/bloqueo.
- Un cambio de markup de FB/IG se traduce en **campos vacíos, nunca en un crash**.
- Reutiliza `jitter/sleep` para ser amable con las plataformas.

## Testing

- **Parsers puros** (`packages/core`) con **fixtures de HTML** guardado:
  - Página pública de FB con email/tel/web/dirección → extrae los cinco.
  - Perfil de IG con bio + link externo → extrae sitioWeb (+ email si está).
  - Muro de login (FB e IG) → `{}`.
  - HTML sin datos de contacto → `{}` (no inventa).
- **Sin tests de la capa I/O** (`social-enricher.ts`): es I/O delgada de Playwright, igual que `web-enricher` no testea su navegación, solo `extractSocials`.
- Verificación: `pnpm -r test` verde + build + smoke manual de un scrape con leads que tengan FB/IG.

## Fuera de alcance

- Buscar negocios en FB/IG (solo enriquecer los que ya tienen handle).
- Login / sesión persistente en FB/IG.
- Columnas nuevas (seguidores, verificado, etc.) y cambios en el lead scoring.
- Botón de enriquecimiento on-demand en el CRM (podría venir después reutilizando el mismo motor).
- IG más allá de bio/`og:description`.
- Cambios en la clave de dedup o en el campo `fuente`.

## Criterio de éxito

1. Con `enrich` activo, un lead que tiene handle de Facebook y/o Instagram queda con email/teléfono/sitioWeb/WhatsApp/dirección **completados desde el perfil** cuando estaban vacíos, sin pisar los que ya tenían valor.
2. `parseFacebookProfile`/`parseInstagramProfile` extraen de fixtures reales y devuelven `{}` ante muro de login o HTML sin datos.
3. Un fallo/timeout/bloqueo de FB o IG **no rompe** el scrape ni cambia el estado del job (best-effort verificado).
4. Sin cambios de esquema, de dedup, de `fuente`, ni de la API/UI.
5. Los paquetes compilan; `pnpm -r test` verde; el flujo de scrape existente (Maps + web-enricher + upsert) intacto.

## Riesgos

- **Yield variable:** IG sin login expone poco; FB a veces muestra muro de login para el intro completo. Asumido; el valor está en FB principalmente.
- **Fragilidad de markup:** FB/IG cambian su HTML seguido. Mitigado con parsers puros + fixtures + best-effort (breakage = vacío, no crash); los fixtures documentan el markup esperado y facilitan re-tunear.
- **Latencia:** hasta 2 visitas extra por lead con handle. Acotado con timeout por perfil y `jitter`; solo corre si hay handle y `enrich` está activo.
- **Legal/ToS:** solo HTML público, read-only, rellena-vacíos; sin login ni evasión de autenticación.
