import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowLeft, Disc3, ListPlus, Play, Plus, Search, Shuffle, Trash2 } from 'lucide-react';
import { getSpotifyClient } from '@/api/clientInstance';
import type { Track } from '@/api/schemas/catalog';
import type { FullPlaylist, SimplifiedPlaylist } from '@/api/schemas/playlist';
import {
  getCuratedAndLocalTracks,
  importAudioFiles,
} from '@/features/local-audio/localAudioService';
import {
  customPlaylistToSimplified,
  deleteCustomPlaylist,
  generatePlaylistCoverSvg,
  getAllCustomPlaylists,
  getCustomPlaylist,
  removeTrackFromCustomPlaylist,
  resolveCustomPlaylistTracks,
} from '@/features/playlists/customPlaylistService';
import { CreatePlaylistModal } from '@/features/playlists/CreatePlaylistModal';
import { PlaylistSelectModal } from '@/features/playlists/PlaylistSelectModal';
import { DevicePicker } from '@/features/player/DevicePicker';
import { formatDurationMs } from '@/features/player/formatTime';
import { playerController } from '@/features/player/playerController';
import { useAchievementStore } from '@/stores/achievementStore';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useQueueStore } from '@/stores/queueStore';
import { useThemeStore } from '@/stores/themeStore';
import { useUiStore } from '@/stores/uiStore';

const FALLBACK_THUMB =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="92" height="92"><rect width="92" height="92" rx="18" fill="#2A3142"/><circle cx="46" cy="46" r="22" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="5" fill="none"/></svg>',
  );

type LibrarySubFilter = 'tracks' | 'playlists' | 'local';

export function LeftGlassBrowser() {
  const leftPaneTab = useUiStore((s) => s.leftPaneTab);
  const setImportModalOpen = useUiStore((s) => s.setImportModalOpen);
  const setActiveRoute = useUiStore((s) => s.setActiveRoute);

  const authStatus = useAuthStore((s) => s.status);
  const currentUser = useAuthStore((s) => s.user);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const activeDevice = usePlayerStore((s) => s.activeDevice);
  const density = useThemeStore((s) => s.density);
  const showTrackArtwork = useThemeStore((s) => s.showTrackArtwork);

  const [query, setQuery] = useState('');
  const [searchTracks, setSearchTracks] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);

  const [libSubFilter, setLibSubFilter] = useState<LibrarySubFilter>(() =>
    authStatus === 'authenticated' ? 'tracks' : 'local',
  );
  const [savedTracks, setSavedTracks] = useState<Track[]>([]);
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [playlists, setPlaylists] = useState<SimplifiedPlaylist[]>([]);
  const [openedPlaylist, setOpenedPlaylist] = useState<FullPlaylist | null>(null);
  const [statusNote, setStatusNote] = useState<string>('');
  const [devicePopoverOpen, setDevicePopoverOpen] = useState(false);
  const [createPlaylistModalOpen, setCreatePlaylistModalOpen] = useState(false);
  const [playlistSelectTrack, setPlaylistSelectTrack] = useState<Track | null>(null);

  const isConnected = authStatus === 'authenticated' || authStatus === 'demo';
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const refreshLocalTracks = useCallback(async () => {
    try {
      const items = await getCuratedAndLocalTracks();
      setLocalTracks(items);
    } catch {
      setLocalTracks([]);
    }
  }, []);

  useEffect(() => {
    void refreshLocalTracks();
  }, [refreshLocalTracks]);

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files.length > 0) {
      const imported = await importAudioFiles(e.dataTransfer.files);
      if (imported.length > 0) {
        useAchievementStore.getState().incrementMetric('tracksSavedCount', imported.length);
        await refreshLocalTracks();
        setLibSubFilter('local');
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const imported = await importAudioFiles(e.target.files);
      if (imported.length > 0) {
        useAchievementStore.getState().incrementMetric('tracksSavedCount', imported.length);
        await refreshLocalTracks();
        setLibSubFilter('local');
      }
      e.target.value = '';
    }
  };

  const refreshCustomPlaylists = useCallback(async () => {
    try {
      const customList = await getAllCustomPlaylists();
      const customConverted = customList.map(customPlaylistToSimplified);
      if (!isConnected) {
        setPlaylists(customConverted);
      } else {
        setPlaylists((prev) => {
          const spotifyOnly = prev.filter((p) => !p.uri.startsWith('pulse:playlist:'));
          return [...customConverted, ...spotifyOnly];
        });
      }
    } catch {
      // Ignore
    }
  }, [isConnected]);

  // Load saved library items & custom playlists
  const refreshLibraryData = useCallback(async () => {
    const customList = await getAllCustomPlaylists();
    const customConverted = customList.map(customPlaylistToSimplified);

    if (!isConnected) {
      setSavedTracks([]);
      setPlaylists(customConverted);
      return;
    }
    const client = getSpotifyClient();
    const [trkPage, plPage] = await Promise.all([
      client.getSavedTracks(50, 0).catch(() => null),
      client.getCurrentUserPlaylists(50, 0).catch(() => null),
    ]);
    if (trkPage) {
      setSavedTracks(trkPage.items.map((item) => item.track));
    }
    const spotifyPlaylists = plPage ? plPage.items : [];
    setPlaylists([...customConverted, ...spotifyPlaylists]);
  }, [isConnected]);

  useEffect(() => {
    void refreshLibraryData();
  }, [refreshLibraryData]);

  // Debounced search in Search tab
  useEffect(() => {
    if (leftPaneTab !== 'search') {
      return undefined;
    }
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchTracks(savedTracks.length > 0 ? savedTracks : localTracks);
      setSearching(false);
      return undefined;
    }

    if (!isConnected) {
      const lower = trimmed.toLowerCase();
      setSearchTracks(
        localTracks.filter(
          (t) =>
            t.name.toLowerCase().includes(lower) ||
            t.artists.some((a) => a.name.toLowerCase().includes(lower)),
        ),
      );
      const offlineTimer = setTimeout(() => {
        useAchievementStore.getState().recordSearchQuery(trimmed);
      }, 280);
      return () => {
        clearTimeout(offlineTimer);
      };
    }

    const timer = setTimeout(() => {
      useAchievementStore.getState().recordSearchQuery(trimmed);
      setSearching(true);
      void getSpotifyClient()
        .search({ q: trimmed, types: ['track'], limit: 10 })
        .then((res) => {
          setSearchTracks(res.tracks?.items ?? []);
        })
        .catch((err: unknown) => {
          setStatusNote(err instanceof Error ? err.message : 'Search failed');
        })
        .finally(() => {
          setSearching(false);
        });
    }, 240);

    return () => {
      clearTimeout(timer);
    };
  }, [isConnected, leftPaneTab, localTracks, query, savedTracks]);

  const displayedTracks = useMemo<readonly Track[]>(() => {
    if (leftPaneTab === 'search') {
      return searchTracks;
    }
    if (libSubFilter === 'local') {
      const trimmed = query.trim().toLowerCase();
      if (!trimmed) {
        return localTracks;
      }
      return localTracks.filter(
        (t) =>
          t.name.toLowerCase().includes(trimmed) ||
          t.artists.some((a) => a.name.toLowerCase().includes(trimmed)),
      );
    }
    const baseList = openedPlaylist
      ? (openedPlaylist.items?.items
          .map((i) => i.item)
          .filter((item): item is Track => item !== null) ?? [])
      : savedTracks;
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return baseList;
    }
    return baseList.filter(
      (t) =>
        t.name.toLowerCase().includes(trimmed) ||
        t.artists.some((a) => a.name.toLowerCase().includes(trimmed)),
    );
  }, [leftPaneTab, libSubFilter, localTracks, openedPlaylist, query, savedTracks, searchTracks]);

  const estimatedRowHeight = density === 'compact' ? 46 : density === 'spacious' ? 76 : 62;

  const rowVirtualizer = useVirtualizer({
    count: displayedTracks.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 8,
    initialRect: { width: 324, height: 480 },
  });

  const handlePlayTrack = (track: Track, contextUri?: string) => {
    setStatusNote('');
    void playerController.playTrack(track, contextUri);
  };

  const handleOpenCustomPlaylist = async (playlistId: string) => {
    const pl = await getCustomPlaylist(playlistId);
    if (!pl) return;
    const resolvedTracks = await resolveCustomPlaylistTracks(pl);
    const full: FullPlaylist = {
      id: pl.id,
      name: pl.name,
      description: pl.description || '',
      collaborative: false,
      public: true,
      snapshot_id: `${pl.updatedAt}`,
      uri: `pulse:playlist:${pl.id}`,
      images: [
        {
          url: pl.coverUrl || generatePlaylistCoverSvg(pl.name, pl.trackUris.length),
          height: 400,
          width: 400,
        },
      ],
      owner: { id: 'pulse-local', display_name: 'You (Offline)', uri: 'pulse:user:local' },
      external_urls: {},
      items: {
        href: '',
        total: resolvedTracks.length,
        limit: resolvedTracks.length,
        offset: 0,
        next: null,
        previous: null,
        items: resolvedTracks.map((t) => ({
          added_at: new Date(pl.updatedAt).toISOString(),
          added_by_id: 'pulse-local',
          is_local: true,
          item: t,
          usedLegacyTrackField: false,
        })),
      },
      itemsRestrictedByDevMode: false,
    };
    setOpenedPlaylist(full);
  };

  const handleRemoveTrackFromCurrentPlaylist = async (trackUri: string) => {
    if (!openedPlaylist || !openedPlaylist.uri.startsWith('pulse:playlist:')) return;
    await removeTrackFromCustomPlaylist(openedPlaylist.id, trackUri);
    await handleOpenCustomPlaylist(openedPlaylist.id);
    await refreshCustomPlaylists();
  };

  const handleDeleteCurrentPlaylist = async () => {
    if (!openedPlaylist || !openedPlaylist.uri.startsWith('pulse:playlist:')) return;
    if (window.confirm(`Delete playlist "${openedPlaylist.name}"?`)) {
      await deleteCustomPlaylist(openedPlaylist.id);
      setOpenedPlaylist(null);
      await refreshCustomPlaylists();
    }
  };

  const handlePlayAll = () => {
    if (displayedTracks.length === 0) return;
    const first = displayedTracks[0];
    if (first) {
      handlePlayTrack(first, openedPlaylist?.uri);
      useQueueStore.getState().setQueueItems(displayedTracks.slice(1));
    }
  };

  const handleShufflePlaylist = () => {
    if (displayedTracks.length === 0) return;
    const shuffled = [...displayedTracks].sort(() => Math.random() - 0.5);
    const first = shuffled[0];
    if (first) {
      handlePlayTrack(first, openedPlaylist?.uri);
      useQueueStore.getState().setQueueItems(shuffled.slice(1));
    }
  };

  const showPlaylistsGrid =
    leftPaneTab === 'library' && libSubFilter === 'playlists' && openedPlaylist === null;

  const footerLabel = useMemo(() => {
    if (searching) {
      return 'Searching Spotify…';
    }
    if (statusNote) {
      return statusNote;
    }
    if (!isPlaying) {
      return 'Nothing playing';
    }
    if (currentTrack && (currentTrack.is_local || currentTrack.uri.startsWith('pulse:local:'))) {
      return `Local: ${currentTrack.name}`;
    }
    if (authStatus === 'authenticated') {
      return `Playing on ${activeDevice?.name ?? 'Spotify'}`;
    }
    if (authStatus === 'demo') {
      return `Playing on ${activeDevice?.name ?? 'Pulse (Demo)'}`;
    }
    return 'Playing on Pulse';
  }, [activeDevice?.name, authStatus, currentTrack, isPlaying, searching, statusNote]);

  return (
    <aside className="gp-glass-panel gp-left-pane" aria-label="Music browser">
      {/* Top Search + Import Row */}
      <div className="gp-search-row">
        <div className="gp-search-box">
          <Search size={15} style={{ opacity: 0.6, flexShrink: 0 }} aria-hidden="true" />
          <input
            type="search"
            className="gp-search-input"
            aria-label="Search songs or artists"
            placeholder="Songs, artists"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
          />
        </div>
        <button
          type="button"
          className="gp-action-pill"
          onClick={() => {
            setImportModalOpen(true);
          }}
        >
          Import
        </button>
      </div>

      {/* Subtle Library Sub-Filter Pills when Library mode is selected */}
      {leftPaneTab === 'library' ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            marginBottom: '8px',
            flexShrink: 0,
          }}
        >
          {openedPlaylist ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                gap: '8px',
              }}
            >
              <button
                type="button"
                className="gp-seg-pill"
                data-active="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 12px',
                  maxWidth: '220px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => {
                  setOpenedPlaylist(null);
                }}
              >
                <ArrowLeft size={13} />
                <span>{openedPlaylist.name}</span>
              </button>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="gp-action-pill"
                  style={{ padding: '3px 9px', fontSize: '11px', gap: '4px' }}
                  onClick={handlePlayAll}
                  title="Play All"
                >
                  <Play size={11} />
                  <span>Play All</span>
                </button>
                <button
                  type="button"
                  className="gp-round-btn"
                  style={{ width: '26px', height: '26px' }}
                  onClick={handleShufflePlaylist}
                  title="Shuffle"
                >
                  <Shuffle size={12} />
                </button>
                {openedPlaylist.uri.startsWith('pulse:playlist:') ? (
                  <button
                    type="button"
                    className="gp-round-btn"
                    style={{ width: '26px', height: '26px' }}
                    onClick={() => {
                      void handleDeleteCurrentPlaylist();
                    }}
                    title="Delete custom playlist"
                  >
                    <Trash2 size={12} color="var(--pulse-color-danger)" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              <div
                style={{ display: 'inline-flex', gap: '4px' }}
                role="tablist"
                aria-label="Library view"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={libSubFilter === 'tracks'}
                  className="gp-seg-pill"
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                  onClick={() => {
                    setLibSubFilter('tracks');
                  }}
                >
                  Liked ({savedTracks.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={libSubFilter === 'playlists'}
                  className="gp-seg-pill"
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                  onClick={() => {
                    setLibSubFilter('playlists');
                  }}
                >
                  Playlists ({playlists.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={libSubFilter === 'local'}
                  className="gp-seg-pill"
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                  onClick={() => {
                    setLibSubFilter('local');
                  }}
                >
                  Local ({localTracks.length})
                </button>
              </div>

              {libSubFilter === 'playlists' ? (
                <button
                  type="button"
                  className="pulse-nav-btn"
                  style={{ width: 'auto', padding: '3px 8px', fontSize: '11px', gap: '3px' }}
                  onClick={() => {
                    setCreatePlaylistModalOpen(true);
                  }}
                  title="Create custom playlist"
                >
                  <Plus size={12} />
                  <span>New</span>
                </button>
              ) : null}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setActiveRoute('library');
              useUiStore.getState().setSettingsSheetOpen(true);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--pulse-color-text-secondary)',
              fontSize: '11.5px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Full view
          </button>
        </div>
      ) : null}

      {/* Local Files Import Banner */}
      {leftPaneTab === 'library' && libSubFilter === 'local' ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '8px',
            padding: '6px 10px',
            background: 'var(--pulse-color-bg-elevated)',
            borderRadius: 'var(--pulse-radius-sm)',
            border: '1px dashed var(--pulse-color-border-subtle)',
            fontSize: '12px',
          }}
        >
          <span style={{ color: 'var(--pulse-color-text-secondary)' }}>
            Drag & drop audio files here
          </span>
          <button
            type="button"
            className="pulse-nav-btn"
            style={{ width: 'auto', padding: '3px 8px', fontSize: '11.5px', gap: '4px' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus size={13} />
            <span>Add Audio</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.webm"
            style={{ display: 'none' }}
            onChange={(e) => {
              void handleFileInputChange(e);
            }}
          />
        </div>
      ) : null}

      {/* Scrollable Track / Playlist List */}
      <div
        ref={scrollContainerRef}
        className="gp-scroll-list"
        data-hide-thumbs={!showTrackArtwork}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => {
          setIsDraggingOver(false);
        }}
        onDrop={(e) => {
          void handleFileDrop(e);
        }}
        style={{
          border: isDraggingOver ? '2px dashed var(--pulse-color-accent)' : undefined,
          backgroundColor: isDraggingOver ? 'var(--pulse-color-bg-elevated)' : undefined,
        }}
        role="listbox"
        aria-label={showPlaylistsGrid ? 'Playlists' : 'Tracks'}
      >
        {showPlaylistsGrid ? (
          playlists.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 12px', opacity: 0.75 }}>
              <ListPlus
                size={28}
                style={{ margin: '0 auto 8px', display: 'block' }}
                color="var(--pulse-color-accent)"
              />
              <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>No Playlists Yet</div>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--pulse-color-text-secondary)',
                  marginTop: '4px',
                  marginBottom: '10px',
                }}
              >
                Create your own playlists with your uploaded music or curated tracks!
              </div>
              <button
                type="button"
                className="pulse-nav-btn"
                style={{
                  width: 'auto',
                  margin: '0 auto',
                  padding: '5px 12px',
                  background: 'var(--pulse-color-accent)',
                  color: 'var(--pulse-color-text-inverse)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                }}
                onClick={() => {
                  setCreatePlaylistModalOpen(true);
                }}
              >
                <Plus size={13} />
                <span>Create Playlist</span>
              </button>
            </div>
          ) : (
            playlists.map((pl) => {
              const cover = pl.images[0]?.url ?? FALLBACK_THUMB;
              const isCustom = pl.uri.startsWith('pulse:playlist:');
              const isOwned = isCustom || currentUser?.id === pl.owner.id || pl.collaborative;
              return (
                <button
                  key={pl.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="gp-track-row"
                  onClick={() => {
                    if (isCustom) {
                      void handleOpenCustomPlaylist(pl.id);
                    } else {
                      useAchievementStore.getState().incrementMetric('playlistsOpened', 1);
                      void getSpotifyClient()
                        .getPlaylist(pl.id)
                        .then((full) => {
                          setOpenedPlaylist(full);
                        })
                        .catch(() => undefined);
                    }
                  }}
                >
                  <img src={cover} alt="" className="gp-thumb" loading="lazy" />
                  <span className="gp-track-meta">
                    <span className="gp-track-title">{pl.name}</span>
                    <span className="gp-track-artist">
                      {isCustom
                        ? 'Custom Playlist (Offline)'
                        : (pl.owner.display_name ?? pl.owner.id)}
                      {!isOwned ? ' • Editorial' : ''}
                    </span>
                  </span>
                  <span className="gp-track-duration">
                    {pl.itemsSummary
                      ? `${pl.itemsSummary.total} ${pl.itemsSummary.total === 1 ? 'song' : 'songs'}`
                      : '—'}
                  </span>
                </button>
              );
            })
          )
        ) : openedPlaylist?.itemsRestrictedByDevMode ? (
          <div className="pulse-card" style={{ marginTop: '8px', fontSize: '12.5px' }}>
            <strong>Unowned playlist items omitted</strong>
            <p style={{ margin: '6px 0 0', color: 'var(--pulse-color-text-secondary)' }}>
              Spotify’s 2026 Development Mode omits track lists on editorial/algorithmic playlists
              you do not own.
            </p>
          </div>
        ) : displayedTracks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 12px', opacity: 0.75 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>
              {libSubFilter === 'local' && leftPaneTab === 'library'
                ? 'No Local Audio Files'
                : leftPaneTab === 'search'
                  ? 'No search results'
                  : 'No Songs Found'}
            </div>
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--pulse-color-text-secondary)',
                marginTop: '4px',
              }}
            >
              {libSubFilter === 'local' && leftPaneTab === 'library'
                ? 'Drop your audio files (MP3, WAV, FLAC, M4A) here to build your local library.'
                : leftPaneTab === 'search'
                  ? 'Try searching for another song title or artist.'
                  : !isConnected
                    ? 'Connect Spotify in Settings or switch to Local music.'
                    : 'No tracks match your current view.'}
            </div>
          </div>
        ) : displayedTracks.length > 80 ? (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const track = displayedTracks[vRow.index];
              if (!track) {
                return null;
              }
              const active = currentTrack?.uri === track.uri;
              const thumb = track.album?.images[0]?.url ?? FALLBACK_THUMB;
              return (
                <button
                  key={`${track.uri}_${vRow.index}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-active={active}
                  className="gp-track-row"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: `${vRow.size}px`,
                    transform: `translateY(${vRow.start}px)`,
                  }}
                  onClick={() => {
                    handlePlayTrack(track, openedPlaylist?.uri);
                  }}
                >
                  <img src={thumb} alt="" className="gp-thumb" loading="lazy" />
                  <span className="gp-track-meta">
                    <span className="gp-track-title">{track.name}</span>
                    <span className="gp-track-artist">
                      {track.artists.map((a) => a.name).join(', ')}
                    </span>
                  </span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span className="gp-track-duration">{formatDurationMs(track.duration_ms)}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      title="Add to Playlist"
                      aria-label={`Add ${track.name} to playlist`}
                      style={{
                        padding: '3px',
                        borderRadius: '4px',
                        opacity: 0.65,
                        cursor: 'pointer',
                        display: 'inline-flex',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlaylistSelectTrack(track);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          setPlaylistSelectTrack(track);
                        }
                      }}
                    >
                      <Plus size={13} />
                    </span>
                    {openedPlaylist?.uri.startsWith('pulse:playlist:') ? (
                      <span
                        role="button"
                        tabIndex={0}
                        title="Remove from playlist"
                        aria-label={`Remove ${track.name} from playlist`}
                        style={{
                          padding: '3px',
                          borderRadius: '4px',
                          opacity: 0.65,
                          cursor: 'pointer',
                          display: 'inline-flex',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRemoveTrackFromCurrentPlaylist(track.uri);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            void handleRemoveTrackFromCurrentPlaylist(track.uri);
                          }
                        }}
                      >
                        <Trash2 size={13} color="var(--pulse-color-danger)" />
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          displayedTracks.map((track, idx) => {
            const active = currentTrack?.uri === track.uri;
            const thumb = track.album?.images[0]?.url ?? FALLBACK_THUMB;
            return (
              <button
                key={`${track.uri}_${idx}`}
                type="button"
                role="option"
                aria-selected={active}
                data-active={active}
                className="gp-track-row"
                onClick={() => {
                  handlePlayTrack(track, openedPlaylist?.uri);
                }}
              >
                <img src={thumb} alt="" className="gp-thumb" loading="lazy" />
                <span className="gp-track-meta">
                  <span className="gp-track-title">{track.name}</span>
                  <span className="gp-track-artist">
                    {track.artists.map((a) => a.name).join(', ')}
                  </span>
                </span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span className="gp-track-duration">{formatDurationMs(track.duration_ms)}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    title="Add to Playlist"
                    aria-label={`Add ${track.name} to playlist`}
                    style={{
                      padding: '3px',
                      borderRadius: '4px',
                      opacity: 0.65,
                      cursor: 'pointer',
                      display: 'inline-flex',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaylistSelectTrack(track);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        setPlaylistSelectTrack(track);
                      }
                    }}
                  >
                    <Plus size={13} />
                  </span>
                  {openedPlaylist?.uri.startsWith('pulse:playlist:') ? (
                    <span
                      role="button"
                      tabIndex={0}
                      title="Remove from playlist"
                      aria-label={`Remove ${track.name} from playlist`}
                      style={{
                        padding: '3px',
                        borderRadius: '4px',
                        opacity: 0.65,
                        cursor: 'pointer',
                        display: 'inline-flex',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRemoveTrackFromCurrentPlaylist(track.uri);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          void handleRemoveTrackFromCurrentPlaylist(track.uri);
                        }
                      }}
                    >
                      <Trash2 size={13} color="var(--pulse-color-danger)" />
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Bottom Status Footer ("Playing on Pulse" + Connect / Setup quick action) */}
      <div className="gp-status-footer" style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => {
            if (isConnected) {
              useAchievementStore.getState().setFlag('openedDevicePicker');
              setDevicePopoverOpen((v) => !v);
            }
          }}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: 'inherit',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Disc3
            size={13}
            style={{ opacity: isPlaying ? 0.95 : 0.45 }}
            className={isPlaying ? 'gp-spin-slow' : undefined}
            aria-hidden="true"
          />
          <span>{footerLabel}</span>
        </button>

        {!isConnected ? (
          <button
            type="button"
            onClick={() => {
              setActiveRoute('setup');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: 'var(--pulse-color-text-primary)',
              fontSize: '12px',
              opacity: 0.85,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Connect Spotify (Optional)
          </button>
        ) : null}

        {devicePopoverOpen && isConnected ? (
          <div
            style={{
              position: 'absolute',
              bottom: '28px',
              left: 0,
              zIndex: 40,
            }}
          >
            <DevicePicker />
          </div>
        ) : null}
      </div>

      <CreatePlaylistModal
        isOpen={createPlaylistModalOpen}
        onClose={() => {
          setCreatePlaylistModalOpen(false);
        }}
        onCreated={(newPl) => {
          void (async () => {
            await refreshCustomPlaylists();
            await handleOpenCustomPlaylist(newPl.id);
          })();
        }}
      />

      <PlaylistSelectModal
        track={playlistSelectTrack}
        isOpen={playlistSelectTrack !== null}
        onClose={() => {
          setPlaylistSelectTrack(null);
        }}
        onUpdated={() => {
          void (async () => {
            await refreshCustomPlaylists();
            if (openedPlaylist?.uri.startsWith('pulse:playlist:')) {
              await handleOpenCustomPlaylist(openedPlaylist.id);
            }
          })();
        }}
      />
    </aside>
  );
}
