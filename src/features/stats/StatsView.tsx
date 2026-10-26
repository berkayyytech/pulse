import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { getSpotifyClient } from '@/api/clientInstance';
import { pulseDb, type ListeningHistoryItem } from '@/storage/db';
import { useAuthStore } from '@/stores/authStore';
import {
  getAllListeningHistory,
  isListeningHistoryEnabled,
  serializeHistoryToCsv,
  setListeningHistoryEnabled,
} from './historyService';

function triggerTextDownload(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StatsView() {
  const authStatus = useAuthStore((s) => s.status);
  const isConnected = authStatus === 'authenticated' || authStatus === 'demo';

  const [optIn, setOptIn] = useState<boolean>(() => isListeningHistoryEnabled());
  const [history, setHistory] = useState<ListeningHistoryItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const reloadHistory = useCallback(async () => {
    const items = await getAllListeningHistory();
    setHistory(items);
  }, []);

  useEffect(() => {
    void reloadHistory();
  }, [reloadHistory]);

  const handleSyncRecentFromSpotify = async () => {
    if (!optIn || !isConnected) {
      return;
    }
    const recent = await getSpotifyClient().getRecentlyPlayed(50);
    for (const entry of recent.items) {
      await pulseDb.listeningHistory.add({
        trackUri: entry.track.uri,
        trackName: entry.track.name,
        artistNames: entry.track.artists.map((a) => a.name),
        albumName: entry.track.album?.name ?? 'Unknown Album',
        playedAtIso: entry.played_at,
        durationPlayedMs: entry.track.duration_ms,
      });
    }
    await reloadHistory();
    setNotice(`Imported ${recent.items.length} recent plays locally.`);
  };

  const totalMinutes = Math.round(
    history.reduce((sum, item) => sum + item.durationPlayedMs, 0) / 60_000,
  );

  const topTracksMap = new Map<string, { name: string; count: number }>();
  const topArtistsMap = new Map<string, number>();

  for (const item of history) {
    const prev = topTracksMap.get(item.trackUri) ?? { name: item.trackName, count: 0 };
    topTracksMap.set(item.trackUri, { name: item.trackName, count: prev.count + 1 });
    for (const artist of item.artistNames) {
      topArtistsMap.set(artist, (topArtistsMap.get(artist) ?? 0) + 1);
    }
  }

  const topTracks = Array.from(topTracksMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const topArtists = Array.from(topArtistsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <section aria-labelledby="stats-heading">
      <h1 id="stats-heading" style={{ fontFamily: 'var(--pulse-font-display)', marginTop: 0 }}>
        Local Listening History & Stats
      </h1>
      <p style={{ color: 'var(--pulse-color-text-secondary)', maxWidth: '68ch' }}>
        Your listening log never leaves your device. Enable opt-in recording below to track play
        counts, power Smart Playlists, and export your full history as JSON or CSV any time.
      </p>

      {notice ? (
        <p role="status" style={{ color: 'var(--pulse-color-signal)' }}>
          {notice}
        </p>
      ) : null}

      <article className="pulse-card" style={{ marginBottom: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={optIn}
              onChange={(e) => {
                setOptIn(e.target.checked);
                setListeningHistoryEnabled(e.target.checked);
              }}
            />
            <span>Enable local listening history & statistics (Opt-In)</span>
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              disabled={!optIn || !isConnected}
              onClick={() => {
                void handleSyncRecentFromSpotify();
              }}
              className="pulse-mono-pill"
              data-tone="signal"
              style={{ cursor: optIn && isConnected ? 'pointer' : 'not-allowed' }}
            >
              <RefreshCw size={13} />
              <span>Seed from Spotify Recently Played</span>
            </button>

            <button
              type="button"
              disabled={history.length === 0}
              onClick={() => {
                triggerTextDownload(
                  'pulse-listening-history.json',
                  'application/json',
                  JSON.stringify(history, null, 2),
                );
              }}
              className="pulse-mono-pill"
              style={{ cursor: 'pointer' }}
            >
              <Download size={13} />
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              disabled={history.length === 0}
              onClick={() => {
                triggerTextDownload(
                  'pulse-listening-history.csv',
                  'text/csv;charset=utf-8',
                  serializeHistoryToCsv(history),
                );
              }}
              className="pulse-mono-pill"
              style={{ cursor: 'pointer' }}
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </article>

      <div className="pulse-card-grid">
        <article className="pulse-card">
          <h2 style={{ fontSize: '0.95rem', marginTop: 0 }}>Overview</h2>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--pulse-font-mono)', fontWeight: 700, color: 'var(--pulse-color-accent)' }}>
            {totalMinutes.toLocaleString()} min
          </div>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--pulse-color-text-secondary)' }}>
            Across {history.length.toLocaleString()} locally logged plays
          </p>
        </article>

        <article className="pulse-card">
          <h2 style={{ fontSize: '0.95rem', marginTop: 0 }}>Top Local Tracks</h2>
          {topTracks.length === 0 ? (
            <p style={{ color: 'var(--pulse-color-text-muted)', fontSize: '0.85rem' }}>
              No local plays logged yet.
            </p>
          ) : (
            <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {topTracks.map((tItem) => (
                <li key={tItem.name}>
                  {tItem.name} <small>({tItem.count}×)</small>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className="pulse-card">
          <h2 style={{ fontSize: '0.95rem', marginTop: 0 }}>Top Local Artists</h2>
          {topArtists.length === 0 ? (
            <p style={{ color: 'var(--pulse-color-text-muted)', fontSize: '0.85rem' }}>
              No local plays logged yet.
            </p>
          ) : (
            <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {topArtists.map(([artist, count]) => (
                <li key={artist}>
                  {artist} <small>({count}×)</small>
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>
    </section>
  );
}
