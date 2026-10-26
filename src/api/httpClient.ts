import type { z } from 'zod';
import { pulseDb } from '@/storage/db';
import { useCapabilityStore } from '@/stores/capabilityStore';

export const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';
export const SPOTIFY_LIBRARY_MAX_URIS_PER_BATCH = 40 as const;

export type SpotifyErrorKind =
  | 'unauthorized'
  | 'forbidden_dev_mode'
  | 'premium_required'
  | 'rate_limited'
  | 'schema_validation'
  | 'network'
  | 'http_error';

export class SpotifyApiError extends Error {
  public readonly kind: SpotifyErrorKind;
  public readonly status: number | undefined;
  public readonly endpoint: string;

  public constructor(opts: {
    message: string;
    kind: SpotifyErrorKind;
    endpoint: string;
    status?: number;
  }) {
    super(opts.message);
    this.name = 'SpotifyApiError';
    this.kind = opts.kind;
    this.status = opts.status;
    this.endpoint = opts.endpoint;
  }
}

export function chunkUris<T>(items: readonly T[], maxChunkSize: number): T[][] {
  if (maxChunkSize < 1) {
    throw new RangeError('maxChunkSize must be >= 1');
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += maxChunkSize) {
    chunks.push(items.slice(i, i + maxChunkSize));
  }
  return chunks;
}

export interface HttpEngineOptions {
  readonly baseUrl?: string;
  readonly getAccessToken: () => Promise<string | null>;
  readonly maxRetries?: number;
  readonly sleepFn?: (ms: number) => Promise<void>;
}

export interface RequestConfig<TOutput> {
  readonly path: string;
  readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly body?: unknown;
  readonly schema: z.ZodType<TOutput, z.ZodTypeDef, unknown>;
  readonly cacheTtlMs?: number;
  readonly capabilityId?: string;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRetryAfterMs(headerValue: string | null, attempt: number): number {
  if (headerValue) {
    const seconds = Number(headerValue);
    if (!Number.isNaN(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000 + 50, 30_000);
    }
  }
  const baseBackoff = 400 * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 120);
  return Math.min(baseBackoff + jitter, 15_000);
}

export class SpotifyHttpEngine {
  private readonly baseUrl: string;
  private readonly getAccessToken: () => Promise<string | null>;
  private readonly maxRetries: number;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly inflightGets = new Map<string, Promise<unknown>>();

  public constructor(options: HttpEngineOptions) {
    this.baseUrl = options.baseUrl ?? SPOTIFY_API_BASE_URL;
    this.getAccessToken = options.getAccessToken;
    this.maxRetries = options.maxRetries ?? 3;
    this.sleepFn = options.sleepFn ?? defaultSleep;
  }

  public async request<TOutput>(config: RequestConfig<TOutput>): Promise<TOutput> {
    const method = config.method ?? 'GET';
    const url = this.buildUrl(config.path, config.query);

    if (method === 'GET') {
      const existing = this.inflightGets.get(url);
      if (existing) {
        return (await existing) as TOutput;
      }
      const promise = this.executeWithCacheAndRetry(method, url, config).finally(() => {
        this.inflightGets.delete(url);
      });
      this.inflightGets.set(url, promise);
      return await promise;
    }

    return await this.executeNetworkRequest(method, url, config);
  }

  private buildUrl(
    path: string,
    query?: Readonly<Record<string, string | number | boolean | undefined>>,
  ): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) {
          url.searchParams.set(k, String(v));
        }
      }
    }
    return url.toString();
  }

  private async executeWithCacheAndRetry<TOutput>(
    method: 'GET',
    url: string,
    config: RequestConfig<TOutput>,
  ): Promise<TOutput> {
    const ttlMs = config.cacheTtlMs ?? 0;
    if (ttlMs > 0) {
      const cached = await pulseDb.apiCache.get(url);
      const now = Date.now();
      if (cached && cached.expiresAt > now) {
        const parsedCached = config.schema.safeParse(cached.payload);
        if (parsedCached.success) {
          if (cached.staleAt <= now) {
            // Stale-while-revalidate: refresh quietly in background
            void this.executeNetworkRequest(method, url, config).catch(() => undefined);
          }
          return parsedCached.data;
        }
      }
    }
    return await this.executeNetworkRequest(method, url, config);
  }

  private async executeNetworkRequest<TOutput>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    config: RequestConfig<TOutput>,
  ): Promise<TOutput> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new SpotifyApiError({
        message: 'No active Spotify access token. Complete PKCE sign-in first.',
        kind: 'unauthorized',
        endpoint: config.path,
        status: 401,
      });
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      let response: Response;
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };
        const init: RequestInit = { method, headers };
        if (config.body !== undefined) {
          headers['Content-Type'] = 'application/json';
          init.body = JSON.stringify(config.body);
        }
        response = await fetch(url, init);
      } catch (err) {
        throw new SpotifyApiError({
          message: err instanceof Error ? err.message : 'Network error contacting Spotify Web API',
          kind: 'network',
          endpoint: config.path,
        });
      }

      if (response.status === 429 && attempt < this.maxRetries) {
        const waitMs = parseRetryAfterMs(response.headers.get('Retry-After'), attempt);
        useCapabilityStore.getState().pushAlert({
          id: 'rate-limit-429',
          kind: '429-ratelimit',
          message: `Spotify rate limit reached on ${config.path}; backing off for ${Math.ceil(waitMs / 1000)}s.`,
        });
        await this.sleepFn(waitMs);
        continue;
      }

      if (response.status === 204) {
        const emptyResult = config.schema.safeParse(null);
        if (emptyResult.success) {
          return emptyResult.data;
        }
      }

      if (!response.ok) {
        await this.handleHttpFailure(response, config.path, config.capabilityId);
      }

      const text = await response.text();
      const rawJson: unknown = text.length > 0 ? JSON.parse(text) : null;
      const parsed = config.schema.safeParse(rawJson);

      if (!parsed.success) {
        useCapabilityStore.getState().pushAlert({
          id: `schema-drift:${config.path}`,
          kind: 'schema-drift',
          message: `Unexpected payload shape on ${config.path}. Pulse isolated the mismatch safely.`,
        });
        throw new SpotifyApiError({
          message: `Spotify schema validation failed for ${config.path}: ${parsed.error.issues[0]?.message ?? 'invalid payload'}`,
          kind: 'schema_validation',
          endpoint: config.path,
          status: response.status,
        });
      }

      if (method === 'GET' && config.cacheTtlMs && config.cacheTtlMs > 0) {
        const now = Date.now();
        await pulseDb.apiCache.put({
          cacheKey: url,
          payload: rawJson,
          cachedAt: now,
          staleAt: now + Math.floor(config.cacheTtlMs / 2),
          expiresAt: now + config.cacheTtlMs,
        });
      }

      return parsed.data;
    }

    throw new SpotifyApiError({
      message: `Spotify rate limit retries exhausted for ${config.path}`,
      kind: 'rate_limited',
      endpoint: config.path,
      status: 429,
    });
  }

  private async handleHttpFailure(
    response: Response,
    path: string,
    capabilityId?: string,
  ): Promise<never> {
    let errorReason = '';
    let errorMessage = `Spotify HTTP ${response.status} on ${path}`;

    try {
      const body = (await response.json()) as {
        error?: { message?: string; reason?: string };
      };
      if (body.error?.message) {
        errorMessage = body.error.message;
      }
      if (body.error?.reason) {
        errorReason = body.error.reason;
      }
    } catch {
      // Non-JSON error body (e.g., plain text "User not registered in the Developer Dashboard")
    }

    if (response.status === 403) {
      const isPremiumError =
        errorReason === 'PREMIUM_REQUIRED' || /premium/i.test(errorMessage);
      const kind: SpotifyErrorKind = isPremiumError ? 'premium_required' : 'forbidden_dev_mode';
      const friendlyReason = isPremiumError
        ? 'Active Spotify Premium is required for the app owner and playback controls.'
        : `Spotify returned 403 Forbidden on ${path}. Check that your account is listed under "Users and Access" in your Spotify Dashboard, or this endpoint is restricted in Development Mode.`;

      if (capabilityId) {
        useCapabilityStore.getState().setCapability({
          id: capabilityId,
          status: 'degraded',
          httpStatus: 403,
          reason: friendlyReason,
          updatedAt: Date.now(),
        });
      }
      useCapabilityStore.getState().pushAlert({
        id: `403:${capabilityId ?? path}`,
        kind: '403-degraded',
        message: friendlyReason,
      });

      throw new SpotifyApiError({
        message: friendlyReason,
        kind,
        endpoint: path,
        status: 403,
      });
    }

    if (response.status === 401) {
      throw new SpotifyApiError({
        message: 'Spotify session expired or unauthorized.',
        kind: 'unauthorized',
        endpoint: path,
        status: 401,
      });
    }

    throw new SpotifyApiError({
      message: errorMessage,
      kind: response.status === 429 ? 'rate_limited' : 'http_error',
      endpoint: path,
      status: response.status,
    });
  }
}
