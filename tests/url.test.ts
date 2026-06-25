import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '../src/utils/url.js';

describe('normalizeUrl', () => {
  it('deja pasar URLs con https', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('deja pasar URLs con http', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('antepone https:// a URLs sin esquema', () => {
    expect(normalizeUrl('gymx.com')).toBe('https://gymx.com');
  });

  it('retorna "" para string vacío', () => {
    expect(normalizeUrl('')).toBe('');
  });
});
