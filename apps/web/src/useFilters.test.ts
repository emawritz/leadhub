import { describe, it, expect } from 'vitest';
import { filtersToQuery, queryToFilters } from './useFilters.js';

describe('useFilters serialización', () => {
  it('filtros → query string', () => {
    const qs = filtersToQuery({ provincia: ['Buenos Aires'], hasEmail: true, page: 2 });
    expect(qs).toContain('provincia=Buenos+Aires');
    expect(qs).toContain('hasEmail=true');
    expect(qs).toContain('page=2');
  });
  it('query string → filtros (arrays repetidos)', () => {
    const f = queryToFilters(new URLSearchParams('provincia=A&provincia=B&hasEmail=true'));
    expect(f.provincia).toEqual(['A', 'B']);
    expect(f.hasEmail).toBe(true);
  });
});
