import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { applyTheme } from '../../src/theme/applyTheme';
import { CARD_TINTS, lessonCardBackground } from '../../src/theme/lessonCardColors';
import { resolveTheme } from '../../src/theme/resolveTheme';
import { DEFAULT_THEME_PREFERENCE, THEME_ATTRIBUTE, THEME_CHROME, THEME_STORAGE_KEY, type ThemePreference } from '../../src/theme/themeConfig';
import { mixHex, parseHex } from '../../src/utils/color';

/** Largest per-channel difference between two hex colours. */
function distance(a: string, b: string): number {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return Infinity;
  return Math.max(...x.map((v, i) => Math.abs(v - (y[i] ?? 0))));
}

describe('theme resolution', () => {
  it('follows the device only in system mode', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(DEFAULT_THEME_PREFERENCE).toBe('dark');
  });

  it('applies the attribute and the browser chrome', () => {
    const dom = new JSDOM('<!doctype html><html><head><meta name="theme-color" content="x"></head><body></body></html>');
    applyTheme('light', dom.window.document);
    const doc = dom.window.document;
    expect(doc.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    expect(doc.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(THEME_CHROME.light.themeColor);
    expect(doc.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('light');
    expect(doc.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content')).toBe('default');
    applyTheme('dark', doc);
    expect(doc.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content')).toBe('black-translucent');
  });
});

describe('lesson card colours', () => {
  it('keep the dark tint exactly as before theming', () => {
    for (const accent of ['#999a9d', '#1498fd', '#444cc1', '#f4490c', '#04b9d4', '#e50066', '#ffbe10', '#059f8b', '#92be43', '#259e3b']) {
      expect(lessonCardBackground(accent, 'dark')).toBe(mixHex(accent, '#191e29', 0.16));
    }
    expect(CARD_TINTS.dark).toEqual({ base: '#191e29', ratio: 0.16 });
  });

  it('match the pastel cards measured in the light reference screenshot', () => {
    // [accent, background sampled from the screenshot]
    const measured: Array<[string, string]> = [
      ['#1498fd', '#cfeafe'], // mathematics
      ['#ffbe10', '#fff2cc'], // education
      ['#f4490c', '#ffddcd'], // Hebrew
      ['#92be43', '#e8f2da'], // chemistry
    ];
    for (const [accent, sample] of measured) expect(distance(lessonCardBackground(accent, 'light'), sample)).toBeLessThanOrEqual(4);
    // The initial table from the brief, for subjects the screenshot does not show.
    const brief: Array<[string, string]> = [
      ['#444cc1', '#dcddf8'], // history
      ['#04b9d4', '#d2f1f5'], // Bible
      ['#059f8b', '#d2edea'], // physical education
      ['#259e3b', '#daeedc'], // biotechnology
      ['#999a9d', '#e4e5e8'], // English
    ];
    for (const [accent, value] of brief) expect(distance(lessonCardBackground(accent, 'light'), value)).toBeLessThanOrEqual(8);
  });
});

describe('index.html boot script', () => {
  const html = readFileSync(path.resolve('index.html'), 'utf8');
  const script = /<script>\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/.exec(html)?.[1] ?? '';

  /** Runs the boot script in a fresh document with a stored value and a device appearance. */
  function boot(stored: string | null, systemDark: boolean | null) {
    const dom = new JSDOM(html.replace(/<script type="module"[^>]*><\/script>/, ''), { url: 'https://app.test/WEBTOP/', runScripts: 'outside-only' });
    const { window } = dom;
    if (stored !== null) window.localStorage.setItem(THEME_STORAGE_KEY, stored);
    if (systemDark !== null) {
      Object.assign(window, { matchMedia: (query: string) => ({ matches: query.includes('dark') ? systemDark : !systemDark }) });
    }
    window.eval(script);
    const doc = window.document;
    const meta = (name: string) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content');
    return {
      theme: doc.documentElement.getAttribute(THEME_ATTRIBUTE),
      chrome: { themeColor: meta('theme-color'), colorScheme: meta('color-scheme'), statusBarStyle: meta('apple-mobile-web-app-status-bar-style') },
    };
  }

  it('uses the same key and attribute as the app', () => {
    expect(script).toContain(`'${THEME_STORAGE_KEY}'`);
    expect(script).toContain(`'${THEME_ATTRIBUTE}'`);
  });

  it('resolves every stored preference exactly like the app', () => {
    const envelope = (data: ThemePreference) => JSON.stringify({ schemaVersion: 1, savedAt: '', data });
    for (const preference of ['light', 'dark', 'system'] as const) {
      for (const systemDark of [true, false]) {
        const result = boot(envelope(preference), systemDark);
        const expected = resolveTheme(preference, systemDark);
        expect(result.theme).toBe(expected);
        expect(result.chrome).toEqual(THEME_CHROME[expected]);
      }
    }
    // Missing, corrupt or unknown values fall back to the default.
    for (const stored of [null, '{oops', JSON.stringify({ data: 'sepia' })]) {
      expect(boot(stored, false).theme).toBe(resolveTheme(DEFAULT_THEME_PREFERENCE, false));
    }
  });
});

describe('theme tokens', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? files(full) : full.endsWith('.css') ? [full] : [];
    });
  const css = files(path.resolve('src'));
  const defined = (file: string) => new Set([...readFileSync(file, 'utf8').matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const dark = defined(path.resolve('src/styles/themes/dark.css'));
  const light = defined(path.resolve('src/styles/themes/light.css'));
  const base = defined(path.resolve('src/styles/tokens.css'));

  it('light only overrides tokens the dark theme defines', () => {
    expect([...light].filter((token) => !dark.has(token))).toEqual([]);
  });

  it('every colour token a component uses is defined by the themes', () => {
    // Set inline by components or with an in-place fallback.
    const local = new Set(['--lesson-accent', '--icon-pressed', '--day-in-offset']);
    const missing = css.flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/var\((--[\w-]+)/g)]
        .map((m) => m[1] ?? '')
        .filter((token) => !dark.has(token) && !base.has(token) && !local.has(token))
        .map((token) => `${path.relative('src', file)}: ${token}`),
    );
    expect(missing).toEqual([]);
  });

  it('components contain no literal colours (only themes, print and neutral shadows do)', () => {
    const allowed = /themes\/|PrintableWeek|tokens\.css/;
    const literal = /#[0-9a-f]{3,8}\b|rgb\((?!0 0 0 \/|255 255 255 \/ 0\.(1|18|7)\))/i;
    const offenders = css
      .filter((file) => !allowed.test(file))
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .filter((line) => literal.test(line) && !/#f4490c/.test(line))
          .map((line) => `${path.relative('src', file)}: ${line.trim()}`),
      );
    expect(offenders).toEqual([]);
  });
});
