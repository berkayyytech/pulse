import type { Track } from '@/api/schemas/catalog';
import type { SimplifiedPlaylist } from '@/api/schemas/playlist';
import {
  CURATED_OPEN_TRACKS,
  localTrackRecordToCatalogTrack,
} from '@/features/local-audio/localAudioService';
import { scheduleDesktopSettingsSave } from '@/platform/desktopSettingsSync';
import { pulseDb, type CustomPlaylistRecord } from '@/storage/db';
import { useAchievementStore } from '@/stores/achievementStore';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generatePlaylistCoverSvg(name: string, trackCount = 0): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 60) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="pgrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${hue1}, 82%, 52%)" />
        <stop offset="100%" stop-color="hsl(${hue2}, 85%, 28%)" />
      </linearGradient>
      <radialGradient id="pglow" cx="50%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.6"/>
      </radialGradient>
    </defs>
    <rect width="400" height="400" rx="36" fill="url(#pgrad)" />
    <rect width="400" height="400" rx="36" fill="url(#pglow)" />
    <circle cx="200" cy="170" r="64" stroke="#ffffff" stroke-opacity="0.38" stroke-width="4" fill="none"/>
    <path d="M185 145 L225 170 L185 195 Z" fill="#ffffff" fill-opacity="0.9" />
    <text x="200" y="285" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700" letter-spacing="0.5" opacity="0.95">${escapeXml(name.slice(0, 24))}</text>
    <text x="200" y="318" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" opacity="0.75">${trackCount} ${trackCount === 1 ? 'Track' : 'Tracks'}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function getAllCustomPlaylists(): Promise<CustomPlaylistRecord[]> {
  return await pulseDb.customPlaylists.orderBy('createdAt').reverse().toArray();
}

export async function getCustomPlaylist(id: string): Promise<CustomPlaylistRecord | undefined> {
  return await pulseDb.customPlaylists.get(id);
}

export async function createCustomPlaylist(
  name: string,
  description = '',
  initialTrackUris: string[] = [],
): Promise<CustomPlaylistRecord> {
  const safeName = name.trim() || 'My Playlist';
  const id = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const coverUrl = generatePlaylistCoverSvg(safeName, initialTrackUris.length);

  const record: CustomPlaylistRecord = {
    id,
    name: safeName,
    description: description.trim(),
    coverUrl,
    trackUris: [...initialTrackUris],
    createdAt: now,
    updatedAt: now,
  };

  await pulseDb.customPlaylists.put(record);
  scheduleDesktopSettingsSave();
  useAchievementStore.getState().incrementMetric('smartPlaylistsCreated', 1);

  return record;
}

export async function deleteCustomPlaylist(id: string): Promise<void> {
  await pulseDb.customPlaylists.delete(id);
  scheduleDesktopSettingsSave();
}

export async function renameCustomPlaylist(
  id: string,
  name: string,
  description?: string,
): Promise<void> {
  const existing = await pulseDb.customPlaylists.get(id);
  if (!existing) return;

  const updatedName = name.trim() || existing.name;
  const coverUrl = generatePlaylistCoverSvg(updatedName, existing.trackUris.length);

  const updatedDesc = description !== undefined ? description.trim() : (existing.description ?? '');

  await pulseDb.customPlaylists.update(id, {
    name: updatedName,
    description: updatedDesc,
    coverUrl,
    updatedAt: Date.now(),
  });
  scheduleDesktopSettingsSave();
}

export async function addTrackToCustomPlaylist(playlistId: string, trackUri: string): Promise<void> {
  const playlist = await pulseDb.customPlaylists.get(playlistId);
  if (!playlist) return;

  const currentUris = playlist.trackUris;
  if (currentUris.includes(trackUri)) {
    return; // Already in playlist
  }

  const updatedUris = [...currentUris, trackUri];
  const coverUrl = generatePlaylistCoverSvg(playlist.name, updatedUris.length);

  await pulseDb.customPlaylists.update(playlistId, {
    trackUris: updatedUris,
    coverUrl,
    updatedAt: Date.now(),
  });
  scheduleDesktopSettingsSave();
}

export async function removeTrackFromCustomPlaylist(
  playlistId: string,
  trackUriOrIndex: string | number,
): Promise<void> {
  const playlist = await pulseDb.customPlaylists.get(playlistId);
  if (!playlist) return;

  let updatedUris: string[];
  if (typeof trackUriOrIndex === 'number') {
    updatedUris = playlist.trackUris.filter((_, idx) => idx !== trackUriOrIndex);
  } else {
    updatedUris = playlist.trackUris.filter((u) => u !== trackUriOrIndex);
  }

  const coverUrl = generatePlaylistCoverSvg(playlist.name, updatedUris.length);
  await pulseDb.customPlaylists.update(playlistId, {
    trackUris: updatedUris,
    coverUrl,
    updatedAt: Date.now(),
  });
  scheduleDesktopSettingsSave();
}

export async function resolveCustomPlaylistTracks(playlist: CustomPlaylistRecord): Promise<Track[]> {
  const uris = playlist.trackUris;
  if (uris.length === 0) return [];

  const localRecords = await pulseDb.localTracks.toArray();
  const localMap = new Map<string, Track>();
  for (const rec of localRecords) {
    const track = localTrackRecordToCatalogTrack(rec);
    localMap.set(track.uri, track);
    localMap.set(rec.id, track);
  }

  const curatedMap = new Map<string, Track>();
  for (const track of CURATED_OPEN_TRACKS) {
    curatedMap.set(track.uri, track);
    if (track.id) {
      curatedMap.set(track.id, track);
    }
  }

  const resolved: Track[] = [];
  for (const uri of uris) {
    const fromLocal = localMap.get(uri);
    if (fromLocal) {
      resolved.push(fromLocal);
      continue;
    }
    const fromCurated = curatedMap.get(uri);
    if (fromCurated) {
      resolved.push(fromCurated);
      continue;
    }
    // Fallback minimal track placeholder if file was removed
    resolved.push({
      id: uri,
      name: uri.replace(/^pulse:(local|curated):/, ''),
      uri,
      duration_ms: 180_000,
      explicit: false,
      disc_number: 1,
      track_number: resolved.length + 1,
      is_local: true,
      artists: [{ id: 'local-artist', name: 'Unknown Artist', uri: 'pulse:artist:unknown', href: null, external_urls: {} }],
      album: {
        id: 'local-album',
        name: 'Local Collection',
        album_type: 'album',
        total_tracks: 1,
        release_date: '2026-01-01',
        release_date_precision: 'day',
        uri: 'pulse:album:local',
        href: null,
        images: [{ url: generatePlaylistCoverSvg(uri, 1), height: 400, width: 400 }],
        artists: [],
        external_urls: {},
      },
      external_urls: {},
      type: 'track',
    });
  }

  return resolved;
}

export function customPlaylistToSimplified(record: CustomPlaylistRecord): SimplifiedPlaylist {
  const cover = record.coverUrl || generatePlaylistCoverSvg(record.name, record.trackUris.length);
  return {
    id: record.id,
    name: record.name,
    description: record.description || '',
    collaborative: false,
    public: true,
    snapshot_id: `${record.updatedAt}`,
    uri: `pulse:playlist:${record.id}`,
    images: [{ url: cover, height: 400, width: 400 }],
    owner: {
      id: 'pulse-local-user',
      display_name: 'You (Local Offline)',
      uri: 'pulse:user:local',
    },
    itemsSummary: { href: '', total: record.trackUris.length },
    usedLegacyTracksSummary: false,
    external_urls: {},
  };
}
