import { describe, expect, it } from 'vitest';
import {
  BUILTIN_THEME_PRESETS,
  ThemePackSchema,
  parseAndValidateThemeJson,
} from '@/features/themes/themeEngine';

describe('Theme Token Engine & Multi-Material Presets', () => {
  it('validates all 25 built-in presets across Frutiger Aero, matte, terminal, brutalist, minimal, and glass styles', () => {
    expect(BUILTIN_THEME_PRESETS.length).toBeGreaterThanOrEqual(25);
    const ids = new Set<string>();
    const categories = new Set<string>();
    const surfaces = new Set<string>();

    for (const preset of BUILTIN_THEME_PRESETS) {
      const parsed = ThemePackSchema.parse(preset);
      expect(ids.has(parsed.id)).toBe(false);
      ids.add(parsed.id);
      if (parsed.category) {
        categories.add(parsed.category);
      }
      if (parsed.surfaceStyle) {
        surfaces.add(parsed.surfaceStyle);
      }
    }

    expect(categories.has('aero')).toBe(true);
    expect(categories.has('matte')).toBe(true);
    expect(categories.has('terminal')).toBe(true);
    expect(categories.has('brutalist')).toBe(true);
    expect(categories.has('minimal')).toBe(true);
    expect(categories.has('glass')).toBe(true);

    expect(surfaces.has('aero')).toBe(true);
    expect(surfaces.has('matte')).toBe(true);
    expect(surfaces.has('brutalist')).toBe(true);
    expect(surfaces.has('minimal')).toBe(true);
    expect(surfaces.has('glass')).toBe(true);
  });

  it('accepts valid --pulse-* token packs and rejects non-token or CSS-injection values', () => {
    const valid = parseAndValidateThemeJson(
      JSON.stringify({
        id: 'cyber-phosphor',
        name: 'Cyber Phosphor',
        mode: 'dark',
        surfaceStyle: 'matte',
        fontPreset: 'mono',
        tokens: {
          '--pulse-color-accent': '#ff9900',
          '--pulse-radius-md': '0px',
        },
      }),
    );
    expect(valid.id).toBe('cyber-phosphor');
    expect(valid.surfaceStyle).toBe('matte');

    expect(() =>
      parseAndValidateThemeJson(
        JSON.stringify({
          id: 'bad-selector-theme',
          name: 'Bad',
          mode: 'dark',
          tokens: {
            '--spotify-main-view': '#000',
          },
        }),
      ),
    ).toThrow(/Disallowed token key/);

    expect(() =>
      parseAndValidateThemeJson(
        JSON.stringify({
          id: 'css-injection-theme',
          name: 'Injection',
          mode: 'dark',
          tokens: {
            '--pulse-color-accent': 'red; background: url(https://evil.example/x)',
          },
        }),
      ),
    ).toThrow(/Unsafe CSS token value/);
  });
});
