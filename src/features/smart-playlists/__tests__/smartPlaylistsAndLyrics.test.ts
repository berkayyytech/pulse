import { describe, expect, it } from 'vitest';
import { DEMO_TRACK_1, DEMO_TRACK_2, DEMO_TRACK_3 } from '@/api/demoCatalog';
import { fetchOptInLyrics } from '@/features/lyrics/externalMetadataService';
import { findActiveLyricIndex, parseSyncedLrc } from '@/features/lyrics/lrcParser';
import { setExternalSourcesConfig } from '@/features/privacy/externalSourcesSettings';
import {
  evaluateSmartPlaylist,
  type SavedTrackCandidate,
} from '@/features/smart-playlists/smartPlaylistEngine';
import { serializeHistoryToCsv } from '@/features/stats/historyService';

describe('Smart Playlist Rule Engine, Synced Lyrics & Privacy Opt-In', () => {
  it('evaluates "liked in the last 30 days AND not played in 90 days" accurately', () => {
    const now = Date.parse('2026-10-25T12:00:00Z');
    const candidates: SavedTrackCandidate[] = [
      {
        // Liked 10 days ago, never played -> MATCHES
        addedAtIso: '2026-10-15T12:00:00Z',
        track: DEMO_TRACK_1,
      },
      {
        // Liked 10 days ago, played yesterday -> EXCLUDED
        addedAtIso: '2026-10-15T12:00:00Z',
        track: DEMO_TRACK_2,
      },
      {
        // Liked 60 days ago -> EXCLUDED
        addedAtIso: '2026-08-20T12:00:00Z',
        track: DEMO_TRACK_3,
      },
    ];

    const history = [
      {
        trackUri: DEMO_TRACK_2.uri,
        trackName: DEMO_TRACK_2.name,
        artistNames: ['Warm Phosphor Trio'],
        albumName: 'Analog Tape Sessions',
        playedAtIso: '2026-10-24T12:00:00Z',
        durationPlayedMs: 198_000,
      },
    ];

    const matched = evaluateSmartPlaylist(
      {
        id: 'rule_30_90',
        name: '30d Liked & 90d Unplayed',
        matchMode: 'AND',
        conditions: [
          { kind: 'likedWithinDays', days: 30 },
          { kind: 'notPlayedWithinDays', days: 90 },
        ],
      },
      candidates,
      history,
      now,
    );

    expect(matched).toHaveLength(1);
    expect(matched[0]?.uri).toBe(DEMO_TRACK_1.uri);
  });

  it('parses synced LRC timestamps and refuses external network calls when opt-in is off', async () => {
    const parsed = parseSyncedLrc('[00:12.50] Warm cathode signal\n[01:05.00] Drift into tape');
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.timeMs).toBe(12_500);
    expect(findActiveLyricIndex(parsed, 15_000)).toBe(0);
    expect(findActiveLyricIndex(parsed, 70_000)).toBe(1);

    setExternalSourcesConfig({
      lrclibEnabled: false,
      musicBrainzEnabled: false,
      coverArtArchiveEnabled: false,
      lastFmEnabled: false,
    });
    const skipped = await fetchOptInLyrics(DEMO_TRACK_1);
    expect(skipped).toBeNull();
  });

  it('exports local listening history to escaped CSV', () => {
    const csv = serializeHistoryToCsv([
      {
        trackUri: 'spotify:track:1',
        trackName: 'Song "A"',
        artistNames: ['Artist One'],
        albumName: 'Album',
        playedAtIso: '2026-10-25T00:00:00Z',
        durationPlayedMs: 180000,
      },
    ]);
    expect(csv).toContain('"Song ""A"""');
  });
});
