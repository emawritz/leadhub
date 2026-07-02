import { describe, it, expect } from 'vitest';
import { leadFiltersSchema } from '@leadhub/core';
import { buildLeadsQuery } from '../src/leads/query.js';
import { makeDb } from '../src/db/client.js';
import { config } from '../src/config.js';

const { db } = makeDb(config.databaseUrlTest);

describe('buildLeadsQuery', () => {
  it('sin filtros: sin WHERE, con LIMIT/OFFSET', () => {
    const f = leadFiltersSchema.parse({});
    const { rows } = buildLeadsQuery(db, f);
    const sql = rows.toSQL().sql.toLowerCase();
    expect(sql).toContain('limit');
    expect(sql).toContain('offset');
  });
  it('hasEmail + provincia agregan condiciones', () => {
    const f = leadFiltersSchema.parse({ hasEmail: true, provincia: ['Buenos Aires'] });
    const { rows } = buildLeadsQuery(db, f);
    const sql = rows.toSQL().sql.toLowerCase();
    expect(sql).toContain('has_email');
    expect(sql).toContain('provincia');
  });
  it('q usa full-text', () => {
    const f = leadFiltersSchema.parse({ q: 'mayorista' });
    const { rows } = buildLeadsQuery(db, f);
    expect(rows.toSQL().sql.toLowerCase()).toContain('search_tsv');
  });
});
