import type { Track } from '@/api/schemas/catalog';
import { getValidAccessToken } from '@/features/auth/authService';
import { useCapabilityStore } from '@/stores/capabilityStore';
import { usePlayerStore } from '@/stores/playerStore';

interface SpotifySdkTrack {
  id: string | null;
  uri: string;
  name: string;
  duration_ms: number;
  artists: { name: string; uri: string }[];
  album: {
    name: string;
    uri: string;
    images: { url: string; height?: number; width?: number }[];
  };
}

interface SpotifySdkState {
  paused: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat_mode: 0 | 1 | 2;
  track_window: {
    current_track: SpotifySdkTrack | null;
  };
}

export interface SpotifyWebPlayerInstance {
  connect(): Promise<boolean>;
  disconnect(): void;
  togglePlay(): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  seek(posMs: number): Promise<void>;
  setVolume(fraction: number): Promise<void>;
  addListener(event: string, cb: (payload: unknown) => void): boolean;
}

interface WindowWithSpotifySdk extends Window {
  onSpotifyWebPlaybackSDKReady?: () => void;
  Spotify?: {
    Player: new (opts: {
      name: string;
      getOAuthToken: (cb: (token: string) => void) => void;
      volume?: number;
    }) => SpotifyWebPlayerInstance;
  };
}

let sdkPlayer: SpotifyWebPlayerInstance | null = null;
let sdkLoadPromise: Promise<SpotifyWebPlayerInstance | null> | null = null;

function mapSdkTrack(sdkTrack: SpotifySdkTrack, durationMs: number): Track {
  const trackId = sdkTrack.id ?? (sdkTrack.uri.split(':')[2] ?? null);
  return {
    id: trackId,
    name: sdkTrack.name,
    uri: sdkTrack.uri,
    duration_ms: sdkTrack.duration_ms || durationMs,
    explicit: false,
    disc_number: 1,
    track_number: 1,
    is_local: false,
    artists: sdkTrack.artists.map((a) => ({
      id: a.uri.split(':')[2] ?? null,
      name: a.name,
      uri: a.uri,
      href: null,
      external_urls: {},
    })),
    album: {
      id: sdkTrack.album.uri.split(':')[2] ?? null,
      name: sdkTrack.album.name,
      album_type: 'album',
      total_tracks: 0,
      release_date: '',
      release_date_precision: 'day',
      uri: sdkTrack.album.uri,
      href: null,
      images: sdkTrack.album.images.map((img) => ({
        url: img.url,
        height: img.height ?? null,
        width: img.width ?? null,
      })),
      artists: [],
      external_urls: {},
    },
    external_urls: trackId ? { spotify: `https://open.spotify.com/track/${trackId}` } : {},
    type: 'track',
  };
}

export function getActiveSdkPlayer(): SpotifyWebPlayerInstance | null {
  return sdkPlayer;
}

export async function initializeWebPlaybackSdk(): Promise<SpotifyWebPlayerInstance | null> {
  if (sdkPlayer) {
    return sdkPlayer;
  }
  if (sdkLoadPromise) {
    return await sdkLoadPromise;
  }

  sdkLoadPromise = new Promise<SpotifyWebPlayerInstance | null>((resolve) => {
    const win = window as WindowWithSpotifySdk;

    const createPlayer = () => {
      if (!win.Spotify) {
        resolve(null);
        return;
      }
      const instance = new win.Spotify.Player({
        name: 'Pulse Web Player',
        volume: usePlayerStore.getState().volumePercent / 100,
        getOAuthToken: (cb) => {
          void getValidAccessToken().then((token) => {
            if (token) {
              cb(token);
            }
          });
        },
      });

      instance.addListener('ready', (payload) => {
        const { device_id } = payload as { device_id: string };
        usePlayerStore.getState().setSdkDevice(device_id, true);
      });

      instance.addListener('not_ready', () => {
        usePlayerStore.getState().setSdkDevice(null, false);
      });

      instance.addListener('account_error', () => {
        useCapabilityStore.getState().pushAlert({
          id: 'sdk-premium-required',
          kind: '403-degraded',
          message:
            'Spotify Web Playback SDK requires an active Spotify Premium subscription. Switching to Connect Remote Control check.',
        });
        usePlayerStore.getState().setEngine('connect-remote');
      });

      instance.addListener('initialization_error', () => {
        usePlayerStore.getState().setEngine('connect-remote');
      });

      instance.addListener('player_state_changed', (rawState) => {
        const state = rawState as SpotifySdkState | null;
        if (!state) {
          return;
        }
        const repeatMode =
          state.repeat_mode === 2 ? 'track' : state.repeat_mode === 1 ? 'context' : 'off';
        usePlayerStore.getState().setPlaybackSnapshot({
          currentTrack: state.track_window.current_track
            ? mapSdkTrack(state.track_window.current_track, state.duration)
            : null,
          isPlaying: !state.paused,
          positionMs: state.position,
          shuffle: state.shuffle,
          repeatMode,
        });
      });

      void instance.connect().then((connected) => {
        if (connected) {
          sdkPlayer = instance;
          resolve(instance);
        } else {
          resolve(null);
        }
      });
    };

    if (win.Spotify) {
      createPlayer();
      return;
    }

    // Attach global callback BEFORE injecting script to avoid SDK race conditions
    win.onSpotifyWebPlaybackSDKReady = createPlayer;

    const existingScript = document.querySelector(
      'script[src="https://sdk.scdn.co/spotify-player.js"]',
    );
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.onerror = () => {
        resolve(null);
      };
      document.head.appendChild(script);
    }
  }).finally(() => {
    sdkLoadPromise = null;
  });

  return await sdkLoadPromise;
}

export function disconnectWebPlaybackSdk(): void {
  if (sdkPlayer) {
    sdkPlayer.disconnect();
    sdkPlayer = null;
  }
  usePlayerStore.getState().setSdkDevice(null, false);
}
