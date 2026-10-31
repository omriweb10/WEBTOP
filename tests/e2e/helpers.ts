/** Shared helpers for the end-to-end suite. */
import { expect, type Locator, type Page } from '@playwright/test';

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

/** Performs the hidden gesture (7 rapid taps on the title), which opens edit mode at once. */
export async function unlockEditMode(page: Page, titleText = 'מ. שעות ושינויים'): Promise<void> {
  const title = page.getByRole('heading', { name: titleText, level: 1 });
  for (let i = 0; i < 7; i += 1) await title.click({ delay: 10 });
  await expect(page.getByRole('region', { name: 'מצב עריכה' })).toBeVisible();
}

/** The on-screen day table (the print-only week table is excluded). */
export function dayTable(page: Page) {
  return page.getByRole('table', { name: /מערכת שעות ליום/ });
}

/** Name of the day shown in the table header (e.g. "שני"). */
export function tableDayHeader(page: Page) {
  return dayTable(page).getByRole('columnheader').nth(1);
}

/** The visible day's period rows, in order (the header row excluded). */
export function periodRows(page: Page) {
  return dayTable(page).getByRole('row').filter({ has: page.getByRole('rowheader') });
}

/** The lesson card (or, in edit mode, the add button) in a period row. */
export function lessonCard(row: Locator) {
  return row.getByRole('cell').locator(':scope > *').first();
}

/** Simulates a real one-finger touch drag through the Chrome DevTools Protocol. */
export async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let i = 1; i <= steps; i += 1) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
