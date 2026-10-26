import { create } from 'zustand';
import type {
  PluginCommandDescriptor,
  PluginManifest,
  PluginSlotPayload,
  PluginUiSlotName,
} from '@pulse/plugin-sdk';

export interface InstalledPluginState {
  readonly manifest: PluginManifest;
  readonly workerSource: string;
  readonly approvedPermissions: readonly string[];
  readonly enabled: boolean;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly devServerUrl?: string;
}

interface PluginStoreState {
  readonly plugins: Readonly<Record<string, InstalledPluginState>>;
  readonly slotOutputs: Readonly<Record<PluginUiSlotName, readonly (PluginSlotPayload & { pluginId: string })[]>>;
  readonly registeredCommands: readonly (PluginCommandDescriptor & { pluginId: string })[];
  upsertPlugin: (plugin: InstalledPluginState) => void;
  removePlugin: (pluginId: string) => void;
  setPluginEnabled: (pluginId: string, enabled: boolean) => void;
  updatePluginSetting: (pluginId: string, key: string, value: unknown) => void;
  setSlotOutput: (pluginId: string, payload: PluginSlotPayload) => void;
  clearPluginOutputs: (pluginId: string) => void;
  registerPluginCommand: (pluginId: string, command: PluginCommandDescriptor) => void;
}

export const usePluginStore = create<PluginStoreState>((set) => ({
  plugins: {},
  slotOutputs: {
    'now-playing-badge': [],
    'sidebar-footer': [],
  },
  registeredCommands: [],
  upsertPlugin: (plugin) => {
    set((state) => ({
      plugins: {
        ...state.plugins,
        [plugin.manifest.id]: plugin,
      },
    }));
  },
  removePlugin: (pluginId) => {
    set((state) => {
      const nextPlugins = Object.fromEntries(
        Object.entries(state.plugins).filter(([id]) => id !== pluginId),
      );
      return {
        plugins: nextPlugins,
        slotOutputs: {
          'now-playing-badge': state.slotOutputs['now-playing-badge'].filter(
            (s) => s.pluginId !== pluginId,
          ),
          'sidebar-footer': state.slotOutputs['sidebar-footer'].filter(
            (s) => s.pluginId !== pluginId,
          ),
        },
        registeredCommands: state.registeredCommands.filter((c) => c.pluginId !== pluginId),
      };
    });
  },
  setPluginEnabled: (pluginId, enabled) => {
    set((state) => {
      const existing = state.plugins[pluginId];
      if (!existing) {
        return state;
      }
      return {
        plugins: {
          ...state.plugins,
          [pluginId]: { ...existing, enabled },
        },
      };
    });
  },
  updatePluginSetting: (pluginId, key, value) => {
    set((state) => {
      const existing = state.plugins[pluginId];
      if (!existing) {
        return state;
      }
      return {
        plugins: {
          ...state.plugins,
          [pluginId]: {
            ...existing,
            settings: { ...existing.settings, [key]: value },
          },
        },
      };
    });
  },
  setSlotOutput: (pluginId, payload) => {
    set((state) => {
      const existingSlot = state.slotOutputs[payload.slot].filter((s) => s.pluginId !== pluginId);
      const nextEntry = payload.text.trim() ? [...existingSlot, { ...payload, pluginId }] : existingSlot;
      return {
        slotOutputs: {
          ...state.slotOutputs,
          [payload.slot]: nextEntry,
        },
      };
    });
  },
  clearPluginOutputs: (pluginId) => {
    set((state) => ({
      slotOutputs: {
        'now-playing-badge': state.slotOutputs['now-playing-badge'].filter(
          (s) => s.pluginId !== pluginId,
        ),
        'sidebar-footer': state.slotOutputs['sidebar-footer'].filter(
          (s) => s.pluginId !== pluginId,
        ),
      },
      registeredCommands: state.registeredCommands.filter((c) => c.pluginId !== pluginId),
    }));
  },
  registerPluginCommand: (pluginId, command) => {
    set((state) => {
      const filtered = state.registeredCommands.filter(
        (c) => !(c.pluginId === pluginId && c.commandId === command.commandId),
      );
      return {
        registeredCommands: [...filtered, { ...command, pluginId }],
      };
    });
  },
}));
