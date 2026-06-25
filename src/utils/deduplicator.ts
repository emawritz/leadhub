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
