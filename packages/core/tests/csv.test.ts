import { describe, it, expect } from 'vitest';
import { leadToRow } from '../src/csv.js';
import type { Lead } from '../src/types.js';

const lead: Lead = {
  razonSocial: 'Gym X', nombreFantasia: 'Gym X', telefono: '+541112345678',
  email: 'hola@gymx.com', cuit: '30-12345678-9', sitioWeb: 'https://gymx.com', direccion: 'Calle 1',
  localidad: 'Adrogué', provincia: 'Buenos Aires', categoria: 'Gimnasio',
  calificacionGoogle: '4.5', cantidadResenas: '120', instagram: 'https://instagram.com/gymx',
  facebook: '', whatsapp: '', coordenadas: '-34.79,-58.38',
  fuente: 'Google Maps', fechaExtraccion: '2026-06-25T10:00:00.000Z',
};

describe('leadToRow', () => {
  it('mapea Lead a columnas LocalCenter', () => {
    const row = leadToRow(lead);
    expect(row.razon_social).toBe('Gym X');
    expect(row.calificacion_google).toBe('4.5');
    expect(row.cantidad_resenas).toBe('120');
    expect(row.fuente).toBe('Google Maps');
    expect(row.cuit).toBe('30-12345678-9');
    expect(Object.keys(row)).toEqual([
      'razon_social', 'nombre_fantasia', 'telefono', 'email', 'cuit', 'sitio_web',
      'direccion', 'localidad', 'provincia', 'categoria', 'calificacion_google',
      'cantidad_resenas', 'instagram', 'facebook', 'whatsapp', 'coordenadas',
      'fuente', 'fecha_extraccion',
    ]);
  });

  it('maneja Date y number (fila de Drizzle vía API) formateando ISO y string', () => {
    const apiLead = {
      ...lead,
      fechaExtraccion: new Date('2026-06-25T10:00:00.000Z'),
      cantidadResenas: 120,
    } as unknown as Lead;
    const row = leadToRow(apiLead);
    expect(row.fecha_extraccion).toBe('2026-06-25T10:00:00.000Z');
    expect(row.cantidad_resenas).toBe('120');
  });
});
