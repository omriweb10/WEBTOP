import { expect, test } from '@playwright/test';
import { dayTable, openApp } from './helpers';

test.describe('PWA', () => {
  test('manifest, icons and iOS meta tags are served under /WEBTOP/', async ({ page, request }) => {
    await openApp(page);
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBe('/WEBTOP/manifest.webmanifest');
    const manifest = await (await request.get(manifestHref ?? '')).json();
    expect(manifest).toMatchObject({ display: 'standalone', scope: './', start_url: './', lang: 'he', dir: 'rtl' });
    for (const icon of manifest.icons as Array<{ src: string }>) {
      expect((await request.get(`/WEBTOP/${icon.src}`)).status()).toBe(200);
    }
    expect((await request.get('/WEBTOP/icons/apple-touch-icon.png')).status()).toBe(200);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    const splash = await page.locator('link[rel="apple-touch-startup-image"]').first().getAttribute('href');
    expect((await request.get(splash ?? '')).status()).toBe(200);
  });

  test('service worker controls the page and the app works offline after the first load', async ({ page, context }) => {
    await openApp(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // First load is not controlled; a reload is.
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope);
    expect(scope).toMatch(/\/WEBTOP\/$/);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'מ. שעות ושינויים' })).toBeVisible();
    await expect(dayTable(page).locator('tbody tr')).toHaveCount(13);
    await page.goto('#/settings');
    await expect(page.getByText(/^פעיל/)).toBeVisible();
    await context.setOffline(false);
  });

  test('a stale cache from an older version is deleted on activation', async ({ page }) => {
    // Simulate a cache left behind by a previous deploy, created before the worker activates.
    await page.addInitScript(() => void caches.open('webtop-pwa-oldversion'));
    await page.goto('./');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect
      .poll(() => page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('webtop-pwa-'))))
      .not.toContain('webtop-pwa-oldversion');
  });
});
