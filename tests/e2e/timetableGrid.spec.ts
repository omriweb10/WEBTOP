/**
 * The day timetable as Webtop builds it (measured from its DOM at a 393px viewport): a CSS
 * grid of 25% times | 75% lessons, a 45px sticky #EFF2F7 header, 34.5333px empty periods,
 * and 4px-margin/padding/radius cards on 12px/18px text — at 360, 393 and 430px, without
 * horizontal overflow, in both themes.
 */
import { expect, test, type Page } from '@playwright/test';
import { dayTable, lessonCard, openApp, periodRows, tableDayHeader } from './helpers';

const WIDTHS = [
  { width: 360, height: 800 },
  { width: 393, height: 852 },
  { width: 430, height: 932 },
] as const;

/** Within `tolerance` px. */
const near = (actual: number, expected: number, tolerance = 0.5) => expect(Math.abs(actual - expected), `${actual} ≈ ${expected}`).toBeLessThanOrEqual(tolerance);

/** Opens Tuesday (lessons in periods 2–6, consecutive ones in 2–3) at a phone size. */
async function openAt(page: Page, theme: 'light' | 'dark') {
  await openApp(page, '#/schedule/timetable', { theme });
  await page.getByRole('radio', { name: 'יום שלישי', exact: true }).click();
  await expect(tableDayHeader(page)).toHaveText('שלישי');
}

/** Geometry and styles of the grid, its rows, cells and cards. */
async function measureGrid(page: Page) {
  return dayTable(page).evaluate((grid) => {
    const box = (el: Element) => el.getBoundingClientRect();
    const rows = [...grid.querySelectorAll('[role="row"]')];
    const header = rows[0] as HTMLElement;
    const headCell = header.firstElementChild as HTMLElement;
    const headStyle = getComputedStyle(headCell);
    const periods = rows.slice(1).map((row) => {
      const time = row.querySelector('[role="rowheader"]') as HTMLElement;
      const cell = row.querySelector('[role="cell"]') as HTMLElement;
      const card = cell.firstElementChild instanceof HTMLDivElement ? cell.firstElementChild : null;
      const range = document.createRange();
      range.selectNodeContents(time);
      const text = range.getBoundingClientRect();
      return {
        height: box(row).height,
        time: box(time).width,
        cell: box(cell).width,
        labelInside: text.left >= box(time).left - 0.01 && text.right <= box(time).right + 0.01,
        card: card
          ? (() => {
              const c = box(card);
              const s = getComputedStyle(card);
              const subject = getComputedStyle(card.firstElementChild as Element);
              return {
                inset: [c.top - box(cell).top, box(cell).right - c.right, box(cell).bottom - c.bottom, c.left - box(cell).left],
                padding: s.padding,
                radius: s.borderTopLeftRadius,
                fontSize: s.fontSize,
                lineHeight: s.lineHeight,
                subjectWeight: subject.fontWeight,
                edge: s.borderRightColor,
                edgeWidth: s.borderRightWidth,
                background: s.backgroundColor,
                overflows: card.scrollWidth > card.clientWidth,
              };
            })()
          : null,
      };
    });
    const scroll = grid.closest('[data-testid="timetable-scroll"]') as HTMLElement;
    return {
      viewport: window.innerWidth,
      gridWidth: box(grid).width,
      header: {
        height: box(header).height,
        background: headStyle.backgroundColor,
        padding: headStyle.padding,
        fontSize: headStyle.fontSize,
        fontWeight: headStyle.fontWeight,
        textAlign: headStyle.textAlign,
        position: getComputedStyle(header).position,
      },
      display: getComputedStyle(rows[1] as Element).display,
      columns: getComputedStyle(rows[1] as Element).gridTemplateColumns,
      periods,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      scrollOverflow: scroll.scrollWidth - scroll.clientWidth,
    };
  });
}

/** rgb() → [r, g, b]. */
const rgb = (css: string) => (css.match(/\d+/g) ?? []).slice(0, 3).map(Number);

for (const size of WIDTHS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${size.width}px ${theme}: Webtop's grid, rows and cards, with no horizontal overflow`, async ({ browser }) => {
      const page = await (await browser.newContext({ viewport: size, deviceScaleFactor: 3, locale: 'he-IL' })).newPage();
      await openAt(page, theme);
      const m = await measureGrid(page);

      // Full width minus the 16px gutters (361px at 393 — Webtop measures 361.07), 25% | 75%.
      near(m.gridWidth, size.width - 32);
      expect(m.display).toBe('grid');
      for (const period of m.periods) {
        near(period.time, m.gridWidth * 0.25);
        near(period.cell, m.gridWidth * 0.75);
        expect(period.labelInside).toBe(true);
      }

      // Header: 45px, 8px 4px padding, bold 12px centred, sticky; Webtop's #EFF2F7 in light.
      expect(m.header).toMatchObject({ height: 45, padding: '8px 4px', fontSize: '12px', fontWeight: '700', textAlign: 'center', position: 'sticky' });
      if (theme === 'light') expect(m.header.background).toBe('rgb(239, 242, 247)');

      // 13 periods; empty ones 34.5333px; lesson rows as tall as their card (3 lines = 70px).
      expect(m.periods).toHaveLength(13);
      for (const period of m.periods) {
        if (!period.card) near(period.height, 34.5333, 0.01);
        else near(period.height, 70);
      }

      // Cards: 4px margin, padding and radius, 12px/18px, bold subject, coloured right edge,
      // the subject colour at 20% over the white cell in light mode; never wider than the cell.
      const cards = m.periods.flatMap((period) => (period.card ? [period.card] : []));
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        for (const side of card.inset) near(side, 4, 0.05);
        expect(card).toMatchObject({ padding: '4px', radius: '4px', fontSize: '12px', lineHeight: '18px', subjectWeight: '700', edgeWidth: '4px', overflows: false });
        if (theme === 'light') {
          const expected = rgb(card.edge).map((c) => Math.round(c * 0.2 + 255 * 0.8));
          rgb(card.background).forEach((c, i) => near(c, expected[i] ?? -1, 1));
        }
      }
      expect(m.pageOverflow).toBe(0);
      expect(m.scrollOverflow).toBe(0);
    });
  }
}

test('the header stays at the top while the lessons scroll', async ({ page }) => {
  await openAt(page, 'light');
  const scroll = page.getByTestId('timetable-scroll');
  await scroll.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(45);
  const offset = await page.evaluate(() => {
    const header = document.querySelector('[role="table"] [role="row"]') as Element;
    return header.getBoundingClientRect().top - (document.querySelector('[data-testid="timetable-scroll"]') as Element).getBoundingClientRect().top;
  });
  expect(offset).toBe(0);
  await expect(tableDayHeader(page)).toBeInViewport();
});

test('consecutive lessons stay separate cards; every school day has 13 periods', async ({ page }) => {
  await openAt(page, 'light');
  // Tuesday periods 2 and 3 hold the same subject: two cards, 8px apart (4px margins).
  const second = await lessonCard(periodRows(page).nth(1)).boundingBox();
  const third = await lessonCard(periodRows(page).nth(2)).boundingBox();
  expect(await lessonCard(periodRows(page).nth(1)).textContent()).toBe(await lessonCard(periodRows(page).nth(2)).textContent());
  near((third?.y ?? 0) - ((second?.y ?? 0) + (second?.height ?? 0)), 8);

  for (const day of ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי']) {
    await page.getByRole('radio', { name: `יום ${day}`, exact: true }).click();
    await expect(tableDayHeader(page)).toHaveText(day);
    await expect(periodRows(page)).toHaveCount(13);
    await expect(dayTable(page).getByRole('columnheader')).toHaveCount(2);
  }
});
