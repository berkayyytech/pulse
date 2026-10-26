import type {
  HostToPluginEvent,
  PluginManifest,
  PluginPlayerSnapshot,
  PluginRpcRequest,
  PluginRpcResponse,
} from '@pulse/plugin-sdk';
import { getSpotifyClient } from '@/api/clientInstance';
import { playerController } from '@/features/player/playerController';
import { usePlayerStore } from '@/stores/playerStore';
import { usePluginStore, type InstalledPluginState } from '@/stores/pluginStore';

export const EXAMPLE_STUDIO_TIMECODE_MANIFEST: PluginManifest = {
  id: 'pulse.studio-timecode-monitor',
  name: 'Studio Remaining Timecode Badge',
  version: '1.0.0',
  sdkVersion: '1.0',
  author: 'Pulse Core',
  description:
    'Sandboxed Web Worker example plugin: displays live remaining countdown in the Now Playing bar and registers a quick toggle command.',
  entry: 'worker.js',
  permissions: ['read:player', 'ui:slot', 'ui:command'],
  settingsSchema: {
    type: 'object',
    properties: {
      prefix: {
        type: 'string',
        title: 'Timecode Prefix',
        default: 'REM',
      },
      showMilliseconds: {
        type: 'boolean',
        title: 'Show tenths of a second',
        default: false,
      },
    },
  },
};

export const EXAMPLE_STUDIO_TIMECODE_WORKER_SOURCE = `
let currentPrefix = 'REM';
let showTenths = false;

function rpcCall(method, extra = {}) {
  const id = Math.random().toString(36).slice(2);
  self.postMessage({ id, method, ...extra });
}

rpcCall('ui.registerCommand', {
  command: {
    commandId: 'toggle-tenths',
    title: 'Studio Timecode: Toggle Tenths Display',
  },
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.event === 'settings.changed' && data.settings) {
    if (typeof data.settings.prefix === 'string') currentPrefix = data.settings.prefix;
    if (typeof data.settings.showMilliseconds === 'boolean') showTenths = data.settings.showMilliseconds;
  }

  if (data.event === 'command.invoked' && data.commandId === 'toggle-tenths') {
    showTenths = !showTenths;
  }

  if (data.event === 'player.changed' && data.snapshot) {
    const snap = data.snapshot;
    if (!snap.track) {
      rpcCall('ui.renderSlot', { payload: { slot: 'now-playing-badge', text: '' } });
      return;
    }
    const remMs = Math.max(0, snap.durationMs - snap.positionMs);
    const totalSec = Math.floor(remMs / 1000);
    const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const sec = String(totalSec % 60).padStart(2, '0');
    const tenths = showTenths ? '.' + String(Math.floor((remMs % 1000) / 100)) : '';
    rpcCall('ui.renderSlot', {
      payload: {
        slot: 'now-playing-badge',
        text: currentPrefix + ' -' + min + ':' + sec + tenths,
        tone: 'signal',
      },
    });
  }
});
`;

export interface RegistryCatalogItem {
  readonly manifest: PluginManifest;
  readonly workerSource: string;
  readonly repoUrl: string;
}

export const COMMUNITY_STATIC_INDEX_FALLBACK: readonly RegistryCatalogItem[] = [
  {
    manifest: EXAMPLE_STUDIO_TIMECODE_MANIFEST,
    workerSource: EXAMPLE_STUDIO_TIMECODE_WORKER_SOURCE,
    repoUrl: 'https://github.com/pulseplayer/plugins/tree/main/studio-timecode-monitor',
  },
];

function hasPermission(plugin: InstalledPluginState, required: string): boolean {
  return plugin.approvedPermissions.includes(required);
}

export function buildPlayerSnapshotForPlugin(): PluginPlayerSnapshot {
  const s = usePlayerStore.getState();
  return {
    isPlaying: s.isPlaying,
    positionMs: s.positionMs,
    durationMs: s.currentTrack?.duration_ms ?? 0,
    track: s.currentTrack
      ? {
          id: s.currentTrack.id,
          uri: s.currentTrack.uri,
          name: s.currentTrack.name,
          artistNames: s.currentTrack.artists.map((a) => a.name),
          albumName: s.currentTrack.album?.name ?? '',
        }
      : null,
  };
}

/**
 * Permission-gated RPC handler for sandboxed plugin messages.
 * Plugins NEVER receive OAuth tokens, Client IDs, or unapproved network access.
 */
export async function handlePluginRpcRequest(
  plugin: InstalledPluginState,
  req: PluginRpcRequest,
): Promise<PluginRpcResponse> {
  try {
    switch (req.method) {
      case 'player.getState': {
        if (!hasPermission(plugin, 'read:player')) {
          throw new Error('Missing permission: read:player');
        }
        return { id: req.id, ok: true, result: buildPlayerSnapshotForPlugin() };
      }

      case 'player.togglePlay': {
        if (!hasPermission(plugin, 'control:playback')) {
          throw new Error('Missing permission: control:playback');
        }
        await playerController.togglePlayPause();
        return { id: req.id, ok: true, result: null };
      }

      case 'player.next': {
        if (!hasPermission(plugin, 'control:playback')) {
          throw new Error('Missing permission: control:playback');
        }
        await playerController.next();
        return { id: req.id, ok: true, result: null };
      }

      case 'player.previous': {
        if (!hasPermission(plugin, 'control:playback')) {
          throw new Error('Missing permission: control:playback');
        }
        await playerController.previous();
        return { id: req.id, ok: true, result: null };
      }

      case 'library.getSavedCount': {
        if (!hasPermission(plugin, 'read:library')) {
          throw new Error('Missing permission: read:library');
        }
        const saved = await getSpotifyClient().getSavedTracks(1, 0);
        return { id: req.id, ok: true, result: saved.total };
      }

      case 'settings.get': {
        return { id: req.id, ok: true, result: plugin.settings[req.key] };
      }

      case 'ui.renderSlot': {
        if (!hasPermission(plugin, 'ui:slot')) {
          throw new Error('Missing permission: ui:slot');
        }
        usePluginStore.getState().setSlotOutput(plugin.manifest.id, req.payload);
        return { id: req.id, ok: true, result: null };
      }

      case 'ui.registerCommand': {
        if (!hasPermission(plugin, 'ui:command')) {
          throw new Error('Missing permission: ui:command');
        }
        usePluginStore.getState().registerPluginCommand(plugin.manifest.id, req.command);
        return { id: req.id, ok: true, result: null };
      }

      case 'network.fetchJson': {
        const parsedUrl = new URL(req.url);
        if (parsedUrl.protocol !== 'https:') {
          throw new Error('Plugin network requests must use HTTPS');
        }
        if (
          parsedUrl.hostname.endsWith('spotify.com') ||
          parsedUrl.hostname.endsWith('scdn.co')
        ) {
          throw new Error('Direct Spotify domain requests from plugins are prohibited');
        }
        const permKey = `network:${parsedUrl.hostname.toLowerCase()}`;
        if (!hasPermission(plugin, permKey)) {
          throw new Error(`Missing permission: ${permKey}`);
        }
        // Explicitly send anonymous fetch with credentials omitted (never leaks cookies/tokens)
        const res = await fetch(parsedUrl.toString(), { credentials: 'omit' });
        const json: unknown = await res.json();
        return { id: req.id, ok: true, result: json };
      }
    }
  } catch (err) {
    return {
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : 'RPC error',
    };
  }
}

const activeWorkers = new Map<string, { worker: Worker; unsubscribePlayer: () => void }>();

export function startSandboxedPluginWorker(pluginId: string): void {
  stopSandboxedPluginWorker(pluginId);

  const plugin = usePluginStore.getState().plugins[pluginId];
  if (!plugin || !plugin.enabled || typeof Worker === 'undefined') {
    return;
  }

  const blob = new Blob([plugin.workerSource], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  const worker = new Worker(blobUrl, { name: `pulse-plugin:${plugin.manifest.id}` });
  URL.revokeObjectURL(blobUrl);

  worker.onmessage = (event: MessageEvent<PluginRpcRequest>) => {
    const latestPlugin = usePluginStore.getState().plugins[pluginId];
    if (!latestPlugin || !latestPlugin.enabled) {
      return;
    }
    void handlePluginRpcRequest(latestPlugin, event.data).then((res) => {
      worker.postMessage(res);
    });
  };

  const settingsInit: HostToPluginEvent = {
    event: 'settings.changed',
    settings: plugin.settings,
  };
  worker.postMessage(settingsInit);

  const initialSnap: HostToPluginEvent = {
    event: 'player.changed',
    snapshot: buildPlayerSnapshotForPlugin(),
  };
  worker.postMessage(initialSnap);

  const unsubscribePlayer = usePlayerStore.subscribe(() => {
    const latest = usePluginStore.getState().plugins[pluginId];
    if (latest?.enabled && hasPermission(latest, 'read:player')) {
      const evt: HostToPluginEvent = {
        event: 'player.changed',
        snapshot: buildPlayerSnapshotForPlugin(),
      };
      worker.postMessage(evt);
    }
  });

  activeWorkers.set(pluginId, { worker, unsubscribePlayer });
}

export function notifyPluginSettingsChanged(pluginId: string): void {
  const running = activeWorkers.get(pluginId);
  const plugin = usePluginStore.getState().plugins[pluginId];
  if (running && plugin) {
    const evt: HostToPluginEvent = {
      event: 'settings.changed',
      settings: plugin.settings,
    };
    running.worker.postMessage(evt);
  }
}

export function invokePluginCommand(pluginId: string, commandId: string): void {
  const running = activeWorkers.get(pluginId);
  if (running) {
    const evt: HostToPluginEvent = {
      event: 'command.invoked',
      commandId,
    };
    running.worker.postMessage(evt);
  }
}

export function stopSandboxedPluginWorker(pluginId: string): void {
  const existing = activeWorkers.get(pluginId);
  if (existing) {
    existing.unsubscribePlayer();
    existing.worker.terminate();
    activeWorkers.delete(pluginId);
  }
  usePluginStore.getState().clearPluginOutputs(pluginId);
}
