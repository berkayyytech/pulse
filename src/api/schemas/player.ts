import { z } from 'zod';
import { TrackSchema } from './catalog.ts';

export const ConnectDeviceSchema = z.object({
  id: z.string().nullable().default(null),
  is_active: z.boolean().default(false),
  is_private_session: z.boolean().default(false),
  is_restricted: z.boolean().default(false),
  name: z.string().default('Spotify Device'),
  type: z.string().default('Computer'),
  volume_percent: z.number().nullable().default(null),
  supports_volume: z.boolean().default(true),
});

export type ConnectDevice = z.infer<typeof ConnectDeviceSchema>;

export const DevicesResponseSchema = z.object({
  devices: z.array(ConnectDeviceSchema).default([]),
});

export const PlaybackStateSchema = z.object({
  device: ConnectDeviceSchema.optional(),
  repeat_state: z.enum(['off', 'track', 'context']).catch('off'),
  shuffle_state: z.boolean().default(false),
  timestamp: z.number().default(0),
  progress_ms: z.number().nullable().default(0),
  is_playing: z.boolean().default(false),
  currently_playing_type: z.string().default('track'),
  item: TrackSchema.nullable().default(null),
});

export type PlaybackState = z.infer<typeof PlaybackStateSchema>;

export const QueueResponseSchema = z.object({
  currently_playing: TrackSchema.nullable().default(null),
  queue: z.array(TrackSchema).default([]),
});

export type QueueResponse = z.infer<typeof QueueResponseSchema>;

export const PlayHistoryItemSchema = z.object({
  track: TrackSchema,
  played_at: z.string(),
});

export const RecentlyPlayedResponseSchema = z.object({
  items: z.array(PlayHistoryItemSchema).default([]),
  next: z.string().nullable().default(null),
});

export type RecentlyPlayedResponse = z.infer<typeof RecentlyPlayedResponseSchema>;
