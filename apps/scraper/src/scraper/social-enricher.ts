import type { BrowserContext, Page } from 'playwright';
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
  let page: Page | undefined;
  try {
    page = await context.newPage();
    await page.goto(url, { timeout: timeoutMs, waitUntil: 'domcontentloaded' });
    if (LOGIN_URL_RE.test(page.url())) return {};
    const html = await page.content();
    return parse(html);
  } catch {
    logWarn(`No se pudo enriquecer perfil: ${url}`);
    return {};
  } finally {
    if (page) {
      try { await page.close(); } catch { /* best-effort: ignorar */ }
    }
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
