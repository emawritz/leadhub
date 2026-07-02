import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { testDbCtx, resetDb, seedLead, seedAccount } from './helpers/db.js';

const app = buildApp(testDbCtx.db);
let token = '';
beforeAll(async () => { await app.ready(); });
beforeEach(async () => {
  await resetDb(); await seedAccount();
  await seedLead({ dedupKey: 'a', nombreFantasia: 'Mayorista Uno', provincia: 'Buenos Aires', email: 'a@x.com' });
  await seedLead({ dedupKey: 'b', nombreFantasia: 'Ferretería Dos', provincia: 'Córdoba' });
  token = (await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'client@test.com', password: 'secreto123' } })).json().data.token;
});

describe('POST /leads/export', () => {
  it('devuelve CSV con header y filas filtradas', async () => {
    const res = await app.inject({ method: 'POST', url: '/leads/export?provincia=Buenos Aires', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const body = res.body;
    expect(body.split('\n')[0]).toContain('razon_social');
    expect(body).toContain('Mayorista Uno');
    expect(body).not.toContain('Ferretería Dos');
  });
  it('registra en export_logs', async () => {
    await app.inject({ method: 'POST', url: '/leads/export', headers: { authorization: `Bearer ${token}` } });
    const { rows } = await testDbCtx.pool.query('SELECT count(*)::int n FROM export_logs');
    expect(rows[0].n).toBe(1);
  });
});
