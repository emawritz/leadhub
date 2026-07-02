import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { leadKey, type Lead } from '@leadhub/core';
import { leads } from './schema.js';

export async function upsertLeads(db: NodePgDatabase, input: Lead[]): Promise<{ inserted: number; updated: number }> {
  let inserted = 0, updated = 0;
  for (const l of input) {
    const dedupKey = leadKey(l.nombreFantasia, l.direccion);
    const values = {
      dedupKey, razonSocial: l.razonSocial, nombreFantasia: l.nombreFantasia,
      telefono: l.telefono, email: l.email, cuit: l.cuit, sitioWeb: l.sitioWeb,
      direccion: l.direccion, localidad: l.localidad, provincia: l.provincia, categoria: l.categoria,
      calificacionGoogle: l.calificacionGoogle, cantidadResenas: Number(l.cantidadResenas) || 0,
      instagram: l.instagram, facebook: l.facebook, whatsapp: l.whatsapp, coordenadas: l.coordenadas,
      fuente: l.fuente, fechaExtraccion: l.fechaExtraccion ? new Date(l.fechaExtraccion) : null,
    };
    const res = await db.insert(leads).values(values).onConflictDoUpdate({
      target: leads.dedupKey,
      // completa solo si el existente está vacío (no pisa datos buenos)
      set: {
        telefono: sql`CASE WHEN ${leads.telefono} = '' THEN excluded.telefono ELSE ${leads.telefono} END`,
        email: sql`CASE WHEN ${leads.email} = '' THEN excluded.email ELSE ${leads.email} END`,
        cuit: sql`CASE WHEN ${leads.cuit} = '' THEN excluded.cuit ELSE ${leads.cuit} END`,
        sitioWeb: sql`CASE WHEN ${leads.sitioWeb} = '' THEN excluded.sitio_web ELSE ${leads.sitioWeb} END`,
        instagram: sql`CASE WHEN ${leads.instagram} = '' THEN excluded.instagram ELSE ${leads.instagram} END`,
        facebook: sql`CASE WHEN ${leads.facebook} = '' THEN excluded.facebook ELSE ${leads.facebook} END`,
        whatsapp: sql`CASE WHEN ${leads.whatsapp} = '' THEN excluded.whatsapp ELSE ${leads.whatsapp} END`,
        updatedAt: sql`now()`,
      },
    }).returning({ inserted: sql<boolean>`(xmax = 0)` });
    if (res[0]?.inserted) inserted++; else updated++;
  }
  return { inserted, updated };
}
