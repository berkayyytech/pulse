import { useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { pulseDb } from '@/storage/db';
import { useAchievementStore } from '@/stores/achievementStore';
import {
  useThemeStore,
  type ColorMode,
  type LayoutDensity,
  type SidebarPosition,
} from '@/stores/themeStore';
import type {
  ArtworkStyle,
  BackdropTexture,
  FontPreset,
  ShellLayout,
  SurfaceStyle,
  ThemePack,
  WindowChromeStyle,
} from './themeEngine';

function toValidHexColor(raw: string | undefined, fallback: string): string {
  if (!raw) {
    return fallback;
  }
  const trimmed = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1] ?? '0';
    const g = trimmed[2] ?? '0';
    const b = trimmed[3] ?? '0';
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

const LIVE_COLOR_FIELDS = [
  ['--pulse-color-bg-canvas', 'Canvas Background', '#12151e'],
  ['--pulse-color-panel-solid', 'Panel Surface (Matte/Brutal)', '#18181b'],
  ['--pulse-color-text-primary', 'Primary Text', '#ffffff'],
  ['--pulse-color-accent', 'Accent & Progress Rail', '#1ed760'],
  ['--pulse-color-signal', 'Active Toggle Signal', '#34c759'],
] as const;

interface CustomizationPanelProps {
  readonly onSavedCustomTheme?: (saved: ThemePack) => void;
}

export function CustomizationPanel({ onSavedCustomTheme }: CustomizationPanelProps) {
  const colorMode = useThemeStore((s) => s.colorMode);
  const surfaceStyle = useThemeStore((s) => s.surfaceStyle);
  const shellLayout = useThemeStore((s) => s.shellLayout);
  const artworkStyle = useThemeStore((s) => s.artworkStyle);
  const fontPreset = useThemeStore((s) => s.fontPreset);
  const backdropTexture = useThemeStore((s) => s.backdropTexture);
  const windowChromeStyle = useThemeStore((s) => s.windowChromeStyle);
  const sidebarPosition = useThemeStore((s) => s.sidebarPosition);
  const density = useThemeStore((s) => s.density);
  const showTrackArtwork = useThemeStore((s) => s.showTrackArtwork);
  const uiScalePx = useThemeStore((s) => s.uiScalePx);
  const sidebarWidthPx = useThemeStore((s) => s.sidebarWidthPx);
  const artworkSizePx = useThemeStore((s) => s.artworkSizePx);
  const reducedMotion = useThemeStore((s) => s.reducedMotion);
  const ambientGlow = useThemeStore((s) => s.ambientGlow);
  const dynamicAlbumArtAccent = useThemeStore((s) => s.dynamicAlbumArtAccent);
  const customTokens = useThemeStore((s) => s.customTokens);

  const setColorMode = useThemeStore((s) => s.setColorMode);
  const setSurfaceStyle = useThemeStore((s) => s.setSurfaceStyle);
  const setShellLayout = useThemeStore((s) => s.setShellLayout);
  const setArtworkStyle = useThemeStore((s) => s.setArtworkStyle);
  const setFontPreset = useThemeStore((s) => s.setFontPreset);
  const setBackdropTexture = useThemeStore((s) => s.setBackdropTexture);
  const setWindowChromeStyle = useThemeStore((s) => s.setWindowChromeStyle);
  const setSidebarPosition = useThemeStore((s) => s.setSidebarPosition);
  const setDensity = useThemeStore((s) => s.setDensity);
  const setShowTrackArtwork = useThemeStore((s) => s.setShowTrackArtwork);
  const setUiScalePx = useThemeStore((s) => s.setUiScalePx);
  const setSidebarWidthPx = useThemeStore((s) => s.setSidebarWidthPx);
  const setArtworkSizePx = useThemeStore((s) => s.setArtworkSizePx);
  const setReducedMotion = useThemeStore((s) => s.setReducedMotion);
  const setAmbientGlow = useThemeStore((s) => s.setAmbientGlow);
  const setDynamicAlbumArtAccent = useThemeStore((s) => s.setDynamicAlbumArtAccent);
  const updateSingleToken = useThemeStore((s) => s.updateSingleToken);
  const setActivePresetId = useThemeStore((s) => s.setActivePresetId);
  const resetAllCustomization = useThemeStore((s) => s.resetAllCustomization);

  const [presetNameInput, setPresetNameInput] = useState('');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const currentRadiusPx = Number.parseInt(customTokens['--pulse-radius-lg'] ?? '28', 10);
  const resolvedRadiusPx = Number.isNaN(currentRadiusPx) ? 28 : currentRadiusPx;

  const currentBlurPx = Number.parseInt(customTokens['--pulse-blur-glass'] ?? '42', 10);
  const resolvedBlurPx = Number.isNaN(currentBlurPx) ? 42 : currentBlurPx;

  const handleCornerRadiusChange = (px: number) => {
    const small = Math.max(0, Math.round(px * 0.4));
    const med = Math.max(0, Math.round(px * 0.6));
    updateSingleToken('--pulse-radius-sm', `${small}px`);
    updateSingleToken('--pulse-radius-md', `${med}px`);
    updateSingleToken('--pulse-radius-lg', `${px}px`);
    updateSingleToken('--pulse-radius-art', `${px}px`);
  };

  const handleSaveAsCustomPreset = async () => {
    const trimmed = presetNameInput.trim() || 'My Custom Theme';
    const slug =
      'custom-' +
      trimmed
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) +
      '-' +
      String(Date.now()).slice(-4);

    const themePack: ThemePack = {
      id: slug,
      name: trimmed,
      description: `${surfaceStyle} • ${fontPreset} • ${artworkStyle} art`,
      author: 'Local User',
      mode: colorMode === 'light' ? 'light' : 'dark',
      category:
        surfaceStyle === 'aero'
          ? 'aero'
          : surfaceStyle === 'brutalist'
            ? 'brutalist'
            : surfaceStyle === 'minimal'
              ? 'minimal'
              : fontPreset === 'mono'
                ? 'terminal'
                : surfaceStyle === 'matte'
                  ? 'matte'
                  : 'glass',
      surfaceStyle,
      artworkStyle,
      fontPreset,
      backdropTexture,
      ambientGlow,
      tokens: { ...customTokens },
    };

    await pulseDb.customThemes.put({
      ...themePack,
      updatedAt: Date.now(),
    });
    useAchievementStore.getState().incrementMetric('customPresetsSaved', 1);
    setActivePresetId(themePack.id);
    setPresetNameInput('');
    setSaveNotice(`Saved "${themePack.name}" to your local presets.`);
    onSavedCustomTheme?.(themePack);
  };

  return (
    <div className="pulse-card-grid">
      {/* 1. Surface Material & Shell Layout */}
      <article className="pulse-card" style={{ display: 'grid', gap: '12px', alignContent: 'start' }}>
        <h3 style={{ fontSize: '0.96rem', margin: 0 }}>Material & Shell Layout</h3>

        <div>
          <div style={{ fontSize: '0.82rem', opacity: 0.72, marginBottom: '5px' }}>
            Surface Material
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {(
              [
                ['aero', 'Frutiger Aero'],
                ['matte', 'Solid Matte'],
                ['brutalist', 'Neo-Brutalist'],
                ['minimal', 'Borderless'],
                ['glass', 'Liquid Glass'],
              ] as readonly [SurfaceStyle, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="gp-seg-pill"
                data-active={surfaceStyle === id}
                style={{
                  padding: '5px 10px',
                  fontSize: '0.8rem',
                  border: '1px solid var(--pulse-color-border-subtle)',
                }}
                onClick={() => {
                  setSurfaceStyle(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.82rem', opacity: 0.72, marginBottom: '5px' }}>
            Player Layout
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {(
              [
                ['split', 'Split Panels'],
                ['bottom-player', 'Bottom Bar'],
                ['zen-stage', 'Zen Stage'],
              ] as readonly [ShellLayout, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="gp-seg-pill"
                data-active={shellLayout === id}
                style={{
                  padding: '5px 10px',
                  fontSize: '0.8rem',
                  border: '1px solid var(--pulse-color-border-subtle)',
                }}
                onClick={() => {
                  setShellLayout(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {shellLayout === 'split' ? (
          <>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.86rem' }}>Browser Side</span>
              <select
                aria-label="Sidebar position"
                value={sidebarPosition}
                onChange={(e) => {
                  setSidebarPosition(e.target.value as SidebarPosition);
                }}
                style={{
                  background: 'var(--pulse-color-bg-canvas)',
                  border: '1px solid var(--pulse-color-border-strong)',
                  borderRadius: 'var(--pulse-radius-sm)',
                  padding: '4px 8px',
                }}
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: '3px' }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                <span>Browser Width</span>
                <code>{sidebarWidthPx}px</code>
              </span>
              <input
                type="range"
                aria-label="Browser width"
                min={270}
                max={520}
                value={sidebarWidthPx}
                onChange={(e) => {
                  setSidebarWidthPx(Number(e.target.value));
                }}
              />
            </label>
          </>
        ) : null}

        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.86rem' }}>Color Mode</span>
          <select
            aria-label="Color mode"
            value={colorMode}
            onChange={(e) => {
              setColorMode(e.target.value as ColorMode);
            }}
            style={{
              background: 'var(--pulse-color-bg-canvas)',
              border: '1px solid var(--pulse-color-border-strong)',
              borderRadius: 'var(--pulse-radius-sm)',
              padding: '4px 8px',
            }}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="auto">Auto (OS)</option>
          </select>
        </label>
      </article>

      {/* 2. Artwork, Corners & Typography */}
      <article className="pulse-card" style={{ display: 'grid', gap: '12px', alignContent: 'start' }}>
        <h3 style={{ fontSize: '0.96rem', margin: 0 }}>Artwork, Corners & Typography</h3>

        <div>
          <div style={{ fontSize: '0.82rem', opacity: 0.72, marginBottom: '5px' }}>
            Album Art Presentation
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {(
              [
                ['rounded', 'Rounded'],
                ['sharp', 'Sharp Sleeve'],
                ['vinyl', 'Spinning Vinyl'],
                ['minimal', 'Flat Minimal'],
              ] as readonly [ArtworkStyle, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="gp-seg-pill"
                data-active={artworkStyle === id}
                style={{
                  padding: '5px 10px',
                  fontSize: '0.8rem',
                  border: '1px solid var(--pulse-color-border-subtle)',
                }}
                onClick={() => {
                  setArtworkStyle(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: 'grid', gap: '3px' }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
            <span>Album Art Size</span>
            <code>{artworkSizePx}px</code>
          </span>
          <input
            type="range"
            aria-label="Album art size"
            min={180}
            max={350}
            value={artworkSizePx}
            onChange={(e) => {
              setArtworkSizePx(Number(e.target.value));
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: '3px' }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
            <span>Corner Radius</span>
            <code>{resolvedRadiusPx}px</code>
          </span>
          <input
            type="range"
            aria-label="Glass corner radius"
            min={0}
            max={36}
            value={resolvedRadiusPx}
            onChange={(e) => {
              handleCornerRadiusChange(Number(e.target.value));
            }}
          />
        </label>

        <div>
          <div style={{ fontSize: '0.82rem', opacity: 0.72, marginBottom: '5px' }}>
            Typography Family
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {(
              [
                ['sans', 'Modern Sans'],
                ['mono', 'Monospace'],
                ['serif', 'Editorial Serif'],
                ['geometric', 'Geometric'],
              ] as readonly [FontPreset, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="gp-seg-pill"
                data-active={fontPreset === id}
                style={{
                  padding: '5px 10px',
                  fontSize: '0.8rem',
                  border: '1px solid var(--pulse-color-border-subtle)',
                }}
                onClick={() => {
                  setFontPreset(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: 'grid', gap: '3px' }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
            <span>UI Font Scale</span>
            <code>{uiScalePx}px</code>
          </span>
          <input
            type="range"
            aria-label="UI font scale"
            min={12}
            max={16}
            value={uiScalePx}
            onChange={(e) => {
              setUiScalePx(Number(e.target.value));
            }}
          />
        </label>
      </article>

      {/* 3. List Density, Window Chrome & Backdrop Effects */}
      <article className="pulse-card" style={{ display: 'grid', gap: '11px', alignContent: 'start' }}>
        <h3 style={{ fontSize: '0.96rem', margin: 0 }}>List Density, Chrome & Effects</h3>

        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.86rem' }}>Track Row Density</span>
          <select
            aria-label="Collection density"
            value={density}
            onChange={(e) => {
              setDensity(e.target.value as LayoutDensity);
            }}
            style={{
              background: 'var(--pulse-color-bg-canvas)',
              border: '1px solid var(--pulse-color-border-strong)',
              borderRadius: 'var(--pulse-radius-sm)',
              padding: '4px 8px',
            }}
          >
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="spacious">Spacious</option>
          </select>
        </label>

        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.86rem' }}>Window Controls</span>
          <select
            aria-label="Window controls style"
            value={windowChromeStyle}
            onChange={(e) => {
              setWindowChromeStyle(e.target.value as WindowChromeStyle);
            }}
            style={{
              background: 'var(--pulse-color-bg-canvas)',
              border: '1px solid var(--pulse-color-border-strong)',
              borderRadius: 'var(--pulse-radius-sm)',
              padding: '4px 8px',
            }}
          >
            <option value="macos">Traffic Light Dots</option>
            <option value="minimal">Monochrome Squares</option>
            <option value="hidden">Hidden (Chromeless)</option>
          </select>
        </label>

        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.86rem' }}>Backdrop Texture</span>
          <select
            aria-label="Backdrop texture"
            value={backdropTexture}
            onChange={(e) => {
              setBackdropTexture(e.target.value as BackdropTexture);
            }}
            style={{
              background: 'var(--pulse-color-bg-canvas)',
              border: '1px solid var(--pulse-color-border-strong)',
              borderRadius: 'var(--pulse-radius-sm)',
              padding: '4px 8px',
            }}
          >
            <option value="none">None</option>
            <option value="bubbles">Frutiger Soap Bubbles</option>
            <option value="noise">Analog Film Grain</option>
            <option value="grid">Architectural Dot Grid</option>
            <option value="scanlines">CRT Scanlines</option>
          </select>
        </label>

        {surfaceStyle === 'glass' ? (
          <label style={{ display: 'grid', gap: '3px' }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span>Glass Blur Intensity</span>
              <code>{resolvedBlurPx}px</code>
            </span>
            <input
              type="range"
              aria-label="Frosted blur radius"
              min={0}
              max={64}
              value={resolvedBlurPx}
              onChange={(e) => {
                updateSingleToken('--pulse-blur-glass', `${e.target.value}px`);
              }}
            />
          </label>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.86rem' }}>Show Track Thumbnails</span>
          <button
            type="button"
            role="switch"
            aria-label="Show track thumbnails"
            aria-checked={showTrackArtwork}
            className="gp-switch"
            onClick={() => {
              setShowTrackArtwork(!showTrackArtwork);
            }}
          >
            <span className="gp-switch-knob" />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.86rem' }}>Ambient Cover Glow</span>
          <button
            type="button"
            role="switch"
            aria-label="Ambient glow"
            aria-checked={ambientGlow}
            className="gp-switch"
            onClick={() => {
              setAmbientGlow(!ambientGlow);
            }}
          >
            <span className="gp-switch-knob" />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.86rem' }}>Dynamic Cover Accent</span>
          <button
            type="button"
            role="switch"
            aria-label="Dynamic cover accent"
            aria-checked={dynamicAlbumArtAccent}
            className="gp-switch"
            onClick={() => {
              setDynamicAlbumArtAccent(!dynamicAlbumArtAccent);
            }}
          >
            <span className="gp-switch-knob" />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.86rem' }}>Reduced Motion</span>
          <button
            type="button"
            role="switch"
            aria-label="Reduced motion"
            aria-checked={reducedMotion}
            className="gp-switch"
            onClick={() => {
              setReducedMotion(!reducedMotion);
            }}
          >
            <span className="gp-switch-knob" />
          </button>
        </div>
      </article>

      {/* 4. Custom Color Overrides & Save Custom Preset */}
      <article className="pulse-card" style={{ display: 'grid', gap: '10px', alignContent: 'start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.96rem', margin: 0 }}>Custom Colors & Save Preset</h3>
          <button
            type="button"
            onClick={() => {
              resetAllCustomization();
              setSaveNotice('Restored default appearance settings.');
            }}
            className="pulse-mono-pill"
            style={{ cursor: 'pointer' }}
          >
            <RotateCcw size={12} />
            <span>Reset All</span>
          </button>
        </div>

        {LIVE_COLOR_FIELDS.map(([tokenKey, label, fallbackHex]) => (
          <label
            key={tokenKey}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span style={{ fontSize: '0.84rem' }}>{label}</span>
            <input
              type="color"
              aria-label={label}
              value={toValidHexColor(customTokens[tokenKey], fallbackHex)}
              onChange={(e) => {
                updateSingleToken(tokenKey, e.target.value);
                useAchievementStore.getState().incrementMetric('customColorsEdited', 1);
              }}
              style={{
                width: '36px',
                height: '26px',
                padding: 0,
                border: '1px solid var(--pulse-color-border-strong)',
                borderRadius: 'var(--pulse-radius-sm)',
                background: 'transparent',
                cursor: 'pointer',
              }}
            />
          </label>
        ))}

        <div
          style={{
            marginTop: '4px',
            paddingTop: '10px',
            borderTop: '1px solid var(--pulse-color-border-subtle)',
            display: 'grid',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              aria-label="Custom preset name"
              placeholder="Name your custom theme…"
              value={presetNameInput}
              onChange={(e) => {
                setPresetNameInput(e.target.value);
              }}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '6px 10px',
                borderRadius: 'var(--pulse-radius-sm)',
                border: '1px solid var(--pulse-color-border-strong)',
                background: 'var(--pulse-color-bg-canvas)',
                fontSize: '0.84rem',
              }}
            />
            <button
              type="button"
              className="gp-action-pill"
              style={{
                padding: '6px 12px',
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              onClick={() => {
                void handleSaveAsCustomPreset();
              }}
            >
              <Save size={13} />
              <span>Save</span>
            </button>
          </div>
          {saveNotice ? (
            <span role="status" style={{ fontSize: '0.78rem', color: 'var(--pulse-color-signal)' }}>
              {saveNotice}
            </span>
          ) : null}
        </div>
      </article>
    </div>
  );
}
