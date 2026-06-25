import { describe, it, expect } from 'vitest';
import { leadKey, dedupeLeads, dedupeMapsUrls } from '../src/utils/deduplicator.js';
import type { Lead } from '../src/types.js';

const mk = (name: string, address: string): Lead => ({
  razonSocial: name, nombreFantasia: name, telefono: '', email: '', sitioWeb: '',
  direccion: address, localidad: '', provincia: '', categoria: '',
  calificacionGoogle: '', cantidadResenas: '', instagram: '', facebook: '',
  whatsapp: '', coordenadas: '', fuente: 'Google Maps', fechaExtraccion: 'x',
});

describe('leadKey', () => {
  it('normaliza mayúsculas y espacios', () => {
    expect(leadKey(' Gym  X ', 'Calle 1')).toBe(leadKey('gym x', 'calle 1'));
  });
});

describe('dedupeLeads', () => {
  it('elimina duplicados por nombre+dirección', () => {
    const out = dedupeLeads([mk('Gym X', 'Calle 1'), mk('gym x', 'calle 1'), mk('Gym Y', 'Calle 2')]);
    expect(out).toHaveLength(2);
  });
});

describe('dedupeMapsUrls', () => {
  it('quita duplicados y ya procesadas', () => {
    expect(dedupeMapsUrls(['a', 'a', 'b'], new Set(['b']))).toEqual(['a']);
  });
});
