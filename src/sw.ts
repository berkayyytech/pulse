/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: readonly { url: string; revision: string | null }[];
};

const APP_SHELL_CACHE = 'pulse-app-shell-v1';
const ARTWORK_CACHE = 'pulse-artwork-v1';
const PRECACHE_ENTRIES = self.__WB_MANIFEST;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(async (cache) => {
      const urls = PRECACHE_ENTRIES.map((entry) => `/${entry.url.replace(/^\/+/, '')}`);
      await cache.addAll(urls);
      await self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== APP_SHELL_CACHE && k !== ARTWORK_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Never intercept OAuth callbacks, Spotify API/Auth calls, or Web Playback SDK scripts
  if (
    url.pathname.startsWith('/auth/callback') ||
    url.hostname === 'accounts.spotify.com' ||
    url.hostname === 'api.spotify.com' ||
    url.hostname === 'sdk.scdn.co'
  ) {
    return;
  }

  // Cache-first for immutable Spotify cover art CDN images
  if (url.hostname === 'i.scdn.co') {
    event.respondWith(
      caches.open(ARTWORK_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
          void cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      }),
    );
    return;
  }

  // Same-origin static app shell assets: cache-first with SPA index.html navigation fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(APP_SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        try {
          return await fetch(request);
        } catch {
          if (request.mode === 'navigate') {
            const fallback = await cache.match('/index.html');
            if (fallback) {
              return fallback;
            }
          }
          throw new Error('Offline and asset not in app-shell cache');
        }
      }),
    );
  }
});

export {};
