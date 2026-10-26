import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACHIEVEMENT_CATALOG,
  ACHIEVEMENT_CATEGORY_LABELS,
  computeListenerRank,
  type AchievementCategory,
} from '@/features/achievements/achievementCatalog';
import { useAchievementStore } from '@/stores/achievementStore';

describe('Achievement Catalog & Easter Egg Engine (248+ Badges)', () => {
  beforeEach(() => {
    localStorage.clear();
    useAchievementStore.getState().resetProgress();
  });

  it('contains 240+ strictly unique, well-formed achievements across all 9 categories', () => {
    expect(ACHIEVEMENT_CATALOG.length).toBeGreaterThanOrEqual(240);
    expect(ACHIEVEMENT_CATALOG.length).toBe(248);

    const seenIds = new Set<string>();
    const categoryCounts = new Map<string, number>();

    for (const badge of ACHIEVEMENT_CATALOG) {
      expect(seenIds.has(badge.id)).toBe(false);
      seenIds.add(badge.id);
      expect(badge.title.trim().length).toBeGreaterThan(1);
      expect(badge.description.trim().length).toBeGreaterThan(4);
      categoryCounts.set(badge.category, (categoryCounts.get(badge.category) ?? 0) + 1);
    }

    const categories = Object.keys(ACHIEVEMENT_CATEGORY_LABELS) as AchievementCategory[];
    expect(categories.length).toBe(9);
    for (const catId of categories) {
      expect(categoryCounts.get(catId) ?? 0).toBeGreaterThanOrEqual(10);
    }
  });

  it('unlocks listening, track duration, and volume quirk achievements with XP progression', () => {
    const store = useAchievementStore.getState();
    expect(Object.keys(store.unlockedAt).length).toBe(0);

    // Play an epic >8m track
    store.recordTrackStarted({
      uri: 'spotify:track:epic01',
      artistNames: ['Boards of Canada', 'Aphex Twin'],
      durationMs: 650_000,
    });

    // Listen for 2 minutes
    store.incrementMetric('listeningSeconds', 125);

    // Dial volume to 42%, 0%, and 100%
    store.recordVolumeLevel(42);
    store.recordVolumeLevel(0);
    store.recordVolumeLevel(100);

    const after = useAchievementStore.getState();
    expect(after.unlockedAt['play-1']).toBeDefined();
    expect(after.unlockedAt['flag-epic-track']).toBeDefined();
    expect(after.unlockedAt['listen-1m']).toBeDefined();
    expect(after.unlockedAt['vol-42']).toBeDefined();
    expect(after.unlockedAt['vol-zero']).toBeDefined();
    expect(after.unlockedAt['vol-max']).toBeDefined();
    expect(after.totalXp).toBeGreaterThan(80);

    const rank = computeListenerRank(after.totalXp);
    expect(rank.level).toBeGreaterThanOrEqual(1);
    expect(rank.title.length).toBeGreaterThan(3);
  });

  it('tracks Frutiger Aero themes and all 5 surface engines', () => {
    const store = useAchievementStore.getState();

    store.recordThemeSelection('frutiger-aero-daylight', 'aero');
    store.recordThemeSelection('vista-midnight-aurora', 'aero');
    store.recordThemeSelection('frutiger-eco-dewdrop', 'aero');
    store.recordThemeSelection('aqua-gel-2004', 'aero');
    store.recordThemeSelection('frutiger-metro-vector', 'aero');

    expect(useAchievementStore.getState().flags.triedAeroSurface).toBe(true);
    expect(useAchievementStore.getState().flags.triedAllFiveAeroThemes).toBe(true);
    expect(useAchievementStore.getState().unlockedAt['flag-aero']).toBeDefined();
    expect(useAchievementStore.getState().unlockedAt['flag-aero-all']).toBeDefined();

    store.recordThemeSelection('pitch-matte-studio', 'matte');
    store.recordThemeSelection('neo-brutalist-zine', 'brutalist');
    store.recordThemeSelection('pure-oled-void', 'minimal');
    store.recordThemeSelection('liquid-glass-dark', 'glass');

    expect(useAchievementStore.getState().flags.triedAllSurfaces).toBe(true);
    expect(useAchievementStore.getState().unlockedAt['flag-all-surf']).toBeDefined();
  });

  it('triggers interactive Easter eggs from secret search phrases and Konami code', () => {
    const store = useAchievementStore.getState();

    store.recordSearchQuery('do a barrel roll');
    expect(useAchievementStore.getState().activeEasterEgg).toBe('barrel-roll');
    expect(useAchievementStore.getState().unlockedAt['egg-barrel']).toBeDefined();

    store.recordSearchQuery('frutiger aero');
    expect(useAchievementStore.getState().activeEasterEgg).toBe('bubbles');
    expect(useAchievementStore.getState().unlockedAt['egg-aero-promise']).toBeDefined();

    store.recordSearchQuery('winamp');
    expect(useAchievementStore.getState().activeEasterEgg).toBe('llama');
    expect(useAchievementStore.getState().unlockedAt['egg-llama']).toBeDefined();

    store.triggerEasterEgg('konami');
    expect(useAchievementStore.getState().activeEasterEgg).toBe('konami');
    expect(useAchievementStore.getState().unlockedAt['egg-konami']).toBeDefined();
  });
});
