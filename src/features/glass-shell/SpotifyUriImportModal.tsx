import { useEffect, useState } from 'react';
import { Link2, X } from 'lucide-react';
import { getSpotifyClient } from '@/api/clientInstance';
import type { Track } from '@/api/schemas/catalog';
import { playerController } from '@/features/player/playerController';
import { useAchievementStore } from '@/stores/achievementStore';
import { useAuthStore } from '@/stores/authStore';
import { useQueueStore } from '@/stores/queueStore';
import { useUiStore } from '@/stores/uiStore';

interface ParsedSpotifyTarget {
  readonly kind: 'track' | 'album' | 'playlist';
  readonly id: string;
}

function parseSpotifyLinkOrUri(raw: string): ParsedSpotifyTarget | null {
  const input = raw.trim();
  const uriMatch = /^spotify:(track|album|playlist):([A-Za-z0-9]+)$/i.exec(input);
  if (uriMatch?.[1] && uriMatch[2]) {
    return {
      kind: uriMatch[1].toLowerCase() as ParsedSpotifyTarget['kind'],
      id: uriMatch[2],
    };
  }

  try {
    const url = new URL(input);
    if (!url.hostname.endsWith('spotify.com')) {
      return null;
    }
    const parts = url.pathname.split('/').filter(Boolean);
    const kindIdx = parts.findIndex((p) => p === 'track' || p === 'album' || p === 'playlist');
    const kind = kindIdx >= 0 ? parts[kindIdx] : undefined;
    const id = kindIdx >= 0 ? parts[kindIdx + 1] : undefined;
    if ((kind === 'track' || kind === 'album' || kind === 'playlist') && id) {
      return { kind, id };
    }
  } catch {
    return null;
  }
  return null;
}

export function SpotifyUriImportModal() {
  const open = useUiStore((s) => s.importModalOpen);
  const setOpen = useUiStore((s) => s.setImportModalOpen);
  const openAlbumDetail = useUiStore((s) => s.openAlbumDetail);
  const authStatus = useAuthStore((s) => s.status);
  const enqueueMany = useQueueStore((s) => s.enqueueMany);

  const [linkInput, setLinkInput] = useState('');
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    if (open) {
      useAchievementStore.getState().incrementMetric('uriImportsOpened', 1);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleOpenLink = async () => {
    const parsed = parseSpotifyLinkOrUri(linkInput);
    if (!parsed) {
      setStatusText(
        'Paste a valid Spotify track, album, or playlist link (https://open.spotify.com/... or spotify:...).',
      );
      return;
    }
    if (authStatus !== 'authenticated' && authStatus !== 'demo') {
      setStatusText('Connect your Spotify Client ID (or launch Sample Mode in Settings) first.');
      return;
    }

    setStatusText('Loading from Spotify Web API…');
    try {
      const client = getSpotifyClient();
      if (parsed.kind === 'track') {
        const track = await client.getTrack(parsed.id);
        await playerController.playTrack(track);
        setOpen(false);
        setLinkInput('');
        setStatusText('');
      } else if (parsed.kind === 'album') {
        openAlbumDetail(parsed.id);
        setOpen(false);
        setLinkInput('');
        setStatusText('');
      } else {
        const playlist = await client.getPlaylist(parsed.id);
        const tracks =
          playlist.items?.items
            .map((i) => i.item)
            .filter((item): item is Track => item !== null) ?? [];
        if (tracks.length > 0) {
          enqueueMany(tracks);
          const first = tracks[0];
          if (first) {
            await playerController.playTrack(first, playlist.uri);
          }
          setOpen(false);
          setLinkInput('');
          setStatusText('');
        } else {
          setStatusText(
            playlist.itemsRestrictedByDevMode
              ? 'This unowned editorial playlist restricts track items in Spotify 2026 Dev Mode.'
              : 'Playlist is empty.',
          );
        }
      }
    } catch (err) {
      setStatusText(err instanceof Error ? err.message : 'Could not open Spotify link.');
    }
  };

  return (
    <div
      className="gp-overlay-root"
      style={{ alignItems: 'center', justifyContent: 'center' }}
      role="dialog"
      aria-modal="true"
      aria-label="Open Spotify link or URI"
    >
      <div
        className="gp-overlay-dim"
        onClick={() => {
          setOpen(false);
        }}
      />
      <div
        className="gp-glass-panel"
        style={{
          position: 'relative',
          zIndex: 2,
          width: 'min(500px, 92vw)',
          padding: '24px 28px',
          background: 'var(--pulse-color-bg-glass)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Open Spotify Link</h2>
          <button
            type="button"
            className="gp-round-btn"
            aria-label="Close modal"
            style={{ width: '32px', height: '32px' }}
            onClick={() => {
              setOpen(false);
            }}
          >
            <X size={16} />
          </button>
        </div>

        <p style={{ margin: '8px 0 14px', fontSize: '13px', color: 'var(--pulse-color-text-secondary)' }}>
          Paste a track, album, or playlist link from Spotify (<code>https://open.spotify.com/…</code>{' '}
          or <code>spotify:track:…</code>) to stream or queue via the official Spotify Web API.
        </p>

        <div className="gp-search-box">
          <Link2 size={15} style={{ opacity: 0.6 }} aria-hidden="true" />
          <input
            type="text"
            className="gp-search-input"
            aria-label="Spotify link or URI"
            placeholder="Paste a Spotify link or URI"
            value={linkInput}
            onChange={(e) => {
              setLinkInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void handleOpenLink();
              }
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
          <button
            type="button"
            className="gp-action-pill"
            onClick={() => {
              void handleOpenLink();
            }}
          >
            Open in Pulse
          </button>
        </div>

        {statusText ? (
          <p style={{ margin: '12px 0 0', fontSize: '12.5px', opacity: 0.82 }}>{statusText}</p>
        ) : null}
      </div>
    </div>
  );
}
