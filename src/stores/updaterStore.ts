import { create } from 'zustand';
import {
  DEFAULT_UPDATE_REPO,
  checkForGitHubReleaseUpdate,
  downloadAndInstallDesktopUpdate,
  getBundledAppVersion,
  isNewerSemver,
  isValidGithubRepoSlug,
  resolveRunningAppVersion,
  type AvailableReleaseInfo,
} from '@/features/updater/updaterService';

const UPDATER_STORAGE_KEY = 'pulse.updater.prefs';

export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'no-releases'
  | 'update-available'
  | 'installing'
  | 'installed-restarting'
  | 'error';

export interface PersistedUpdaterPrefs {
  readonly checkOnStartup: boolean;
  readonly autoInstallUpdates: boolean;
  readonly includePrereleases: boolean;
  readonly repoSlug: string;
  readonly skippedVersion: string | null;
  readonly lastAttemptedVersion: string | null;
  readonly lastCheckedAtIso: string | null;
}

const DEFAULT_PREFS: PersistedUpdaterPrefs = {
  checkOnStartup: true,
  autoInstallUpdates: false,
  includePrereleases: false,
  repoSlug: DEFAULT_UPDATE_REPO,
  skippedVersion: null,
  lastAttemptedVersion: null,
  lastCheckedAtIso: null,
};

function loadUpdaterPrefs(): PersistedUpdaterPrefs {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_PREFS;
  }
  const raw = localStorage.getItem(UPDATER_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_PREFS;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedUpdaterPrefs>;
    return {
      checkOnStartup:
        typeof parsed.checkOnStartup === 'boolean'
          ? parsed.checkOnStartup
          : DEFAULT_PREFS.checkOnStartup,
      autoInstallUpdates:
        typeof parsed.autoInstallUpdates === 'boolean'
          ? parsed.autoInstallUpdates
          : DEFAULT_PREFS.autoInstallUpdates,
      includePrereleases:
        typeof parsed.includePrereleases === 'boolean'
          ? parsed.includePrereleases
          : DEFAULT_PREFS.includePrereleases,
      repoSlug:
        typeof parsed.repoSlug === 'string' && isValidGithubRepoSlug(parsed.repoSlug)
          ? parsed.repoSlug.trim()
          : DEFAULT_PREFS.repoSlug,
      skippedVersion: typeof parsed.skippedVersion === 'string' ? parsed.skippedVersion : null,
      lastAttemptedVersion:
        typeof parsed.lastAttemptedVersion === 'string' ? parsed.lastAttemptedVersion : null,
      lastCheckedAtIso:
        typeof parsed.lastCheckedAtIso === 'string' ? parsed.lastCheckedAtIso : null,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function saveUpdaterPrefs(state: UpdaterStoreState): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const payload: PersistedUpdaterPrefs = {
    checkOnStartup: state.checkOnStartup,
    autoInstallUpdates: state.autoInstallUpdates,
    includePrereleases: state.includePrereleases,
    repoSlug: state.repoSlug,
    skippedVersion: state.skippedVersion,
    lastAttemptedVersion: state.lastAttemptedVersion,
    lastCheckedAtIso: state.lastCheckedAtIso,
  };
  localStorage.setItem(UPDATER_STORAGE_KEY, JSON.stringify(payload));
}

interface UpdaterStoreState extends PersistedUpdaterPrefs {
  readonly currentVersion: string;
  readonly status: UpdaterStatus;
  readonly availableRelease: AvailableReleaseInfo | null;
  readonly bannerDismissedForSession: boolean;
  readonly pwaRefreshReady: boolean;
  readonly statusMessage: string | null;
  setCheckOnStartup: (enabled: boolean) => void;
  setAutoInstallUpdates: (enabled: boolean) => void;
  setIncludePrereleases: (enabled: boolean) => void;
  setRepoSlug: (slug: string) => void;
  skipVersion: (version: string | null) => void;
  clearAttemptedVersion: () => void;
  dismissBannerForSession: () => void;
  setPwaRefreshReady: (ready: boolean) => void;
  checkForUpdates: (options?: { manual?: boolean; fetchImpl?: typeof fetch }) => Promise<void>;
  installUpdateNow: (silentInstall?: boolean) => Promise<void>;
  reloadFromStorage: () => void;
}

const initialPrefs = loadUpdaterPrefs();

export const useUpdaterStore = create<UpdaterStoreState>((set, get) => ({
  ...initialPrefs,
  currentVersion: getBundledAppVersion(),
  status: 'idle',
  availableRelease: null,
  bannerDismissedForSession: false,
  pwaRefreshReady: false,
  statusMessage: null,

  setCheckOnStartup: (checkOnStartup) => {
    set({ checkOnStartup });
    saveUpdaterPrefs(get());
  },

  setAutoInstallUpdates: (autoInstallUpdates) => {
    set({ autoInstallUpdates });
    saveUpdaterPrefs(get());
  },

  setIncludePrereleases: (includePrereleases) => {
    set({ includePrereleases });
    saveUpdaterPrefs(get());
  },

  setRepoSlug: (slug) => {
    const trimmed = slug.trim();
    if (!isValidGithubRepoSlug(trimmed)) {
      return;
    }
    set({ repoSlug: trimmed });
    saveUpdaterPrefs(get());
  },

  skipVersion: (skippedVersion) => {
    set({ skippedVersion, bannerDismissedForSession: Boolean(skippedVersion) });
    saveUpdaterPrefs(get());
  },

  clearAttemptedVersion: () => {
    set({ lastAttemptedVersion: null });
    saveUpdaterPrefs(get());
  },

  dismissBannerForSession: () => {
    set({ bannerDismissedForSession: true });
  },

  setPwaRefreshReady: (pwaRefreshReady) => {
    set({ pwaRefreshReady });
  },

  checkForUpdates: async (options) => {
    const manual = Boolean(options?.manual);
    set({ status: 'checking', ...(manual ? { statusMessage: 'Checking GitHub Releases…' } : {}) });

    try {
      const runningVersion = await resolveRunningAppVersion();
      const s = get();

      // If running version has caught up to or passed lastAttemptedVersion, clear it
      if (s.lastAttemptedVersion && !isNewerSemver(runningVersion, s.lastAttemptedVersion)) {
        set({ lastAttemptedVersion: null });
        saveUpdaterPrefs(get());
      }

      const result = await checkForGitHubReleaseUpdate({
        repoSlug: s.repoSlug,
        currentVersion: runningVersion,
        includePrereleases: s.includePrereleases,
        ...(options?.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      });

      const checkedIso = new Date().toISOString();

      if (result.outcome === 'update-available') {
        const isSkipped = !manual && s.skippedVersion === result.release.version;
        set({
          currentVersion: result.currentVersion,
          status: 'update-available',
          availableRelease: result.release,
          lastCheckedAtIso: checkedIso,
          bannerDismissedForSession: isSkipped,
          statusMessage: `Pulse v${result.release.version} is available (currently v${result.currentVersion}).`,
        });
        saveUpdaterPrefs(get());
        return;
      }

      if (result.outcome === 'no-releases-published') {
        set({
          currentVersion: result.currentVersion,
          status: 'no-releases',
          availableRelease: null,
          lastCheckedAtIso: checkedIso,
          statusMessage: manual
            ? `Running v${result.currentVersion} — no GitHub Releases published on ${s.repoSlug} yet.`
            : null,
        });
        saveUpdaterPrefs(get());
        return;
      }

      set({
        currentVersion: result.currentVersion,
        status: 'up-to-date',
        availableRelease: null,
        lastCheckedAtIso: checkedIso,
        statusMessage: `You’re up to date on Pulse v${result.currentVersion}.`,
      });
      saveUpdaterPrefs(get());
    } catch (err) {
      set({
        status: manual ? 'error' : 'idle',
        statusMessage: manual
          ? err instanceof Error
            ? `Update check failed: ${err.message}`
            : 'Unable to reach GitHub Releases.'
          : null,
      });
    }
  },

  installUpdateNow: async (silentInstall = false) => {
    const release = get().availableRelease;
    const installer = release?.windowsInstaller;
    if (!release || !installer) {
      return;
    }

    set({
      status: 'installing',
      statusMessage: `Downloading & verifying ${installer.name}…`,
      lastAttemptedVersion: release.version,
    });
    saveUpdaterPrefs(get());

    try {
      await downloadAndInstallDesktopUpdate(installer, silentInstall);
      set({
        status: 'installed-restarting',
        statusMessage: `Launching Pulse v${release.version} installer — restarting…`,
      });
    } catch (err) {
      set({
        status: 'error',
        statusMessage:
          err instanceof Error
            ? err.message
            : 'Failed to download or launch the desktop update installer.',
      });
    }
  },

  reloadFromStorage: () => {
    const prefs = loadUpdaterPrefs();
    set({ ...prefs });
  },
}));
