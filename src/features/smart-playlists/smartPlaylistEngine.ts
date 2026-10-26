import type { Track } from '@/api/schemas/catalog';
import type { ListeningHistoryItem } from '@/storage/db';

export type SmartRuleCondition =
  | { readonly kind: 'likedWithinDays'; readonly days: number }
  | { readonly kind: 'notPlayedWithinDays'; readonly days: number }
  | { readonly kind: 'durationAtMostMinutes'; readonly minutes: number }
  | { readonly kind: 'durationAtLeastMinutes'; readonly minutes: number }
  | { readonly kind: 'artistContains'; readonly query: string }
  | { readonly kind: 'titleContains'; readonly query: string }
  | { readonly kind: 'explicitIs'; readonly explicit: boolean };

export interface SmartPlaylistDefinition {
  readonly id: string;
  readonly name: string;
  readonly matchMode: 'AND' | 'OR';
  readonly conditions: readonly SmartRuleCondition[];
}

export interface SavedTrackCandidate {
  readonly addedAtIso: string;
  readonly track: Track;
}

const MS_PER_DAY = 86_400_000;

export function evaluateSmartPlaylist(
  definition: SmartPlaylistDefinition,
  candidates: readonly SavedTrackCandidate[],
  history: readonly ListeningHistoryItem[],
  nowMs: number = Date.now(),
): Track[] {
  if (definition.conditions.length === 0) {
    return candidates.map((c) => c.track);
  }

  const latestPlayedByUri = new Map<string, number>();
  for (const entry of history) {
    const ts = Date.parse(entry.playedAtIso);
    if (!Number.isNaN(ts)) {
      const existing = latestPlayedByUri.get(entry.trackUri) ?? 0;
      if (ts > existing) {
        latestPlayedByUri.set(entry.trackUri, ts);
      }
    }
  }

  const matchesCondition = (
    candidate: SavedTrackCandidate,
    cond: SmartRuleCondition,
  ): boolean => {
    switch (cond.kind) {
      case 'likedWithinDays': {
        const addedMs = Date.parse(candidate.addedAtIso);
        if (Number.isNaN(addedMs)) {
          return false;
        }
        return nowMs - addedMs <= cond.days * MS_PER_DAY;
      }

      case 'notPlayedWithinDays': {
        const lastPlayedMs = latestPlayedByUri.get(candidate.track.uri);
        if (lastPlayedMs === undefined) {
          return true;
        }
        return nowMs - lastPlayedMs >= cond.days * MS_PER_DAY;
      }

      case 'durationAtMostMinutes': {
        return candidate.track.duration_ms <= cond.minutes * 60_000;
      }

      case 'durationAtLeastMinutes': {
        return candidate.track.duration_ms >= cond.minutes * 60_000;
      }

      case 'artistContains': {
        const needle = cond.query.trim().toLowerCase();
        if (!needle) {
          return true;
        }
        return candidate.track.artists.some((a) => a.name.toLowerCase().includes(needle));
      }

      case 'titleContains': {
        const needle = cond.query.trim().toLowerCase();
        if (!needle) {
          return true;
        }
        return candidate.track.name.toLowerCase().includes(needle);
      }

      case 'explicitIs': {
        return candidate.track.explicit === cond.explicit;
      }
    }
  };

  return candidates
    .filter((candidate) =>
      definition.matchMode === 'AND'
        ? definition.conditions.every((cond) => matchesCondition(candidate, cond))
        : definition.conditions.some((cond) => matchesCondition(candidate, cond)),
    )
    .map((c) => c.track);
}
