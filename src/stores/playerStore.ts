import { create } from 'zustand';
import { DEMO_TRACK_1 } from '@/api/demoCatalog';
import type { Track } from '@/api/schemas/catalog';
import type { ConnectDevice } from '@/api/schemas/player';
import type { RepeatMode } from '@/api/spotifyClient';

export type PlaybackEngineKind = 'sdk' | 'connect-remote';

const PLAYER_PREFS_STORAGE_KEY = 'pulse.player.prefs';

interface PersistedPlayerPrefs {
  readonly volumePercent: number;
  readonly shuffle: boolean;
  readonly repeatMode: RepeatMode;
}

function loadPlayerPrefs(): PersistedPlayerPrefs {
  const defaults: PersistedPlayerPrefs = {
    volumePercent: 80,
    shuffle: false,
    repeatMode: 'off',
  };
  if (typeof localStorage === 'undefined') {
    return defaults;
  }
  const raw = localStorage.getItem(PLAYER_PREFS_STORAGE_KEY);
  if (!raw) {
    return defaults;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedPlayerPrefs>;
    return {
      volumePercent:
        typeof parsed.volumePercent === 'number' &&
        parsed.volumePercent >= 0 &&
        parsed.volumePercent <= 100
          ? parsed.volumePercent
          : defaults.volumePercent,
      shuffle: typeof parsed.shuffle === 'boolean' ? parsed.shuffle : defaults.shuffle,
      repeatMode:
        parsed.repeatMode === 'off' ||
        parsed.repeatMode === 'context' ||
        parsed.repeatMode === 'track'
          ? parsed.repeatMode
          : defaults.repeatMode,
    };
  } catch {
    return defaults;
  }
}

function savePlayerPrefs(prefs: PersistedPlayerPrefs): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(PLAYER_PREFS_STORAGE_KEY, JSON.stringify(prefs));
}

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
  reloadFromStorage: () => void;
}

const initialPrefs = loadPlayerPrefs();

export const usePlayerStore = create<PlayerState>((set) => ({
  engine: 'connect-remote',
  sdkReady: false,
  sdkDeviceId: null,
  activeDevice: null,
  availableDevices: [],
  currentTrack: DEMO_TRACK_1,
  isPlaying: false,
  positionMs: 32_000,
  volumePercent: initialPrefs.volumePercent,
  shuffle: initialPrefs.shuffle,
  repeatMode: initialPrefs.repeatMode,
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
    set((state) => {
      const nextVolume =
        snapshot.volumePercent !== undefined ? snapshot.volumePercent : state.volumePercent;
      const nextShuffle = snapshot.shuffle !== undefined ? snapshot.shuffle : state.shuffle;
      const nextRepeat =
        snapshot.repeatMode !== undefined ? snapshot.repeatMode : state.repeatMode;

      if (
        nextVolume !== state.volumePercent ||
        nextShuffle !== state.shuffle ||
        nextRepeat !== state.repeatMode
      ) {
        savePlayerPrefs({
          volumePercent: nextVolume,
          shuffle: nextShuffle,
          repeatMode: nextRepeat,
        });
      }

      return {
        currentTrack:
          snapshot.currentTrack !== undefined ? snapshot.currentTrack : state.currentTrack,
        isPlaying: snapshot.isPlaying !== undefined ? snapshot.isPlaying : state.isPlaying,
        positionMs: snapshot.positionMs !== undefined ? snapshot.positionMs : state.positionMs,
        volumePercent: nextVolume,
        shuffle: nextShuffle,
        repeatMode: nextRepeat,
        activeDevice:
          snapshot.activeDevice !== undefined ? snapshot.activeDevice : state.activeDevice,
      };
    });
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
  reloadFromStorage: () => {
    const prefs = loadPlayerPrefs();
    set({
      volumePercent: prefs.volumePercent,
      shuffle: prefs.shuffle,
      repeatMode: prefs.repeatMode,
    });
  },
}));
