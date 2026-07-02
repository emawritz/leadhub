import { makeDb } from '../db/client.js';
import { config } from '../config.js';
import { accounts } from '../db/schema.js';
import { hashPassword } from '../auth/password.js';

const [email, password, nombre] = process.argv.slice(2);
if (!email || !password) { console.error('uso: seed:account <email> <password> [nombre]'); process.exit(1); }

const { db, pool } = makeDb(config.databaseUrl);
const passwordHash = await hashPassword(password);
await db.insert(accounts).values({ email, passwordHash, nombre: nombre ?? null, rol: 'client' })
  .onConflictDoUpdate({ target: accounts.email, set: { passwordHash } });
console.log(`Cuenta lista: ${email}`);
await pool.end();
