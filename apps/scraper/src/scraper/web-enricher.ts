import type { BrowserContext } from 'playwright';
import { extractEmails, filterEmails, extractCuit } from '@leadhub/core';
import type { Enrichment, Socials } from '@leadhub/core';
import { logWarn } from '../utils/logger.js';

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

const EMPTY: Enrichment = { email: '', cuit: '', instagram: '', facebook: '', whatsapp: '' };

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
    const cuit = extractCuit(html);
    const socials = extractSocials(html);
    return { email, cuit, ...socials };
  } catch {
    logWarn(`No se pudo enriquecer: ${url}`);
    return EMPTY;
  } finally {
    await page.close();
  }
}
