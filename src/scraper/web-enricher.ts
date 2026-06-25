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
