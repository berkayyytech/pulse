import type { FullAlbum, FullArtist, Track } from './schemas/catalog';
import type { ConnectDevice, PlaybackState, QueueResponse } from './schemas/player';
import type { FullPlaylist, PlaylistItemsPage, SimplifiedPlaylist } from './schemas/playlist';
import type { UserProfile } from './schemas/user';

const DEMO_SVG_ART_1 =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="560" viewBox="0 0 560 560"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#E7F5FA"/><stop offset="52%" stop-color="#9AC0CE"/><stop offset="100%" stop-color="#203742"/></linearGradient></defs><rect width="560" height="560" fill="url(#g1)"/><circle cx="280" cy="240" r="88" fill="#0B181E"/><path d="M162 490 C180 356 380 356 398 490 Z" fill="#09151B"/><ellipse cx="280" cy="186" rx="134" ry="26" fill="#071116"/><path d="M210 186 C225 130 335 130 350 186 Z" fill="#0B181E"/></svg>',
  );

const DEMO_SVG_ART_2 =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="560" viewBox="0 0 560 560"><defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#4A3F9F"/><stop offset="52%" stop-color="#9A366E"/><stop offset="100%" stop-color="#19162B"/></linearGradient></defs><rect width="560" height="560" fill="url(#g2)"/><circle cx="280" cy="280" r="148" fill="none" stroke="#FFFFFF" stroke-opacity="0.34" stroke-width="18"/><circle cx="280" cy="280" r="54" fill="#FFFFFF" fill-opacity="0.22"/></svg>',
  );

const DEMO_SVG_ART_3 =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="560" viewBox="0 0 560 560"><rect width="560" height="560" fill="#F4F4F6"/><rect x="290" width="270" height="560" fill="#8C5327"/><circle cx="310" cy="245" r="115" fill="#1E1410"/><rect x="44" y="44" width="190" height="190" rx="28" fill="#1E1410" opacity="0.12"/></svg>',
  );

const DEMO_SVG_ART_4 =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="560" viewBox="0 0 560 560"><defs><linearGradient id="g4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1D4ED8"/><stop offset="60%" stop-color="#0F172A"/><stop offset="100%" stop-color="#020617"/></linearGradient></defs><rect width="560" height="560" fill="url(#g4)"/><circle cx="280" cy="280" r="175" fill="#38BDF8" opacity="0.22"/><path d="M90 360 Q280 200 470 360" stroke="#93C5FD" stroke-width="22" fill="none" stroke-linecap="round"/></svg>',
  );

const DEMO_SVG_ART_5 =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="560" viewBox="0 0 560 560"><defs><linearGradient id="g5" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#F59E0B"/><stop offset="50%" stop-color="#B45309"/><stop offset="100%" stop-color="#291205"/></linearGradient></defs><rect width="560" height="560" fill="url(#g5)"/><circle cx="280" cy="250" r="112" fill="#FFFBEB" opacity="0.88"/><rect x="120" y="340" width="320" height="140" rx="24" fill="#1C0C04" opacity="0.82"/></svg>',
  );

export const DEMO_USER: UserProfile = {
  id: 'pulse_demo_listener',
  display_name: 'Offline Demo Studio',
  uri: 'spotify:user:pulse_demo_listener',
  href: '',
  images: [{ url: DEMO_SVG_ART_1, height: 320, width: 320 }],
  external_urls: { spotify: 'https://open.spotify.com' },
  type: 'user',
};

export const DEMO_ARTIST_PHOSPHOR: FullArtist = {
  id: 'art_phosphor',
  name: 'Warm Phosphor Trio',
  uri: 'spotify:artist:art_phosphor',
  href: null,
  genres: ['analog ambient', 'modular jazz'],
  images: [{ url: DEMO_SVG_ART_1, height: 320, width: 320 }],
  external_urls: { spotify: 'https://open.spotify.com' },
};

export const DEMO_ARTIST_NORDIC: FullArtist = {
  id: 'art_nordic',
  name: 'Subzero Tape Loop',
  uri: 'spotify:artist:art_nordic',
  href: null,
  genres: ['dub techno', 'minimal synth'],
  images: [{ url: DEMO_SVG_ART_2, height: 320, width: 320 }],
  external_urls: { spotify: 'https://open.spotify.com' },
};

export const DEMO_ARTISTS: FullArtist[] = [DEMO_ARTIST_PHOSPHOR, DEMO_ARTIST_NORDIC];

export const DEMO_ALBUM_ANALOG: FullAlbum = {
  id: 'alb_analog_01',
  name: 'Analog Tape Sessions',
  album_type: 'album',
  total_tracks: 3,
  release_date: '2026-04-12',
  release_date_precision: 'day',
  uri: 'spotify:album:alb_analog_01',
  href: null,
  images: [{ url: DEMO_SVG_ART_1, height: 320, width: 320 }],
  artists: [DEMO_ARTIST_PHOSPHOR],
  external_urls: { spotify: 'https://open.spotify.com' },
  copyrights: [{ text: '2026 Studio Glass Pressing (Demo)', type: 'C' }],
};

export const DEMO_ALBUM_GLACIER: FullAlbum = {
  id: 'alb_glacier_02',
  name: 'Glacier Telemetry',
  album_type: 'album',
  total_tracks: 3,
  release_date: '2025-11-03',
  release_date_precision: 'day',
  uri: 'spotify:album:alb_glacier_02',
  href: null,
  images: [{ url: DEMO_SVG_ART_2, height: 320, width: 320 }],
  artists: [DEMO_ARTIST_NORDIC],
  external_urls: { spotify: 'https://open.spotify.com' },
  copyrights: [{ text: '2025 Subzero Lab (Demo)', type: 'C' }],
};

export const DEMO_ALBUMS: FullAlbum[] = [DEMO_ALBUM_ANALOG, DEMO_ALBUM_GLACIER];

export const DEMO_TRACK_1: Track = {
  id: 'trk_01',
  name: 'Midnight Oscillations',
  uri: 'spotify:track:trk_01',
  duration_ms: 222_400,
  explicit: false,
  disc_number: 1,
  track_number: 1,
  is_local: false,
  artists: [DEMO_ARTIST_PHOSPHOR],
  album: DEMO_ALBUM_ANALOG,
  external_urls: { spotify: 'https://open.spotify.com' },
  type: 'track',
};

export const DEMO_TRACK_2: Track = {
  id: 'trk_02',
  name: 'VU Meter Drift',
  uri: 'spotify:track:trk_02',
  duration_ms: 198_000,
  explicit: false,
  disc_number: 1,
  track_number: 2,
  is_local: false,
  artists: [DEMO_ARTIST_PHOSPHOR],
  album: { ...DEMO_ALBUM_ANALOG, images: [{ url: DEMO_SVG_ART_3, height: 560, width: 560 }] },
  external_urls: { spotify: 'https://open.spotify.com' },
  type: 'track',
};

export const DEMO_TRACK_3: Track = {
  id: 'trk_03',
  name: 'Amber Cathode Glow',
  uri: 'spotify:track:trk_03',
  duration_ms: 254_100,
  explicit: false,
  disc_number: 1,
  track_number: 3,
  is_local: false,
  artists: [DEMO_ARTIST_PHOSPHOR],
  album: { ...DEMO_ALBUM_ANALOG, images: [{ url: DEMO_SVG_ART_5, height: 560, width: 560 }] },
  external_urls: { spotify: 'https://open.spotify.com' },
  type: 'track',
};

export const DEMO_TRACKS: Track[] = [
  DEMO_TRACK_1,
  DEMO_TRACK_2,
  DEMO_TRACK_3,
  {
    id: 'trk_04',
    name: 'Reykjavik Signal Tower',
    uri: 'spotify:track:trk_04',
    duration_ms: 276_500,
    explicit: false,
    disc_number: 1,
    track_number: 1,
    is_local: false,
    artists: [DEMO_ARTIST_NORDIC],
    album: { ...DEMO_ALBUM_GLACIER, images: [{ url: DEMO_SVG_ART_4, height: 560, width: 560 }] },
    external_urls: { spotify: 'https://open.spotify.com' },
    type: 'track',
  },
  {
    id: 'trk_05',
    name: 'Harmonic Transient (Explicit Cut)',
    uri: 'spotify:track:trk_05',
    duration_ms: 184_000,
    explicit: true,
    disc_number: 1,
    track_number: 2,
    is_local: false,
    artists: [DEMO_ARTIST_NORDIC],
    album: DEMO_ALBUM_GLACIER,
    external_urls: { spotify: 'https://open.spotify.com' },
    type: 'track',
  },
  {
    id: 'trk_06',
    name: 'Quiet Tape Hiss',
    uri: 'spotify:track:trk_06',
    duration_ms: 162_800,
    explicit: false,
    disc_number: 1,
    track_number: 3,
    is_local: false,
    artists: [DEMO_ARTIST_NORDIC],
    album: DEMO_ALBUM_GLACIER,
    external_urls: { spotify: 'https://open.spotify.com' },
    type: 'track',
  },
];

export const DEMO_DEVICES: ConnectDevice[] = [
  {
    id: 'demo_pulse_sdk',
    is_active: true,
    is_private_session: false,
    is_restricted: false,
    name: 'Pulse Web Player (This Window)',
    type: 'Computer',
    volume_percent: 80,
    supports_volume: true,
  },
  {
    id: 'demo_studio_monitors',
    is_active: false,
    is_private_session: false,
    is_restricted: false,
    name: 'Desk Reference Monitors (Connect)',
    type: 'Speaker',
    volume_percent: 65,
    supports_volume: true,
  },
];

export function createInitialDemoState() {
  const likedDates = [
    new Date(Date.now() - 3 * 86_400_000).toISOString(),
    new Date(Date.now() - 9 * 86_400_000).toISOString(),
    new Date(Date.now() - 18 * 86_400_000).toISOString(),
    new Date(Date.now() - 45 * 86_400_000).toISOString(),
    new Date(Date.now() - 120 * 86_400_000).toISOString(),
    new Date(Date.now() - 12 * 86_400_000).toISOString(),
  ];

  const savedTracks = DEMO_TRACKS.map((track, idx) => ({
    added_at: likedDates[idx] ?? new Date().toISOString(),
    track,
  }));

  const playlists: { meta: SimplifiedPlaylist; items: Track[]; restricted?: boolean }[] = [
    {
      meta: {
        id: 'pl_demo_studio',
        name: 'Late Night Mastering Desk',
        description: 'Owned playlist — supports reorder, bulk add/remove & smart export',
        collaborative: false,
        public: false,
        snapshot_id: 'snap_demo_1',
        uri: 'spotify:playlist:pl_demo_studio',
        images: [{ url: DEMO_SVG_ART_1, height: 320, width: 320 }],
        owner: {
          id: DEMO_USER.id,
          display_name: DEMO_USER.display_name,
          uri: DEMO_USER.uri,
        },
        external_urls: { spotify: 'https://open.spotify.com' },
        itemsSummary: { href: '', total: 4 },
        usedLegacyTracksSummary: false,
      },
      items: DEMO_TRACKS.slice(0, 4),
    },
    {
      meta: {
        id: 'pl_demo_editorial',
        name: 'Spotify Editorial Ambient (2026 Restricted)',
        description: 'Demonstrates graceful UI handling when 2026 Dev Mode omits unowned items',
        collaborative: false,
        public: true,
        snapshot_id: 'snap_editorial',
        uri: 'spotify:playlist:pl_demo_editorial',
        images: [{ url: DEMO_SVG_ART_2, height: 320, width: 320 }],
        owner: {
          id: 'spotify',
          display_name: 'Spotify',
          uri: 'spotify:user:spotify',
        },
        external_urls: { spotify: 'https://open.spotify.com' },
        itemsSummary: null,
        usedLegacyTracksSummary: false,
      },
      items: [],
      restricted: true,
    },
  ];

  const playback: PlaybackState = {
    device: DEMO_DEVICES[0],
    repeat_state: 'context',
    shuffle_state: false,
    timestamp: Date.now(),
    progress_ms: 42_000,
    is_playing: false,
    currently_playing_type: 'track',
    item: DEMO_TRACK_1,
  };

  const queue: QueueResponse = {
    currently_playing: DEMO_TRACK_1,
    queue: DEMO_TRACKS.slice(1, 4),
  };

  return { savedTracks, playlists, playback, queue, devices: [...DEMO_DEVICES] };
}

export function buildPlaylistItemsPage(tracks: readonly Track[]): PlaylistItemsPage {
  return {
    href: '',
    limit: 50,
    next: null,
    offset: 0,
    previous: null,
    total: tracks.length,
    items: tracks.map((track) => ({
      added_at: new Date().toISOString(),
      added_by_id: DEMO_USER.id,
      is_local: false,
      item: track,
      usedLegacyTrackField: false,
    })),
  };
}

export function buildFullDemoPlaylist(entry: {
  meta: SimplifiedPlaylist;
  items: readonly Track[];
  restricted?: boolean;
}): FullPlaylist {
  return {
    id: entry.meta.id,
    name: entry.meta.name,
    description: entry.meta.description,
    collaborative: entry.meta.collaborative,
    public: entry.meta.public,
    snapshot_id: entry.meta.snapshot_id,
    uri: entry.meta.uri,
    images: entry.meta.images,
    owner: entry.meta.owner,
    external_urls: entry.meta.external_urls,
    items: entry.restricted ? null : buildPlaylistItemsPage(entry.items),
    itemsRestrictedByDevMode: Boolean(entry.restricted),
  };
}
