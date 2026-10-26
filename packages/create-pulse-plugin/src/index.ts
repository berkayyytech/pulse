export interface PluginScaffoldOptions {
  readonly id: string;
  readonly name: string;
  readonly author: string;
}

export function generatePluginFiles(options: PluginScaffoldOptions): Record<string, string> {
  const manifest = {
    id: options.id,
    name: options.name,
    version: '0.1.0',
    sdkVersion: '1.0',
    author: options.author,
    description: `${options.name} plugin for Pulse`,
    entry: 'dist/worker.js',
    permissions: ['read:player', 'ui:slot'],
    settingsSchema: {
      type: 'object',
      properties: {
        showRemaining: {
          type: 'boolean',
          title: 'Show remaining track countdown',
          default: true,
        },
        prefixLabel: {
          type: 'string',
          title: 'Badge prefix',
          default: 'REM',
        },
      },
    },
  };

  const entrySource = `import { definePlugin } from '@pulse/plugin-sdk';
import manifest from '../manifest.json' with { type: 'json' };

export default definePlugin({
  manifest,
  activate(ctx) {
    return ctx.onPlayerChange((state) => {
      if (state.track) {
        const remainingSec = Math.max(0, Math.floor((state.durationMs - state.positionMs) / 1000));
        void ctx.renderSlot({
          slot: 'now-playing-badge',
          text: \`-\${remainingSec}s\`,
          tone: 'signal',
        });
      }
    });
  },
});
`;

  const packageJson = {
    name: options.id,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'npx serve -l tcp://127.0.0.1:4580 .',
    },
  };

  return {
    'package.json': `${JSON.stringify(packageJson, null, 2)}\n`,
    'manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
    'src/worker.ts': entrySource,
  };
}
