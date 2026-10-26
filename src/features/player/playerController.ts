import { getSpotifyClient } from '@/api/clientInstance';
import type { Track } from '@/api/schemas/catalog';
import type { RepeatMode } from '@/api/spotifyClient';
import { recordListenIfEnabled } from '@/features/stats/historyService';
import { useAchievementStore } from '@/stores/achievementStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueueStore } from '@/stores/queueStore';
import { getActiveSdkPlayer } from './webPlaybackSdk';

export const playerController = {
  async refreshPlaybackState(): Promise<void> {
    const client = getSpotifyClient();
    const [playback, devices] = await Promise.all([
      client.getPlaybackState().catch(() => null),
      client.getAvailableDevices().catch(() => []),
    ]);

    const store = usePlayerStore.getState();
    store.setAvailableDevices(devices);

    if (playback) {
      store.setPlaybackSnapshot({
        currentTrack: playback.item,
        isPlaying: playback.is_playing,
        positionMs: playback.progress_ms ?? 0,
        volumePercent: playback.device?.volume_percent ?? store.volumePercent,
        shuffle: playback.shuffle_state,
        repeatMode: playback.repeat_state,
        activeDevice: playback.device ?? null,
      });
    }
  },

  async playTrack(track: Track, contextUri?: string): Promise<void> {
    const client = getSpotifyClient();
    const store = usePlayerStore.getState();
    const previousTrack = store.currentTrack;
    if (previousTrack && store.positionMs >= 30_000) {
      void recordListenIfEnabled(previousTrack, store.positionMs);
    }
    if (previousTrack && previousTrack.duration_ms > 0 && store.positionMs >= previousTrack.duration_ms * 0.85) {
      useAchievementStore.getState().recordTrackCompleted();
    }

    const deviceId =
      store.engine === 'sdk' && store.sdkDeviceId
        ? store.sdkDeviceId
        : (store.activeDevice?.id ?? undefined);

    if (contextUri) {
      await client.play({
        ...(deviceId ? { deviceId } : {}),
        contextUri,
        offsetUri: track.uri,
      });
    } else {
      await client.play({
        ...(deviceId ? { deviceId } : {}),
        uris: [track.uri],
      });
    }

    store.setPlaybackSnapshot({
      currentTrack: track,
      isPlaying: true,
      positionMs: 0,
    });
    useAchievementStore.getState().recordTrackStarted({
      uri: track.uri,
      artistNames: track.artists.map((a) => a.name),
      durationMs: track.duration_ms,
    });
  },

  async togglePlayPause(): Promise<void> {
    useAchievementStore.getState().incrementMetric('pauseToggles', 1);
    const store = usePlayerStore.getState();
    const sdk = getActiveSdkPlayer();
    if (store.engine === 'sdk' && sdk && store.sdkReady) {
      await sdk.togglePlay();
      return;
    }

    const client = getSpotifyClient();
    if (store.isPlaying) {
      await client.pause(store.activeDevice?.id ?? undefined);
      store.setPlaybackSnapshot({ isPlaying: false });
    } else {
      await client.play(
        store.activeDevice?.id ? { deviceId: store.activeDevice.id } : undefined,
      );
      store.setPlaybackSnapshot({ isPlaying: true });
    }
  },

  async next(): Promise<void> {
    useAchievementStore.getState().incrementMetric('skipNextCount', 1);
    const store = usePlayerStore.getState();
    if (store.currentTrack && store.positionMs >= 30_000) {
      void recordListenIfEnabled(store.currentTrack, store.positionMs);
    }

    const queuedLocal = useQueueStore.getState().shiftNextTrack();
    if (queuedLocal) {
      await this.playTrack(queuedLocal);
      return;
    }

    const sdk = getActiveSdkPlayer();
    if (store.engine === 'sdk' && sdk && store.sdkReady) {
      await sdk.nextTrack();
      return;
    }

    const client = getSpotifyClient();
    await client.skipNext(store.activeDevice?.id ?? undefined);
    await this.refreshPlaybackState();
  },

  async previous(): Promise<void> {
    useAchievementStore.getState().incrementMetric('skipPrevCount', 1);
    const store = usePlayerStore.getState();
    const sdk = getActiveSdkPlayer();
    if (store.engine === 'sdk' && sdk && store.sdkReady) {
      await sdk.previousTrack();
      return;
    }

    const client = getSpotifyClient();
    await client.skipPrevious(store.activeDevice?.id ?? undefined);
    await this.refreshPlaybackState();
  },

  async seekTo(positionMs: number): Promise<void> {
    useAchievementStore.getState().incrementMetric('seekCount', 1);
    const store = usePlayerStore.getState();
    const clamped = Math.max(0, positionMs);
    store.setPlaybackSnapshot({ positionMs: clamped });

    const sdk = getActiveSdkPlayer();
    if (store.engine === 'sdk' && sdk && store.sdkReady) {
      await sdk.seek(clamped);
      return;
    }

    const client = getSpotifyClient();
    await client.seek(clamped, store.activeDevice?.id ?? undefined);
  },

  async setVolume(volumePercent: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(volumePercent)));
    useAchievementStore.getState().recordVolumeLevel(clamped);
    const store = usePlayerStore.getState();
    store.setPlaybackSnapshot({ volumePercent: clamped });

    const sdk = getActiveSdkPlayer();
    if (store.engine === 'sdk' && sdk && store.sdkReady) {
      await sdk.setVolume(clamped / 100);
      return;
    }

    const client = getSpotifyClient();
    await client.setVolume(clamped, store.activeDevice?.id ?? undefined);
  },

  async toggleShuffle(): Promise<void> {
    useAchievementStore.getState().incrementMetric('shuffleToggles', 1);
    const store = usePlayerStore.getState();
    const nextState = !store.shuffle;
    store.setPlaybackSnapshot({ shuffle: nextState });
    await getSpotifyClient().setShuffle(nextState, store.activeDevice?.id ?? undefined);
  },

  async cycleRepeatMode(): Promise<void> {
    useAchievementStore.getState().incrementMetric('repeatCycles', 1);
    const store = usePlayerStore.getState();
    const order: readonly RepeatMode[] = ['off', 'context', 'track'];
    const idx = order.indexOf(store.repeatMode);
    const nextMode = order[(idx + 1) % order.length] ?? 'off';
    store.setPlaybackSnapshot({ repeatMode: nextMode });
    await getSpotifyClient().setRepeatMode(nextMode, store.activeDevice?.id ?? undefined);
  },

  async transferToDevice(deviceId: string): Promise<void> {
    const store = usePlayerStore.getState();
    await getSpotifyClient().transferPlayback(deviceId, store.isPlaying);
    store.setEngine(deviceId === store.sdkDeviceId ? 'sdk' : 'connect-remote');
    await this.refreshPlaybackState();
  },
};
