/**
 * Vite plugin that compiles `src/sw/service-worker.ts` into `dist/sw.js` after the
 * production bundle is written. It injects:
 *  - a precache manifest listing every emitted file (relative to the base URL), and
 *  - a content-derived version string, so every deploy with changed files gets a
 *    fresh cache name and the old cache is purged on activation.
 *
 * Doing this in-house keeps the dependency surface small (no Workbox) while still
 * giving an intentional, versioned offline strategy.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { transformWithEsbuild, type Plugin, type ResolvedConfig } from 'vite';

export interface ServiceWorkerPluginOptions {
  /** Path of the TypeScript service worker source, relative to the project root. */
  entry: string;
  /** Output file name inside the build directory. */
  fileName?: string;
  /** Path prefixes (relative to outDir) that must not be precached. */
  exclude?: readonly string[];
}

/** Recursively lists every file below `dir`, returning paths relative to `root` with forward slashes. */
async function listFiles(dir: string, root: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(full, root);
      return [path.relative(root, full).split(path.sep).join('/')];
    }),
  );
  return nested.flat();
}

/** Builds a short, deterministic hash over the names and contents of all precached files. */
async function computeVersion(outDir: string, files: readonly string[]): Promise<string> {
  const hash = createHash('sha256');
  for (const file of [...files].sort()) {
    hash.update(file);
    hash.update(await readFile(path.join(outDir, file)));
  }
  return hash.digest('hex').slice(0, 12);
}

/** Creates the plugin instance; it only runs for `vite build`, never in the dev server. */
export function serviceWorkerPlugin(options: ServiceWorkerPluginOptions): Plugin {
  const fileName = options.fileName ?? 'sw.js';
  const exclude = options.exclude ?? [];
  let config: ResolvedConfig;

  return {
    name: 'webtop-service-worker',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    async closeBundle() {
      const outDir = path.resolve(config.root, config.build.outDir);
      const all = await listFiles(outDir, outDir);
      const precache = all.filter(
        (file) =>
          file !== fileName &&
          !file.endsWith('.map') &&
          !exclude.some((prefix) => file.startsWith(prefix)),
      );
      // The navigation fallback is the app shell; list it as the base URL itself too.
      const manifest = ['./', ...precache.map((file) => `./${file}`)];
      const version = await computeVersion(outDir, precache);

      const source = await readFile(path.resolve(config.root, options.entry), 'utf8');
      const result = await transformWithEsbuild(source, options.entry, {
        loader: 'ts',
        target: 'es2020',
        minify: true,
        define: {
          __PRECACHE_MANIFEST__: JSON.stringify(manifest),
          __SW_VERSION__: JSON.stringify(version),
        },
      });
      await writeFile(path.join(outDir, fileName), result.code, 'utf8');
      config.logger.info(
        `[sw] ${fileName} written: version ${version}, ${manifest.length} precached URLs`,
      );
    },
  };
}
