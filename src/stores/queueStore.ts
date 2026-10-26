import { create } from 'zustand';
import type { Track } from '@/api/schemas/catalog';

interface QueueState {
  readonly items: readonly Track[];
  setQueueItems: (items: readonly Track[]) => void;
  enqueueTrack: (track: Track) => void;
  enqueueMany: (tracks: readonly Track[]) => void;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  removeQueueIndex: (index: number) => void;
  shiftNextTrack: () => Track | null;
  clearQueue: () => void;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  setQueueItems: (items) => {
    set({ items: [...items] });
  },
  enqueueTrack: (track) => {
    set((state) => ({ items: [...state.items, track] }));
  },
  enqueueMany: (tracks) => {
    set((state) => ({ items: [...state.items, ...tracks] }));
  },
  moveQueueItem: (fromIndex, toIndex) => {
    set((state) => {
      if (
        fromIndex < 0 ||
        fromIndex >= state.items.length ||
        toIndex < 0 ||
        toIndex >= state.items.length ||
        fromIndex === toIndex
      ) {
        return state;
      }
      const copy = [...state.items];
      const [moved] = copy.splice(fromIndex, 1);
      if (moved) {
        copy.splice(toIndex, 0, moved);
      }
      return { items: copy };
    });
  },
  removeQueueIndex: (index) => {
    set((state) => ({
      items: state.items.filter((_, idx) => idx !== index),
    }));
  },
  shiftNextTrack: () => {
    const current = get().items;
    const first = current[0] ?? null;
    if (first) {
      set({ items: current.slice(1) });
    }
    return first;
  },
  clearQueue: () => {
    set({ items: [] });
  },
}));
