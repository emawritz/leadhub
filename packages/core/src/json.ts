import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Lead } from './types.js';

export async function writeJson(leads: Lead[], path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(leads, null, 2), 'utf8');
}
