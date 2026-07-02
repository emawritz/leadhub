import { describe, it, expect } from 'vitest';
import { buildOverpassQuery, osmElementToLead } from '../src/sources/osm.js';

describe('buildOverpassQuery', () => {
  it('incluye bbox y los tipos de shop', () => {
    const q = buildOverpassQuery('-34.95,-58.65,-34.50,-58.25');
    expect(q).toContain('[bbox:-34.95,-58.65,-34.50,-58.25]');
    expect(q).toContain('wholesale|trade|doityourself|hardware|paint');
    expect(q).toContain('out center tags;');
  });
});

describe('osmElementToLead', () => {
  const now = '2026-06-26T00:00:00.000Z';

  it('mapea un node con tags a Lead', () => {
    const lead = osmElementToLead({
      type: 'node', id: 1, lat: -34.7, lon: -58.4,
      tags: {
        name: 'Distribuidora Sur', shop: 'wholesale', phone: '11-4444-5555',
        website: 'https://dsur.com.ar', 'addr:street': 'San Martín', 'addr:housenumber': '123',
        'addr:city': 'Quilmes',
      },
    }, now);
    expect(lead).not.toBeNull();
    expect(lead!.razonSocial).toBe('Distribuidora Sur');
    expect(lead!.categoria).toBe('Mayorista');
    expect(lead!.telefono).toBe('11-4444-5555');
    expect(lead!.direccion).toBe('San Martín 123, Quilmes');
    expect(lead!.coordenadas).toBe('-34.7,-58.4');
    expect(lead!.fuente).toBe('OpenStreetMap');
  });

  it('usa center para ways', () => {
    const lead = osmElementToLead({ type: 'way', id: 2, center: { lat: -34.6, lon: -58.5 }, tags: { name: 'Ferretería X', shop: 'hardware' } }, now);
    expect(lead!.coordenadas).toBe('-34.6,-58.5');
    expect(lead!.categoria).toBe('Ferretería');
  });

  it('descarta elementos sin nombre', () => {
    expect(osmElementToLead({ type: 'node', id: 3, tags: { shop: 'wholesale' } }, now)).toBeNull();
  });
});
