import { describe, it, expect } from 'vitest';
import { isCaptcha } from '../src/scraper/captcha.js';

describe('isCaptcha', () => {
  it('detecta "unusual traffic"', () => {
    expect(isCaptcha('Our systems have detected unusual traffic')).toBe(true);
  });
  it('case-insensitive', () => {
    expect(isCaptcha('UNUSUAL TRAFFIC')).toBe(true);
  });
  it('false en títulos normales', () => {
    expect(isCaptcha('Restaurantes - Google Maps')).toBe(false);
  });
});
