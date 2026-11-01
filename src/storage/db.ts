import Dexie, { type EntityTable } from 'dexie';
import type { ThemePack } from '@/features/themes/themeEngine';

export interface ApiCacheEntry {
  cacheKey: string;
  payload: unknown;
  cachedAt: number;
  staleAt: number;
  expiresAt: number;
  etag?: string;
}

export interface ListeningHistoryItem {
  id?: number;
  trackUri: string;
  trackName: string;
  artistNames: string[];
  albumName: string;
  playedAtIso: string;
  durationPlayedMs: number;
}

export interface SmartPlaylistRecord {
  id: string;
  name: string;
  description: string;
  rulesJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface ThemePackRecord extends ThemePack {
  updatedAt: number;
}

export interface CapabilityProbeRecord {
  capabilityId: string;
  status: 'available' | 'degraded' | 'unknown';
  httpStatus?: number;
  reason?: string;
  checkedAt: number;
}

export interface LocalTrackRecord {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  audioBlob?: Blob;
  audioUrl?: string;
  coverUrl?: string;
  fileType: string;
  addedAt: number;
}

export class PulseDatabase extends Dexie {
  public apiCache!: EntityTable<ApiCacheEntry, 'cacheKey'>;
  public listeningHistory!: EntityTable<ListeningHistoryItem, 'id'>;
  public smartPlaylists!: EntityTable<SmartPlaylistRecord, 'id'>;
  public customThemes!: EntityTable<ThemePackRecord, 'id'>;
  public capabilityCache!: EntityTable<CapabilityProbeRecord, 'capabilityId'>;
  public localTracks!: EntityTable<LocalTrackRecord, 'id'>;

  public constructor() {
    super('pulse_client_db_v1');
    this.version(1).stores({
      apiCache: 'cacheKey, staleAt, expiresAt',
      listeningHistory: '++id, trackUri, playedAtIso',
      smartPlaylists: 'id, updatedAt',
      customThemes: 'id, updatedAt',
      capabilityCache: 'capabilityId, checkedAt',
    });
    this.version(2).stores({
      localTracks: 'id, title, artist, album, addedAt',
    });
  }
}

export const pulseDb = new PulseDatabase();
