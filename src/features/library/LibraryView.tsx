import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Disc3, FolderPlus, Lock, Plus, Users } from 'lucide-react';
import { getSpotifyClient } from '@/api/clientInstance';
import type { FullAlbum, FullArtist, SimplifiedAlbum, Track } from '@/api/schemas/catalog';
import type { FullPlaylist, SimplifiedPlaylist } from '@/api/schemas/playlist';
import {
  getCuratedAndLocalTracks,
  importAudioFiles,
} from '@/features/local-audio/localAudioService';
import {
  addTrackToCustomPlaylist,
  createCustomPlaylist,
  customPlaylistToSimplified,
  generatePlaylistCoverSvg,
  getAllCustomPlaylists,
  getCustomPlaylist,
  removeTrackFromCustomPlaylist,
  resolveCustomPlaylistTracks,
} from '@/features/playlists/customPlaylistService';
import {
  fetchOptInArtistEnrichment,
  type ExternalArtistMetadata,
} from '@/features/lyrics/externalMetadataService';
import { useAchievementStore } from '@/stores/achievementStore';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useUiStore } from '@/stores/uiStore';
import { VirtualizedTrackList } from './VirtualizedTrackList';

type LibraryTab = 'playlists' | 'tracks' | 'albums' | 'artists' | 'local';

export default function LibraryView() {
  const authStatus = useAuthStore((s) => s.status);
  const currentUser = useAuthStore((s) => s.user);
  const focusedAlbumId = useUiStore((s) => s.focusedAlbumId);
  const focusedArtistId = useUiStore((s) => s.focusedArtistId);
  const clearCatalogDetail = useUiStore((s) => s.clearCatalogDetail);
  const openAlbumDetail = useUiStore((s) => s.openAlbumDetail);
  const openArtistDetail = useUiStore((s) => s.openArtistDetail);
  const setActiveRoute = useUiStore((s) => s.setActiveRoute);
  const collectionViewMode = useThemeStore((s) => s.density);

  const [tab, setTab] = useState<LibraryTab>(() =>
    authStatus === 'authenticated' || authStatus === 'demo' ? 'playlists' : 'local',
  );
  const [playlists, setPlaylists] = useState<SimplifiedPlaylist[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<FullPlaylist | null>(null);
  const [savedTracks, setSavedTracks] = useState<Track[]>([]);
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [savedAlbums, setSavedAlbums] = useState<FullAlbum[]>([]);
  const [followedArtists, setFollowedArtists] = useState<FullArtist[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const [albumDetail, setAlbumDetail] = useState<FullAlbum | null>(null);
  const [artistDetail, setArtistDetail] = useState<{
    artist: FullArtist;
    albums: SimplifiedAlbum[];
    external: ExternalArtistMetadata | null;
  } | null>(null);

  const isConnected = authStatus === 'authenticated' || authStatus === 'demo';

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
        setTab('local');
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const imported = await importAudioFiles(e.target.files);
      if (imported.length > 0) {
        useAchievementStore.getState().incrementMetric('tracksSavedCount', imported.length);
        await refreshLocalTracks();
        setTab('local');
      }
      e.target.value = '';
    }
  };

  const loadLibrary = useCallback(async () => {
    const customList = await getAllCustomPlaylists();
    const customConverted = customList.map(customPlaylistToSimplified);

    if (!isConnected) {
      setPlaylists(customConverted);
      return;
    }
    const client = getSpotifyClient();
    const [plPage, trkPage, albPage, artRes] = await Promise.all([
      client.getCurrentUserPlaylists(50, 0).catch(() => null),
      client.getSavedTracks(50, 0).catch(() => null),
      client.getSavedAlbums(50, 0).catch(() => null),
      client.getFollowedArtists(50).catch(() => null),
    ]);
    const spotifyPlaylists = plPage ? plPage.items : [];
    setPlaylists([...customConverted, ...spotifyPlaylists]);
    if (trkPage) {
      setSavedTracks(trkPage.items.map((i) => i.track));
    }
    if (albPage) {
      setSavedAlbums(albPage.items.map((i) => i.album));
    }
    if (artRes) {
      setFollowedArtists(artRes.artists.items);
    }
  }, [isConnected]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    if (!focusedAlbumId || !isConnected) {
      setAlbumDetail(null);
      return;
    }
    void getSpotifyClient()
      .getAlbum(focusedAlbumId)
      .then((alb) => {
        setAlbumDetail(alb);
      })
      .catch(() => undefined);
  }, [focusedAlbumId, isConnected]);

  useEffect(() => {
    if (!focusedArtistId || !isConnected) {
      setArtistDetail(null);
      return;
    }
    const client = getSpotifyClient();
    void Promise.all([
      client.getArtist(focusedArtistId),
      client.getArtistAlbums(focusedArtistId, 20, 0),
    ])
      .then(async ([artist, albumsPage]) => {
        const external = await fetchOptInArtistEnrichment(artist.name);
        setArtistDetail({ artist, albums: albumsPage.items, external });
      })
      .catch(() => undefined);
  }, [focusedArtistId, isConnected]);

  // Album Detail Sub-View
  if (focusedAlbumId && albumDetail) {
    const albumTracks = (albumDetail.tracks?.items ?? []).map((t) => ({
      ...t,
      album: t.album ?? albumDetail,
    }));
    return (
      <section aria-labelledby="album-detail-title">
        <button
          type="button"
          className="pulse-nav-btn"
          style={{ width: 'auto', marginBottom: '1rem' }}
          onClick={clearCatalogDetail}
        >
          <ArrowLeft size={15} />
          <span>Back to Library</span>
        </button>
        <div
          style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.25rem' }}
        >
          {albumDetail.images[0] ? (
            <img
              src={albumDetail.images[0].url}
              alt={albumDetail.name}
              width={112}
              height={112}
              style={{ borderRadius: 'var(--pulse-radius-md)', objectFit: 'cover' }}
            />
          ) : null}
          <div>
            <span className="pulse-mono-pill">Album • {albumDetail.release_date}</span>
            <h1 id="album-detail-title" style={{ margin: '0.4rem 0 0.2rem' }}>
              {albumDetail.name}
            </h1>
            <div style={{ color: 'var(--pulse-color-text-secondary)' }}>
              {albumDetail.artists.map((a) => a.name).join(', ')}
            </div>
          </div>
        </div>
        <VirtualizedTrackList
          tracks={albumTracks}
          contextUri={albumDetail.uri}
          ownedPlaylists={playlists}
          onBulkSaveToLibrary={async (uris) => {
            await getSpotifyClient().saveToLibrary(uris);
            await loadLibrary();
          }}
        />
      </section>
    );
  }

  // Artist Detail Sub-View (respects 2026 removal of GET /artists/{id}/top-tracks)
  if (focusedArtistId && artistDetail) {
    const savedByArtist = savedTracks.filter((t) =>
      t.artists.some((a) => a.id === artistDetail.artist.id || a.name === artistDetail.artist.name),
    );
    return (
      <section aria-labelledby="artist-detail-title">
        <button
          type="button"
          className="pulse-nav-btn"
          style={{ width: 'auto', marginBottom: '1rem' }}
          onClick={clearCatalogDetail}
        >
          <ArrowLeft size={15} />
          <span>Back to Library</span>
        </button>
        <div className="pulse-card" style={{ marginBottom: '1.25rem' }}>
          <h1 id="artist-detail-title" style={{ margin: '0 0 0.35rem' }}>
            {artistDetail.artist.name}
          </h1>
          {artistDetail.artist.genres.length > 0 ? (
            <p style={{ margin: 0, color: 'var(--pulse-color-text-secondary)' }}>
              Genres: {artistDetail.artist.genres.join(' • ')}
            </p>
          ) : null}
          {artistDetail.external ? (
            <div style={{ marginTop: '0.75rem', fontSize: '0.88rem' }}>
              <span className="pulse-mono-pill" data-tone="signal">
                External: {artistDetail.external.sourceLabel}
              </span>
              <p style={{ margin: '0.4rem 0 0', color: 'var(--pulse-color-text-secondary)' }}>
                {artistDetail.external.summary}
              </p>
            </div>
          ) : null}
        </div>

        <h2 style={{ fontSize: '1.05rem' }}>Your Saved Tracks by {artistDetail.artist.name}</h2>
        <VirtualizedTrackList
          tracks={savedByArtist}
          heightPx={240}
          ownedPlaylists={playlists}
          onBulkSaveToLibrary={(uris) => getSpotifyClient().saveToLibrary(uris)}
        />

        <h2 style={{ fontSize: '1.05rem', marginTop: '1.5rem' }}>Discography</h2>
        <div className="pulse-card-grid">
          {artistDetail.albums.map((alb) => (
            <article key={alb.id ?? alb.name} className="pulse-card">
              <strong style={{ display: 'block' }}>{alb.name}</strong>
              <span style={{ fontSize: '0.82rem', color: 'var(--pulse-color-text-secondary)' }}>
                {alb.release_date} • {alb.album_type}
              </span>
              {alb.id ? (
                <div style={{ marginTop: '0.6rem' }}>
                  <button
                    type="button"
                    className="pulse-nav-btn"
                    onClick={() => {
                      if (alb.id) {
                        openAlbumDetail(alb.id);
                      }
                    }}
                  >
                    Open Album
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    );
  }

  const ownedPlaylists = playlists.filter(
    (p) => !currentUser || p.owner.id === currentUser.id || p.collaborative,
  );

  const openPlaylist = async (playlistId: string) => {
    if (playlistId.startsWith('pl_')) {
      const pl = await getCustomPlaylist(playlistId);
      if (pl) {
        const resolved = await resolveCustomPlaylistTracks(pl);
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
          owner: {
            id: 'pulse-local',
            display_name: 'You (Offline)',
            uri: 'pulse:user:local',
          },
          external_urls: {},
          items: {
            href: '',
            total: resolved.length,
            limit: resolved.length,
            offset: 0,
            next: null,
            previous: null,
            items: resolved.map((t) => ({
              added_at: new Date(pl.updatedAt).toISOString(),
              added_by_id: 'pulse-local',
              is_local: true,
              item: t,
              usedLegacyTrackField: false,
            })),
          },
          itemsRestrictedByDevMode: false,
        };
        useAchievementStore.getState().incrementMetric('playlistsOpened', 1);
        setActivePlaylist(full);
        return;
      }
    }
    const full = await getSpotifyClient().getPlaylist(playlistId);
    useAchievementStore.getState().incrementMetric('playlistsOpened', 1);
    setActivePlaylist(full);
  };

  const handleCreatePlaylist = async () => {
    const trimmed = newPlaylistName.trim();
    if (!trimmed) {
      return;
    }
    if (!isConnected) {
      const created = await createCustomPlaylist(trimmed);
      useAchievementStore.getState().incrementMetric('playlistsCreated', 1);
      setNewPlaylistName('');
      await loadLibrary();
      await openPlaylist(created.id);
      return;
    }
    const created = await getSpotifyClient().createPlaylist({ name: trimmed });
    useAchievementStore.getState().incrementMetric('playlistsCreated', 1);
    setNewPlaylistName('');
    await loadLibrary();
    setActivePlaylist(created);
  };

  return (
    <section aria-labelledby="library-heading">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <h1 id="library-heading" style={{ fontFamily: 'var(--pulse-font-display)', margin: 0 }}>
          Your Library
        </h1>

        <div
          role="tablist"
          aria-label="Library sections"
          style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}
        >
          {(
            [
              ['local', `Local Audio (${localTracks.length})`],
              ['playlists', `Playlists (${playlists.length})`],
              ['tracks', `Liked Tracks (${savedTracks.length})`],
              ['albums', `Albums (${savedAlbums.length})`],
              ['artists', `Artists (${followedArtists.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                setActivePlaylist(null);
              }}
              className="pulse-mono-pill"
              data-tone={tab === id ? 'accent' : undefined}
              style={{ cursor: 'pointer', padding: '0.35rem 0.85rem' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!isConnected && tab !== 'local' && tab !== 'playlists' ? (
        <article className="pulse-card" style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>
            Spotify Account Not Connected
          </h2>
          <p style={{ color: 'var(--pulse-color-text-secondary)', margin: '0 0 1rem' }}>
            To view your Spotify playlists, liked tracks, albums, and artists, connect your Spotify
            account in Setup. You can also listen to your own local audio files and royalty-free
            music anytime!
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="pulse-nav-btn"
              style={{
                width: 'auto',
                background: 'var(--pulse-color-accent)',
                color: 'var(--pulse-color-text-inverse)',
              }}
              onClick={() => {
                setTab('local');
              }}
            >
              <Disc3 size={15} />
              <span>Switch to Local Audio</span>
            </button>
            <button
              type="button"
              className="pulse-nav-btn"
              style={{ width: 'auto', border: '1px solid var(--pulse-color-border-strong)' }}
              onClick={() => {
                setActiveRoute('setup');
              }}
            >
              <span>Go to Setup</span>
            </button>
          </div>
        </article>
      ) : null}

      {tab === 'local' ? (
        <div>
          <div
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
              padding: '1.25rem',
              borderRadius: 'var(--pulse-radius-md)',
              border: `2px dashed ${
                isDraggingOver ? 'var(--pulse-color-accent)' : 'var(--pulse-color-border-strong)'
              }`,
              background: isDraggingOver
                ? 'var(--pulse-color-bg-elevated)'
                : 'var(--pulse-color-bg-canvas)',
              marginBottom: '1.25rem',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              transition: 'all 0.2s ease',
            }}
          >
            <div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
              >
                <Disc3 size={18} color="var(--pulse-color-accent)" />
                <span>Drag & Drop Audio Files Here</span>
              </div>
              <p
                style={{
                  margin: '0.25rem 0 0',
                  color: 'var(--pulse-color-text-secondary)',
                  fontSize: '0.86rem',
                }}
              >
                Supports MP3, WAV, FLAC, OGG, M4A, AAC, and WEBM. Stored safely in your local
                desktop database.
              </p>
            </div>
            <div>
              <button
                type="button"
                className="pulse-nav-btn"
                style={{
                  background: 'var(--pulse-color-accent)',
                  color: 'var(--pulse-color-text-inverse)',
                  fontWeight: 600,
                  border: 'none',
                  padding: '0.5rem 1rem',
                  gap: '0.45rem',
                }}
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                <Plus size={16} />
                <span>Import Audio Files</span>
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
          </div>

          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
            Local & Curated Open Audio ({localTracks.length})
          </h2>
          <VirtualizedTrackList tracks={localTracks} ownedPlaylists={playlists} />
        </div>
      ) : null}

      {tab === 'playlists' ? (
        activePlaylist ? (
          <div>
            <button
              type="button"
              className="pulse-nav-btn"
              style={{ width: 'auto', marginBottom: '0.75rem' }}
              onClick={() => {
                setActivePlaylist(null);
              }}
            >
              <ArrowLeft size={15} />
              <span>All Playlists</span>
            </button>
            <h2 style={{ marginTop: 0 }}>{activePlaylist.name}</h2>
            {activePlaylist.description ? (
              <p style={{ color: 'var(--pulse-color-text-secondary)' }}>
                {activePlaylist.description}
              </p>
            ) : null}

            {activePlaylist.itemsRestrictedByDevMode ? (
              <article className="pulse-card" role="status">
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
                >
                  <Lock size={16} color="var(--pulse-color-accent)" />
                  <span>Playlist items restricted by Spotify Development Mode</span>
                </div>
                <p style={{ color: 'var(--pulse-color-text-secondary)', marginBottom: 0 }}>
                  Under Spotify’s February 2026 API rules, unowned algorithmic and editorial
                  playlists omit their <code>items</code> array in Development Mode. You can still
                  trigger playback on Spotify via its URI (<code>{activePlaylist.uri}</code>).
                </p>
              </article>
            ) : (
              <VirtualizedTrackList
                tracks={(activePlaylist.items?.items ?? [])
                  .map((e) => e.item)
                  .filter((t): t is Track => t !== null)}
                contextUri={activePlaylist.uri}
                ownedPlaylists={ownedPlaylists}
                canReorder
                onReorderTrack={async (fromIdx, insertBefore) => {
                  await getSpotifyClient().reorderPlaylistItems(activePlaylist.id, {
                    rangeStart: fromIdx,
                    insertBefore,
                  });
                  await openPlaylist(activePlaylist.id);
                }}
                onBulkSaveToLibrary={async (uris) => {
                  if (isConnected) {
                    await getSpotifyClient().saveToLibrary(uris);
                  }
                }}
                onBulkAddToPlaylist={async (destId, uris) => {
                  if (destId.startsWith('pl_')) {
                    for (const u of uris) {
                      await addTrackToCustomPlaylist(destId, u);
                    }
                  } else {
                    await getSpotifyClient().addItemsToPlaylist(destId, uris);
                  }
                }}
                onBulkRemoveFromPlaylist={async (uris) => {
                  if (activePlaylist.id.startsWith('pl_')) {
                    for (const u of uris) {
                      await removeTrackFromCustomPlaylist(activePlaylist.id, u);
                    }
                    await openPlaylist(activePlaylist.id);
                  } else {
                    await getSpotifyClient().removePlaylistItems(activePlaylist.id, uris);
                    await openPlaylist(activePlaylist.id);
                  }
                }}
              />
            )}
          </div>
        ) : (
          <div>
            <div
              style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', maxWidth: '460px' }}
            >
              <input
                type="text"
                aria-label="New playlist name"
                placeholder="New playlist title…"
                value={newPlaylistName}
                onChange={(e) => {
                  setNewPlaylistName(e.target.value);
                }}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--pulse-radius-sm)',
                  border: '1px solid var(--pulse-color-border-strong)',
                  background: 'var(--pulse-color-bg-surface)',
                }}
              />
              <button
                type="button"
                onClick={() => {
                  void handleCreatePlaylist();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: 'var(--pulse-radius-sm)',
                  border: 'none',
                  background: 'var(--pulse-color-accent)',
                  color: 'var(--pulse-color-text-inverse)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <FolderPlus size={15} />
                <span>Create</span>
              </button>
            </div>

            <div
              className="pulse-card-grid"
              style={{
                gridTemplateColumns:
                  collectionViewMode === 'compact'
                    ? '1fr'
                    : 'repeat(auto-fill, minmax(240px, 1fr))',
              }}
            >
              {playlists.map((pl) => (
                <article key={pl.id} className="pulse-card">
                  <strong>{pl.name}</strong>
                  <p
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--pulse-color-text-secondary)',
                      margin: '0.35rem 0 0.75rem',
                    }}
                  >
                    {pl.itemsSummary
                      ? `${pl.itemsSummary.total} items`
                      : 'External / Editorial (Dev Mode metadata only)'}
                  </p>
                  <button
                    type="button"
                    className="pulse-nav-btn"
                    onClick={() => {
                      void openPlaylist(pl.id);
                    }}
                  >
                    Open Playlist
                  </button>
                </article>
              ))}
            </div>
          </div>
        )
      ) : null}

      {tab === 'tracks' ? (
        <VirtualizedTrackList
          tracks={savedTracks}
          ownedPlaylists={ownedPlaylists}
          onBulkSaveToLibrary={async (uris) => {
            await getSpotifyClient().saveToLibrary(uris);
            await loadLibrary();
          }}
          onBulkRemoveFromLibrary={async (uris) => {
            await getSpotifyClient().removeFromLibrary(uris);
            await loadLibrary();
          }}
          onBulkAddToPlaylist={(destId, uris) =>
            getSpotifyClient().addItemsToPlaylist(destId, uris)
          }
        />
      ) : null}

      {tab === 'albums' ? (
        <div className="pulse-card-grid">
          {savedAlbums.map((alb) => (
            <article key={alb.id ?? alb.name} className="pulse-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Disc3 size={18} color="var(--pulse-color-accent)" />
                <strong>{alb.name}</strong>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--pulse-color-text-secondary)' }}>
                {alb.artists.map((a) => a.name).join(', ')} • {alb.release_date}
              </p>
              {alb.id ? (
                <button
                  type="button"
                  className="pulse-nav-btn"
                  onClick={() => {
                    if (alb.id) {
                      openAlbumDetail(alb.id);
                    }
                  }}
                >
                  View Album Tracks
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {tab === 'artists' ? (
        <div className="pulse-card-grid">
          {followedArtists.map((art) => (
            <article key={art.id ?? art.name} className="pulse-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Users size={18} color="var(--pulse-color-signal)" />
                <strong>{art.name}</strong>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--pulse-color-text-secondary)' }}>
                {art.genres.join(', ') || 'Followed Artist'}
              </p>
              {art.id ? (
                <button
                  type="button"
                  className="pulse-nav-btn"
                  onClick={() => {
                    if (art.id) {
                      openArtistDetail(art.id);
                    }
                  }}
                >
                  Open Artist Page
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
