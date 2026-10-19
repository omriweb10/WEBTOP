import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { serviceWorkerPlugin } from './build/serviceWorkerPlugin';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/**
 * GitHub Pages serves this project from https://<user>.github.io/WEBTOP/, so every asset
 * URL, the manifest scope and the service-worker scope must live under /WEBTOP/.
 * BASE_PATH can override it (e.g. "/" for a custom domain).
 */
const base = process.env.BASE_PATH ?? '/WEBTOP/';

export default defineConfig({
  base,
  plugins: [
    react(),
    serviceWorkerPlugin({
      entry: 'src/sw/service-worker.ts',
      // iOS launch images are only fetched by the OS at install time; keep them out of the cache.
      exclude: ['splash/'],
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    target: ['es2020', 'safari15'],
    sourcemap: false,
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
  },
});
