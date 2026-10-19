import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { dayTable, openApp, unlockEditMode } from './helpers';

const firstRow = (page: Page) => dayTable(page).locator('tbody tr').first();

test.describe('local data: import/export, notices and events', () => {
  test('exports a valid JSON backup', async ({ page }) => {
    await openApp(page);
    await unlockEditMode(page);
    await page.goto('#/admin');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ייצוא: גיבוי מלא' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^webtop-backup-all-\d{4}-\d{2}-\d{2}\.json$/);
    const json = JSON.parse(readFileSync(await file.path(), 'utf8'));
    expect(json.format).toBe('webtop-pwa-backup');
    expect(json.data.timetable.periods).toHaveLength(13);
    expect(json.data.presets.length).toBeGreaterThan(5);
  });

  test('invalid JSON is rejected and the existing schedule is untouched', async ({ page }) => {
    await openApp(page);
    await unlockEditMode(page);
    const before = await firstRow(page).textContent();
    await page.goto('#/admin');
    await page.getByTestId('import-input').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{ nope') });
    await expect(page.getByRole('alert')).toContainText('הקובץ אינו JSON תקין');
    const wrongShape = { format: 'webtop-pwa-backup', formatVersion: 1, exportedAt: '', appVersion: '1', data: { presets: [{ id: 'x' }] } };
    await page.getByTestId('import-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(wrongShape)) });
    await expect(page.getByRole('alert')).toContainText('הקובץ אינו תקין');
    await page.goto('#/schedule/timetable');
    expect(await firstRow(page).textContent()).toBe(before);
  });

  test('imports a valid backup after preview and confirmation', async ({ page }) => {
    await openApp(page);
    await unlockEditMode(page);
    const periods = Array.from({ length: 13 }, (_, i) => ({ number: i + 1, start: `${8 + i}:00`, end: `${8 + i}:45` }));
    const lesson = { id: 'imp_1', presetId: null, subject: 'מקצוע מיובא', teacher: 'מורה מיובא', room: '9', color: '#e50066' };
    const column = (first: unknown) => periods.map((_, i) => (i === 0 ? first : null));
    const backup = {
      format: 'webtop-pwa-backup',
      formatVersion: 1,
      exportedAt: '2026-10-19T08:00:00.000Z',
      appVersion: '1.0.0',
      data: {
        timetable: { periods, days: { sun: column(null), mon: column(lesson), tue: column(null), wed: column(null), thu: column(null) } },
        profile: { studentName: 'בדיקה', subtitle: 'שורה', className: "י' 9" },
      },
    };
    await page.goto('#/admin');
    await page.getByTestId('import-input').setInputFiles({ name: 'ok.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    const preview = page.getByRole('dialog', { name: 'תצוגה מקדימה לייבוא' });
    await expect(preview.getByLabel('מערכת השעות')).toBeChecked();
    await preview.getByRole('button', { name: 'ייבוא החלקים שנבחרו' }).click();
    await page.getByRole('dialog', { name: 'ייבוא נתונים' }).getByRole('button', { name: 'ייבוא' }).click();

    await page.goto('#/schedule/timetable');
    await expect(firstRow(page)).toContainText('מקצוע מיובא');
    await expect(dayTable(page).locator('tbody th').first()).toHaveText('1. 8:00‐8:45');
    await expect(page.getByRole('combobox', { name: 'תצוגה' })).toContainText("י' 9");
    await page.reload();
    await expect(firstRow(page)).toContainText('מורה מיובא');
  });

  test('notices and exams can be added, shown, persisted and removed', async ({ page }) => {
    await openApp(page);
    await unlockEditMode(page);
    await page.getByRole('tab', { name: 'שינויים והודעות' }).click();

    await page.getByRole('region', { name: 'שינויי מערכת' }).getByRole('button', { name: 'הוספה' }).click();
    const noticeForm = page.getByRole('dialog', { name: 'הודעה חדשה' });
    await noticeForm.getByLabel('כותרת').fill('שעה 3 מבוטלת');
    await noticeForm.getByLabel('תאריך (לא חובה)').fill('2026-10-19');
    await noticeForm.getByRole('button', { name: 'שמירה' }).click();
    await expect(page.getByRole('region', { name: 'שינויי מערכת' })).toContainText('שעה 3 מבוטלת');

    await page.getByRole('region', { name: 'מבחנים' }).getByRole('button', { name: 'הוספה' }).click();
    const examForm = page.getByRole('dialog', { name: 'מבחן חדש' });
    await examForm.getByLabel('כותרת').fill('מבחן במתמטיקה');
    await examForm.getByLabel('תאריך', { exact: true }).fill('2026-10-26');
    await examForm.getByRole('button', { name: 'שמירה' }).click();
    await expect(page.getByRole('region', { name: 'מבחנים' })).toContainText('מבחן במתמטיקה');

    await page.reload();
    await expect(page.getByRole('region', { name: 'שינויי מערכת' })).toContainText('שעה 3 מבוטלת');
    await page.getByRole('tab', { name: 'אירועים ומבחנים' }).click();
    await expect(page.getByText('מבחן במתמטיקה')).toBeVisible();

    // Change alerts: the bell surfaces today's change above the timetable.
    await page.getByRole('tab', { name: 'מערכת שעות' }).click();
    await page.getByRole('button', { name: 'הפעלת התראות שינויים' }).click();
    await expect(page.getByRole('button', { name: /שינוי אחד במערכת/ })).toBeVisible();

    await page.getByRole('tab', { name: 'שינויים והודעות' }).click();
    await page.getByRole('button', { name: 'מחיקת שעה 3 מבוטלת' }).click();
    await page.getByRole('dialog', { name: 'מחיקה' }).getByRole('button', { name: 'מחיקה' }).click();
    await expect(page.getByRole('region', { name: 'שינויי מערכת' })).toContainText('לא נמצאו נתונים במערכת.');
  });

  test('corrupted stored data is quarantined and reported instead of crashing', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('__corrupted')) {
        sessionStorage.setItem('__corrupted', '1');
        localStorage.setItem('webtop-pwa:timetable', '{"schemaVersion":1,"data":{"periods":"oops"}');
      }
    });
    await openApp(page);
    await expect(dayTable(page).locator('tbody tr')).toHaveCount(13);
    await expect(page.getByRole('alert')).toContainText('נשמר עותק גיבוי');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.some((k) => k.startsWith('webtop-pwa:timetable.corrupt.'))).toBe(true);
  });
});
