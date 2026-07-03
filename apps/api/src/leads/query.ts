import { and, inArray, eq, desc, asc, sql, getTableColumns } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { LeadFilters } from '@leadhub/core';
import { leads } from '../db/schema.js';
import { leadScoreSql } from './score.js';

function conditions(f: LeadFilters) {
  const c = [];
  if (f.q) c.push(sql`${leads.searchTsv} @@ plainto_tsquery('spanish', ${f.q})`);
  if (f.provincia?.length) c.push(inArray(leads.provincia, f.provincia));
  if (f.localidad?.length) c.push(inArray(leads.localidad, f.localidad));
  if (f.categoria?.length) c.push(inArray(leads.categoria, f.categoria));
  if (f.fuente?.length) c.push(inArray(leads.fuente, f.fuente));
  if (f.hasEmail) c.push(eq(leads.hasEmail, true));
  if (f.hasTelefono) c.push(eq(leads.hasTelefono, true));
  if (f.hasWhatsapp) c.push(eq(leads.hasWhatsapp, true));
  if (f.hasWeb) c.push(eq(leads.hasWeb, true));
  if (f.hasCuit) c.push(eq(leads.hasCuit, true));
  if (f.soloAlto) c.push(sql`${leadScoreSql()} >= 70`);
  return c.length ? and(...c) : undefined;
}

const SORTS = {
  nombre: [asc(leads.nombreFantasia), asc(leads.id)],
  localidad: [asc(leads.localidad), asc(leads.id)],
  fecha: [desc(leads.fechaExtraccion), asc(leads.id)],
  prioridad: [desc(leadScoreSql()), asc(leads.id)],
};

export function buildLeadsQuery(db: NodePgDatabase, f: LeadFilters) {
  const where = conditions(f);
  const offsetValue = (f.page - 1) * f.pageSize;
  // Drizzle omite la cláusula OFFSET cuando el valor es 0 (chequeo truthy interno).
  // Se envuelve en sql`` para forzar que la cláusula se emita siempre.
  const offsetSql = sql`${offsetValue}` as unknown as number;
  const rows = db.select({ ...getTableColumns(leads), score: leadScoreSql() }).from(leads).where(where)
    .orderBy(...SORTS[f.sort]).limit(f.pageSize).offset(offsetSql);
  const count = db.select({ n: sql<number>`count(*)::int` }).from(leads).where(where);
  return { rows, count };
}
