/**
 * כרטיס תלמיד → מערכת שעות: navigation from the side menu, back navigation, the measured
 * layout (both themes), tap-only day changes, and editing shared with the main timetable.
 */
import { expect, test, type Page } from '@playwright/test';
import { dayTable, openApp, tableDayHeader, touchDrag, unlockEditMode } from './helpers';

const PROFILE = { studentName: 'נועה לוי', subtitle: 'עותק אישי', className: "י' 1" };
const TOP_INSET = 62;
const BOTTOM_INSET = 34;
const IPHONE_INSETS = `:root:root { --safe-top: ${TOP_INSET}px; --safe-bottom: ${BOTTOM_INSET}px; }`;

/** Within half a pixel (collapsed table borders sit on half-pixel edges). */
const near = (actual: number | undefined, expected: number) => expect(Math.abs((actual ?? Number.NaN) - expected)).toBeLessThanOrEqual(0.5);

const row = (page: Page, period: number) => dayTable(page).locator('tbody tr').nth(period - 1);
const header = (page: Page) => page.getByRole('banner');

/** Opens the Student Card timetable from the side menu, as a student would. */
async function openFromMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'פתיחת תפריט' }).click();
  await page.getByRole('dialog', { name: 'תפריט ראשי' }).getByRole('button', { name: 'כרטיס תלמיד' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'כרטיס תלמיד' })).toBeVisible();
  await page.getByRole('navigation', { name: 'כרטיס תלמיד' }).getByRole('button', { name: 'מערכת שעות' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'מערכת שעות' })).toBeVisible();
}

test('side menu → כרטיס תלמיד → מערכת שעות, and the back arrow returns to the Student Card', async ({ page }) => {
  await openApp(page, '#/schedule/timetable', { profile: PROFILE });
  await openFromMenu(page);
  await expect(page).toHaveURL(/#\/student-card\/timetable$/);

  // Header: back arrow at the far right, title, export and alerts icons — no menu button.
  const bar = header(page);
  await expect(bar.getByRole('button')).toHaveCount(3);
  await expect(bar.getByRole('button', { name: 'פתיחת תפריט' })).toHaveCount(0);
  const barBox = await bar.boundingBox();
  const backBox = await bar.getByRole('button', { name: 'חזרה לכרטיס תלמיד' }).boundingBox();
  expect((barBox?.x ?? 0) + (barBox?.width ?? 0) - ((backBox?.x ?? 0) + (backBox?.width ?? 0))).toBeLessThanOrEqual(20);
  await expect(bar.getByRole('button', { name: 'ייצוא מערכת השעות' })).toBeVisible();
  await expect(bar.getByRole('button', { name: /התראות שינויים/ })).toBeVisible();

  // The student's name and their timetable.
  await expect(page.getByRole('region', { name: 'שם התלמיד/ה' })).toContainText('נועה לוי');
  await expect(dayTable(page).locator('tbody tr')).toHaveCount(13);

  // The menu marks the section as current.
  await bar.getByRole('button', { name: 'חזרה לכרטיס תלמיד' }).click();
  await expect(page).toHaveURL(/#\/student-card$/);
  await expect(page.getByRole('heading', { level: 1, name: 'כרטיס תלמיד' })).toBeVisible();
  await expect(page.getByTestId('student-name')).toHaveText('נועה לוי');
  // Back arrow went back through history: the browser's back now leaves the section.
  await page.goBack();
  await expect(page).toHaveURL(/#\/schedule\/timetable$/);
  await page.goForward();
  await page.getByRole('button', { name: 'פתיחת תפריט' }).click();
  await expect(page.getByRole('dialog', { name: 'תפריט ראשי' }).getByRole('button', { name: 'כרטיס תלמיד' })).toHaveAttribute('aria-current', 'page');
});

test('a direct link to the timetable screen still goes back to the Student Card', async ({ page }) => {
  await openApp(page, '#/student-card/timetable', { profile: PROFILE });
  await header(page).getByRole('button', { name: 'חזרה לכרטיס תלמיד' }).click();
  await expect(page).toHaveURL(/#\/student-card$/);
  await expect(page.getByRole('heading', { level: 1, name: 'כרטיס תלמיד' })).toBeVisible();
  // The old placeholder link opens the section too.
  await page.goto('#/page/student-card');
  await expect(page.getByRole('heading', { level: 1, name: 'כרטיס תלמיד' })).toBeVisible();
});

/** Opens the screen in a theme with iPhone insets and measures its bands (pt). */
async function measure(page: Page, theme: 'dark' | 'light') {
  await openApp(page, '#/student-card/timetable', { theme, profile: PROFILE });
  await page.addStyleTag({ content: IPHONE_INSETS });
  await page.getByRole('radio', { name: 'יום שלישי', exact: true }).click();
  return page.evaluate(() => {
    const box = (el: Element | null | undefined) => {
      const r = el?.getBoundingClientRect();
      return r ? { top: r.top, bottom: r.bottom } : null;
    };
    const panel = document.querySelector('[aria-labelledby="student-name-label"]');
    const field = panel?.firstElementChild;
    const dayBar = document.querySelector('[role="radiogroup"][aria-label="בחירת יום"]');
    const table = document.querySelector('table[aria-label^="מערכת שעות ליום"]');
    const scroll = document.querySelector('[data-testid="timetable-scroll"]');
    return {
      viewport: window.innerHeight,
      header: box(document.querySelector('header')),
      panel: box(panel),
      underline: field ? field.getBoundingClientRect().bottom : null,
      dayBar: box(dayBar),
      tableHeader: box(table?.querySelector('thead')),
      firstRow: box(table?.querySelector('tbody tr')),
      scroll: box(scroll),
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: matches the measured layout, scrolls to the last row and leaves no empty band`, async ({ page }) => {
    const m = await measure(page, theme);
    // Header 55pt under the status-bar inset; name card 66pt with its divider at 57.5pt;
    // 8pt gap; 58pt day bar; the table 10pt below it; header row 45pt; empty row 34pt + border.
    expect(m.header).toEqual({ top: TOP_INSET, bottom: TOP_INSET + 55 });
    expect(m.panel).toEqual({ top: TOP_INSET + 55, bottom: TOP_INSET + 121 });
    expect(m.underline).toBe(TOP_INSET + 55 + 58);
    expect(m.dayBar).toEqual({ top: TOP_INSET + 129, bottom: TOP_INSET + 187 });
    near(m.tableHeader?.top, TOP_INSET + 197);
    near(m.tableHeader?.bottom, TOP_INSET + 242);
    // An empty period: 34pt plus its 1px border (the reference's row pitch is 34.6pt).
    near((m.firstRow?.bottom ?? 0) - (m.firstRow?.top ?? 0), 35);
    // The timetable runs down to the home-indicator inset; nothing overflows sideways.
    expect(m.scroll?.bottom).toBe(m.viewport - BOTTOM_INSET);
    expect(m.horizontalOverflow).toBe(false);

    await page.getByTestId('timetable-scroll').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    const last = dayTable(page).locator('tbody tr').last();
    await expect(last).toContainText('13.');
    const lastBox = await last.boundingBox();
    expect((lastBox?.y ?? 0) + (lastBox?.height ?? 0)).toBeLessThanOrEqual(m.viewport - BOTTOM_INSET);
  });
}

test('both themes share one layout', async ({ browser }) => {
  const results = [];
  for (const theme of ['light', 'dark'] as const) {
    const page = await (await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3 })).newPage();
    results.push(await measure(page, theme));
    await page.context().close();
  }
  expect(results[0]).toEqual(results[1]);
});

test('only the day buttons change the day; swipes do nothing; empty periods are empty cells; colours are the subjects’', async ({ page }) => {
  await openApp(page, '#/student-card/timetable', { profile: PROFILE });
  await page.getByRole('radio', { name: 'יום שלישי', exact: true }).click();
  await expect(tableDayHeader(page)).toHaveText('שלישי');
  const box = await page.getByTestId('timetable-scroll').boundingBox();
  if (!box) throw new Error('no table');
  const centre = box.x + box.width / 2;
  for (const dx of [160, -160]) {
    await touchDrag(page, { x: centre - dx / 2, y: box.y + 150 }, { x: centre + dx / 2, y: box.y + 154 }, 4);
    await expect(tableDayHeader(page)).toHaveText('שלישי');
  }
  await page.getByRole('radio', { name: 'יום חמישי', exact: true }).click();
  await expect(tableDayHeader(page)).toHaveText('חמישי');

  // Period 13 is free on Thursday in the example data: a real, empty row.
  await expect(row(page, 13).locator('td')).toHaveText('שעה פנויה');
  await expect(row(page, 13).locator('td').getByRole('button')).toHaveCount(0);

  // Lesson cards keep their subject's colour edge, exactly as on the main timetable.
  await page.getByRole('radio', { name: 'יום שלישי', exact: true }).click();
  const edgeHere = await row(page, 2).locator('td > div').first().evaluate((el) => getComputedStyle(el).borderInlineStartColor);
  await page.goto('#/schedule/timetable');
  const edgeMain = await row(page, 2).locator('td > div').first().evaluate((el) => getComputedStyle(el).borderInlineStartColor);
  expect(edgeHere).toBe(edgeMain);
});

test('seven taps on its title edit the same timetable as the main screen', async ({ page }) => {
  await openApp(page, '#/student-card/timetable', { profile: PROFILE });
  await unlockEditMode(page, 'מערכת שעות');
  await page.getByRole('radio', { name: 'יום שלישי', exact: true }).click();
  await row(page, 1).getByRole('button', { name: /הוספת שיעור/ }).click();
  const sheet = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'בחירת מקצוע מתבנית' }) });
  await sheet.getByRole('radio', { name: 'היסטוריה', exact: true }).click();
  await sheet.getByRole('button', { name: 'שמירה' }).click();
  await expect(row(page, 1)).toContainText('היסטוריה');

  // The main timetable shows the same lesson: one timetable, two views.
  await page.goto('#/schedule/timetable');
  await page.getByRole('radio', { name: 'יום שלישי', exact: true }).click();
  await expect(row(page, 1)).toContainText('היסטוריה');
  await expect(row(page, 1)).toContainText('חדר: 103');
});
