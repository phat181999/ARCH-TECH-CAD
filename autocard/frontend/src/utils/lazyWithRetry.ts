import { lazy, type ComponentType } from "react";

// Wraps React.lazy so a failed dynamic import (commonly a stale content-hashed
// chunk after a new deploy — "Failed to fetch dynamically imported module") is
// recovered automatically:
//   1. retry the import once after a short delay (transient network blips), then
//   2. if it still fails, force a one-time full reload so the browser fetches the
//      fresh asset manifest and the correct chunk hashes.
// A sessionStorage flag prevents an infinite reload loop when the chunk is
// genuinely missing.
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  name: string,
) {
  const reloadKey = `chunk-reload:${name}`;
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(reloadKey); // success → clear the guard
      return mod;
    } catch (err) {
      // One retry for a transient failure.
      try {
        await new Promise((r) => setTimeout(r, 400));
        const mod = await factory();
        sessionStorage.removeItem(reloadKey);
        return mod;
      } catch (err2) {
        // Likely a stale chunk from a previous deploy. Reload once to refresh.
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, "1");
          window.location.reload();
          // Never resolves — the reload replaces the page.
          return new Promise<{ default: T }>(() => {});
        }
        // Already reloaded once and still broken — surface the real error so the
        // Suspense error boundary (or console) shows it instead of looping.
        throw err2;
      }
    }
  });
}
