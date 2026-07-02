import { buildApp } from './app.js';
import { config } from './config.js';
import { makeDb } from './db/client.js';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || config.jwtSecret === 'dev-change-me')) {
  console.error('JWT_SECRET no está configurado (o usa el valor por defecto inseguro) en producción. Abortando.');
  process.exit(1);
} else if (config.jwtSecret === 'dev-change-me') {
  console.warn('JWT_SECRET usa el valor por defecto de desarrollo. No usar en producción.');
}

const { db } = makeDb(config.databaseUrl);
const app = buildApp(db);
app.listen({ port: config.port, host: '0.0.0.0' })
  .then(() => console.log(`API on :${config.port}`))
  .catch((e) => { console.error(e); process.exit(1); });
