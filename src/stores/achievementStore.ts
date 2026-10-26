import { create } from 'zustand';
import {
  ACHIEVEMENT_CATALOG,
  TIER_XP,
  type AchievementDefinition,
  type AchievementFlagKey,
  type AchievementMetricKey,
} from '@/features/achievements/achievementCatalog';

export type EasterEggKind =
  | 'konami'
  | 'barrel-roll'
  | 'matrix'
  | 'dvd'
  | 'llama'
  | 'rave'
  | 'bubbles'
  | 'vaporwave'
  | 'rain'
  | 'teapot'
  | 'flip'
  | 'vinyl-scratch'
  | 'secret-arcade';

const STORAGE_KEY = 'pulse.local.achievements.v1';

const AERO_THEME_IDS = [
  'frutiger-aero-daylight',
  'vista-midnight-aurora',
  'frutiger-eco-dewdrop',
  'aqua-gel-2004',
  'frutiger-metro-vector',
] as const;

const ALL_FIVE_SURFACES = ['glass', 'aero', 'matte', 'minimal', 'brutalist'] as const;

type MetricsMap = Record<AchievementMetricKey, number>;
type FlagsMap = Record<AchievementFlagKey, boolean>;

interface PersistedAchievementData {
  metrics: Partial<MetricsMap>;
  flags: Partial<FlagsMap>;
  unlockedAt: Record<string, number>;
  uniqueTrackUris: string[];
  uniqueArtistKeys: string[];
  uniqueQueries: string[];
  uniqueThemes: string[];
  uniqueDays: string[];
  surfacesTried: string[];
  aeroThemesTried: string[];
  toastsEnabled: boolean;
}

const ZERO_METRICS: MetricsMap = {
  listeningSeconds: 0,
  sessionSecondsPeak: 0,
  tracksStarted: 0,
  tracksCompleted: 0,
  skipNextCount: 0,
  skipPrevCount: 0,
  seekCount: 0,
  pauseToggles: 0,
  uniqueTracksPlayed: 0,
  uniqueArtistsPlayed: 0,
  playlistsCreated: 0,
  playlistsOpened: 0,
  smartPlaylistsCreated: 0,
  tracksSavedCount: 0,
  searchesPerformed: 0,
  uniqueSearchQueries: 0,
  lyricsOpenedCount: 0,
  queueOpenedCount: 0,
  uriImportsOpened: 0,
  themeSwitchesCount: 0,
  uniqueThemesTried: 0,
  customColorsEdited: 0,
  customPresetsSaved: 0,
  commandPaletteOpens: 0,
  commandPaletteRuns: 0,
  settingsOpenedCount: 0,
  shuffleToggles: 0,
  repeatCycles: 0,
  appSessionsCount: 0,
  distinctDaysActive: 0,
  unlockedNonMetaCount: 0,
};

const ZERO_FLAGS: FlagsMap = {
  playedLongTrack: false,
  playedShortTrack: false,
  playedEpicTrack: false,
  openedMiniPlayer: false,
  openedObsOverlay: false,
  openedDevicePicker: false,
  triedAeroSurface: false,
  triedAllFiveAeroThemes: false,
  triedMatteSurface: false,
  triedBrutalistSurface: false,
  triedMinimalSurface: false,
  triedAllSurfaces: false,
  triedVinylArtwork: false,
  triedSharpArtwork: false,
  triedBottomBarLayout: false,
  triedZenStageLayout: false,
  triedMonoFont: false,
  triedSerifFont: false,
  triedBubblesTexture: false,
  shortcutRemapped: false,
  pluginInstalled: false,
  themeJsonExported: false,
  themeJsonImported: false,
  privacyInspected: false,
  sampleLibraryLaunched: false,
  playedEarlyMorning: false,
  playedMidday: false,
  playedGoldenHour: false,
  playedLateNight: false,
  playedWitchingHour: false,
  eggKonami: false,
  eggVinylScratch: false,
  eggBarrelRoll: false,
  eggMatrixRain: false,
  eggDvdBounce: false,
  eggDvdCornerHit: false,
  eggWinampLlama: false,
  eggClubRave: false,
  eggFrutigerPromise: false,
  eggVaporwave: false,
  eggRainyWindow: false,
  eggTeapot418: false,
  eggTableFlip: false,
  eggSettingsTap5: false,
  volZeroSilence: false,
  volMaxEleven: false,
  volAnswer42: false,
  volSyncClock: false,
};

interface AchievementStoreState {
  readonly metrics: Readonly<MetricsMap>;
  readonly flags: Readonly<FlagsMap>;
  readonly unlockedAt: Readonly<Record<string, number>>;
  readonly uniqueTrackUris: readonly string[];
  readonly uniqueArtistKeys: readonly string[];
  readonly uniqueQueries: readonly string[];
  readonly uniqueThemes: readonly string[];
  readonly uniqueDays: readonly string[];
  readonly surfacesTried: readonly string[];
  readonly aeroThemesTried: readonly string[];
  readonly toastsEnabled: boolean;
  readonly recentToast: AchievementDefinition | null;
  readonly activeEasterEgg: EasterEggKind | null;
  readonly totalXp: number;
  setToastsEnabled: (enabled: boolean) => void;
  dismissToast: () => void;
  triggerEasterEgg: (egg: EasterEggKind | null) => void;
  incrementMetric: (key: AchievementMetricKey, delta?: number) => void;
  setPeakMetric: (key: AchievementMetricKey, candidate: number) => void;
  setFlag: (flag: AchievementFlagKey) => void;
  recordAppBoot: () => void;
  recordTrackStarted: (params: {
    uri: string;
    artistNames: readonly string[];
    durationMs: number;
  }) => void;
  recordTrackCompleted: () => void;
  recordSearchQuery: (query: string) => void;
  recordThemeSelection: (presetId: string, surfaceStyle: string) => void;
  recordVolumeLevel: (volumePercent: number) => void;
  resetProgress: () => void;
}

function computeTotalXp(unlockedAt: Readonly<Record<string, number>>): number {
  let xp = 0;
  for (const def of ACHIEVEMENT_CATALOG) {
    if (unlockedAt[def.id] !== undefined) {
      xp += TIER_XP[def.tier];
    }
  }
  return xp;
}

function isSatisfied(
  def: AchievementDefinition,
  metrics: Readonly<MetricsMap>,
  flags: Readonly<FlagsMap>,
): boolean {
  if (def.flag) {
    return flags[def.flag];
  }
  if (def.metric && def.target !== undefined) {
    return metrics[def.metric] >= def.target;
  }
  return false;
}

function loadInitialData(): {
  metrics: MetricsMap;
  flags: FlagsMap;
  unlockedAt: Record<string, number>;
  uniqueTrackUris: string[];
  uniqueArtistKeys: string[];
  uniqueQueries: string[];
  uniqueThemes: string[];
  uniqueDays: string[];
  surfacesTried: string[];
  aeroThemesTried: string[];
  toastsEnabled: boolean;
} {
  if (typeof localStorage === 'undefined') {
    return {
      metrics: { ...ZERO_METRICS },
      flags: { ...ZERO_FLAGS },
      unlockedAt: {},
      uniqueTrackUris: [],
      uniqueArtistKeys: [],
      uniqueQueries: [],
      uniqueThemes: ['frosted-liquid-glass'],
      uniqueDays: [],
      surfacesTried: ['glass'],
      aeroThemesTried: [],
      toastsEnabled: true,
    };
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      metrics: { ...ZERO_METRICS, uniqueThemesTried: 1 },
      flags: { ...ZERO_FLAGS },
      unlockedAt: {},
      uniqueTrackUris: [],
      uniqueArtistKeys: [],
      uniqueQueries: [],
      uniqueThemes: ['frosted-liquid-glass'],
      uniqueDays: [],
      surfacesTried: ['glass'],
      aeroThemesTried: [],
      toastsEnabled: true,
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAchievementData>;
    return {
      metrics: { ...ZERO_METRICS, ...(parsed.metrics ?? {}) },
      flags: { ...ZERO_FLAGS, ...(parsed.flags ?? {}) },
      unlockedAt: parsed.unlockedAt ?? {},
      uniqueTrackUris: Array.isArray(parsed.uniqueTrackUris) ? parsed.uniqueTrackUris : [],
      uniqueArtistKeys: Array.isArray(parsed.uniqueArtistKeys) ? parsed.uniqueArtistKeys : [],
      uniqueQueries: Array.isArray(parsed.uniqueQueries) ? parsed.uniqueQueries : [],
      uniqueThemes: Array.isArray(parsed.uniqueThemes)
        ? parsed.uniqueThemes
        : ['frosted-liquid-glass'],
      uniqueDays: Array.isArray(parsed.uniqueDays) ? parsed.uniqueDays : [],
      surfacesTried: Array.isArray(parsed.surfacesTried) ? parsed.surfacesTried : ['glass'],
      aeroThemesTried: Array.isArray(parsed.aeroThemesTried) ? parsed.aeroThemesTried : [],
      toastsEnabled: typeof parsed.toastsEnabled === 'boolean' ? parsed.toastsEnabled : true,
    };
  } catch {
    return {
      metrics: { ...ZERO_METRICS },
      flags: { ...ZERO_FLAGS },
      unlockedAt: {},
      uniqueTrackUris: [],
      uniqueArtistKeys: [],
      uniqueQueries: [],
      uniqueThemes: ['frosted-liquid-glass'],
      uniqueDays: [],
      surfacesTried: ['glass'],
      aeroThemesTried: [],
      toastsEnabled: true,
    };
  }
}

function saveData(state: AchievementStoreState): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const payload: PersistedAchievementData = {
    metrics: state.metrics,
    flags: state.flags,
    unlockedAt: state.unlockedAt,
    uniqueTrackUris: [...state.uniqueTrackUris].slice(-1200),
    uniqueArtistKeys: [...state.uniqueArtistKeys].slice(-600),
    uniqueQueries: [...state.uniqueQueries].slice(-300),
    uniqueThemes: [...state.uniqueThemes],
    uniqueDays: [...state.uniqueDays],
    surfacesTried: [...state.surfacesTried],
    aeroThemesTried: [...state.aeroThemesTried],
    toastsEnabled: state.toastsEnabled,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

const initial = loadInitialData();

export const useAchievementStore = create<AchievementStoreState>((set, get) => {
  const evaluateAndCommit = (
    nextMetricsDraft: MetricsMap,
    nextFlags: FlagsMap,
    extras?: Partial<AchievementStoreState>,
    announceToast = true,
  ) => {
    const now = Date.now();
    const prevUnlocked = get().unlockedAt;
    const nextUnlocked: Record<string, number> = { ...prevUnlocked };
    let newestBadge: AchievementDefinition | null = null;

    // Pass 1: Non-mastery achievements
    for (const def of ACHIEVEMENT_CATALOG) {
      if (def.category === 'mastery') {
        continue;
      }
      if (nextUnlocked[def.id] === undefined && isSatisfied(def, nextMetricsDraft, nextFlags)) {
        nextUnlocked[def.id] = now;
        newestBadge = def;
      }
    }

    // Count unlocked non-mastery badges for Pass 2
    let nonMetaCount = 0;
    for (const def of ACHIEVEMENT_CATALOG) {
      if (def.category !== 'mastery' && nextUnlocked[def.id] !== undefined) {
        nonMetaCount += 1;
      }
    }
    const nextMetrics: MetricsMap = {
      ...nextMetricsDraft,
      unlockedNonMetaCount: nonMetaCount,
    };

    // Pass 2: Mastery achievements
    for (const def of ACHIEVEMENT_CATALOG) {
      if (def.category !== 'mastery') {
        continue;
      }
      if (nextUnlocked[def.id] === undefined && isSatisfied(def, nextMetrics, nextFlags)) {
        nextUnlocked[def.id] = now;
        newestBadge = def;
      }
    }

    const totalXp = computeTotalXp(nextUnlocked);
    set({
      ...extras,
      metrics: nextMetrics,
      flags: nextFlags,
      unlockedAt: nextUnlocked,
      totalXp,
      recentToast:
        announceToast && get().toastsEnabled && newestBadge ? newestBadge : get().recentToast,
    });
    saveData(get());
  };

  return {
    metrics: initial.metrics,
    flags: initial.flags,
    unlockedAt: initial.unlockedAt,
    uniqueTrackUris: initial.uniqueTrackUris,
    uniqueArtistKeys: initial.uniqueArtistKeys,
    uniqueQueries: initial.uniqueQueries,
    uniqueThemes: initial.uniqueThemes,
    uniqueDays: initial.uniqueDays,
    surfacesTried: initial.surfacesTried,
    aeroThemesTried: initial.aeroThemesTried,
    toastsEnabled: initial.toastsEnabled,
    recentToast: null,
    activeEasterEgg: null,
    totalXp: computeTotalXp(initial.unlockedAt),

    setToastsEnabled: (toastsEnabled) => {
      set({ toastsEnabled, recentToast: toastsEnabled ? get().recentToast : null });
      saveData(get());
    },

    dismissToast: () => {
      set({ recentToast: null });
    },

    triggerEasterEgg: (activeEasterEgg) => {
      set({ activeEasterEgg });
      if (!activeEasterEgg) {
        return;
      }
      const eggFlagMap: Partial<Record<EasterEggKind, AchievementFlagKey>> = {
        konami: 'eggKonami',
        'barrel-roll': 'eggBarrelRoll',
        matrix: 'eggMatrixRain',
        dvd: 'eggDvdBounce',
        llama: 'eggWinampLlama',
        rave: 'eggClubRave',
        bubbles: 'eggFrutigerPromise',
        vaporwave: 'eggVaporwave',
        rain: 'eggRainyWindow',
        teapot: 'eggTeapot418',
        flip: 'eggTableFlip',
        'vinyl-scratch': 'eggVinylScratch',
        'secret-arcade': 'eggSettingsTap5',
      };
      const flag = eggFlagMap[activeEasterEgg];
      if (flag) {
        get().setFlag(flag);
      }
    },

    incrementMetric: (key, delta = 1) => {
      const s = get();
      const nextMetrics: MetricsMap = {
        ...s.metrics,
        [key]: s.metrics[key] + delta,
      };
      evaluateAndCommit(nextMetrics, { ...s.flags });
    },

    setPeakMetric: (key, candidate) => {
      const s = get();
      if (candidate <= s.metrics[key]) {
        return;
      }
      const nextMetrics: MetricsMap = {
        ...s.metrics,
        [key]: candidate,
      };
      evaluateAndCommit(nextMetrics, { ...s.flags });
    },

    setFlag: (flag) => {
      const s = get();
      if (s.flags[flag]) {
        return;
      }
      const nextFlags: FlagsMap = {
        ...s.flags,
        [flag]: true,
      };
      evaluateAndCommit({ ...s.metrics }, nextFlags);
    },

    recordAppBoot: () => {
      const s = get();
      const today = new Date().toISOString().slice(0, 10);
      const nextDays = s.uniqueDays.includes(today) ? [...s.uniqueDays] : [...s.uniqueDays, today];
      const nextMetrics: MetricsMap = {
        ...s.metrics,
        appSessionsCount: s.metrics.appSessionsCount + 1,
        distinctDaysActive: nextDays.length,
      };
      evaluateAndCommit(nextMetrics, { ...s.flags }, { uniqueDays: nextDays }, false);
    },

    recordTrackStarted: ({ uri, artistNames, durationMs }) => {
      const s = get();
      const nextUris = s.uniqueTrackUris.includes(uri)
        ? [...s.uniqueTrackUris]
        : [...s.uniqueTrackUris, uri];
      const nextArtists = [...s.uniqueArtistKeys];
      for (const name of artistNames) {
        const norm = name.trim().toLowerCase();
        if (norm && !nextArtists.includes(norm)) {
          nextArtists.push(norm);
        }
      }

      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();

      const nextFlags: FlagsMap = { ...s.flags };
      if (durationMs > 300_000) {
        nextFlags.playedLongTrack = true;
      }
      if (durationMs > 0 && durationMs < 150_000) {
        nextFlags.playedShortTrack = true;
      }
      if (durationMs > 480_000) {
        nextFlags.playedEpicTrack = true;
      }
      if (hour >= 5 && hour < 8) {
        nextFlags.playedEarlyMorning = true;
      } else if (hour >= 11 && hour < 14) {
        nextFlags.playedMidday = true;
      } else if (hour >= 17 && hour < 20) {
        nextFlags.playedGoldenHour = true;
      } else if (hour >= 23 || hour < 2) {
        nextFlags.playedLateNight = true;
      } else if (hour >= 2 && hour < 5) {
        nextFlags.playedWitchingHour = true;
      }
      if (minute % 11 === 0) {
        nextFlags.volSyncClock = true;
      }

      const nextMetrics: MetricsMap = {
        ...s.metrics,
        tracksStarted: s.metrics.tracksStarted + 1,
        uniqueTracksPlayed: nextUris.length,
        uniqueArtistsPlayed: nextArtists.length,
      };

      evaluateAndCommit(nextMetrics, nextFlags, {
        uniqueTrackUris: nextUris,
        uniqueArtistKeys: nextArtists,
      });
    },

    recordTrackCompleted: () => {
      get().incrementMetric('tracksCompleted', 1);
    },

    recordSearchQuery: (rawQuery) => {
      const trimmed = rawQuery.trim().toLowerCase();
      if (!trimmed) {
        return;
      }
      const s = get();
      const nextQueries = s.uniqueQueries.includes(trimmed)
        ? [...s.uniqueQueries]
        : [...s.uniqueQueries, trimmed];

      const nextMetrics: MetricsMap = {
        ...s.metrics,
        searchesPerformed: s.metrics.searchesPerformed + 1,
        uniqueSearchQueries: nextQueries.length,
      };
      evaluateAndCommit(nextMetrics, { ...s.flags }, { uniqueQueries: nextQueries });

      // Check secret search Easter eggs
      if (trimmed === 'do a barrel roll' || trimmed === 'barrel roll') {
        get().triggerEasterEgg('barrel-roll');
      } else if (trimmed === 'matrix' || trimmed === 'wake up neo') {
        get().triggerEasterEgg('matrix');
      } else if (trimmed === 'dvd' || trimmed === 'dvd screensaver') {
        get().triggerEasterEgg('dvd');
      } else if (trimmed === 'winamp' || trimmed === 'llama') {
        get().triggerEasterEgg('llama');
      } else if (trimmed === 'rave' || trimmed === 'party') {
        get().triggerEasterEgg('rave');
      } else if (trimmed === 'frutiger aero' || trimmed === '2007' || trimmed === 'frutiger') {
        get().triggerEasterEgg('bubbles');
      } else if (trimmed === 'vaporwave' || trimmed === 'macintosh plus') {
        get().triggerEasterEgg('vaporwave');
      } else if (trimmed === 'lofi' || trimmed === 'rain') {
        get().triggerEasterEgg('rain');
      }
    },

    recordThemeSelection: (presetId, surfaceStyle) => {
      const s = get();
      const nextThemes = s.uniqueThemes.includes(presetId)
        ? [...s.uniqueThemes]
        : [...s.uniqueThemes, presetId];
      const nextSurfaces = s.surfacesTried.includes(surfaceStyle)
        ? [...s.surfacesTried]
        : [...s.surfacesTried, surfaceStyle];
      const isAeroTheme = (AERO_THEME_IDS as readonly string[]).includes(presetId);
      const nextAeroTried =
        isAeroTheme && !s.aeroThemesTried.includes(presetId)
          ? [...s.aeroThemesTried, presetId]
          : [...s.aeroThemesTried];

      const nextFlags: FlagsMap = { ...s.flags };
      if (surfaceStyle === 'aero') {
        nextFlags.triedAeroSurface = true;
      } else if (surfaceStyle === 'matte') {
        nextFlags.triedMatteSurface = true;
      } else if (surfaceStyle === 'brutalist') {
        nextFlags.triedBrutalistSurface = true;
      } else if (surfaceStyle === 'minimal') {
        nextFlags.triedMinimalSurface = true;
      }
      if (ALL_FIVE_SURFACES.every((surf) => nextSurfaces.includes(surf))) {
        nextFlags.triedAllSurfaces = true;
      }
      if (AERO_THEME_IDS.every((id) => nextAeroTried.includes(id))) {
        nextFlags.triedAllFiveAeroThemes = true;
      }

      const nextMetrics: MetricsMap = {
        ...s.metrics,
        themeSwitchesCount: s.metrics.themeSwitchesCount + 1,
        uniqueThemesTried: nextThemes.length,
      };
      evaluateAndCommit(nextMetrics, nextFlags, {
        uniqueThemes: nextThemes,
        surfacesTried: nextSurfaces,
        aeroThemesTried: nextAeroTried,
      });
    },

    recordVolumeLevel: (volumePercent) => {
      const rounded = Math.round(volumePercent);
      if (rounded === 0) {
        get().setFlag('volZeroSilence');
      } else if (rounded === 100) {
        get().setFlag('volMaxEleven');
      } else if (rounded === 42) {
        get().setFlag('volAnswer42');
      }
    },

    resetProgress: () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      set({
        metrics: { ...ZERO_METRICS },
        flags: { ...ZERO_FLAGS },
        unlockedAt: {},
        uniqueTrackUris: [],
        uniqueArtistKeys: [],
        uniqueQueries: [],
        uniqueThemes: [],
        uniqueDays: [],
        surfacesTried: [],
        aeroThemesTried: [],
        recentToast: null,
        activeEasterEgg: null,
        totalXp: 0,
      });
    },
  };
});
