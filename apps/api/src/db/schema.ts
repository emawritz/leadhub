import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

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
  // Columnas generadas por la migración de Task 5 (solo lectura, referenciadas para queries).
  hasEmail: boolean('has_email').notNull(),
  hasTelefono: boolean('has_telefono').notNull(),
  hasWhatsapp: boolean('has_whatsapp').notNull(),
  hasWeb: boolean('has_web').notNull(),
  hasCuit: boolean('has_cuit').notNull(),
  searchTsv: text('search_tsv'), // tsvector; se filtra vía sql`` (tipo aproximado)
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nombre: text('nombre'),
  rol: text('rol').default('client').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const exportLogs = pgTable('export_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  filtros: jsonb('filtros'),
  cantidad: integer('cantidad').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Columnas generadas + tsvector + índices se agregan por SQL crudo en la migración (Step 3).

export const scrapeJobs = pgTable('scrape_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  query: text('query').notNull(),
  location: text('location').notNull(),
  max: integer('max').notNull().default(40),
  enrich: boolean('enrich').notNull().default(true),
  excludeChains: boolean('exclude_chains').notNull().default(true),
  status: text('status').notNull().default('queued'),
  phase: text('phase').notNull().default(''),
  done: integer('done').notNull().default(0),
  total: integer('total').notNull().default(0),
  leadsFound: integer('leads_found').notNull().default(0),
  inserted: integer('inserted').notNull().default(0),
  updated: integer('updated').notNull().default(0),
  error: text('error').notNull().default(''),
  outputPath: text('output_path').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});
