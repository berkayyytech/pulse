import { z } from 'zod';
import { createPaginatedSchema, ExternalUrlsSchema, SpotifyImageSchema } from './common.ts';

/**
 * 2026 Development Mode Artist, Album, and Track schemas.
 * Never depends on removed fields (`popularity`, `available_markets`, `label`, `followers`, `linked_from`).
 */
export const SimplifiedArtistSchema = z.object({
  id: z.string().nullable().default(null),
  name: z.string().default('Unknown Artist'),
  uri: z.string().default(''),
  href: z.string().nullable().default(null),
  external_urls: ExternalUrlsSchema,
});

export type SimplifiedArtist = z.infer<typeof SimplifiedArtistSchema>;

export const FullArtistSchema = SimplifiedArtistSchema.extend({
  genres: z.array(z.string()).default([]),
  images: z.array(SpotifyImageSchema).default([]),
});

export type FullArtist = z.infer<typeof FullArtistSchema>;

export const SimplifiedAlbumSchema = z.object({
  id: z.string().nullable().default(null),
  name: z.string().default('Unknown Album'),
  album_type: z.string().default('album'),
  total_tracks: z.number().default(0),
  release_date: z.string().default(''),
  release_date_precision: z.string().default('day'),
  uri: z.string().default(''),
  href: z.string().nullable().default(null),
  images: z.array(SpotifyImageSchema).default([]),
  artists: z.array(SimplifiedArtistSchema).default([]),
  external_urls: ExternalUrlsSchema,
});

export type SimplifiedAlbum = z.infer<typeof SimplifiedAlbumSchema>;

export const TrackSchema = z.object({
  id: z.string().nullable().default(null),
  name: z.string().default('Unknown Track'),
  uri: z.string().default(''),
  duration_ms: z.number().nonnegative().default(0),
  explicit: z.boolean().default(false),
  disc_number: z.number().default(1),
  track_number: z.number().default(1),
  is_local: z.boolean().default(false),
  is_playable: z.boolean().optional(),
  preview_url: z.string().nullable().optional(),
  artists: z.array(SimplifiedArtistSchema).default([]),
  album: SimplifiedAlbumSchema.optional(),
  external_urls: ExternalUrlsSchema,
  type: z.string().default('track'),
});

export type Track = z.infer<typeof TrackSchema>;

export const FullAlbumSchema = SimplifiedAlbumSchema.extend({
  copyrights: z
    .array(
      z.object({
        text: z.string().default(''),
        type: z.string().default('C'),
      }),
    )
    .default([]),
  external_ids: z.record(z.string()).optional(),
  tracks: createPaginatedSchema(TrackSchema).optional(),
});

export type FullAlbum = z.infer<typeof FullAlbumSchema>;

export const SavedTrackSchema = z.object({
  added_at: z.string().default(''),
  track: TrackSchema,
});

export const SavedAlbumSchema = z.object({
  added_at: z.string().default(''),
  album: FullAlbumSchema,
});

export const FollowedArtistsResponseSchema = z.object({
  artists: z.object({
    href: z.string().default(''),
    items: z.array(FullArtistSchema).default([]),
    limit: z.number().default(20),
    next: z.string().nullable().default(null),
    total: z.number().optional(),
    cursors: z
      .object({
        after: z.string().nullable().optional(),
        before: z.string().nullable().optional(),
      })
      .optional(),
  }),
});
