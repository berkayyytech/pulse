import { isTauriRuntime } from './runtime';

export const DEFAULT_TAURI_LOOPBACK_PORT = 43821;

export interface RedirectUriValidation {
  readonly valid: boolean;
  readonly uri: string;
  readonly reason?: string;
}

/**
 * Computes and validates the exact OAuth Redirect URI required by Spotify's 2026 rules:
 * - `localhost` is strictly disallowed by Spotify.
 * - `http://` is permitted ONLY for explicit loopback IP literals (`127.0.0.1` or `[::1]`).
 * - All non-loopback hosts must use `https://`.
 */
export function resolveRedirectUri(
  loc: Pick<Location, 'protocol' | 'hostname' | 'port' | 'origin'> = window.location,
  tauriLoopbackPort: number = DEFAULT_TAURI_LOOPBACK_PORT,
): RedirectUriValidation {
  if (isTauriRuntime()) {
    const uri = `http://127.0.0.1:${tauriLoopbackPort}/auth/callback`;
    return { valid: true, uri };
  }

  if (loc.hostname.toLowerCase() === 'localhost') {
    const portSuffix = loc.port ? `:${loc.port}` : '';
    return {
      valid: false,
      uri: `http://127.0.0.1${portSuffix}/auth/callback`,
      reason:
        'Spotify prohibits "localhost" in Redirect URIs. Open Pulse via http://127.0.0.1 instead.',
    };
  }

  const isLoopbackIp = loc.hostname === '127.0.0.1' || loc.hostname === '[::1]';
  if (loc.protocol === 'http:' && !isLoopbackIp) {
    return {
      valid: false,
      uri: `${loc.origin}/auth/callback`,
      reason:
        'Spotify requires HTTPS for non-loopback Redirect URIs (or http://127.0.0.1 for local use).',
    };
  }

  return {
    valid: true,
    uri: `${loc.origin}/auth/callback`,
  };
}
