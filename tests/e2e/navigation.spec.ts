import { expect, test, type Page } from '@playwright/test';
import { dayTable, openApp, tableDayHeader, trackErrors } from './helpers';

/** Simulates a real one-finger touch drag through the Chrome DevTools Protocol. */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
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

test.describe('timetable view', () => {
  test('loads under /WEBTOP/ on today with all 13 periods and a clean console', async ({ page }) => {
    const errors = trackErrors(page);
    await openApp(page);
    await expect(page).toHaveURL(/\/WEBTOP\/#\/schedule\/timetable$/);
    await expect(page.getByRole('tab', { name: 'מערכת שעות' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('radio', { name: 'יום שני' })).toHaveAttribute('aria-checked', 'true');
    await expect(tableDayHeader(page)).toHaveText('שני');
    await expect(dayTable(page).locator('tbody tr')).toHaveCount(13);
    await expect(dayTable(page).locator('tbody th').first()).toHaveText('1. 8:00‐8:50');
    expect(errors).toEqual([]);
  });

  test('empty periods are real rows', async ({ page }) => {
    await openApp(page);
    await page.getByRole('radio', { name: 'יום ראשון' }).click();
    const rows = dayTable(page).locator('tbody tr');
    await expect(rows.nth(12).locator('td')).toHaveText('שעה פנויה');
    await expect(rows.nth(12).locator('th')).toHaveText('13. 18:25‐19:10');
  });

  test('day selector and horizontal swipes change the day; vertical drags only scroll', async ({ page }) => {
    await openApp(page);
    await page.getByRole('radio', { name: 'יום רביעי' }).click();
    await expect(tableDayHeader(page)).toHaveText('רביעי');

    const box = await page.getByTestId('timetable-scroll').boundingBox();
    if (!box) throw new Error('no scroll area');
    const mid = { x: box.x + box.width / 2, y: box.y + 200 };
    // RTL: dragging the finger to the right reveals the next day.
    await touchDrag(page, mid, { x: mid.x + 150, y: mid.y + 6 });
    await expect(tableDayHeader(page)).toHaveText('חמישי');
    await touchDrag(page, mid, { x: mid.x - 150, y: mid.y });
    await expect(tableDayHeader(page)).toHaveText('רביעי');

    // A vertical drag scrolls and must not switch days.
    await touchDrag(page, { x: mid.x, y: mid.y + 200 }, { x: mid.x + 20, y: mid.y - 150 });
    await expect(tableDayHeader(page)).toHaveText('רביעי');
    await expect.poll(() => page.getByTestId('timetable-scroll').evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });

  test('scroll-to-top button appears after scrolling and returns to the top', async ({ page }) => {
    await openApp(page);
    // Query by attribute: while hidden the button is (correctly) aria-hidden and has no role.
    const fab = page.locator('button[aria-label="חזרה לראש העמוד"]');
    await expect(fab).toHaveAttribute('aria-hidden', 'true');
    await page.getByTestId('timetable-scroll').evaluate((el) => el.scrollTo(0, 400));
    await expect(fab).toHaveAttribute('aria-hidden', 'false');
    await fab.click();
    await expect.poll(() => page.getByTestId('timetable-scroll').evaluate((el) => el.scrollTop)).toBe(0);
  });

  test('tabs switch and deep links open the right tab', async ({ page }) => {
    await openApp(page);
    await page.getByRole('tab', { name: 'שינויים והודעות' }).click();
    await expect(page).toHaveURL(/#\/schedule\/changes$/);
    await expect(page.getByRole('heading', { name: 'שינויי מערכת' })).toBeVisible();
    await page.getByRole('tab', { name: 'אירועים ומבחנים' }).click();
    await expect(page.getByRole('button', { name: 'תצוגת לוח חודשי' })).toBeVisible();

    await page.goto('#/schedule/events');
    await page.reload();
    await expect(page.getByRole('tab', { name: 'אירועים ומבחנים' })).toHaveAttribute('aria-selected', 'true');
  });

  test('sidebar opens, closes with Escape and the backdrop, and navigates', async ({ page }) => {
    await openApp(page);
    const menu = page.getByRole('dialog', { name: 'תפריט ראשי' });
    await page.getByRole('button', { name: 'פתיחת תפריט' }).click();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'מ. שעות ושינויים' })).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    await page.getByRole('button', { name: 'פתיחת תפריט' }).click();
    await page.mouse.click(20, 400); // backdrop (left of the right-side drawer)
    await expect(menu).toBeHidden();

    await page.getByRole('button', { name: 'פתיחת תפריט' }).click();
    await menu.getByRole('button', { name: 'ריכוז מידע' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'ריכוז מידע' })).toBeVisible();
    await expect(page.getByText('יום שני | 19/10/2026 | ח׳ חשוון תשפ״ז')).toBeVisible();

    await page.getByRole('button', { name: 'פתיחת תפריט' }).click();
    await menu.getByRole('button', { name: 'ספר טלפונים' }).click();
    await expect(page.getByRole('heading', { name: 'המסך הזה עדיין לא זמין' })).toBeVisible();
    await expect(page.getByText(/WEBTOP|רשמי/)).toHaveCount(0);
  });

  test('Settings → About explains the app is independent and does not sync with WEBTOP', async ({ page }) => {
    await openApp(page, '#/settings');
    const about = page.getByRole('region', { name: 'אודות' });
    await expect(about).toContainText('מערכת שעות היא אפליקציה אישית ועצמאית');
    await expect(about).toContainText('זו אינה האפליקציה הרשמית של WEBTOP');
    await expect(about).toContainText('אינם מסתנכרנים עם מערכת WEBTOP הרשמית');
    await expect(about).toContainText('נשמרים רק במכשיר הזה');
    // The persistent-storage controls moved into About with the storage explanation.
    await expect(page.getByRole('region', { name: 'שמירת נתונים' })).toHaveCount(0);
  });

  test('regular screens carry no disclaimers; the brand is the app’s own name', async ({ page }) => {
    const disclaimer = /לא רשמי|לא־רשמי|אינה קשורה|אינו קשור|מסתנכרנ|במכשיר (?:הזה|זה) בלבד|מקום־שמור/;
    await openApp(page);
    await expect(page.locator('body')).not.toContainText(disclaimer);
    await page.getByRole('button', { name: 'פתיחת תפריט' }).click();
    const menu = page.getByRole('dialog', { name: 'תפריט ראשי' });
    await expect(menu).toContainText('מערכת שעות');
    await expect(menu).not.toContainText(disclaimer);
    await expect(menu).not.toContainText('WEBTOP');
    await page.keyboard.press('Escape');
    for (const hash of ['#/schedule/changes', '#/schedule/events', '#/home']) {
      await page.goto(hash);
      await expect(page.locator('body')).not.toContainText(disclaimer);
    }
  });

  test('no simulated iOS status bar or recording indicator is rendered', async ({ page }) => {
    await openApp(page);
    const header = await page.locator('header').first().boundingBox();
    // Nothing visible may be drawn above the app bar (that area belongs to iOS).
    const above = await page.evaluate((top) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const hits: string[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim();
        if (!text || !node.parentElement) continue;
        const rect = node.parentElement.getBoundingClientRect();
        if (rect.height > 0 && rect.bottom <= top && getComputedStyle(node.parentElement).visibility !== 'hidden') hits.push(text);
      }
      return hits;
    }, header?.y ?? 0);
    expect(above).toEqual([]);
    await expect(page.getByText(/^\d{1,2}:\d{2}$/)).toHaveCount(0);
  });
});
