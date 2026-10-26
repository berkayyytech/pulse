import type { Track } from '@/api/schemas/catalog';
import { scheduleDesktopSettingsSave } from '@/platform/desktopSettingsSync';
import { pulseDb, type ListeningHistoryItem } from '@/storage/db';

const HISTORY_OPT_IN_KEY = 'pulse.privacy.listeningHistoryOptIn';

export function isListeningHistoryEnabled(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return localStorage.getItem(HISTORY_OPT_IN_KEY) === 'true';
}

export function setListeningHistoryEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(HISTORY_OPT_IN_KEY, String(enabled));
  scheduleDesktopSettingsSave();
}

export async function recordListenIfEnabled(
  track: Track,
  durationPlayedMs: number,
  playedAtIso: string = new Date().toISOString(),
): Promise<void> {
  if (!isListeningHistoryEnabled()) {
    return;
  }
  await pulseDb.listeningHistory.add({
    trackUri: track.uri,
    trackName: track.name,
    artistNames: track.artists.map((a) => a.name),
    albumName: track.album?.name ?? 'Unknown Album',
    playedAtIso,
    durationPlayedMs: Math.max(0, Math.round(durationPlayedMs)),
  });
}

export async function getAllListeningHistory(): Promise<ListeningHistoryItem[]> {
  return await pulseDb.listeningHistory.orderBy('playedAtIso').reverse().toArray();
}

export function serializeHistoryToCsv(items: readonly ListeningHistoryItem[]): string {
  const escapeCsv = (val: string) => `"${val.replaceAll('"', '""')}"`;
  const header = 'playedAtIso,trackUri,trackName,artists,albumName,durationPlayedMs';
  const rows = items.map((item) =>
    [
      escapeCsv(item.playedAtIso),
      escapeCsv(item.trackUri),
      escapeCsv(item.trackName),
      escapeCsv(item.artistNames.join('; ')),
      escapeCsv(item.albumName),
      String(item.durationPlayedMs),
    ].join(','),
  );
  return [header, ...rows].join('\n');
}
