import { create } from 'zustand';

export type CapabilityStatus = 'unknown' | 'available' | 'degraded';

export interface CapabilityEntry {
  readonly id: string;
  readonly status: CapabilityStatus;
  readonly httpStatus?: number;
  readonly reason?: string;
  readonly updatedAt: number;
}

export interface ApiAlertBanner {
  readonly id: string;
  readonly kind: '403-degraded' | '429-ratelimit' | 'schema-drift' | 'eme-fallback';
  readonly message: string;
  readonly dismissed: boolean;
}

interface CapabilityState {
  readonly capabilities: Readonly<Record<string, CapabilityEntry>>;
  readonly alerts: readonly ApiAlertBanner[];
  setCapability: (entry: CapabilityEntry) => void;
  pushAlert: (alert: Omit<ApiAlertBanner, 'dismissed'>) => void;
  dismissAlert: (id: string) => void;
  resetCapabilities: () => void;
}

export const useCapabilityStore = create<CapabilityState>((set) => ({
  capabilities: {},
  alerts: [],
  setCapability: (entry) => {
    set((state) => ({
      capabilities: {
        ...state.capabilities,
        [entry.id]: entry,
      },
    }));
  },
  pushAlert: (incoming) => {
    set((state) => {
      const exists = state.alerts.some((a) => a.id === incoming.id);
      if (exists) {
        return state;
      }
      return {
        alerts: [...state.alerts, { ...incoming, dismissed: false }],
      };
    });
  },
  dismissAlert: (id) => {
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)),
    }));
  },
  resetCapabilities: () => {
    set({ capabilities: {}, alerts: [] });
  },
}));
