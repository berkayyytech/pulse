import { useEffect, useRef, type CSSProperties } from 'react';
import {
  ListMusic,
  MicVocal,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DEMO_USER } from '@/api/demoCatalog';
import { formatDurationMs } from '@/features/player/formatTime';
import { bindMediaSessionHandlers, syncMediaSessionMetadata } from '@/features/player/mediaSession';
import { playerController } from '@/features/player/playerController';
import { PluginSlotView } from '@/features/plugins/PluginSlotView';
import { applyDynamicAlbumAccentIfEnabled } from '@/features/themes/extractDominantAccent';
import { openPulsePopupWindow } from '@/platform/openExternal';
import { useAchievementStore } from '@/stores/achievementStore';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';

const FALLBACK_HERO_ART =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="560"><defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#3A425A"/><stop offset="100%" stop-color="#171A26"/></linearGradient></defs><rect width="560" height="560" fill="url(#hg)"/><circle cx="280" cy="280" r="110" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="12" fill="none"/></svg>',
  );

export function RightGlassStage() {
  const authStatus = useAuthStore((s) => s.status);
  const setDemoSession = useAuthStore((s) => s.setDemoSession);

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

  const coverTapTimesRef = useRef<number[]>([]);

  const handleCoverArtClick = () => {
    const now = Date.now();
    const recent = coverTapTimesRef.current.filter((t) => now - t < 2800);
    recent.push(now);
    coverTapTimesRef.current = recent;
    if (recent.length >= 7) {
      coverTapTimesRef.current = [];
      useAchievementStore.getState().triggerEasterEgg('vinyl-scratch');
    }
  };

  useEffect(() => {
    bindMediaSessionHandlers({
      onPlay: () => {
        void playerController.togglePlayPause();
      },
      onPause: () => {
        void playerController.togglePlayPause();
      },
      onNext: () => {
        void playerController.next();
      },
      onPrevious: () => {
        void playerController.previous();
      },
      onSeekTo: (ms) => {
        void playerController.seekTo(ms);
      },
    });
  }, []);

  useEffect(() => {
    syncMediaSessionMetadata(currentTrack, isPlaying);
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }
    const timer = setInterval(() => {
      tickPosition(250);
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, [isPlaying, tickPosition]);

  useEffect(() => {
    const coverUrl = currentTrack?.album?.images[0]?.url ?? null;
    void applyDynamicAlbumAccentIfEnabled(coverUrl);
  }, [currentTrack]);

  const ensureSessionBeforeControl = () => {
    if (authStatus !== 'authenticated' && authStatus !== 'demo') {
      setDemoSession(DEMO_USER);
    }
  };

  const coverUrl = currentTrack?.album?.images[0]?.url ?? FALLBACK_HERO_ART;
  const durationMs = Math.max(1, currentTrack?.duration_ms ?? 1);
  const clampedPos = Math.min(positionMs, durationMs);
  const seekProgressPct = (clampedPos / durationMs) * 100;

  const seekStyle = {
    '--gp-progress': `${seekProgressPct.toFixed(2)}%`,
  } as CSSProperties;

  const volumeStyle = {
    '--gp-progress': `${volumePercent}%`,
    width: '140px',
  } as CSSProperties;

  return (
    <section className="gp-glass-panel gp-right-stage" aria-label="Now playing stage">
      {/* Subtle Top-Right Stage Controls (Shuffle, Repeat, Lyrics, Queue, Mini) */}
      <div className="gp-stage-aux">
        <button
          type="button"
          className="gp-round-btn"
          aria-label="Toggle shuffle"
          aria-pressed={shuffle}
          style={{
            width: '30px',
            height: '30px',
            background: shuffle ? 'rgba(255,255,255,0.2)' : undefined,
          }}
          onClick={() => {
            ensureSessionBeforeControl();
            void playerController.toggleShuffle();
          }}
        >
          <Shuffle size={13} />
        </button>

        <button
          type="button"
          className="gp-round-btn"
          aria-label={`Repeat mode (${repeatMode})`}
          style={{
            width: '30px',
            height: '30px',
            background: repeatMode !== 'off' ? 'rgba(255,255,255,0.2)' : undefined,
          }}
          onClick={() => {
            ensureSessionBeforeControl();
            void playerController.cycleRepeatMode();
          }}
        >
          <Repeat size={13} />
        </button>

        <button
          type="button"
          className="gp-round-btn"
          aria-label="Synced lyrics & metadata"
          aria-pressed={lyricsOpen}
          style={{
            width: '30px',
            height: '30px',
            background: lyricsOpen ? 'rgba(255,255,255,0.2)' : undefined,
          }}
          onClick={() => {
            if (!lyricsOpen) {
              useAchievementStore.getState().incrementMetric('lyricsOpenedCount', 1);
            }
            setLyricsOpen(!lyricsOpen);
          }}
        >
          <MicVocal size={13} />
        </button>

        <button
          type="button"
          className="gp-round-btn"
          aria-label="Toggle playback queue"
          aria-pressed={queueOpen}
          style={{
            width: '30px',
            height: '30px',
            background: queueOpen ? 'rgba(255,255,255,0.2)' : undefined,
          }}
          onClick={() => {
            if (!queueOpen) {
              useAchievementStore.getState().incrementMetric('queueOpenedCount', 1);
            }
            setQueueOpen(!queueOpen);
          }}
        >
          <ListMusic size={13} />
        </button>

        <button
          type="button"
          className="gp-round-btn"
          aria-label="Open compact mini-player"
          style={{ width: '30px', height: '30px' }}
          onClick={() => {
            useAchievementStore.getState().setFlag('openedMiniPlayer');
            void openPulsePopupWindow('mini');
          }}
        >
          <PictureInPicture2 size={13} />
        </button>
      </div>

      <div className="gp-stage-inner">
        {/* Hero Cover Art (7x rapid tap triggers DJ Turntablist Easter Egg!) */}
        <div
          className="gp-hero-art-wrap"
          data-playing={isPlaying}
          onClick={handleCoverArtClick}
          style={{ cursor: 'pointer' }}
        >
          <img
            src={coverUrl}
            alt={currentTrack?.album?.name ?? 'Album artwork'}
            className="gp-hero-art"
          />
        </div>

        {/* Centered 26px Track Title & 16px Artist */}
        <h1 className="gp-stage-title">{currentTrack ? currentTrack.name : 'Nothing playing'}</h1>
        <p className="gp-stage-artist">
          {currentTrack
            ? currentTrack.artists.map((a) => a.name).join(', ')
            : 'Pick a track from the list'}
        </p>

        {/* Seek Rail & Timestamps */}
        <div className="gp-stage-seek-group">
          <input
            type="range"
            className="gp-range"
            aria-label="Seek position"
            min={0}
            max={durationMs}
            value={clampedPos}
            style={seekStyle}
            onChange={(e) => {
              ensureSessionBeforeControl();
              void playerController.seekTo(Number(e.target.value));
            }}
          />
          <div className="gp-time-row">
            <span>{formatDurationMs(clampedPos)}</span>
            <span>{currentTrack ? formatDurationMs(currentTrack.duration_ms) : '0:00'}</span>
          </div>
        </div>

        {/* Centered Outline Transport Controls (52px / 68px / 52px) */}
        <div className="gp-transport-row">
          <button
            type="button"
            className="gp-round-btn"
            aria-label="Previous track"
            style={{ width: '52px', height: '52px' }}
            onClick={() => {
              ensureSessionBeforeControl();
              void playerController.previous();
            }}
          >
            <SkipBack size={24} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            className="gp-round-btn"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            style={{ width: '68px', height: '68px' }}
            onClick={() => {
              ensureSessionBeforeControl();
              void playerController.togglePlayPause();
            }}
          >
            {isPlaying ? (
              <Pause size={34} strokeWidth={1.75} />
            ) : (
              <Play size={34} strokeWidth={1.75} style={{ marginLeft: '3px' }} />
            )}
          </button>

          <button
            type="button"
            className="gp-round-btn"
            aria-label="Next track"
            style={{ width: '52px', height: '52px' }}
            onClick={() => {
              ensureSessionBeforeControl();
              void playerController.next();
            }}
          >
            <SkipForward size={24} strokeWidth={1.75} />
          </button>
        </div>

        {/* Centered 140px Volume Slider */}
        <div className="gp-volume-row">
          <button
            type="button"
            className="gp-round-btn"
            aria-label={volumePercent === 0 ? 'Unmute' : 'Mute'}
            style={{ width: '28px', height: '28px', opacity: 0.65 }}
            onClick={() => {
              void playerController.setVolume(volumePercent === 0 ? 80 : 0);
            }}
          >
            {volumePercent === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            className="gp-range"
            aria-label="Playback volume"
            min={0}
            max={100}
            value={volumePercent}
            style={volumeStyle}
            onChange={(e) => {
              void playerController.setVolume(Number(e.target.value));
            }}
          />
        </div>

        <PluginSlotView slot="now-playing-badge" />
      </div>
    </section>
  );
}
