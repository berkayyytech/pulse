import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';
import { flushDesktopSettingsToDisk } from '@/platform/desktopSettingsSync';
import { isTauriRuntime } from '@/platform/runtime';

export const DEFAULT_UPDATE_REPO = 'berkayyytech/pulse';

const REPO_SLUG_REGEX = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function normalizeGithubRepoSlug(raw: string): string {
  const trimmed = raw.trim();
  const cleaned = trimmed
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  return cleaned;
}

export function isValidGithubRepoSlug(slug: string): boolean {
  return REPO_SLUG_REGEX.test(normalizeGithubRepoSlug(slug));
}

export function getBundledAppVersion(): string {
  return typeof __PULSE_APP_VERSION__ === 'string' && __PULSE_APP_VERSION__.trim()
    ? __PULSE_APP_VERSION__.trim()
    : '1.0.3';
}

export async function resolveRunningAppVersion(): Promise<string> {
  if (isTauriRuntime()) {
    try {
      const nativeVer = await getVersion();
      if (nativeVer.trim()) {
        return nativeVer.trim();
      }
    } catch {
      // Fall back to bundled version
    }
  }
  return getBundledAppVersion();
}

interface ParsedSemver {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: string | null;
}

export function parseSemverTag(raw: string): ParsedSemver | null {
  const cleaned = raw.trim().replace(/^[vV]/, '');
  const match =
    /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-_]([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(cleaned);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: match[2] !== undefined ? Number(match[2]) : 0,
    patch: match[3] !== undefined ? Number(match[3]) : 0,
    prerelease: match[4] ?? null,
  };
}

/**
 * Returns `1` if `a > b`, `-1` if `a < b`, or `0` if equal.
 */
export function compareSemver(aRaw: string, bRaw: string): number {
  const a = parseSemverTag(aRaw);
  const b = parseSemverTag(bRaw);
  if (!a || !b) {
    return 0;
  }
  if (a.major !== b.major) {
    return a.major > b.major ? 1 : -1;
  }
  if (a.minor !== b.minor) {
    return a.minor > b.minor ? 1 : -1;
  }
  if (a.patch !== b.patch) {
    return a.patch > b.patch ? 1 : -1;
  }
  if (a.prerelease === null && b.prerelease !== null) {
    return 1;
  }
  if (a.prerelease !== null && b.prerelease === null) {
    return -1;
  }
  if (a.prerelease !== null && b.prerelease !== null && a.prerelease !== b.prerelease) {
    return a.prerelease.localeCompare(b.prerelease);
  }
  return 0;
}

export function isNewerSemver(currentVersion: string, candidateTag: string): boolean {
  return compareSemver(candidateTag, currentVersion) > 0;
}

const GitHubAssetSchema = z.object({
  name: z.string().min(1),
  browser_download_url: z.string().url(),
  size: z.number().nonnegative(),
  digest: z.string().nullable().optional(),
});

const GitHubReleaseSchema = z.object({
  tag_name: z.string().min(1),
  name: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  html_url: z.string().url(),
  published_at: z.string().nullable().optional(),
  draft: z.boolean().default(false),
  prerelease: z.boolean().default(false),
  assets: z.array(GitHubAssetSchema).default([]),
});

export interface ReleaseInstallerAsset {
  readonly name: string;
  readonly downloadUrl: string;
  readonly sizeBytes: number;
  readonly sha256: string | null;
}

export interface AvailableReleaseInfo {
  readonly version: string;
  readonly tagName: string;
  readonly title: string;
  readonly notesSummary: string;
  readonly htmlUrl: string;
  readonly publishedAtIso: string | null;
  readonly prerelease: boolean;
  readonly windowsInstaller: ReleaseInstallerAsset | null;
}

export type UpdateCheckResult =
  | {
      readonly outcome: 'update-available';
      readonly currentVersion: string;
      readonly release: AvailableReleaseInfo;
    }
  | {
      readonly outcome: 'up-to-date';
      readonly currentVersion: string;
      readonly latestVersion: string;
    }
  | {
      readonly outcome: 'no-releases-published';
      readonly currentVersion: string;
    };

function pickWindowsInstallerAsset(
  assets: readonly z.infer<typeof GitHubAssetSchema>[],
): ReleaseInstallerAsset | null {
  const nsisSetup =
    assets.find((a) => /setup\.exe$/i.test(a.name)) ??
    assets.find((a) => /\.msi$/i.test(a.name)) ??
    assets.find((a) => /\.exe$/i.test(a.name));

  if (!nsisSetup) {
    return null;
  }

  const rawDigest = nsisSetup.digest ?? null;
  const sha256 =
    rawDigest && rawDigest.toLowerCase().startsWith('sha256:')
      ? rawDigest.slice('sha256:'.length).trim()
      : null;

  return {
    name: nsisSetup.name,
    downloadUrl: nsisSetup.browser_download_url,
    sizeBytes: nsisSetup.size,
    sha256,
  };
}

function summarizeReleaseBody(rawBody: string | null | undefined): string {
  if (!rawBody) {
    return 'Bug fixes, performance improvements, and theme updates.';
  }
  const firstMeaningfulLines = rawBody
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 2)
    .join(' • ');
  if (!firstMeaningfulLines) {
    return 'Bug fixes, performance improvements, and theme updates.';
  }
  return firstMeaningfulLines.length > 180
    ? `${firstMeaningfulLines.slice(0, 177)}…`
    : firstMeaningfulLines;
}

export async function checkForGitHubReleaseUpdate(options: {
  readonly repoSlug: string;
  readonly currentVersion?: string;
  readonly includePrereleases?: boolean;
  readonly fetchImpl?: typeof fetch;
}): Promise<UpdateCheckResult> {
  const rawSlug = options.repoSlug.trim();
  const slug = normalizeGithubRepoSlug(rawSlug);
  if (!isValidGithubRepoSlug(slug)) {
    throw new Error(
      'Enter a valid GitHub repository in owner/repo format (e.g. berkayyytech/pulse).',
    );
  }

  const currentVersion = options.currentVersion ?? (await resolveRunningAppVersion());
  const fetcher = options.fetchImpl ?? fetch;

  const endpoint = `https://api.github.com/repos/${slug}/releases?per_page=12`;

  let response = await fetcher(endpoint, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  });

  if (response.status === 404) {
    const fallbackEndpoint = `https://api.github.com/repos/${slug}/releases/latest`;
    const fallbackRes = await fetcher(fallbackEndpoint, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (fallbackRes.status === 404) {
      return {
        outcome: 'no-releases-published',
        currentVersion,
      };
    }
    if (fallbackRes.ok) {
      response = fallbackRes;
    }
  }

  if (response.status === 403) {
    try {
      const rawPkgRes = await fetcher(
        `https://raw.githubusercontent.com/${slug}/main/package.json`,
      );
      if (rawPkgRes.ok) {
        const pkgData = (await rawPkgRes.json()) as { version?: string };
        const latestVersion = pkgData.version ? pkgData.version.trim() : null;
        if (latestVersion && isNewerSemver(currentVersion, latestVersion)) {
          return {
            outcome: 'update-available',
            currentVersion,
            release: {
              version: latestVersion,
              tagName: `v${latestVersion}`,
              title: `Pulse v${latestVersion}`,
              notesSummary: 'New update available from GitHub repository.',
              htmlUrl: `https://github.com/${slug}/releases`,
              publishedAtIso: null,
              prerelease: false,
              windowsInstaller: {
                name: `Pulse_${latestVersion}_x64-setup.exe`,
                downloadUrl: `https://github.com/${slug}/releases/download/v${latestVersion}/Pulse_${latestVersion}_x64-setup.exe`,
                sizeBytes: 0,
                sha256: null,
              },
            },
          };
        } else if (latestVersion) {
          return {
            outcome: 'up-to-date',
            currentVersion,
            latestVersion,
          };
        }
      }
    } catch {
      // Fall through to error
    }
  }

  if (!response.ok) {
    throw new Error(`GitHub Releases check returned HTTP ${response.status}`);
  }

  const rawJson: unknown = await response.json();
  let allReleases: z.infer<typeof GitHubReleaseSchema>[] = [];

  if (Array.isArray(rawJson)) {
    allReleases = z.array(GitHubReleaseSchema).parse(rawJson);
  } else {
    allReleases = [GitHubReleaseSchema.parse(rawJson)];
  }

  const validReleases = allReleases.filter(
    (r) =>
      !r.draft &&
      (options.includePrereleases || !r.prerelease) &&
      parseSemverTag(r.tag_name) !== null,
  );

  if (validReleases.length === 0) {
    return {
      outcome: 'no-releases-published',
      currentVersion,
    };
  }

  validReleases.sort((a, b) => compareSemver(b.tag_name, a.tag_name));
  const chosenRelease = validReleases[0];
  if (!chosenRelease) {
    return {
      outcome: 'no-releases-published',
      currentVersion,
    };
  }

  const cleanedVersion = chosenRelease.tag_name.trim().replace(/^[vV]/, '');
  if (!isNewerSemver(currentVersion, chosenRelease.tag_name)) {
    return {
      outcome: 'up-to-date',
      currentVersion,
      latestVersion: cleanedVersion,
    };
  }

  let windowsInstaller = pickWindowsInstallerAsset(chosenRelease.assets);

  // If the absolute latest release tag does not have an attached installer yet,
  // check if another newer release has an uploaded installer
  if (!windowsInstaller) {
    for (const rel of validReleases) {
      if (isNewerSemver(currentVersion, rel.tag_name)) {
        const candidate = pickWindowsInstallerAsset(rel.assets);
        if (candidate) {
          windowsInstaller = candidate;
          break;
        }
      }
    }
  }

  // If still not found, synthesize standard GitHub release installer asset URL so auto-update can fetch it directly
  if (!windowsInstaller) {
    windowsInstaller = {
      name: `Pulse_${cleanedVersion}_x64-setup.exe`,
      downloadUrl: `https://github.com/${slug}/releases/download/${chosenRelease.tag_name}/Pulse_${cleanedVersion}_x64-setup.exe`,
      sizeBytes: 0,
      sha256: null,
    };
  }

  return {
    outcome: 'update-available',
    currentVersion,
    release: {
      version: cleanedVersion,
      tagName: chosenRelease.tag_name,
      title: chosenRelease.name?.trim() || `Pulse v${cleanedVersion}`,
      notesSummary: summarizeReleaseBody(chosenRelease.body),
      htmlUrl: chosenRelease.html_url,
      publishedAtIso: chosenRelease.published_at ?? null,
      prerelease: chosenRelease.prerelease,
      windowsInstaller,
    },
  };
}

export async function downloadAndInstallDesktopUpdate(
  installer: ReleaseInstallerAsset,
  silentInstall: boolean = false,
): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error('Direct installer updates are only supported inside the desktop .exe app.');
  }

  // Always flush local settings to pulse-settings.json before launching the installer & closing
  await flushDesktopSettingsToDisk().catch(() => undefined);

  return await invoke<string>('desktop_download_and_install_update', {
    downloadUrl: installer.downloadUrl,
    fileName: installer.name,
    expectedSha256: installer.sha256,
    silentInstall,
  });
}
