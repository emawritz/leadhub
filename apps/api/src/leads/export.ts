import { createObjectCsvStringifier } from 'csv-writer';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CSV_HEADER, leadToRow, type Lead, type LeadFilters } from '@leadhub/core';
import { buildLeadsQuery } from './query.js';

const EXPORT_CAP = 50_000;

export async function exportCsv(db: NodePgDatabase, f: LeadFilters): Promise<{ csv: string; count: number }> {
  const wide = { ...f, page: 1, pageSize: EXPORT_CAP };
  const { rows } = buildLeadsQuery(db, wide);
  const items = (await rows) as unknown as Lead[];
  const stringifier = createObjectCsvStringifier({ header: CSV_HEADER });
  const csv = stringifier.getHeaderString() + stringifier.stringifyRecords(items.map(leadToRow));
  return { csv, count: items.length };
}
