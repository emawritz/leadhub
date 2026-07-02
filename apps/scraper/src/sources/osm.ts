import type { Lead } from '@leadhub/core';

// Fuente alternativa: OpenStreetMap vía Overpass API (libre, sin anti-bot).
// Rubros del ICP de LocalCenter mapeados desde el tag `shop`.

export const OSM_SHOP_TYPES = ['wholesale', 'trade', 'doityourself', 'hardware', 'paint'];

const SHOP_ES: Record<string, string> = {
  wholesale: 'Mayorista',
  trade: 'Comercio mayorista / distribuidora',
  doityourself: 'Corralón / materiales',
  hardware: 'Ferretería',
  paint: 'Pinturería',
};

const ENDPOINT = 'https://overpass-api.de/api/interpreter';

export interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function buildOverpassQuery(bbox: string): string {
  const re = OSM_SHOP_TYPES.join('|');
  return `[out:json][timeout:120][bbox:${bbox}];(node["shop"~"${re}"];way["shop"~"${re}"];);out center tags;`;
}

export function osmElementToLead(el: OsmElement, now: string): Lead | null {
  const t = el.tags ?? {};
  if (!t.name) return null;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
  const direccion = [street, t['addr:city']].filter(Boolean).join(', ');
  return {
    razonSocial: t.name,
    nombreFantasia: t.name,
    telefono: t.phone ?? t['contact:phone'] ?? '',
    email: t.email ?? t['contact:email'] ?? '',
    cuit: '',
    sitioWeb: t.website ?? t['contact:website'] ?? '',
    direccion,
    localidad: t['addr:city'] ?? '',
    provincia: 'Buenos Aires',
    categoria: SHOP_ES[t.shop] ?? t.shop ?? '',
    calificacionGoogle: '',
    cantidadResenas: '',
    instagram: '',
    facebook: '',
    whatsapp: '',
    coordenadas: lat != null && lon != null ? `${lat},${lon}` : '',
    fuente: 'OpenStreetMap',
    fechaExtraccion: now,
  };
}

type FetchFn = (url: string, init: { method: string; body: URLSearchParams; headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export async function fetchOsmLeads(
  bbox: string,
  now: string,
  opts: { fetchFn?: FetchFn; retries?: number } = {},
): Promise<Lead[]> {
  const doFetch = (opts.fetchFn ?? (globalThis.fetch as unknown as FetchFn));
  const retries = opts.retries ?? 3;
  const query = buildOverpassQuery(bbox);
  let lastErr = '';
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await doFetch(ENDPOINT, {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
      headers: { 'User-Agent': 'maps-scraper/1.0 (research)' },
    });
    const body = await res.text();
    if (res.ok && body.trimStart().startsWith('{')) {
      const json = JSON.parse(body) as { elements: OsmElement[] };
      return json.elements
        .map((el) => osmElementToLead(el, now))
        .filter((l): l is Lead => l !== null);
    }
    lastErr = `intento ${attempt}: HTTP ${res.status}`;
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
  throw new Error(`Overpass falló tras ${retries} intentos (${lastErr})`);
}
