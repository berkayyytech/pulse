import type { Track } from '@/api/schemas/catalog';

export interface MediaSessionHandlers {
  readonly onPlay: () => void;
  readonly onPause: () => void;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onSeekTo: (positionMs: number) => void;
}

export function bindMediaSessionHandlers(handlers: MediaSessionHandlers): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return;
  }
  const ms = navigator.mediaSession;
  try {
    ms.setActionHandler('play', handlers.onPlay);
    ms.setActionHandler('pause', handlers.onPause);
    ms.setActionHandler('previoustrack', handlers.onPrevious);
    ms.setActionHandler('nexttrack', handlers.onNext);
    ms.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        handlers.onSeekTo(Math.round(details.seekTime * 1000));
      }
    });
  } catch {
    // Some embedded WebViews only support a subset of MediaSession actions
  }
}

export function syncMediaSessionMetadata(track: Track | null, isPlaying: boolean): void {
  if (
    typeof navigator === 'undefined' ||
    !('mediaSession' in navigator) ||
    typeof MediaMetadata === 'undefined'
  ) {
    return;
  }
  const ms = navigator.mediaSession;
  ms.playbackState = track ? (isPlaying ? 'playing' : 'paused') : 'none';
  if (!track) {
    ms.metadata = null;
    return;
  }
  ms.metadata = new MediaMetadata({
    title: track.name,
    artist: track.artists.map((a) => a.name).join(', '),
    album: track.album?.name ?? '',
    artwork: (track.album?.images ?? []).map((img) => ({
      src: img.url,
      sizes: `${img.width ?? 300}x${img.height ?? 300}`,
      type: 'image/jpeg',
    })),
  });
}
