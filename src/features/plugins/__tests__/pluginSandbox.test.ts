import { describe, expect, it } from 'vitest';
import {
  EXAMPLE_STUDIO_TIMECODE_MANIFEST,
  EXAMPLE_STUDIO_TIMECODE_WORKER_SOURCE,
  handlePluginRpcRequest,
} from '@/features/plugins/pluginSandboxHost';
import { usePluginStore, type InstalledPluginState } from '@/stores/pluginStore';

const restrictedPlugin: InstalledPluginState = {
  manifest: EXAMPLE_STUDIO_TIMECODE_MANIFEST,
  workerSource: EXAMPLE_STUDIO_TIMECODE_WORKER_SOURCE,
  approvedPermissions: ['read:player', 'ui:slot'],
  enabled: true,
  settings: { prefix: 'REM' },
};

describe('Plugin Worker Sandbox RPC Permission Gate', () => {
  it('allows approved slot/player reads and blocks unapproved playback or Spotify network calls', async () => {
    const readRes = await handlePluginRpcRequest(restrictedPlugin, {
      id: 'req_1',
      method: 'player.getState',
    });
    expect(readRes.ok).toBe(true);

    const slotRes = await handlePluginRpcRequest(restrictedPlugin, {
      id: 'req_2',
      method: 'ui.renderSlot',
      payload: { slot: 'now-playing-badge', text: 'REM -02:14', tone: 'signal' },
    });
    expect(slotRes.ok).toBe(true);
    expect(usePluginStore.getState().slotOutputs['now-playing-badge'][0]?.text).toBe('REM -02:14');

    const deniedControl = await handlePluginRpcRequest(restrictedPlugin, {
      id: 'req_3',
      method: 'player.togglePlay',
    });
    expect(deniedControl.ok).toBe(false);
    if (!deniedControl.ok) {
      expect(deniedControl.error).toContain('control:playback');
    }

    const deniedSpotifyFetch = await handlePluginRpcRequest(
      {
        ...restrictedPlugin,
        approvedPermissions: ['network:api.spotify.com'],
      },
      {
        id: 'req_4',
        method: 'network.fetchJson',
        url: 'https://api.spotify.com/v1/me',
      },
    );
    expect(deniedSpotifyFetch.ok).toBe(false);
  });
});
