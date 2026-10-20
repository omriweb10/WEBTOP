/**
 * The app frame: it fills the whole screen in both themes, keeps the iPhone safe areas,
 * leaves no empty band under the timetable, and the timetable scrolls to its last row.
 */
import { expect, test, type Page } from '@playwright/test';
import { dayTable, openApp } from './helpers';

// iPhone 16 Pro in a Home Screen app: status-bar and home-indicator insets. Chromium has
// no notch, so the insets that env(safe-area-inset-*) would report are applied directly.
const TOP_INSET = 62;
const BOTTOM_INSET = 34;
const IPHONE_INSETS = `:root:root { --safe-top: ${TOP_INSET}px; --safe-bottom: ${BOTTOM_INSET}px; }`;

/** Opens the timetable in a theme with iPhone insets and measures the frame. */
async function measure(page: Page, theme: 'dark' | 'light') {
  await openApp(page, '#/schedule/timetable', { theme });
  await page.addStyleTag({ content: IPHONE_INSETS });
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? { top: box.top, bottom: box.bottom, height: box.height } : null;
    };
    return {
      viewport: window.innerHeight,
      shell: rect('#root > div:first-child'),
      header: rect('header'),
      scroll: rect('[data-testid="timetable-scroll"]'),
      documentHeight: document.documentElement.scrollHeight,
    };
  });
}

/** Scrolls the timetable to its end and returns where its last row ends. */
async function lastRowBottomAfterScrolling(page: Page): Promise<number> {
  await page.getByTestId('timetable-scroll').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  const lastRow = dayTable(page).getByRole('row').last();
  await expect(lastRow).toContainText('13.');
  const box = await lastRow.boundingBox();
  return (box?.y ?? 0) + (box?.height ?? 0);
}

for (const theme of ['dark', 'light'] as const) {
  test(`${theme}: the frame fills the screen and the timetable reaches its last row above the home indicator`, async ({ page }) => {
    const m = await measure(page, theme);
    // The frame covers the whole screen: nothing of the page background shows below it.
    expect(m.shell).toEqual({ top: 0, bottom: m.viewport, height: m.viewport });
    expect(m.documentHeight).toBeLessThanOrEqual(m.viewport);
    // The app bar starts right under the status-bar inset; the timetable ends right above
    // the home-indicator inset — no extra spacing in between.
    expect(m.header?.top).toBe(TOP_INSET);
    expect(m.scroll?.bottom).toBe(m.viewport - BOTTOM_INSET);

    // First row visible at the top, last row reachable and fully visible after scrolling.
    await expect(dayTable(page).getByRole('row').nth(1)).toBeInViewport();
    expect(await lastRowBottomAfterScrolling(page)).toBeLessThanOrEqual(m.viewport - BOTTOM_INSET);
  });
}

test('dark and light share the same frame and bottom layout', async ({ browser }) => {
  const results = [];
  for (const theme of ['dark', 'light'] as const) {
    const page = await (await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3 })).newPage();
    const { shell, header, scroll, documentHeight } = await measure(page, theme);
    // The tabs divider is 2pt in dark and 1pt in light (measured from the originals), so the
    // timetable's top differs by 1pt; everything from the frame to the bottom must match.
    results.push({ shell, header, scrollBottom: scroll?.bottom, documentHeight, lastRowBottom: await lastRowBottomAfterScrolling(page) });
    await page.context().close();
  }
  expect(results[0]).toEqual(results[1]);
});

test('installed app: the full-screen page rule never makes the page scroll, with or without a status-bar inset', async ({ page }) => {
  await openApp(page);
  // Chromium cannot run as an installed iOS app, so take the app's standalone-only rule
  // exactly as compiled and apply it directly.
  const standaloneCss = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSMediaRule && rule.conditionText.includes('display-mode: standalone')) {
          return Array.from(rule.cssRules, (inner) => inner.cssText).join('\n');
        }
      }
    }
    return '';
  });
  expect(standaloneCss).toMatch(/html\s*{\s*min-height: min\(100lvh,\s*calc\(100% \+ var\(--safe-top\)\)\);?\s*}/);
  await page.addStyleTag({ content: standaloneCss });

  // Opaque status bar (no top inset) and translucent status bar (62pt inset) on a viewport
  // that already fills the screen: the page is exactly the screen and cannot scroll.
  for (const inset of [0, TOP_INSET]) {
    await page.addStyleTag({ content: `:root:root { --safe-top: ${inset}px; --safe-bottom: ${BOTTOM_INSET}px; }` });
    const m = await page.evaluate(() => {
      window.scrollTo(0, 500);
      return {
        viewport: window.innerHeight,
        page: document.documentElement.scrollHeight,
        scrollY: window.scrollY,
        frameBottom: document.querySelector('#root > div:first-child')?.getBoundingClientRect().bottom,
      };
    });
    expect(m).toEqual({ viewport: m.viewport, page: m.viewport, scrollY: 0, frameBottom: m.viewport });
  }
});
