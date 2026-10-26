import { describe, expect, it } from 'vitest';
import { PluginManifestSchema } from '../index';
import { generatePluginFiles } from '../../../create-pulse-plugin/src/index';

describe('@pulse/plugin-sdk & create-pulse-plugin', () => {
  it('validates generated plugin manifests and rejects unauthorized permissions', () => {
    const files = generatePluginFiles({
      id: 'pulse.now-playing-badge',
      name: 'Now Playing Badge',
      author: 'Studio Dev',
    });

    const parsedManifest: unknown = JSON.parse(files['manifest.json'] ?? '{}');
    const validated = PluginManifestSchema.parse(parsedManifest);
    expect(validated.sdkVersion).toBe('1.0');
    expect(validated.permissions).toEqual(['read:player', 'ui:slot']);

    const invalidResult = PluginManifestSchema.safeParse({
      ...validated,
      permissions: ['steal:tokens'],
    });
    expect(invalidResult.success).toBe(false);
  });
});
