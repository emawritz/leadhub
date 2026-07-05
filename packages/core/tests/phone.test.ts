import { describe, it, expect } from 'vitest';
import { extractPhone } from '../src/phone.js';

describe('extractPhone', () => {
  it('extrae de un link tel:', () => {
    expect(extractPhone('<a href="tel:+541144445555">Llamar</a>')).toBe('+541144445555');
  });
  it('prioriza el link tel: sobre el texto', () => {
    const html = 'Antes 011 9999-8888 <a href="tel:+541144445555">x</a>';
    expect(extractPhone(html)).toBe('+541144445555');
  });
  it('extrae un teléfono AR formateado del texto cuando no hay tel:', () => {
    expect(extractPhone('<p>Tel: +54 11 4444-5555</p>')).toBe('+54 11 4444-5555');
  });
  it('devuelve "" cuando no hay teléfono reconocible', () => {
    expect(extractPhone('<p>Sin datos de contacto</p>')).toBe('');
  });
  it('no confunde una fecha o número suelto con teléfono', () => {
    expect(extractPhone('<p>Fundado en 2020, 15 años</p>')).toBe('');
  });
  it('extrae un número local de 8 dígitos con separador (sin código de área)', () => {
    expect(extractPhone('<p>Llamanos al 4444-5555</p>')).toBe('4444-5555');
  });
  it('no matchea 8 dígitos corridos sin separador', () => {
    expect(extractPhone('<p>Pedido 44445555 confirmado</p>')).toBe('');
  });
});
