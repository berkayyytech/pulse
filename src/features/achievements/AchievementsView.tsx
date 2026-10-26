import { useMemo, useState } from 'react';
import { Award, Lock, Search, Sparkles, Trophy } from 'lucide-react';
import { useAchievementStore } from '@/stores/achievementStore';
import {
  ACHIEVEMENT_CATALOG,
  ACHIEVEMENT_CATEGORY_LABELS,
  TIER_XP,
  computeListenerRank,
  type AchievementCategory,
  type AchievementTier,
} from './achievementCatalog';

type StatusFilter = 'all' | 'unlocked' | 'locked';

const TIER_COLORS: Readonly<Record<AchievementTier, string>> = {
  bronze: '#cd7f32',
  silver: '#94a3b8',
  gold: '#f59e0b',
  platinum: '#38bdf8',
  mythic: '#e879f9',
};

export default function AchievementsView() {
  const metrics = useAchievementStore((s) => s.metrics);
  const unlockedAt = useAchievementStore((s) => s.unlockedAt);
  const totalXp = useAchievementStore((s) => s.totalXp);
  const toastsEnabled = useAchievementStore((s) => s.toastsEnabled);
  const setToastsEnabled = useAchievementStore((s) => s.setToastsEnabled);

  const [categoryFilter, setCategoryFilter] = useState<'all' | AchievementCategory>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  const unlockedCount = useMemo(() => Object.keys(unlockedAt).length, [unlockedAt]);
  const rank = useMemo(() => computeListenerRank(totalXp), [totalXp]);
  const completionPct = ((unlockedCount / ACHIEVEMENT_CATALOG.length) * 100).toFixed(1);

  const filteredList = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ACHIEVEMENT_CATALOG.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      const isUnlocked = unlockedAt[item.id] !== undefined;
      if (statusFilter === 'unlocked' && !isUnlocked) {
        return false;
      }
      if (statusFilter === 'locked' && isUnlocked) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const searchableTitle = item.secret && !isUnlocked ? '??? secret easter egg' : item.title;
      const searchableDesc =
        item.secret && !isUnlocked ? (item.secretHint ?? '') : item.description;
      return (
        searchableTitle.toLowerCase().includes(needle) ||
        searchableDesc.toLowerCase().includes(needle)
      );
    });
  }, [categoryFilter, query, statusFilter, unlockedAt]);

  return (
    <section aria-labelledby="achievements-heading">
      {/* Top Rank & Completion Card */}
      <div
        className="pulse-card"
        style={{
          display: 'grid',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--pulse-radius-md)',
                background: 'var(--pulse-color-bg-elevated)',
                display: 'grid',
                placeItems: 'center',
                color: '#f59e0b',
              }}
            >
              <Trophy size={24} />
            </div>
            <div>
              <h1 id="achievements-heading" style={{ margin: 0, fontSize: '1.35rem' }}>
                Level {rank.level} — {rank.title}
              </h1>
              <div style={{ fontSize: '0.86rem', color: 'var(--pulse-color-text-secondary)' }}>
                <strong>{unlockedCount}</strong> / {ACHIEVEMENT_CATALOG.length} Achievements
                Unlocked ({completionPct}%) • <strong>{totalXp} XP</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.84rem' }}>Unlock Popups</span>
            <button
              type="button"
              role="switch"
              aria-label="Achievement unlock popups"
              aria-checked={toastsEnabled}
              className="gp-switch"
              onClick={() => {
                setToastsEnabled(!toastsEnabled);
              }}
            >
              <span className="gp-switch-knob" />
            </button>
          </div>
        </div>

        {/* Overall Progress Rail */}
        <div
          style={{
            height: '8px',
            borderRadius: 'var(--pulse-radius-pill)',
            background: 'var(--pulse-color-slider-track)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${completionPct}%`,
              height: '100%',
              background: 'var(--pulse-color-signal)',
              transition: 'width 280ms ease',
            }}
          />
        </div>
      </div>

      {/* Filters & Search */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '12px',
        }}
      >
        <div className="gp-search-box" style={{ maxWidth: '300px', padding: '7px 12px' }}>
          <Search size={14} style={{ opacity: 0.6 }} aria-hidden="true" />
          <input
            type="search"
            className="gp-search-input"
            aria-label="Search achievements"
            placeholder="Filter 248 achievements…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '5px' }}>
          {(
            [
              ['all', 'All'],
              ['unlocked', `Unlocked (${unlockedCount})`],
              ['locked', `Locked (${ACHIEVEMENT_CATALOG.length - unlockedCount})`],
            ] as readonly [StatusFilter, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="gp-seg-pill"
              data-active={statusFilter === id}
              style={{
                padding: '5px 11px',
                fontSize: '0.8rem',
                border: '1px solid var(--pulse-color-border-subtle)',
              }}
              onClick={() => {
                setStatusFilter(id);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          marginBottom: '16px',
        }}
        role="group"
        aria-label="Achievement categories"
      >
        <button
          type="button"
          className="gp-seg-pill"
          data-active={categoryFilter === 'all'}
          style={{
            padding: '4px 12px',
            fontSize: '0.8rem',
            border: '1px solid var(--pulse-color-border-subtle)',
          }}
          onClick={() => {
            setCategoryFilter('all');
          }}
        >
          All ({ACHIEVEMENT_CATALOG.length})
        </button>
        {(Object.entries(ACHIEVEMENT_CATEGORY_LABELS) as [AchievementCategory, string][]).map(
          ([cat, label]) => (
            <button
              key={cat}
              type="button"
              className="gp-seg-pill"
              data-active={categoryFilter === cat}
              style={{
                padding: '4px 12px',
                fontSize: '0.8rem',
                border: '1px solid var(--pulse-color-border-subtle)',
              }}
              onClick={() => {
                setCategoryFilter(cat);
              }}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {/* Achievements Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))',
          gap: '10px',
        }}
      >
        {filteredList.map((def) => {
          const unlockedTimestamp = unlockedAt[def.id];
          const isUnlocked = unlockedTimestamp !== undefined;
          const isHiddenSecret = Boolean(def.secret && !isUnlocked);
          const tierColor = TIER_COLORS[def.tier];

          const currentVal = def.metric ? metrics[def.metric] : isUnlocked ? 1 : 0;
          const targetVal = def.target ?? 1;
          const pct = Math.min(100, Math.round((currentVal / Math.max(1, targetVal)) * 100));

          return (
            <article
              key={def.id}
              className="pulse-card"
              style={{
                padding: '13px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px',
                opacity: isUnlocked ? 1 : 0.78,
                borderColor: isUnlocked ? tierColor : undefined,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 600,
                      fontSize: '0.93rem',
                    }}
                  >
                    {isUnlocked ? (
                      <Award size={15} color={tierColor} aria-hidden="true" />
                    ) : isHiddenSecret ? (
                      <Sparkles size={14} color={tierColor} aria-hidden="true" />
                    ) : (
                      <Lock size={13} style={{ opacity: 0.5 }} aria-hidden="true" />
                    )}
                    <span>{isHiddenSecret ? '??? Secret Easter Egg' : def.title}</span>
                  </span>

                  <span
                    className="pulse-mono-pill"
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 7px',
                      color: tierColor,
                      borderColor: tierColor,
                    }}
                  >
                    +{TIER_XP[def.tier]} XP
                  </span>
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: '0.82rem',
                    color: 'var(--pulse-color-text-secondary)',
                    lineHeight: 1.38,
                  }}
                >
                  {isHiddenSecret
                    ? (def.secretHint ?? 'Explore hidden corners of Pulse to uncover this secret.')
                    : def.description}
                </p>
              </div>

              {def.metric && def.target !== undefined ? (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.73rem',
                      color: 'var(--pulse-color-text-muted)',
                      marginBottom: '3px',
                    }}
                  >
                    <span>
                      {Math.min(currentVal, targetVal)} / {targetVal} {def.unit ?? ''}
                    </span>
                    <span>{isUnlocked ? 'Unlocked ✓' : `${pct}%`}</span>
                  </div>
                  <div
                    style={{
                      height: '4px',
                      borderRadius: '999px',
                      background: 'var(--pulse-color-slider-track)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: isUnlocked ? 'var(--pulse-color-signal)' : tierColor,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: '0.73rem',
                    color: isUnlocked
                      ? 'var(--pulse-color-signal)'
                      : 'var(--pulse-color-text-muted)',
                  }}
                >
                  {isUnlocked ? 'Unlocked ✓' : isHiddenSecret ? 'Secret Badge' : 'Locked'}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
