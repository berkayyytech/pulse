import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, FolderPlus, Trash2, X } from 'lucide-react';
import { getSpotifyClient } from '@/api/clientInstance';
import type { Track } from '@/api/schemas/catalog';
import { useAchievementStore } from '@/stores/achievementStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueueStore } from '@/stores/queueStore';

export function QueueDrawer() {
  const queueOpen = usePlayerStore((s) => s.queueOpen);
  const setQueueOpen = usePlayerStore((s) => s.setQueueOpen);
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const localItems = useQueueStore((s) => s.items);
  const moveQueueItem = useQueueStore((s) => s.moveQueueItem);
  const removeQueueIndex = useQueueStore((s) => s.removeQueueIndex);
  const clearQueue = useQueueStore((s) => s.clearQueue);

  const [remoteQueue, setRemoteQueue] = useState<Track[]>([]);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!queueOpen) {
      return;
    }
    void getSpotifyClient()
      .getQueue()
      .then((res) => {
        setRemoteQueue(res.queue);
      })
      .catch(() => {
        setRemoteQueue([]);
      });
  }, [queueOpen]);

  if (!queueOpen) {
    return null;
  }

  const combinedUris = [
    ...(currentTrack ? [currentTrack.uri] : []),
    ...localItems.map((t) => t.uri),
    ...remoteQueue.map((t) => t.uri),
  ].filter(Boolean);

  const handleSaveQueueAsPlaylist = async () => {
    if (combinedUris.length === 0) {
      return;
    }
    const client = getSpotifyClient();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const created = await client.createPlaylist({
      name: `Pulse Queue • ${dateStamp}`,
      description: 'Saved from Pulse Queue Manager',
    });
    await client.addItemsToPlaylist(created.id, combinedUris);
    useAchievementStore.getState().incrementMetric('playlistsCreated', 1);
    setSavedNotice(`Saved ${combinedUris.length} tracks to "${created.name}"`);
  };

  return (
    <aside
      aria-label="Queue manager"
      className="pulse-card"
      style={{
        position: 'fixed',
        top: '56px',
        right: '16px',
        bottom: '16px',
        width: '380px',
        maxWidth: 'calc(100vw - 2rem)',
        overflowY: 'auto',
        background: 'var(--pulse-color-bg-glass)',
        backdropFilter: 'blur(44px) saturate(160%)',
        borderRadius: '24px',
        boxShadow: 'var(--pulse-shadow-elevated)',
        zIndex: 70,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Queue Manager</h2>
        <button
          type="button"
          aria-label="Close queue manager"
          onClick={() => {
            setQueueOpen(false);
          }}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', margin: '0.75rem 0' }}>
        <button
          type="button"
          disabled={combinedUris.length === 0}
          onClick={() => {
            void handleSaveQueueAsPlaylist();
          }}
          className="pulse-mono-pill"
          data-tone="accent"
          style={{ cursor: 'pointer', padding: '0.35rem 0.75rem' }}
        >
          <FolderPlus size={14} />
          <span>Save Queue as Playlist</span>
        </button>
        {localItems.length > 0 ? (
          <button
            type="button"
            onClick={clearQueue}
            className="pulse-mono-pill"
            style={{ cursor: 'pointer', padding: '0.35rem 0.75rem' }}
          >
            Clear Up Next
          </button>
        ) : null}
      </div>

      {savedNotice ? (
        <p role="status" style={{ color: 'var(--pulse-color-signal)', fontSize: '0.84rem' }}>
          {savedNotice}
        </p>
      ) : null}

      <h3 style={{ fontSize: '0.85rem', color: 'var(--pulse-color-text-secondary)' }}>
        Up Next in Pulse (Reorderable • {localItems.length})
      </h3>
      {localItems.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: 'var(--pulse-color-text-muted)' }}>
          Select tracks in Library or Search and click Queue to reorder upcoming playback here.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {localItems.map((track, idx) => (
            <li
              key={`${track.uri}_${idx}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.4rem',
                padding: '0.4rem 0',
                borderBottom: '1px solid var(--pulse-color-border-subtle)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.88rem' }}>
                {track.name}
              </span>
              <div style={{ display: 'inline-flex', gap: '2px' }}>
                <button
                  type="button"
                  aria-label={`Move ${track.name} earlier`}
                  disabled={idx === 0}
                  onClick={() => {
                    moveQueueItem(idx, idx - 1);
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${track.name} later`}
                  disabled={idx === localItems.length - 1}
                  onClick={() => {
                    moveQueueItem(idx, idx + 1);
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${track.name} from queue`}
                  onClick={() => {
                    removeQueueIndex(idx);
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 style={{ fontSize: '0.85rem', color: 'var(--pulse-color-text-secondary)', marginTop: '1rem' }}>
        Spotify Device Queue ({remoteQueue.length})
      </h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {remoteQueue.map((track, idx) => (
          <li
            key={`remote_${track.uri}_${idx}`}
            style={{
              padding: '0.35rem 0',
              fontSize: '0.84rem',
              color: 'var(--pulse-color-text-secondary)',
              borderBottom: '1px solid var(--pulse-color-border-subtle)',
            }}
          >
            {track.name} — {track.artists.map((a) => a.name).join(', ')}
          </li>
        ))}
      </ul>
    </aside>
  );
}
