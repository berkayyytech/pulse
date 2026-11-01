import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, './package.json'), 'utf8'),
) as { version?: string };

export default defineConfig({
  plugins: [react()],
  define: {
    __PULSE_APP_VERSION__: JSON.stringify(pkgJson.version ?? '0.1.0'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@pulse/plugin-sdk': path.resolve(__dirname, './packages/plugin-sdk/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://127.0.0.1:5173/',
      },
    },
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'packages/*/src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'e2e'],
    restoreMocks: true,
    clearMocks: true,
  },
});
