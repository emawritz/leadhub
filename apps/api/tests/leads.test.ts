import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { testDbCtx, resetDb, seedLead, seedAccount } from './helpers/db.js';

const app = buildApp(testDbCtx.db);
let token = '';

beforeAll(async () => { await app.ready(); });
beforeEach(async () => {
  await resetDb();
  await seedAccount();
  await seedLead({ dedupKey: 'a', nombreFantasia: 'Mayorista Uno', provincia: 'Buenos Aires', email: 'a@x.com' });
  await seedLead({ dedupKey: 'b', nombreFantasia: 'Ferretería Dos', provincia: 'Córdoba' });
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'client@test.com', password: 'secreto123' } });
  token = res.json().data.token;
});

describe('GET /leads', () => {
  it('401 sin token', async () => {
    const res = await app.inject({ method: 'GET', url: '/leads' });
    expect(res.statusCode).toBe(401);
  });
  it('lista con total', async () => {
    const res = await app.inject({ method: 'GET', url: '/leads', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.total).toBe(2);
  });
  it('filtra por provincia y hasEmail', async () => {
    const res = await app.inject({ method: 'GET', url: '/leads?provincia=Buenos Aires&hasEmail=true', headers: { authorization: `Bearer ${token}` } });
    expect(res.json().data.total).toBe(1);
    expect(res.json().data.items[0].nombreFantasia).toBe('Mayorista Uno');
  });
});

describe('GET /leads/facets', () => {
  it('devuelve provincias con conteo', async () => {
    const res = await app.inject({ method: 'GET', url: '/leads/facets', headers: { authorization: `Bearer ${token}` } });
    const provincias = res.json().data.provincia;
    expect(provincias).toContainEqual({ value: 'Buenos Aires', count: 1 });
  });
});
