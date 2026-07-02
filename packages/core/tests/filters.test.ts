import { describe, it, expect } from 'vitest';
import { leadFiltersSchema } from '../src/filters.js';

describe('leadFiltersSchema', () => {
  it('aplica defaults de paginación', () => {
    const f = leadFiltersSchema.parse({});
    expect(f.page).toBe(1);
    expect(f.pageSize).toBe(50);
    expect(f.sort).toBe('nombre');
  });
  it('coacciona booleanos y limita pageSize a 100', () => {
    const f = leadFiltersSchema.parse({ hasEmail: 'true', pageSize: 500 });
    expect(f.hasEmail).toBe(true);
    expect(f.pageSize).toBe(100);
  });
  it('acepta arrays de facetas', () => {
    const f = leadFiltersSchema.parse({ provincia: ['Buenos Aires'], categoria: ['Mayorista'] });
    expect(f.provincia).toEqual(['Buenos Aires']);
  });
});
