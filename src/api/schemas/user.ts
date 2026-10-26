import { z } from 'zod';
import { ExternalUrlsSchema, SpotifyImageSchema } from './common.ts';

/**
 * 2026 Development Mode User Profile Schema (`GET /v1/me`).
 * Explicitly does NOT rely on removed fields: `product`, `email`, `country`,
 * `explicit_content`, or `followers`.
 */
export const UserProfileSchema = z.object({
  id: z.string().min(1),
  account_id: z.string().optional(),
  display_name: z.string().nullable().default(null),
  uri: z.string().default(''),
  href: z.string().default(''),
  images: z.array(SpotifyImageSchema).default([]),
  external_urls: ExternalUrlsSchema,
  type: z.string().default('user'),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
