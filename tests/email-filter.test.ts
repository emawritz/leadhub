import { describe, it, expect } from 'vitest';
import { extractEmails, filterEmails } from '../src/utils/email-filter.js';

describe('extractEmails', () => {
  it('extrae todos los emails del HTML', () => {
    const html = 'contacto: hola@negocio.com y ventas@negocio.com.ar';
    expect(extractEmails(html)).toEqual(['hola@negocio.com', 'ventas@negocio.com.ar']);
  });
});

describe('filterEmails', () => {
  it('elimina genéricos, normaliza a minúsculas y deduplica', () => {
    const input = ['Hola@Negocio.com', 'hola@negocio.com', 'noreply@wix.com', 'x@sentry.io'];
    expect(filterEmails(input)).toEqual(['hola@negocio.com']);
  });
});
