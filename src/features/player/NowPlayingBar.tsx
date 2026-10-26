import { useEffect } from 'react';
import {
  ExternalLink,
  ListMusic,
  MicVocal,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Tv,
  Volume2,
} from 'lucide-react';
import { PluginSlotView } from '@/features/plugins/PluginSlotView';
import { applyDynamicAlbumAccentIfEnabled } from '@/features/themes/extractDominantAccent';
import { usePlayerStore } from '@/stores/playerStore';
import { DevicePicker } from './DevicePicker';
import { formatDurationMs } from './formatTime';
import { bindMediaSessionHandlers, syncMediaSessionMetadata } from './mediaSession';
import { playerController } from './playerController';

export function NowPlayingBar() {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const positionMs = usePlayerStore((s) => s.positionMs);
  const volumePercent = usePlayerStore((s) => s.volumePercent);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const lyricsOpen = usePlayerStore((s) => s.lyricsOpen);
  const queueOpen = usePlayerStore((s) => s.queueOpen);
  const setLyricsOpen = usePlayerStore((s) => s.setLyricsOpen);
  const setQueueOpen = usePlayerStore((s) => s.setQueueOpen);
  const tickPosition = usePlayerStore((s) => s.tickPosition);

  useEffect(() => {
    bindMediaSessionHandlers({
      onPlay: () => {
        void playerController.togglePlayPause();
      },
      onPause: () => {
        void playerController.togglePlayPause();
      },
      onPrevious: () => {
        void playerController.previous();
      },
      onNext: () => {
        void playerController.next();
      },
      onSeekTo: (pos) => {
        void playerController.seekTo(pos);
      },
    });
  }, []);

  useEffect(() => {
    syncMediaSessionMetadata(currentTrack, isPlaying);
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    const artworkUrl = currentTrack?.album?.images[0]?.url ?? null;
    void applyDynamicAlbumAccentIfEnabled(artworkUrl);
  }, [currentTrack]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    const timer = setInterval(() => {
      tickPosition(250);
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, [isPlaying, tickPosition]);

  const durationMs = currentTrack?.duration_ms ?? 0;
  const coverUrl = currentTrack?.album?.images[0]?.url;
  const coverAlt = currentTrack?.album?.name ?? 'Album cover';
  const spotifyUrl = currentTrack?.external_urls.spotify;

  const openWindowMode = (mode: 'mini' | 'obs') => {
    const url = `${window.location.origin}/?mode=${mode}`;
    window.open(
      url,
      `pulse_${mode}`,
      mode === 'mini' ? 'width=420,height=160' : 'width=520,height=140',
    );
  };

  return (
    <footer className="pulse-playerbar" aria-label="Playback controls">
      {/* Left: Track identity + Spotify attribution link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '220px', flex: '1 1 240px' }}>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={coverAlt}
            width={52}
            height={52}
            style={{
              borderRadius: 'var(--pulse-radius-sm)',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--pulse-radius-sm)',
              background: 'var(--pulse-color-bg-elevated)',
              border: '1px solid var(--pulse-color-border-subtle)',
              flexShrink: 0,
            }}
          />
        )}

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {currentTrack ? currentTrack.name : 'No active track'}
          </div>
          <div
            style={{
              fontSize: '0.82rem',
              color: 'var(--pulse-color-text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {currentTrack
              ? currentTrack.artists.map((a) => a.name).join(', ')
              : 'Select a track or transfer Spotify Connect'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
            {spotifyUrl ? (
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '0.72rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <span>Open on Spotify</span>
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            ) : null}
            <PluginSlotView slot="now-playing-badge" />
          </div>
        </div>
      </div>

      {/* Center: Transport + scrubbable seek rail */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.3rem',
          flex: '2 1 360px',
          maxWidth: '560px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            aria-label="Toggle shuffle"
            aria-pressed={shuffle}
            onClick={() => {
              void playerController.toggleShuffle();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: shuffle ? 'var(--pulse-color-accent)' : 'var(--pulse-color-text-secondary)',
            }}
          >
            <Shuffle size={16} />
          </button>

          <button
            type="button"
            aria-label="Previous track"
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
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: 'none',
              background: 'var(--pulse-color-accent)',
              color: 'var(--pulse-color-text-inverse)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button
            type="button"
            aria-label="Next track"
            onClick={() => {
              void playerController.next();
            }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <SkipForward size={18} />
          </button>

          <button
            type="button"
            aria-label={`Repeat mode: ${repeatMode}`}
            onClick={() => {
              void playerController.cycleRepeatMode();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color:
                repeatMode !== 'off'
                  ? 'var(--pulse-color-accent)'
                  : 'var(--pulse-color-text-secondary)',
            }}
          >
            {repeatMode === 'track' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%' }}>
          <span
            style={{
              fontFamily: 'var(--pulse-font-mono)',
              fontSize: '0.75rem',
              color: 'var(--pulse-color-text-secondary)',
            }}
          >
            {formatDurationMs(positionMs)}
          </span>
          <input
            type="range"
            aria-label="Seek position"
            min={0}
            max={Math.max(1, durationMs)}
            value={Math.min(positionMs, Math.max(1, durationMs))}
            disabled={!currentTrack}
            onChange={(e) => {
              void playerController.seekTo(Number(e.target.value));
            }}
            style={{ flex: 1, accentColor: 'var(--pulse-color-accent)', cursor: 'pointer' }}
          />
          <span
            style={{
              fontFamily: 'var(--pulse-font-mono)',
              fontSize: '0.75rem',
              color: 'var(--pulse-color-text-secondary)',
            }}
          >
            {formatDurationMs(durationMs)}
          </span>
        </div>
      </div>

      {/* Right: Lyrics, Queue, Mini/OBS Popouts, Device Picker, Volume */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '0.55rem',
          flex: '1 1 240px',
        }}
      >
        <button
          type="button"
          aria-label="Synced lyrics panel"
          aria-pressed={lyricsOpen}
          onClick={() => {
            setLyricsOpen(!lyricsOpen);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: lyricsOpen ? 'var(--pulse-color-accent)' : 'var(--pulse-color-text-secondary)',
          }}
        >
          <MicVocal size={17} />
        </button>

        <button
          type="button"
          aria-label="Queue manager"
          aria-pressed={queueOpen}
          onClick={() => {
            setQueueOpen(!queueOpen);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: queueOpen ? 'var(--pulse-color-accent)' : 'var(--pulse-color-text-secondary)',
          }}
        >
          <ListMusic size={17} />
        </button>

        <button
          type="button"
          aria-label="Open Mini-Player window"
          title="Open Mini-Player"
          onClick={() => {
            openWindowMode('mini');
          }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--pulse-color-text-secondary)',
          }}
        >
          <PictureInPicture2 size={16} />
        </button>

        <button
          type="button"
          aria-label="Open OBS Now Playing Browser Source"
          title="Open OBS Overlay (?mode=obs)"
          onClick={() => {
            openWindowMode('obs');
          }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--pulse-color-text-secondary)',
          }}
        >
          <Tv size={16} />
        </button>

        <DevicePicker />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <Volume2 size={16} color="var(--pulse-color-text-secondary)" aria-hidden="true" />
          <input
            type="range"
            aria-label="Playback volume"
            min={0}
            max={100}
            value={volumePercent}
            onChange={(e) => {
              void playerController.setVolume(Number(e.target.value));
            }}
            style={{ width: '74px', accentColor: 'var(--pulse-color-accent)' }}
          />
        </div>
      </div>
    </footer>
  );
}
