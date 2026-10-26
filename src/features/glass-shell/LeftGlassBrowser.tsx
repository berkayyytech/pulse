import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowLeft, Disc3, Search } from 'lucide-react';
import { getSpotifyClient } from '@/api/clientInstance';
import { DEMO_TRACKS, DEMO_USER } from '@/api/demoCatalog';
import type { Track } from '@/api/schemas/catalog';
import type { FullPlaylist, SimplifiedPlaylist } from '@/api/schemas/playlist';
import { DevicePicker } from '@/features/player/DevicePicker';
import { formatDurationMs } from '@/features/player/formatTime';
import { playerController } from '@/features/player/playerController';
import { useAchievementStore } from '@/stores/achievementStore';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useThemeStore } from '@/stores/themeStore';
import { useUiStore } from '@/stores/uiStore';

const FALLBACK_THUMB =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="92" height="92"><rect width="92" height="92" rx="18" fill="#2A3142"/><circle cx="46" cy="46" r="22" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="5" fill="none"/></svg>',
  );

type LibrarySubFilter = 'tracks' | 'playlists';

export function LeftGlassBrowser() {
  const leftPaneTab = useUiStore((s) => s.leftPaneTab);
  const setImportModalOpen = useUiStore((s) => s.setImportModalOpen);
  const setActiveRoute = useUiStore((s) => s.setActiveRoute);

  const authStatus = useAuthStore((s) => s.status);
  const setDemoSession = useAuthStore((s) => s.setDemoSession);
  const currentUser = useAuthStore((s) => s.user);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const activeDevice = usePlayerStore((s) => s.activeDevice);
  const density = useThemeStore((s) => s.density);
  const showTrackArtwork = useThemeStore((s) => s.showTrackArtwork);

  const [query, setQuery] = useState('');
  const [searchTracks, setSearchTracks] = useState<Track[]>(() => [...DEMO_TRACKS]);
  const [searching, setSearching] = useState(false);

  const [libSubFilter, setLibSubFilter] = useState<LibrarySubFilter>('tracks');
  const [savedTracks, setSavedTracks] = useState<Track[]>(() => [...DEMO_TRACKS]);
  const [playlists, setPlaylists] = useState<SimplifiedPlaylist[]>([]);
  const [openedPlaylist, setOpenedPlaylist] = useState<FullPlaylist | null>(null);
  const [statusNote, setStatusNote] = useState<string>('');
  const [devicePopoverOpen, setDevicePopoverOpen] = useState(false);

  const isConnected = authStatus === 'authenticated' || authStatus === 'demo';
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Load saved library items when connected
  const refreshLibraryData = useCallback(async () => {
    if (!isConnected) {
      setSavedTracks([...DEMO_TRACKS]);
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
    if (plPage) {
      setPlaylists(plPage.items);
    }
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
      setSearchTracks(savedTracks.length > 0 ? savedTracks : [...DEMO_TRACKS]);
      setSearching(false);
      return undefined;
    }

    if (!isConnected) {
      const lower = trimmed.toLowerCase();
      setSearchTracks(
        DEMO_TRACKS.filter(
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
  }, [isConnected, leftPaneTab, query, savedTracks]);

  const displayedTracks = useMemo<readonly Track[]>(() => {
    if (leftPaneTab === 'search') {
      return searchTracks;
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
  }, [leftPaneTab, openedPlaylist, query, savedTracks, searchTracks]);

  const estimatedRowHeight = density === 'compact' ? 46 : density === 'spacious' ? 76 : 62;

  const rowVirtualizer = useVirtualizer({
    count: displayedTracks.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 8,
    initialRect: { width: 324, height: 480 },
  });

  const handlePlayTrack = (track: Track, contextUri?: string) => {
    if (authStatus !== 'authenticated' && authStatus !== 'demo') {
      setDemoSession(DEMO_USER);
    }
    setStatusNote('');
    void playerController.playTrack(track, contextUri);
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
    if (authStatus === 'authenticated') {
      return `Playing on ${activeDevice?.name ?? 'Pulse'}`;
    }
    if (authStatus === 'demo') {
      return `Playing on ${activeDevice?.name ?? 'Pulse (Sample)'}`;
    }
    return 'Playing on Pulse';
  }, [activeDevice?.name, authStatus, searching, statusNote]);

  return (
    <aside className="gp-glass-panel gp-left-pane" aria-label="Music browser">
      {/* Top Search + Import Row */}
      <div className="gp-search-row">
        <div className="gp-search-box">
          <Search
            size={15}
            style={{ opacity: 0.6, flexShrink: 0 }}
            aria-hidden="true"
          />
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
            <button
              type="button"
              className="gp-seg-pill"
              data-active="true"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px' }}
              onClick={() => {
                setOpenedPlaylist(null);
              }}
            >
              <ArrowLeft size={13} />
              <span>{openedPlaylist.name}</span>
            </button>
          ) : (
            <div style={{ display: 'inline-flex', gap: '4px' }} role="tablist" aria-label="Library view">
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

      {/* Scrollable Track / Playlist List */}
      <div
        ref={scrollContainerRef}
        className="gp-scroll-list"
        data-hide-thumbs={!showTrackArtwork}
        role="listbox"
        aria-label={showPlaylistsGrid ? 'Playlists' : 'Tracks'}
      >
        {showPlaylistsGrid ? (
          playlists.length === 0 ? (
            <p style={{ opacity: 0.6, padding: '12px 6px', fontSize: '13px' }}>
              {isConnected
                ? 'No playlists found yet.'
                : 'Connect your Spotify Client ID in Settings (⚙) or click Sample Library to browse playlists.'}
            </p>
          ) : (
            playlists.map((pl) => {
              const cover = pl.images[0]?.url ?? FALLBACK_THUMB;
              const isOwned = currentUser?.id === pl.owner.id || pl.collaborative;
              return (
                <button
                  key={pl.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="gp-track-row"
                  onClick={() => {
                    useAchievementStore.getState().incrementMetric('playlistsOpened', 1);
                    void getSpotifyClient()
                      .getPlaylist(pl.id)
                      .then((full) => {
                        setOpenedPlaylist(full);
                      })
                      .catch(() => undefined);
                  }}
                >
                  <img src={cover} alt="" className="gp-thumb" loading="lazy" />
                  <span className="gp-track-meta">
                    <span className="gp-track-title">{pl.name}</span>
                    <span className="gp-track-artist">
                      {pl.owner.display_name ?? pl.owner.id}
                      {!isOwned ? ' • Editorial' : ''}
                    </span>
                  </span>
                  <span className="gp-track-duration">
                    {pl.itemsSummary ? `${pl.itemsSummary.total}` : '—'}
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
          <p style={{ opacity: 0.6, padding: '12px 6px', fontSize: '13px' }}>
            No tracks match your search.
          </p>
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
                  <span className="gp-track-duration">{formatDurationMs(track.duration_ms)}</span>
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
                <span className="gp-track-duration">{formatDurationMs(track.duration_ms)}</span>
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
            } else {
              setActiveRoute('setup');
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
          <Disc3 size={13} style={{ opacity: 0.7 }} aria-hidden="true" />
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
            Connect Spotify
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
    </aside>
  );
}
