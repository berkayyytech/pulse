import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  fixture2026OwnedPlaylistsPage,
  fixture2026PlaybackState,
  fixture2026PlaylistItemsPage,
  fixture2026Track,
  fixture2026UnownedEditorialPlaylist,
  fixture2026User,
} from './fixtures/spotify2026';

export const defaultSpotifyHandlers = [
  http.get('https://api.spotify.com/v1/me', () => HttpResponse.json(fixture2026User)),

  http.get('https://api.spotify.com/v1/me/player', () =>
    HttpResponse.json(fixture2026PlaybackState),
  ),

  http.get('https://api.spotify.com/v1/me/playlists', () =>
    HttpResponse.json(fixture2026OwnedPlaylistsPage),
  ),

  http.get('https://api.spotify.com/v1/playlists/:playlistId', ({ params }) => {
    if (params.playlistId === '37i9dQZF1DXcBWIGoYBM5M') {
      return HttpResponse.json(fixture2026UnownedEditorialPlaylist);
    }
    return HttpResponse.json({
      ...fixture2026OwnedPlaylistsPage.items[0],
      items: fixture2026PlaylistItemsPage,
    });
  }),

  http.get('https://api.spotify.com/v1/playlists/:playlistId/items', () =>
    HttpResponse.json(fixture2026PlaylistItemsPage),
  ),

  http.get('https://api.spotify.com/v1/search', ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '5');
    // Authentic 2026 Spotify validation: search limit > 10 returns 400 Bad Request
    if (limit > 10 || limit < 1) {
      return HttpResponse.json(
        { error: { status: 400, message: 'Invalid limit; maximum in Dev Mode is 10' } },
        { status: 400 },
      );
    }
    return HttpResponse.json({
      tracks: {
        href: request.url,
        items: [fixture2026Track],
        limit,
        next: null,
        offset: 0,
        previous: null,
        total: 1,
      },
    });
  }),

  http.put('https://api.spotify.com/v1/me/library', ({ request }) => {
    const url = new URL(request.url);
    const uris = (url.searchParams.get('uris') ?? '').split(',').filter(Boolean);
    if (uris.length > 40) {
      return HttpResponse.json(
        { error: { status: 400, message: 'Maximum 40 URIs per request' } },
        { status: 400 },
      );
    }
    return new HttpResponse(null, { status: 200 });
  }),

  http.get('https://api.spotify.com/v1/me/library/contains', ({ request }) => {
    const url = new URL(request.url);
    const uris = (url.searchParams.get('uris') ?? '').split(',').filter(Boolean);
    if (uris.length > 40) {
      return HttpResponse.json(
        { error: { status: 400, message: 'Maximum 40 URIs per request' } },
        { status: 400 },
      );
    }
    return HttpResponse.json(uris.map((_, idx) => idx % 2 === 0));
  }),
];

export const mswServer = setupServer(...defaultSpotifyHandlers);
