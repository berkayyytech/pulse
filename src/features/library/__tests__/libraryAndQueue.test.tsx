import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Track } from '@/api/schemas/catalog';
import { VirtualizedTrackList } from '@/features/library/VirtualizedTrackList';
import { useQueueStore } from '@/stores/queueStore';

function buildTenThousandTracks(count = 10_500): Track[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `trk_${idx}`,
    name: `Virtualized Studio Cut #${idx + 1}`,
    uri: `spotify:track:trk_${idx}`,
    duration_ms: 195_000,
    explicit: false,
    disc_number: 1,
    track_number: idx + 1,
    is_local: false,
    artists: [
      {
        id: 'art_1',
        name: 'Warm Phosphor Trio',
        uri: 'spotify:artist:art_1',
        href: null,
        external_urls: {},
      },
    ],
    external_urls: {},
    type: 'track',
  }));
}

describe('10k+ Virtualized Track List & Queue Reordering', () => {
  it('renders 10,500 tracks via virtualization while mounting only visible DOM rows', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);

    const tracks = buildTenThousandTracks(10_500);
    render(<VirtualizedTrackList tracks={tracks} heightPx={400} />);

    expect(screen.getByText('10,500')).toBeInTheDocument();
    const renderedOptions = screen.getAllByRole('option');
    expect(renderedOptions.length).toBeGreaterThan(5);
    expect(renderedOptions.length).toBeLessThan(40);
  });

  it('reorders and shifts items cleanly in QueueStore', () => {
    const sample = buildTenThousandTracks(3);
    const store = useQueueStore.getState();
    store.clearQueue();
    store.setQueueItems(sample);

    store.moveQueueItem(2, 0);
    expect(useQueueStore.getState().items[0]?.id).toBe('trk_2');

    const shifted = useQueueStore.getState().shiftNextTrack();
    expect(shifted?.id).toBe('trk_2');
    expect(useQueueStore.getState().items).toHaveLength(2);
  });
});
