import { useEffect, useState } from 'react';
import { CheckCircle2, ListPlus, Plus, X } from 'lucide-react';
import type { Track } from '@/api/schemas/catalog';
import {
  addTrackToCustomPlaylist,
  getAllCustomPlaylists,
} from './customPlaylistService';
import { CreatePlaylistModal } from './CreatePlaylistModal';
import type { CustomPlaylistRecord } from '@/storage/db';

interface PlaylistSelectModalProps {
  readonly track: Track | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onUpdated?: () => void;
}

export function PlaylistSelectModal({
  track,
  isOpen,
  onClose,
  onUpdated,
}: PlaylistSelectModalProps) {
  const [playlists, setPlaylists] = useState<CustomPlaylistRecord[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;
    void getAllCustomPlaylists().then((list) => {
      setPlaylists(list);
      if (track) {
        const initialAdded: Record<string, boolean> = {};
        for (const pl of list) {
          if (pl.trackUris.includes(track.uri)) {
            initialAdded[pl.id] = true;
          }
        }
        setAddedMap(initialAdded);
      }
    });
  }, [isOpen, track]);

  if (!isOpen || !track) return null;

  const handleToggleAddToPlaylist = async (playlist: CustomPlaylistRecord) => {
    if (addedMap[playlist.id]) return;
    await addTrackToCustomPlaylist(playlist.id, track.uri);
    setAddedMap((prev) => ({ ...prev, [playlist.id]: true }));
    onUpdated?.();
  };

  return (
    <>
      <div
        className="gp-overlay-root"
        role="dialog"
        aria-modal="true"
        aria-label="Add to Playlist"
      >
        <div className="gp-overlay-dim" onClick={onClose} />
        <div
          className="pulse-card"
          style={{
            position: 'relative',
            zIndex: 10,
            width: 'min(460px, calc(100vw - 32px))',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
            background: 'var(--pulse-color-panel-solid)',
            boxShadow: 'var(--pulse-shadow-elevated)',
            border: '1px solid var(--pulse-color-border-strong)',
            borderRadius: 'var(--pulse-radius-lg)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Add to Playlist</h2>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--pulse-color-text-secondary)',
                  marginTop: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '340px',
                }}
              >
                {track.name} • {track.artists[0]?.name ?? 'Unknown'}
              </div>
            </div>
            <button
              type="button"
              className="gp-round-btn"
              style={{ width: '30px', height: '30px' }}
              onClick={onClose}
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>

          <button
            type="button"
            className="pulse-nav-btn"
            style={{
              marginBottom: '12px',
              justifyContent: 'center',
              gap: '6px',
              fontWeight: 600,
              background: 'var(--pulse-color-bg-elevated)',
              border: '1px dashed var(--pulse-color-border-strong)',
            }}
            onClick={() => { setCreateModalOpen(true); }}
          >
            <Plus size={15} color="var(--pulse-color-accent)" />
            <span>Create New Playlist</span>
          </button>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'grid',
              gap: '6px',
              paddingRight: '4px',
            }}
          >
            {playlists.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', opacity: 0.65 }}>
                <ListPlus size={28} style={{ margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontSize: '0.85rem' }}>No custom playlists yet.</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--pulse-color-text-secondary)', marginTop: '2px' }}>
                  Click "Create New Playlist" above to start one!
                </div>
              </div>
            ) : (
              playlists.map((pl) => {
                const isAdded = Boolean(addedMap[pl.id]);
                return (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => {
                      void handleToggleAddToPlaylist(pl);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--pulse-radius-sm)',
                      background: isAdded
                        ? 'rgba(52, 199, 89, 0.12)'
                        : 'var(--pulse-color-bg-elevated)',
                      border: `1px solid ${
                        isAdded ? 'var(--pulse-color-signal)' : 'var(--pulse-color-border-subtle)'
                      }`,
                      cursor: isAdded ? 'default' : 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <img
                        src={pl.coverUrl}
                        alt=""
                        style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pl.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--pulse-color-text-secondary)' }}>
                          {pl.trackUris.length} {pl.trackUris.length === 1 ? 'song' : 'songs'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem', fontWeight: 600 }}>
                      {isAdded ? (
                        <>
                          <CheckCircle2 size={16} color="var(--pulse-color-signal)" />
                          <span style={{ color: 'var(--pulse-color-signal)' }}>Added</span>
                        </>
                      ) : (
                        <>
                          <Plus size={15} />
                          <span>Add</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <CreatePlaylistModal
        isOpen={createModalOpen}
        onClose={() => { setCreateModalOpen(false); }}
        initialTrackUri={track.uri}
        onCreated={(newPl) => {
          setPlaylists((prev) => [newPl, ...prev]);
          setAddedMap((prev) => ({ ...prev, [newPl.id]: true }));
          onUpdated?.();
        }}
      />
    </>
  );
}
