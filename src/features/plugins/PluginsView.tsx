import { useState } from 'react';
import { PluginManifestSchema } from '@pulse/plugin-sdk';
import { CheckCircle2, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import { useAchievementStore } from '@/stores/achievementStore';
import { usePluginStore } from '@/stores/pluginStore';
import { JsonSchemaSettingsForm } from './JsonSchemaSettingsForm';
import {
  COMMUNITY_STATIC_INDEX_FALLBACK,
  notifyPluginSettingsChanged,
  startSandboxedPluginWorker,
  stopSandboxedPluginWorker,
  type RegistryCatalogItem,
} from './pluginSandboxHost';

export default function PluginsView() {
  const plugins = usePluginStore((s) => s.plugins);
  const upsertPlugin = usePluginStore((s) => s.upsertPlugin);
  const removePlugin = usePluginStore((s) => s.removePlugin);
  const setPluginEnabled = usePluginStore((s) => s.setPluginEnabled);
  const updatePluginSetting = usePluginStore((s) => s.updatePluginSetting);

  const [pendingApproval, setPendingApproval] = useState<RegistryCatalogItem | null>(null);
  const [devManifestUrl, setDevManifestUrl] = useState('http://127.0.0.1:4580/manifest.json');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const approveAndInstall = (item: RegistryCatalogItem, devServerUrl?: string) => {
    const defaultSettings: Record<string, unknown> = {};
    if (item.manifest.settingsSchema) {
      for (const [k, prop] of Object.entries(item.manifest.settingsSchema.properties)) {
        if (prop.default !== undefined) {
          defaultSettings[k] = prop.default;
        }
      }
    }

    upsertPlugin({
      manifest: item.manifest,
      workerSource: item.workerSource,
      approvedPermissions: item.manifest.permissions,
      enabled: true,
      settings: defaultSettings,
      ...(devServerUrl ? { devServerUrl } : {}),
    });
    startSandboxedPluginWorker(item.manifest.id);
    useAchievementStore.getState().setFlag('pluginInstalled');
    setPendingApproval(null);
    setStatusMessage(`Installed & started "${item.manifest.name}" inside Web Worker sandbox.`);
  };

  const handleLoadDevPlugin = async () => {
    try {
      const res = await fetch(devManifestUrl);
      const manifest = PluginManifestSchema.parse(await res.json());
      const baseUrl = new URL('.', devManifestUrl).toString();
      const entryRes = await fetch(new URL(manifest.entry, baseUrl).toString());
      const workerSource = await entryRes.text();
      setPendingApproval({
        manifest,
        workerSource,
        repoUrl: devManifestUrl,
      });
    } catch (err) {
      setStatusMessage(
        err instanceof Error
          ? `Could not load dev plugin: ${err.message}`
          : 'Failed to load dev plugin URL',
      );
    }
  };

  const installedList = Object.values(plugins);

  return (
    <section aria-labelledby="plugins-heading">
      <h1 id="plugins-heading" style={{ fontFamily: 'var(--pulse-font-display)', marginTop: 0 }}>
        Sandboxed Plugins & Registry
      </h1>
      <p style={{ color: 'var(--pulse-color-text-secondary)', maxWidth: '70ch' }}>
        Every plugin runs inside an isolated Web Worker with explicit capability permissions and
        zero access to your Spotify OAuth tokens, Client ID, or DOM. Scaffold your own plugin with{' '}
        <code>npx create-pulse-plugin my-plugin</code>.
      </p>

      {statusMessage ? (
        <p role="status" style={{ color: 'var(--pulse-color-signal)', fontSize: '0.9rem' }}>
          {statusMessage}
        </p>
      ) : null}

      {/* Permission Approval Prompt */}
      {pendingApproval ? (
        <article
          className="pulse-card"
          role="dialog"
          aria-label="Approve plugin permissions"
          style={{
            borderColor: 'var(--pulse-color-accent)',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <ShieldAlert size={18} color="var(--pulse-color-accent)" />
            <span>Review Permissions for “{pendingApproval.manifest.name}”</span>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--pulse-color-text-secondary)' }}>
            Author: <strong>{pendingApproval.manifest.author}</strong> • v
            {pendingApproval.manifest.version} • SDK {pendingApproval.manifest.sdkVersion}
          </p>
          <p style={{ margin: '0.5rem 0 0.35rem', fontWeight: 600 }}>Requested permissions:</p>
          <ul style={{ margin: '0 0 1rem', paddingLeft: '1.25rem' }}>
            {pendingApproval.manifest.permissions.map((perm) => (
              <li key={perm}>
                <code>{perm}</code>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={() => {
                approveAndInstall(pendingApproval);
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 'var(--pulse-radius-sm)',
                border: 'none',
                background: 'var(--pulse-color-accent)',
                color: 'var(--pulse-color-text-inverse)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Approve & Run in Sandbox
            </button>
            <button
              type="button"
              className="pulse-nav-btn"
              style={{ width: 'auto' }}
              onClick={() => {
                setPendingApproval(null);
              }}
            >
              Cancel
            </button>
          </div>
        </article>
      ) : null}

      {/* Installed Plugins */}
      <h2 style={{ fontSize: '1.05rem' }}>Installed Plugins ({installedList.length})</h2>
      {installedList.length === 0 ? (
        <p style={{ color: 'var(--pulse-color-text-muted)', fontSize: '0.9rem' }}>
          No plugins installed yet. Install the Studio Timecode Monitor example below to see a live
          Web Worker slot in the Now Playing bar.
        </p>
      ) : (
        <div className="pulse-card-grid">
          {installedList.map((plugin) => (
            <article key={plugin.manifest.id} className="pulse-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{plugin.manifest.name}</strong>
                <span className="pulse-mono-pill" data-tone={plugin.enabled ? 'signal' : undefined}>
                  {plugin.enabled ? 'Active Worker' : 'Paused'}
                </span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--pulse-color-text-secondary)' }}>
                {plugin.manifest.description}
              </p>

              {plugin.manifest.settingsSchema ? (
                <JsonSchemaSettingsForm
                  schema={plugin.manifest.settingsSchema}
                  values={plugin.settings}
                  onChange={(key, val) => {
                    updatePluginSetting(plugin.manifest.id, key, val);
                    notifyPluginSettingsChanged(plugin.manifest.id);
                  }}
                />
              ) : null}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
                <button
                  type="button"
                  className="pulse-mono-pill"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    const next = !plugin.enabled;
                    setPluginEnabled(plugin.manifest.id, next);
                    if (next) {
                      startSandboxedPluginWorker(plugin.manifest.id);
                    } else {
                      stopSandboxedPluginWorker(plugin.manifest.id);
                    }
                  }}
                >
                  {plugin.enabled ? 'Pause Worker' : 'Start Worker'}
                </button>
                <button
                  type="button"
                  className="pulse-mono-pill"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    startSandboxedPluginWorker(plugin.manifest.id);
                    setStatusMessage(`Hot-reloaded worker "${plugin.manifest.name}".`);
                  }}
                >
                  <RefreshCw size={12} />
                  <span>Hot Reload</span>
                </button>
                <button
                  type="button"
                  className="pulse-mono-pill"
                  style={{ cursor: 'pointer', color: 'var(--pulse-color-danger)' }}
                  onClick={() => {
                    stopSandboxedPluginWorker(plugin.manifest.id);
                    removePlugin(plugin.manifest.id);
                  }}
                >
                  <Trash2 size={12} />
                  <span>Uninstall</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Community Index */}
      <h2 style={{ fontSize: '1.05rem', marginTop: '1.5rem' }}>
        Verified Static Plugin Index
      </h2>
      <div className="pulse-card-grid">
        {COMMUNITY_STATIC_INDEX_FALLBACK.map((item) => {
          const isInstalled = Boolean(plugins[item.manifest.id]);
          return (
            <article key={item.manifest.id} className="pulse-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{item.manifest.name}</strong>
                <span className="pulse-mono-pill">v{item.manifest.version}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--pulse-color-text-secondary)' }}>
                {item.manifest.description}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '0.75rem' }}>
                {item.manifest.permissions.map((perm) => (
                  <span key={perm} className="pulse-mono-pill" style={{ fontSize: '0.72rem' }}>
                    {perm}
                  </span>
                ))}
              </div>
              {isInstalled ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    color: 'var(--pulse-color-signal)',
                    fontSize: '0.85rem',
                  }}
                >
                  <CheckCircle2 size={15} />
                  <span>Installed</span>
                </span>
              ) : (
                <button
                  type="button"
                  className="pulse-nav-btn"
                  onClick={() => {
                    setPendingApproval(item);
                  }}
                >
                  Review Permissions & Install
                </button>
              )}
            </article>
          );
        })}
      </div>

      {/* Hot-Reload Local Dev Loader */}
      <article className="pulse-card" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Plugin Developer Hot-Reload Server</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <input
            type="url"
            aria-label="Local plugin manifest URL"
            value={devManifestUrl}
            onChange={(e) => {
              setDevManifestUrl(e.target.value);
            }}
            style={{
              flex: '1 1 300px',
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--pulse-radius-sm)',
              border: '1px solid var(--pulse-color-border-strong)',
              background: 'var(--pulse-color-bg-canvas)',
              fontFamily: 'var(--pulse-font-mono)',
            }}
          />
          <button
            type="button"
            onClick={() => {
              void handleLoadDevPlugin();
            }}
            className="pulse-mono-pill"
            data-tone="accent"
            style={{ cursor: 'pointer', padding: '0.45rem 0.9rem' }}
          >
            Load Dev Manifest
          </button>
        </div>
      </article>
    </section>
  );
}
