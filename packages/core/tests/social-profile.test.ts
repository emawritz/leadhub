import { describe, it, expect } from 'vitest';
import { parseFacebookProfile, parseInstagramProfile } from '../src/social-profile.js';

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

const IG_FULL = `
<html><body><script type="application/json">
{"biography":"Panadería artesanal. Pedidos: hola@laespiga.com.ar","external_url":"https://www.laespiga.com.ar/","business_email":"ventas@laespiga.com.ar"}
</script></body></html>`;

const IG_LOGIN = `<html><body><div>Iniciá sesión para ver esta foto</div></body></html>`;

describe('parseInstagramProfile', () => {
  it('extrae sitio web (external_url) y email de negocio del JSON del perfil', () => {
    const r = parseInstagramProfile(IG_FULL);
    expect(r.sitioWeb).toBe('https://www.laespiga.com.ar/');
    expect(r.email).toBe('ventas@laespiga.com.ar');
  });
  it('cae al email de la biografía si no hay business_email', () => {
    const html = `<script>{"biography":"Escribinos a hola@laespiga.com.ar","external_url":"","business_email":""}</script>`;
    expect(parseInstagramProfile(html).email).toBe('hola@laespiga.com.ar');
  });
  it('devuelve {} ante muro de login', () => {
    expect(parseInstagramProfile(IG_LOGIN)).toEqual({});
  });
  it('omite claves ausentes', () => {
    expect(parseInstagramProfile('<html><body>x</body></html>')).toEqual({});
  });
  it('des-escapa el JSON real de IG (barras \\/ y \\uXXXX)', () => {
    const html = `<script>{"biography":"Panader\\u00eda","external_url":"https:\\/\\/www.laespiga.com.ar\\/","business_email":"ventas\\u0040laespiga.com.ar"}</script>`;
    const r = parseInstagramProfile(html);
    expect(r.sitioWeb).toBe('https://www.laespiga.com.ar/');
    expect(r.email).toBe('ventas@laespiga.com.ar');
  });
});

import { fillEmptyFields } from '../src/social-profile.js';
import type { Lead } from '../src/types.js';

const baseLead = (over: Partial<Lead> = {}): Lead => ({
  razonSocial: 'La Espiga', nombreFantasia: 'La Espiga', telefono: '', email: '',
  cuit: '', sitioWeb: '', direccion: '', localidad: '', provincia: '', categoria: '',
  calificacionGoogle: '', cantidadResenas: '0', instagram: '', facebook: '', whatsapp: '',
  coordenadas: '', fuente: 'Google Maps', fechaExtraccion: '2026-07-04T00:00:00Z', ...over,
});

describe('fillEmptyFields', () => {
  it('rellena solo los campos vacíos', () => {
    const r = fillEmptyFields(baseLead(), { email: 'a@b.com', telefono: '011', sitioWeb: 'https://x' });
    expect(r.email).toBe('a@b.com');
    expect(r.telefono).toBe('011');
    expect(r.sitioWeb).toBe('https://x');
  });
  it('no pisa valores existentes', () => {
    const r = fillEmptyFields(baseLead({ email: 'real@lead.com' }), { email: 'a@b.com' });
    expect(r.email).toBe('real@lead.com');
  });
  it('ignora claves ausentes en data', () => {
    const r = fillEmptyFields(baseLead(), {});
    expect(r.email).toBe('');
  });
  it('no muta el lead original', () => {
    const lead = baseLead();
    fillEmptyFields(lead, { email: 'a@b.com' });
    expect(lead.email).toBe('');
  });
});
