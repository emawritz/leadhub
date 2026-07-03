import { makeDb } from '../../src/db/client.js';
import { config } from '../../src/config.js';
import { leads, accounts } from '../../src/db/schema.js';
import { hashPassword } from '../../src/auth/password.js';

export const testDbCtx = makeDb(config.databaseUrlTest);

export async function resetDb() {
  await testDbCtx.pool.query('TRUNCATE leads, accounts, export_logs, scrape_jobs RESTART IDENTITY CASCADE');
}

export async function seedLead(over: Partial<typeof leads.$inferInsert> = {}) {
  await testDbCtx.db.insert(leads).values({
    dedupKey: over.dedupKey ?? `k-${Math.round(Math.abs(Math.sin(Date.now()) * 1e9))}`,
    razonSocial: over.razonSocial ?? 'Distribuidora Test',
    nombreFantasia: over.nombreFantasia ?? 'Distribuidora Test',
    fuente: over.fuente ?? 'Google Maps',
    ...over,
  });
}

export async function seedAccount(email = 'client@test.com', pw = 'secreto123') {
  const [a] = await testDbCtx.db.insert(accounts)
    .values({ email, passwordHash: await hashPassword(pw), rol: 'client' }).returning();
  return a;
}
