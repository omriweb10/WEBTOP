/// <reference lib="webworker" />
/**
 * Versioned offline strategy.
 *
 *  - install:  precache every build file (manifest injected at build time) into a cache
 *              named after the content hash of the build. No automatic skipWaiting —
 *              the page decides when to switch (see serviceWorkerClient.ts).
 *  - activate: delete caches from older versions, then claim open pages.
 *  - fetch:    navigations are network-first (3 s timeout) so online users always get
 *              the newest HTML; offline they fall back to the cached app shell.
 *              Other same-origin GETs are cache-first (hashed, immutable assets).
 */
declare const __PRECACHE_MANIFEST__: string[];
declare const __SW_VERSION__: string;

/** The worker global, typed as a service worker scope. */
const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_PREFIX = 'webtop-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}${__SW_VERSION__}`;
const NAVIGATION_TIMEOUT_MS = 3000;

/** Absolute URL of a precache entry, resolved against the worker's scope. */
function scopedUrl(path: string): string {
  return new URL(path, sw.registration.scope).href;
}

const SHELL_URL = scopedUrl('./index.html');

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // cache: 'reload' bypasses the HTTP cache so a new version never precaches stale files.
      cache.addAll(__PRECACHE_MANIFEST__.map((path) => new Request(scopedUrl(path), { cache: 'reload' }))),
    ),
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener('message', (event) => {
  const data = event.data as { type?: string } | null;
  if (data?.type === 'SKIP_WAITING') void sw.skipWaiting();
  if (data?.type === 'GET_VERSION') event.ports[0]?.postMessage({ version: __SW_VERSION__ });
});

/** Network-first for page loads, with a timeout and an offline fallback to the shell. */
async function handleNavigation(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), NAVIGATION_TIMEOUT_MS)),
    ]);
    if (response.ok) {
      await cache.put(SHELL_URL, response.clone());
      return response;
    }
    return (await cache.match(SHELL_URL)) ?? response;
  } catch {
    const cached = (await cache.match(SHELL_URL)) ?? (await cache.match(scopedUrl('./')));
    return cached ?? new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

/** Cache-first for static assets; successful network responses are added to the cache. */
async function handleAsset(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
  return response;
}

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== sw.location.origin || !request.url.startsWith(sw.registration.scope)) return;
  // Always fetch the worker script itself from the network.
  if (url.pathname.endsWith('/sw.js')) return;
  event.respondWith(request.mode === 'navigate' ? handleNavigation(request) : handleAsset(request));
});
