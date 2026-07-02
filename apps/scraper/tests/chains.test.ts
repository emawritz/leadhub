import { describe, it, expect } from 'vitest';
import { isKnownChain } from '../src/scraper/chains.js';

describe('isKnownChain', () => {
  it('detecta cadenas de supermercados conocidas', () => {
    expect(isKnownChain('Coto Abasto')).toBe(true);
    expect(isKnownChain('Carrefour Express Caballito')).toBe(true);
    expect(isKnownChain('La Anónima Sucursal 5')).toBe(true);
    expect(isKnownChain('Supermercado DIA%')).toBe(true);
  });

  it('detecta cadenas mayoristas conocidas', () => {
    expect(isKnownChain('Supermayorista Vital | Abasto')).toBe(true);
    expect(isKnownChain('Maxiconsumo Quilmes')).toBe(true);
  });

  it('detecta cadenas de ferretería/corralón/pinturería', () => {
    expect(isKnownChain('Sodimac Avellaneda')).toBe(true);
    expect(isKnownChain('Easy Quilmes')).toBe(true);
    expect(isKnownChain('Colorshop Lomas')).toBe(true);
  });

  it('no marca negocios independientes', () => {
    expect(isKnownChain('Almacén Don José')).toBe(false);
    expect(isKnownChain('Distribuidora El Sol')).toBe(false);
  });

  it('no confunde palabras que contienen un token (Diaz ≠ Dia)', () => {
    expect(isKnownChain('Mercado Diaz')).toBe(false);
  });
});
