import { describe, expect, it, vi } from 'vitest';
import {
  flushDesktopSettingsToDisk,
  hydrateDesktopSettingsFromDisk,
  resetDesktopSyncStateForTesting,
} from '@/platform/desktopSettingsSync';
import { probeEmeSupport } from '@/platform/emeProbe';
import { openExternalUrl } from '@/platform/openExternal';
import { resolveRedirectUri } from '@/platform/redirectUri';
import { WebCryptoIndexedDbVault } from '@/platform/tokenVault';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useThemeStore } from '@/stores/themeStore';

describe('Platform Security, Redirect URI Rules & EME Probing', () => {
  it('encrypts secrets in WebCryptoIndexedDbVault and never stores plaintext bytes', async () => {
    const vault = new WebCryptoIndexedDbVault();
    await vault.clearAll();

    const secretToken = 'AQD_super_sensitive_refresh_token_value_998877';
    await vault.setSecret('spotify_refresh_token', secretToken);

    const rawEnvelope = await vault.inspectRawEnvelopeForTesting('spotify_refresh_token');
    expect(rawEnvelope).toBeDefined();
    expect(rawEnvelope?.iv).toHaveLength(12);

    const rawBytesAsText = new TextDecoder().decode(rawEnvelope?.ciphertext);
    expect(rawBytesAsText).not.toContain('super_sensitive_refresh_token');

    const roundTrip = await vault.getSecret('spotify_refresh_token');
    expect(roundTrip).toBe(secretToken);

    await vault.deleteSecret('spotify_refresh_token');
    expect(await vault.getSecret('spotify_refresh_token')).toBeNull();
  });

  it('enforces Spotify 2026 Redirect URI rules (rejects localhost, accepts 127.0.0.1 and https)', () => {
    const localhostCheck = resolveRedirectUri({
      protocol: 'http:',
      hostname: 'localhost',
      port: '5173',
      origin: 'http://localhost:5173',
    });
    expect(localhostCheck.valid).toBe(false);
    expect(localhostCheck.uri).toBe('http://127.0.0.1:5173/auth/callback');

    const loopbackCheck = resolveRedirectUri({
      protocol: 'http:',
      hostname: '127.0.0.1',
      port: '5173',
      origin: 'http://127.0.0.1:5173',
    });
    expect(loopbackCheck.valid).toBe(true);
    expect(loopbackCheck.uri).toBe('http://127.0.0.1:5173/auth/callback');

    const insecureLanCheck = resolveRedirectUri({
      protocol: 'http:',
      hostname: '192.168.1.25',
      port: '5173',
      origin: 'http://192.168.1.25:5173',
    });
    expect(insecureLanCheck.valid).toBe(false);

    const httpsPwaCheck = resolveRedirectUri({
      protocol: 'https:',
      hostname: 'pulse.example.org',
      port: '',
      origin: 'https://pulse.example.org',
    });
    expect(httpsPwaCheck.valid).toBe(true);
    expect(httpsPwaCheck.uri).toBe('https://pulse.example.org/auth/callback');
  });

  it('gracefully falls back to Connect Remote Control when EME/Widevine is unavailable', async () => {
    const missingEme = await probeEmeSupport({} as Pick<Navigator, 'requestMediaKeySystemAccess'>);
    expect(missingEme.supported).toBe(false);
    expect(missingEme.fallbackMode).toBe('connect-remote-only');

    const supportedEme = await probeEmeSupport({
      requestMediaKeySystemAccess: () => Promise.resolve({} as MediaKeySystemAccess),
    });
    expect(supportedEme.supported).toBe(true);
    expect(supportedEme.keySystem).toBe('com.widevine.alpha');
    expect(supportedEme.fallbackMode).toBe('sdk');
  });

  it('routes external HTTPS links via Tauri IPC in .exe runtime and blocks non-HTTPS schemes', async () => {
    await expect(openExternalUrl('javascript:alert(1)')).rejects.toThrow(/Only HTTPS/);

    const winOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    await openExternalUrl('https://developer.spotify.com/dashboard');
    expect(winOpenSpy).toHaveBeenCalledWith(
      'https://developer.spotify.com/dashboard',
      '_blank',
      'noopener,noreferrer',
    );
    winOpenSpy.mockRestore();

    const invokeMock = vi.fn().mockResolvedValue(null);
    (window as unknown as { __TAURI_INTERNALS__?: { invoke: typeof invokeMock } }).__TAURI_INTERNALS__ = {
      invoke: invokeMock,
    };
    try {
      await openExternalUrl('https://developer.spotify.com/dashboard');
      expect(invokeMock).toHaveBeenCalledWith(
        'open_external_url',
        { url: 'https://developer.spotify.com/dashboard' },
        undefined,
      );
    } finally {
      delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    }
  });

  it('persists and re-hydrates all settings locally on disk in the .exe Tauri runtime', async () => {
    localStorage.clear();
    resetDesktopSyncStateForTesting();

    let fakeDiskFile: string | null = null;
    const diskPath = 'C:\\Users\\berka\\AppData\\Roaming\\org.pulseplayer.client\\pulse-settings.json';

    const invokeMock = vi.fn((cmd: string, args?: { contents?: string }) => {
      if (cmd === 'desktop_read_settings') {
        return Promise.resolve(fakeDiskFile);
      }
      if (cmd === 'desktop_get_settings_path') {
        return Promise.resolve(diskPath);
      }
      if (cmd === 'desktop_write_settings') {
        fakeDiskFile = args?.contents ?? null;
        return Promise.resolve(diskPath);
      }
      return Promise.resolve(null);
    });

    (window as unknown as { __TAURI_INTERNALS__?: { invoke: typeof invokeMock } }).__TAURI_INTERNALS__ = {
      invoke: invokeMock,
    };

    try {
      await hydrateDesktopSettingsFromDisk();

      // Change theme, surface, clientId, and player volume
      useThemeStore.getState().setSurfaceStyle('aero');
      useThemeStore.getState().setShellLayout('bottom-player');
      useAuthStore.getState().setClientId('a1b2c3d4e5f60718293a4b5c6d7e8f90');
      usePlayerStore.getState().setPlaybackSnapshot({ volumePercent: 42, shuffle: true });

      const writtenPath = await flushDesktopSettingsToDisk();
      expect(writtenPath).toBe(diskPath);
      expect(fakeDiskFile).toContain('a1b2c3d4e5f60718293a4b5c6d7e8f90');
      expect(fakeDiskFile).toContain('bottom-player');

      // Simulate fresh WebView2 folder after .exe update / restart (localStorage wiped)
      localStorage.clear();
      useThemeStore.getState().resetAllCustomization();
      useAuthStore.getState().setClientId(null);
      usePlayerStore.getState().setPlaybackSnapshot({ volumePercent: 80, shuffle: false });
      resetDesktopSyncStateForTesting();

      // Hydrate from the native pulse-settings.json file on disk
      await hydrateDesktopSettingsFromDisk();

      expect(useThemeStore.getState().surfaceStyle).toBe('aero');
      expect(useThemeStore.getState().shellLayout).toBe('bottom-player');
      expect(useAuthStore.getState().clientId).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f90');
      expect(usePlayerStore.getState().volumePercent).toBe(42);
      expect(usePlayerStore.getState().shuffle).toBe(true);
    } finally {
      delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
      resetDesktopSyncStateForTesting();
    }
  });
});
