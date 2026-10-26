import { create } from 'zustand';
import {
  ARTWORK_STYLES,
  BACKDROP_TEXTURES,
  FONT_PRESETS,
  SHELL_LAYOUTS,
  SURFACE_STYLES,
  WINDOW_CHROME_STYLES,
  type ArtworkStyle,
  type BackdropTexture,
  type FontPreset,
  type ShellLayout,
  type SurfaceStyle,
  type ThemePack,
  type WindowChromeStyle,
} from '@/features/themes/themeEngine';

export type ColorMode = 'dark' | 'light' | 'auto';
export type SidebarPosition = 'left' | 'right';
export type LayoutDensity = 'compact' | 'comfortable' | 'spacious';
export type CardSize = 'sm' | 'md' | 'lg';

interface ThemeState {
  readonly activePresetId: string;
  readonly colorMode: ColorMode;
  readonly surfaceStyle: SurfaceStyle;
  readonly shellLayout: ShellLayout;
  readonly artworkStyle: ArtworkStyle;
  readonly fontPreset: FontPreset;
  readonly backdropTexture: BackdropTexture;
  readonly windowChromeStyle: WindowChromeStyle;
  readonly sidebarPosition: SidebarPosition;
  readonly density: LayoutDensity;
  readonly cardSize: CardSize;
  readonly showTrackArtwork: boolean;
  readonly uiScalePx: number;
  readonly sidebarWidthPx: number;
  readonly artworkSizePx: number;
  readonly reducedMotion: boolean;
  readonly ambientGlow: boolean;
  readonly dynamicAlbumArtAccent: boolean;
  readonly customTokens: Readonly<Record<string, string>>;
  setActivePresetId: (id: string) => void;
  setColorMode: (mode: ColorMode) => void;
  setSurfaceStyle: (style: SurfaceStyle) => void;
  setShellLayout: (layout: ShellLayout) => void;
  setArtworkStyle: (style: ArtworkStyle) => void;
  setFontPreset: (font: FontPreset) => void;
  setBackdropTexture: (texture: BackdropTexture) => void;
  setWindowChromeStyle: (chrome: WindowChromeStyle) => void;
  setSidebarPosition: (position: SidebarPosition) => void;
  setDensity: (density: LayoutDensity) => void;
  setCardSize: (cardSize: CardSize) => void;
  setShowTrackArtwork: (show: boolean) => void;
  setUiScalePx: (px: number) => void;
  setSidebarWidthPx: (px: number) => void;
  setArtworkSizePx: (px: number) => void;
  setReducedMotion: (reduced: boolean) => void;
  setAmbientGlow: (enabled: boolean) => void;
  setDynamicAlbumArtAccent: (enabled: boolean) => void;
  setCustomTokens: (tokens: Readonly<Record<string, string>>) => void;
  updateSingleToken: (tokenName: string, value: string) => void;
  applyThemePreset: (preset: ThemePack) => void;
  resetAllCustomization: () => void;
  reloadFromStorage: () => void;
}

export function applyColorModeToDocument(mode: ColorMode): void {
  if (typeof document === 'undefined') {
    return;
  }
  const resolved =
    mode === 'auto'
      ? typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : mode;
  document.documentElement.setAttribute('data-theme', resolved);
}

export function applyCustomTokensToDocument(tokens: Readonly<Record<string, string>>): void {
  if (typeof document === 'undefined') {
    return;
  }
  const rootStyle = document.documentElement.style;
  for (const [k, v] of Object.entries(tokens)) {
    if (k.startsWith('--pulse-')) {
      rootStyle.setProperty(k, v);
    }
  }
}

export function clearCustomTokensFromDocument(tokenKeys: readonly string[]): void {
  if (typeof document === 'undefined') {
    return;
  }
  const rootStyle = document.documentElement.style;
  for (const key of tokenKeys) {
    rootStyle.removeProperty(key);
  }
}

const THEME_STORAGE_KEY = 'pulse.ui.theme';

interface PersistedThemeSnapshot {
  readonly activePresetId: string;
  readonly colorMode: ColorMode;
  readonly surfaceStyle: SurfaceStyle;
  readonly shellLayout: ShellLayout;
  readonly artworkStyle: ArtworkStyle;
  readonly fontPreset: FontPreset;
  readonly backdropTexture: BackdropTexture;
  readonly windowChromeStyle: WindowChromeStyle;
  readonly sidebarPosition: SidebarPosition;
  readonly density: LayoutDensity;
  readonly cardSize: CardSize;
  readonly showTrackArtwork: boolean;
  readonly uiScalePx: number;
  readonly sidebarWidthPx: number;
  readonly artworkSizePx: number;
  readonly reducedMotion: boolean;
  readonly ambientGlow: boolean;
  readonly dynamicAlbumArtAccent: boolean;
  readonly customTokens: Readonly<Record<string, string>>;
}

const DEFAULT_SNAPSHOT: PersistedThemeSnapshot = {
  activePresetId: 'frosted-liquid-glass',
  colorMode: 'dark',
  surfaceStyle: 'glass',
  shellLayout: 'split',
  artworkStyle: 'rounded',
  fontPreset: 'sans',
  backdropTexture: 'none',
  windowChromeStyle: 'macos',
  sidebarPosition: 'left',
  density: 'comfortable',
  cardSize: 'md',
  showTrackArtwork: true,
  uiScalePx: 14,
  sidebarWidthPx: 356,
  artworkSizePx: 280,
  reducedMotion: false,
  ambientGlow: true,
  dynamicAlbumArtAccent: false,
  customTokens: {},
};

function syncDocumentThemeAttributes(snapshot: PersistedThemeSnapshot): void {
  if (typeof document === 'undefined') {
    return;
  }
  applyColorModeToDocument(snapshot.colorMode);
  const root = document.documentElement;
  root.setAttribute('data-surface', snapshot.surfaceStyle);
  root.setAttribute('data-artwork', snapshot.artworkStyle);
  root.setAttribute('data-font', snapshot.fontPreset);
  root.setAttribute('data-density', snapshot.density);
  root.setAttribute('data-reduced-motion', String(snapshot.reducedMotion));
  root.style.setProperty('--pulse-ui-font-size', `${snapshot.uiScalePx}px`);
  root.style.setProperty('--pulse-sidebar-width', `${snapshot.sidebarWidthPx}px`);
  root.style.setProperty('--pulse-art-size', `${snapshot.artworkSizePx}px`);
  applyCustomTokensToDocument(snapshot.customTokens);
}

function isOneOf<T extends string>(val: unknown, allowed: readonly T[]): val is T {
  return typeof val === 'string' && (allowed as readonly string[]).includes(val);
}

function loadInitialThemeSnapshot(): PersistedThemeSnapshot {
  if (typeof localStorage === 'undefined') {
    syncDocumentThemeAttributes(DEFAULT_SNAPSHOT);
    return DEFAULT_SNAPSHOT;
  }
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (!raw) {
    syncDocumentThemeAttributes(DEFAULT_SNAPSHOT);
    return DEFAULT_SNAPSHOT;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedThemeSnapshot>;
    const snapshot: PersistedThemeSnapshot = {
      activePresetId:
        typeof parsed.activePresetId === 'string'
          ? parsed.activePresetId
          : DEFAULT_SNAPSHOT.activePresetId,
      colorMode:
        parsed.colorMode === 'dark' || parsed.colorMode === 'light' || parsed.colorMode === 'auto'
          ? parsed.colorMode
          : DEFAULT_SNAPSHOT.colorMode,
      surfaceStyle: isOneOf(parsed.surfaceStyle, SURFACE_STYLES)
        ? parsed.surfaceStyle
        : DEFAULT_SNAPSHOT.surfaceStyle,
      shellLayout: isOneOf(parsed.shellLayout, SHELL_LAYOUTS)
        ? parsed.shellLayout
        : DEFAULT_SNAPSHOT.shellLayout,
      artworkStyle: isOneOf(parsed.artworkStyle, ARTWORK_STYLES)
        ? parsed.artworkStyle
        : DEFAULT_SNAPSHOT.artworkStyle,
      fontPreset: isOneOf(parsed.fontPreset, FONT_PRESETS)
        ? parsed.fontPreset
        : DEFAULT_SNAPSHOT.fontPreset,
      backdropTexture: isOneOf(parsed.backdropTexture, BACKDROP_TEXTURES)
        ? parsed.backdropTexture
        : DEFAULT_SNAPSHOT.backdropTexture,
      windowChromeStyle: isOneOf(parsed.windowChromeStyle, WINDOW_CHROME_STYLES)
        ? parsed.windowChromeStyle
        : DEFAULT_SNAPSHOT.windowChromeStyle,
      sidebarPosition:
        parsed.sidebarPosition === 'left' || parsed.sidebarPosition === 'right'
          ? parsed.sidebarPosition
          : DEFAULT_SNAPSHOT.sidebarPosition,
      density:
        parsed.density === 'compact' ||
        parsed.density === 'comfortable' ||
        parsed.density === 'spacious'
          ? parsed.density
          : DEFAULT_SNAPSHOT.density,
      cardSize:
        parsed.cardSize === 'sm' || parsed.cardSize === 'md' || parsed.cardSize === 'lg'
          ? parsed.cardSize
          : DEFAULT_SNAPSHOT.cardSize,
      showTrackArtwork:
        typeof parsed.showTrackArtwork === 'boolean'
          ? parsed.showTrackArtwork
          : DEFAULT_SNAPSHOT.showTrackArtwork,
      uiScalePx:
        typeof parsed.uiScalePx === 'number' && parsed.uiScalePx >= 11 && parsed.uiScalePx <= 18
          ? parsed.uiScalePx
          : DEFAULT_SNAPSHOT.uiScalePx,
      sidebarWidthPx:
        typeof parsed.sidebarWidthPx === 'number' &&
        parsed.sidebarWidthPx >= 260 &&
        parsed.sidebarWidthPx <= 540
          ? parsed.sidebarWidthPx
          : DEFAULT_SNAPSHOT.sidebarWidthPx,
      artworkSizePx:
        typeof parsed.artworkSizePx === 'number' &&
        parsed.artworkSizePx >= 160 &&
        parsed.artworkSizePx <= 380
          ? parsed.artworkSizePx
          : DEFAULT_SNAPSHOT.artworkSizePx,
      reducedMotion:
        typeof parsed.reducedMotion === 'boolean'
          ? parsed.reducedMotion
          : DEFAULT_SNAPSHOT.reducedMotion,
      ambientGlow:
        typeof parsed.ambientGlow === 'boolean' ? parsed.ambientGlow : DEFAULT_SNAPSHOT.ambientGlow,
      dynamicAlbumArtAccent:
        typeof parsed.dynamicAlbumArtAccent === 'boolean'
          ? parsed.dynamicAlbumArtAccent
          : DEFAULT_SNAPSHOT.dynamicAlbumArtAccent,
      customTokens:
        parsed.customTokens && typeof parsed.customTokens === 'object'
          ? parsed.customTokens
          : DEFAULT_SNAPSHOT.customTokens,
    };
    syncDocumentThemeAttributes(snapshot);
    return snapshot;
  } catch {
    syncDocumentThemeAttributes(DEFAULT_SNAPSHOT);
    return DEFAULT_SNAPSHOT;
  }
}

function toSnapshot(state: ThemeState): PersistedThemeSnapshot {
  return {
    activePresetId: state.activePresetId,
    colorMode: state.colorMode,
    surfaceStyle: state.surfaceStyle,
    shellLayout: state.shellLayout,
    artworkStyle: state.artworkStyle,
    fontPreset: state.fontPreset,
    backdropTexture: state.backdropTexture,
    windowChromeStyle: state.windowChromeStyle,
    sidebarPosition: state.sidebarPosition,
    density: state.density,
    cardSize: state.cardSize,
    showTrackArtwork: state.showTrackArtwork,
    uiScalePx: state.uiScalePx,
    sidebarWidthPx: state.sidebarWidthPx,
    artworkSizePx: state.artworkSizePx,
    reducedMotion: state.reducedMotion,
    ambientGlow: state.ambientGlow,
    dynamicAlbumArtAccent: state.dynamicAlbumArtAccent,
    customTokens: state.customTokens,
  };
}

function persistThemeSnapshot(state: ThemeState): void {
  const snap = toSnapshot(state);
  syncDocumentThemeAttributes(snap);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(snap));
  }
}

const initialTheme = loadInitialThemeSnapshot();

export const useThemeStore = create<ThemeState>((set, get) => ({
  ...initialTheme,
  setActivePresetId: (activePresetId) => {
    set({ activePresetId });
    persistThemeSnapshot(get());
  },
  setColorMode: (colorMode) => {
    set({ colorMode });
    persistThemeSnapshot(get());
  },
  setSurfaceStyle: (surfaceStyle) => {
    set({ surfaceStyle });
    persistThemeSnapshot(get());
  },
  setShellLayout: (shellLayout) => {
    set({ shellLayout });
    persistThemeSnapshot(get());
  },
  setArtworkStyle: (artworkStyle) => {
    set({ artworkStyle });
    persistThemeSnapshot(get());
  },
  setFontPreset: (fontPreset) => {
    set({ fontPreset });
    persistThemeSnapshot(get());
  },
  setBackdropTexture: (backdropTexture) => {
    set({ backdropTexture });
    persistThemeSnapshot(get());
  },
  setWindowChromeStyle: (windowChromeStyle) => {
    set({ windowChromeStyle });
    persistThemeSnapshot(get());
  },
  setSidebarPosition: (sidebarPosition) => {
    set({ sidebarPosition });
    persistThemeSnapshot(get());
  },
  setDensity: (density) => {
    set({ density });
    persistThemeSnapshot(get());
  },
  setCardSize: (cardSize) => {
    set({ cardSize });
    persistThemeSnapshot(get());
  },
  setShowTrackArtwork: (showTrackArtwork) => {
    set({ showTrackArtwork });
    persistThemeSnapshot(get());
  },
  setUiScalePx: (uiScalePx) => {
    const clamped = Math.min(18, Math.max(11, Math.round(uiScalePx)));
    set({ uiScalePx: clamped });
    persistThemeSnapshot(get());
  },
  setSidebarWidthPx: (sidebarWidthPx) => {
    const clamped = Math.min(540, Math.max(260, Math.round(sidebarWidthPx)));
    set({ sidebarWidthPx: clamped });
    persistThemeSnapshot(get());
  },
  setArtworkSizePx: (artworkSizePx) => {
    const clamped = Math.min(380, Math.max(160, Math.round(artworkSizePx)));
    set({ artworkSizePx: clamped });
    persistThemeSnapshot(get());
  },
  setReducedMotion: (reducedMotion) => {
    set({ reducedMotion });
    persistThemeSnapshot(get());
  },
  setAmbientGlow: (ambientGlow) => {
    set({ ambientGlow });
    persistThemeSnapshot(get());
  },
  setDynamicAlbumArtAccent: (dynamicAlbumArtAccent) => {
    set({ dynamicAlbumArtAccent });
    persistThemeSnapshot(get());
  },
  setCustomTokens: (tokens) => {
    const previousKeys = Object.keys(get().customTokens);
    clearCustomTokensFromDocument(previousKeys);
    set({ customTokens: { ...tokens } });
    persistThemeSnapshot(get());
  },
  updateSingleToken: (tokenName, value) => {
    if (!tokenName.startsWith('--pulse-')) {
      return;
    }
    const updated = { ...get().customTokens, [tokenName]: value };
    set({ customTokens: updated });
    persistThemeSnapshot(get());
  },
  applyThemePreset: (preset) => {
    const previousKeys = Object.keys(get().customTokens);
    clearCustomTokensFromDocument(previousKeys);
    const nextSurface = preset.surfaceStyle ?? 'glass';
    set({
      activePresetId: preset.id,
      colorMode: preset.mode,
      surfaceStyle: nextSurface,
      artworkStyle: preset.artworkStyle ?? 'rounded',
      fontPreset: preset.fontPreset ?? 'sans',
      backdropTexture: preset.backdropTexture ?? 'none',
      ambientGlow: preset.ambientGlow ?? (nextSurface === 'glass' || nextSurface === 'aero'),
      customTokens: { ...preset.tokens },
    });
    persistThemeSnapshot(get());
  },
  resetAllCustomization: () => {
    const previousKeys = Object.keys(get().customTokens);
    clearCustomTokensFromDocument(previousKeys);
    set({ ...DEFAULT_SNAPSHOT });
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
    syncDocumentThemeAttributes(DEFAULT_SNAPSHOT);
  },
  reloadFromStorage: () => {
    const previousKeys = Object.keys(get().customTokens);
    clearCustomTokensFromDocument(previousKeys);
    const reloaded = loadInitialThemeSnapshot();
    set({ ...reloaded });
  },
}));
