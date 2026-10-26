import { z } from 'zod';

export const SpotifyImageSchema = z.object({
  url: z.string().min(1),
  height: z.number().nullable().optional(),
  width: z.number().nullable().optional(),
});

export type SpotifyImage = z.infer<typeof SpotifyImageSchema>;

export const ExternalUrlsSchema = z
  .object({
    spotify: z.string().optional(),
  })
  .default({});

export function createPaginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    href: z.string().default(''),
    items: z.array(itemSchema).default([]),
    limit: z.number().default(20),
    next: z.string().nullable().default(null),
    offset: z.number().default(0),
    previous: z.string().nullable().default(null),
    total: z.number().default(0),
  });
}
