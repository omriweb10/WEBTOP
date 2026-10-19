import { describe, expect, it } from 'vitest';
import {
  CODE_ALPHABET,
  codeHint,
  estimateCodeStrength,
  formatAccessCode,
  generateAccessCode,
  hashAccessCode,
  normalizeAccessCode,
  toByteaHex,
} from '../../supabase/functions/_shared/accessCode.ts';

describe('access code rules', () => {
  it('normalises case, spaces, dashes and full-width characters', () => {
    expect(normalizeAccessCode(' abcd-efgh ijkl ')).toBe('ABCDEFGHIJKL');
    expect(normalizeAccessCode('ＡＢＣ１２３')).toBe('ABC123');
    expect(formatAccessCode('ABCDEFGHJKLM')).toBe('ABCD-EFGH-JKLM');
  });

  it('generates 12 unambiguous characters with a secure source', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateAccessCode()));
    expect(codes.size).toBe(200);
    for (const code of codes) {
      expect(code).toHaveLength(12);
      expect([...code].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
    }
    expect(estimateCodeStrength(generateAccessCode()).level).toBe('strong');
  });

  it('flags weak, patterned and short codes', () => {
    expect(estimateCodeStrength('12').level).toBe('too_short');
    expect(estimateCodeStrength('123456').level).toBe('weak');
    expect(estimateCodeStrength('904713').level).toBe('weak');
    expect(estimateCodeStrength('ABCDEFGH').level).toBe('weak');
    expect(estimateCodeStrength('XYXYXYXY').level).toBe('weak');
    expect(estimateCodeStrength('20261019').warnings.join()).toMatch(/תאריך/);
    expect(estimateCodeStrength('BLUEORBIT7319KIWI').level).toBe('strong');
  });

  it('hashes deterministically per pepper into 32 bytes', async () => {
    const a = await hashAccessCode('ABCDEFGHJKLM', 'pepper-1');
    const b = await hashAccessCode('ABCDEFGHJKLM', 'pepper-1');
    const c = await hashAccessCode('ABCDEFGHJKLM', 'pepper-2');
    expect(a).toHaveLength(32);
    expect(toByteaHex(a)).toBe(toByteaHex(b));
    expect(toByteaHex(a)).not.toBe(toByteaHex(c));
    expect(toByteaHex(new Uint8Array([0, 255]))).toBe('\\x00ff');
    expect(codeHint('ABCDEFGHJKLM')).toBe('LM');
  });
});
