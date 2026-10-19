/**
 * Validates any local, gitignored personal backup in private/*.private.json so a broken
 * file is caught before it is imported on the phone. Skipped when no such file exists
 * (always the case in CI, since private/ is never committed).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBackup } from '../../src/services/backup/backupService';

const dir = path.resolve('private');
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.private.json')) : [];

describe.skipIf(files.length === 0)('local private backups', () => {
  it.each(files)('%s is a valid import file', (file) => {
    const result = parseBackup(readFileSync(path.join(dir, file), 'utf8'));
    expect(result.ok ? 'valid' : result.error).toBe('valid');
  });
});
