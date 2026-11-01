import type { Track } from '@/api/schemas/catalog';
import { pulseDb, type LocalTrackRecord } from '@/storage/db';

const objectUrlCache = new Map<string, string>();

/**
 * Procedural colorful SVG album art generator based on string hash.
 * Provides high-aesthetic glass covers for user files without embedded art.
 */
function generateGlassCoverSvg(title: string, artist: string): string {
  let hash = 0;
  const str = `${title}_${artist}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 55) % 360;
  const hue3 = (hue1 + 120) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${hue1}, 75%, 48%)" />
        <stop offset="50%" stop-color="hsl(${hue2}, 80%, 40%)" />
        <stop offset="100%" stop-color="hsl(${hue3}, 85%, 26%)" />
      </linearGradient>
      <radialGradient id="glow" cx="40%" cy="30%" r="65%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
      </radialGradient>
      <filter id="noise" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.08 0" />
        <feBlend in="SourceGraphic" in2="noise" mode="overlay" />
      </filter>
    </defs>
    <rect width="400" height="400" rx="32" fill="url(#g1)" />
    <rect width="400" height="400" rx="32" fill="url(#glow)" filter="url(#noise)" />
    <circle cx="200" cy="180" r="76" stroke="#ffffff" stroke-opacity="0.32" stroke-width="4" fill="none"/>
    <circle cx="200" cy="180" r="28" fill="#ffffff" fill-opacity="0.22"/>
    <text x="200" y="310" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" letter-spacing="0.5" opacity="0.95">${escapeXml(title.slice(0, 22))}</text>
    <text x="200" y="340" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" opacity="0.7">${escapeXml(artist.slice(0, 28))}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Curated Creative Commons & Royalty-Free open audio tracks.
 * Plays out-of-the-box for any user with zero Spotify account!
 */
export const CURATED_OPEN_TRACKS: readonly Track[] = [];

export const CURATED_AUDIO_URLS: Record<string, string> = {};

export function localTrackRecordToCatalogTrack(record: LocalTrackRecord): Track {
  const coverUrl = record.coverUrl || generateGlassCoverSvg(record.title, record.artist);
  return {
    id: record.id,
    name: record.title,
    uri: `pulse:local:${record.id}`,
    duration_ms: record.durationMs || 180_000,
    explicit: false,
    disc_number: 1,
    track_number: 1,
    is_local: true,
    artists: [
      {
        id: `local-artist-${encodeURIComponent(record.artist)}`,
        name: record.artist,
        uri: `pulse:artist:${encodeURIComponent(record.artist)}`,
        href: null,
        external_urls: {},
      },
    ],
    album: {
      id: `local-album-${encodeURIComponent(record.album)}`,
      name: record.album,
      album_type: 'album',
      total_tracks: 1,
      release_date: new Date(record.addedAt).toISOString().split('T')[0] ?? '2026-01-01',
      release_date_precision: 'day',
      uri: `pulse:album:${encodeURIComponent(record.album)}`,
      href: null,
      images: [
        {
          url: coverUrl,
          height: 400,
          width: 400,
        },
      ],
      artists: [],
      external_urls: {},
    },
    external_urls: {},
    type: 'track',
  };
}

/**
 * Determine audio track duration by inspecting file metadata
 */
async function inspectAudioDuration(file: File): Promise<number> {
  return new Promise<number>((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      const cleanup = () => {
        URL.revokeObjectURL(url);
      };
      audio.addEventListener('loadedmetadata', () => {
        const ms = Math.round((audio.duration || 180) * 1000);
        cleanup();
        resolve(ms > 0 ? ms : 180_000);
      });
      audio.addEventListener('error', () => {
        cleanup();
        resolve(180_000);
      });
      audio.src = url;
    } catch {
      resolve(180_000);
    }
  });
}

/**
 * Clean up file name into Title and Artist
 */
function parseFilenameMetadata(filename: string): { title: string; artist: string; album: string } {
  const base = filename.replace(/\.[^/.]+$/, '').trim();
  const splitHyphen = base.split(/\s*-\s*/);
  if (splitHyphen.length >= 2 && splitHyphen[0] && splitHyphen[1]) {
    const artist = splitHyphen[0].trim();
    const title = splitHyphen.slice(1).join(' - ').trim();
    return { title, artist, album: 'Local Files' };
  }
  return { title: base, artist: 'Local Artist', album: 'Local Files' };
}

export async function importAudioFiles(files: FileList | File[]): Promise<Track[]> {
  const list = Array.from(files);
  const imported: Track[] = [];

  for (const file of list) {
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|ogg|m4a|aac|webm)$/i.test(file.name)) {
      continue;
    }

    const { title, artist, album } = parseFilenameMetadata(file.name);
    const durationMs = await inspectAudioDuration(file);
    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const coverUrl = generateGlassCoverSvg(title, artist);

    const record: LocalTrackRecord = {
      id,
      title,
      artist,
      album,
      durationMs,
      audioBlob: file,
      coverUrl,
      fileType: file.type || 'audio/mpeg',
      addedAt: Date.now(),
    };

    await pulseDb.localTracks.put(record);
    const track = localTrackRecordToCatalogTrack(record);
    imported.push(track);

    // Cache the object URL for immediate high-speed playback
    const objUrl = URL.createObjectURL(file);
    objectUrlCache.set(id, objUrl);
  }

  return imported;
}

export async function getLocalTracks(): Promise<Track[]> {
  const records = await pulseDb.localTracks.orderBy('addedAt').reverse().toArray();
  return records.map(localTrackRecordToCatalogTrack);
}

export async function getCuratedAndLocalTracks(): Promise<Track[]> {
  return getLocalTracks();
}

export async function deleteLocalTrack(id: string): Promise<void> {
  const existingUrl = objectUrlCache.get(id);
  if (existingUrl) {
    URL.revokeObjectURL(existingUrl);
    objectUrlCache.delete(id);
  }
  await pulseDb.localTracks.delete(id);
}

export async function getAudioUrlForLocalTrack(trackId: string): Promise<string | null> {
  const cached = objectUrlCache.get(trackId);
  if (cached) {
    return cached;
  }
  const record = await pulseDb.localTracks.get(trackId);
  if (record?.audioBlob) {
    try {
      const url = URL.createObjectURL(record.audioBlob);
      objectUrlCache.set(trackId, url);
      return url;
    } catch {
      return null;
    }
  }
  return null;
}
