import { describe, it, expect } from 'vitest';
import { slugify, resolveOutputPaths } from '../src/output-path.js';

describe('slugify', () => {
  it('normaliza acentos y espacios', () => {
    expect(slugify('Adrogué Buenos Aires')).toBe('adrogue_buenos_aires');
  });
});

describe('resolveOutputPaths', () => {
  it('usa la base del --output sin extensión', () => {
    expect(resolveOutputPaths('./output/gimnasios.csv', 'gimnasios', '2026-06-25'))
      .toEqual({ csv: './output/gimnasios.csv', json: './output/gimnasios.json' });
  });
  it('autogenera con slug + fecha cuando no hay --output', () => {
    expect(resolveOutputPaths(undefined, 'restaurantes', '2026-06-25'))
      .toEqual({ csv: 'output/restaurantes_2026-06-25.csv', json: 'output/restaurantes_2026-06-25.json' });
  });
});
