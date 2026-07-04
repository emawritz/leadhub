import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { BrowserContext, Page } from 'playwright';
import { launchBrowser } from './browser.js';
import { enrichWebsite } from './web-enricher.js';
import { enrichSocials } from './social-enricher.js';
import { isCaptcha } from './captcha.js';
import { isKnownChain } from './chains.js';
import {
  SELECTORS, FEED, LISTING_LINKS, COOKIE_BUTTONS, END_OF_LIST_TEXTS,
} from './selectors.js';
import { safeExtract } from '../utils/safe-extract.js';
import { jitter, sleep } from '../utils/rate-limiter.js';
import { logSuccess, logWarn, logError, logInfo, createProgressBar } from '../utils/logger.js';
import {
  parseCoordinates, dedupeLeads, normalizeUrl, slugify, fillEmptyFields,
} from '@leadhub/core';
import type {
  Enrichment, Lead, ProgressEvent, RawBusiness, ScraperOptions,
} from '@leadhub/core';

const CHECKPOINT_EVERY = 10;
const CONSENT_HOSTS = ['consent.google.com'];

interface Listing {
  url: string;
  name: string;
}

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

async function collectListingUrls(page: Page, max: number): Promise<Listing[]> {
  const feed = page.locator(FEED);
  try {
    await feed.waitFor({ timeout: 15_000 });
  } catch {
    // Sin panel de resultados. Dos casos:
    // 1) Resultado único: Maps redirige directo a la ficha (/maps/place/...).
    // 2) Cero resultados: no hay nada que listar.
    if (page.url().includes('/maps/place/')) {
      const name = (await page.locator('h1').first().textContent().catch(() => '')) ?? '';
      logInfo('Resultado único (sin panel): se captura la ficha directa.');
      return [{ url: page.url(), name: name.trim() }];
    }
    logWarn('La búsqueda no devolvió resultados.');
    return [];
  }
  let stale = 0;
  let prev = 0;
  const byUrl = new Map<string, string>(); // url -> nombre del listado (aria-label)
  while (byUrl.size < max && stale < 3) {
    for (const { url, name } of await page.locator(LISTING_LINKS).evaluateAll(
      (els) => els.map((e) => ({
        url: (e as HTMLAnchorElement).href,
        name: e.getAttribute('aria-label') ?? '',
      })),
    )) {
      if (!byUrl.has(url)) byUrl.set(url, name);
    }
    if (await page.getByText(new RegExp(END_OF_LIST_TEXTS.join('|'))).count()) break;
    await feed.evaluate((el) => el.scrollBy(0, el.scrollHeight));
    await page.waitForTimeout(1500);
    stale = byUrl.size === prev ? stale + 1 : 0;
    prev = byUrl.size;
  }
  return [...byUrl.entries()].slice(0, max).map(([url, name]) => ({ url, name }));
}

async function textOf(page: Page, selectors: string[]): Promise<string> {
  return safeExtract(
    async (sel) => page.locator(sel).first().textContent({ timeout: 2000 }),
    selectors,
  );
}

async function scrapeBusiness(page: Page, url: string): Promise<RawBusiness> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForSelector('h1', { timeout: 10_000 });
  await assertNoCaptcha(page);
  await page.waitForURL(/@-?\d+\.\d+,-?\d+\.\d+/, { timeout: 5000 }).catch(() => {});
  const websiteHref = await safeExtract(
    async (sel) => page.locator(sel).first().getAttribute('href', { timeout: 2000 }),
    [...SELECTORS.websiteHref],
  );
  const rawWebsite = websiteHref || (await textOf(page, [...SELECTORS.websiteText]));
  return {
    mapsUrl: url,
    name: await textOf(page, [...SELECTORS.name]),
    category: await textOf(page, [...SELECTORS.category]),
    address: await textOf(page, [...SELECTORS.address]),
    phone: await textOf(page, [...SELECTORS.phone]),
    website: normalizeUrl(rawWebsite),
    rating: await textOf(page, [...SELECTORS.rating]),
    reviews: await textOf(page, [...SELECTORS.reviews]),
    coordinates: parseCoordinates(page.url()),
  };
}

function toLead(b: RawBusiness, enrichment: Enrichment, location: string, now: string): Lead {
  const parts = location.split(',').map((s) => s.trim());
  return {
    razonSocial: b.name,
    nombreFantasia: b.name,
    telefono: b.phone,
    email: enrichment.email,
    cuit: enrichment.cuit,
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

export async function runScrape(
  options: ScraperOptions,
  onProgress?: (ev: ProgressEvent) => void,
): Promise<Lead[]> {
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
    const listings = await collectListingUrls(page, options.max);
    let candidates = listings.filter((l) => !processed.has(l.url));
    if (options.excludeChains) {
      candidates = candidates.filter((l) => {
        if (isKnownChain(l.name)) {
          logWarn(`Omitido (cadena): ${l.name || l.url}`);
          return false;
        }
        return true;
      });
    }
    logSuccess(`${candidates.length} negocios para procesar (${processed.size} ya hechos).`);

    const useBar = !onProgress;
    const bar = useBar ? createProgressBar(candidates.length) : null;
    onProgress?.({ phase: 'collect', total: candidates.length });
    for (const [i, { url }] of candidates.entries()) {
      try {
        const biz = await scrapeBusiness(page, url);
        if (options.excludeChains && isKnownChain(biz.name)) {
          logWarn(`Omitido (cadena): ${biz.name}`);
          bar?.increment({ name: `omitido: ${biz.name.slice(0, 22)}` });
          onProgress?.({ phase: 'visit', done: i + 1, total: candidates.length });
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
          bar?.increment({ name: biz.name.slice(0, 30) });
          onProgress?.({
            phase: 'visit', done: i + 1, total: candidates.length, name: biz.name,
          });
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('CAPTCHA')) { bar?.stop(); throw err; }
        logError(`Falló ${url}: ${(err as Error).message}`);
      }
      doneUrls.push(url);
      if ((i + 1) % CHECKPOINT_EVERY === 0) await saveCheckpoint(cpPath, doneUrls);
      await sleep(jitter(options.delay));
    }
    bar?.stop();
    await saveCheckpoint(cpPath, doneUrls);
  } finally {
    await context.close();
  }

  const deduped = dedupeLeads(leads);
  logSuccess(`${deduped.length} leads únicos extraídos.`);
  onProgress?.({ phase: 'done', leadsFound: deduped.length });
  return deduped;
}
