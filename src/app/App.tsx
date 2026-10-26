import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Settings, Trophy } from 'lucide-react';
import { runStartupCapabilityProbes } from '@/api/capabilities';
import { getSpotifyClient } from '@/api/clientInstance';
import { completePkceCallback, refreshSpotifyAccessToken } from '@/features/auth/authService';
import { CommandPaletteModal } from '@/features/command-palette/CommandPaletteModal';
import {
  formatKeyboardEventCombo,
  useShortcutStore,
} from '@/features/command-palette/shortcutRegistry';
import { EasterEggOverlay } from '@/features/easter-eggs/EasterEggOverlay';
import { GlassSettingsSheet } from '@/features/glass-shell/GlassSettingsSheet';
import { LeftGlassBrowser } from '@/features/glass-shell/LeftGlassBrowser';
import { RightGlassStage } from '@/features/glass-shell/RightGlassStage';
import { SpotifyUriImportModal } from '@/features/glass-shell/SpotifyUriImportModal';
import { LyricsDrawer } from '@/features/lyrics/LyricsDrawer';
import { CompactNowPlayingView } from '@/features/player/ObsOverlayView';
import { playerController } from '@/features/player/playerController';
import {
  disconnectWebPlaybackSdk,
  initializeWebPlaybackSdk,
} from '@/features/player/webPlaybackSdk';
import { QueueDrawer } from '@/features/queue/QueueDrawer';
import { t } from '@/i18n';
import {
  flushDesktopSettingsToDisk,
  startDesktopSettingsSync,
} from '@/platform/desktopSettingsSync';
import { probeEmeSupport, type EmeSupportStatus } from '@/platform/emeProbe';
import { openExternalUrl, openPulsePopupWindow } from '@/platform/openExternal';
import { getWindowMode, isTauriRuntime } from '@/platform/runtime';
import { useAuthStore } from '@/stores/authStore';
import { useAchievementStore } from '@/stores/achievementStore';
import { useCapabilityStore } from '@/stores/capabilityStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useThemeStore } from '@/stores/themeStore';
import { useUiStore } from '@/stores/uiStore';
import { ApiStatusBanner } from './ApiStatusBanner';

export function App() {
  const leftPaneTab = useUiStore((s) => s.leftPaneTab);
  const setLeftPaneTab = useUiStore((s) => s.setLeftPaneTab);
  const settingsSheetOpen = useUiStore((s) => s.settingsSheetOpen);
  const setSettingsSheetOpen = useUiStore((s) => s.setSettingsSheetOpen);
  const setImportModalOpen = useUiStore((s) => s.setImportModalOpen);
  const setActiveRoute = useUiStore((s) => s.setActiveRoute);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);

  const authStatus = useAuthStore((s) => s.status);
  const storedClientId = useAuthStore((s) => s.clientId);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const sidebarPosition = useThemeStore((s) => s.sidebarPosition);
  const ambientGlow = useThemeStore((s) => s.ambientGlow);
  const shellLayout = useThemeStore((s) => s.shellLayout);
  const backdropTexture = useThemeStore((s) => s.backdropTexture);
  const windowChromeStyle = useThemeStore((s) => s.windowChromeStyle);

  const [zenView, setZenView] = useState<'stage' | 'browser'>('stage');

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const setEngine = usePlayerStore((s) => s.setEngine);
  const setLyricsOpen = usePlayerStore((s) => s.setLyricsOpen);
  const setQueueOpen = usePlayerStore((s) => s.setQueueOpen);
  const pushAlert = useCapabilityStore((s) => s.pushAlert);

  const [emeStatus, setEmeStatus] = useState<EmeSupportStatus | null>(null);
  const windowMode = getWindowMode();
  const activeEasterEgg = useAchievementStore((s) => s.activeEasterEgg);
  const unlockedCount = useAchievementStore((s) => Object.keys(s.unlockedAt).length);

  // 0. Boot session tracking, desktop disk persistence, 1-second listening/session clock & theme achievement observer
  useEffect(() => {
    const stopDesktopSync = startDesktopSettingsSync();
    const ach = useAchievementStore.getState();
    ach.recordAppBoot();
    if (windowMode === 'obs') {
      ach.setFlag('openedObsOverlay');
    } else if (windowMode === 'mini') {
      ach.setFlag('openedMiniPlayer');
    }

    let sessionSec = 0;
    const tick = setInterval(() => {
      sessionSec += 1;
      useAchievementStore.getState().setPeakMetric('sessionSecondsPeak', sessionSec);
      const p = usePlayerStore.getState();
      if (p.isPlaying) {
        useAchievementStore.getState().incrementMetric('listeningSeconds', 1);
      }
    }, 1000);

    const unsubTheme = useThemeStore.subscribe((next, prev) => {
      const store = useAchievementStore.getState();
      if (next.activePresetId !== prev.activePresetId || next.surfaceStyle !== prev.surfaceStyle) {
        store.recordThemeSelection(next.activePresetId, next.surfaceStyle);
      }
      if (next.artworkStyle === 'vinyl' && prev.artworkStyle !== 'vinyl') {
        store.setFlag('triedVinylArtwork');
      }
      if (next.artworkStyle === 'sharp' && prev.artworkStyle !== 'sharp') {
        store.setFlag('triedSharpArtwork');
      }
      if (next.shellLayout === 'bottom-player' && prev.shellLayout !== 'bottom-player') {
        store.setFlag('triedBottomBarLayout');
      }
      if (next.shellLayout === 'zen-stage' && prev.shellLayout !== 'zen-stage') {
        store.setFlag('triedZenStageLayout');
      }
      if (next.fontPreset === 'mono' && prev.fontPreset !== 'mono') {
        store.setFlag('triedMonoFont');
      }
      if (next.fontPreset === 'serif' && prev.fontPreset !== 'serif') {
        store.setFlag('triedSerifFont');
      }
      if (next.backdropTexture === 'bubbles' && prev.backdropTexture !== 'bubbles') {
        store.setFlag('triedBubblesTexture');
      }
    });

    const handleExternalAnchorClick = (event: MouseEvent) => {
      if (!isTauriRuntime() || event.defaultPrevented) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      const rawHref = anchor.getAttribute('href') ?? '';
      if (rawHref.startsWith('https://')) {
        event.preventDefault();
        void openExternalUrl(rawHref).catch(() => undefined);
      }
    };
    document.addEventListener('click', handleExternalAnchorClick);

    return () => {
      stopDesktopSync();
      clearInterval(tick);
      unsubTheme();
      document.removeEventListener('click', handleExternalAnchorClick);
    };
  }, [windowMode]);

  // 1. EME / Widevine probe on startup
  useEffect(() => {
    let active = true;
    void probeEmeSupport().then((result) => {
      if (!active) {
        return;
      }
      setEmeStatus(result);
      setEngine(result.supported ? 'sdk' : 'connect-remote');
      if (!result.supported && result.reason && useAuthStore.getState().status === 'authenticated') {
        pushAlert({
          id: 'eme-fallback',
          kind: 'eme-fallback',
          message: result.reason,
        });
      }
    });
    return () => {
      active = false;
    };
  }, [pushAlert, setEngine]);

  // 2. OAuth PKCE callback exchange OR silent session restoration from encrypted TokenVault
  useEffect(() => {
    const abortController = new AbortController();
    const isMounted = (): boolean => !abortController.signal.aborted;

    const bootstrapSession = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hasOAuthParams =
        window.location.pathname === '/auth/callback' ||
        searchParams.has('code') ||
        searchParams.has('error');

      if (hasOAuthParams) {
        const ok = await completePkceCallback({
          code: searchParams.get('code'),
          state: searchParams.get('state'),
          error: searchParams.get('error'),
        });
        window.history.replaceState({}, '', '/');
        if (ok && isMounted()) {
          const client = getSpotifyClient();
          const profile = await client.getCurrentUser();
          setAuthenticated(profile);
          setLeftPaneTab('library');
          void runStartupCapabilityProbes(client).catch(() => undefined);
          void playerController.refreshPlaybackState();
        } else if (!ok && isMounted()) {
          setActiveRoute('setup');
        }
        return;
      }

      if (storedClientId && useAuthStore.getState().status === 'signed-out') {
        const refreshed = await refreshSpotifyAccessToken();
        if (refreshed && isMounted()) {
          const client = getSpotifyClient();
          const profile = await client.getCurrentUser().catch(() => null);
          if (profile && isMounted()) {
            setAuthenticated(profile);
            void runStartupCapabilityProbes(client).catch(() => undefined);
            void playerController.refreshPlaybackState();
          }
        }
      }
    };

    void bootstrapSession();
    return () => {
      abortController.abort();
    };
  }, [setActiveRoute, setAuthenticated, setLeftPaneTab, storedClientId]);

  // 3. Initialize Web Playback SDK when live session + EME audio are both ready
  useEffect(() => {
    if (authStatus === 'authenticated' && emeStatus?.supported) {
      void initializeWebPlaybackSdk();
      return () => {
        disconnectWebPlaybackSdk();
      };
    }
    return undefined;
  }, [authStatus, emeStatus]);

  // 4. Global Remappable Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setImportModalOpen(false);
        setSettingsSheetOpen(false);
        setLyricsOpen(false);
        setQueueOpen(false);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      const combo = formatKeyboardEventCombo(e);
      const shortcuts = useShortcutStore.getState().shortcuts;

      if (combo === shortcuts.openCommandPalette) {
        e.preventDefault();
        setCommandPaletteOpen(!useUiStore.getState().commandPaletteOpen);
        return;
      }

      if (isEditable) {
        return;
      }

      if (combo === shortcuts.togglePlayPause) {
        e.preventDefault();
        void playerController.togglePlayPause();
      } else if (combo === shortcuts.nextTrack) {
        e.preventDefault();
        void playerController.next();
      } else if (combo === shortcuts.previousTrack) {
        e.preventDefault();
        void playerController.previous();
      } else if (combo === shortcuts.goToSearch) {
        e.preventDefault();
        setActiveRoute('search');
      } else if (combo === shortcuts.goToLibrary) {
        e.preventDefault();
        setLeftPaneTab('library');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [
    setActiveRoute,
    setCommandPaletteOpen,
    setImportModalOpen,
    setLeftPaneTab,
    setLyricsOpen,
    setQueueOpen,
    setSettingsSheetOpen,
  ]);

  if (windowMode === 'obs' || windowMode === 'mini') {
    return <CompactNowPlayingView mode={windowMode} />;
  }

  const coverGlowUrl = currentTrack?.album?.images[0]?.url;

  const handleTrafficAction = (kind: 'close' | 'minimize' | 'maximize') => {
    if (isTauriRuntime()) {
      const win = getCurrentWindow();
      if (kind === 'close') {
        void flushDesktopSettingsToDisk()
          .catch(() => undefined)
          .finally(() => {
            void win.close();
          });
      } else if (kind === 'minimize') {
        void win.minimize();
      } else {
        void win.toggleMaximize();
      }
      return;
    }

    if (kind === 'minimize') {
      void openPulsePopupWindow('mini');
    } else if (kind === 'maximize') {
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen().catch(() => undefined);
      } else {
        void document.exitFullscreen().catch(() => undefined);
      }
    }
  };

  return (
    <div className="gp-viewport">
      <a href="#main-content" className="pulse-skip-link">
        {t('app.skipToMain')}
      </a>

      {/* Atmospheric Blurred Cover Glow + Drifting Radial Spheres */}
      <div className="gp-ambient" data-disabled={!ambientGlow} aria-hidden="true">
        <div className="gp-blob-indigo" />
        <div className="gp-blob-rose" />
        {coverGlowUrl ? <img src={coverGlowUrl} alt="" className="gp-cover-glow" /> : null}
      </div>

      {/* Optional Procedural Texture Layer (Scanlines / Dot Grid / Film Grain) */}
      <div className="gp-texture-layer" data-texture={backdropTexture} aria-hidden="true" />

      {/* 48px Chromeless Header Bar */}
      <header
        className="gp-topbar"
        data-tauri-drag-region=""
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && e.button === 0 && isTauriRuntime()) {
            void getCurrentWindow().startDragging();
          }
        }}
      >
        <div className="gp-traffic-lights" data-chrome={windowChromeStyle}>
          <button
            type="button"
            className="gp-traffic-dot"
            aria-label="Close window"
            style={{ background: '#FF5F57' }}
            onClick={() => {
              handleTrafficAction('close');
            }}
          />
          <button
            type="button"
            className="gp-traffic-dot"
            aria-label="Minimize or open mini player"
            style={{ background: '#FEBC2E' }}
            onClick={() => {
              handleTrafficAction('minimize');
            }}
          />
          <button
            type="button"
            className="gp-traffic-dot"
            aria-label="Toggle fullscreen"
            style={{ background: '#28C840' }}
            onClick={() => {
              handleTrafficAction('maximize');
            }}
          />
        </div>

        {/* Center Segmented Pill Capsule */}
        <div className="gp-segmented" role="tablist" aria-label="Primary mode">
          {shellLayout === 'zen-stage' ? (
            <button
              type="button"
              role="tab"
              aria-selected={!settingsSheetOpen && zenView === 'stage'}
              className="gp-seg-pill"
              onClick={() => {
                setSettingsSheetOpen(false);
                setZenView('stage');
              }}
            >
              Stage
            </button>
          ) : null}
          <button
            type="button"
            role="tab"
            aria-selected={
              !settingsSheetOpen &&
              leftPaneTab === 'search' &&
              (shellLayout !== 'zen-stage' || zenView === 'browser')
            }
            className="gp-seg-pill"
            onClick={() => {
              setZenView('browser');
              setLeftPaneTab('search');
            }}
          >
            Search
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={
              !settingsSheetOpen &&
              leftPaneTab === 'library' &&
              (shellLayout !== 'zen-stage' || zenView === 'browser')
            }
            className="gp-seg-pill"
            onClick={() => {
              setZenView('browser');
              setLeftPaneTab('library');
            }}
          >
            Library
          </button>
        </div>

        {/* Top-Right Trophy Badge & Circular Settings Gear */}
        <div className="gp-topbar-right">
          <button
            type="button"
            className="gp-action-pill"
            aria-label="Open Achievements"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              fontSize: '0.8rem',
            }}
            onClick={() => {
              setActiveRoute('achievements');
            }}
          >
            <Trophy size={13} color="#f59e0b" aria-hidden="true" />
            <span>{unlockedCount}</span>
          </button>

          <button
            type="button"
            className="gp-round-btn"
            aria-label="Open Settings"
            aria-expanded={settingsSheetOpen}
            style={{ width: '34px', height: '34px' }}
            onClick={() => {
              setSettingsSheetOpen(!settingsSheetOpen);
            }}
          >
            <Settings size={17} strokeWidth={1.9} />
          </button>
        </div>
      </header>

      {/* Main Customizable Stage (Split Panels / Bottom Bar / Zen Stage) */}
      <main
        id="main-content"
        className={`gp-split-grid${activeEasterEgg === 'barrel-roll' ? ' gp-barrel-roll' : ''}`}
        data-sidebar={sidebarPosition}
        data-layout={shellLayout}
        data-zen-view={zenView}
        tabIndex={-1}
      >
        <LeftGlassBrowser />
        <RightGlassStage />
      </main>

      <ApiStatusBanner />
      <GlassSettingsSheet />
      <SpotifyUriImportModal />
      <QueueDrawer />
      <LyricsDrawer />
      <CommandPaletteModal />
      <EasterEggOverlay />
    </div>
  );
}
