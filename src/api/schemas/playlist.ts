import { z } from 'zod';
import { createPaginatedSchema, ExternalUrlsSchema, SpotifyImageSchema } from './common.ts';
import { TrackSchema } from './catalog.ts';

const PlaylistSummaryCountSchema = z.object({
  href: z.string().default(''),
  total: z.number().nonnegative().default(0),
});

const RawPlaylistEntrySchema = z
  .object({
    added_at: z.string().nullable().default(null),
    added_by: z
      .object({
        id: z.string().default(''),
        uri: z.string().optional(),
      })
      .nullable()
      .optional(),
    is_local: z.boolean().default(false),
    // 2026 schema uses `item`; accept legacy `track` as defensive fallback
    item: TrackSchema.nullable().optional(),
    track: TrackSchema.nullable().optional(),
  })
  .transform((raw) => ({
    added_at: raw.added_at,
    added_by_id: raw.added_by?.id ?? null,
    is_local: raw.is_local,
    item: raw.item ?? raw.track ?? null,
    usedLegacyTrackField: raw.item === undefined && raw.track !== undefined,
  }));

export type PlaylistItemEntry = z.infer<typeof RawPlaylistEntrySchema>;

export const PlaylistItemsPageSchema = createPaginatedSchema(RawPlaylistEntrySchema);

export type PlaylistItemsPage = z.infer<typeof PlaylistItemsPageSchema>;

export const SimplifiedPlaylistSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().default('Untitled Playlist'),
    description: z.string().nullable().default(''),
    collaborative: z.boolean().default(false),
    public: z.boolean().nullable().default(null),
    snapshot_id: z.string().default(''),
    uri: z.string().default(''),
    images: z.array(SpotifyImageSchema).nullable().transform((v) => v ?? []),
    owner: z
      .object({
        id: z.string().default(''),
        display_name: z.string().nullable().default(null),
        uri: z.string().default(''),
      })
      .default({ id: '', display_name: null, uri: '' }),
    external_urls: ExternalUrlsSchema,
    // 2026 renamed `tracks` summary to `items` (and unowned playlists may omit `items` completely)
    items: PlaylistSummaryCountSchema.optional(),
    tracks: PlaylistSummaryCountSchema.optional(),
  })
  .transform((raw) => ({
    id: raw.id,
    name: raw.name,
    description: raw.description ?? '',
    collaborative: raw.collaborative,
    public: raw.public,
    snapshot_id: raw.snapshot_id,
    uri: raw.uri,
    images: raw.images,
    owner: raw.owner,
    external_urls: raw.external_urls,
    itemsSummary: raw.items ?? raw.tracks ?? null,
    usedLegacyTracksSummary: raw.items === undefined && raw.tracks !== undefined,
  }));

export type SimplifiedPlaylist = z.infer<typeof SimplifiedPlaylistSchema>;

export const FullPlaylistSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().default('Untitled Playlist'),
    description: z.string().nullable().default(''),
    collaborative: z.boolean().default(false),
    public: z.boolean().nullable().default(null),
    snapshot_id: z.string().default(''),
    uri: z.string().default(''),
    images: z.array(SpotifyImageSchema).nullable().transform((v) => v ?? []),
    owner: z
      .object({
        id: z.string().default(''),
        display_name: z.string().nullable().default(null),
        uri: z.string().default(''),
      })
      .default({ id: '', display_name: null, uri: '' }),
    external_urls: ExternalUrlsSchema,
    // In 2026 Dev Mode, unowned/editorial playlists omit `items` (`undefined`)
    items: PlaylistItemsPageSchema.optional(),
    tracks: PlaylistItemsPageSchema.optional(),
  })
  .transform((raw) => {
    const resolvedItems = raw.items ?? raw.tracks ?? null;
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description ?? '',
      collaborative: raw.collaborative,
      public: raw.public,
      snapshot_id: raw.snapshot_id,
      uri: raw.uri,
      images: raw.images,
      owner: raw.owner,
      external_urls: raw.external_urls,
      items: resolvedItems,
      itemsRestrictedByDevMode: resolvedItems === null,
    };
  });

export type FullPlaylist = z.infer<typeof FullPlaylistSchema>;
