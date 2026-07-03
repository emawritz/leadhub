import { z } from 'zod';

const uuidSchema = z.string().uuid();

/** Devuelve true si `value` es un UUID válido. */
export function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}
