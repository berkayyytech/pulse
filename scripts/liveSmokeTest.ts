/**
 * Optional Live Smoke Test for Nightly CI (`.github/workflows/nightly-api-contract.yml`).
 *
 * Never ships or hardcodes credentials. When repository secrets `SPOTIFY_CLIENT_ID` and
 * `SPOTIFY_REFRESH_TOKEN` are absent (e.g. local dev or community forks), exits 0 cleanly.
 * When configured by a fork maintainer, exchanges the refresh token and verifies live 2026
 * Spotify Dev Mode endpoint contracts against Pulse's Zod schemas.
 */
import { UserProfileSchema } from '../src/api/schemas/user.ts';
import { SimplifiedPlaylistSchema } from '../src/api/schemas/playlist.ts';
import { SearchResponseSchema } from '../src/api/schemas/search.ts';
import { createPaginatedSchema } from '../src/api/schemas/common.ts';

const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN?.trim();

async function main(): Promise<void> {
  if (!clientId || !refreshToken) {
    console.log(
      '[smoke:live] SPOTIFY_CLIENT_ID / SPOTIFY_REFRESH_TOKEN not set; skipping live Spotify probe.',
    );
    return;
  }

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Token refresh failed in live smoke test: HTTP ${String(tokenRes.status)}`);
  }

  const tokenPayload = (await tokenRes.json()) as { access_token?: string };
  if (!tokenPayload.access_token) {
    throw new Error('Token refresh succeeded without access_token');
  }

  const authHeaders = { Authorization: `Bearer ${tokenPayload.access_token}` };

  const meRes = await fetch('https://api.spotify.com/v1/me', { headers: authHeaders });
  if (!meRes.ok) {
    throw new Error(`GET /v1/me failed: HTTP ${String(meRes.status)}`);
  }
  UserProfileSchema.parse(await meRes.json());

  const playlistsRes = await fetch('https://api.spotify.com/v1/me/playlists?limit=5', {
    headers: authHeaders,
  });
  if (!playlistsRes.ok) {
    throw new Error(`GET /v1/me/playlists failed: HTTP ${String(playlistsRes.status)}`);
  }
  createPaginatedSchema(SimplifiedPlaylistSchema).parse(await playlistsRes.json());

  const searchRes = await fetch(
    'https://api.spotify.com/v1/search?q=ambient&type=track&limit=5',
    { headers: authHeaders },
  );
  if (!searchRes.ok) {
    throw new Error(`GET /v1/search failed: HTTP ${String(searchRes.status)}`);
  }
  SearchResponseSchema.parse(await searchRes.json());

  console.log('[smoke:live] All live 2026 Spotify Dev Mode contracts passed.');
}

main().catch((err: unknown) => {
  console.error('[smoke:live] Contract failure:', err);
  process.exitCode = 1;
});
