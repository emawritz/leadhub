export interface Lead {
  razonSocial: string;
  nombreFantasia: string;
  telefono: string;
  email: string;
  cuit: string;
  sitioWeb: string;
  direccion: string;
  localidad: string;
  provincia: string;
  categoria: string;
  calificacionGoogle: string;
  cantidadResenas: string;
  instagram: string;
  facebook: string;
  whatsapp: string;
  coordenadas: string; // "LAT,LNG"
  fuente: 'Google Maps';
  fechaExtraccion: string; // ISO
}

export interface ScraperOptions {
  query: string;
  location: string;
  max: number;
  enrich: boolean;
  headed: boolean;
  delay: number;
  output?: string;
  resume: boolean;
  excludeChains: boolean;
}

export interface RawBusiness {
  mapsUrl: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  website: string;
  rating: string;
  reviews: string;
  coordinates: string;
}

export interface Socials {
  instagram: string;
  facebook: string;
  whatsapp: string;
}

export interface Enrichment extends Socials {
  email: string;
  cuit: string;
}
