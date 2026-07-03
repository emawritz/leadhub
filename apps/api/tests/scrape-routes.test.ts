import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { testDbCtx, resetDb, seedAccount } from './helpers/db.js';
import type { RunJob } from '../src/scrape/worker.js';

const fakeRun: RunJob = async (_job, hooks) => {
  await hooks.onProgress({ phase: 'visit', done: 2, total: 2 });
  return { leadsFound: 2, inserted: 2, updated: 0 };
};
const app = buildApp(testDbCtx.db, { scrapeRunJob: fakeRun });
let token = '';

beforeAll(async () => { await app.ready(); });
beforeEach(async () => {
  await resetDb(); await seedAccount();
  token = (await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'client@test.com', password: 'secreto123' } })).json().data.token;
});

describe('POST /scrape', () => {
  it('401 sin token', async () => {
    const res = await app.inject({ method: 'POST', url: '/scrape', payload: { query: 'x', location: 'y' } });
    expect(res.statusCode).toBe(401);
  });
  it('crea un job y termina en done (runJob falso)', async () => {
    const res = await app.inject({ method: 'POST', url: '/scrape', headers: { authorization: `Bearer ${token}` }, payload: { query: 'farmacias', location: 'Lomas' } });
    expect(res.statusCode).toBe(200);
    const id = res.json().data.id;
    await vi.waitFor(async () => {
      const one = await app.inject({ method: 'GET', url: `/scrape/${id}`, headers: { authorization: `Bearer ${token}` } });
      expect(one.json().data.status).toBe('done');
      expect(one.json().data.leadsFound).toBe(2);
    });
  });
  it('400 con query vacía', async () => {
    const res = await app.inject({ method: 'POST', url: '/scrape', headers: { authorization: `Bearer ${token}` }, payload: { query: '', location: 'y' } });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /scrape', () => {
  it('lista los jobs', async () => {
    await app.inject({ method: 'POST', url: '/scrape', headers: { authorization: `Bearer ${token}` }, payload: { query: 'a', location: 'b' } });
    const res = await app.inject({ method: 'GET', url: '/scrape', headers: { authorization: `Bearer ${token}` } });
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });
});
