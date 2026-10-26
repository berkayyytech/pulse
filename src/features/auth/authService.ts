import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';
import { getTokenVault } from '@/platform/tokenVault';
import { DEFAULT_TAURI_LOOPBACK_PORT, resolveRedirectUri } from '@/platform/redirectUri';
import { isTauriRuntime } from '@/platform/runtime';
import { useAuthStore } from '@/stores/authStore';
import {
  buildSpotifyAuthorizeUrl,
  deriveCodeChallengeS256,
  generateCodeVerifier,
  generateOAuthState,
  SPOTIFY_TOKEN_ENDPOINT,
} from './pkce';
import { classifySpotifyAuthFailure } from './authErrors';

const VAULT_REFRESH_TOKEN_KEY = 'spotify_refresh_token';
const VAULT_PKCE_VERIFIER_KEY = 'spotify_pkce_verifier';
const SESSION_STATE_KEY = 'pulse.pkce.state';
const SESSION_REDIRECT_KEY = 'pulse.pkce.redirectUri';

const TokenEndpointResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().default('Bearer'),
  scope: z.string().default(''),
  expires_in: z.number().positive(),
  refresh_token: z.string().min(1).optional(),
});

interface InMemoryAccessToken {
  readonly accessToken: string;
  readonly expiresAtMs: number;
}

interface TauriLoopbackPayload {
  readonly code: string | null;
  readonly state: string | null;
  readonly error: string | null;
}

let memoryToken: InMemoryAccessToken | null = null;
let inflightRefresh: Promise<string | null> | null = null;
let scheduledRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function clearScheduledRefresh(): void {
  if (scheduledRefreshTimer !== null) {
    clearTimeout(scheduledRefreshTimer);
    scheduledRefreshTimer = null;
  }
}

function scheduleProactiveRefresh(expiresInSeconds: number): void {
  clearScheduledRefresh();
  const refreshLeadMs = Math.max(10_000, (expiresInSeconds - 60) * 1000);
  scheduledRefreshTimer = setTimeout(() => {
    void refreshSpotifyAccessToken().catch(() => undefined);
  }, refreshLeadMs);
}

export async function startPkceLogin(options?: {
  navigateFn?: (authorizeUrl: string) => void;
}): Promise<string> {
  const clientId = useAuthStore.getState().clientId;
  const redirectCheck = resolveRedirectUri();

  if (!clientId) {
    throw new Error('Configure a valid 32-character Spotify Client ID first.');
  }
  if (!redirectCheck.valid) {
    const diag = classifySpotifyAuthFailure(
      new Error(redirectCheck.reason ?? 'Invalid Redirect URI'),
      redirectCheck.uri,
    );
    useAuthStore.getState().setDiagnostic(diag);
    throw new Error(diag.explanation);
  }

  useAuthStore.getState().setAuthenticating();

  const verifier = generateCodeVerifier(64);
  const challenge = await deriveCodeChallengeS256(verifier);
  const state = generateOAuthState();

  const vault = getTokenVault();
  await vault.setSecret(VAULT_PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(SESSION_STATE_KEY, state);
  sessionStorage.setItem(SESSION_REDIRECT_KEY, redirectCheck.uri);

  const authorizeUrl = buildSpotifyAuthorizeUrl({
    clientId,
    redirectUri: redirectCheck.uri,
    codeChallenge: challenge,
    state,
  });

  if (isTauriRuntime()) {
    const listenerPromise = invoke<TauriLoopbackPayload>('listen_loopback_oauth', {
      port: DEFAULT_TAURI_LOOPBACK_PORT,
      timeoutSecs: 180,
    });
    await invoke('open_external_url', { url: authorizeUrl }).catch(() => {
      window.open(authorizeUrl, '_blank', 'noopener,noreferrer');
    });
    const callback = await listenerPromise;
    await completePkceCallback({
      code: callback.code,
      state: callback.state,
      error: callback.error,
    });
    return authorizeUrl;
  }

  const navigate =
    options?.navigateFn ??
    ((targetUrl: string) => {
      window.location.assign(targetUrl);
    });
  navigate(authorizeUrl);
  return authorizeUrl;
}

export async function completePkceCallback(params: {
  code: string | null;
  state: string | null;
  error: string | null;
}): Promise<boolean> {
  const redirectUri = sessionStorage.getItem(SESSION_REDIRECT_KEY) ?? resolveRedirectUri().uri;
  const expectedState = sessionStorage.getItem(SESSION_STATE_KEY);
  const clientId = useAuthStore.getState().clientId;
  const vault = getTokenVault();

  try {
    if (params.error) {
      throw new Error(`Spotify authorization error: ${params.error}`);
    }
    if (!params.code) {
      return false;
    }
    if (!expectedState || params.state !== expectedState) {
      throw new Error('PKCE state mismatch. Please start sign-in again from Pulse.');
    }
    if (!clientId) {
      throw new Error('Missing Spotify Client ID during callback exchange.');
    }

    const codeVerifier = await vault.getSecret(VAULT_PKCE_VERIFIER_KEY);
    if (!codeVerifier) {
      throw new Error('Missing PKCE code_verifier in vault. Start sign-in again.');
    }

    const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Token exchange HTTP ${response.status}: ${errorBody}`);
    }

    const tokenData = TokenEndpointResponseSchema.parse(await response.json());
    memoryToken = {
      accessToken: tokenData.access_token,
      expiresAtMs: Date.now() + tokenData.expires_in * 1000,
    };

    if (tokenData.refresh_token) {
      await vault.setSecret(VAULT_REFRESH_TOKEN_KEY, tokenData.refresh_token);
    }
    await vault.deleteSecret(VAULT_PKCE_VERIFIER_KEY);
    sessionStorage.removeItem(SESSION_STATE_KEY);
    sessionStorage.removeItem(SESSION_REDIRECT_KEY);

    scheduleProactiveRefresh(tokenData.expires_in);
    return true;
  } catch (err) {
    const diag = classifySpotifyAuthFailure(err, redirectUri);
    useAuthStore.getState().setSignedOut(diag);
    return false;
  }
}

export async function refreshSpotifyAccessToken(): Promise<string | null> {
  if (inflightRefresh) {
    return await inflightRefresh;
  }

  inflightRefresh = (async () => {
    const clientId = useAuthStore.getState().clientId;
    if (!clientId) {
      return null;
    }
    const vault = getTokenVault();
    const refreshToken = await vault.getSecret(VAULT_REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        if (response.status === 400 || response.status === 401) {
          await vault.deleteSecret(VAULT_REFRESH_TOKEN_KEY);
          memoryToken = null;
          useAuthStore
            .getState()
            .setSignedOut(classifySpotifyAuthFailure(new Error(text), resolveRedirectUri().uri));
        }
        return null;
      }

      const tokenData = TokenEndpointResponseSchema.parse(await response.json());
      memoryToken = {
        accessToken: tokenData.access_token,
        expiresAtMs: Date.now() + tokenData.expires_in * 1000,
      };
      if (tokenData.refresh_token) {
        await vault.setSecret(VAULT_REFRESH_TOKEN_KEY, tokenData.refresh_token);
      }
      scheduleProactiveRefresh(tokenData.expires_in);
      return tokenData.access_token;
    } catch {
      return null;
    }
  })().finally(() => {
    inflightRefresh = null;
  });

  return await inflightRefresh;
}

export async function getValidAccessToken(): Promise<string | null> {
  if (useAuthStore.getState().status === 'demo') {
    return 'pulse-offline-demo-token';
  }
  const now = Date.now();
  if (memoryToken && memoryToken.expiresAtMs - now > 30_000) {
    return memoryToken.accessToken;
  }
  return await refreshSpotifyAccessToken();
}

export async function signOutSpotify(removeClientId = false): Promise<void> {
  clearScheduledRefresh();
  memoryToken = null;
  const vault = getTokenVault();
  await vault.deleteSecret(VAULT_REFRESH_TOKEN_KEY);
  await vault.deleteSecret(VAULT_PKCE_VERIFIER_KEY);
  if (removeClientId) {
    useAuthStore.getState().setClientId(null);
  } else {
    useAuthStore.getState().setSignedOut(null);
  }
}

export function setMemoryAccessTokenForTesting(token: string | null, ttlMs = 3_600_000): void {
  memoryToken = token ? { accessToken: token, expiresAtMs: Date.now() + ttlMs } : null;
}
