import { create } from 'zustand';
import { useAchievementStore } from '@/stores/achievementStore';

export type ShortcutActionId =
  | 'openCommandPalette'
  | 'togglePlayPause'
  | 'nextTrack'
  | 'previousTrack'
  | 'goToSearch'
  | 'goToLibrary';

export type ShortcutMap = Readonly<Record<ShortcutActionId, string>>;

const STORAGE_KEY = 'pulse.ui.shortcuts';

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  openCommandPalette: 'Mod+K',
  togglePlayPause: 'Space',
  nextTrack: 'Alt+ArrowRight',
  previousTrack: 'Alt+ArrowLeft',
  goToSearch: 'Mod+/',
  goToLibrary: 'Mod+L',
};

function loadShortcuts(): ShortcutMap {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_SHORTCUTS;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SHORTCUTS;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ShortcutMap>;
    return { ...DEFAULT_SHORTCUTS, ...parsed };
  } catch {
    return DEFAULT_SHORTCUTS;
  }
}

export function formatKeyboardEventCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) {
    parts.push('Mod');
  }
  if (e.altKey) {
    parts.push('Alt');
  }
  if (e.shiftKey && e.key.length > 1 && e.key !== 'Shift') {
    parts.push('Shift');
  }
  const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  parts.push(key);
  return parts.join('+');
}

interface ShortcutStoreState {
  readonly shortcuts: ShortcutMap;
  remapShortcut: (action: ShortcutActionId, combo: string) => void;
  resetShortcuts: () => void;
  reloadFromStorage: () => void;
}

export const useShortcutStore = create<ShortcutStoreState>((set, get) => ({
  shortcuts: loadShortcuts(),
  remapShortcut: (action, combo) => {
    const trimmed = combo.trim();
    if (!trimmed) {
      return;
    }
    const next = { ...get().shortcuts, [action]: trimmed };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    set({ shortcuts: next });
    useAchievementStore.getState().setFlag('shortcutRemapped');
  },
  resetShortcuts: () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    set({ shortcuts: DEFAULT_SHORTCUTS });
  },
  reloadFromStorage: () => {
    set({ shortcuts: loadShortcuts() });
  },
}));
