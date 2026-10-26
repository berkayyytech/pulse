import { useEffect, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { getSpotifyClient } from '@/api/clientInstance';
import type { SearchResponse } from '@/api/schemas/search';
import { VirtualizedTrackList } from '@/features/library/VirtualizedTrackList';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';

export default function SearchView() {
  const authStatus = useAuthStore((s) => s.status);
  const openAlbumDetail = useUiStore((s) => s.openAlbumDetail);
  const openArtistDetail = useUiStore((s) => s.openArtistDetail);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const isConnected = authStatus === 'authenticated' || authStatus === 'demo';

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || !isConnected) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      void getSpotifyClient()
        .search({
          q: trimmed,
          types: ['track', 'album', 'artist', 'playlist'],
          limit: 10, // February 2026 Dev Mode max limit
        })
        .then((res) => {
          setResults(res);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 240);
    return () => {
      clearTimeout(timer);
    };
  }, [query, isConnected]);

  return (
    <section aria-labelledby="search-heading">
      <h1 id="search-heading" style={{ fontFamily: 'var(--pulse-font-display)', marginTop: 0 }}>
        Instant Search
      </h1>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.6rem 0.9rem',
          borderRadius: 'var(--pulse-radius-md)',
          background: 'var(--pulse-color-bg-surface)',
          border: '1px solid var(--pulse-color-border-strong)',
          maxWidth: '560px',
          marginBottom: '1.25rem',
        }}
      >
        <SearchIcon size={18} color="var(--pulse-color-accent)" aria-hidden="true" />
        <input
          type="search"
          aria-label="Search tracks, albums, artists, or playlists"
          placeholder={
            isConnected
              ? 'Search tracks, albums, artists, playlists (clamped to 10/page per 2026 API)…'
              : 'Connect Client ID or Offline Sample Mode to search…'
          }
          disabled={!isConnected}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
          }}
        />
      </div>

      {loading ? <p role="status">Searching…</p> : null}

      {results ? (
        <div>
          <h2 style={{ fontSize: '1.05rem' }}>Tracks</h2>
          <VirtualizedTrackList
            tracks={results.tracks?.items ?? []}
            heightPx={260}
            onBulkSaveToLibrary={(uris) => getSpotifyClient().saveToLibrary(uris)}
          />

          <div className="pulse-card-grid">
            <article className="pulse-card">
              <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>Albums</h3>
              {(results.albums?.items ?? []).map((alb) => (
                <div key={alb.id ?? alb.name} style={{ marginBottom: '0.5rem' }}>
                  <button
                    type="button"
                    className="pulse-nav-btn"
                    onClick={() => {
                      if (alb.id) {
                        openAlbumDetail(alb.id);
                      }
                    }}
                  >
                    <span>
                      {alb.name} — <small>{alb.artists.map((a) => a.name).join(', ')}</small>
                    </span>
                  </button>
                </div>
              ))}
            </article>

            <article className="pulse-card">
              <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>Artists</h3>
              {(results.artists?.items ?? []).map((art) => (
                <div key={art.id ?? art.name} style={{ marginBottom: '0.5rem' }}>
                  <button
                    type="button"
                    className="pulse-nav-btn"
                    onClick={() => {
                      if (art.id) {
                        openArtistDetail(art.id);
                      }
                    }}
                  >
                    <span>{art.name}</span>
                  </button>
                </div>
              ))}
            </article>
          </div>
        </div>
      ) : null}
    </section>
  );
}
