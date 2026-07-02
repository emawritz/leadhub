import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { Lead } from '@leadhub/core';
import { upsertLeads } from './upsert.js';

const idx = process.argv.indexOf('--input');
const file = idx >= 0 ? process.argv[idx + 1] : '';
if (!file) { console.error('uso: ingest --input <archivo.json>'); process.exit(1); }

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
const leads = JSON.parse(await readFile(file, 'utf8')) as Lead[];
const r = await upsertLeads(db, leads);
console.log(`Ingesta: ${r.inserted} insertados, ${r.updated} actualizados (${leads.length} entrada)`);
await pool.end();
