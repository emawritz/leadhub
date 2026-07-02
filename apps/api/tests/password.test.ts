import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';

describe('password', () => {
  it('hashea y verifica correctamente', async () => {
    const h = await hashPassword('secreto123');
    expect(h).not.toBe('secreto123');
    expect(await verifyPassword(h, 'secreto123')).toBe(true);
    expect(await verifyPassword(h, 'otra')).toBe(false);
  });
});
