import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createObjectCsvWriter } from 'csv-writer';
import type { Lead } from './types.js';

export const CSV_HEADER = [
  { id: 'razon_social', title: 'razon_social' },
  { id: 'nombre_fantasia', title: 'nombre_fantasia' },
  { id: 'telefono', title: 'telefono' },
  { id: 'email', title: 'email' },
  { id: 'cuit', title: 'cuit' },
  { id: 'sitio_web', title: 'sitio_web' },
  { id: 'direccion', title: 'direccion' },
  { id: 'localidad', title: 'localidad' },
  { id: 'provincia', title: 'provincia' },
  { id: 'categoria', title: 'categoria' },
  { id: 'calificacion_google', title: 'calificacion_google' },
  { id: 'cantidad_resenas', title: 'cantidad_resenas' },
  { id: 'instagram', title: 'instagram' },
  { id: 'facebook', title: 'facebook' },
  { id: 'whatsapp', title: 'whatsapp' },
  { id: 'coordenadas', title: 'coordenadas' },
  { id: 'fuente', title: 'fuente' },
  { id: 'fecha_extraccion', title: 'fecha_extraccion' },
];

export function leadToRow(lead: Lead): Record<string, string> {
  return {
    razon_social: lead.razonSocial,
    nombre_fantasia: lead.nombreFantasia,
    telefono: lead.telefono,
    email: lead.email,
    cuit: lead.cuit,
    sitio_web: lead.sitioWeb,
    direccion: lead.direccion,
    localidad: lead.localidad,
    provincia: lead.provincia,
    categoria: lead.categoria,
    calificacion_google: lead.calificacionGoogle,
    cantidad_resenas: lead.cantidadResenas,
    instagram: lead.instagram,
    facebook: lead.facebook,
    whatsapp: lead.whatsapp,
    coordenadas: lead.coordenadas,
    fuente: lead.fuente,
    fecha_extraccion: lead.fechaExtraccion,
  };
}

export async function writeCsv(leads: Lead[], path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const writer = createObjectCsvWriter({ path, header: CSV_HEADER });
  await writer.writeRecords(leads.map(leadToRow));
}
