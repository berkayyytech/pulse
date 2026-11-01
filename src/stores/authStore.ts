import { create } from 'zustand';
import type { UserProfile } from '@/api/schemas/user';

const CLIENT_ID_STORAGE_KEY = 'pulse.spotify.clientId';
const ACCOUNT_TIER_STORAGE_KEY = 'pulse.auth.accountTier';

export type AccountTier = 'spotify-premium' | 'spotify-free' | 'local-only';

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
  readonly accountTier: AccountTier;
  readonly user: UserProfile | null;
  readonly diagnostic: HumanAuthDiagnostic | null;
  setClientId: (clientId: string | null) => void;
  setAccountTier: (tier: AccountTier) => void;
  setAuthenticating: () => void;
  setAuthenticated: (user: UserProfile) => void;
  setDemoSession: (user: UserProfile) => void;
  setSignedOut: (diagnostic?: HumanAuthDiagnostic | null) => void;
  setDiagnostic: (diagnostic: HumanAuthDiagnostic | null) => void;
  reloadFromStorage: () => void;
}

const CLIENT_ID_HEX_REGEX = /^[a-f0-9]{32}$/i;

export function normalizeClientIdInput(raw: string): string {
  return raw.trim().replace(/^["']+|["']+$/g, '');
}

export function isValidSpotifyClientId(value: string): boolean {
  return CLIENT_ID_HEX_REGEX.test(normalizeClientIdInput(value));
}

function readStoredAccountTier(): AccountTier {
  if (typeof localStorage === 'undefined') {
    return 'local-only';
  }
  const raw = localStorage.getItem(ACCOUNT_TIER_STORAGE_KEY);
  if (raw === 'spotify-premium' || raw === 'spotify-free' || raw === 'local-only') {
    return raw;
  }
  const hasClientId = Boolean(localStorage.getItem(CLIENT_ID_STORAGE_KEY));
  return hasClientId ? 'spotify-premium' : 'local-only';
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
  const initialAccountTier = readStoredAccountTier();
  return {
    clientId: initialClientId,
    status: initialClientId ? 'signed-out' : 'unconfigured',
    accountTier: initialAccountTier,
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
    setAccountTier: (tier) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ACCOUNT_TIER_STORAGE_KEY, tier);
      }
      set({ accountTier: tier });
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
    reloadFromStorage: () => {
      const reloadedClientId = readStoredClientId();
      const reloadedTier = readStoredAccountTier();
      set((state) => ({
        clientId: reloadedClientId,
        accountTier: reloadedTier,
        status:
          state.status === 'authenticated' || state.status === 'demo'
            ? state.status
            : reloadedClientId
              ? 'signed-out'
              : 'unconfigured',
      }));
    },
  };
});
