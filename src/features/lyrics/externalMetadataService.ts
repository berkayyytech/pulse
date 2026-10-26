import type { Track } from '@/api/schemas/catalog';
import {
  getExternalSourcesConfig,
  getLastFmApiKey,
} from '@/features/privacy/externalSourcesSettings';
import { parseSyncedLrc, type SyncedLyricLine } from './lrcParser';

export interface LyricsLookupResult {
  readonly source: 'LRCLIB';
  readonly syncedLines: readonly SyncedLyricLine[];
  readonly plainLyrics: string | null;
}

export interface ExternalTrackMetadata {
  readonly recordLabel?: string;
  readonly isrc?: string;
  readonly coverArtArchiveUrl?: string;
  readonly sources: readonly string[];
}

export interface ExternalArtistMetadata {
  readonly sourceLabel: string;
  readonly summary: string;
}

let lastMusicBrainzCallAt = 0;

async function throttleMusicBrainz(): Promise<void> {
  const elapsed = Date.now() - lastMusicBrainzCallAt;
  if (elapsed < 1050) {
    await new Promise((r) => {
      setTimeout(r, 1050 - elapsed);
    });
  }
  lastMusicBrainzCallAt = Date.now();
}

/**
 * Fetches synced lyrics from LRCLIB ONLY if the user explicitly opted into LRCLIB.
 * Never transmits Spotify tokens or user identifiers.
 */
export async function fetchOptInLyrics(track: Track): Promise<LyricsLookupResult | null> {
  const cfg = getExternalSourcesConfig();
  if (!cfg.lrclibEnabled) {
    return null;
  }

  const url = new URL('https://lrclib.net/api/get');
  url.searchParams.set('track_name', track.name);
  url.searchParams.set('artist_name', track.artists[0]?.name ?? '');
  if (track.album?.name) {
    url.searchParams.set('album_name', track.album.name);
  }
  if (track.duration_ms > 0) {
    url.searchParams.set('duration', String(Math.round(track.duration_ms / 1000)));
  }

  try {
    const res = await fetch(url.toString(), { credentials: 'omit' });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as {
      syncedLyrics?: string | null;
      plainLyrics?: string | null;
    };
    return {
      source: 'LRCLIB',
      syncedLines: data.syncedLyrics ? parseSyncedLrc(data.syncedLyrics) : [],
      plainLyrics: data.plainLyrics ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Fills 2026 Spotify metadata gaps (such as removed `album.label` & `track.external_ids.isrc`)
 * via MusicBrainz & Cover Art Archive ONLY when opted in by the user.
 */
export async function fetchOptInTrackGapMetadata(
  track: Track,
): Promise<ExternalTrackMetadata | null> {
  const cfg = getExternalSourcesConfig();
  if (!cfg.musicBrainzEnabled) {
    return null;
  }

  await throttleMusicBrainz();
  const artistName = track.artists[0]?.name ?? '';
  const query = `recording:"${track.name}" AND artist:"${artistName}"`;
  const mbUrl = new URL('https://musicbrainz.org/ws/2/recording');
  mbUrl.searchParams.set('query', query);
  mbUrl.searchParams.set('limit', '1');
  mbUrl.searchParams.set('fmt', 'json');

  try {
    const res = await fetch(mbUrl.toString(), {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as {
      recordings?: {
        isrcs?: string[];
        releases?: { id?: string }[];
      }[];
    };
    const first = json.recordings?.[0];
    if (!first) {
      return null;
    }

    const releaseId = first.releases?.[0]?.id;
    const sources = ['MusicBrainz'];
    let coverArtArchiveUrl: string | undefined;

    if (cfg.coverArtArchiveEnabled && releaseId) {
      coverArtArchiveUrl = `https://coverartarchive.org/release/${releaseId}/front-500`;
      sources.push('Cover Art Archive');
    }

    return {
      ...(first.isrcs?.[0] ? { isrc: first.isrcs[0] } : {}),
      ...(coverArtArchiveUrl ? { coverArtArchiveUrl } : {}),
      sources,
    };
  } catch {
    return null;
  }
}

export async function fetchOptInArtistEnrichment(
  artistName: string,
): Promise<ExternalArtistMetadata | null> {
  const cfg = getExternalSourcesConfig();
  if (!cfg.lastFmEnabled) {
    return null;
  }
  const apiKey = await getLastFmApiKey();
  if (!apiKey) {
    return null;
  }

  const url = new URL('https://ws.audioscrobbler.com/2.0/');
  url.searchParams.set('method', 'artist.getinfo');
  url.searchParams.set('artist', artistName);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');

  try {
    const res = await fetch(url.toString(), { credentials: 'omit' });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as {
      artist?: { bio?: { summary?: string } };
    };
    const rawSummary = data.artist?.bio?.summary?.replace(/<[^>]*>/g, '').trim();
    if (!rawSummary) {
      return null;
    }
    return {
      sourceLabel: 'Last.fm (BYO API Key)',
      summary: rawSummary,
    };
  } catch {
    return null;
  }
}
