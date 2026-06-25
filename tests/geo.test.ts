import { describe, it, expect } from 'vitest';
import { parseCoordinates } from '../src/utils/geo.js';

describe('parseCoordinates', () => {
  it('extrae lat,lng del patrón @LAT,LNG,Zz', () => {
    const url = 'https://www.google.com/maps/place/X/@-34.7998,-58.3899,17z/data=!3m1';
    expect(parseCoordinates(url)).toBe('-34.7998,-58.3899');
  });

  it('retorna "" si la URL no tiene coordenadas', () => {
    expect(parseCoordinates('https://www.google.com/maps/place/X')).toBe('');
  });
});
