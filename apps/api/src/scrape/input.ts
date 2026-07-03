import { z } from 'zod';

export const scrapeInputSchema = z.object({
  query: z.string().trim().min(1),
  location: z.string().trim().min(1),
  max: z.coerce.number().int().min(1).transform(v => Math.min(v, 120)).default(40),
  enrich: z.boolean().default(true),
  excludeChains: z.boolean().default(true),
});

export type ScrapeInput = z.infer<typeof scrapeInputSchema>;
