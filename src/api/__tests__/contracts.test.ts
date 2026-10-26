import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { SpotifyHttpEngine } from '@/api/httpClient';
import { SpotifyClient } from '@/api/spotifyClient';
import { runStartupCapabilityProbes, SpotifyApiError } from '@/api/capabilities';
import { pulseDb } from '@/storage/db';
import { useCapabilityStore } from '@/stores/capabilityStore';
import { mswServer } from '@/test/mswServer';

function createTestClient(sleepCalls: number[] = []): SpotifyClient {
  const engine = new SpotifyHttpEngine({
    getAccessToken: () => Promise.resolve('test-pkce-bearer-token'),
    sleepFn: (ms) => {
      sleepCalls.push(ms);
      return Promise.resolve();
    },
  });
  return new SpotifyClient(engine);
}

describe('Spotify 2026 Dev Mode API Adapter & Resilience Contracts', () => {
  beforeEach(async () => {
    await pulseDb.apiCache.clear();
    await pulseDb.capabilityCache.clear();
    useCapabilityStore.getState().resetCapabilities();
  });

  it('parses 2026 User profile safely when product, email, country, and followers are omitted', async () => {
    const client = createTestClient();
    const user = await client.getCurrentUser();
    expect(user.id).toBe('pulse_dev_user_01');
    expect(user.display_name).toBe('Studio Listener');
    expect('product' in user).toBe(false);
    expect('email' in user).toBe(false);
  });

  it('parses renamed 2026 playlist `items` and `item` fields and tolerates null removed items', async () => {
    const client = createTestClient();
    const playlists = await client.getCurrentUserPlaylists();
    expect(playlists.items[0]?.itemsSummary?.total).toBe(1);

    const itemsPage = await client.getPlaylistItems('pl_owned_01');
    expect(itemsPage.items).toHaveLength(2);
    expect(itemsPage.items[0]?.item?.name).toBe('Midnight Oscillations');
    expect(itemsPage.items[1]?.item).toBeNull();
  });

  it('flags editorial/unowned playlists where 2026 Dev Mode omits `items` without crashing', async () => {
    const client = createTestClient();
    const editorial = await client.getPlaylist('37i9dQZF1DXcBWIGoYBM5M');
    expect(editorial.name).toBe('Editorial Synth Focus');
    expect(editorial.items).toBeNull();
    expect(editorial.itemsRestrictedByDevMode).toBe(true);
  });

  it('clamps search limit to <= 10 to satisfy February 2026 /v1/search parameter limits', async () => {
    const client = createTestClient();
    const res = await client.search({
      q: 'Warm Phosphor',
      types: ['track'],
      limit: 50, // Caller asks for legacy 50; client must clamp to 10 or MSW returns 400
    });
    expect(res.tracks?.limit).toBe(10);
    expect(res.tracks?.items[0]?.name).toBe('Midnight Oscillations');
  });

  it('batches unified /me/library and /me/library/contains calls into chunks of <= 40 URIs', async () => {
    let putCallCount = 0;
    mswServer.use(
      http.put('https://api.spotify.com/v1/me/library', ({ request }) => {
        putCallCount += 1;
        const uris = (new URL(request.url).searchParams.get('uris') ?? '')
          .split(',')
          .filter(Boolean);
        expect(uris.length).toBeLessThanOrEqual(40);
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const client = createTestClient();
    const ninetyFiveUris = Array.from({ length: 95 }, (_, i) => `spotify:track:id_${i}`);

    await client.saveToLibrary(ninetyFiveUris);
    expect(putCallCount).toBe(3);

    const contains = await client.checkLibraryContains(ninetyFiveUris);
    expect(contains).toHaveLength(95);
  });

  it('deduplicates concurrent identical GET requests in flight', async () => {
    let networkHits = 0;
    mswServer.use(
      http.get('https://api.spotify.com/v1/tracks/:id', () => {
        networkHits += 1;
        return HttpResponse.json({
          id: 'dedup_01',
          name: 'Single Flight Track',
          uri: 'spotify:track:dedup_01',
          duration_ms: 180_000,
        });
      }),
    );

    const client = createTestClient();
    const [a, b, c] = await Promise.all([
      client.getTrack('dedup_01'),
      client.getTrack('dedup_01'),
      client.getTrack('dedup_01'),
    ]);

    expect(networkHits).toBe(1);
    expect(a.name).toBe('Single Flight Track');
    expect(b.id).toBe(c.id);
  });

  it('honors 429 Retry-After header and succeeds on retry', async () => {
    let attempts = 0;
    mswServer.use(
      http.get('https://api.spotify.com/v1/tracks/:id', () => {
        attempts += 1;
        if (attempts === 1) {
          return new HttpResponse(null, {
            status: 429,
            headers: { 'Retry-After': '2' },
          });
        }
        return HttpResponse.json({
          id: 'retry_track',
          name: 'Recovered Track',
          uri: 'spotify:track:retry_track',
          duration_ms: 200_000,
        });
      }),
    );

    const sleepCalls: number[] = [];
    const client = createTestClient(sleepCalls);
    const track = await client.getTrack('retry_track');

    expect(attempts).toBe(2);
    expect(sleepCalls[0]).toBeGreaterThanOrEqual(2000);
    expect(track.name).toBe('Recovered Track');
  });

  it('records 403 capability degradation and surfaces an alert banner during startup probing', async () => {
    mswServer.use(
      http.get('https://api.spotify.com/v1/me/player', () =>
        HttpResponse.json(
          { error: { status: 403, message: 'Player command failed: Premium required', reason: 'PREMIUM_REQUIRED' } },
          { status: 403 },
        ),
      ),
    );

    const client = createTestClient();
    const capabilities = await runStartupCapabilityProbes(client, true);

    expect(capabilities.profile?.status).toBe('available');
    expect(capabilities.playlists?.status).toBe('available');
    expect(capabilities.player?.status).toBe('degraded');
    expect(capabilities.player?.httpStatus).toBe(403);
    expect(useCapabilityStore.getState().alerts.length).toBeGreaterThan(0);

    await expect(client.getPlaybackState()).rejects.toBeInstanceOf(SpotifyApiError);
  });
});
