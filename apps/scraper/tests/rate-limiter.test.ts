import { describe, it, expect } from 'vitest';
import { jitter } from '../src/utils/rate-limiter.js';

describe('jitter', () => {
  it('rng=0 → base*0.8 (mínimo)', () => {
    expect(jitter(1000, () => 0)).toBe(800);
  });
  it('rng=1 → base*1.2 (máximo)', () => {
    expect(jitter(1000, () => 1)).toBeCloseTo(1200);
  });
  it('siempre dentro de [base*0.8, base*1.2]', () => {
    for (const r of [0.1, 0.5, 0.9]) {
      const v = jitter(2000, () => r);
      expect(v).toBeGreaterThanOrEqual(1600);
      expect(v).toBeLessThanOrEqual(2400);
    }
  });
});
