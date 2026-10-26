import { z } from 'zod';
import { createPaginatedSchema } from './common.ts';
import { FullArtistSchema, SimplifiedAlbumSchema, TrackSchema } from './catalog.ts';
import { SimplifiedPlaylistSchema } from './playlist.ts';

/**
 * 2026 Search Endpoint Limits:
 * Spotify reduced `GET /v1/search` maximum `limit` from 50 to 10 (default 5).
 */
export const SPOTIFY_2026_SEARCH_MAX_LIMIT = 10 as const;
export const SPOTIFY_2026_SEARCH_DEFAULT_LIMIT = 5 as const;

export function clampSpotifySearchLimit(requestedLimit?: number): number {
  if (requestedLimit === undefined || Number.isNaN(requestedLimit)) {
    return SPOTIFY_2026_SEARCH_MAX_LIMIT;
  }
  return Math.max(1, Math.min(SPOTIFY_2026_SEARCH_MAX_LIMIT, Math.floor(requestedLimit)));
}

export const SearchResponseSchema = z.object({
  tracks: createPaginatedSchema(TrackSchema).optional(),
  albums: createPaginatedSchema(SimplifiedAlbumSchema).optional(),
  artists: createPaginatedSchema(FullArtistSchema).optional(),
  playlists: createPaginatedSchema(SimplifiedPlaylistSchema.nullable())
    .transform((page) => ({
      ...page,
      items: page.items.filter((item): item is NonNullable<typeof item> => item !== null),
    }))
    .optional(),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;
