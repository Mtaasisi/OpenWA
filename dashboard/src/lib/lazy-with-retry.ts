import type { ComponentType } from 'react';

export const STALE_CHUNK_RELOAD_KEY = 'openwa-chunk-reload';

export function isStaleChunkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

/** Clear after a successful boot so the next deploy can auto-recover again. */
export function clearStaleChunkReloadFlag(): void {
  sessionStorage.removeItem(STALE_CHUNK_RELOAD_KEY);
}

/** Hard reload once when a lazy chunk 404s after a dashboard rebuild. */
export function reloadOnceOnStaleChunk(error: unknown): never {
  if (isStaleChunkError(error) && !sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY)) {
    sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, '1');
    const url = new URL(window.location.href);
    url.searchParams.set('_cb', String(Date.now()));
    window.location.replace(url.toString());
  }
  throw error instanceof Error ? error : new Error(String(error));
}

export function installStaleChunkRecovery(): void {
  window.addEventListener('unhandledrejection', event => {
    if (isStaleChunkError(event.reason)) {
      event.preventDefault();
      reloadOnceOnStaleChunk(event.reason);
    }
  });
}

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): () => Promise<{ default: T }> {
  return () =>
    factory().catch(error => {
      reloadOnceOnStaleChunk(error);
      return factory();
    });
}
