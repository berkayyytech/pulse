import { invoke } from '@tauri-apps/api/core';
import { useShortcutStore } from '@/features/command-palette/shortcutRegistry';
import { startSandboxedPluginWorker } from '@/features/plugins/pluginSandboxHost';
import {
  pulseDb,
  type SmartPlaylistRecord,
  type ThemePackRecord,
} from '@/storage/db';
import { useAchievementStore } from '@/stores/achievementStore';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';
import { usePluginStore } from '@/stores/pluginStore';
import { useThemeStore } from '@/stores/themeStore';
import { isTauriRuntime } from './runtime';

export const PERSISTED_LOCAL_STORAGE_KEYS = [
  'pulse.ui.theme',
  'pulse.spotify.clientId',
  'pulse.local.achievements.v1',
  'pulse.ui.shortcuts',
  'pulse.privacy.listeningHistoryOptIn',
  'pulse.privacy.externalSources',
  'pulse.player.prefs',
  'pulse.plugins.installed',
] as const;

export interface DesktopSettingsBundle {
  readonly version: 1;
  readonly updatedAtIso: string;
  readonly storage: Readonly<Record<string, string | null>>;
  readonly customThemes: readonly ThemePackRecord[];
  readonly smartPlaylists: readonly SmartPlaylistRecord[];
}

let hydrationFinished = false;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let cachedSettingsFilePath: string | null = null;
const saveListeners = new Set<(info: { path: string; savedAtMs: number }) => void>();

export function onDesktopSettingsSaved(
  listener: (info: { path: string; savedAtMs: number }) => void,
): () => void {
  saveListeners.add(listener);
  return () => {
    saveListeners.delete(listener);
  };
}

export function getCachedDesktopSettingsPath(): string | null {
  return cachedSettingsFilePath;
}

export async function getDesktopSettingsPath(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  const path = await invoke<string>('desktop_get_settings_path');
  cachedSettingsFilePath = path;
  return path;
}

export async function openDesktopSettingsFolder(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke('desktop_open_settings_dir');
}

export async function buildDesktopSettingsBundle(): Promise<DesktopSettingsBundle> {
  const storageSnapshot: Record<string, string | null> = {};
  if (typeof localStorage !== 'undefined') {
    for (const key of PERSISTED_LOCAL_STORAGE_KEYS) {
      storageSnapshot[key] = localStorage.getItem(key);
    }
  }

  const [customThemes, smartPlaylists] = await Promise.all([
    pulseDb.customThemes.toArray().catch(() => [] as ThemePackRecord[]),
    pulseDb.smartPlaylists.toArray().catch(() => [] as SmartPlaylistRecord[]),
  ]);

  return {
    version: 1,
    updatedAtIso: new Date().toISOString(),
    storage: storageSnapshot,
    customThemes,
    smartPlaylists,
  };
}

export async function flushDesktopSettingsToDisk(): Promise<string | null> {
  if (!isTauriRuntime() || !hydrationFinished) {
    return null;
  }
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }

  const bundle = await buildDesktopSettingsBundle();
  const savedPath = await invoke<string>('desktop_write_settings', {
    contents: JSON.stringify(bundle, null, 2),
  });
  cachedSettingsFilePath = savedPath;
  const savedAtMs = Date.now();
  for (const listener of saveListeners) {
    listener({ path: savedPath, savedAtMs });
  }
  return savedPath;
}

export function scheduleDesktopSettingsSave(): void {
  if (!isTauriRuntime() || !hydrationFinished) {
    return;
  }
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
  }
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    void flushDesktopSettingsToDisk().catch(() => undefined);
  }, 120);
}

export async function hydrateDesktopSettingsFromDisk(): Promise<string | null> {
  if (!isTauriRuntime()) {
    hydrationFinished = true;
    return null;
  }

  try {
    const [rawDiskJson, resolvedPath] = await Promise.all([
      invoke<string | null>('desktop_read_settings'),
      invoke<string>('desktop_get_settings_path').catch(() => null),
    ]);
    if (resolvedPath) {
      cachedSettingsFilePath = resolvedPath;
    }

    if (rawDiskJson) {
      const parsed = JSON.parse(rawDiskJson) as Partial<DesktopSettingsBundle>;
      if (parsed.storage && typeof parsed.storage === 'object' && typeof localStorage !== 'undefined') {
        for (const key of PERSISTED_LOCAL_STORAGE_KEYS) {
          const val = parsed.storage[key];
          if (typeof val === 'string') {
            localStorage.setItem(key, val);
          } else if (val === null) {
            localStorage.removeItem(key);
          }
        }
      }

      if (Array.isArray(parsed.customThemes) && parsed.customThemes.length > 0) {
        await pulseDb.customThemes.bulkPut(parsed.customThemes as ThemePackRecord[]).catch(() => undefined);
      }
      if (Array.isArray(parsed.smartPlaylists) && parsed.smartPlaylists.length > 0) {
        await pulseDb.smartPlaylists
          .bulkPut(parsed.smartPlaylists as SmartPlaylistRecord[])
          .catch(() => undefined);
      }

      // Reload every persisted Zustand store from the hydrated localStorage values
      useThemeStore.getState().reloadFromStorage();
      useAuthStore.getState().reloadFromStorage();
      usePlayerStore.getState().reloadFromStorage();
      usePluginStore.getState().reloadFromStorage();
      useShortcutStore.getState().reloadFromStorage();
      useAchievementStore.getState().reloadFromStorage();
      useAchievementStore.getState().recordAppBoot();

      for (const plugin of Object.values(usePluginStore.getState().plugins)) {
        if (plugin.enabled) {
          startSandboxedPluginWorker(plugin.manifest.id);
        }
      }
    }

    hydrationFinished = true;

    // If no file existed on disk yet, immediately persist current settings to create it
    if (!rawDiskJson) {
      await flushDesktopSettingsToDisk();
    }

    return cachedSettingsFilePath;
  } catch {
    hydrationFinished = true;
    return cachedSettingsFilePath;
  }
}

export function startDesktopSettingsSync(): () => void {
  if (!isTauriRuntime()) {
    return () => undefined;
  }

  hydrationFinished = false;
  void hydrateDesktopSettingsFromDisk();

  const unsubs = [
    useThemeStore.subscribe(() => {
      scheduleDesktopSettingsSave();
    }),
    useAuthStore.subscribe((next, prev) => {
      if (next.clientId !== prev.clientId) {
        scheduleDesktopSettingsSave();
      }
    }),
    usePlayerStore.subscribe((next, prev) => {
      if (
        next.volumePercent !== prev.volumePercent ||
        next.shuffle !== prev.shuffle ||
        next.repeatMode !== prev.repeatMode
      ) {
        scheduleDesktopSettingsSave();
      }
    }),
    usePluginStore.subscribe((next, prev) => {
      if (next.plugins !== prev.plugins) {
        scheduleDesktopSettingsSave();
      }
    }),
    useShortcutStore.subscribe(() => {
      scheduleDesktopSettingsSave();
    }),
    useAchievementStore.subscribe((next, prev) => {
      if (
        next.unlockedAt !== prev.unlockedAt ||
        next.toastsEnabled !== prev.toastsEnabled ||
        next.flags !== prev.flags ||
        Math.floor(next.metrics.listeningSeconds / 15) !==
          Math.floor(prev.metrics.listeningSeconds / 15) ||
        next.metrics.tracksStarted !== prev.metrics.tracksStarted ||
        next.metrics.themeSwitchesCount !== prev.metrics.themeSwitchesCount
      ) {
        scheduleDesktopSettingsSave();
      }
    }),
  ];

  const handleVisibilityOrUnload = () => {
    void flushDesktopSettingsToDisk().catch(() => undefined);
  };
  window.addEventListener('beforeunload', handleVisibilityOrUnload);
  document.addEventListener('visibilitychange', handleVisibilityOrUnload);

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
    window.removeEventListener('beforeunload', handleVisibilityOrUnload);
    document.removeEventListener('visibilitychange', handleVisibilityOrUnload);
  };
}

export function resetDesktopSyncStateForTesting(): void {
  hydrationFinished = false;
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  cachedSettingsFilePath = null;
}
