import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CURATED_OPEN_TRACKS,
  localTrackRecordToCatalogTrack,
} from '@/features/local-audio/localAudioService';
import { isLocalOrCuratedTrack, playerController } from '@/features/player/playerController';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';

describe('Local Audio & Non-Premium Account Modes', () => {
  beforeEach(() => {
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
  });
  it('identifies curated and local tracks correctly', () => {
    expect(isLocalOrCuratedTrack(CURATED_OPEN_TRACKS[0] ?? null)).toBe(true);
    expect(isLocalOrCuratedTrack(CURATED_OPEN_TRACKS[1] ?? null)).toBe(true);
    expect(
      isLocalOrCuratedTrack({
        id: 'spot-1',
        name: 'Track',
        uri: 'spotify:track:123',
        duration_ms: 1000,
        explicit: false,
        disc_number: 1,
        track_number: 1,
        is_local: false,
        artists: [],
        album: {
          id: 'alb-1',
          name: 'Alb',
          album_type: 'album',
          total_tracks: 1,
          release_date: '',
          release_date_precision: 'day',
          uri: 'spotify:album:1',
          href: null,
          images: [],
          artists: [],
          external_urls: {},
        },
        external_urls: {},
        type: 'track',
      }),
    ).toBe(false);
  });

  it('converts LocalTrackRecord into standard Track schema with dynamic glass cover art', () => {
    const track = localTrackRecordToCatalogTrack({
      id: 'local_123',
      title: 'Summer Breeze',
      artist: 'Acoustic Project',
      album: 'Home Recordings',
      durationMs: 215_000,
      fileType: 'audio/flac',
      addedAt: Date.now(),
    });

    expect(track.id).toBe('local_123');
    expect(track.name).toBe('Summer Breeze');
    expect(track.artists[0]?.name).toBe('Acoustic Project');
    expect(track.is_local).toBe(true);
    expect(track.uri).toBe('pulse:local:local_123');
    expect(track.album?.images[0]?.url).toContain('data:image/svg+xml');
  });

  it('switches to html-audio engine and updates state when playing local or curated tracks', async () => {
    const track = CURATED_OPEN_TRACKS[0];
    expect(track).toBeDefined();
    if (!track) return;

    await playerController.playTrack(track);

    const store = usePlayerStore.getState();
    expect(store.engine).toBe('html-audio');
    expect(store.isPlaying).toBe(true);
    expect(store.currentTrack?.uri).toBe(track.uri);
  });

  it('supports accountTier persistence in useAuthStore', () => {
    useAuthStore.getState().setAccountTier('spotify-free');
    expect(useAuthStore.getState().accountTier).toBe('spotify-free');

    useAuthStore.getState().setAccountTier('local-only');
    expect(useAuthStore.getState().accountTier).toBe('local-only');

    useAuthStore.getState().setAccountTier('spotify-premium');
    expect(useAuthStore.getState().accountTier).toBe('spotify-premium');
  });
});
