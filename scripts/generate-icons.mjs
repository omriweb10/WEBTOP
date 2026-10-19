/**
 * Renders the app icon, maskable icon, Apple touch icon, favicon and iOS launch images
 * from the inline SVG below using headless Chromium (Playwright).
 * The artwork is original to this project. Run with: npm run icons
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const OUT_ICONS = path.resolve('public/icons');
const OUT_SPLASH = path.resolve('public/splash');

/** Icon artwork; `pad` shrinks the glyph for the maskable safe zone. */
function iconSvg({ size, pad = 0, rounded = true }) {
  const inner = size - pad * 2;
  const s = inner / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b3354"/><stop offset="1" stop-color="#12161c"/></linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="url(#g)"/>
  <g transform="translate(${pad} ${pad}) scale(${s})">
    <rect x="96" y="112" width="320" height="300" rx="28" fill="#191e29" stroke="#2d323f" stroke-width="8"/>
    <rect x="96" y="112" width="320" height="64" rx="28" fill="#252d3c"/>
    <rect x="96" y="150" width="320" height="26" fill="#252d3c"/>
    <rect x="330" y="176" width="8" height="236" fill="#2d323f"/>
    <rect x="124" y="200" width="190" height="52" rx="8" fill="#17304a"/><rect x="306" y="200" width="8" height="52" fill="#1498fd"/>
    <rect x="124" y="268" width="190" height="52" rx="8" fill="#3c371f"/><rect x="306" y="268" width="8" height="52" fill="#ffbe10"/>
    <rect x="124" y="336" width="190" height="52" rx="8" fill="#20372d"/><rect x="306" y="336" width="8" height="52" fill="#259e3b"/>
    <rect x="352" y="218" width="44" height="14" rx="7" fill="#dde1e7"/>
    <rect x="352" y="286" width="44" height="14" rx="7" fill="#dde1e7"/>
    <rect x="352" y="354" width="44" height="14" rx="7" fill="#dde1e7"/>
    <circle cx="384" cy="120" r="56" fill="#45aba0" stroke="#12161c" stroke-width="10"/>
    <path d="M384 88 v34 l22 14" stroke="#062b27" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
</svg>`;
}

/** Launch image: dark background with the icon centred. */
function splashHtml(width, height) {
  const icon = Math.round(Math.min(width, height) * 0.28);
  return `<html><body style="margin:0;background:#12161c;width:${width}px;height:${height}px;display:grid;place-items:center">
  ${iconSvg({ size: icon })}</body></html>`;
}

const SPLASH_SIZES = [
  [1320, 2868], [1206, 2622], [1260, 2736], [1290, 2796], [1179, 2556], [1284, 2778],
  [1170, 2532], [1125, 2436], [1242, 2688], [828, 1792], [1242, 2208], [750, 1334],
];

mkdirSync(OUT_ICONS, { recursive: true });
mkdirSync(OUT_SPLASH, { recursive: true });
writeFileSync(path.join(OUT_ICONS, 'favicon.svg'), iconSvg({ size: 64 }));

const browser = await chromium.launch();
const page = await browser.newPage();

/** Screenshots arbitrary HTML at an exact pixel size. */
async function render(html, width, height, file) {
  await page.setViewportSize({ width, height });
  await page.setContent(html);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width, height }, omitBackground: false });
}

/** Wraps an icon SVG in a page of exactly its size. */
const iconPage = (svg, size) => `<html><body style="margin:0;background:#12161c;width:${size}px;height:${size}px">${svg}</body></html>`;
await render(iconPage(iconSvg({ size: 192 }), 192), 192, 192, path.join(OUT_ICONS, 'icon-192.png'));
await render(iconPage(iconSvg({ size: 512 }), 512), 512, 512, path.join(OUT_ICONS, 'icon-512.png'));
await render(iconPage(iconSvg({ size: 512, pad: 64, rounded: false }), 512), 512, 512, path.join(OUT_ICONS, 'maskable-512.png'));
// iOS applies its own corner mask; supply a full-bleed square.
await render(iconPage(iconSvg({ size: 180, rounded: false }), 180), 180, 180, path.join(OUT_ICONS, 'apple-touch-icon.png'));
for (const [w, h] of SPLASH_SIZES) {
  await render(splashHtml(w, h), w, h, path.join(OUT_SPLASH, `splash-${w}x${h}.png`));
}
await browser.close();
console.info(`Icons written to ${OUT_ICONS}, ${SPLASH_SIZES.length} launch images to ${OUT_SPLASH}`);
