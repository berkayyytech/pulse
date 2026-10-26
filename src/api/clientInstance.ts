import { SpotifyHttpEngine } from './httpClient';
import { SpotifyClient, type RepeatMode, type TopTimeRange } from './spotifyClient';
import { getValidAccessToken } from '@/features/auth/authService';
import { useAuthStore } from '@/stores/authStore';
import {
  buildFullDemoPlaylist,
  buildPlaylistItemsPage,
  createInitialDemoState,
  DEMO_ALBUM_ANALOG,
  DEMO_ALBUMS,
  DEMO_ARTIST_PHOSPHOR,
  DEMO_ARTISTS,
  DEMO_TRACKS,
  DEMO_USER,
} from './demoCatalog';
import type { SearchResponse } from './schemas/search';

class DemoSpotifyClient extends SpotifyClient {
  private state = createInitialDemoState();

  public constructor() {
    super(
      new SpotifyHttpEngine({
        getAccessToken: () => Promise.resolve('demo-token'),
      }),
    );
  }

  public override getCurrentUser() {
    return Promise.resolve(DEMO_USER);
  }

  public override getPlaybackState() {
    return Promise.resolve({ ...this.state.playback });
  }

  public override getAvailableDevices() {
    return Promise.resolve([...this.state.devices]);
  }

  public override transferPlayback(deviceId: string, play = true) {
    this.state.devices = this.state.devices.map((d) => ({
      ...d,
      is_active: d.id === deviceId,
    }));
    const active = this.state.devices.find((d) => d.id === deviceId) ?? this.state.devices[0];
    this.state.playback = {
      ...this.state.playback,
      device: active,
      is_playing: play,
    };
    return Promise.resolve();
  }

  public override play(params?: {
    deviceId?: string;
    contextUri?: string;
    uris?: readonly string[];
    offsetUri?: string;
    positionMs?: number;
  }) {
    const targetUri = params?.offsetUri ?? params?.uris?.[0];
    const matched = targetUri ? DEMO_TRACKS.find((t) => t.uri === targetUri) : undefined;
    this.state.playback = {
      ...this.state.playback,
      is_playing: true,
      progress_ms: params?.positionMs ?? 0,
      item: matched ?? this.state.playback.item ?? DEMO_TRACKS[0] ?? null,
    };
    return Promise.resolve();
  }

  public override pause() {
    this.state.playback = { ...this.state.playback, is_playing: false };
    return Promise.resolve();
  }

  public override skipNext() {
    const idx = DEMO_TRACKS.findIndex((t) => t.uri === this.state.playback.item?.uri);
    const nextTrack = DEMO_TRACKS[(idx + 1) % DEMO_TRACKS.length] ?? DEMO_TRACKS[0] ?? null;
    this.state.playback = { ...this.state.playback, item: nextTrack, progress_ms: 0 };
    return Promise.resolve();
  }

  public override skipPrevious() {
    const idx = DEMO_TRACKS.findIndex((t) => t.uri === this.state.playback.item?.uri);
    const prevIdx = idx <= 0 ? DEMO_TRACKS.length - 1 : idx - 1;
    const prevTrack = DEMO_TRACKS[prevIdx] ?? DEMO_TRACKS[0] ?? null;
    this.state.playback = { ...this.state.playback, item: prevTrack, progress_ms: 0 };
    return Promise.resolve();
  }

  public override seek(positionMs: number) {
    this.state.playback = { ...this.state.playback, progress_ms: positionMs };
    return Promise.resolve();
  }

  public override setVolume(volumePercent: number) {
    if (this.state.playback.device) {
      this.state.playback = {
        ...this.state.playback,
        device: { ...this.state.playback.device, volume_percent: volumePercent },
      };
    }
    return Promise.resolve();
  }

  public override setShuffle(shuffle: boolean) {
    this.state.playback = { ...this.state.playback, shuffle_state: shuffle };
    return Promise.resolve();
  }

  public override setRepeatMode(repeat: RepeatMode) {
    this.state.playback = { ...this.state.playback, repeat_state: repeat };
    return Promise.resolve();
  }

  public override getQueue() {
    return Promise.resolve({
      currently_playing: this.state.playback.item,
      queue: [...this.state.queue.queue],
    });
  }

  public override addToQueue(uri: string) {
    const found = DEMO_TRACKS.find((t) => t.uri === uri);
    if (found) {
      this.state.queue.queue.push(found);
    }
    return Promise.resolve();
  }

  public override getRecentlyPlayed() {
    return Promise.resolve({
      items: DEMO_TRACKS.slice(0, 4).map((track, idx) => ({
        track,
        played_at: new Date(Date.now() - idx * 3_600_000).toISOString(),
      })),
      next: null,
    });
  }

  public override getTopTracks(_timeRange: TopTimeRange = 'medium_term') {
    return Promise.resolve({
      href: '',
      items: [...DEMO_TRACKS],
      limit: 20,
      next: null,
      offset: 0,
      previous: null,
      total: DEMO_TRACKS.length,
    });
  }

  public override getTopArtists(_timeRange: TopTimeRange = 'medium_term') {
    return Promise.resolve({
      href: '',
      items: [...DEMO_ARTISTS],
      limit: 20,
      next: null,
      offset: 0,
      previous: null,
      total: DEMO_ARTISTS.length,
    });
  }

  public override getCurrentUserPlaylists() {
    return Promise.resolve({
      href: '',
      items: this.state.playlists.map((p) => p.meta),
      limit: 50,
      next: null,
      offset: 0,
      previous: null,
      total: this.state.playlists.length,
    });
  }

  public override createPlaylist(params: {
    name: string;
    description?: string;
    public?: boolean;
  }) {
    const id = `pl_demo_${Date.now()}`;
    const newEntry = {
      meta: {
        id,
        name: params.name,
        description: params.description ?? '',
        collaborative: false,
        public: params.public ?? false,
        snapshot_id: `snap_${Date.now()}`,
        uri: `spotify:playlist:${id}`,
        images: [],
        owner: {
          id: DEMO_USER.id,
          display_name: DEMO_USER.display_name,
          uri: DEMO_USER.uri,
        },
        external_urls: { spotify: 'https://open.spotify.com' },
        itemsSummary: { href: '', total: 0 },
        usedLegacyTracksSummary: false,
      },
      items: [],
    };
    this.state.playlists.unshift(newEntry);
    return Promise.resolve(buildFullDemoPlaylist(newEntry));
  }

  public override getPlaylist(playlistId: string) {
    const entry = this.state.playlists.find((p) => p.meta.id === playlistId);
    if (!entry) {
      throw new Error(`Playlist not found: ${playlistId}`);
    }
    return Promise.resolve(buildFullDemoPlaylist(entry));
  }

  public override getPlaylistItems(playlistId: string) {
    const entry = this.state.playlists.find((p) => p.meta.id === playlistId);
    return Promise.resolve(buildPlaylistItemsPage(entry?.items ?? []));
  }

  public override addItemsToPlaylist(playlistId: string, uris: readonly string[]) {
    const entry = this.state.playlists.find((p) => p.meta.id === playlistId);
    if (entry && !entry.restricted) {
      for (const uri of uris) {
        const track = DEMO_TRACKS.find((t) => t.uri === uri);
        if (track) {
          entry.items.push(track);
        }
      }
      entry.meta = {
        ...entry.meta,
        itemsSummary: { href: '', total: entry.items.length },
      };
    }
    return Promise.resolve();
  }

  public override reorderPlaylistItems(
    playlistId: string,
    params: { rangeStart: number; insertBefore: number },
  ) {
    const entry = this.state.playlists.find((p) => p.meta.id === playlistId);
    if (entry && !entry.restricted) {
      const moved = entry.items.splice(params.rangeStart, 1)[0];
      if (moved) {
        const target =
          params.insertBefore > params.rangeStart ? params.insertBefore - 1 : params.insertBefore;
        entry.items.splice(Math.max(0, target), 0, moved);
      }
    }
    return Promise.resolve(`snap_${Date.now()}`);
  }

  public override removePlaylistItems(playlistId: string, uris: readonly string[]) {
    const entry = this.state.playlists.find((p) => p.meta.id === playlistId);
    if (entry && !entry.restricted) {
      const uriSet = new Set(uris);
      entry.items = entry.items.filter((t) => !uriSet.has(t.uri));
      entry.meta = {
        ...entry.meta,
        itemsSummary: { href: '', total: entry.items.length },
      };
    }
    return Promise.resolve();
  }

  public override saveToLibrary(uris: readonly string[]) {
    const existing = new Set(this.state.savedTracks.map((s) => s.track.uri));
    for (const uri of uris) {
      if (!existing.has(uri)) {
        const found = DEMO_TRACKS.find((t) => t.uri === uri);
        if (found) {
          this.state.savedTracks.unshift({
            added_at: new Date().toISOString(),
            track: found,
          });
        }
      }
    }
    return Promise.resolve();
  }

  public override removeFromLibrary(uris: readonly string[]) {
    const removeSet = new Set(uris);
    this.state.savedTracks = this.state.savedTracks.filter((s) => !removeSet.has(s.track.uri));
    return Promise.resolve();
  }

  public override checkLibraryContains(uris: readonly string[]) {
    const saved = new Set(this.state.savedTracks.map((s) => s.track.uri));
    return Promise.resolve(uris.map((u) => saved.has(u)));
  }

  public override getSavedTracks() {
    return Promise.resolve({
      href: '',
      items: [...this.state.savedTracks],
      limit: 50,
      next: null,
      offset: 0,
      previous: null,
      total: this.state.savedTracks.length,
    });
  }

  public override getSavedAlbums() {
    return Promise.resolve({
      href: '',
      items: DEMO_ALBUMS.map((album) => ({
        added_at: '2026-05-01T12:00:00Z',
        album: {
          ...album,
          tracks: {
            href: '',
            items: DEMO_TRACKS.filter((t) => t.album?.id === album.id),
            limit: 50,
            next: null,
            offset: 0,
            previous: null,
            total: 3,
          },
        },
      })),
      limit: 50,
      next: null,
      offset: 0,
      previous: null,
      total: DEMO_ALBUMS.length,
    });
  }

  public override getFollowedArtists() {
    return Promise.resolve({
      artists: {
        href: '',
        items: [...DEMO_ARTISTS],
        limit: 50,
        next: null,
        total: DEMO_ARTISTS.length,
      },
    });
  }

  public override search(params: {
    q: string;
    types: readonly ('track' | 'album' | 'artist' | 'playlist')[];
  }): Promise<SearchResponse> {
    const needle = params.q.trim().toLowerCase();
    const matchedTracks = DEMO_TRACKS.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        t.artists.some((a) => a.name.toLowerCase().includes(needle)),
    );
    const matchedAlbums = DEMO_ALBUMS.filter((a) => a.name.toLowerCase().includes(needle));
    const matchedArtists = DEMO_ARTISTS.filter((a) => a.name.toLowerCase().includes(needle));
    const matchedPlaylists = this.state.playlists
      .map((p) => p.meta)
      .filter((p) => p.name.toLowerCase().includes(needle));

    return Promise.resolve({
      tracks: {
        href: '',
        items: matchedTracks,
        limit: 10,
        next: null,
        offset: 0,
        previous: null,
        total: matchedTracks.length,
      },
      albums: {
        href: '',
        items: matchedAlbums,
        limit: 10,
        next: null,
        offset: 0,
        previous: null,
        total: matchedAlbums.length,
      },
      artists: {
        href: '',
        items: matchedArtists,
        limit: 10,
        next: null,
        offset: 0,
        previous: null,
        total: matchedArtists.length,
      },
      playlists: {
        href: '',
        items: matchedPlaylists,
        limit: 10,
        next: null,
        offset: 0,
        previous: null,
        total: matchedPlaylists.length,
      },
    });
  }

  public override getAlbum(albumId: string) {
    const album = DEMO_ALBUMS.find((a) => a.id === albumId) ?? DEMO_ALBUM_ANALOG;
    const tracks = DEMO_TRACKS.filter((t) => t.album?.id === album.id);
    return Promise.resolve({
      ...album,
      tracks: {
        href: '',
        items: tracks,
        limit: 50,
        next: null,
        offset: 0,
        previous: null,
        total: tracks.length,
      },
    });
  }

  public override getArtist(artistId: string) {
    const artist = DEMO_ARTISTS.find((a) => a.id === artistId) ?? DEMO_ARTIST_PHOSPHOR;
    return Promise.resolve(artist);
  }

  public override getArtistAlbums(artistId: string) {
    const albums = DEMO_ALBUMS.filter((a) => a.artists.some((ar) => ar.id === artistId));
    return Promise.resolve({
      href: '',
      items: albums,
      limit: 20,
      next: null,
      offset: 0,
      previous: null,
      total: albums.length,
    });
  }
}

const liveClient = new SpotifyClient(
  new SpotifyHttpEngine({
    getAccessToken: getValidAccessToken,
  }),
);

const demoClient = new DemoSpotifyClient();

export function getSpotifyClient(): SpotifyClient {
  return useAuthStore.getState().status === 'demo' ? demoClient : liveClient;
}
