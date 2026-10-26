import { useState } from 'react';
import { Check, Laptop, RefreshCw, Speaker } from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';
import { playerController } from './playerController';

export function DevicePicker() {
  const [open, setOpen] = useState(false);
  const devices = usePlayerStore((s) => s.availableDevices);
  const activeDevice = usePlayerStore((s) => s.activeDevice);
  const sdkDeviceId = usePlayerStore((s) => s.sdkDeviceId);
  const engine = usePlayerStore((s) => s.engine);

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-label="Spotify Connect devices"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            void playerController.refreshPlaybackState();
          }
        }}
        className="pulse-mono-pill"
        data-tone="signal"
        style={{ cursor: 'pointer', padding: '0.3rem 0.65rem' }}
      >
        <Speaker size={14} aria-hidden="true" />
        <span>
          {activeDevice?.name ?? (engine === 'sdk' ? 'Pulse SDK' : 'Connect Devices')}
        </span>
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
            width: '300px',
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
            <strong style={{ fontSize: '0.9rem' }}>Spotify Connect Targets</strong>
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
              <span style={{ flex: 1 }}>Pulse Web Player (Local SDK)</span>
              {engine === 'sdk' ? <Check size={14} color="var(--pulse-color-signal)" /> : null}
            </button>
          ) : null}

          {devices.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--pulse-color-text-secondary)', margin: '0.4rem 0 0' }}>
              No active Spotify Connect devices detected. Open Spotify on your desktop, phone, or
              browser to remote-control it here.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
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
                    <span style={{ flex: 1 }}>
                      {dev.name} <small>({dev.type})</small>
                    </span>
                    {dev.is_active ? <Check size={14} color="var(--pulse-color-signal)" /> : null}
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
