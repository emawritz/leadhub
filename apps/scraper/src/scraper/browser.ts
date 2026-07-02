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
