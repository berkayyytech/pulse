import { useEffect, useRef, useState } from 'react';
import { Award, Disc3, Sparkles, X } from 'lucide-react';
import { TIER_XP } from '@/features/achievements/achievementCatalog';
import { useAchievementStore } from '@/stores/achievementStore';

const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
] as const;

const DVD_COLORS = ['#00e5ff', '#39ff14', '#ff3b30', '#febc2e', '#cba6f7', '#f472b6'] as const;

const MATRIX_GLYPHS = '01PULSE7F9ACRT303808909SYNTHΩΔλ';

export function EasterEggOverlay() {
  const recentToast = useAchievementStore((s) => s.recentToast);
  const dismissToast = useAchievementStore((s) => s.dismissToast);
  const activeEasterEgg = useAchievementStore((s) => s.activeEasterEgg);
  const triggerEasterEgg = useAchievementStore((s) => s.triggerEasterEgg);
  const setFlag = useAchievementStore((s) => s.setFlag);

  const konamiIdxRef = useRef(0);
  const [dvdPos, setDvdPos] = useState({ x: 80, y: 90, colorIdx: 0 });

  // 1. Auto-dismiss Achievement Unlock Toast after 3.8s
  useEffect(() => {
    if (!recentToast) {
      return undefined;
    }
    const timer = setTimeout(() => {
      dismissToast();
    }, 3800);
    return () => {
      clearTimeout(timer);
    };
  }, [dismissToast, recentToast]);

  // 2. Global Konami Code Listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const normalized = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const expected = KONAMI_SEQUENCE[konamiIdxRef.current];
      if (normalized === expected) {
        konamiIdxRef.current += 1;
        if (konamiIdxRef.current === KONAMI_SEQUENCE.length) {
          konamiIdxRef.current = 0;
          triggerEasterEgg('konami');
        }
      } else {
        konamiIdxRef.current = normalized === KONAMI_SEQUENCE[0] ? 1 : 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [triggerEasterEgg]);

  // 3. Auto-clear transient Easter Eggs (except persistent ambient ones like dvd / rain)
  useEffect(() => {
    if (
      !activeEasterEgg ||
      activeEasterEgg === 'dvd' ||
      activeEasterEgg === 'rain' ||
      activeEasterEgg === 'secret-arcade'
    ) {
      return undefined;
    }
    const duration = activeEasterEgg === 'barrel-roll' ? 1300 : 6500;
    const timer = setTimeout(() => {
      triggerEasterEgg(null);
    }, duration);
    return () => {
      clearTimeout(timer);
    };
  }, [activeEasterEgg, triggerEasterEgg]);

  // 4. Bouncing DVD Logo Physics + Corner-Hit Detector!
  useEffect(() => {
    if (activeEasterEgg !== 'dvd') {
      return undefined;
    }
    let x = 90;
    let y = 90;
    let vx = 2.6;
    let vy = 2.1;
    let colorIdx = 0;
    const boxW = 132;
    const boxH = 54;

    const interval = setInterval(() => {
      const maxW = Math.max(240, window.innerWidth - boxW);
      const maxH = Math.max(180, window.innerHeight - boxH);
      x += vx;
      y += vy;

      let hitX = false;
      let hitY = false;

      if (x <= 0) {
        x = 0;
        vx = Math.abs(vx);
        hitX = true;
      } else if (x >= maxW) {
        x = maxW;
        vx = -Math.abs(vx);
        hitX = true;
      }

      if (y <= 0) {
        y = 0;
        vy = Math.abs(vy);
        hitY = true;
      } else if (y >= maxH) {
        y = maxH;
        vy = -Math.abs(vy);
        hitY = true;
      }

      if (hitX || hitY) {
        colorIdx = (colorIdx + 1) % DVD_COLORS.length;
      }

      // Check true corner hit (both axes bounce or within 12px of perpendicular wall)
      if ((hitX && hitY) || (hitX && (y < 12 || y > maxH - 12)) || (hitY && (x < 12 || x > maxW - 12))) {
        setFlag('eggDvdCornerHit');
      }

      setDvdPos({ x, y, colorIdx });
    }, 16);

    return () => {
      clearInterval(interval);
    };
  }, [activeEasterEgg, setFlag]);

  return (
    <>
      {/* Interactive Easter Egg Visual Layers */}
      {activeEasterEgg === 'dvd' ? (
        <div
          role="status"
          aria-label="Bouncing DVD Easter Egg"
          onClick={() => {
            triggerEasterEgg(null);
          }}
          title="Click to dismiss DVD screensaver"
          style={{
            position: 'fixed',
            left: `${dvdPos.x}px`,
            top: `${dvdPos.y}px`,
            width: '132px',
            height: '54px',
            zIndex: 140,
            borderRadius: '12px',
            background: '#090b10',
            border: `2.5px solid ${DVD_COLORS[dvdPos.colorIdx] ?? '#00e5ff'}`,
            color: DVD_COLORS[dvdPos.colorIdx] ?? '#00e5ff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--pulse-font-mono)',
            fontWeight: 800,
            letterSpacing: '0.1em',
            cursor: 'pointer',
            boxShadow: `0 0 22px ${DVD_COLORS[dvdPos.colorIdx] ?? '#00e5ff'}66`,
          }}
        >
          <span style={{ fontSize: '15px' }}>PULSE</span>
          <span style={{ fontSize: '9px', opacity: 0.8 }}>VIDEO • DVD</span>
        </div>
      ) : null}

      {activeEasterEgg === 'rave' ? (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '24px',
            right: '24px',
            bottom: '16px',
            height: '72px',
            zIndex: 135,
            display: 'grid',
            gridTemplateColumns: 'repeat(16, 1fr)',
            gap: '6px',
            alignItems: 'end',
            pointerEvents: 'none',
          }}
        >
          {Array.from({ length: 16 }).map((_, idx) => (
            <span
              key={idx}
              style={{
                height: '100%',
                borderRadius: '6px 6px 0 0',
                transformOrigin: 'bottom',
                background: `hsl(${(idx * 22) % 360} 92% 58%)`,
                animation: `gpEqBounce ${240 + (idx % 5) * 75}ms ease-in-out infinite alternate`,
                opacity: 0.86,
              }}
            />
          ))}
        </div>
      ) : null}

      {activeEasterEgg === 'matrix' ? (
        <div
          role="status"
          onClick={() => {
            triggerEasterEgg(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 140,
            background: 'rgba(2, 10, 4, 0.82)',
            color: '#39ff14',
            fontFamily: 'var(--pulse-font-mono)',
            display: 'grid',
            gridTemplateColumns: 'repeat(18, 1fr)',
            padding: '16px',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          {Array.from({ length: 18 }).map((_, col) => (
            <div
              key={col}
              style={{
                writingMode: 'vertical-rl',
                fontSize: '13px',
                opacity: 0.45 + (col % 4) * 0.14,
                letterSpacing: '4px',
              }}
            >
              {MATRIX_GLYPHS.slice(col % 7) + MATRIX_GLYPHS.slice(0, (col % 9) + 6)}
            </div>
          ))}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              fontSize: '1.35rem',
              fontWeight: 700,
              textShadow: '0 0 18px #39ff14',
            }}
          >
            WAKE UP, LISTENER… THE MATRIX HAS YOUR QUEUE (click to exit)
          </div>
        </div>
      ) : null}

      {activeEasterEgg === 'rain' ? (
        <button
          type="button"
          onClick={() => {
            triggerEasterEgg(null);
          }}
          style={{
            position: 'fixed',
            top: '56px',
            right: '24px',
            zIndex: 138,
            padding: '6px 12px',
            borderRadius: '999px',
            border: '1px solid var(--pulse-color-border-strong)',
            background: 'var(--pulse-color-panel-solid)',
            fontSize: '0.78rem',
            cursor: 'pointer',
          }}
        >
          🌧 Cozy Rain Active (click to clear)
        </button>
      ) : null}

      {activeEasterEgg === 'konami' ||
      activeEasterEgg === 'llama' ||
      activeEasterEgg === 'bubbles' ||
      activeEasterEgg === 'vaporwave' ||
      activeEasterEgg === 'teapot' ||
      activeEasterEgg === 'flip' ||
      activeEasterEgg === 'vinyl-scratch' ||
      activeEasterEgg === 'secret-arcade' ? (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: '58px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 155,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            borderRadius: 'var(--pulse-radius-md)',
            background: 'var(--pulse-color-panel-solid)',
            border: '2px solid var(--pulse-color-accent)',
            boxShadow: 'var(--pulse-shadow-elevated)',
            fontFamily: 'var(--pulse-font-mono)',
            fontSize: '0.86rem',
          }}
        >
          {activeEasterEgg === 'vinyl-scratch' ? (
            <Disc3 size={18} color="var(--pulse-color-accent)" />
          ) : (
            <Sparkles size={18} color="var(--pulse-color-signal)" />
          )}
          <span>
            {activeEasterEgg === 'konami' &&
              '↑↑↓↓←→←→BA — KONAMI MODE UNLOCKED! +30 Sonic Lives Granted.'}
            {activeEasterEgg === 'llama' &&
              '*** WINAMP 1997 TRIBUTE: PULSE REALLY WHIPS THE LLAMA’S SYNTH! [192kbps STEREO] ***'}
            {activeEasterEgg === 'bubbles' &&
              '🫧 2007 FRUTIGER AERO PROMISE ACTIVATED — Glossy skies & tropical eco-optimism!'}
            {activeEasterEgg === 'vaporwave' &&
              '🌴 ＭＡＣＩＮＴＯＳＨ ＰＬＵＳ — Neon Mallsoft Sunset Aesthetic Engaged.'}
            {activeEasterEgg === 'teapot' &&
              '☕ HTTP 418 I’m a Teapot (RFC 2324): Pulse cannot brew coffee, only crisp audio.'}
            {activeEasterEgg === 'flip' &&
              '(╯°□°)╯︵ ┻━┻   …wait, the turntables!   ┬─┬ノ( º _ ºノ)'}
            {activeEasterEgg === 'vinyl-scratch' &&
              '🎧 WICKA-WICKA SCRATCH! 7x Rapid Cover Tap Combo!'}
            {activeEasterEgg === 'secret-arcade' &&
              '🕹 SECRET INSPECTOR UNLOCKED! Hints: try Konami Code, 7x cover click, search "dvd", "matrix", "rave", "winamp", "do a barrel roll", or ":coffee" in Ctrl+K!'}
          </span>
          <button
            type="button"
            aria-label="Dismiss easter egg banner"
            onClick={() => {
              triggerEasterEgg(null);
            }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px' }}
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      {/* Non-Intrusive Achievement Unlocked Toast */}
      {recentToast ? (
        <div
          className="gp-achievement-toast"
          role="status"
          aria-live="polite"
          onClick={dismissToast}
          style={{ cursor: 'pointer' }}
        >
          <Award size={22} color="var(--pulse-color-signal)" style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.72rem',
                fontFamily: 'var(--pulse-font-mono)',
                color: 'var(--pulse-color-signal)',
                textTransform: 'uppercase',
              }}
            >
              Achievement Unlocked • +{TIER_XP[recentToast.tier]} XP
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{recentToast.title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--pulse-color-text-secondary)' }}>
              {recentToast.description}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
