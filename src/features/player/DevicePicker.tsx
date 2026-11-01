import { useState } from 'react';
import { Check, Disc3, Laptop, RefreshCw, Speaker } from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';
import { playerController } from './playerController';

export function DevicePicker() {
  const [open, setOpen] = useState(false);
  const devices = usePlayerStore((s) => s.availableDevices);
  const activeDevice = usePlayerStore((s) => s.activeDevice);
  const sdkDeviceId = usePlayerStore((s) => s.sdkDeviceId);
  const engine = usePlayerStore((s) => s.engine);

  const displayName =
    engine === 'html-audio'
      ? 'Pulse Local Player'
      : (activeDevice?.name ?? (engine === 'sdk' ? 'Pulse SDK' : 'Connect Devices'));

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-label="Playback output device"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            void playerController.refreshPlaybackState();
          }
        }}
        className="pulse-mono-pill"
        data-tone={engine === 'html-audio' ? 'accent' : 'signal'}
        style={{ cursor: 'pointer', padding: '0.3rem 0.65rem' }}
      >
        {engine === 'html-audio' ? <Disc3 size={14} aria-hidden="true" /> : <Speaker size={14} aria-hidden="true" />}
        <span>{displayName}</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Select playback device"
          className="pulse-card"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 'calc(100% + 10px)',
            width: '310px',
            boxShadow: 'var(--pulse-shadow-elevated)',
            zIndex: 80,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.6rem',
            }}
          >
            <strong style={{ fontSize: '0.9rem' }}>Playback Engines & Targets</strong>
            <button
              type="button"
              aria-label="Refresh devices"
              onClick={() => {
                void playerController.refreshPlaybackState();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.5rem' }}>
            <button
              type="button"
              className="pulse-nav-btn"
              onClick={() => {
                void playerController.transferToDevice('pulse-local-audio');
                setOpen(false);
              }}
            >
              <Disc3 size={15} color="var(--pulse-color-accent)" aria-hidden="true" />
              <span style={{ flex: 1, textAlign: 'left' }}>Pulse Local Audio Engine</span>
              {engine === 'html-audio' ? <Check size={14} color="var(--pulse-color-signal)" /> : null}
            </button>

            {sdkDeviceId ? (
              <button
                type="button"
                className="pulse-nav-btn"
                onClick={() => {
                  void playerController.transferToDevice(sdkDeviceId);
                  setOpen(false);
                }}
              >
                <Laptop size={15} aria-hidden="true" />
                <span style={{ flex: 1, textAlign: 'left' }}>Pulse Web Player (Spotify SDK)</span>
                {engine === 'sdk' ? <Check size={14} color="var(--pulse-color-signal)" /> : null}
              </button>
            ) : null}
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--pulse-color-text-muted)', margin: '0.4rem 0 0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Spotify Connect Devices
          </div>

          {devices.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--pulse-color-text-secondary)', margin: '0.2rem 0 0' }}>
              No active Spotify Connect devices detected. Open Spotify on your desktop or phone to remote control it.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {devices.map((dev, idx) => (
                <li key={dev.id ?? `${dev.name}_${idx}`}>
                  <button
                    type="button"
                    disabled={!dev.id || dev.is_restricted}
                    className="pulse-nav-btn"
                    onClick={() => {
                      if (dev.id) {
                        void playerController.transferToDevice(dev.id);
                        setOpen(false);
                      }
                    }}
                  >
                    <Speaker size={15} aria-hidden="true" />
                    <span style={{ flex: 1, textAlign: 'left' }}>
                      {dev.name} <small>({dev.type})</small>
                    </span>
                    {dev.is_active && engine !== 'html-audio' ? <Check size={14} color="var(--pulse-color-signal)" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
