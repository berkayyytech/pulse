import { useEffect, useMemo, useState } from 'react';
import { Command, RotateCcw, X } from 'lucide-react';
import { playerController } from '@/features/player/playerController';
import { invokePluginCommand } from '@/features/plugins/pluginSandboxHost';
import { BUILTIN_THEME_PRESETS } from '@/features/themes/themeEngine';
import { useAchievementStore } from '@/stores/achievementStore';
import { usePluginStore } from '@/stores/pluginStore';
import { useThemeStore } from '@/stores/themeStore';
import { useUiStore } from '@/stores/uiStore';
import {
  useShortcutStore,
  type ShortcutActionId,
} from './shortcutRegistry';

interface PaletteCommandItem {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly run: () => void;
}

const SHORTCUT_LABELS: readonly [ShortcutActionId, string][] = [
  ['openCommandPalette', 'Open Command Palette'],
  ['togglePlayPause', 'Play / Pause'],
  ['nextTrack', 'Next Track'],
  ['previousTrack', 'Previous Track'],
  ['goToSearch', 'Go to Search'],
  ['goToLibrary', 'Go to Library'],
];

export function CommandPaletteModal() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setActiveRoute = useUiStore((s) => s.setActiveRoute);
  const applyThemePreset = useThemeStore((s) => s.applyThemePreset);
  const setSurfaceStyle = useThemeStore((s) => s.setSurfaceStyle);
  const setShellLayout = useThemeStore((s) => s.setShellLayout);
  const pluginCommands = usePluginStore((s) => s.registeredCommands);

  const shortcuts = useShortcutStore((s) => s.shortcuts);
  const remapShortcut = useShortcutStore((s) => s.remapShortcut);
  const resetShortcuts = useShortcutStore((s) => s.resetShortcuts);

  const [query, setQuery] = useState('');
  const [showRemapper, setShowRemapper] = useState(false);

  useEffect(() => {
    if (open) {
      useAchievementStore.getState().incrementMetric('commandPaletteOpens', 1);
    }
  }, [open]);

  const commands = useMemo<PaletteCommandItem[]>(() => {
    const base: PaletteCommandItem[] = [
      {
        id: 'nav:setup',
        label: 'Navigate: Client ID Setup Wizard',
        category: 'Navigation',
        run: () => {
          setActiveRoute('setup');
        },
      },
      {
        id: 'nav:achievements',
        label: 'Navigate: Achievements & Trophies (248)',
        category: 'Navigation',
        run: () => {
          setActiveRoute('achievements');
        },
      },
      {
        id: 'nav:library',
        label: 'Navigate: Your Library',
        category: 'Navigation',
        run: () => {
          setActiveRoute('library');
        },
      },
      {
        id: 'nav:search',
        label: 'Navigate: Instant Search',
        category: 'Navigation',
        run: () => {
          setActiveRoute('search');
        },
      },
      {
        id: 'nav:smart',
        label: 'Navigate: Smart Playlist Rules',
        category: 'Navigation',
        run: () => {
          setActiveRoute('smart-playlists');
        },
      },
      {
        id: 'nav:stats',
        label: 'Navigate: Listening Stats',
        category: 'Navigation',
        run: () => {
          setActiveRoute('stats');
        },
      },
      {
        id: 'nav:themes',
        label: 'Navigate: Theme Studio',
        category: 'Navigation',
        run: () => {
          setActiveRoute('themes');
        },
      },
      {
        id: 'nav:plugins',
        label: 'Navigate: Plugins & Sandbox',
        category: 'Navigation',
        run: () => {
          setActiveRoute('plugins');
        },
      },
      {
        id: 'player:toggle',
        label: 'Playback: Play / Pause',
        category: 'Playback',
        run: () => {
          void playerController.togglePlayPause();
        },
      },
      {
        id: 'player:next',
        label: 'Playback: Next Track',
        category: 'Playback',
        run: () => {
          void playerController.next();
        },
      },
      {
        id: 'player:prev',
        label: 'Playback: Previous Track',
        category: 'Playback',
        run: () => {
          void playerController.previous();
        },
      },
      {
        id: 'layout:split',
        label: 'Layout: Split Two-Panel View',
        category: 'Customize',
        run: () => {
          setShellLayout('split');
        },
      },
      {
        id: 'layout:bottom-player',
        label: 'Layout: Classic Bottom Player Bar',
        category: 'Customize',
        run: () => {
          setShellLayout('bottom-player');
        },
      },
      {
        id: 'layout:zen-stage',
        label: 'Layout: Zen Focus Stage',
        category: 'Customize',
        run: () => {
          setShellLayout('zen-stage');
        },
      },
      {
        id: 'surface:aero',
        label: 'Material: Frutiger Aero Glossy Gel (2007)',
        category: 'Customize',
        run: () => {
          setSurfaceStyle('aero');
        },
      },
      {
        id: 'surface:matte',
        label: 'Material: Solid Matte Surface (No Blur)',
        category: 'Customize',
        run: () => {
          setSurfaceStyle('matte');
        },
      },
      {
        id: 'surface:brutalist',
        label: 'Material: Neo-Brutalist Ink & Offset Shadow',
        category: 'Customize',
        run: () => {
          setSurfaceStyle('brutalist');
        },
      },
      {
        id: 'surface:minimal',
        label: 'Material: Borderless Minimal Canvas',
        category: 'Customize',
        run: () => {
          setSurfaceStyle('minimal');
        },
      },
      {
        id: 'surface:glass',
        label: 'Material: Frosted Liquid Glass',
        category: 'Customize',
        run: () => {
          setSurfaceStyle('glass');
        },
      },
      ...BUILTIN_THEME_PRESETS.map((preset) => ({
        id: `theme:${preset.id}`,
        label: `Theme: Apply "${preset.name}"`,
        category: 'Theme',
        run: () => {
          applyThemePreset(preset);
        },
      })),
      ...pluginCommands.map((cmd) => ({
        id: `plugin:${cmd.pluginId}:${cmd.commandId}`,
        label: `Plugin: ${cmd.title}`,
        category: 'Plugin',
        run: () => {
          invokePluginCommand(cmd.pluginId, cmd.commandId);
        },
      })),
    ];

    const needle = query.trim().toLowerCase();
    if (!needle) {
      return base;
    }
    return base.filter((c) => c.label.toLowerCase().includes(needle));
  }, [
    applyThemePreset,
    pluginCommands,
    query,
    setActiveRoute,
    setShellLayout,
    setSurfaceStyle,
  ]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'grid',
        placeItems: 'start center',
        paddingTop: '10vh',
        zIndex: 200,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div
        className="pulse-card"
        style={{
          width: 'min(600px, calc(100vw - 2rem))',
          maxHeight: '76vh',
          overflowY: 'auto',
          background: 'var(--pulse-color-bg-glass)',
          backdropFilter: 'blur(44px) saturate(160%)',
          borderRadius: '24px',
          boxShadow: 'var(--pulse-shadow-elevated)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <Command size={18} color="var(--pulse-color-accent)" aria-hidden="true" />
          <input
            type="text"
            autoFocus
            aria-label="Filter commands"
            placeholder="Type a command, route, theme, or plugin action…"
            value={query}
            onChange={(e) => {
              const nextVal = e.target.value;
              setQuery(nextVal);
              const trimmed = nextVal.trim().toLowerCase();
              if (trimmed === ':coffee' || trimmed === ':teapot') {
                useAchievementStore.getState().triggerEasterEgg('teapot');
                setOpen(false);
                setQuery('');
              } else if (trimmed === ':flip' || trimmed === ':tableflip') {
                useAchievementStore.getState().triggerEasterEgg('flip');
                setOpen(false);
                setQuery('');
              } else if (trimmed === ':dvd') {
                useAchievementStore.getState().triggerEasterEgg('dvd');
                setOpen(false);
                setQuery('');
              } else if (trimmed === ':matrix') {
                useAchievementStore.getState().triggerEasterEgg('matrix');
                setOpen(false);
                setQuery('');
              } else if (trimmed === ':rave') {
                useAchievementStore.getState().triggerEasterEgg('rave');
                setOpen(false);
                setQuery('');
              }
            }}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '1rem',
            }}
          />
          <button
            type="button"
            onClick={() => {
              setShowRemapper(!showRemapper);
            }}
            className="pulse-mono-pill"
            style={{ cursor: 'pointer' }}
          >
            {showRemapper ? 'Commands' : 'Remap Shortcuts'}
          </button>
          <button
            type="button"
            aria-label="Close Command Palette"
            onClick={() => {
              setOpen(false);
            }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {showRemapper ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <strong style={{ fontSize: '0.9rem' }}>Remappable Keyboard Shortcuts</strong>
              <button
                type="button"
                onClick={resetShortcuts}
                className="pulse-mono-pill"
                style={{ cursor: 'pointer' }}
              >
                <RotateCcw size={12} />
                <span>Reset Defaults</span>
              </button>
            </div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {SHORTCUT_LABELS.map(([actionId, label]) => (
                <label
                  key={actionId}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ fontSize: '0.88rem' }}>{label}</span>
                  <input
                    type="text"
                    aria-label={`Shortcut for ${label}`}
                    value={shortcuts[actionId]}
                    onChange={(e) => {
                      remapShortcut(actionId, e.target.value);
                    }}
                    style={{
                      width: '150px',
                      padding: '4px 8px',
                      borderRadius: 'var(--pulse-radius-sm)',
                      border: '1px solid var(--pulse-color-border-strong)',
                      background: 'var(--pulse-color-bg-canvas)',
                      fontFamily: 'var(--pulse-font-mono)',
                      fontSize: '0.8rem',
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {commands.map((cmd) => (
              <li key={cmd.id}>
                <button
                  type="button"
                  className="pulse-nav-btn"
                  onClick={() => {
                    useAchievementStore.getState().incrementMetric('commandPaletteRuns', 1);
                    cmd.run();
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <span style={{ flex: 1 }}>{cmd.label}</span>
                  <span className="pulse-mono-pill" style={{ fontSize: '0.7rem' }}>
                    {cmd.category}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
