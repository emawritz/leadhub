import { describe, it, expect } from 'vitest';
import { extractSocials } from '../src/scraper/web-enricher.js';

describe('extractSocials', () => {
  it('extrae instagram, facebook y whatsapp del HTML', () => {
    const html = `
      <a href="https://instagram.com/negocio">ig</a>
      <a href="https://facebook.com/negocio">fb</a>
      <a href="https://wa.me/5491122334455">wa</a>`;
    expect(extractSocials(html)).toEqual({
      instagram: 'https://instagram.com/negocio',
      facebook: 'https://facebook.com/negocio',
      whatsapp: 'https://wa.me/5491122334455',
    });
  });

  it('devuelve "" en redes ausentes', () => {
    expect(extractSocials('<a href="https://otro.com">x</a>')).toEqual({
      instagram: '', facebook: '', whatsapp: '',
    });
  });
});
