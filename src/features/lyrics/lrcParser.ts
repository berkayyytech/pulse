export interface SyncedLyricLine {
  readonly timeMs: number;
  readonly text: string;
}

const LRC_TIMESTAMP_REGEX = /^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/;

/**
 * Parses standard LRC synced lyric lines (`[mm:ss.xx] Lyric text`) into sorted millisecond cues.
 */
export function parseSyncedLrc(lrcContent: string): SyncedLyricLine[] {
  const lines: SyncedLyricLine[] = [];

  for (const rawLine of lrcContent.split(/\r?\n/)) {
    const match = LRC_TIMESTAMP_REGEX.exec(rawLine.trim());
    if (!match) {
      continue;
    }
    const minutes = Number(match[1] ?? '0');
    const seconds = Number(match[2] ?? '0');
    const fractionRaw = match[3] ?? '0';
    const fractionMs =
      fractionRaw.length === 1
        ? Number(fractionRaw) * 100
        : fractionRaw.length === 2
          ? Number(fractionRaw) * 10
          : Number(fractionRaw.slice(0, 3));
    const text = (match[4] ?? '').trim();

    lines.push({
      timeMs: minutes * 60_000 + seconds * 1000 + fractionMs,
      text,
    });
  }

  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

export function findActiveLyricIndex(
  lines: readonly SyncedLyricLine[],
  positionMs: number,
): number {
  let active = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line && line.timeMs <= positionMs) {
      active = i;
    } else {
      break;
    }
  }
  return active;
}
