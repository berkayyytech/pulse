import { useState } from 'react';
import { ListPlus, X } from 'lucide-react';
import { createCustomPlaylist } from './customPlaylistService';
import type { CustomPlaylistRecord } from '@/storage/db';

interface CreatePlaylistModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onCreated?: (playlist: CustomPlaylistRecord) => void;
  readonly initialTrackUri?: string;
}

export function CreatePlaylistModal({
  isOpen,
  onClose,
  onCreated,
  initialTrackUri,
}: CreatePlaylistModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const initialUris = initialTrackUri ? [initialTrackUri] : [];
      const created = await createCustomPlaylist(name, description, initialUris);
      setName('');
      setDescription('');
      onCreated?.(created);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="gp-overlay-root"
      role="dialog"
      aria-modal="true"
      aria-label="Create New Playlist"
    >
      <div className="gp-overlay-dim" onClick={onClose} />
      <div
        className="pulse-card"
        style={{
          position: 'relative',
          zIndex: 10,
          width: 'min(440px, calc(100vw - 32px))',
          padding: '24px',
          background: 'var(--pulse-color-panel-solid)',
          boxShadow: 'var(--pulse-shadow-elevated)',
          border: '1px solid var(--pulse-color-border-strong)',
          borderRadius: 'var(--pulse-radius-lg)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ListPlus size={20} color="var(--pulse-color-accent)" />
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>New Custom Playlist</h2>
          </div>
          <button
            type="button"
            className="gp-round-btn"
            style={{ width: '30px', height: '30px' }}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          style={{ display: 'grid', gap: '14px' }}
        >
          <div>
            <label
              htmlFor="pl-name-input"
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--pulse-color-text-secondary)',
                marginBottom: '6px',
              }}
            >
              Playlist Name *
            </label>
            <input
              id="pl-name-input"
              type="text"
              autoFocus
              required
              maxLength={80}
              placeholder="e.g. Chill Beats, Late Night Focus, Gym Mix"
              value={name}
              onChange={(e) => { setName(e.target.value); }}
              className="gp-search-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label
              htmlFor="pl-desc-input"
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--pulse-color-text-secondary)',
                marginBottom: '6px',
              }}
            >
              Description (Optional)
            </label>
            <input
              id="pl-desc-input"
              type="text"
              maxLength={150}
              placeholder="e.g. My favorite offline tracks and uploaded jams"
              value={description}
              onChange={(e) => { setDescription(e.target.value); }}
              className="gp-search-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '6px',
            }}
          >
            <button
              type="button"
              className="pulse-nav-btn"
              style={{ width: 'auto', padding: '6px 14px' }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="pulse-nav-btn"
              style={{
                width: 'auto',
                padding: '6px 18px',
                background: 'var(--pulse-color-accent)',
                color: 'var(--pulse-color-text-inverse)',
                fontWeight: 700,
                border: 'none',
                opacity: !name.trim() || isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? 'Creating…' : 'Create Playlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
