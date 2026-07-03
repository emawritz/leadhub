import { describe, it, expect } from 'vitest';
import { parseProgressLine } from '../src/scrape/progress.js';
import { scrapeInputSchema } from '../src/scrape/input.js';

describe('parseProgressLine', () => {
  it('parsea una línea NDJSON válida con phase', () => {
    expect(parseProgressLine('{"phase":"visit","done":3,"total":40}')).toEqual({ phase: 'visit', done: 3, total: 40 });
  });
  it('ignora líneas no-JSON (logs humanos)', () => {
    expect(parseProgressLine('✓ 40 negocios para procesar')).toBeNull();
  });
  it('ignora JSON sin phase', () => {
    expect(parseProgressLine('{"foo":1}')).toBeNull();
  });
});

describe('scrapeInputSchema', () => {
  it('aplica defaults (max 40, enrich/excludeChains true)', () => {
    const v = scrapeInputSchema.parse({ query: 'farmacias', location: 'Lomas' });
    expect(v).toEqual({ query: 'farmacias', location: 'Lomas', max: 40, enrich: true, excludeChains: true });
  });
  it('rechaza query vacía y limita max a 120', () => {
    expect(() => scrapeInputSchema.parse({ query: '', location: 'x' })).toThrow();
    expect(scrapeInputSchema.parse({ query: 'a', location: 'b', max: 999 }).max).toBe(120);
  });
});
