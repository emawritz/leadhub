import { describe, it, expect, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { upsertLeads } from '../src/upsert.js';
import { leads } from '../src/schema.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_TEST });
const db = drizzle(pool);
const mk = (over = {}) => ({
  razonSocial: 'D', nombreFantasia: 'D', telefono: '', email: '', cuit: '', sitioWeb: '',
  direccion: 'Calle 1', localidad: '', provincia: '', categoria: '', calificacionGoogle: '',
  cantidadResenas: '0', instagram: '', facebook: '', whatsapp: '', coordenadas: '',
  fuente: 'Google Maps', fechaExtraccion: '2026-06-26T00:00:00.000Z', ...over,
});

beforeEach(async () => { await pool.query('TRUNCATE leads RESTART IDENTITY CASCADE'); });

describe('upsertLeads', () => {
  it('inserta nuevos', async () => {
    const r = await upsertLeads(db, [mk(), mk({ nombreFantasia: 'E', direccion: 'Calle 2' })]);
    expect(r.inserted).toBe(2);
  });
  it('no duplica y completa campos vacíos', async () => {
    await upsertLeads(db, [mk()]);
    const r = await upsertLeads(db, [mk({ email: 'nuevo@x.com' })]);
    expect(r.inserted).toBe(0);
    expect(r.updated).toBe(1);
    const { rows } = await pool.query("SELECT email FROM leads WHERE direccion='Calle 1'");
    expect(rows[0].email).toBe('nuevo@x.com');
  });
});
