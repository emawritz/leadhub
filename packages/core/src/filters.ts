import { z } from 'zod';

const boolish = z.union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true').optional();
const strArray = z.union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : [v])).optional();

export const leadFiltersSchema = z.object({
  q: z.string().trim().min(1).optional(),
  provincia: strArray,
  localidad: strArray,
  categoria: strArray,
  fuente: strArray,
  hasEmail: boolish,
  hasTelefono: boolish,
  hasWhatsapp: boolish,
  hasWeb: boolish,
  hasCuit: boolish,
  soloAlto: boolish,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).default(50).transform((v) => Math.min(v, 100)),
  sort: z.enum(['nombre', 'localidad', 'fecha', 'prioridad']).default('nombre'),
});

export type LeadFilters = z.infer<typeof leadFiltersSchema>;
