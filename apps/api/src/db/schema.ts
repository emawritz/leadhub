import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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
export const EXTRA_SQL = sql``;
