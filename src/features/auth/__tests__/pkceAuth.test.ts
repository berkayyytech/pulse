import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { classifySpotifyAuthFailure } from '@/features/auth/authErrors';
import {
  completePkceCallback,
  getValidAccessToken,
  refreshSpotifyAccessToken,
  setMemoryAccessTokenForTesting,
  signOutSpotify,
  startPkceLogin,
} from '@/features/auth/authService';
import {
  deriveCodeChallengeS256,
  generateCodeVerifier,
  SPOTIFY_TOKEN_ENDPOINT,
} from '@/features/auth/pkce';
import { getTokenVault } from '@/platform/tokenVault';
import { useAuthStore } from '@/stores/authStore';
import { mswServer } from '@/test/mswServer';

describe('PKCE OAuth 2.0 Flow, Encrypted Refresh & Human Error Diagnostics', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    setMemoryAccessTokenForTesting(null);
    await getTokenVault().clearAll();
    useAuthStore.getState().setClientId(null);
  });

  it('generates RFC 7636 compliant PKCE verifiers and deterministic S256 challenges', async () => {
    const verifier = generateCodeVerifier(64);
    expect(verifier).toHaveLength(64);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);

    // RFC 7636 Appendix B test vector
    const rfcVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const rfcChallenge = await deriveCodeChallengeS256(rfcVerifier);
    expect(rfcChallenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('completes full PKCE login, encrypts refresh token in vault, and refreshes access token', async () => {
    window.history.replaceState({}, '', 'http://127.0.0.1:5173/');

    let capturedGrantType = '';
    mswServer.use(
      http.post(SPOTIFY_TOKEN_ENDPOINT, async ({ request }) => {
        const bodyText = await request.text();
        const params = new URLSearchParams(bodyText);
        capturedGrantType = params.get('grant_type') ?? '';
        if (capturedGrantType === 'authorization_code') {
          expect(params.get('code_verifier')).toBeTruthy();
          expect(params.get('client_secret')).toBeNull();
          return HttpResponse.json({
            access_token: 'pkce_initial_access_token',
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: 'pkce_rotated_refresh_token_1',
          });
        }
        return HttpResponse.json({
          access_token: 'pkce_refreshed_access_token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'pkce_rotated_refresh_token_2',
        });
      }),
    );

    useAuthStore.getState().setClientId('a1b2c3d4e5f60718293a4b5c6d7e8f90');

    let redirectedTo = '';
    await startPkceLogin({
      navigateFn: (url) => {
        redirectedTo = url;
      },
    });

    const parsedAuthUrl = new URL(redirectedTo);
    expect(parsedAuthUrl.searchParams.get('code_challenge_method')).toBe('S256');
    const state = parsedAuthUrl.searchParams.get('state');

    const ok = await completePkceCallback({
      code: 'spotify_auth_code_123',
      state,
      error: null,
    });
    expect(ok).toBe(true);
    expect(await getValidAccessToken()).toBe('pkce_initial_access_token');

    // Force expiry and test silent refresh from encrypted vault
    setMemoryAccessTokenForTesting(null);
    const refreshed = await refreshSpotifyAccessToken();
    expect(refreshed).toBe('pkce_refreshed_access_token');

    await signOutSpotify(true);
    expect(useAuthStore.getState().clientId).toBeNull();
  });

  it('classifies Redirect URI mismatch, 403 allowlist, and lapsed Premium into clear fixes', () => {
    const redirectDiag = classifySpotifyAuthFailure(
      new Error('INVALID_CLIENT: Invalid redirect URI'),
      'http://127.0.0.1:5173/auth/callback',
    );
    expect(redirectDiag.code).toBe('redirect_uri_mismatch');
    expect(redirectDiag.fixSteps.join(' ')).toContain('http://127.0.0.1:5173/auth/callback');

    const allowlistDiag = classifySpotifyAuthFailure(
      new Error('HTTP 403: User not registered in the Developer Dashboard'),
      'http://127.0.0.1:5173/auth/callback',
    );
    expect(allowlistDiag.code).toBe('allowlist_missing');

    const premiumDiag = classifySpotifyAuthFailure(
      new Error('Player command failed: Premium required'),
      'http://127.0.0.1:5173/auth/callback',
    );
    expect(premiumDiag.code).toBe('premium_lapsed');
  });
});
