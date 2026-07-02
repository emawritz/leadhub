import { describe, it, expect } from 'vitest';
import { isValidCuit, formatCuit, extractCuit } from '../src/cuit.js';

describe('isValidCuit', () => {
  it('acepta un CUIT con dígito verificador correcto', () => {
    expect(isValidCuit('20-12345678-6')).toBe(true);
    expect(isValidCuit('20123456786')).toBe(true);
  });
  it('rechaza dígito verificador incorrecto', () => {
    expect(isValidCuit('20-12345678-1')).toBe(false);
  });
  it('rechaza prefijo inválido y longitud incorrecta', () => {
    expect(isValidCuit('99-12345678-6')).toBe(false);
    expect(isValidCuit('12345')).toBe(false);
  });
});

describe('formatCuit', () => {
  it('formatea 11 dígitos a XX-XXXXXXXX-X', () => {
    expect(formatCuit('20123456786')).toBe('20-12345678-6');
  });
});

describe('extractCuit', () => {
  it('extrae el primer CUIT válido del HTML', () => {
    const html = 'Tel 11-4444-5555. CUIT: 20-12345678-6 - Razón Social SA';
    expect(extractCuit(html)).toBe('20-12345678-6');
  });
  it('ignora números que no validan como CUIT', () => {
    expect(extractCuit('CUIT 20-12345678-1 (mal)')).toBe('');
  });
  it('devuelve "" si no hay CUIT', () => {
    expect(extractCuit('sin datos fiscales')).toBe('');
  });
});
