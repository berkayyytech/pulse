import { create } from 'zustand';
import { useAchievementStore } from './achievementStore';

export type PulseRouteId =
  | 'setup'
  | 'library'
  | 'search'
  | 'smart-playlists'
  | 'stats'
  | 'themes'
  | 'achievements'
  | 'plugins'
  | 'privacy';

export type LeftPaneTab = 'search' | 'library';

interface UiState {
  readonly activeRoute: PulseRouteId;
  readonly leftPaneTab: LeftPaneTab;
  readonly settingsSheetOpen: boolean;
  readonly importModalOpen: boolean;
  readonly commandPaletteOpen: boolean;
  readonly focusedAlbumId: string | null;
  readonly focusedArtistId: string | null;
  setActiveRoute: (route: PulseRouteId) => void;
  setLeftPaneTab: (tab: LeftPaneTab) => void;
  setSettingsSheetOpen: (open: boolean) => void;
  setImportModalOpen: (open: boolean) => void;
  openAlbumDetail: (albumId: string) => void;
  openArtistDetail: (artistId: string) => void;
  clearCatalogDetail: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeRoute: 'setup',
  leftPaneTab: 'search',
  settingsSheetOpen: false,
  importModalOpen: false,
  commandPaletteOpen: false,
  focusedAlbumId: null,
  focusedArtistId: null,
  setActiveRoute: (activeRoute) => {
    if (activeRoute === 'search') {
      set({
        activeRoute: 'search',
        leftPaneTab: 'search',
        settingsSheetOpen: false,
        focusedAlbumId: null,
        focusedArtistId: null,
      });
      return;
    }
    if (activeRoute === 'library') {
      set({
        activeRoute: 'library',
        leftPaneTab: 'library',
        focusedAlbumId: null,
        focusedArtistId: null,
      });
      return;
    }
    if (activeRoute === 'privacy') {
      useAchievementStore.getState().setFlag('privacyInspected');
    }
    set({
      activeRoute,
      settingsSheetOpen: true,
      focusedAlbumId: null,
      focusedArtistId: null,
    });
  },
  setLeftPaneTab: (leftPaneTab) => {
    set({ leftPaneTab, settingsSheetOpen: false });
  },
  setSettingsSheetOpen: (settingsSheetOpen) => {
    if (settingsSheetOpen) {
      useAchievementStore.getState().incrementMetric('settingsOpenedCount', 1);
    }
    set({ settingsSheetOpen });
  },
  setImportModalOpen: (importModalOpen) => {
    if (importModalOpen) {
      useAchievementStore.getState().incrementMetric('uriImportsOpened', 1);
    }
    set({ importModalOpen });
  },
  openAlbumDetail: (albumId) => {
    set({
      activeRoute: 'library',
      settingsSheetOpen: true,
      focusedAlbumId: albumId,
      focusedArtistId: null,
    });
  },
  openArtistDetail: (artistId) => {
    set({
      activeRoute: 'library',
      settingsSheetOpen: true,
      focusedArtistId: artistId,
      focusedAlbumId: null,
    });
  },
  clearCatalogDetail: () => {
    set({ focusedAlbumId: null, focusedArtistId: null });
  },
  setCommandPaletteOpen: (commandPaletteOpen) => {
    if (commandPaletteOpen) {
      useAchievementStore.getState().incrementMetric('commandPaletteOpens', 1);
    }
    set({ commandPaletteOpen });
  },
}));
