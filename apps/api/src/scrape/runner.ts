import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { RunJob } from './worker.js';

// STUB temporal: Task 6 reemplaza esta implementación por el runner real
// (spawn del scraper CLI + ingest). Los tests de este task inyectan
// `scrapeRunJob`, así que este stub nunca se ejecuta en la suite.
export const spawnScraperAndIngest = (_db: NodePgDatabase): RunJob => async () => {
  throw new Error('runner no implementado');
};
