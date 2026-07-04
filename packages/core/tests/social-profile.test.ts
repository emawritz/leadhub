import { describe, it, expect } from 'vitest';
import { parseFacebookProfile } from '../src/social-profile.js';

const FB_FULL = `
<html><head><title>Panadería La Espiga</title></head><body>
  <a href="mailto:hola@laespiga.com.ar">Email</a>
  <a href="tel:+541144445555">Teléfono</a>
  <a href="https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.laespiga.com.ar%2F&h=xyz">Sitio web</a>
  <a href="https://api.whatsapp.com/send?phone=5491133334444">WhatsApp</a>
  <div>Dirección: Av. Rivadavia 1234, CABA</div>
</body></html>`;

const FB_LOGIN = `
<html><body>
  <form action="/login/device-based/regular/login/"><input name="email"></form>
  <div>Iniciá sesión en Facebook para continuar</div>
</body></html>`;

describe('parseFacebookProfile', () => {
  it('extrae email, teléfono, sitio web y whatsapp de una página pública', () => {
    const r = parseFacebookProfile(FB_FULL);
    expect(r.email).toBe('hola@laespiga.com.ar');
    expect(r.telefono).toBe('+541144445555');
    expect(r.sitioWeb).toBe('https://www.laespiga.com.ar/');
    expect(r.whatsapp).toBe('https://wa.me/5491133334444');
  });
  it('devuelve {} ante un muro de login', () => {
    expect(parseFacebookProfile(FB_LOGIN)).toEqual({});
  });
  it('omite las claves que no encuentra (sin inventar)', () => {
    const r = parseFacebookProfile('<html><body>Sin contacto</body></html>');
    expect(r).toEqual({});
  });
});
