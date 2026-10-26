import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Blocks,
  Command,
  KeyRound,
  Library,
  ListFilter,
  Palette,
  ShieldCheck,
  SunMoon,
  Trophy,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { signOutSpotify } from '@/features/auth/authService';
import { OnboardingWizard } from '@/features/onboarding/OnboardingWizard';
import { PluginSlotView } from '@/features/plugins/PluginSlotView';
import { CustomizationPanel } from '@/features/themes/CustomizationPanel';
import { ThemePresetGrid } from '@/features/themes/ThemePresetGrid';
import type { ThemePack } from '@/features/themes/themeEngine';
import { t, type TranslationKey } from '@/i18n';
import { pulseDb } from '@/storage/db';
import { useAchievementStore } from '@/stores/achievementStore';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useUiStore, type PulseRouteId } from '@/stores/uiStore';

const LibraryView = lazy(() => import('@/features/library/LibraryView'));
const SmartPlaylistsView = lazy(() => import('@/features/smart-playlists/SmartPlaylistsView'));
const StatsView = lazy(() => import('@/features/stats/StatsView'));
const ThemeStudioView = lazy(() => import('@/features/themes/ThemeStudioView'));
const AchievementsView = lazy(() => import('@/features/achievements/AchievementsView'));
const PluginsView = lazy(() => import('@/features/plugins/PluginsView'));
const PrivacyView = lazy(() => import('@/features/privacy/PrivacyView'));

interface SheetTab {
  readonly id: PulseRouteId;
  readonly labelKey: TranslationKey;
  readonly icon: typeof KeyRound;
}

const SHEET_TABS: readonly SheetTab[] = [
  { id: 'setup', labelKey: 'nav.setup', icon: KeyRound },
  { id: 'themes', labelKey: 'nav.themes', icon: Palette },
  { id: 'achievements', labelKey: 'nav.achievements', icon: Trophy },
  { id: 'library', labelKey: 'nav.library', icon: Library },
  { id: 'smart-playlists', labelKey: 'nav.smartPlaylists', icon: ListFilter },
  { id: 'stats', labelKey: 'nav.stats', icon: Activity },
  { id: 'plugins', labelKey: 'nav.plugins', icon: Blocks },
  { id: 'privacy', labelKey: 'nav.privacy', icon: ShieldCheck },
];

export function GlassSettingsSheet() {
  const open = useUiStore((s) => s.settingsSheetOpen);
  const setOpen = useUiStore((s) => s.setSettingsSheetOpen);
  const activeRoute = useUiStore((s) => s.activeRoute);
  const setActiveRoute = useUiStore((s) => s.setActiveRoute);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);

  const authStatus = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const clientId = useAuthStore((s) => s.clientId);

  const colorMode = useThemeStore((s) => s.colorMode);
  const setColorMode = useThemeStore((s) => s.setColorMode);

  const [customThemes, setCustomThemes] = useState<ThemePack[]>([]);
  const settingsHeadingTapRef = useRef<number[]>([]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    useAchievementStore.getState().incrementMetric('settingsOpenedCount', 1);
    let active = true;
    void pulseDb.customThemes.toArray().then((rows) => {
      if (active) {
        setCustomThemes(rows);
      }
    });
    return () => {
      active = false;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSettingsTitleClick = () => {
    const now = Date.now();
    const recent = settingsHeadingTapRef.current.filter((ts) => now - ts < 2400);
    recent.push(now);
    settingsHeadingTapRef.current = recent;
    if (recent.length >= 5) {
      settingsHeadingTapRef.current = [];
      useAchievementStore.getState().triggerEasterEgg('secret-arcade');
    }
  };

  const effectiveTab: PulseRouteId = activeRoute === 'search' ? 'setup' : activeRoute;
  const avatarInitial = (user?.display_name ?? 'S').slice(0, 1).toUpperCase();

  const handleDeleteCustom = (id: string) => {
    void pulseDb.customThemes.delete(id).then(async () => {
      setCustomThemes(await pulseDb.customThemes.toArray());
    });
  };

  return (
    <div
      className="gp-overlay-root"
      role="dialog"
      aria-modal="true"
      aria-label="Settings and Pulse Studio"
    >
      <div
        className="gp-overlay-dim"
        onClick={() => {
          setOpen(false);
        }}
      />

      <div className="gp-sheet">
        <div style={{ maxWidth: '980px', margin: '0 auto' }}>
          {/* Top Sheet Header */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2
                onClick={handleSettingsTitleClick}
                style={{ margin: 0, fontSize: '1.65em', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
              >
                Settings
              </h2>
              <span style={{ fontSize: '0.85em', color: 'var(--pulse-color-text-muted)' }}>
                {t('app.disclaimer')}
              </span>
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="gp-action-pill"
                aria-label="Open Command Palette"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
                onClick={() => {
                  setCommandPaletteOpen(true);
                }}
              >
                <Command size={14} aria-hidden="true" />
                <span>Ctrl+K</span>
              </button>

              <button
                type="button"
                className="gp-action-pill"
                aria-label={t('theme.toggle')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
                onClick={() => {
                  setColorMode(colorMode === 'dark' ? 'light' : 'dark');
                }}
              >
                <SunMoon size={14} aria-hidden="true" />
                <span>{colorMode === 'dark' ? 'Light' : 'Dark'}</span>
              </button>

              <button
                type="button"
                className="gp-round-btn"
                aria-label="Close Settings"
                style={{ width: '34px', height: '34px' }}
                onClick={() => {
                  setOpen(false);
                }}
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Section Pill Tabs */}
          <nav
            aria-label="Settings sections"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              padding: '4px',
              borderRadius: 'var(--pulse-radius-md)',
              background: 'var(--pulse-color-bg-surface)',
              border: '1px solid var(--pulse-color-border-subtle)',
              marginBottom: '22px',
            }}
          >
            {SHEET_TABS.map((tab) => {
              const Icon = tab.icon;
              const isCurrent = effectiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className="gp-seg-pill"
                  data-active={isCurrent}
                  aria-current={isCurrent ? 'page' : undefined}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    if (tab.id === 'library') {
                      useUiStore.setState({ activeRoute: 'library', settingsSheetOpen: true });
                    } else {
                      setActiveRoute(tab.id);
                    }
                  }}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span>{t(tab.labelKey)}</span>
                </button>
              );
            })}
          </nav>

          {/* Accounts + Full Themes & Customization Controls on Default Settings Tab */}
          {effectiveTab === 'setup' ? (
            <div style={{ marginBottom: '26px' }}>
              <div
                style={{
                  fontSize: '0.88em',
                  fontWeight: 600,
                  opacity: 0.68,
                  marginBottom: '6px',
                }}
              >
                Accounts
              </div>
              <div
                className="pulse-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--pulse-radius-pill)',
                      background: 'var(--pulse-color-bg-elevated)',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '19px',
                      fontWeight: 600,
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {user?.images[0]?.url ? (
                      <img
                        src={user.images[0].url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      avatarInitial
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '1.05em', fontWeight: 600 }}>
                      {authStatus === 'authenticated'
                        ? (user?.display_name ?? 'Spotify Connected')
                        : authStatus === 'demo'
                          ? 'Sample Library Mode (Offline)'
                          : 'Spotify (BYO Client ID)'}
                    </div>
                    <div style={{ fontSize: '0.86em', color: 'var(--pulse-color-text-secondary)' }}>
                      {authStatus === 'authenticated'
                        ? `Authenticated via PKCE S256 • Client ID ${clientId?.slice(0, 8) ?? ''}…`
                        : 'Supply your own Spotify Developer Client ID below — zero shared quotas.'}
                    </div>
                  </div>
                </div>

                {authStatus === 'authenticated' || authStatus === 'demo' ? (
                  <button
                    type="button"
                    className="gp-action-pill"
                    onClick={() => {
                      void signOutSpotify(false);
                    }}
                  >
                    Disconnect
                  </button>
                ) : null}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <span style={{ fontSize: '0.88em', fontWeight: 600, opacity: 0.68 }}>
                  Themes & Full UI Customization
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveRoute('themes');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    fontSize: '0.85em',
                    color: 'var(--pulse-color-text-secondary)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Open JSON Theme Studio →
                </button>
              </div>

              <div className="pulse-card" style={{ marginBottom: '12px' }}>
                <ThemePresetGrid
                  compact
                  customPresets={customThemes}
                  onDeleteCustom={handleDeleteCustom}
                />
              </div>

              <CustomizationPanel
                onSavedCustomTheme={() => {
                  void pulseDb.customThemes.toArray().then(setCustomThemes);
                }}
              />
            </div>
          ) : null}

          {/* Active Pulse Feature View */}
          <ErrorBoundary>
            <Suspense fallback={<p>Loading…</p>}>
              {effectiveTab === 'setup' && <OnboardingWizard />}
              {effectiveTab === 'library' && <LibraryView />}
              {effectiveTab === 'smart-playlists' && <SmartPlaylistsView />}
              {effectiveTab === 'stats' && <StatsView />}
              {effectiveTab === 'themes' && <ThemeStudioView />}
              {effectiveTab === 'achievements' && <AchievementsView />}
              {effectiveTab === 'plugins' && <PluginsView />}
              {effectiveTab === 'privacy' && <PrivacyView />}
            </Suspense>
          </ErrorBoundary>

          <div style={{ marginTop: '20px' }}>
            <PluginSlotView slot="sidebar-footer" />
          </div>
        </div>
      </div>
    </div>
  );
}
