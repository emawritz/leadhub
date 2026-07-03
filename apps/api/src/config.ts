import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Este archivo compila a apps/api/dist/config.js, por lo que apps/api/.env
// está un nivel arriba de su directorio, independiente del cwd del proceso.
loadEnv({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseUrlTest: process.env.DATABASE_URL_TEST ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-change-me',
  port: Number(process.env.PORT ?? 3001),
};
