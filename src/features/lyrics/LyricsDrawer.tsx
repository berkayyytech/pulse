import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getExternalSourcesConfig } from '@/features/privacy/externalSourcesSettings';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';
import {
  fetchOptInLyrics,
  fetchOptInTrackGapMetadata,
  type ExternalTrackMetadata,
  type LyricsLookupResult,
} from './externalMetadataService';
import { findActiveLyricIndex } from './lrcParser';
import { playerController } from '@/features/player/playerController';

export function LyricsDrawer() {
  const lyricsOpen = usePlayerStore((s) => s.lyricsOpen);
  const setLyricsOpen = usePlayerStore((s) => s.setLyricsOpen);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const positionMs = usePlayerStore((s) => s.positionMs);
  const setActiveRoute = useUiStore((s) => s.setActiveRoute);

  const [lyrics, setLyrics] = useState<LyricsLookupResult | null>(null);
  const [gapMeta, setGapMeta] = useState<ExternalTrackMetadata | null>(null);

  const sourcesCfg = getExternalSourcesConfig();

  useEffect(() => {
    if (!lyricsOpen || !currentTrack) {
      setLyrics(null);
      setGapMeta(null);
      return;
    }
    let active = true;
    void Promise.all([
      fetchOptInLyrics(currentTrack),
      fetchOptInTrackGapMetadata(currentTrack),
    ]).then(([lyr, meta]) => {
      if (!active) {
        return;
      }
      setLyrics(lyr);
      setGapMeta(meta);
    });
    return () => {
      active = false;
    };
  }, [lyricsOpen, currentTrack]);

  if (!lyricsOpen) {
    return null;
  }

  const activeIdx = lyrics ? findActiveLyricIndex(lyrics.syncedLines, positionMs) : -1;

  return (
    <aside
      aria-label="Synced lyrics and external metadata"
      className="pulse-card"
      style={{
        position: 'fixed',
        top: '56px',
        right: '16px',
        bottom: '16px',
        width: '400px',
        maxWidth: 'calc(100vw - 2rem)',
        overflowY: 'auto',
        background: 'var(--pulse-color-bg-glass)',
        backdropFilter: 'blur(44px) saturate(160%)',
        borderRadius: '24px',
        boxShadow: 'var(--pulse-shadow-elevated)',
        zIndex: 75,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Synced Lyrics & Metadata</h2>
        <button
          type="button"
          aria-label="Close synced lyrics"
          onClick={() => {
            setLyricsOpen(false);
          }}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      {gapMeta ? (
        <div style={{ marginTop: '0.6rem' }}>
          <span className="pulse-mono-pill" data-tone="signal">
            External: {gapMeta.sources.join(' + ')}
          </span>
          {gapMeta.isrc ? (
            <div style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--pulse-color-text-secondary)' }}>
              ISRC: <code>{gapMeta.isrc}</code>
            </div>
          ) : null}
        </div>
      ) : null}

      {!sourcesCfg.lrclibEnabled ? (
        <div style={{ marginTop: '1rem' }}>
          <p style={{ color: 'var(--pulse-color-text-secondary)', fontSize: '0.9rem' }}>
            External synced lyrics (LRCLIB) and MusicBrainz metadata gap-filling are disabled by
            default for privacy.
          </p>
          <button
            type="button"
            className="pulse-nav-btn"
            style={{ width: 'auto', border: '1px solid var(--pulse-color-border-strong)' }}
            onClick={() => {
              setLyricsOpen(false);
              setActiveRoute('privacy');
            }}
          >
            Enable in Privacy & Sources
          </button>
        </div>
      ) : !currentTrack ? (
        <p style={{ color: 'var(--pulse-color-text-muted)' }}>Start a track to load synced lyrics.</p>
      ) : !lyrics ? (
        <p style={{ color: 'var(--pulse-color-text-muted)' }}>
          Searching LRCLIB for “{currentTrack.name}”…
        </p>
      ) : lyrics.syncedLines.length > 0 ? (
        <div style={{ marginTop: '0.75rem' }}>
          <span className="pulse-mono-pill" data-tone="accent">
            Source: {lyrics.source}
          </span>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0.85rem 0 0' }}>
            {lyrics.syncedLines.map((line, idx) => {
              const isCurrent = idx === activeIdx;
              return (
                <li key={`${line.timeMs}_${idx}`} style={{ marginBottom: '0.45rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      void playerController.seekTo(line.timeMs);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontWeight: isCurrent ? 700 : 400,
                      fontSize: isCurrent ? '1.02rem' : '0.9rem',
                      color: isCurrent
                        ? 'var(--pulse-color-accent)'
                        : 'var(--pulse-color-text-secondary)',
                    }}
                  >
                    {line.text || '♪'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div style={{ marginTop: '0.75rem' }}>
          <span className="pulse-mono-pill">Source: LRCLIB</span>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'var(--pulse-font-sans)',
              fontSize: '0.9rem',
              color: 'var(--pulse-color-text-secondary)',
            }}
          >
            {lyrics.plainLyrics ?? 'No synced lyrics found on LRCLIB for this track.'}
          </pre>
        </div>
      )}
    </aside>
  );
}
