import { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  LogOut,
  Play,
  Trash2,
} from 'lucide-react';
import { runStartupCapabilityProbes } from '@/api/capabilities';
import { getSpotifyClient } from '@/api/clientInstance';
import { DEMO_USER } from '@/api/demoCatalog';
import { DEMO_TRACKS } from '@/api/demoCatalog';
import { getValidAccessToken, signOutSpotify, startPkceLogin } from '@/features/auth/authService';
import { playerController } from '@/features/player/playerController';
import { openExternalUrl } from '@/platform/openExternal';
import { isTauriRuntime } from '@/platform/runtime';
import { resolveRedirectUri } from '@/platform/redirectUri';
import { useAchievementStore } from '@/stores/achievementStore';
import {
  isValidSpotifyClientId,
  normalizeClientIdInput,
  useAuthStore,
} from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';

export function OnboardingWizard() {
  const storedClientId = useAuthStore((s) => s.clientId);
  const authStatus = useAuthStore((s) => s.status);
  const currentUser = useAuthStore((s) => s.user);
  const diagnostic = useAuthStore((s) => s.diagnostic);
  const setClientId = useAuthStore((s) => s.setClientId);
  const setDemoSession = useAuthStore((s) => s.setDemoSession);
  const setActiveRoute = useUiStore((s) => s.setActiveRoute);
  const setPlaybackSnapshot = usePlayerStore((s) => s.setPlaybackSnapshot);

  const [draftClientId, setDraftClientId] = useState(storedClientId ?? '');
  const [copiedUri, setCopiedUri] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const redirectCheck = resolveRedirectUri();
  const normalizedDraft = normalizeClientIdInput(draftClientId);
  const isDraftValid = isValidSpotifyClientId(normalizedDraft);

  const handleCopyRedirectUri = async () => {
    try {
      await navigator.clipboard.writeText(redirectCheck.uri);
      setCopiedUri(true);
      setTimeout(() => {
        setCopiedUri(false);
      }, 2200);
    } catch {
      setLocalError(`Copy manually: ${redirectCheck.uri}`);
    }
  };

  const handleSaveAndSignIn = async () => {
    setLocalError(null);
    if (!isDraftValid) {
      setLocalError(
        'Enter a valid 32-character hexadecimal Spotify Client ID (0–9, a–f). Never paste your Client Secret.',
      );
      return;
    }
    setClientId(normalizedDraft);
    try {
      await startPkceLogin();
      if (isTauriRuntime()) {
        const token = await getValidAccessToken();
        if (token) {
          const client = getSpotifyClient();
          const profile = await client.getCurrentUser();
          useAuthStore.getState().setAuthenticated(profile);
          useUiStore.getState().setLeftPaneTab('library');
          useUiStore.getState().setSettingsSheetOpen(false);
          void runStartupCapabilityProbes(client).catch(() => undefined);
          void playerController.refreshPlaybackState();
        }
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to start PKCE login');
    }
  };

  const handleLaunchOfflineDemo = () => {
    setDemoSession(DEMO_USER);
    setPlaybackSnapshot({
      currentTrack: DEMO_TRACKS[0] ?? null,
      isPlaying: false,
      positionMs: 42_000,
    });
    useAchievementStore.getState().setFlag('sampleLibraryLaunched');
    setActiveRoute('library');
    useUiStore.getState().setSettingsSheetOpen(false);
  };

  return (
    <section aria-labelledby="onboarding-title">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
        <span className="pulse-mono-pill" data-tone="accent">
          BYO Client ID • Zero Shared Quotas
        </span>
        <span className="pulse-mono-pill" data-tone="signal">
          OAuth 2.0 + PKCE (S256)
        </span>
      </div>

      <h1
        id="onboarding-title"
        style={{
          fontFamily: 'var(--pulse-font-display)',
          fontSize: '1.9rem',
          margin: '0.75rem 0 0.5rem',
        }}
      >
        Connect Your Own Spotify Client ID
      </h1>
      <p style={{ color: 'var(--pulse-color-text-secondary)', maxWidth: '70ch', marginTop: 0 }}>
        Under Spotify’s 2026 Development Mode rules, each developer app is capped at ~5 allowlisted
        users and requires the app owner to hold active Spotify Premium. By supplying your own free
        Client ID, Pulse stays fast, private, and immune to shared-key shutdowns.
      </p>

      {(authStatus === 'authenticated' || authStatus === 'demo') && currentUser ? (
        <article
          className="pulse-card"
          style={{
            borderColor: 'var(--pulse-color-signal)',
            marginBottom: 'var(--pulse-space-5)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CheckCircle2 color="var(--pulse-color-signal)" size={22} aria-hidden="true" />
              <div>
                <strong>
                  Connected as {currentUser.display_name ?? currentUser.id} (
                  {authStatus === 'demo' ? 'Offline Sample Mode' : 'Live PKCE Session'})
                </strong>
                <div style={{ fontSize: '0.85rem', color: 'var(--pulse-color-text-secondary)' }}>
                  {storedClientId
                    ? `Active Client ID: ${storedClientId.slice(0, 6)}…${storedClientId.slice(-4)}`
                    : 'Running local sample catalog — paste a Spotify Client ID below any time.'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="pulse-nav-btn"
                style={{ width: 'auto', border: '1px solid var(--pulse-color-border-strong)' }}
                onClick={() => {
                  setActiveRoute('library');
                }}
              >
                Open Library
              </button>
              <button
                type="button"
                className="pulse-nav-btn"
                style={{ width: 'auto', border: '1px solid var(--pulse-color-border-subtle)' }}
                onClick={() => {
                  void signOutSpotify(false);
                }}
              >
                <LogOut size={15} aria-hidden="true" />
                <span>Sign Out</span>
              </button>
              {storedClientId ? (
                <button
                  type="button"
                  className="pulse-nav-btn"
                  style={{ width: 'auto', color: 'var(--pulse-color-danger)' }}
                  onClick={() => {
                    setDraftClientId('');
                    void signOutSpotify(true);
                  }}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  <span>Remove Client ID</span>
                </button>
              ) : null}
            </div>
          </div>
        </article>
      ) : null}

      {diagnostic ? (
        <article
          className="pulse-card"
          role="alert"
          style={{
            borderColor: 'var(--pulse-color-danger)',
            background: 'var(--pulse-color-danger-soft)',
            marginBottom: 'var(--pulse-space-5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <AlertCircle size={18} color="var(--pulse-color-danger)" aria-hidden="true" />
            <span>{diagnostic.title}</span>
          </div>
          <p style={{ margin: '0.5rem 0' }}>{diagnostic.explanation}</p>
          <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
            {diagnostic.fixSteps.map((step) => (
              <li key={step} style={{ marginBottom: '0.25rem' }}>
                {step}
              </li>
            ))}
          </ol>
        </article>
      ) : null}

      <div className="pulse-card-grid" style={{ gridTemplateColumns: '1fr' }}>
        {/* Step 1 */}
        <article className="pulse-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>
              1. Create your app in the Spotify Developer Dashboard
            </h2>
            <a
              href="https://developer.spotify.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (isTauriRuntime()) {
                  e.preventDefault();
                  void openExternalUrl('https://developer.spotify.com/dashboard').catch((err: unknown) => {
                    setLocalError(
                      err instanceof Error
                        ? err.message
                        : 'Open https://developer.spotify.com/dashboard in your browser.',
                    );
                  });
                }
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
            >
              <span>Open Dashboard</span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
          <ul
            style={{
              margin: '0.75rem 0 0',
              paddingLeft: '1.2rem',
              color: 'var(--pulse-color-text-secondary)',
            }}
          >
            <li>
              Click <strong>Create app</strong>, choose any name (e.g. <em>My Pulse Player</em>),
              and under <strong>Which API/SDKs are you planning to use?</strong> check both{' '}
              <strong>Web API</strong> and <strong>Web Playback SDK</strong>.
            </li>
            <li>
              Under <strong>Settings → Users and Access</strong>, ensure your Spotify name and email
              are listed (required if signing in with a secondary account).
            </li>
          </ul>
        </article>

        {/* Step 2 */}
        <article className="pulse-card">
          <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>
            2. Register this exact Redirect URI (never use <code>localhost</code>)
          </h2>
          <p style={{ color: 'var(--pulse-color-text-secondary)', margin: '0 0 0.75rem' }}>
            Paste this exact URI into the <strong>Redirect URIs</strong> field in your Spotify App
            Settings and click <strong>Add</strong>, then <strong>Save</strong>:
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--pulse-radius-sm)',
              background: 'var(--pulse-color-bg-canvas)',
              border: '1px solid var(--pulse-color-border-strong)',
            }}
          >
            <code
              data-testid="exact-redirect-uri"
              style={{
                flex: 1,
                fontFamily: 'var(--pulse-font-mono)',
                color: 'var(--pulse-color-accent)',
                wordBreak: 'break-all',
              }}
            >
              {redirectCheck.uri}
            </code>
            <button
              type="button"
              onClick={() => {
                void handleCopyRedirectUri();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--pulse-radius-sm)',
                border: '1px solid var(--pulse-color-border-strong)',
                background: 'var(--pulse-color-bg-elevated)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {copiedUri ? <Check size={15} /> : <Copy size={15} />}
              <span>{copiedUri ? 'Copied URI' : 'Copy Redirect URI'}</span>
            </button>
          </div>
          {!redirectCheck.valid && redirectCheck.reason ? (
            <p
              role="alert"
              style={{ color: 'var(--pulse-color-danger)', margin: '0.6rem 0 0', fontSize: '0.9rem' }}
            >
              {redirectCheck.reason}
            </p>
          ) : null}
        </article>

        {/* Step 3 & 4 */}
        <article className="pulse-card">
          <h2 style={{ fontSize: '1.05rem', marginTop: 0 }}>
            3. Paste your Client ID & Test PKCE Sign-In
          </h2>
          <label
            htmlFor="spotify-client-id-input"
            style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}
          >
            Spotify Client ID (32-character hex, public identifier — never enter your Client Secret)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <input
              id="spotify-client-id-input"
              type="text"
              spellCheck={false}
              autoComplete="off"
              placeholder="e.g. a1b2c3d4e5f60718293a4b5c6d7e8f90"
              value={draftClientId}
              onChange={(e) => {
                setDraftClientId(e.target.value);
                setLocalError(null);
              }}
              aria-invalid={draftClientId.length > 0 && !isDraftValid}
              style={{
                flex: '1 1 320px',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--pulse-radius-sm)',
                border: `1px solid ${
                  draftClientId.length === 0
                    ? 'var(--pulse-color-border-strong)'
                    : isDraftValid
                      ? 'var(--pulse-color-signal)'
                      : 'var(--pulse-color-danger)'
                }`,
                background: 'var(--pulse-color-bg-canvas)',
                fontFamily: 'var(--pulse-font-mono)',
              }}
            />

            <button
              type="button"
              disabled={!redirectCheck.valid || authStatus === 'authenticating'}
              onClick={() => {
                void handleSaveAndSignIn();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.15rem',
                borderRadius: 'var(--pulse-radius-sm)',
                border: 'none',
                background: 'var(--pulse-color-accent)',
                color: 'var(--pulse-color-text-inverse)',
                fontWeight: 700,
                cursor: redirectCheck.valid ? 'pointer' : 'not-allowed',
              }}
            >
              <KeyRound size={16} aria-hidden="true" />
              <span>
                {authStatus === 'authenticating' ? 'Connecting…' : 'Save & Test PKCE Sign-In'}
              </span>
            </button>

            {storedClientId && isDraftValid && normalizedDraft !== storedClientId ? (
              <button
                type="button"
                className="pulse-nav-btn"
                style={{ width: 'auto', border: '1px solid var(--pulse-color-border-strong)' }}
                onClick={() => {
                  setClientId(normalizedDraft);
                }}
              >
                Save Client ID Only
              </button>
            ) : null}
          </div>

          <p
            style={{
              margin: '0.5rem 0 0',
              fontSize: '0.84rem',
              color:
                draftClientId.length === 0
                  ? 'var(--pulse-color-text-muted)'
                  : isDraftValid
                    ? 'var(--pulse-color-signal)'
                    : 'var(--pulse-color-danger)',
            }}
          >
            {draftClientId.length === 0
              ? 'Waiting for 32-character hexadecimal Client ID.'
              : isDraftValid
                ? 'Valid 32-character hexadecimal Client ID format.'
                : `Invalid format (${normalizedDraft.length}/32 hex characters). Copy only the Client ID from Spotify Dashboard.`}
          </p>

          {localError ? (
            <p role="alert" style={{ color: 'var(--pulse-color-danger)', marginTop: '0.5rem' }}>
              {localError}
            </p>
          ) : null}

          <hr
            style={{
              border: 'none',
              borderTop: '1px solid var(--pulse-color-border-subtle)',
              margin: '1.25rem 0',
            }}
          />

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <span style={{ color: 'var(--pulse-color-text-secondary)', fontSize: '0.9rem' }}>
              Want to explore Library, Smart Playlists, Theme Studio, and Plugins before creating a
              Spotify app?
            </span>
            <button
              type="button"
              onClick={handleLaunchOfflineDemo}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 0.95rem',
                borderRadius: 'var(--pulse-radius-sm)',
                border: '1px solid var(--pulse-color-border-strong)',
                background: 'var(--pulse-color-bg-elevated)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <Play size={14} aria-hidden="true" />
              <span>Preview with Sample Library (Offline)</span>
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
