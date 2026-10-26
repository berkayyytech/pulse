import { useEffect, useMemo, useState } from 'react';
import { FolderPlus, Save } from 'lucide-react';
import { getSpotifyClient } from '@/api/clientInstance';
import { VirtualizedTrackList } from '@/features/library/VirtualizedTrackList';
import { getAllListeningHistory } from '@/features/stats/historyService';
import { scheduleDesktopSettingsSave } from '@/platform/desktopSettingsSync';
import { pulseDb, type ListeningHistoryItem } from '@/storage/db';
import { useAchievementStore } from '@/stores/achievementStore';
import { useAuthStore } from '@/stores/authStore';
import {
  evaluateSmartPlaylist,
  type SavedTrackCandidate,
  type SmartPlaylistDefinition,
  type SmartRuleCondition,
} from './smartPlaylistEngine';

export default function SmartPlaylistsView() {
  const authStatus = useAuthStore((s) => s.status);
  const isConnected = authStatus === 'authenticated' || authStatus === 'demo';

  const [ruleName, setRuleName] = useState('Freshly Liked & Unplayed (30d / 90d)');
  const [matchMode, setMatchMode] = useState<'AND' | 'OR'>('AND');
  const [likedDays, setLikedDays] = useState(30);
  const [notPlayedDays, setNotPlayedDays] = useState(90);
  const [artistQuery, setArtistQuery] = useState('');
  const [excludeExplicit, setExcludeExplicit] = useState(false);

  const [candidates, setCandidates] = useState<SavedTrackCandidate[]>([]);
  const [history, setHistory] = useState<ListeningHistoryItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) {
      return;
    }
    void Promise.all([
      getSpotifyClient()
        .getSavedTracks(50, 0)
        .catch(() => null),
      getAllListeningHistory(),
    ]).then(([savedPage, localHistory]) => {
      if (savedPage) {
        setCandidates(
          savedPage.items.map((item) => ({
            addedAtIso: item.added_at,
            track: item.track,
          })),
        );
      }
      setHistory(localHistory);
    });
  }, [isConnected]);

  const definition = useMemo<SmartPlaylistDefinition>(() => {
    const conditions: SmartRuleCondition[] = [];
    if (likedDays > 0) {
      conditions.push({ kind: 'likedWithinDays', days: likedDays });
    }
    if (notPlayedDays > 0) {
      conditions.push({ kind: 'notPlayedWithinDays', days: notPlayedDays });
    }
    if (artistQuery.trim()) {
      conditions.push({ kind: 'artistContains', query: artistQuery });
    }
    if (excludeExplicit) {
      conditions.push({ kind: 'explicitIs', explicit: false });
    }
    return {
      id: 'active-smart-rule',
      name: ruleName,
      matchMode,
      conditions,
    };
  }, [artistQuery, excludeExplicit, likedDays, matchMode, notPlayedDays, ruleName]);

  const matchedTracks = useMemo(
    () => evaluateSmartPlaylist(definition, candidates, history),
    [candidates, definition, history],
  );

  const handleSaveSmartDefinition = async () => {
    const id = `smart_${Date.now()}`;
    await pulseDb.smartPlaylists.put({
      id,
      name: ruleName.trim() || 'Smart Playlist',
      description: `${matchMode} rule (${definition.conditions.length} conditions)`,
      rulesJson: JSON.stringify(definition),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    scheduleDesktopSettingsSave();
    useAchievementStore.getState().incrementMetric('smartPlaylistsCreated', 1);
    setStatusMessage(`Saved smart rule "${ruleName}" locally in IndexedDB.`);
  };

  const handleMaterializeToSpotify = async () => {
    if (matchedTracks.length === 0) {
      return;
    }
    const client = getSpotifyClient();
    const created = await client.createPlaylist({
      name: ruleName.trim() || 'Pulse Smart Playlist',
      description: 'Generated locally by Pulse Smart Playlist Rules',
    });
    await client.addItemsToPlaylist(
      created.id,
      matchedTracks.map((t) => t.uri),
    );
    setStatusMessage(`Exported ${matchedTracks.length} matching tracks to "${created.name}".`);
  };

  return (
    <section aria-labelledby="smart-playlists-heading">
      <h1
        id="smart-playlists-heading"
        style={{ fontFamily: 'var(--pulse-font-display)', marginTop: 0 }}
      >
        Smart Playlist Rules
      </h1>
      <p style={{ color: 'var(--pulse-color-text-secondary)', maxWidth: '68ch' }}>
        Build dynamic playlists evaluated locally over your saved library and opt-in play history
        (for example: <em>liked in the last 30 days AND not played in 90 days</em>).
      </p>

      {statusMessage ? (
        <p role="status" style={{ color: 'var(--pulse-color-signal)' }}>
          {statusMessage}
        </p>
      ) : null}

      <article className="pulse-card" style={{ marginBottom: '1.25rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.85rem',
          }}
        >
          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>Smart Playlist Name</span>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => {
                setRuleName(e.target.value);
              }}
              style={{
                padding: '6px 8px',
                borderRadius: 'var(--pulse-radius-sm)',
                border: '1px solid var(--pulse-color-border-strong)',
                background: 'var(--pulse-color-bg-canvas)',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>Combinator</span>
            <select
              aria-label="Rule combinator"
              value={matchMode}
              onChange={(e) => {
                setMatchMode(e.target.value as 'AND' | 'OR');
              }}
              style={{
                padding: '6px 8px',
                borderRadius: 'var(--pulse-radius-sm)',
                border: '1px solid var(--pulse-color-border-strong)',
                background: 'var(--pulse-color-bg-canvas)',
              }}
            >
              <option value="AND">Match ALL rules (AND)</option>
              <option value="OR">Match ANY rule (OR)</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
              Liked within last N days (0 = ignore)
            </span>
            <input
              type="number"
              min={0}
              value={likedDays}
              onChange={(e) => {
                setLikedDays(Math.max(0, Number(e.target.value)));
              }}
              style={{
                padding: '6px 8px',
                borderRadius: 'var(--pulse-radius-sm)',
                border: '1px solid var(--pulse-color-border-strong)',
                background: 'var(--pulse-color-bg-canvas)',
                fontFamily: 'var(--pulse-font-mono)',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
              Not played within N days (0 = ignore)
            </span>
            <input
              type="number"
              min={0}
              value={notPlayedDays}
              onChange={(e) => {
                setNotPlayedDays(Math.max(0, Number(e.target.value)));
              }}
              style={{
                padding: '6px 8px',
                borderRadius: 'var(--pulse-radius-sm)',
                border: '1px solid var(--pulse-color-border-strong)',
                background: 'var(--pulse-color-bg-canvas)',
                fontFamily: 'var(--pulse-font-mono)',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>Artist contains</span>
            <input
              type="text"
              placeholder="Optional artist filter…"
              value={artistQuery}
              onChange={(e) => {
                setArtistQuery(e.target.value);
              }}
              style={{
                padding: '6px 8px',
                borderRadius: 'var(--pulse-radius-sm)',
                border: '1px solid var(--pulse-color-border-strong)',
                background: 'var(--pulse-color-bg-canvas)',
              }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.3rem' }}>
            <input
              type="checkbox"
              checked={excludeExplicit}
              onChange={(e) => {
                setExcludeExplicit(e.target.checked);
              }}
            />
            <span>Exclude explicit tracks</span>
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={() => {
              void handleSaveSmartDefinition();
            }}
            className="pulse-mono-pill"
            style={{ cursor: 'pointer', padding: '0.4rem 0.85rem' }}
          >
            <Save size={14} />
            <span>Save Smart Rule Locally</span>
          </button>

          <button
            type="button"
            disabled={!isConnected || matchedTracks.length === 0}
            onClick={() => {
              void handleMaterializeToSpotify();
            }}
            className="pulse-mono-pill"
            data-tone="accent"
            style={{ cursor: 'pointer', padding: '0.4rem 0.85rem' }}
          >
            <FolderPlus size={14} />
            <span>Save Matching ({matchedTracks.length}) as Spotify Playlist</span>
          </button>
        </div>
      </article>

      <VirtualizedTrackList tracks={matchedTracks} heightPx={340} />
    </section>
  );
}
