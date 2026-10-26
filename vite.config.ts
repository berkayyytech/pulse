import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  clearScreen: false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@pulse/plugin-sdk': path.resolve(__dirname, './packages/plugin-sdk/src/index.ts'),
    },
  },
  server: {
    // Spotify disallows `localhost` in OAuth Redirect URIs; always bind explicit IPv4 loopback
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'zustand'],
          storage: ['dexie', 'zod'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['icons/pulse-icon.svg', 'robots.txt'],
      manifest: {
        name: 'Pulse — Open Spotify Client',
        short_name: 'Pulse',
        description:
          'Standalone, customizable open-source client for Spotify Web API & Web Playback SDK (BYO Client ID). Not affiliated with Spotify.',
        theme_color: '#0B0D10',
        background_color: '#0B0D10',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icons/pulse-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
});
