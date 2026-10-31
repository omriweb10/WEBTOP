/** Shared steps for the account-mode e2e tests (browser + the local stack). */
import { expect, type Locator, type Page } from '@playwright/test';
import { deflateSync, crc32 } from 'node:zlib';
import { env } from '../backend/helpers';

export { adminClient, createStudent, createUserPreset, env, sql, stackAvailable, uniqueDigits } from '../backend/helpers';

/** The on-screen day table (the print-only week table is excluded). */
export function dayTable(page: Page) {
  return page.getByRole('table', { name: /מערכת שעות ליום/ });
}

/** The visible day's period rows, in order (the header row excluded). */
export function periodRows(page: Page) {
  return dayTable(page).getByRole('row').filter({ has: page.getByRole('rowheader') });
}

/** The lesson card (or, in edit mode, the add button) in a period row. */
export function lessonCard(row: Locator) {
  return row.getByRole('cell').locator(':scope > *').first();
}

/** Signs in to the admin panel. */
export async function signInAdmin(page: Page): Promise<void> {
  await page.goto('#/admin');
  await page.getByLabel('אימייל').fill(env.admin.email);
  await page.getByLabel('סיסמה').fill(env.admin.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page.getByRole('heading', { name: 'משתמשים', level: 1 })).toBeVisible();
}

/** Opens the app and signs in with an access code; returns once the timetable shows. */
export async function signInStudent(page: Page, code: string): Promise<void> {
  await page.goto('./');
  await page.getByLabel('קוד גישה').fill(code);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page.getByRole('heading', { name: 'מ. שעות ושינויים' })).toBeVisible({ timeout: 15_000 });
}

/** Opens the hidden edit mode with seven taps on a screen's title (no code, no dialog). */
export async function unlockEditMode(page: Page, titleText = 'מ. שעות ושינויים'): Promise<void> {
  const title = page.getByRole('heading', { name: titleText, level: 1 });
  for (let i = 0; i < 7; i += 1) await title.click({ delay: 10 });
  await expect(page.getByRole('region', { name: 'מצב עריכה' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Builds a solid-colour RGB PNG in memory (for avatar uploads). */
export function solidPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => rgb).flat())]);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
