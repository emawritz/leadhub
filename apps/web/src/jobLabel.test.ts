import { describe, it, expect } from 'vitest';
import { jobLabel } from './jobLabel.js';

describe('jobLabel', () => {
  it('queued/running/done/error', () => {
    expect(jobLabel({ status: 'queued' } as never)).toBe('En cola');
    expect(jobLabel({ status: 'running', done: 3, total: 10 } as never)).toBe('Corriendo 3/10');
    expect(jobLabel({ status: 'done', leadsFound: 12, inserted: 9 } as never)).toBe('Listo · 12 encontrados · 9 nuevos');
    expect(jobLabel({ status: 'error', error: 'x' } as never)).toBe('Error: x');
  });
});
