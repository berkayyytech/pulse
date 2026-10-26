import { create } from 'zustand';
import type { UserProfile } from '@/api/schemas/user';

const CLIENT_ID_STORAGE_KEY = 'pulse.spotify.clientId';

export type AuthStatus =
  | 'unconfigured'
  | 'signed-out'
  | 'authenticating'
  | 'authenticated'
  | 'demo';

export interface HumanAuthDiagnostic {
  readonly code:
    | 'redirect_uri_mismatch'
    | 'allowlist_missing'
    | 'premium_lapsed'
    | 'invalid_client_id'
    | 'access_denied'
    | 'session_expired'
    | 'network_or_unknown';
  readonly title: string;
  readonly explanation: string;
  readonly fixSteps: readonly string[];
}

interface AuthState {
  readonly clientId: string | null;
  readonly status: AuthStatus;
  readonly user: UserProfile | null;
  readonly diagnostic: HumanAuthDiagnostic | null;
  setClientId: (clientId: string | null) => void;
  setAuthenticating: () => void;
  setAuthenticated: (user: UserProfile) => void;
  setDemoSession: (user: UserProfile) => void;
  setSignedOut: (diagnostic?: HumanAuthDiagnostic | null) => void;
  setDiagnostic: (diagnostic: HumanAuthDiagnostic | null) => void;
}

const CLIENT_ID_HEX_REGEX = /^[a-f0-9]{32}$/i;

export function normalizeClientIdInput(raw: string): string {
  return raw.trim().replace(/^["']+|["']+$/g, '');
}

export function isValidSpotifyClientId(value: string): boolean {
  return CLIENT_ID_HEX_REGEX.test(normalizeClientIdInput(value));
}

function readStoredClientId(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  const raw = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (!raw || !isValidSpotifyClientId(raw)) {
    return null;
  }
  return normalizeClientIdInput(raw);
}

export const useAuthStore = create<AuthState>((set) => {
  const initialClientId = readStoredClientId();
  return {
    clientId: initialClientId,
    status: initialClientId ? 'signed-out' : 'unconfigured',
    user: null,
    diagnostic: null,
    setClientId: (clientId) => {
      const normalized = clientId ? normalizeClientIdInput(clientId) : null;
      if (typeof localStorage !== 'undefined') {
        if (normalized) {
          localStorage.setItem(CLIENT_ID_STORAGE_KEY, normalized);
        } else {
          localStorage.removeItem(CLIENT_ID_STORAGE_KEY);
        }
      }
      set({
        clientId: normalized,
        status: normalized ? 'signed-out' : 'unconfigured',
        user: null,
        diagnostic: null,
      });
    },
    setAuthenticating: () => {
      set({ status: 'authenticating', diagnostic: null });
    },
    setAuthenticated: (user) => {
      set({ status: 'authenticated', user, diagnostic: null });
    },
    setDemoSession: (user) => {
      set({ status: 'demo', user, diagnostic: null });
    },
    setSignedOut: (diagnostic = null) => {
      set((state) => ({
        status: state.clientId ? 'signed-out' : 'unconfigured',
        user: null,
        diagnostic,
      }));
    },
    setDiagnostic: (diagnostic) => {
      set({ diagnostic });
    },
  };
});
