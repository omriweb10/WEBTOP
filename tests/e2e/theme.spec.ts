import { expect, test, type Locator, type Page } from '@playwright/test';
import { dayTable, lessonCard, openApp, periodRows } from './helpers';

/** Computed style property of the first matching element. */
const css = (locator: Locator, property: string) => locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);

/** The lesson card in a period row (1-based) of the visible day. */
const card = (page: Page, period: number) => lessonCard(periodRows(page).nth(period - 1));

/** WCAG contrast ratio between two "rgb(r, g, b)" colours. */
function contrast(a: string, b: string): number {
  const lum = (rgb: string) => {
    const [r, g, bl] = (rgb.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (bl ?? 0);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** Picks a theme in Settings → מראה. */
async function chooseTheme(page: Page, label: 'בהיר' | 'כהה' | 'לפי המכשיר'): Promise<void> {
  await page.goto('#/settings');
  await page.getByRole('radiogroup', { name: 'ערכת נושא' }).getByRole('radio', { name: label }).click();
}

test.describe('themes', () => {
  test('dark is the default and keeps the original colours', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await css(page.getByRole('banner'), 'background-color')).toBe('rgb(20, 38, 60)');
    // Monday period 1 is "חינוך" (#ffbe10): accent edge plus a 16% tint on the dark surface.
    expect(await css(card(page, 1), 'border-right-color')).toBe('rgb(255, 190, 16)');
    expect(await css(card(page, 1), 'background-color')).toBe('rgb(62, 56, 37)');
  });

  test('Light applies at once, matches the reference palette and survives a restart', async ({ page }) => {
    await openApp(page);
    await chooseTheme(page, 'בהיר');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.goto('#/schedule/timetable');

    const bar = page.getByRole('banner');
    expect(await css(bar, 'background-color')).toBe('rgb(29, 62, 97)');
    expect(await css(bar.getByRole('heading'), 'color')).toBe('rgb(255, 255, 255)');
    const activeTab = page.getByRole('tab', { name: 'מערכת שעות' });
    expect(await css(activeTab, 'color')).toBe('rgb(29, 62, 97)');
    expect(await css(page.getByRole('tablist'), 'background-color')).toBe('rgb(255, 255, 255)');
    const selectedDay = page.getByRole('radio', { name: 'יום שני', exact: true }).locator('span').first();
    expect(await css(selectedDay, 'background-color')).toBe('rgb(37, 168, 157)');
    expect(await css(selectedDay, 'color')).toBe('rgb(255, 255, 255)');
    expect(await css(dayTable(page).getByRole('columnheader').first(), 'background-color')).toBe('rgb(239, 242, 247)'); // Webtop's #EFF2F7

    // Same subject colour on the edge, pastel tint behind dark text.
    expect(await css(card(page, 1), 'border-right-color')).toBe('rgb(255, 190, 16)');
    expect(await css(card(page, 1), 'background-color')).toBe('rgb(255, 242, 207)');
    expect(await css(card(page, 2), 'background-color')).toBe('rgb(253, 219, 206)'); // לשון #f4490c

    // Empty periods stay plain white rows: no placeholder card outside edit mode.
    const emptyRow = periodRows(page).nth(8);
    await expect(emptyRow.getByRole('button')).toHaveCount(0);
    expect(await css(page.getByTestId('timetable-scroll'), 'background-color')).toBe('rgb(255, 255, 255)');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await css(page.getByRole('banner'), 'background-color')).toBe('rgb(29, 62, 97)');
  });

  test('the saved theme is applied before the app code runs (no flash)', async ({ browser }) => {
    // No service worker, so blocked bundles cannot be served from its cache.
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 402, height: 874 } });
    const page = await context.newPage();
    await page.goto('http://localhost:4173/WEBTOP/#/schedule/timetable');
    await chooseTheme(page, 'בהיר');
    // Block every script bundle: only the inline boot script can set the theme now.
    await page.route('**/assets/*.js', (route) => route.abort());
    await page.reload();
    await expect(page.locator('#root')).toBeEmpty();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await css(page.locator('html'), 'background-color')).toBe('rgb(246, 246, 246)');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f6f6f6');
    await context.close();
  });

  test('System follows the device appearance live, without reloading', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openApp(page);
    await chooseTheme(page, 'לפי המכשיר');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await chooseTheme(page, 'כהה');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('light mode text is readable everywhere on the timetable', async ({ page }) => {
    await openApp(page);
    await chooseTheme(page, 'בהיר');
    await page.goto('#/schedule/timetable');
    const pairs: Array<[Locator, Locator]> = [
      [page.getByRole('banner').getByRole('heading'), page.getByRole('banner')],
      [page.getByRole('tab', { name: 'שינויים והודעות' }), page.getByRole('tablist')],
      [dayTable(page).getByRole('columnheader').first(), dayTable(page).getByRole('columnheader').first()],
      [dayTable(page).getByRole('rowheader').first(), page.getByTestId('timetable-scroll')],
      [card(page, 1), card(page, 1)],
      [card(page, 4), card(page, 4)],
    ];
    for (const [text, background] of pairs) {
      const ratio = contrast(await css(text, 'color'), await css(background, 'background-color'));
      expect(ratio, await text.innerText()).toBeGreaterThanOrEqual(4.5);
    }
  });
});
