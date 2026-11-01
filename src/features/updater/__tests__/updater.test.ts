import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkForGitHubReleaseUpdate,
  compareSemver,
  isNewerSemver,
} from '@/features/updater/updaterService';
import { useUpdaterStore } from '@/stores/updaterStore';

describe('Updater Engine (GitHub Releases SemVer + .exe Auto-Install)', () => {
  beforeEach(() => {
    localStorage.clear();
    useUpdaterStore.setState({
      checkOnStartup: true,
      autoInstallUpdates: false,
      includePrereleases: false,
      repoSlug: 'berkayyytech/pulse',
      skippedVersion: null,
      lastCheckedAtIso: null,
      status: 'idle',
      availableRelease: null,
      bannerDismissedForSession: false,
      pwaRefreshReady: false,
      statusMessage: null,
    });
  });

  it('compares semantic version tags accurately including v-prefixes, capital V, and pre-releases', () => {
    expect(compareSemver('v0.2.0', '0.1.0')).toBe(1);
    expect(compareSemver('0.1.0', 'v0.1.0')).toBe(0);
    expect(compareSemver('0.1.1', '0.1.2')).toBe(-1);
    expect(compareSemver('1.0.0', '1.0.0-beta.1')).toBe(1);
    expect(compareSemver('V1.0.3_Fix', '0.1.0')).toBe(1);
    expect(compareSemver('V1.0.3', 'V1.0.2')).toBe(1);
    expect(compareSemver('V1', '0.1.0')).toBe(1);
    expect(isNewerSemver('0.1.0', 'v0.2.0')).toBe(true);
    expect(isNewerSemver('0.2.0', 'v0.1.9')).toBe(false);
    expect(isNewerSemver('0.1.0', 'V1.0.3')).toBe(true);
  });

  it('synthesizes or resolves Windows installer assets if release assets array is empty', async () => {
    const mockEmptyAssetsRelease = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            tag_name: 'V1.0.3_Fix',
            name: 'Pulse V1.0.3 Fix',
            body: 'Bug Fixes',
            html_url: 'https://github.com/berkayyytech/pulse/releases/tag/V1.0.3_Fix',
            published_at: '2026-11-01T19:56:56Z',
            draft: false,
            prerelease: false,
            assets: [],
          },
        ]),
        { status: 200 },
      ),
    );

    const res = await checkForGitHubReleaseUpdate({
      repoSlug: 'berkayyytech/pulse',
      currentVersion: '0.1.0',
      fetchImpl: mockEmptyAssetsRelease,
    });

    expect(res.outcome).toBe('update-available');
    if (res.outcome === 'update-available') {
      expect(res.release.version).toBe('1.0.3_Fix');
      expect(res.release.windowsInstaller).not.toBeNull();
      expect(res.release.windowsInstaller?.name).toContain('Pulse_');
      expect(res.release.windowsInstaller?.downloadUrl).toContain('/V1.0.3_Fix/');
    }
  });

  it('detects newer GitHub Releases with NSIS setup .exe assets and SHA-256 digests', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tag_name: 'v0.2.0',
          name: 'Pulse v0.2.0 — Frutiger Aero Edition',
          body: '## Highlights\nAdded Frutiger Aero themes and 248 achievements.',
          html_url: 'https://github.com/berkayyytech/pulse/releases/tag/v0.2.0',
          published_at: '2026-10-25T20:00:00Z',
          draft: false,
          prerelease: false,
          assets: [
            {
              name: 'Pulse_0.2.0_x64-setup.exe',
              browser_download_url:
                'https://github.com/berkayyytech/pulse/releases/download/v0.2.0/Pulse_0.2.0_x64-setup.exe',
              size: 4_920_000,
              digest: 'sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const res = await checkForGitHubReleaseUpdate({
      repoSlug: 'berkayyytech/pulse',
      currentVersion: '0.1.0',
      fetchImpl: mockFetch,
    });

    expect(res.outcome).toBe('update-available');
    if (res.outcome === 'update-available') {
      expect(res.release.version).toBe('0.2.0');
      expect(res.release.windowsInstaller?.name).toBe('Pulse_0.2.0_x64-setup.exe');
      expect(res.release.windowsInstaller?.sha256).toBe(
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      );
    }
  });

  it('handles 404 (no published releases yet) gracefully and triggers .exe auto-installer via Tauri IPC', async () => {
    const mock404 = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
    await useUpdaterStore.getState().checkForUpdates({ manual: true, fetchImpl: mock404 });
    expect(useUpdaterStore.getState().status).toBe('no-releases');
    expect(useUpdaterStore.getState().availableRelease).toBeNull();

    // Now simulate an available v0.3.0 release and trigger native desktop install
    const mockRelease = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tag_name: 'v0.3.0',
          name: 'Pulse v0.3.0',
          body: 'Auto-updater release!',
          html_url: 'https://github.com/berkayyytech/pulse/releases/tag/v0.3.0',
          assets: [
            {
              name: 'Pulse_0.3.0_x64-setup.exe',
              browser_download_url:
                'https://github.com/berkayyytech/pulse/releases/download/v0.3.0/Pulse_0.3.0_x64-setup.exe',
              size: 5_100_000,
              digest: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const invokeMock = vi.fn().mockImplementation((cmd: string) => {
      if (cmd === 'plugin:app|version') {
        return Promise.resolve('0.1.0');
      }
      return Promise.resolve('C:\\Temp\\pulse-updates\\Pulse_0.3.0_x64-setup.exe');
    });
    (
      window as unknown as { __TAURI_INTERNALS__?: { invoke: typeof invokeMock } }
    ).__TAURI_INTERNALS__ = {
      invoke: invokeMock,
    };

    try {
      await useUpdaterStore.getState().checkForUpdates({ manual: true, fetchImpl: mockRelease });
      expect(useUpdaterStore.getState().status).toBe('update-available');

      await useUpdaterStore.getState().installUpdateNow(false);
      expect(invokeMock).toHaveBeenCalledWith(
        'desktop_download_and_install_update',
        {
          downloadUrl:
            'https://github.com/berkayyytech/pulse/releases/download/v0.3.0/Pulse_0.3.0_x64-setup.exe',
          fileName: 'Pulse_0.3.0_x64-setup.exe',
          expectedSha256: '1111111111111111111111111111111111111111111111111111111111111111',
          silentInstall: false,
        },
        undefined,
      );
      expect(useUpdaterStore.getState().status).toBe('installed-restarting');
      expect(useUpdaterStore.getState().lastAttemptedVersion).toBe('0.3.0');
    } finally {
      delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    }
  });

  it('rejects older or equal installer assets attached to a newer release to prevent infinite update loops', async () => {
    // Scenario: GitHub release tag is V1.0.4, but user uploaded Pulse_1.0.3_x64-setup.exe
    const mockMismatchedRelease = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            tag_name: 'V1.0.4_Fix',
            name: 'Pulse V1.0.4 Fix',
            body: 'Bug Fixes',
            html_url: 'https://github.com/berkayyytech/pulse/releases/tag/V1.0.4_Fix',
            published_at: '2026-11-01T21:30:51Z',
            draft: false,
            prerelease: false,
            assets: [
              {
                name: 'Pulse_1.0.3_x64-setup.exe',
                browser_download_url:
                  'https://github.com/berkayyytech/pulse/releases/download/V1.0.4_Fix/Pulse_1.0.3_x64-setup.exe',
                size: 5_985_378,
                digest: 'sha256:dde5bbdecbaf2e53aabbbb6c8eb17d57ec4531c5b1629c2ed055b5e3f294e033',
              },
            ],
          },
        ]),
        { status: 200 },
      ),
    );

    const res = await checkForGitHubReleaseUpdate({
      repoSlug: 'berkayyytech/pulse',
      currentVersion: '1.0.3',
      fetchImpl: mockMismatchedRelease,
    });

    expect(res.outcome).toBe('update-available');
    if (res.outcome === 'update-available') {
      expect(res.release.version).toBe('1.0.4_Fix');
      // The outdated 1.0.3 installer must be REJECTED to prevent an infinite reinstall loop!
      expect(res.release.windowsInstaller).toBeNull();
    }
  });
});
