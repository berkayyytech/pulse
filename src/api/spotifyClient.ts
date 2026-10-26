import { z } from 'zod';
import { createPaginatedSchema } from './schemas/common.ts';
import { UserProfileSchema, type UserProfile } from './schemas/user.ts';
import {
  FollowedArtistsResponseSchema,
  FullAlbumSchema,
  FullArtistSchema,
  SavedAlbumSchema,
  SavedTrackSchema,
  SimplifiedAlbumSchema,
  TrackSchema,
  type FullAlbum,
  type FullArtist,
  type Track,
} from './schemas/catalog.ts';
import {
  FullPlaylistSchema,
  PlaylistItemsPageSchema,
  SimplifiedPlaylistSchema,
  type FullPlaylist,
  type PlaylistItemsPage,
} from './schemas/playlist.ts';
import {
  DevicesResponseSchema,
  PlaybackStateSchema,
  QueueResponseSchema,
  RecentlyPlayedResponseSchema,
  type ConnectDevice,
  type PlaybackState,
  type QueueResponse,
  type RecentlyPlayedResponse,
} from './schemas/player.ts';
import {
  clampSpotifySearchLimit,
  SearchResponseSchema,
  type SearchResponse,
} from './schemas/search.ts';
import {
  chunkUris,
  SPOTIFY_LIBRARY_MAX_URIS_PER_BATCH,
  type SpotifyHttpEngine,
} from './httpClient';

const NullableVoidSchema = z.unknown().nullable();
const BooleanArraySchema = z.array(z.boolean());
const SnapshotResponseSchema = z.object({
  snapshot_id: z.string().default(''),
});

export type RepeatMode = 'off' | 'context' | 'track';
export type TopTimeRange = 'short_term' | 'medium_term' | 'long_term';

/**
 * Single typed gateway to the Spotify Web API (2026 Development Mode compliant).
 * Never calls removed pre-2026 routes (e.g. `/playlists/{id}/tracks`, `PUT /me/tracks`,
 * `POST /users/{id}/playlists`, `GET /artists/{id}/top-tracks`, or batch `GET /tracks`).
 */
export class SpotifyClient {
  private readonly http: SpotifyHttpEngine;

  public constructor(http: SpotifyHttpEngine) {
    this.http = http;
  }

  public async getCurrentUser(): Promise<UserProfile> {
    return await this.http.request({
      path: '/me',
      schema: UserProfileSchema,
      cacheTtlMs: 5 * 60_000,
      capabilityId: 'profile',
    });
  }

  public async getPlaybackState(): Promise<PlaybackState | null> {
    return await this.http.request({
      path: '/me/player',
      schema: PlaybackStateSchema.nullable(),
      capabilityId: 'player',
    });
  }

  public async getAvailableDevices(): Promise<ConnectDevice[]> {
    const res = await this.http.request({
      path: '/me/player/devices',
      schema: DevicesResponseSchema,
      capabilityId: 'player',
    });
    return res.devices;
  }

  public async transferPlayback(deviceId: string, play: boolean = true): Promise<void> {
    await this.http.request({
      path: '/me/player',
      method: 'PUT',
      body: { device_ids: [deviceId], play },
      schema: NullableVoidSchema,
      capabilityId: 'player',
    });
  }

  public async play(params?: {
    deviceId?: string;
    contextUri?: string;
    uris?: readonly string[];
    offsetUri?: string;
    positionMs?: number;
  }): Promise<void> {
    const body: Record<string, unknown> = {};
    if (params?.contextUri) {
      body.context_uri = params.contextUri;
    }
    if (params?.uris && params.uris.length > 0) {
      body.uris = params.uris;
    }
    if (params?.offsetUri) {
      body.offset = { uri: params.offsetUri };
    }
    if (params?.positionMs !== undefined) {
      body.position_ms = Math.max(0, Math.floor(params.positionMs));
    }

    await this.http.request({
      path: '/me/player/play',
      method: 'PUT',
      query: { device_id: params?.deviceId },
      body: Object.keys(body).length > 0 ? body : undefined,
      schema: NullableVoidSchema,
      capabilityId: 'player',
    });
  }

  public async pause(deviceId?: string): Promise<void> {
    await this.http.request({
      path: '/me/player/pause',
      method: 'PUT',
      query: { device_id: deviceId },
      schema: NullableVoidSchema,
      capabilityId: 'player',
    });
  }

  public async skipNext(deviceId?: string): Promise<void> {
    await this.http.request({
      path: '/me/player/next',
      method: 'POST',
      query: { device_id: deviceId },
      schema: NullableVoidSchema,
      capabilityId: 'player',
    });
  }

  public async skipPrevious(deviceId?: string): Promise<void> {
    await this.http.request({
      path: '/me/player/previous',
      method: 'POST',
      query: { device_id: deviceId },
      schema: NullableVoidSchema,
      capabilityId: 'player',
    });
  }

  public async seek(positionMs: number, deviceId?: string): Promise<void> {
    await this.http.request({
      path: '/me/player/seek',
      method: 'PUT',
      query: {
        position_ms: Math.max(0, Math.floor(positionMs)),
        device_id: deviceId,
      },
      schema: NullableVoidSchema,
      capabilityId: 'player',
    });
  }

  public async setVolume(volumePercent: number, deviceId?: string): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(volumePercent)));
    await this.http.request({
      path: '/me/player/volume',
      method: 'PUT',
      query: { volume_percent: clamped, device_id: deviceId },
      schema: NullableVoidSchema,
      capabilityId: 'player',
    });
  }

  public async setShuffle(state: boolean, deviceId?: string): Promise<void> {
    await this.http.request({
      path: '/me/player/shuffle',
      method: 'PUT',
      query: { state, device_id: deviceId },
      schema: NullableVoidSchema,
      capabilityId: 'player',
    });
  }

  public async setRepeatMode(state: RepeatMode, deviceId?: string): Promise<void> {
    await this.http.request({
      path: '/me/player/repeat',
      method: 'PUT',
      query: { state, device_id: deviceId },
      schema: NullableVoidSchema,
      capabilityId: 'player',
    });
  }

  public async getQueue(): Promise<QueueResponse> {
    return await this.http.request({
      path: '/me/player/queue',
      schema: QueueResponseSchema,
      capabilityId: 'queue',
    });
  }

  public async addToQueue(uri: string, deviceId?: string): Promise<void> {
    await this.http.request({
      path: '/me/player/queue',
      method: 'POST',
      query: { uri, device_id: deviceId },
      schema: NullableVoidSchema,
      capabilityId: 'queue',
    });
  }

  public async getRecentlyPlayed(limit = 50): Promise<RecentlyPlayedResponse> {
    return await this.http.request({
      path: '/me/player/recently-played',
      query: { limit: Math.min(50, Math.max(1, limit)) },
      schema: RecentlyPlayedResponseSchema,
      capabilityId: 'history',
    });
  }

  public async getTopTracks(timeRange: TopTimeRange = 'medium_term', limit = 20) {
    return await this.http.request({
      path: '/me/top/tracks',
      query: { time_range: timeRange, limit: Math.min(50, Math.max(1, limit)) },
      schema: createPaginatedSchema(TrackSchema),
      cacheTtlMs: 5 * 60_000,
      capabilityId: 'topItems',
    });
  }

  public async getTopArtists(timeRange: TopTimeRange = 'medium_term', limit = 20) {
    return await this.http.request({
      path: '/me/top/artists',
      query: { time_range: timeRange, limit: Math.min(50, Math.max(1, limit)) },
      schema: createPaginatedSchema(FullArtistSchema),
      cacheTtlMs: 5 * 60_000,
      capabilityId: 'topItems',
    });
  }

  public async getCurrentUserPlaylists(limit = 50, offset = 0) {
    return await this.http.request({
      path: '/me/playlists',
      query: { limit: Math.min(50, Math.max(1, limit)), offset },
      schema: createPaginatedSchema(SimplifiedPlaylistSchema),
      cacheTtlMs: 60_000,
      capabilityId: 'playlists',
    });
  }

  public async createPlaylist(params: {
    name: string;
    description?: string;
    public?: boolean;
  }): Promise<FullPlaylist> {
    return await this.http.request({
      path: '/me/playlists',
      method: 'POST',
      body: {
        name: params.name,
        description: params.description ?? '',
        public: params.public ?? false,
      },
      schema: FullPlaylistSchema,
      capabilityId: 'playlists',
    });
  }

  public async getPlaylist(playlistId: string): Promise<FullPlaylist> {
    return await this.http.request({
      path: `/playlists/${encodeURIComponent(playlistId)}`,
      schema: FullPlaylistSchema,
      cacheTtlMs: 60_000,
      capabilityId: 'playlists',
    });
  }

  public async updatePlaylistDetails(
    playlistId: string,
    details: { name?: string; description?: string; public?: boolean },
  ): Promise<void> {
    await this.http.request({
      path: `/playlists/${encodeURIComponent(playlistId)}`,
      method: 'PUT',
      body: details,
      schema: NullableVoidSchema,
      capabilityId: 'playlists',
    });
  }

  public async getPlaylistItems(
    playlistId: string,
    limit = 50,
    offset = 0,
  ): Promise<PlaylistItemsPage> {
    return await this.http.request({
      path: `/playlists/${encodeURIComponent(playlistId)}/items`,
      query: { limit: Math.min(50, Math.max(1, limit)), offset },
      schema: PlaylistItemsPageSchema,
      cacheTtlMs: 60_000,
      capabilityId: 'playlists',
    });
  }

  public async addItemsToPlaylist(playlistId: string, uris: readonly string[]): Promise<void> {
    for (const batch of chunkUris(uris, 100)) {
      await this.http.request({
        path: `/playlists/${encodeURIComponent(playlistId)}/items`,
        method: 'POST',
        body: { uris: batch },
        schema: NullableVoidSchema,
        capabilityId: 'playlists',
      });
    }
  }

  public async reorderPlaylistItems(
    playlistId: string,
    params: {
      rangeStart: number;
      insertBefore: number;
      rangeLength?: number;
      snapshotId?: string;
    },
  ): Promise<string> {
    const res = await this.http.request({
      path: `/playlists/${encodeURIComponent(playlistId)}/items`,
      method: 'PUT',
      body: {
        range_start: params.rangeStart,
        insert_before: params.insertBefore,
        range_length: params.rangeLength ?? 1,
        ...(params.snapshotId ? { snapshot_id: params.snapshotId } : {}),
      },
      schema: SnapshotResponseSchema,
      capabilityId: 'playlists',
    });
    return res.snapshot_id;
  }

  public async removePlaylistItems(playlistId: string, uris: readonly string[]): Promise<void> {
    for (const batch of chunkUris(uris, 100)) {
      await this.http.request({
        path: `/playlists/${encodeURIComponent(playlistId)}/items`,
        method: 'DELETE',
        body: {
          tracks: batch.map((uri) => ({ uri })),
          items: batch.map((uri) => ({ uri })),
        },
        schema: SnapshotResponseSchema,
        capabilityId: 'playlists',
      });
    }
  }

  public async saveToLibrary(uris: readonly string[]): Promise<void> {
    for (const batch of chunkUris(uris, SPOTIFY_LIBRARY_MAX_URIS_PER_BATCH)) {
      await this.http.request({
        path: '/me/library',
        method: 'PUT',
        query: { uris: batch.join(',') },
        schema: NullableVoidSchema,
        capabilityId: 'library',
      });
    }
  }

  public async removeFromLibrary(uris: readonly string[]): Promise<void> {
    for (const batch of chunkUris(uris, SPOTIFY_LIBRARY_MAX_URIS_PER_BATCH)) {
      await this.http.request({
        path: '/me/library',
        method: 'DELETE',
        query: { uris: batch.join(',') },
        schema: NullableVoidSchema,
        capabilityId: 'library',
      });
    }
  }

  public async checkLibraryContains(uris: readonly string[]): Promise<boolean[]> {
    if (uris.length === 0) {
      return [];
    }
    const results: boolean[] = [];
    for (const batch of chunkUris(uris, SPOTIFY_LIBRARY_MAX_URIS_PER_BATCH)) {
      const part = await this.http.request({
        path: '/me/library/contains',
        query: { uris: batch.join(',') },
        schema: BooleanArraySchema,
        capabilityId: 'library',
      });
      results.push(...part);
    }
    return results;
  }

  public async getSavedTracks(limit = 50, offset = 0) {
    return await this.http.request({
      path: '/me/tracks',
      query: { limit: Math.min(50, Math.max(1, limit)), offset },
      schema: createPaginatedSchema(SavedTrackSchema),
      cacheTtlMs: 60_000,
      capabilityId: 'library',
    });
  }

  public async getSavedAlbums(limit = 50, offset = 0) {
    return await this.http.request({
      path: '/me/albums',
      query: { limit: Math.min(50, Math.max(1, limit)), offset },
      schema: createPaginatedSchema(SavedAlbumSchema),
      cacheTtlMs: 60_000,
      capabilityId: 'library',
    });
  }

  public async getFollowedArtists(limit = 50, after?: string) {
    return await this.http.request({
      path: '/me/following',
      query: { type: 'artist', limit: Math.min(50, Math.max(1, limit)), after },
      schema: FollowedArtistsResponseSchema,
      cacheTtlMs: 60_000,
      capabilityId: 'library',
    });
  }

  public async search(params: {
    q: string;
    types: readonly ('track' | 'album' | 'artist' | 'playlist')[];
    limit?: number;
    offset?: number;
  }): Promise<SearchResponse> {
    return await this.http.request({
      path: '/search',
      query: {
        q: params.q,
        type: params.types.join(','),
        // Strictly clamp to <= 10 per Spotify's Feb 2026 Search parameter limit
        limit: clampSpotifySearchLimit(params.limit),
        offset: params.offset ?? 0,
      },
      schema: SearchResponseSchema,
      cacheTtlMs: 30_000,
      capabilityId: 'search',
    });
  }

  public async getTrack(trackId: string): Promise<Track> {
    return await this.http.request({
      path: `/tracks/${encodeURIComponent(trackId)}`,
      schema: TrackSchema,
      cacheTtlMs: 10 * 60_000,
    });
  }

  public async getAlbum(albumId: string): Promise<FullAlbum> {
    return await this.http.request({
      path: `/albums/${encodeURIComponent(albumId)}`,
      schema: FullAlbumSchema,
      cacheTtlMs: 10 * 60_000,
    });
  }

  public async getArtist(artistId: string): Promise<FullArtist> {
    return await this.http.request({
      path: `/artists/${encodeURIComponent(artistId)}`,
      schema: FullArtistSchema,
      cacheTtlMs: 10 * 60_000,
    });
  }

  public async getArtistAlbums(artistId: string, limit = 20, offset = 0) {
    return await this.http.request({
      path: `/artists/${encodeURIComponent(artistId)}/albums`,
      query: {
        include_groups: 'album,single',
        limit: Math.min(50, Math.max(1, limit)),
        offset,
      },
      schema: createPaginatedSchema(SimplifiedAlbumSchema),
      cacheTtlMs: 10 * 60_000,
    });
  }
}
