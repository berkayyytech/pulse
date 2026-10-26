import { create } from 'zustand';
import { DEMO_TRACK_1 } from '@/api/demoCatalog';
import type { Track } from '@/api/schemas/catalog';
import type { ConnectDevice } from '@/api/schemas/player';
import type { RepeatMode } from '@/api/spotifyClient';

export type PlaybackEngineKind = 'sdk' | 'connect-remote';

interface PlayerState {
  readonly engine: PlaybackEngineKind;
  readonly sdkReady: boolean;
  readonly sdkDeviceId: string | null;
  readonly activeDevice: ConnectDevice | null;
  readonly availableDevices: readonly ConnectDevice[];
  readonly currentTrack: Track | null;
  readonly isPlaying: boolean;
  readonly positionMs: number;
  readonly volumePercent: number;
  readonly shuffle: boolean;
  readonly repeatMode: RepeatMode;
  readonly lyricsOpen: boolean;
  readonly queueOpen: boolean;
  setEngine: (engine: PlaybackEngineKind) => void;
  setSdkDevice: (deviceId: string | null, ready: boolean) => void;
  setAvailableDevices: (devices: readonly ConnectDevice[]) => void;
  setPlaybackSnapshot: (snapshot: {
    currentTrack?: Track | null;
    isPlaying?: boolean;
    positionMs?: number;
    volumePercent?: number;
    shuffle?: boolean;
    repeatMode?: RepeatMode;
    activeDevice?: ConnectDevice | null;
  }) => void;
  tickPosition: (deltaMs: number) => void;
  setLyricsOpen: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  engine: 'connect-remote',
  sdkReady: false,
  sdkDeviceId: null,
  activeDevice: null,
  availableDevices: [],
  currentTrack: DEMO_TRACK_1,
  isPlaying: false,
  positionMs: 32_000,
  volumePercent: 80,
  shuffle: false,
  repeatMode: 'off',
  lyricsOpen: false,
  queueOpen: false,
  setEngine: (engine) => {
    set({ engine });
  },
  setSdkDevice: (sdkDeviceId, sdkReady) => {
    set({ sdkDeviceId, sdkReady });
  },
  setAvailableDevices: (availableDevices) => {
    set({ availableDevices });
  },
  setPlaybackSnapshot: (snapshot) => {
    set((state) => ({
      currentTrack:
        snapshot.currentTrack !== undefined ? snapshot.currentTrack : state.currentTrack,
      isPlaying: snapshot.isPlaying !== undefined ? snapshot.isPlaying : state.isPlaying,
      positionMs: snapshot.positionMs !== undefined ? snapshot.positionMs : state.positionMs,
      volumePercent:
        snapshot.volumePercent !== undefined ? snapshot.volumePercent : state.volumePercent,
      shuffle: snapshot.shuffle !== undefined ? snapshot.shuffle : state.shuffle,
      repeatMode: snapshot.repeatMode !== undefined ? snapshot.repeatMode : state.repeatMode,
      activeDevice:
        snapshot.activeDevice !== undefined ? snapshot.activeDevice : state.activeDevice,
    }));
  },
  tickPosition: (deltaMs) => {
    set((state) => {
      if (!state.isPlaying || !state.currentTrack) {
        return state;
      }
      const nextPos = Math.min(state.currentTrack.duration_ms, state.positionMs + deltaMs);
      return { positionMs: nextPos };
    });
  },
  setLyricsOpen: (lyricsOpen) => {
    set({ lyricsOpen });
  },
  setQueueOpen: (queueOpen) => {
    set({ queueOpen });
  },
}));
