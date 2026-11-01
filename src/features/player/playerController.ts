import { getSpotifyClient } from '@/api/clientInstance';
import type { Track } from '@/api/schemas/catalog';
import type { RepeatMode } from '@/api/spotifyClient';
import {
  CURATED_AUDIO_URLS,
  getAudioUrlForLocalTrack,
  getCuratedAndLocalTracks,
} from '@/features/local-audio/localAudioService';
import { recordListenIfEnabled } from '@/features/stats/historyService';
import { useAchievementStore } from '@/stores/achievementStore';
import { useAuthStore } from '@/stores/authStore';
import { useCapabilityStore } from '@/stores/capabilityStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueueStore } from '@/stores/queueStore';
import { htmlAudioEngine } from './htmlAudioEngine';
import { getActiveSdkPlayer } from './webPlaybackSdk';

export function isLocalOrCuratedTrack(track: Track | null): boolean {
  if (!track) return false;
  return (
    track.is_local ||
    track.uri.startsWith('pulse:local:') ||
    track.uri.startsWith('pulse:curated:') ||
    track.uri.startsWith('pulse:demo:')
  );
}

export const playerController = {
  async refreshPlaybackState(): Promise<void> {
    const store = usePlayerStore.getState();
    if (store.engine === 'html-audio' && isLocalOrCuratedTrack(store.currentTrack)) {
      return;
    }

    const client = getSpotifyClient();
    const [playback, devices] = await Promise.all([
      client.getPlaybackState().catch(() => null),
      client.getAvailableDevices().catch(() => []),
    ]);

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
    const store = usePlayerStore.getState();
    const previousTrack = store.currentTrack;

    if (previousTrack && store.positionMs >= 30_000) {
      void recordListenIfEnabled(previousTrack, store.positionMs);
    }
    if (previousTrack && previousTrack.duration_ms > 0 && store.positionMs >= previousTrack.duration_ms * 0.85) {
      useAchievementStore.getState().recordTrackCompleted();
    }

    // Branch 1: Local Audio or Curated Open Audio track
    if (isLocalOrCuratedTrack(track)) {
      store.setEngine('html-audio');

      // Stop any active Spotify SDK playback
      const sdk = getActiveSdkPlayer();
      if (sdk && store.sdkReady) {
        try {
          await sdk.togglePlay();
        } catch {
          // ignore
        }
      }

      store.setPlaybackSnapshot({
        currentTrack: track,
        isPlaying: true,
        positionMs: 0,
      });

      if (track.uri.startsWith('pulse:curated:')) {
        const streamUrl = CURATED_AUDIO_URLS[track.uri];
        if (streamUrl) {
          await htmlAudioEngine.playUrl(streamUrl, 0);
        } else {
          htmlAudioEngine.playProcedural();
        }
      } else if (track.uri.startsWith('pulse:local:')) {
        const trackId = track.id ?? track.uri.replace('pulse:local:', '');
        const blobUrl = await getAudioUrlForLocalTrack(trackId);
        if (blobUrl) {
          await htmlAudioEngine.playUrl(blobUrl, 0);
        } else {
          htmlAudioEngine.playProcedural();
        }
      } else {
        htmlAudioEngine.playProcedural();
      }

      useAchievementStore.getState().recordTrackStarted({
        uri: track.uri,
        artistNames: track.artists.map((a) => a.name),
        durationMs: track.duration_ms,
      });
      return;
    }

    // Branch 2: Spotify Track Playback
    // Stop local HTML5 engine if running
    htmlAudioEngine.stop();

    const authTier = useAuthStore.getState().accountTier;
    const client = getSpotifyClient();

    // If Spotify Free user: cannot use Web Playback SDK in-app. Must route to Spotify Connect device
    if (authTier === 'spotify-free') {
      const activeDev = store.activeDevice ?? store.availableDevices[0];
      if (!activeDev?.id) {
        useCapabilityStore.getState().pushAlert({
          id: 'spotify-free-open-client',
          kind: '403-degraded',
          message:
            'Spotify Free Companion Mode: Open Spotify on your desktop or phone to remote-control playback from Pulse.',
        });
        store.setPlaybackSnapshot({ currentTrack: track, isPlaying: false });
        return;
      }

      store.setEngine('connect-remote');
      if (contextUri) {
        await client.play({
          deviceId: activeDev.id,
          contextUri,
          offsetUri: track.uri,
        });
      } else {
        await client.play({
          deviceId: activeDev.id,
          uris: [track.uri],
        });
      }
      store.setPlaybackSnapshot({
        currentTrack: track,
        isPlaying: true,
        positionMs: 0,
        activeDevice: activeDev,
      });
      useAchievementStore.getState().recordTrackStarted({
        uri: track.uri,
        artistNames: track.artists.map((a) => a.name),
        durationMs: track.duration_ms,
      });
      return;
    }

    // Branch 3: Standard Spotify Premium SDK or Connect
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

    if (store.engine === 'html-audio' || isLocalOrCuratedTrack(store.currentTrack)) {
      if (store.isPlaying) {
        htmlAudioEngine.pause();
      } else {
        await htmlAudioEngine.resume();
      }
      return;
    }

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

    if (store.engine === 'html-audio' || isLocalOrCuratedTrack(store.currentTrack)) {
      const localList = await getCuratedAndLocalTracks();
      if (localList.length === 0) return;

      if (store.repeatMode === 'track' && store.currentTrack) {
        await this.playTrack(store.currentTrack);
        return;
      }

      if (store.shuffle) {
        const randomIndex = Math.floor(Math.random() * localList.length);
        const nextTrack = localList[randomIndex];
        if (nextTrack) {
          await this.playTrack(nextTrack);
          return;
        }
      }

      const currentIndex = localList.findIndex((t) => t.uri === store.currentTrack?.uri);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % localList.length : 0;
      const nextTrack = localList[nextIndex];
      if (nextTrack) {
        await this.playTrack(nextTrack);
      }
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

    if (store.engine === 'html-audio' || isLocalOrCuratedTrack(store.currentTrack)) {
      if (store.positionMs > 3000) {
        await this.seekTo(0);
        return;
      }
      const localList = await getCuratedAndLocalTracks();
      if (localList.length === 0) return;
      const currentIndex = localList.findIndex((t) => t.uri === store.currentTrack?.uri);
      const prevIndex =
        currentIndex > 0 ? currentIndex - 1 : localList.length - 1;
      const prevTrack = localList[prevIndex];
      if (prevTrack) {
        await this.playTrack(prevTrack);
      }
      return;
    }

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

    if (store.engine === 'html-audio' || isLocalOrCuratedTrack(store.currentTrack)) {
      htmlAudioEngine.seek(clamped);
      return;
    }

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

    if (store.engine === 'html-audio') {
      htmlAudioEngine.setVolume(clamped / 100);
      return;
    }

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

    if (store.engine !== 'html-audio' && !isLocalOrCuratedTrack(store.currentTrack)) {
      await getSpotifyClient().setShuffle(nextState, store.activeDevice?.id ?? undefined);
    }
  },

  async cycleRepeatMode(): Promise<void> {
    useAchievementStore.getState().incrementMetric('repeatCycles', 1);
    const store = usePlayerStore.getState();
    const order: readonly RepeatMode[] = ['off', 'context', 'track'];
    const idx = order.indexOf(store.repeatMode);
    const nextMode = order[(idx + 1) % order.length] ?? 'off';
    store.setPlaybackSnapshot({ repeatMode: nextMode });

    if (store.engine !== 'html-audio' && !isLocalOrCuratedTrack(store.currentTrack)) {
      await getSpotifyClient().setRepeatMode(nextMode, store.activeDevice?.id ?? undefined);
    }
  },

  async transferToDevice(deviceId: string): Promise<void> {
    const store = usePlayerStore.getState();
    if (deviceId === 'pulse-local-audio') {
      store.setEngine('html-audio');
      store.setPlaybackSnapshot({
        activeDevice: {
          id: 'pulse-local-audio',
          name: 'Pulse Local Audio Player',
          type: 'Computer',
          is_active: true,
          is_private_session: false,
          is_restricted: false,
          volume_percent: store.volumePercent,
          supports_volume: true,
        },
      });
      return;
    }
    await getSpotifyClient().transferPlayback(deviceId, store.isPlaying);
    store.setEngine(deviceId === store.sdkDeviceId ? 'sdk' : 'connect-remote');
    await this.refreshPlaybackState();
  },
};

// Wire htmlAudioEngine auto-advance on track completion
htmlAudioEngine.setOnTrackEnded(() => {
  void playerController.next();
});
