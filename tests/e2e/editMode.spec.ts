import { expect, test, type Page } from '@playwright/test';
import { dayTable, openApp, tableDayHeader, trackErrors, unlockEditMode } from './helpers';

/** Row (tr) of a period in the visible day table, 1-based. */
const row = (page: Page, period: number) => dayTable(page).locator('tbody tr').nth(period - 1);
/** The lesson editor sheet. */
const editor = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'בחירת מקצוע מתבנית' }) });

test.describe('hidden local edit mode', () => {
  test('normal view has no edit controls; six taps do nothing', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('region', { name: 'מצב עריכה' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /עריכת שעה/ })).toHaveCount(0);
    const title = page.getByRole('heading', { name: 'מ. שעות ושינויים' });
    for (let i = 0; i < 6; i += 1) await title.click({ delay: 10 });
    await expect(page.getByRole('region', { name: 'מצב עריכה' })).toHaveCount(0);
  });

  test('the seventh tap opens edit mode at once, with no code prompt; exit removes the editor UI', async ({ page }) => {
    const errors = trackErrors(page);
    await openApp(page);
    const title = page.getByRole('heading', { name: 'מ. שעות ושינויים' });
    for (let i = 0; i < 7; i += 1) await title.click({ delay: 10 });

    const bar = page.getByRole('region', { name: 'מצב עריכה' });
    await expect(bar).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await expect(bar).toContainText('במכשיר זה בלבד');
    await expect(page.getByRole('button', { name: /עריכת שעה 1/ })).toBeVisible();
    await bar.getByRole('button', { name: 'יציאה' }).click();
    await expect(bar).toHaveCount(0);
    await expect(page.getByRole('button', { name: /עריכת שעה/ })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a preset fills subject, teacher, room and colour in one action and persists after reload', async ({ page }) => {
    await openApp(page);
    await unlockEditMode(page);
    // Tuesday period 1 is empty in the example data.
    await page.getByRole('radio', { name: 'יום שלישי', exact: true }).click();
    await row(page, 1).getByRole('button', { name: /הוספת שיעור/ }).click();
    const sheet = editor(page);
    await sheet.getByRole('radio', { name: 'היסטוריה', exact: true }).click();
    await expect(sheet.getByLabel('מקצוע', { exact: true })).toHaveValue('היסטוריה');
    await expect(sheet.getByLabel('מורה', { exact: true })).toHaveValue('מורה להיסטוריה');
    await expect(sheet.getByLabel('חדר', { exact: true })).toHaveValue('103');
    await expect(sheet.getByRole('radio', { name: '#444cc1', exact: true })).toHaveAttribute('aria-checked', 'true');
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(row(page, 1)).toContainText('היסטוריה');
    await expect(row(page, 1)).toContainText('חדר: 103');

    await page.reload();
    await page.getByRole('radio', { name: 'יום שלישי', exact: true }).click();
    await expect(row(page, 1)).toContainText('מורה להיסטוריה');
  });

  test('custom field overrides do not change the preset', async ({ page }) => {
    await openApp(page);
    await unlockEditMode(page);
    await row(page, 1).getByRole('button').click();
    const sheet = editor(page);
    await sheet.getByLabel('חדר', { exact: true }).fill('מעבדה 7');
    await expect(sheet.getByText(/מותאם אישית/)).toBeVisible();
    await sheet.getByRole('button', { name: 'שמירה' }).click();
    await expect(row(page, 1)).toContainText('חדר: מעבדה 7');
    // The preset still has its original room.
    await row(page, 2).getByRole('button').click();
    await editor(page).getByRole('radio', { name: 'חינוך', exact: true }).click();
    await expect(editor(page).getByLabel('חדר', { exact: true })).toHaveValue('103');
  });

  test('lessons can be emptied and restored, duplicated, moved and deleted', async ({ page }) => {
    await openApp(page);
    await unlockEditMode(page);
    await page.getByRole('radio', { name: 'יום ראשון', exact: true }).click();

    // Lesson → empty period
    await row(page, 1).getByRole('button').click();
    await editor(page).getByRole('radio', { name: 'שעה ריקה', exact: true }).click();
    await editor(page).getByRole('button', { name: 'שמירה' }).click();
    await expect(row(page, 1).getByRole('button', { name: /הוספת שיעור/ })).toBeVisible();
    // …and back to a lesson
    await row(page, 1).getByRole('button').click();
    await editor(page).getByRole('radio', { name: 'לשון', exact: true }).click();
    await editor(page).getByRole('button', { name: 'שמירה' }).click();
    await expect(row(page, 1)).toContainText('לשון');

    // Duplicate period 6 (היסטוריה) into empty period 7
    await row(page, 6).getByRole('button').click();
    await editor(page).getByRole('button', { name: 'שכפול לשעה הבאה' }).click();
    await expect(row(page, 7)).toContainText('היסטוריה');

    // Move period 7 to Thursday period 9 (empty)
    await row(page, 7).getByRole('button').click();
    await editor(page).getByRole('button', { name: 'העברה / העתקה…' }).click();
    await editor(page).getByLabel('יום יעד').selectOption('thu');
    await editor(page).getByLabel('שעה', { exact: true }).selectOption('8');
    await editor(page).getByRole('button', { name: 'העברה לשעה שנבחרה' }).click();
    await expect(row(page, 7).getByRole('button', { name: /הוספת שיעור/ })).toBeVisible();
    await page.getByRole('radio', { name: 'יום חמישי', exact: true }).click();
    await expect(tableDayHeader(page)).toHaveText('חמישי');
    await expect(row(page, 9)).toContainText('היסטוריה');

    // Delete with confirmation
    await row(page, 9).getByRole('button').click();
    await editor(page).getByRole('button', { name: 'מחיקה (שעה ריקה)' }).click();
    await page.getByRole('dialog', { name: 'מחיקת שיעור' }).getByRole('button', { name: 'מחיקה' }).click();
    await expect(row(page, 9).getByRole('button', { name: /הוספת שיעור/ })).toBeVisible();

    // Undo from the toast restores it
    await page.getByRole('button', { name: 'ביטול' }).last().click();
    await expect(row(page, 9)).toContainText('היסטוריה');
  });

  test('editing a preset can update all its lessons, only after explicit confirmation', async ({ page }) => {
    await openApp(page);
    await unlockEditMode(page);
    await page.getByRole('region', { name: 'מצב עריכה' }).getByRole('button', { name: 'כלים' }).click();
    await page.getByRole('button', { name: 'עריכת מתמטיקה' }).click();
    const form = page.getByRole('dialog', { name: /עריכת תבנית/ });
    await form.getByLabel('מורה', { exact: true }).fill('מורה חדש');
    await form.getByLabel(/החלה על \d+ שיעורים/).selectOption('keep-custom');
    await form.getByRole('button', { name: 'שמירה' }).click();
    const confirmDialog = page.getByRole('dialog', { name: 'עדכון שיעורים קיימים' });
    await confirmDialog.getByRole('button', { name: 'ביטול' }).click();
    await expect(form).toBeVisible(); // nothing applied yet
    await form.getByRole('button', { name: 'שמירה' }).click();
    await confirmDialog.getByRole('button', { name: 'עדכון' }).click();

    await page.goto('#/schedule/timetable');
    await page.getByRole('radio', { name: 'יום ראשון', exact: true }).click();
    await expect(row(page, 1)).toContainText('מורה חדש');
  });

  test('reset requires confirmation and cancelling keeps the data', async ({ page }) => {
    await openApp(page);
    await unlockEditMode(page);
    await page.getByRole('radio', { name: 'יום שלישי', exact: true }).click();
    await row(page, 1).getByRole('button').click();
    await editor(page).getByRole('radio', { name: 'לשון', exact: true }).click();
    await editor(page).getByRole('button', { name: 'שמירה' }).click();

    await page.goto('#/tools');
    await page.getByRole('button', { name: 'איפוס מערכת השעות לדוגמה' }).click();
    const dialog = page.getByRole('dialog', { name: 'איפוס מערכת השעות לדוגמה' });
    await dialog.getByRole('button', { name: 'ביטול' }).click();
    await page.goto('#/schedule/timetable');
    await expect(row(page, 1)).toContainText('לשון');

    await page.goto('#/tools');
    await page.getByRole('button', { name: 'איפוס מערכת השעות לדוגמה' }).click();
    await dialog.getByRole('button', { name: 'איפוס' }).click();
    await page.goto('#/schedule/timetable');
    await expect(row(page, 1).getByRole('button', { name: /הוספת שיעור/ })).toBeVisible();
  });
});
