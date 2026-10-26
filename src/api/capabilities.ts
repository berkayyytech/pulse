import { pulseDb } from '@/storage/db';
import { useCapabilityStore, type CapabilityEntry } from '@/stores/capabilityStore';
import { SpotifyApiError } from './httpClient';
import type { SpotifyClient } from './spotifyClient';

export { SpotifyApiError } from './httpClient';

const CAPABILITY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface ProbeDefinition {
  readonly id: string;
  readonly run: (client: SpotifyClient) => Promise<unknown>;
}

const STARTUP_PROBES: readonly ProbeDefinition[] = [
  { id: 'profile', run: (c) => c.getCurrentUser() },
  { id: 'playlists', run: (c) => c.getCurrentUserPlaylists(1, 0) },
  { id: 'player', run: (c) => c.getPlaybackState() },
];

export async function runStartupCapabilityProbes(
  client: SpotifyClient,
  forceRefresh = false,
): Promise<Record<string, CapabilityEntry>> {
  const now = Date.now();
  const store = useCapabilityStore.getState();

  for (const probe of STARTUP_PROBES) {
    if (!forceRefresh) {
      const cached = await pulseDb.capabilityCache.get(probe.id);
      if (cached && now - cached.checkedAt < CAPABILITY_CACHE_TTL_MS) {
        const entry: CapabilityEntry = {
          id: cached.capabilityId,
          status: cached.status,
          ...(cached.httpStatus !== undefined ? { httpStatus: cached.httpStatus } : {}),
          ...(cached.reason !== undefined ? { reason: cached.reason } : {}),
          updatedAt: cached.checkedAt,
        };
        store.setCapability(entry);
        continue;
      }
    }

    try {
      await probe.run(client);
      const okEntry: CapabilityEntry = {
        id: probe.id,
        status: 'available',
        updatedAt: Date.now(),
      };
      store.setCapability(okEntry);
      await pulseDb.capabilityCache.put({
        capabilityId: probe.id,
        status: 'available',
        checkedAt: okEntry.updatedAt,
      });
    } catch (err) {
      if (err instanceof SpotifyApiError && err.status === 403) {
        await pulseDb.capabilityCache.put({
          capabilityId: probe.id,
          status: 'degraded',
          httpStatus: 403,
          reason: err.message,
          checkedAt: Date.now(),
        });
      } else {
        throw err;
      }
    }
  }

  return useCapabilityStore.getState().capabilities;
}
