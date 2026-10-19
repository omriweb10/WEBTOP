/** Shared helpers for the end-to-end suite. */
import { expect, type Page } from '@playwright/test';

/** Monday 19 Oct 2026, 09:06 Israel time — the moment the reference recording was taken. */
export const FIXED_NOW = new Date('2026-10-19T09:06:00+03:00');

/** Collects uncaught page errors and console errors so tests can assert a clean console. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

/** Opens the app at a hash route with the clock frozen; optionally seeds storage first. */
export async function openApp(page: Page, hash = '#/schedule/timetable', seed?: Record<string, unknown>): Promise<void> {
  await page.clock.setFixedTime(FIXED_NOW);
  if (seed) {
    await page.addInitScript((entries) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      for (const [key, value] of Object.entries(entries)) {
        localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, savedAt: '', data: value }));
      }
    }, Object.fromEntries(Object.entries(seed).map(([k, v]) => [`webtop-pwa:${k}`, v])));
  }
  await page.goto(hash);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Performs the hidden gesture (7 rapid taps on the title) and enters the demo code. */
export async function unlockEditMode(page: Page, code = '581026'): Promise<void> {
  const title = page.getByRole('heading', { name: 'מ. שעות ושינויים' });
  for (let i = 0; i < 7; i += 1) await title.click({ delay: 10 });
  const dialog = page.getByRole('dialog', { name: 'מצב עריכה מקומי' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('קוד').fill(code);
  await dialog.getByRole('button', { name: 'כניסה' }).click();
}

/** The on-screen day table (the print-only week table is excluded). */
export function dayTable(page: Page) {
  return page.getByRole('table', { name: /מערכת שעות ליום/ });
}

/** Name of the day shown in the table header (e.g. "שני"). */
export function tableDayHeader(page: Page) {
  return dayTable(page).locator('thead th').nth(1);
}
