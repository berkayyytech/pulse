import { SpotifyApiError } from '@/api/httpClient';
import type { HumanAuthDiagnostic } from '@/stores/authStore';

export function classifySpotifyAuthFailure(
  error: unknown,
  expectedRedirectUri: string,
): HumanAuthDiagnostic {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const lower = rawMessage.toLowerCase();

  if (lower.includes('access_denied')) {
    return {
      code: 'access_denied',
      title: 'Authorization was canceled',
      explanation:
        'Spotify reported that the authorization prompt was closed or declined before completing sign-in.',
      fixSteps: [
        'Click "Test PKCE Sign-In" again and click "Agree" on the Spotify authorization screen.',
      ],
    };
  }

  if (
    lower.includes('redirect_uri') ||
    lower.includes('invalid redirect') ||
    lower.includes('localhost')
  ) {
    return {
      code: 'redirect_uri_mismatch',
      title: 'Redirect URI mismatch',
      explanation:
        'The Redirect URI registered in your Spotify Developer Dashboard does not exactly match the URI Pulse sent (note: Spotify banned "localhost" in favor of "127.0.0.1").',
      fixSteps: [
        'Open developer.spotify.com/dashboard -> Your App -> Settings -> Edit.',
        `Add this exact Redirect URI: ${expectedRedirectUri}`,
        'Remove any old http://localhost:... entries and click Save at the bottom of the Dashboard page.',
      ],
    };
  }

  if (lower.includes('invalid_client')) {
    return {
      code: 'invalid_client_id',
      title: 'Client ID rejected by Spotify',
      explanation:
        'Spotify did not recognize the 32-character Client ID you entered, or the app was deleted from your Developer Dashboard.',
      fixSteps: [
        'Copy the "Client ID" (not Client Secret!) from your Spotify Developer Dashboard.',
        'Paste the 32-character hexadecimal value into Step 3 of the setup wizard.',
      ],
    };
  }

  if (
    (error instanceof SpotifyApiError && error.kind === 'premium_required') ||
    lower.includes('premium')
  ) {
    return {
      code: 'premium_lapsed',
      title: 'Active Spotify Premium required',
      explanation:
        'Under Spotify’s 2026 Development Mode rules, the owner of the Client ID must maintain an active Spotify Premium subscription. If Premium lapses, both Web API and Web Playback SDK calls stop working.',
      fixSteps: [
        'Verify that the Spotify account that owns this Client ID has active Spotify Premium.',
        'Once active, click "Test PKCE Sign-In" to reconnect.',
      ],
    };
  }

  if (
    (error instanceof SpotifyApiError && error.status === 403) ||
    lower.includes('403') ||
    lower.includes('not registered') ||
    lower.includes('users and access')
  ) {
    return {
      code: 'allowlist_missing',
      title: 'Account not added to App Allowlist (403 Forbidden)',
      explanation:
        'Development Mode apps only allow up to 5 explicitly allowlisted Spotify accounts (or the app owner’s Premium subscription may have lapsed).',
      fixSteps: [
        'Open developer.spotify.com/dashboard -> Your App -> Settings -> Users and Access.',
        'Add your full name and the exact email address tied to your Spotify account.',
        'Also confirm the app owner account has active Spotify Premium.',
      ],
    };
  }

  if (lower.includes('invalid_grant') || lower.includes('expired')) {
    return {
      code: 'session_expired',
      title: 'Saved session expired or revoked',
      explanation:
        'Your refresh token expired or access was revoked from your Spotify Account Apps page.',
      fixSteps: ['Click "Sign In with PKCE" to establish a fresh encrypted session.'],
    };
  }

  return {
    code: 'network_or_unknown',
    title: 'Could not complete Spotify connection',
    explanation: rawMessage,
    fixSteps: [
      `Confirm your Redirect URI is set to ${expectedRedirectUri} in the Spotify Dashboard.`,
      'Check your internet connection and verify no firewall/extension is blocking accounts.spotify.com.',
    ],
  };
}
