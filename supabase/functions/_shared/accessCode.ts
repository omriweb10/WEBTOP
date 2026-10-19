/**
 * Personal access codes: normalisation, generation, strength estimation and hashing.
 * Dependency-free and runtime-neutral (Deno Edge Functions, browsers, Node tests).
 * Codes are never stored: the database keeps HMAC-SHA256(pepper, normalised code), where
 * the pepper is an Edge Function secret, so a database leak alone cannot be brute-forced.
 */

/** Unambiguous characters for generated codes (no 0/O, 1/I/L). 31 symbols ≈ 4.95 bits each. */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const GENERATED_CODE_LENGTH = 12;
export const MIN_CODE_LENGTH = 6;
export const MAX_CODE_LENGTH = 64;
/** Codes below this many estimated bits are "weak" and need explicit admin override. */
export const WEAK_BELOW_BITS = 40;
export const STRONG_FROM_BITS = 55;

/**
 * Canonical form used for hashing: Unicode NFKC, upper-case, without spaces, dashes,
 * underscores or dots — so "abcd-efgh" and "ABCD EFGH" are the same code on an iPhone keyboard.
 */
export function normalizeAccessCode(input: string): string {
  return input.normalize('NFKC').toUpperCase().replace(/[\s\-_.]+/g, '');
}

/** Formats a normalised code in groups of four for display ("ABCD-EFGH-JKLM"). */
export function formatAccessCode(normalized: string): string {
  return normalized.match(/.{1,4}/g)?.join('-') ?? normalized;
}

/** Draws a uniformly random index in [0, max) without modulo bias. */
function randomIndex(max: number, random: (bytes: Uint8Array) => Uint8Array): number {
  const limit = 256 - (256 % max);
  for (;;) {
    const [byte] = random(new Uint8Array(1));
    if (byte !== undefined && byte < limit) return byte % max;
  }
}

/** Generates a random code (≈59 bits) using a cryptographically secure source. */
export function generateAccessCode(
  random: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes),
  length = GENERATED_CODE_LENGTH,
): string {
  let code = '';
  for (let i = 0; i < length; i += 1) code += CODE_ALPHABET[randomIndex(CODE_ALPHABET.length, random)];
  return code;
}

export type StrengthLevel = 'too_short' | 'weak' | 'fair' | 'strong';

export interface CodeStrength {
  bits: number;
  level: StrengthLevel;
  /** Hebrew explanations for the admin UI. */
  warnings: string[];
}

/** Size of the character pool a code appears to be drawn from. */
function poolSize(code: string): number {
  let pool = 0;
  if (/[0-9]/.test(code)) pool += 10;
  if (/[A-Z]/.test(code)) pool += 26;
  if (/[֐-׿]/.test(code)) pool += 27;
  if (/[^0-9A-Z֐-׿]/.test(code)) pool += 33;
  return Math.max(pool, 1);
}

/** True when the code is a run like "123456", "ABCDEF" or "654321". */
function isSequential(code: string): boolean {
  if (code.length < 4) return false;
  const deltas = new Set<number>();
  for (let i = 1; i < code.length; i += 1) deltas.add(code.charCodeAt(i) - code.charCodeAt(i - 1));
  return deltas.size === 1 && [...deltas].every((d) => Math.abs(d) <= 1);
}

/** True when the code is one short chunk repeated ("121212", "ABCABC"). */
function isRepeatedChunk(code: string): boolean {
  for (let size = 1; size <= code.length / 2; size += 1) {
    if (code.length % size === 0 && code.slice(0, size).repeat(code.length / size) === code) return true;
  }
  return false;
}

/**
 * Conservative strength estimate of a normalised code. Patterns (runs, repeats,
 * date-like or digits-only codes) are heavily penalised.
 */
export function estimateCodeStrength(normalized: string): CodeStrength {
  const warnings: string[] = [];
  if (normalized.length < MIN_CODE_LENGTH) {
    return { bits: 0, level: 'too_short', warnings: [`קוד חייב להכיל לפחות ${MIN_CODE_LENGTH} תווים`] };
  }
  let bits = normalized.length * Math.log2(poolSize(normalized));
  if (/^[0-9]+$/.test(normalized)) {
    warnings.push('קוד שמורכב מספרות בלבד קל לניחוש');
    if (normalized.length < 12) bits = Math.min(bits, 30);
  }
  if (isSequential(normalized)) {
    warnings.push('רצף עוקב (כמו 123456) קל מאוד לניחוש');
    bits = Math.min(bits, 10);
  }
  if (isRepeatedChunk(normalized)) {
    warnings.push('קוד שחוזר על עצמו קל מאוד לניחוש');
    bits = Math.min(bits, 12);
  }
  if (/^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$|^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(19|20)?\d{2}$/.test(normalized)) {
    warnings.push('קוד שנראה כמו תאריך קל לניחוש');
    bits = Math.min(bits, 16);
  }
  bits = Math.round(bits);
  const level: StrengthLevel = bits < WEAK_BELOW_BITS ? 'weak' : bits < STRONG_FROM_BITS ? 'fair' : 'strong';
  if (level === 'weak' && warnings.length === 0) warnings.push('הקוד קצר מדי — מומלץ 10 תווים או יותר, אותיות וספרות');
  return { bits, level, warnings };
}

/** Last two characters of the code, shown to the admin to tell codes apart. */
export function codeHint(normalized: string): string {
  return normalized.slice(-2);
}

/** HMAC-SHA256(pepper, message) as raw bytes. */
export async function hmacSha256(pepper: string, message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

/** Server-verifiable representation of a code (32 bytes). */
export function hashAccessCode(normalized: string, pepper: string): Promise<Uint8Array> {
  return hmacSha256(pepper, `access-code:v1:${normalized}`);
}

/** Bytes → PostgreSQL bytea hex literal ("\x…"), the format PostgREST accepts. */
export function toByteaHex(bytes: Uint8Array): string {
  return `\\x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
