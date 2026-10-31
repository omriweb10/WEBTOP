import { expect, test } from '@playwright/test';
import { dayTable, openApp, periodRows, tableDayHeader, touchDrag, trackErrors } from './helpers';

test.describe('timetable view', () => {
  test('loads under /WEBTOP/ on today with all 13 periods and a clean console', async ({ page }) => {
    const errors = trackErrors(page);
    await openApp(page);
    await expect(page).toHaveURL(/\/WEBTOP\/#\/schedule\/timetable$/);
    await expect(page.getByRole('tab', { name: 'מערכת שעות' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('radio', { name: 'יום שני' })).toHaveAttribute('aria-checked', 'true');
    await expect(tableDayHeader(page)).toHaveText('שני');
    await expect(periodRows(page)).toHaveCount(13);
    await expect(dayTable(page).getByRole('rowheader').first()).toHaveText('1. 8:00‐8:50');
    expect(errors).toEqual([]);
  });

  test('empty periods are real rows', async ({ page }) => {
    await openApp(page);
    await page.getByRole('radio', { name: 'יום ראשון' }).click();
    const rows = periodRows(page);
    await expect(rows.nth(12).getByRole('cell')).toHaveText('שעה פנויה');
    await expect(rows.nth(12).getByRole('rowheader')).toHaveText('13. 18:25‐19:10');
  });

  test('swiping left or right never changes the day; only the day buttons do; vertical drags scroll', async ({ page }) => {
    await openApp(page);
    await page.getByRole('radio', { name: 'יום רביעי' }).click();
    await expect(tableDayHeader(page)).toHaveText('רביעי');
    const scroll = page.getByTestId('timetable-scroll');
    const box = await scroll.boundingBox();
    if (!box) throw new Error('no scroll area');
    const centre = box.x + box.width / 2;

    // Swipe right and left — short and long, slow and fast, over lessons and empty cells.
    const swipes: Array<[number, number, number]> = [
      [150, box.y + 200, 8],
      [-150, box.y + 200, 8],
      [300, box.y + 60, 3],
      [-300, box.y + 60, 3],
      [200, box.y + 420, 2],
      [-200, box.y + 420, 2],
    ];
    for (const [dx, y, steps] of swipes) {
      await touchDrag(page, { x: centre - dx / 2, y }, { x: centre + dx / 2, y: y + 4 }, steps);
      await expect(tableDayHeader(page)).toHaveText('רביעי');
      await expect(page.getByRole('radio', { name: 'יום רביעי' })).toHaveAttribute('aria-checked', 'true');
    }
    // Mouse/pen drags (pointer events) do nothing either.
    await page.mouse.move(centre - 120, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(centre + 120, box.y + 200, { steps: 8 });
    await page.mouse.up();
    await expect(tableDayHeader(page)).toHaveText('רביעי');

    // Nothing in the timetable listens for touch or pointer gestures at all.
    const cdp = await page.context().newCDPSession(page);
    const { result } = await cdp.send('Runtime.evaluate', { expression: 'document.querySelector(\'[data-testid="timetable-scroll"]\')' });
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId ?? '', depth: -1, pierce: true });
    await cdp.detach();
    expect(listeners.map((l) => l.type).filter((type) => /^(touch|pointer)/.test(type))).toEqual([]);

    // Tapping a day button changes the day.
    await page.getByRole('radio', { name: 'יום ראשון' }).click();
    await expect(tableDayHeader(page)).toHaveText('ראשון');
    await page.getByRole('radio', { name: 'יום חמישי' }).click();
    await expect(tableDayHeader(page)).toHaveText('חמישי');

    // A vertical drag scrolls natively and keeps the day.
    await touchDrag(page, { x: centre, y: box.y + 400 }, { x: centre + 20, y: box.y + 50 });
    await expect(tableDayHeader(page)).toHaveText('חמישי');
    await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
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
