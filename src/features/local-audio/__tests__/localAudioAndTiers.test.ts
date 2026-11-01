import { beforeEach, describe, expect, it, vi } from 'vitest';
import { localTrackRecordToCatalogTrack } from '@/features/local-audio/localAudioService';
import { isLocalOrCuratedTrack, playerController } from '@/features/player/playerController';
import { pulseDb } from '@/storage/db';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';

describe('Local Audio & Non-Premium Account Modes', () => {
  beforeEach(async () => {
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test');
    globalThis.URL.revokeObjectURL = vi.fn();
    await pulseDb.localTracks.clear();
  });
  it('identifies curated and local tracks correctly', () => {
    const localTrack = localTrackRecordToCatalogTrack({
      id: 'local_test',
      title: 'Local Test Track',
      artist: 'Local Artist',
      album: 'Local Album',
      durationMs: 120_000,
      fileType: 'audio/mp3',
      addedAt: Date.now(),
    });
    expect(isLocalOrCuratedTrack(localTrack)).toBe(true);
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

  it('switches to html-audio engine and updates state when playing local tracks', async () => {
    await pulseDb.localTracks.put({
      id: 'local_play_test',
      title: 'Local Play',
      artist: 'Local Artist',
      album: 'Local Album',
      durationMs: 150_000,
      fileType: 'audio/mp3',
      audioBlob: new Blob(['audio-data'], { type: 'audio/mp3' }),
      addedAt: Date.now(),
    });

    const track = localTrackRecordToCatalogTrack({
      id: 'local_play_test',
      title: 'Local Play',
      artist: 'Local Artist',
      album: 'Local Album',
      durationMs: 150_000,
      fileType: 'audio/mp3',
      addedAt: Date.now(),
    });

    await playerController.playTrack(track);

    const store = usePlayerStore.getState();
    expect(store.engine).toBe('html-audio');
    expect(store.isPlaying).toBe(true);
    expect(store.currentTrack?.uri).toBe(track.uri);
  });

  it('stops html-audio engine immediately when switching from local track to Spotify track', async () => {
    // 1. Play local track
    await pulseDb.localTracks.put({
      id: 'local_switch_1',
      title: 'Local Switch',
      artist: 'Local Artist',
      album: 'Local Album',
      durationMs: 150_000,
      fileType: 'audio/mp3',
      audioBlob: new Blob(['audio-data'], { type: 'audio/mp3' }),
      addedAt: Date.now(),
    });

    const localTrack = localTrackRecordToCatalogTrack({
      id: 'local_switch_1',
      title: 'Local Switch',
      artist: 'Local Artist',
      album: 'Local Album',
      durationMs: 150_000,
      fileType: 'audio/mp3',
      addedAt: Date.now(),
    });
    await playerController.playTrack(localTrack);
    expect(usePlayerStore.getState().engine).toBe('html-audio');

    // 2. Switch to real Spotify track
    const spotifyTrack = {
      id: 'spot-switch-1',
      name: 'Drake - Rich Flex',
      uri: 'spotify:track:1234567890123456789012',
      duration_ms: 239_000,
      explicit: true,
      disc_number: 1,
      track_number: 1,
      is_local: false,
      artists: [
        {
          id: 'art-drake',
          name: 'Drake',
          uri: 'spotify:artist:drake',
          href: null,
          external_urls: {},
        },
      ],
      album: {
        id: 'alb-switch-1',
        name: 'Her Loss',
        album_type: 'album' as const,
        total_tracks: 16,
        release_date: '2022-11-04',
        release_date_precision: 'day' as const,
        uri: 'spotify:album:herloss',
        href: null,
        images: [],
        artists: [],
        external_urls: {},
      },
      external_urls: {},
      type: 'track' as const,
    };

    await playerController.playTrack(spotifyTrack);
    const updatedStore = usePlayerStore.getState();
    // Engine must NO LONGER be html-audio, and currentTrack must be the Spotify track
    expect(updatedStore.engine).not.toBe('html-audio');
    expect(updatedStore.currentTrack?.uri).toBe(spotifyTrack.uri);
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
