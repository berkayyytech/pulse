import { useEffect, useState } from 'react';
import { ArrowUpCircle, Download, ExternalLink, RefreshCw, X } from 'lucide-react';
import { openExternalUrl } from '@/platform/openExternal';
import { isTauriRuntime } from '@/platform/runtime';
import { useUpdaterStore } from '@/stores/updaterStore';

function formatAssetSize(bytes: number): string {
  if (bytes <= 0) {
    return '';
  }
  return ` (${(bytes / (1024 * 1024)).toFixed(1)} MB)`;
}

export function UpdateBanner() {
  const status = useUpdaterStore((s) => s.status);
  const currentVersion = useUpdaterStore((s) => s.currentVersion);
  const availableRelease = useUpdaterStore((s) => s.availableRelease);
  const autoInstallUpdates = useUpdaterStore((s) => s.autoInstallUpdates);
  const bannerDismissed = useUpdaterStore((s) => s.bannerDismissedForSession);
  const pwaRefreshReady = useUpdaterStore((s) => s.pwaRefreshReady);
  const statusMessage = useUpdaterStore((s) => s.statusMessage);
  const installUpdateNow = useUpdaterStore((s) => s.installUpdateNow);
  const dismissBannerForSession = useUpdaterStore((s) => s.dismissBannerForSession);
  const skipVersion = useUpdaterStore((s) => s.skipVersion);
  const setPwaRefreshReady = useUpdaterStore((s) => s.setPwaRefreshReady);

  const inDesktopExe = isTauriRuntime();
  const canAutoInstallExe =
    inDesktopExe && Boolean(availableRelease?.windowsInstaller) && status === 'update-available';

  const [autoCountdownSec, setAutoCountdownSec] = useState<number | null>(null);
  const [autoCancelled, setAutoCancelled] = useState(false);

  // Reset countdown state whenever a new release version appears
  useEffect(() => {
    setAutoCancelled(false);
    setAutoCountdownSec(null);
  }, [availableRelease?.version]);

  // Optional auto-update countdown on .exe when user enabled Auto-Install Updates
  useEffect(() => {
    if (!canAutoInstallExe || !autoInstallUpdates || autoCancelled || bannerDismissed) {
      setAutoCountdownSec(null);
      return undefined;
    }

    setAutoCountdownSec(3);
    const interval = setInterval(() => {
      setAutoCountdownSec((prev) => {
        if (prev === null) {
          return null;
        }
        if (prev <= 1) {
          clearInterval(interval);
          void installUpdateNow(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [
    autoCancelled,
    autoInstallUpdates,
    bannerDismissed,
    canAutoInstallExe,
    installUpdateNow,
  ]);

  if (pwaRefreshReady && !inDesktopExe) {
    return (
      <div
        role="region"
        aria-label="Application update available"
        style={{
          position: 'fixed',
          bottom: '18px',
          left: '18px',
          zIndex: 148,
          maxWidth: '420px',
          padding: '12px 16px',
          borderRadius: 'var(--pulse-radius-md)',
          background: 'var(--pulse-color-panel-solid)',
          border: '1px solid var(--pulse-color-signal)',
          boxShadow: 'var(--pulse-shadow-elevated)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <RefreshCw size={18} color="var(--pulse-color-signal)" aria-hidden="true" />
        <div style={{ flex: 1, fontSize: '0.84rem' }}>
          <strong>New web version ready</strong>
          <div style={{ color: 'var(--pulse-color-text-secondary)', fontSize: '0.78rem' }}>
            Reload Pulse to apply the latest cached PWA build.
          </div>
        </div>
        <button
          type="button"
          className="gp-action-pill"
          style={{ padding: '5px 11px', fontSize: '0.78rem' }}
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload
        </button>
        <button
          type="button"
          aria-label="Dismiss PWA update prompt"
          onClick={() => {
            setPwaRefreshReady(false);
          }}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px' }}
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  const showReleaseBanner =
    availableRelease !== null &&
    !bannerDismissed &&
    (status === 'update-available' ||
      status === 'installing' ||
      status === 'installed-restarting' ||
      status === 'error');

  if (!showReleaseBanner) {
    return null;
  }

  const installer = availableRelease.windowsInstaller;

  return (
    <div
      role="region"
      aria-label="Pulse update notification"
      style={{
        position: 'fixed',
        bottom: '18px',
        left: '18px',
        zIndex: 148,
        width: 'min(460px, calc(100vw - 36px))',
        padding: '14px 16px',
        borderRadius: 'var(--pulse-radius-md)',
        background: 'var(--pulse-color-panel-solid)',
        border: '1px solid var(--pulse-color-accent)',
        boxShadow: 'var(--pulse-shadow-elevated)',
        display: 'grid',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowUpCircle size={19} color="var(--pulse-color-signal)" aria-hidden="true" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
              Update Available: Pulse v{availableRelease.version}
              <span
                style={{
                  marginLeft: '6px',
                  fontWeight: 400,
                  fontSize: '0.76rem',
                  color: 'var(--pulse-color-text-secondary)',
                }}
              >
                (current v{currentVersion})
              </span>
            </div>
            <div style={{ fontSize: '0.79rem', color: 'var(--pulse-color-text-secondary)', marginTop: '2px' }}>
              {status === 'installing' || status === 'installed-restarting' || status === 'error'
                ? statusMessage
                : availableRelease.notesSummary}
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Remind me later"
          onClick={dismissBannerForSession}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px' }}
        >
          <X size={15} />
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
        {inDesktopExe ? (
          <button
            type="button"
            disabled={status === 'installing' || status === 'installed-restarting'}
            className="gp-action-pill"
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: 'var(--pulse-color-signal)',
              color: '#08110c',
              fontWeight: 700,
            }}
            onClick={() => {
              void installUpdateNow(false);
            }}
          >
            {status === 'installing' ? (
              <RefreshCw size={13} className="gp-spin" aria-hidden="true" />
            ) : (
              <Download size={13} aria-hidden="true" />
            )}
            <span>
              {status === 'installing'
                ? 'Downloading & Installing…'
                : status === 'installed-restarting'
                  ? 'Restarting…'
                  : status === 'error'
                    ? 'Retry Auto-Update'
                    : autoCountdownSec !== null && autoCountdownSec > 0
                      ? `Auto-Updating in ${autoCountdownSec}s`
                      : `Update Now${installer ? formatAssetSize(installer.sizeBytes) : ''}`}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="gp-action-pill"
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
            onClick={() => {
              void openExternalUrl(availableRelease.htmlUrl);
            }}
          >
            <ExternalLink size={13} aria-hidden="true" />
            <span>Download v{availableRelease.version}</span>
          </button>
        )}

        {autoCountdownSec !== null && autoCountdownSec > 0 ? (
          <button
            type="button"
            className="pulse-mono-pill"
            style={{ cursor: 'pointer', padding: '5px 10px' }}
            onClick={() => {
              setAutoCancelled(true);
              setAutoCountdownSec(null);
            }}
          >
            Cancel Auto-Update
          </button>
        ) : null}

        <button
          type="button"
          className="pulse-mono-pill"
          style={{ cursor: 'pointer', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          onClick={() => {
            void openExternalUrl(availableRelease.htmlUrl);
          }}
        >
          <span>Release Notes</span>
          <ExternalLink size={11} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => {
            skipVersion(availableRelease.version);
          }}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            fontSize: '0.75rem',
            color: 'var(--pulse-color-text-muted)',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Skip v{availableRelease.version}
        </button>
      </div>
    </div>
  );
}
