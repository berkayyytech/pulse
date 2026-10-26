/**
 * Recorded 2026 Spotify Development Mode payloads reflecting February/March 2026 removals & renames:
 * - User omits `product`, `email`, `country`, `explicit_content`, `followers`.
 * - Track/Artist/Album omit `popularity`, `available_markets`, `label`, `followers`.
 * - Playlists use `items` (instead of `tracks`) and item `item` (instead of `track`).
 * - Unowned/editorial playlists omit `items` completely.
 */
export const fixture2026User = {
  id: 'pulse_dev_user_01',
  account_id: 'acc_9f8a7b6c',
  display_name: 'Studio Listener',
  uri: 'spotify:user:pulse_dev_user_01',
  href: 'https://api.spotify.com/v1/users/pulse_dev_user_01',
  images: [{ url: 'https://i.scdn.co/image/ab6775700000ee850001', height: 300, width: 300 }],
  external_urls: { spotify: 'https://open.spotify.com/user/pulse_dev_user_01' },
  type: 'user',
};

export const fixture2026Track = {
  id: '3n3Ppam7vgaVa1iaRUc9Lp',
  name: 'Midnight Oscillations',
  uri: 'spotify:track:3n3Ppam7vgaVa1iaRUc9Lp',
  duration_ms: 222_400,
  explicit: false,
  disc_number: 1,
  track_number: 2,
  is_local: false,
  artists: [
    {
      id: '0OdUWJ0sBjDrqHygGUXeCF',
      name: 'Warm Phosphor Trio',
      uri: 'spotify:artist:0OdUWJ0sBjDrqHygGUXeCF',
      href: 'https://api.spotify.com/v1/artists/0OdUWJ0sBjDrqHygGUXeCF',
      external_urls: { spotify: 'https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF' },
    },
  ],
  album: {
    id: '4aawyAB9vmqN3uQ7FjRGTy',
    name: 'Analog Tape Sessions',
    album_type: 'album',
    total_tracks: 9,
    release_date: '2026-04-12',
    release_date_precision: 'day',
    uri: 'spotify:album:4aawyAB9vmqN3uQ7FjRGTy',
    href: 'https://api.spotify.com/v1/albums/4aawyAB9vmqN3uQ7FjRGTy',
    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2730001', height: 640, width: 640 }],
    artists: [
      {
        id: '0OdUWJ0sBjDrqHygGUXeCF',
        name: 'Warm Phosphor Trio',
        uri: 'spotify:artist:0OdUWJ0sBjDrqHygGUXeCF',
        href: 'https://api.spotify.com/v1/artists/0OdUWJ0sBjDrqHygGUXeCF',
        external_urls: { spotify: 'https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF' },
      },
    ],
    external_urls: { spotify: 'https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy' },
  },
  external_urls: { spotify: 'https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp' },
  type: 'track',
};

export const fixture2026OwnedPlaylistsPage = {
  href: 'https://api.spotify.com/v1/me/playlists?offset=0&limit=50',
  limit: 50,
  next: null,
  offset: 0,
  previous: null,
  total: 1,
  items: [
    {
      id: 'pl_owned_01',
      name: 'Late Night Mixes',
      description: 'Curated analog synth favorites',
      collaborative: false,
      public: false,
      snapshot_id: 'snap_2026_abc',
      uri: 'spotify:playlist:pl_owned_01',
      images: [{ url: 'https://i.scdn.co/image/ab67706c0000da840001', height: 640, width: 640 }],
      owner: {
        id: 'pulse_dev_user_01',
        display_name: 'Studio Listener',
        uri: 'spotify:user:pulse_dev_user_01',
      },
      external_urls: { spotify: 'https://open.spotify.com/playlist/pl_owned_01' },
      items: {
        href: 'https://api.spotify.com/v1/playlists/pl_owned_01/items',
        total: 1,
      },
    },
  ],
};

export const fixture2026PlaylistItemsPage = {
  href: 'https://api.spotify.com/v1/playlists/pl_owned_01/items?offset=0&limit=50',
  limit: 50,
  next: null,
  offset: 0,
  previous: null,
  total: 2,
  items: [
    {
      added_at: '2026-06-01T19:22:00Z',
      added_by: { id: 'pulse_dev_user_01', uri: 'spotify:user:pulse_dev_user_01' },
      is_local: false,
      item: fixture2026Track,
    },
    {
      added_at: '2026-06-02T11:00:00Z',
      added_by: { id: 'pulse_dev_user_01', uri: 'spotify:user:pulse_dev_user_01' },
      is_local: false,
      item: null,
    },
  ],
};

/** Editorial/unowned playlist in 2026 Dev Mode where `items` is omitted entirely */
export const fixture2026UnownedEditorialPlaylist = {
  id: '37i9dQZF1DXcBWIGoYBM5M',
  name: 'Editorial Synth Focus',
  description: 'Basic metadata only in Dev Mode',
  collaborative: false,
  public: true,
  snapshot_id: 'snap_editorial_01',
  uri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M',
  images: [],
  owner: {
    id: 'spotify',
    display_name: 'Spotify',
    uri: 'spotify:user:spotify',
  },
  external_urls: { spotify: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' },
};

export const fixture2026PlaybackState = {
  device: {
    id: 'dev_pulse_sdk_01',
    is_active: true,
    is_private_session: false,
    is_restricted: false,
    name: 'Pulse Web Player',
    type: 'Computer',
    volume_percent: 78,
    supports_volume: true,
  },
  repeat_state: 'context',
  shuffle_state: false,
  timestamp: 1792960000000,
  progress_ms: 48_200,
  is_playing: true,
  currently_playing_type: 'track',
  item: fixture2026Track,
};
