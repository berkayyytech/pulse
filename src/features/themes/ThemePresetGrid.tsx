import { useMemo, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import {
  BUILTIN_THEME_PRESETS,
  type ThemeCategory,
  type ThemePack,
} from './themeEngine';

type CategoryFilter = 'all' | ThemeCategory | 'custom';

const CATEGORY_LABELS: readonly [CategoryFilter, string][] = [
  ['all', 'All Themes'],
  ['aero', 'Frutiger Aero'],
  ['matte', 'Solid Matte'],
  ['terminal', 'Terminal & Retro'],
  ['brutalist', 'Brutalist & Print'],
  ['minimal', 'Minimal'],
  ['glass', 'Liquid Glass'],
];

interface ThemePresetGridProps {
  readonly presets?: readonly ThemePack[];
  readonly customPresets?: readonly ThemePack[];
  readonly onApplied?: (preset: ThemePack) => void;
  readonly onDeleteCustom?: (id: string) => void;
  readonly compact?: boolean;
  readonly showCategoryFilter?: boolean;
}

export function ThemePresetGrid({
  presets = BUILTIN_THEME_PRESETS,
  customPresets = [],
  onApplied,
  onDeleteCustom,
  compact = false,
  showCategoryFilter = true,
}: ThemePresetGridProps) {
  const activePresetId = useThemeStore((s) => s.activePresetId);
  const applyThemePreset = useThemeStore((s) => s.applyThemePreset);
  const [category, setCategory] = useState<CategoryFilter>('all');

  const combined = useMemo(() => [...presets, ...customPresets], [customPresets, presets]);

  const filtered = useMemo(() => {
    if (category === 'all') {
      return combined;
    }
    if (category === 'custom') {
      return customPresets;
    }
    return combined.filter((p) => (p.category ?? 'glass') === category);
  }, [category, combined, customPresets]);

  const customIds = useMemo(() => new Set(customPresets.map((c) => c.id)), [customPresets]);

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      {showCategoryFilter ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
          }}
          role="group"
          aria-label="Filter themes by style"
        >
          {CATEGORY_LABELS.map(([id, label]) => {
            const active = category === id;
            return (
              <button
                key={id}
                type="button"
                className="gp-seg-pill"
                data-active={active}
                style={{
                  padding: '4px 12px',
                  fontSize: '0.82rem',
                  border: '1px solid var(--pulse-color-border-subtle)',
                }}
                onClick={() => {
                  setCategory(id);
                }}
              >
                {label}
              </button>
            );
          })}
          {customPresets.length > 0 ? (
            <button
              type="button"
              className="gp-seg-pill"
              data-active={category === 'custom'}
              style={{
                padding: '4px 12px',
                fontSize: '0.82rem',
                border: '1px solid var(--pulse-color-border-subtle)',
              }}
              onClick={() => {
                setCategory('custom');
              }}
            >
              Saved ({customPresets.length})
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact
            ? 'repeat(auto-fill, minmax(176px, 1fr))'
            : 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '10px',
        }}
      >
        {filtered.map((preset) => {
          const isActive = activePresetId === preset.id;
          const isCustom = customIds.has(preset.id);
          const surface = preset.surfaceStyle ?? 'glass';
          const isGlass = surface === 'glass' || surface === 'aero';
          const isAero = surface === 'aero';
          const isBrutalist = surface === 'brutalist';
          const isMinimal = surface === 'minimal';
          const isTerminal = preset.category === 'terminal';
          const isVinyl = preset.artworkStyle === 'vinyl';

          const canvas = preset.tokens['--pulse-color-bg-canvas'] ?? '#12151e';
          const halo = preset.tokens['--pulse-color-bg-halo'] ?? canvas;
          const panelSolid =
            preset.tokens['--pulse-color-panel-solid'] ??
            (preset.mode === 'light' ? '#ffffff' : '#18181b');
          const borderCol =
            preset.tokens['--pulse-color-border-strong'] ??
            preset.tokens['--pulse-color-border-subtle'] ??
            'rgba(255,255,255,0.22)';
          const textPrimary =
            preset.tokens['--pulse-color-text-primary'] ??
            (preset.mode === 'light' ? '#11151f' : '#ffffff');
          const blob1 = preset.tokens['--pulse-color-blob-1'] ?? 'rgba(94, 92, 230, 0.6)';
          const blob2 = preset.tokens['--pulse-color-blob-2'] ?? 'rgba(255, 55, 95, 0.55)';
          const accent = preset.tokens['--pulse-color-accent'] ?? '#ffffff';
          const miniRadius = isBrutalist || isTerminal ? '0px' : isMinimal ? '2px' : '7px';

          const badgeText = isCustom
            ? 'custom'
            : isAero
              ? 'aero'
              : isBrutalist
                ? 'brutal'
                : isTerminal
                  ? 'mono'
                  : isMinimal
                    ? 'minimal'
                    : surface;

          return (
            <div
              key={preset.id}
              style={{ position: 'relative', display: 'flex' }}
            >
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  applyThemePreset(preset);
                  onApplied?.(preset);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: '8px',
                  padding: '10px',
                  borderRadius: 'var(--pulse-radius-md)',
                  background: isActive
                    ? 'var(--pulse-color-bg-elevated)'
                    : 'var(--pulse-color-bg-surface)',
                  border: isActive
                    ? '2px solid var(--pulse-color-accent)'
                    : '1px solid var(--pulse-color-border-subtle)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'transform 140ms ease, background-color 140ms ease',
                }}
              >
                {/* Authentic Material Miniature Preview */}
                <div
                  aria-hidden="true"
                  style={{
                    position: 'relative',
                    height: compact ? '48px' : '60px',
                    borderRadius: miniRadius,
                    overflow: 'hidden',
                    background: isGlass
                      ? `radial-gradient(circle at 50% 30%, ${halo} 0%, ${canvas} 82%)`
                      : canvas,
                    border: `1px solid ${borderCol}`,
                  }}
                >
                  {isGlass ? (
                    <>
                      <span
                        style={{
                          position: 'absolute',
                          width: '68px',
                          height: '68px',
                          left: '-14px',
                          top: '-18px',
                          borderRadius: '50%',
                          background: `radial-gradient(circle, ${blob1} 0%, transparent 70%)`,
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          width: '68px',
                          height: '68px',
                          right: '-14px',
                          bottom: '-20px',
                          borderRadius: '50%',
                          background: `radial-gradient(circle, ${blob2} 0%, transparent 70%)`,
                        }}
                      />
                    </>
                  ) : null}

                  {isTerminal ? (
                    <span
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage:
                          'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.28) 3px, rgba(0,0,0,0.28) 4px)',
                      }}
                    />
                  ) : null}

                  {/* Mini Split Panels Silhouette */}
                  <span
                    style={{
                      position: 'absolute',
                      inset: '6px 7px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.55fr',
                      gap: '5px',
                    }}
                  >
                    <span
                      style={{
                        borderRadius: miniRadius,
                        background: isMinimal
                          ? 'transparent'
                          : isGlass
                            ? preset.mode === 'light'
                              ? 'rgba(255, 255, 255, 0.55)'
                              : 'rgba(255, 255, 255, 0.14)'
                            : panelSolid,
                        border: isMinimal
                          ? 'none'
                          : isBrutalist
                            ? `1.5px solid ${borderCol}`
                            : `1px solid ${borderCol}`,
                        borderRight: isMinimal ? `1px solid ${borderCol}` : undefined,
                        boxShadow: isBrutalist ? `2px 2px 0 ${borderCol}` : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: '3px',
                        padding: '4px',
                      }}
                    >
                      <span
                        style={{
                          width: '78%',
                          height: '2.5px',
                          background: textPrimary,
                          opacity: 0.55,
                        }}
                      />
                      <span
                        style={{
                          width: '55%',
                          height: '2.5px',
                          background: textPrimary,
                          opacity: 0.3,
                        }}
                      />
                    </span>

                    <span
                      style={{
                        borderRadius: miniRadius,
                        background: isMinimal
                          ? 'transparent'
                          : isGlass
                            ? preset.mode === 'light'
                              ? 'rgba(255, 255, 255, 0.55)'
                              : 'rgba(255, 255, 255, 0.14)'
                            : panelSolid,
                        border: isMinimal
                          ? 'none'
                          : isBrutalist
                            ? `1.5px solid ${borderCol}`
                            : `1px solid ${borderCol}`,
                        boxShadow: isBrutalist ? `2px 2px 0 ${borderCol}` : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 6px',
                      }}
                    >
                      <span
                        style={{
                          width: compact ? '16px' : '22px',
                          height: compact ? '16px' : '22px',
                          borderRadius: isVinyl ? '50%' : miniRadius,
                          background: accent,
                          opacity: 0.88,
                          border: isVinyl ? `2px solid ${textPrimary}` : 'none',
                        }}
                      />
                      <span
                        style={{
                          width: '70%',
                          height: '3px',
                          borderRadius: isBrutalist || isTerminal ? '0px' : '999px',
                          background: accent,
                        }}
                      />
                    </span>
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.93em',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {preset.name}
                  </span>
                  {isActive ? (
                    <Check size={14} color="var(--pulse-color-signal)" aria-label="Active theme" />
                  ) : (
                    <span
                      style={{
                        fontSize: '0.72em',
                        fontFamily: 'var(--pulse-font-mono)',
                        opacity: 0.62,
                        textTransform: 'uppercase',
                      }}
                    >
                      {badgeText}
                    </span>
                  )}
                </div>

                {!compact && preset.description ? (
                  <span
                    style={{
                      fontSize: '0.82em',
                      color: 'var(--pulse-color-text-secondary)',
                      lineHeight: 1.35,
                    }}
                  >
                    {preset.description}
                  </span>
                ) : null}
              </button>

              {isCustom && onDeleteCustom ? (
                <button
                  type="button"
                  aria-label={`Delete custom theme ${preset.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteCustom(preset.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '24px',
                    height: '24px',
                    borderRadius: 'var(--pulse-radius-sm)',
                    border: '1px solid var(--pulse-color-border-strong)',
                    background: 'var(--pulse-color-panel-solid)',
                    color: 'var(--pulse-color-danger)',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={12} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
