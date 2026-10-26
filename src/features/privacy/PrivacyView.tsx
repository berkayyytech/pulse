import { useEffect, useState } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import {
  isListeningHistoryEnabled,
  setListeningHistoryEnabled,
} from '@/features/stats/historyService';
import { getTokenVault } from '@/platform/tokenVault';
import { pulseDb } from '@/storage/db';
import { useAchievementStore } from '@/stores/achievementStore';
import {
  getExternalSourcesConfig,
  getLastFmApiKey,
  saveLastFmApiKey,
  setExternalSourcesConfig,
  type ExternalSourcesConfig,
} from './externalSourcesSettings';

export default function PrivacyView() {
  const vault = getTokenVault();
  const [sources, setSources] = useState<ExternalSourcesConfig>(() => getExternalSourcesConfig());
  const [historyOptIn, setHistoryOptIn] = useState<boolean>(() => isListeningHistoryEnabled());
  const [lastFmKeyInput, setLastFmKeyInput] = useState('');
  const [hasSavedLastFmKey, setHasSavedLastFmKey] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    useAchievementStore.getState().setFlag('privacyInspected');
    let active = true;
    void getLastFmApiKey().then((existing) => {
      if (active) {
        setHasSavedLastFmKey(Boolean(existing));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const updateSourceToggle = (key: keyof ExternalSourcesConfig, value: boolean) => {
    const next = { ...sources, [key]: value };
    setSources(next);
    setExternalSourcesConfig(next);
  };

  return (
    <section aria-labelledby="privacy-heading">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ShieldCheck size={20} color="var(--pulse-color-signal)" aria-hidden="true" />
        <span className="pulse-mono-pill" data-tone="signal">
          Zero Telemetry • 100% Local Storage
        </span>
      </div>
      <h1 id="privacy-heading" style={{ fontFamily: 'var(--pulse-font-display)', margin: '0.6rem 0 0.4rem' }}>
        Privacy & External Data Sources
      </h1>
      <p style={{ color: 'var(--pulse-color-text-secondary)', maxWidth: '68ch' }}>
        Pulse collects zero telemetry, runs zero analytics scripts, and stores all credentials,
        caches, and opt-in listening history locally on your device. External lyrics and metadata
        sources (LRCLIB, MusicBrainz, Cover Art Archive, and BYO-key Last.fm) are disabled by
        default until you explicitly enable them below.
      </p>

      {notice ? (
        <p role="status" style={{ color: 'var(--pulse-color-signal)' }}>
          {notice}
        </p>
      ) : null}

      <div className="pulse-card-grid">
        <article className="pulse-card">
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Opt-In External Providers (Off by Default)</h2>
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>LRCLIB Synced Lyrics (<code>lrclib.net</code>)</span>
              <input
                type="checkbox"
                checked={sources.lrclibEnabled}
                onChange={(e) => {
                  updateSourceToggle('lrclibEnabled', e.target.checked);
                }}
              />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>MusicBrainz Record Label & ISRC (<code>musicbrainz.org</code>)</span>
              <input
                type="checkbox"
                checked={sources.musicBrainzEnabled}
                onChange={(e) => {
                  updateSourceToggle('musicBrainzEnabled', e.target.checked);
                }}
              />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Cover Art Archive High-Res Artwork (<code>coverartarchive.org</code>)</span>
              <input
                type="checkbox"
                checked={sources.coverArtArchiveEnabled}
                onChange={(e) => {
                  updateSourceToggle('coverArtArchiveEnabled', e.target.checked);
                }}
              />
            </label>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Last.fm Artist Context (requires your own Last.fm API key)</span>
              <input
                type="checkbox"
                checked={sources.lastFmEnabled}
                onChange={(e) => {
                  updateSourceToggle('lastFmEnabled', e.target.checked);
                }}
              />
            </label>

            {sources.lastFmEnabled ? (
              <div style={{ marginTop: '0.35rem' }}>
                <label htmlFor="lastfm-key-input" style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>
                  BYO Last.fm API Key ({hasSavedLastFmKey ? 'Stored encrypted in Vault' : 'Not set'})
                </label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    id="lastfm-key-input"
                    type="password"
                    placeholder="Paste your personal Last.fm API key…"
                    value={lastFmKeyInput}
                    onChange={(e) => {
                      setLastFmKeyInput(e.target.value);
                    }}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      borderRadius: 'var(--pulse-radius-sm)',
                      border: '1px solid var(--pulse-color-border-strong)',
                      background: 'var(--pulse-color-bg-canvas)',
                    }}
                  />
                  <button
                    type="button"
                    className="pulse-mono-pill"
                    data-tone="accent"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      void saveLastFmApiKey(lastFmKeyInput).then(() => {
                        setHasSavedLastFmKey(Boolean(lastFmKeyInput.trim()));
                        setLastFmKeyInput('');
                        setNotice('Updated encrypted Last.fm API key in TokenVault.');
                      });
                    }}
                  >
                    Save Key
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </article>

        <article className="pulse-card">
          <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Local Storage & Credential Encryption</h2>
          <p style={{ color: 'var(--pulse-color-text-secondary)', fontSize: '0.88rem' }}>
            Active Vault Backend: <code>{vault.backendName}</code>. Refresh tokens are never written
            in plaintext to localStorage or unencrypted IndexedDB tables.
          </p>

          <label
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '0.85rem 0',
            }}
          >
            <span>Record Local Listening History & Stats (Opt-In)</span>
            <input
              type="checkbox"
              checked={historyOptIn}
              onChange={(e) => {
                setHistoryOptIn(e.target.checked);
                setListeningHistoryEnabled(e.target.checked);
              }}
            />
          </label>

          <button
            type="button"
            className="pulse-nav-btn"
            style={{ color: 'var(--pulse-color-danger)', border: '1px solid var(--pulse-color-border-subtle)' }}
            onClick={() => {
              void Promise.all([
                pulseDb.apiCache.clear(),
                pulseDb.listeningHistory.clear(),
                pulseDb.smartPlaylists.clear(),
                pulseDb.customThemes.clear(),
                vault.clearAll(),
              ]).then(() => {
                setNotice('Cleared all local IndexedDB tables and encrypted TokenVault secrets.');
              });
            }}
          >
            <Trash2 size={15} aria-hidden="true" />
            <span>Clear local cache, history & token vault</span>
          </button>
        </article>
      </div>
    </section>
  );
}
