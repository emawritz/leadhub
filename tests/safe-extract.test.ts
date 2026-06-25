import { describe, it, expect } from 'vitest';
import { safeExtract } from '../src/utils/safe-extract.js';

describe('safeExtract', () => {
  it('retorna el primer selector que resuelve valor', async () => {
    const map: Record<string, string | null> = { a: null, b: 'valor', c: 'otro' };
    const resolver = async (s: string) => map[s] ?? null;
    expect(await safeExtract(resolver, ['a', 'b', 'c'])).toBe('valor');
  });

  it('retorna fallback si ninguno resuelve', async () => {
    const resolver = async () => null;
    expect(await safeExtract(resolver, ['a', 'b'], 'NA')).toBe('NA');
  });

  it('ignora errores del resolver y sigue con el siguiente', async () => {
    const resolver = async (s: string) => {
      if (s === 'a') throw new Error('timeout');
      return 'ok';
    };
    expect(await safeExtract(resolver, ['a', 'b'])).toBe('ok');
  });
});
