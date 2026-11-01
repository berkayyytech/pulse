import { getSpotifyClient } from '@/api/clientInstance';
import type { Track } from '@/api/schemas/catalog';
import type { RepeatMode } from '@/api/spotifyClient';
import { getAudioUrlForLocalTrack, getLocalTracks } from '@/features/local-audio/localAudioService';
import { recordListenIfEnabled } from '@/features/stats/historyService';
import { useAchievementStore } from '@/stores/achievementStore';
import { useCapabilityStore } from '@/stores/capabilityStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueueStore } from '@/stores/queueStore';
import { htmlAudioEngine } from './htmlAudioEngine';
import { getActiveSdkPlayer } from './webPlaybackSdk';

/**
 * Returns true if a track is a local or offline track that should be played
 * by the HTML audio engine instead of Spotify Connect/SDK.
 * All genuine Spotify tracks (spotify:track:*) ALWAYS return false.
 */
export function isLocalOrCuratedTrack(track: Track | null): boolean {
  if (!track) return false;
  if (track.uri.startsWith('spotify:track:') || track.uri.startsWith('spotify:episode:')) {
    return false;
  }
  return (
    track.uri.startsWith('pulse:local:') ||
    track.uri.startsWith('pulse:curated:') ||
    track.uri.startsWith('pulse:demo:') ||
    track.is_local
  );
}

export const playerController = {
  async refreshPlaybackState(): Promise<void> {
    const store = usePlayerStore.getState();
    // Do not overwrite active local audio playback with Spotify polling
    if (
      store.engine === 'html-audio' &&
      isLocalOrCuratedTrack(store.currentTrack) &&
      store.isPlaying
    ) {
      return;
    }

    const client = getSpotifyClient();
    const [playback, devices] = await Promise.all([
      client.getPlaybackState().catch(() => null),
      client.getAvailableDevices().catch(() => []),
    ]);

    store.setAvailableDevices(devices);

    if (playback && playback.item) {
      const activeDev = playback.device ?? null;
      store.setEngine(activeDev?.id === store.sdkDeviceId ? 'sdk' : 'connect-remote');
      store.setPlaybackSnapshot({
        currentTrack: playback.item,
        isPlaying: playback.is_playing,
        positionMs: playback.progress_ms ?? 0,
        volumePercent: playback.device?.volume_percent ?? store.volumePercent,
        shuffle: playback.shuffle_state,
        repeatMode: playback.repeat_state,
        activeDevice: activeDev,
      });
    }
  },

  async playTrack(track: Track, contextUri?: string): Promise<void> {
    const store = usePlayerStore.getState();
    const previousTrack = store.currentTrack;

    if (previousTrack && store.positionMs >= 30_000) {
      void recordListenIfEnabled(previousTrack, store.positionMs);
    }
    if (
      previousTrack &&
      previousTrack.duration_ms > 0 &&
      store.positionMs >= previousTrack.duration_ms * 0.85
    ) {
      useAchievementStore.getState().recordTrackCompleted();
    }

    // Always immediately update currentTrack so the UI reflects the user's selected song instantly
    store.setPlaybackSnapshot({
      currentTrack: track,
      positionMs: 0,
    });

    useAchievementStore.getState().recordTrackStarted({
      uri: track.uri,
      artistNames: track.artists.map((a) => a.name),
      durationMs: track.duration_ms,
    });

    // ==========================================
    // CASE A: LOCAL AUDIO TRACK (pulse:local:*)
    // ==========================================
    if (isLocalOrCuratedTrack(track)) {
      // Pause any active Spotify SDK playback
      const sdk = getActiveSdkPlayer();
      if (sdk && store.sdkReady && typeof sdk.pause === 'function') {
        try {
          await sdk.pause();
        } catch {
          // Ignore
        }
      } else if (store.activeDevice?.id && store.activeDevice.id !== 'pulse-local-audio') {
        getSpotifyClient()
          .pause(store.activeDevice.id)
          .catch(() => undefined);
      }

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
        isPlaying: true,
      });

      const trackId = track.id ?? track.uri.replace('pulse:local:', '');
      const blobUrl = await getAudioUrlForLocalTrack(trackId);
      if (blobUrl) {
        await htmlAudioEngine.playUrl(blobUrl, 0);
      } else {
        htmlAudioEngine.stop();
        store.setPlaybackSnapshot({ isPlaying: false });
      }
      return;
    }

    // ==========================================
    // CASE B: REAL SPOTIFY TRACK (spotify:track:*)
    // ==========================================
    // 1. Immediately STOP the HTML audio engine so local sound never leaks or overlaps
    htmlAudioEngine.stop();

    const client = getSpotifyClient();

    // 2. Query available Spotify devices
    let devices = store.availableDevices;
    try {
      devices = await client.getAvailableDevices();
      store.setAvailableDevices(devices);
    } catch {
      // Ignore network failure when discovering devices
    }

    const spotifyDevices = devices.filter((d) => d.id !== 'pulse-local-audio');

    // 3. Find target device (Pulse SDK, active device, or first available Spotify device)
    const activeDev =
      (store.sdkReady && store.sdkDeviceId
        ? {
            id: store.sdkDeviceId,
            name: 'Pulse Web Player',
            is_active: true,
            type: 'Computer',
            is_private_session: false,
            is_restricted: false,
            volume_percent: store.volumePercent,
            supports_volume: true,
          }
        : null) ??
      (store.activeDevice?.id && store.activeDevice.id !== 'pulse-local-audio'
        ? store.activeDevice
        : null) ??
      spotifyDevices.find((d) => d.is_active) ??
      spotifyDevices[0] ??
      null;

    let playedSuccessfully = false;

    if (activeDev?.id) {
      try {
        if (contextUri && !contextUri.startsWith('pulse:')) {
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
        const engine = activeDev.id === store.sdkDeviceId ? 'sdk' : 'connect-remote';
        store.setEngine(engine);
        store.setPlaybackSnapshot({
          activeDevice: activeDev,
          isPlaying: true,
          currentTrack: track,
        });
        playedSuccessfully = true;
      } catch (err) {
        console.warn('Spotify play failed on target device:', activeDev.name, err);
      }
    }

    if (!playedSuccessfully) {
      // Do NOT play procedural synth audio when the user is trying to listen to Spotify!
      store.setEngine('connect-remote');
      store.setPlaybackSnapshot({
        isPlaying: false,
        currentTrack: track,
      });

      useCapabilityStore.getState().pushAlert({
        id: 'no-active-device-fallback',
        kind: '403-degraded',
        message:
          'No active Spotify Connect player was detected. Please open Spotify on your phone, desktop app, or web browser so Pulse can stream to it!',
      });
    }
  },

  async togglePlayPause(): Promise<void> {
    useAchievementStore.getState().incrementMetric('pauseToggles', 1);
    const store = usePlayerStore.getState();

    if (!store.currentTrack) {
      const queuedLocal = useQueueStore.getState().shiftNextTrack();
      if (queuedLocal) {
        await this.playTrack(queuedLocal);
        return;
      }
      const localList = await getLocalTracks();
      const first = localList[0];
      if (first) {
        await this.playTrack(first);
      }
      return;
    }

    if (isLocalOrCuratedTrack(store.currentTrack)) {
      if (store.isPlaying) {
        htmlAudioEngine.pause();
        store.setPlaybackSnapshot({ isPlaying: false });
      } else {
        await htmlAudioEngine.resume();
        store.setPlaybackSnapshot({ isPlaying: true });
      }
      return;
    }

    // Real Spotify track
    htmlAudioEngine.stop();

    const sdk = getActiveSdkPlayer();
    if (store.engine === 'sdk' && sdk && store.sdkReady) {
      await sdk.togglePlay();
      return;
    }

    const client = getSpotifyClient();
    const deviceId =
      store.activeDevice?.id && store.activeDevice.id !== 'pulse-local-audio'
        ? store.activeDevice.id
        : undefined;

    try {
      if (store.isPlaying) {
        await client.pause(deviceId);
        store.setPlaybackSnapshot({ isPlaying: false });
      } else {
        await client.play(deviceId ? { deviceId } : undefined);
        store.setPlaybackSnapshot({ isPlaying: true });
      }
    } catch (err) {
      console.warn('Spotify play/pause toggle failed:', err);
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

    if (!store.currentTrack) {
      const localList = await getLocalTracks();
      const first = localList[0];
      if (first) {
        await this.playTrack(first);
      }
      return;
    }

    if (isLocalOrCuratedTrack(store.currentTrack)) {
      const localList = await getLocalTracks();
      if (localList.length === 0) return;

      if (store.repeatMode === 'track') {
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

    // Real Spotify track
    htmlAudioEngine.stop();
    const sdk = getActiveSdkPlayer();
    if (store.engine === 'sdk' && sdk && store.sdkReady) {
      await sdk.nextTrack();
      return;
    }

    const client = getSpotifyClient();
    const deviceId =
      store.activeDevice?.id && store.activeDevice.id !== 'pulse-local-audio'
        ? store.activeDevice.id
        : undefined;
    await client.skipNext(deviceId);
    await this.refreshPlaybackState();
  },

  async previous(): Promise<void> {
    useAchievementStore.getState().incrementMetric('skipPrevCount', 1);
    const store = usePlayerStore.getState();

    if (!store.currentTrack) {
      const localList = await getLocalTracks();
      const first = localList[0];
      if (first) {
        await this.playTrack(first);
      }
      return;
    }

    if (isLocalOrCuratedTrack(store.currentTrack)) {
      if (store.positionMs > 3000) {
        await this.seekTo(0);
        return;
      }
      const localList = await getLocalTracks();
      if (localList.length === 0) return;
      const currentIndex = localList.findIndex((t) => t.uri === store.currentTrack?.uri);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : localList.length - 1;
      const prevTrack = localList[prevIndex];
      if (prevTrack) {
        await this.playTrack(prevTrack);
      }
      return;
    }

    // Real Spotify track
    htmlAudioEngine.stop();
    const sdk = getActiveSdkPlayer();
    if (store.engine === 'sdk' && sdk && store.sdkReady) {
      await sdk.previousTrack();
      return;
    }

    const client = getSpotifyClient();
    const deviceId =
      store.activeDevice?.id && store.activeDevice.id !== 'pulse-local-audio'
        ? store.activeDevice.id
        : undefined;
    await client.skipPrevious(deviceId);
    await this.refreshPlaybackState();
  },

  async seekTo(positionMs: number): Promise<void> {
    useAchievementStore.getState().incrementMetric('seekCount', 1);
    const store = usePlayerStore.getState();
    const clamped = Math.max(0, positionMs);
    store.setPlaybackSnapshot({ positionMs: clamped });

    if (isLocalOrCuratedTrack(store.currentTrack)) {
      htmlAudioEngine.seek(clamped);
      return;
    }

    htmlAudioEngine.stop();
    const sdk = getActiveSdkPlayer();
    if (store.engine === 'sdk' && sdk && store.sdkReady) {
      await sdk.seek(clamped);
      return;
    }

    const client = getSpotifyClient();
    const deviceId =
      store.activeDevice?.id && store.activeDevice.id !== 'pulse-local-audio'
        ? store.activeDevice.id
        : undefined;
    await client.seek(clamped, deviceId);
  },

  async setVolume(volumePercent: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(volumePercent)));
    useAchievementStore.getState().recordVolumeLevel(clamped);
    const store = usePlayerStore.getState();
    store.setPlaybackSnapshot({ volumePercent: clamped });

    if (isLocalOrCuratedTrack(store.currentTrack) || store.engine === 'html-audio') {
      htmlAudioEngine.setVolume(clamped / 100);
    }

    const sdk = getActiveSdkPlayer();
    if (store.engine === 'sdk' && sdk && store.sdkReady) {
      await sdk.setVolume(clamped / 100);
      return;
    }

    if (store.activeDevice?.id && store.activeDevice.id !== 'pulse-local-audio') {
      const client = getSpotifyClient();
      await client.setVolume(clamped, store.activeDevice.id).catch(() => undefined);
    }
  },

  async toggleShuffle(): Promise<void> {
    useAchievementStore.getState().incrementMetric('shuffleToggles', 1);
    const store = usePlayerStore.getState();
    const nextState = !store.shuffle;
    store.setPlaybackSnapshot({ shuffle: nextState });

    if (store.engine !== 'html-audio' && !isLocalOrCuratedTrack(store.currentTrack)) {
      const deviceId =
        store.activeDevice?.id && store.activeDevice.id !== 'pulse-local-audio'
          ? store.activeDevice.id
          : undefined;
      await getSpotifyClient().setShuffle(nextState, deviceId);
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
      const deviceId =
        store.activeDevice?.id && store.activeDevice.id !== 'pulse-local-audio'
          ? store.activeDevice.id
          : undefined;
      await getSpotifyClient().setRepeatMode(nextMode, deviceId);
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
    try {
      await getSpotifyClient().transferPlayback(deviceId, store.isPlaying);
      store.setEngine(deviceId === store.sdkDeviceId ? 'sdk' : 'connect-remote');
      await this.refreshPlaybackState();
    } catch (err) {
      console.warn('Failed to transfer playback to device:', deviceId, err);
    }
  },

  stop(): void {
    htmlAudioEngine.stop();
    const sdk = getActiveSdkPlayer();
    const store = usePlayerStore.getState();
    if (sdk && store.isPlaying) {
      void sdk.togglePlay().catch(() => undefined);
    }
    usePlayerStore.getState().setPlaybackSnapshot({
      currentTrack: null,
      isPlaying: false,
      positionMs: 0,
    });
  },
};

// Wire htmlAudioEngine auto-advance on track completion
htmlAudioEngine.setOnTrackEnded(() => {
  void playerController.next();
});
