import { useState } from 'react';
import { ArrowUpCircle, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { isValidGithubRepoSlug, normalizeGithubRepoSlug } from '@/features/updater/updaterService';
import { openExternalUrl } from '@/platform/openExternal';
import { isTauriRuntime } from '@/platform/runtime';
import { useUpdaterStore } from '@/stores/updaterStore';

export function UpdateSettingsCard() {
  const currentVersion = useUpdaterStore((s) => s.currentVersion);
  const status = useUpdaterStore((s) => s.status);
  const availableRelease = useUpdaterStore((s) => s.availableRelease);
  const statusMessage = useUpdaterStore((s) => s.statusMessage);
  const checkOnStartup = useUpdaterStore((s) => s.checkOnStartup);
  const autoInstallUpdates = useUpdaterStore((s) => s.autoInstallUpdates);
  const includePrereleases = useUpdaterStore((s) => s.includePrereleases);
  const repoSlug = useUpdaterStore((s) => s.repoSlug);
  const lastCheckedAtIso = useUpdaterStore((s) => s.lastCheckedAtIso);

  const setCheckOnStartup = useUpdaterStore((s) => s.setCheckOnStartup);
  const setAutoInstallUpdates = useUpdaterStore((s) => s.setAutoInstallUpdates);
  const setIncludePrereleases = useUpdaterStore((s) => s.setIncludePrereleases);
  const setRepoSlug = useUpdaterStore((s) => s.setRepoSlug);
  const checkForUpdates = useUpdaterStore((s) => s.checkForUpdates);
  const installUpdateNow = useUpdaterStore((s) => s.installUpdateNow);

  const [repoDraft, setRepoDraft] = useState(repoSlug);
  const inDesktopExe = isTauriRuntime();

  return (
    <div style={{ marginBottom: '20px' }}>
      <div
        style={{
          fontSize: '0.88em',
          fontWeight: 600,
          opacity: 0.68,
          marginBottom: '6px',
        }}
      >
        App Version & Automatic Updates
      </div>

      <article className="pulse-card" style={{ display: 'grid', gap: '12px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
              <ArrowUpCircle size={17} color="var(--pulse-color-accent)" aria-hidden="true" />
              <span>Pulse v{currentVersion}</span>
              <span className="pulse-mono-pill" style={{ fontSize: '0.72rem' }}>
                {inDesktopExe ? 'Desktop .exe' : 'Web / PWA'}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--pulse-color-text-secondary)', marginTop: '3px' }}>
              {statusMessage ??
                (lastCheckedAtIso
                  ? `Last checked: ${new Date(lastCheckedAtIso).toLocaleString()}`
                  : `Checks GitHub Releases (${repoSlug}) with zero tracking.`)}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {availableRelease && inDesktopExe && availableRelease.windowsInstaller ? (
              <button
                type="button"
                className="gp-action-pill"
                disabled={status === 'installing' || status === 'installed-restarting'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--pulse-color-signal)',
                  color: '#08110c',
                  fontWeight: 700,
                }}
                onClick={() => {
                  void installUpdateNow(false);
                }}
              >
                <Download size={14} aria-hidden="true" />
                <span>
                  {status === 'installing'
                    ? 'Downloading…'
                    : `Install v${availableRelease.version} & Restart`}
                </span>
              </button>
            ) : availableRelease ? (
              <button
                type="button"
                className="gp-action-pill"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  void openExternalUrl(availableRelease.htmlUrl);
                }}
              >
                <ExternalLink size={14} aria-hidden="true" />
                <span>Open v{availableRelease.version} Release</span>
              </button>
            ) : null}

            <button
              type="button"
              className="gp-action-pill"
              disabled={status === 'checking'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={() => {
                void checkForUpdates({ manual: true });
              }}
            >
              <RefreshCw size={14} aria-hidden="true" />
              <span>{status === 'checking' ? 'Checking…' : 'Check for Updates'}</span>
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '10px',
            paddingTop: '10px',
            borderTop: '1px solid var(--pulse-color-border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.84rem' }}>Suggest updates automatically on startup</span>
            <button
              type="button"
              role="switch"
              aria-label="Check for updates on startup"
              aria-checked={checkOnStartup}
              className="gp-switch"
              onClick={() => {
                setCheckOnStartup(!checkOnStartup);
              }}
            >
              <span className="gp-switch-knob" />
            </button>
          </div>

          {inDesktopExe ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.84rem' }}>Auto-download & install .exe updates</span>
              <button
                type="button"
                role="switch"
                aria-label="Auto-install desktop updates"
                aria-checked={autoInstallUpdates}
                className="gp-switch"
                onClick={() => {
                  setAutoInstallUpdates(!autoInstallUpdates);
                }}
              >
                <span className="gp-switch-knob" />
              </button>
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.84rem' }}>Include beta / pre-release builds</span>
            <button
              type="button"
              role="switch"
              aria-label="Include pre-release updates"
              aria-checked={includePrereleases}
              className="gp-switch"
              onClick={() => {
                setIncludePrereleases(!includePrereleases);
              }}
            >
              <span className="gp-switch-knob" />
            </button>
          </div>

          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.84rem', whiteSpace: 'nowrap' }}>Release Repo</span>
            <input
              type="text"
              aria-label="GitHub release repository"
              value={repoDraft}
              onChange={(e) => {
                const val = e.target.value;
                setRepoDraft(val);
                const normalized = normalizeGithubRepoSlug(val);
                if (isValidGithubRepoSlug(normalized)) {
                  setRepoSlug(normalized);
                }
              }}
              style={{
                width: '175px',
                padding: '4px 8px',
                borderRadius: 'var(--pulse-radius-sm)',
                border: `1px solid ${
                  isValidGithubRepoSlug(repoDraft)
                    ? 'var(--pulse-color-border-strong)'
                    : 'var(--pulse-color-danger)'
                }`,
                background: 'var(--pulse-color-bg-canvas)',
                fontFamily: 'var(--pulse-font-mono)',
                fontSize: '0.78rem',
              }}
            />
          </label>
        </div>
      </article>
    </div>
  );
}
