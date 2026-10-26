import { useEffect } from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';
import { formatDurationMs } from './formatTime';
import { playerController } from './playerController';

interface CompactPlayerProps {
  readonly mode: 'obs' | 'mini';
}

/**
 * Compact Now-Playing view:
 * - `?mode=obs`: Transparent browser-source widget for OBS Studio streams (polls playback state).
 * - `?mode=mini`: Compact interactive desktop/PWA mini-player deck.
 */
export function CompactNowPlayingView({ mode }: CompactPlayerProps) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const positionMs = usePlayerStore((s) => s.positionMs);
  const tickPosition = usePlayerStore((s) => s.tickPosition);

  useEffect(() => {
    if (mode === 'obs') {
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
    }
    void playerController.refreshPlaybackState();
    const poll = setInterval(() => {
      void playerController.refreshPlaybackState();
    }, 5_000);
    return () => {
      clearInterval(poll);
    };
  }, [mode]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    const tick = setInterval(() => {
      tickPosition(250);
    }, 250);
    return () => {
      clearInterval(tick);
    };
  }, [isPlaying, tickPosition]);

  const coverUrl = currentTrack?.album?.images[0]?.url;
  const coverAlt = currentTrack?.album?.name ?? 'Cover';
  const durationMs = currentTrack?.duration_ms ?? 1;
  const pct = Math.min(100, Math.round((positionMs / Math.max(1, durationMs)) * 100));

  return (
    <main
      aria-label={mode === 'obs' ? 'OBS Now Playing Overlay' : 'Pulse Mini Player'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.9rem',
        padding: '0.85rem 1.1rem',
        margin: mode === 'obs' ? '8px' : '0',
        height: mode === 'mini' ? '100vh' : 'auto',
        borderRadius: mode === 'obs' ? '14px' : '0',
        background: 'rgba(11, 13, 16, 0.88)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--pulse-color-border-strong)',
        color: 'var(--pulse-color-text-primary)',
      }}
    >
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={coverAlt}
          width={64}
          height={64}
          style={{ borderRadius: '8px', objectFit: 'cover' }}
        />
      ) : null}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--pulse-font-display)',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {currentTrack?.name ?? 'Waiting for Spotify playback…'}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--pulse-color-text-secondary)' }}>
          {currentTrack?.artists.map((a) => a.name).join(', ') ?? 'Pulse'}
        </div>
        <div
          style={{
            marginTop: '0.45rem',
            height: '4px',
            borderRadius: '999px',
            background: 'var(--pulse-color-border-subtle)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: 'var(--pulse-color-accent)',
            }}
          />
        </div>
        <div
          style={{
            marginTop: '0.2rem',
            fontSize: '0.72rem',
            fontFamily: 'var(--pulse-font-mono)',
            color: 'var(--pulse-color-text-muted)',
          }}
        >
          {formatDurationMs(positionMs)} / {formatDurationMs(currentTrack?.duration_ms ?? 0)}
        </div>
      </div>

      {mode === 'mini' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => {
              void playerController.previous();
            }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <SkipBack size={18} />
          </button>
          <button
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={() => {
              void playerController.togglePlayPause();
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: 'none',
              background: 'var(--pulse-color-accent)',
              color: 'var(--pulse-color-text-inverse)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => {
              void playerController.next();
            }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <SkipForward size={18} />
          </button>
        </div>
      ) : null}
    </main>
  );
}
