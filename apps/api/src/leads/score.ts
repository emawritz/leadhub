import { sql, type SQL } from 'drizzle-orm';
import { SCORE_WEIGHTS } from '@leadhub/core';
import { leads } from '../db/schema.js';

/** Expresión SQL del score de prioridad (0–100), construida desde SCORE_WEIGHTS. */
export function leadScoreSql(): SQL<number> {
  return sql<number>`(
    ${SCORE_WEIGHTS.telefono} * (${leads.hasTelefono})::int +
    ${SCORE_WEIGHTS.whatsapp} * (${leads.hasWhatsapp})::int +
    ${SCORE_WEIGHTS.email} * (${leads.hasEmail})::int +
    ${SCORE_WEIGHTS.web} * (${leads.hasWeb})::int +
    ${SCORE_WEIGHTS.redes} * ((${leads.instagram} <> '' OR ${leads.facebook} <> ''))::int +
    ${SCORE_WEIGHTS.cuit} * (${leads.hasCuit})::int +
    ${SCORE_WEIGHTS.fuenteGoogle} * ((${leads.fuente} = 'Google Maps'))::int
  )::int`;
}
