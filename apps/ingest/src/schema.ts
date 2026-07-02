import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';

// Copia de las columnas INSERTABLES de la tabla `leads` (apps/api/src/db/schema.ts).
// Las columnas generadas (has_*, search_tsv) NO se incluyen: se calculan en Postgres.
// Se duplica intencionalmente para evitar una dependencia apps→apps (ver Task 11 brief).
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  dedupKey: text('dedup_key').notNull().unique(),
  razonSocial: text('razon_social').notNull(),
  nombreFantasia: text('nombre_fantasia').notNull(),
  telefono: text('telefono').default('').notNull(),
  email: text('email').default('').notNull(),
  cuit: text('cuit').default('').notNull(),
  sitioWeb: text('sitio_web').default('').notNull(),
  direccion: text('direccion').default('').notNull(),
  localidad: text('localidad').default('').notNull(),
  provincia: text('provincia').default('').notNull(),
  categoria: text('categoria').default('').notNull(),
  calificacionGoogle: text('calificacion_google').default('').notNull(),
  cantidadResenas: integer('cantidad_resenas').default(0).notNull(),
  instagram: text('instagram').default('').notNull(),
  facebook: text('facebook').default('').notNull(),
  whatsapp: text('whatsapp').default('').notNull(),
  coordenadas: text('coordenadas').default('').notNull(),
  fuente: text('fuente').notNull(),
  fechaExtraccion: timestamp('fecha_extraccion', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
