export const SPOTIFY_AUTHORIZE_ENDPOINT = 'https://accounts.spotify.com/authorize';
export const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

/**
 * Minimal official OAuth scopes needed for Pulse's 2026 Development Mode features.
 * Deliberately excludes `user-read-email` and `user-read-private` since `email`,
 * `country`, and `product` were removed from `GET /v1/me` in February 2026.
 */
export const PULSE_SPOTIFY_SCOPES = [
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-top-read',
  'user-library-read',
  'user-library-modify',
  'user-follow-read',
  'user-follow-modify',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
] as const;

const PKCE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateCodeVerifier(length = 64): string {
  const clamped = Math.max(43, Math.min(128, length));
  const randomBytes = crypto.getRandomValues(new Uint8Array(clamped));
  let result = '';
  for (const byte of randomBytes) {
    result += PKCE_CHARSET[byte % PKCE_CHARSET.length] ?? 'A';
  }
  return result;
}

export function generateOAuthState(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(24));
  return base64UrlEncode(randomBytes);
}

export async function deriveCodeChallengeS256(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return base64UrlEncode(new Uint8Array(digest));
}

export function buildSpotifyAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scopes?: readonly string[];
}): string {
  const url = new URL(SPOTIFY_AUTHORIZE_ENDPOINT);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('state', params.state);
  url.searchParams.set('scope', (params.scopes ?? PULSE_SPOTIFY_SCOPES).join(' '));
  return url.toString();
}
