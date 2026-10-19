/**
 * Interface copy and the app frame: disclaimers live only in Settings → About, the brand is
 * the app's own name, and the frame never depends on viewport-unit heights.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_NAME } from '../../src/config/branding';
import { DEFAULT_PROFILE } from '../../src/data/defaults';
import { aboutContent } from '../../src/features/settings/domain/aboutContent';
import { createMemoryStore } from '../../src/services/storage/keyValueStore';
import { loadValue } from '../../src/services/storage/persistedValue';
import { LEGACY_DEFAULT_SUBTITLE, profileSlice } from '../../src/services/storage/slices';

const SRC = path.resolve('src');

/** Every .ts/.tsx file under a directory. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

/** Source text without comments, so explanations for developers are not counted as UI copy. */
function codeOnly(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('Settings → About', () => {
  it('explains what the app is and that it does not sync with the official WEBTOP', () => {
    for (const mode of ['account', 'local'] as const) {
      const content = aboutContent(mode);
      expect(content.intro).toContain(`${APP_NAME} היא אפליקציה אישית ועצמאית`);
      expect(content.independence.join(' ')).toMatch(/אינה האפליקציה הרשמית של WEBTOP/);
      expect(content.independence.join(' ')).toMatch(/אינם מסתנכרנים עם מערכת WEBTOP הרשמית/);
    }
    expect(aboutContent('account').facts.join(' ')).toMatch(/לעולם אל תזינו כאן סיסמה של WEBTOP/);
    expect(aboutContent('local').facts.join(' ')).toMatch(/נשמרים רק במכשיר הזה/);
  });

  it('never calls the app WEBTOP', () => {
    expect(APP_NAME).not.toMatch(/WEBTOP/i);
  });
});

describe('regular interface copy', () => {
  // Wording that belongs in About only. Admin-panel copy and the About content are exempt;
  // the storage registry keeps the old default subtitle only to migrate it away.
  const DISCLAIMERS = /לא רשמי|לא־רשמי|אינה קשורה|אינו קשור|מסתנכרנ|סימולציה|גרסת הדגמה|במכשיר (?:הזה|זה) בלבד|מקום־שמור/;
  const EXEMPT = [
    path.join(SRC, 'features/settings/domain/aboutContent.ts'),
    path.join(SRC, 'services/storage/slices.ts'),
    path.join(SRC, 'features/adminPanel'),
  ];

  it('contains no disclaimers outside Settings → About', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !EXEMPT.some((exempt) => file.startsWith(exempt)))
      .filter((file) => DISCLAIMERS.test(codeOnly(file)))
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it('replaces the old default sidebar subtitle but keeps one the user wrote', () => {
    const envelope = (subtitle: string) =>
      JSON.stringify({ schemaVersion: 1, savedAt: '2026-01-01T00:00:00.000Z', data: { ...DEFAULT_PROFILE, subtitle } });
    const legacy = loadValue(createMemoryStore({ [profileSlice.key]: envelope(LEGACY_DEFAULT_SUBTITLE) }), profileSlice);
    expect(legacy).toMatchObject({ status: 'migrated', value: { subtitle: DEFAULT_PROFILE.subtitle } });
    expect(DEFAULT_PROFILE.subtitle).not.toMatch(/רשמי/);
    const own = loadValue(createMemoryStore({ [profileSlice.key]: envelope('שכבה י') }), profileSlice);
    expect(own).toMatchObject({ status: 'migrated', value: { subtitle: 'שכבה י' } });
  });
});

describe('app frame', () => {
  it('is pinned to the viewport box, never sized with vh/dvh units', () => {
    const css = readFileSync(path.join(SRC, 'app/App.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const shell = /\.shell\s*{([^}]*)}/.exec(css)?.[1] ?? '';
    expect(shell).toMatch(/position:\s*fixed/);
    expect(shell).toMatch(/inset:\s*0/);
    // In an iOS Home Screen app with a translucent status bar, WebKit resolves these units
    // to the screen minus the status bar, leaving an empty band under the frame.
    expect(shell).not.toMatch(/\d+(?:d|s|l)?vh/);
  });
});
