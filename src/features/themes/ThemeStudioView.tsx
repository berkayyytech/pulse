import { useEffect, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { scheduleDesktopSettingsSave } from '@/platform/desktopSettingsSync';
import { pulseDb } from '@/storage/db';
import { useAchievementStore } from '@/stores/achievementStore';
import { useThemeStore } from '@/stores/themeStore';
import { CustomizationPanel } from './CustomizationPanel';
import {
  BUILTIN_THEME_PRESETS,
  parseAndValidateThemeJson,
  type ThemePack,
} from './themeEngine';
import { ThemePresetGrid } from './ThemePresetGrid';

export default function ThemeStudioView() {
  const colorMode = useThemeStore((s) => s.colorMode);
  const surfaceStyle = useThemeStore((s) => s.surfaceStyle);
  const artworkStyle = useThemeStore((s) => s.artworkStyle);
  const fontPreset = useThemeStore((s) => s.fontPreset);
  const backdropTexture = useThemeStore((s) => s.backdropTexture);
  const ambientGlow = useThemeStore((s) => s.ambientGlow);
  const customTokens = useThemeStore((s) => s.customTokens);
  const applyThemePreset = useThemeStore((s) => s.applyThemePreset);

  const [savedCustomThemes, setSavedCustomThemes] = useState<ThemePack[]>([]);
  const [importJson, setImportJson] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void pulseDb.customThemes.toArray().then((rows) => {
      if (active) {
        setSavedCustomThemes(rows);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleExportJson = () => {
    const exported: ThemePack = {
      id: 'custom-pulse-theme',
      name: 'Custom Pulse Theme',
      author: 'Local User',
      mode: colorMode === 'light' ? 'light' : 'dark',
      surfaceStyle,
      artworkStyle,
      fontPreset,
      backdropTexture,
      ambientGlow,
      tokens: { ...customTokens },
    };
    const json = JSON.stringify(exported, null, 2);
    setImportJson(json);
    useAchievementStore.getState().setFlag('themeJsonExported');
    setFeedback('Exported active theme & material settings to JSON below.');
  };

  const handleImportJson = async () => {
    try {
      const parsed = parseAndValidateThemeJson(importJson);
      await pulseDb.customThemes.put({
        ...parsed,
        updatedAt: Date.now(),
      });
      scheduleDesktopSettingsSave();
      setSavedCustomThemes(await pulseDb.customThemes.toArray());
      applyThemePreset(parsed);
      useAchievementStore.getState().setFlag('themeJsonImported');
      setFeedback(`Imported & applied "${parsed.name}".`);
    } catch (err) {
      setFeedback(
        err instanceof Error ? `Theme validation error: ${err.message}` : 'Invalid theme JSON',
      );
    }
  };

  const handleDeleteCustom = (id: string) => {
    void pulseDb.customThemes.delete(id).then(async () => {
      setSavedCustomThemes(await pulseDb.customThemes.toArray());
      setFeedback('Removed saved custom theme.');
    });
  };

  return (
    <section aria-labelledby="theme-studio-heading">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <h1
          id="theme-studio-heading"
          style={{ fontFamily: 'var(--pulse-font-display)', margin: 0 }}
        >
          Theme Studio & Layout Engine
        </h1>
        <span className="pulse-mono-pill">
          {BUILTIN_THEME_PRESETS.length} Built-in + {savedCustomThemes.length} Saved
        </span>
      </div>

      <p style={{ color: 'var(--pulse-color-text-secondary)', maxWidth: '72ch' }}>
        Switch across glossy 2007 Frutiger Aero gel surfaces, solid matte studio cards, sharp 0px
        CRT terminals, 2px neo-brutalist print zines, spinning vinyl galleries, or borderless OLED
        canvases — or mix and match any material, layout, font, and color token below.
      </p>

      {feedback ? (
        <p role="status" style={{ color: 'var(--pulse-color-signal)', fontSize: '0.9rem' }}>
          {feedback}
        </p>
      ) : null}

      <ThemePresetGrid
        presets={BUILTIN_THEME_PRESETS}
        customPresets={savedCustomThemes}
        onDeleteCustom={handleDeleteCustom}
        onApplied={(preset) => {
          setFeedback(`Applied "${preset.name}" (${preset.surfaceStyle ?? 'glass'} surface)`);
        }}
      />

      <CustomizationPanel
        onSavedCustomTheme={() => {
          void pulseDb.customThemes.toArray().then(setSavedCustomThemes);
        }}
      />

      {/* JSON Import / Export */}
      <article className="pulse-card" style={{ marginTop: '1rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '0.6rem',
          }}
        >
          <h2 style={{ fontSize: '1rem', margin: 0 }}>Import / Export Theme JSON Pack</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleExportJson}
              className="pulse-mono-pill"
              style={{ cursor: 'pointer', padding: '4px 10px' }}
            >
              <Download size={13} />
              <span>Export Current JSON</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void handleImportJson();
              }}
              className="pulse-mono-pill"
              data-tone="accent"
              style={{ cursor: 'pointer', padding: '4px 10px' }}
            >
              <Upload size={13} />
              <span>Validate & Import JSON</span>
            </button>
          </div>
        </div>
        <textarea
          aria-label="Theme JSON manifest"
          rows={6}
          placeholder='{"id":"my-matte","name":"My Matte Theme","mode":"dark","surfaceStyle":"matte","tokens":{"--pulse-color-accent":"#1ed760"}}'
          value={importJson}
          onChange={(e) => {
            setImportJson(e.target.value);
          }}
          style={{
            width: '100%',
            padding: '0.65rem',
            borderRadius: 'var(--pulse-radius-sm)',
            border: '1px solid var(--pulse-color-border-strong)',
            background: 'var(--pulse-color-bg-canvas)',
            fontFamily: 'var(--pulse-font-mono)',
            fontSize: '0.82rem',
          }}
        />
      </article>
    </section>
  );
}
