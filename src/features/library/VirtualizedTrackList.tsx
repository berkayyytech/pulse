import { useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, Heart, ListPlus, Play, Trash2 } from 'lucide-react';
import type { Track } from '@/api/schemas/catalog';
import type { SimplifiedPlaylist } from '@/api/schemas/playlist';
import { formatDurationMs } from '@/features/player/formatTime';
import { playerController } from '@/features/player/playerController';
import { useAchievementStore } from '@/stores/achievementStore';
import { useQueueStore } from '@/stores/queueStore';
import { useUiStore } from '@/stores/uiStore';

export interface VirtualizedTrackListProps {
  readonly tracks: readonly Track[];
  readonly contextUri?: string;
  readonly ownedPlaylists?: readonly SimplifiedPlaylist[];
  readonly canReorder?: boolean;
  readonly onReorderTrack?: (fromIndex: number, toIndex: number) => Promise<void>;
  readonly onBulkSaveToLibrary?: (uris: readonly string[]) => Promise<void>;
  readonly onBulkRemoveFromLibrary?: (uris: readonly string[]) => Promise<void>;
  readonly onBulkAddToPlaylist?: (playlistId: string, uris: readonly string[]) => Promise<void>;
  readonly onBulkRemoveFromPlaylist?: (uris: readonly string[]) => Promise<void>;
  readonly heightPx?: number;
}

const ROW_HEIGHT_PX = 48;

export function VirtualizedTrackList({
  tracks,
  contextUri,
  ownedPlaylists = [],
  canReorder = false,
  onReorderTrack,
  onBulkSaveToLibrary,
  onBulkRemoveFromLibrary,
  onBulkAddToPlaylist,
  onBulkRemoveFromPlaylist,
  heightPx = 460,
}: VirtualizedTrackListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [targetPlaylistId, setTargetPlaylistId] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const enqueueMany = useQueueStore((s) => s.enqueueMany);
  const openAlbumDetail = useUiStore((s) => s.openAlbumDetail);
  const openArtistDetail = useUiStore((s) => s.openArtistDetail);

  const rowVirtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 10,
    initialRect: { width: 800, height: heightPx },
  });

  const handleToggleRow = (index: number, shiftKey: boolean) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClickedIndex !== null) {
        const start = Math.min(lastClickedIndex, index);
        const end = Math.max(lastClickedIndex, index);
        for (let i = start; i <= end; i += 1) {
          next.add(i);
        }
      } else if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
    setLastClickedIndex(index);
  };

  const selectedTracks = Array.from(selectedIndices)
    .sort((a, b) => a - b)
    .map((idx) => tracks[idx])
    .filter((t): t is Track => Boolean(t));

  const selectedUris = selectedTracks.map((t) => t.uri).filter(Boolean);

  return (
    <div>
      {/* Bulk Multi-Select Toolbar */}
      <div
        role="toolbar"
        aria-label="Bulk track actions"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          marginBottom: '0.5rem',
          borderRadius: 'var(--pulse-radius-sm)',
          background: 'var(--pulse-color-bg-elevated)',
          border: '1px solid var(--pulse-color-border-subtle)',
          fontSize: '0.84rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>
            <strong>{tracks.length.toLocaleString()}</strong> tracks •{' '}
            <strong>{selectedTracks.length}</strong> selected
          </span>
          <button
            type="button"
            onClick={() => {
              if (selectedTracks.length === tracks.length) {
                setSelectedIndices(new Set());
              } else {
                setSelectedIndices(new Set(tracks.map((_, i) => i)));
              }
            }}
            style={{
              background: 'transparent',
              border: '1px solid var(--pulse-color-border-strong)',
              borderRadius: 'var(--pulse-radius-sm)',
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            {selectedTracks.length === tracks.length && tracks.length > 0
              ? 'Clear selection'
              : 'Select all'}
          </button>
          {statusNote ? (
            <span style={{ color: 'var(--pulse-color-signal)' }}>{statusNote}</span>
          ) : null}
        </div>

        {selectedTracks.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.45rem' }}>
            <button
              type="button"
              onClick={() => {
                enqueueMany(selectedTracks);
                setStatusNote(`Added ${selectedTracks.length} tracks to queue`);
              }}
              className="pulse-mono-pill"
              style={{ cursor: 'pointer' }}
            >
              <ListPlus size={13} />
              <span>Queue ({selectedTracks.length})</span>
            </button>

            {onBulkSaveToLibrary ? (
              <button
                type="button"
                onClick={() => {
                  void onBulkSaveToLibrary(selectedUris).then(() => {
                    useAchievementStore.getState().incrementMetric('tracksSavedCount', selectedUris.length);
                    setStatusNote(`Saved ${selectedUris.length} items to Library`);
                  });
                }}
                className="pulse-mono-pill"
                style={{ cursor: 'pointer' }}
              >
                <Heart size={13} />
                <span>Save to Library</span>
              </button>
            ) : null}

            {onBulkRemoveFromLibrary ? (
              <button
                type="button"
                onClick={() => {
                  void onBulkRemoveFromLibrary(selectedUris).then(() => {
                    setSelectedIndices(new Set());
                    setStatusNote('Removed selected items from Library');
                  });
                }}
                className="pulse-mono-pill"
                style={{ cursor: 'pointer' }}
              >
                <Trash2 size={13} />
                <span>Unsave</span>
              </button>
            ) : null}

            {onBulkAddToPlaylist && ownedPlaylists.length > 0 ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <select
                  aria-label="Target playlist for bulk add"
                  value={targetPlaylistId || (ownedPlaylists[0]?.id ?? '')}
                  onChange={(e) => {
                    setTargetPlaylistId(e.target.value);
                  }}
                  style={{
                    background: 'var(--pulse-color-bg-canvas)',
                    border: '1px solid var(--pulse-color-border-strong)',
                    borderRadius: 'var(--pulse-radius-sm)',
                    padding: '2px 6px',
                  }}
                >
                  {ownedPlaylists.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const dest = targetPlaylistId || ownedPlaylists[0]?.id;
                    if (dest) {
                      void onBulkAddToPlaylist(dest, selectedUris).then(() => {
                        setStatusNote('Added to playlist');
                      });
                    }
                  }}
                  className="pulse-mono-pill"
                  data-tone="accent"
                  style={{ cursor: 'pointer' }}
                >
                  Add to Playlist
                </button>
              </span>
            ) : null}

            {onBulkRemoveFromPlaylist ? (
              <button
                type="button"
                onClick={() => {
                  void onBulkRemoveFromPlaylist(selectedUris).then(() => {
                    setSelectedIndices(new Set());
                    setStatusNote('Removed from playlist');
                  });
                }}
                className="pulse-mono-pill"
                style={{ cursor: 'pointer', color: 'var(--pulse-color-danger)' }}
              >
                <Trash2 size={13} />
                <span>Remove from Playlist</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Virtualized Viewport */}
      <div
        ref={parentRef}
        role="listbox"
        aria-label="Track list"
        aria-multiselectable="true"
        tabIndex={0}
        style={{
          height: `${heightPx}px`,
          overflow: 'auto',
          borderRadius: 'var(--pulse-radius-md)',
          border: '1px solid var(--pulse-color-border-subtle)',
          background: 'var(--pulse-color-bg-surface)',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const track = tracks[virtualRow.index];
            if (!track) {
              return null;
            }
            const isSelected = selectedIndices.has(virtualRow.index);

            return (
              <div
                key={`${track.uri}_${virtualRow.index}`}
                role="option"
                aria-selected={isSelected}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'grid',
                  gridTemplateColumns: canReorder
                    ? '36px 36px minmax(140px, 2fr) minmax(110px, 1.4fr) minmax(90px, 1fr) 74px 66px'
                    : '36px 36px minmax(140px, 2fr) minmax(110px, 1.4fr) minmax(90px, 1fr) 66px',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0 0.75rem',
                  borderBottom: '1px solid var(--pulse-color-border-subtle)',
                  background: isSelected ? 'var(--pulse-color-accent-soft)' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${track.name}`}
                  checked={isSelected}
                  onChange={(e) => {
                    const nativeEvt = e.nativeEvent as MouseEvent;
                    handleToggleRow(virtualRow.index, nativeEvt.shiftKey);
                  }}
                />

                <button
                  type="button"
                  aria-label={`Play ${track.name}`}
                  onClick={() => {
                    void playerController.playTrack(track, contextUri);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--pulse-color-accent)',
                    display: 'inline-flex',
                  }}
                >
                  <Play size={15} />
                </button>

                <div
                  style={{
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {track.name}{' '}
                  {track.explicit ? (
                    <span className="pulse-mono-pill" style={{ fontSize: '0.65rem', padding: '0 5px' }}>
                      E
                    </span>
                  ) : null}
                </div>

                <div
                  style={{
                    fontSize: '0.84rem',
                    color: 'var(--pulse-color-text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {track.artists.map((artist, i) => (
                    <span key={`${artist.id ?? artist.name}_${i}`}>
                      {i > 0 ? ', ' : ''}
                      {artist.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (artist.id) {
                              openArtistDetail(artist.id);
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            color: 'inherit',
                            textDecoration: 'underline',
                          }}
                        >
                          {artist.name}
                        </button>
                      ) : (
                        artist.name
                      )}
                    </span>
                  ))}
                </div>

                <div
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--pulse-color-text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {track.album?.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (track.album?.id) {
                          openAlbumDetail(track.album.id);
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'inherit',
                        textDecoration: 'underline',
                      }}
                    >
                      {track.album.name}
                    </button>
                  ) : (
                    (track.album?.name ?? '')
                  )}
                </div>

                {canReorder && onReorderTrack ? (
                  <div style={{ display: 'inline-flex', gap: '4px' }}>
                    <button
                      type="button"
                      aria-label={`Move ${track.name} up`}
                      disabled={virtualRow.index === 0}
                      onClick={() => {
                        void onReorderTrack(virtualRow.index, virtualRow.index - 1);
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${track.name} down`}
                      disabled={virtualRow.index >= tracks.length - 1}
                      onClick={() => {
                        void onReorderTrack(virtualRow.index, virtualRow.index + 2);
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                ) : null}

                <span
                  style={{
                    fontFamily: 'var(--pulse-font-mono)',
                    fontSize: '0.78rem',
                    color: 'var(--pulse-color-text-secondary)',
                    textAlign: 'right',
                  }}
                >
                  {formatDurationMs(track.duration_ms)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
