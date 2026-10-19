/**
 * Service-worker registration and update management.
 *
 * Update policy (so nobody is stuck on an old version):
 *  1. sw.js is fetched with `updateViaCache: 'none'`, and checked on launch, whenever
 *     the app returns to the foreground, and every 30 minutes while open.
 *  2. If a new version is already waiting when the app starts, it is activated at once
 *     (nothing is on screen yet that could be disrupted) and the page reloads once.
 *  3. If a new version arrives while the app is in use, a banner offers "רענון";
 *     accepting activates it and reloads. Otherwise it activates on the next cold start.
 */
import { create } from 'zustand';

export type UpdateStatus = 'unsupported' | 'idle' | 'update-available' | 'offline-ready';

interface PwaState {
  status: UpdateStatus;
  registration: ServiceWorkerRegistration | null;
  /** Version hash reported by the active worker (shown on the About screen). */
  workerVersion: string | null;
}

export const usePwaStore = create<PwaState>()(() => ({
  status: 'serviceWorker' in navigator ? 'idle' : 'unsupported',
  registration: null,
  workerVersion: null,
}));

const UPDATE_INTERVAL_MS = 30 * 60 * 1000;
const RELOAD_GUARD_KEY = 'webtop-pwa:sw-reloaded';
let reloading = false;

/**
 * Reloads once when a *newer* worker replaces the one controlling the page. The very
 * first install also fires controllerchange (clients.claim) — that one is ignored,
 * since the page already runs the current code.
 */
function reloadOnControllerChange(): void {
  let controlled = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) {
      controlled = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

/** Asks the active worker for its build version. */
async function readWorkerVersion(): Promise<string | null> {
  const controller = navigator.serviceWorker.controller;
  if (!controller) return null;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(null), 1500);
    channel.port1.onmessage = (event: MessageEvent<{ version?: string }>) => {
      window.clearTimeout(timer);
      resolve(event.data.version ?? null);
    };
    controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
  });
}

/** Tracks an installing worker and flags an update once it is installed. */
function watchInstalling(worker: ServiceWorker | null): void {
  worker?.addEventListener('statechange', () => {
    if (worker.state !== 'installed') return;
    usePwaStore.setState({ status: navigator.serviceWorker.controller ? 'update-available' : 'offline-ready' });
  });
}

/** Registers the worker in production builds (dev and tests run without it). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: 'none',
      });
      usePwaStore.setState({ registration });
      reloadOnControllerChange();

      // A version that finished installing in an earlier session: switch now, at launch.
      if (registration.waiting && navigator.serviceWorker.controller && !sessionStorage.getItem(RELOAD_GUARD_KEY)) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        return;
      }
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
      if (registration.waiting) usePwaStore.setState({ status: 'update-available' });

      watchInstalling(registration.installing);
      registration.addEventListener('updatefound', () => watchInstalling(registration.installing));

      const check = () => void registration.update().catch(() => undefined);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.setInterval(check, UPDATE_INTERVAL_MS);

      usePwaStore.setState({ workerVersion: await readWorkerVersion() });
    } catch (error) {
      console.warn('[sw] registration failed', error);
    }
  });
}

/** Activates the waiting worker; the page reloads on controllerchange. */
export function applyUpdate(): void {
  const waiting = usePwaStore.getState().registration?.waiting;
  if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
  else window.location.reload();
}

/** Manually checks for a new version (About screen button). Resolves with whether one was found. */
export async function checkForUpdate(): Promise<boolean> {
  const registration = usePwaStore.getState().registration;
  if (!registration) return false;
  await registration.update();
  return Boolean(registration.waiting || registration.installing);
}
