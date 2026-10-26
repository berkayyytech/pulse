import { getTokenVault } from '@/platform/tokenVault';

export interface ExternalSourcesConfig {
  readonly lrclibEnabled: boolean;
  readonly musicBrainzEnabled: boolean;
  readonly coverArtArchiveEnabled: boolean;
  readonly lastFmEnabled: boolean;
}

const STORAGE_KEY = 'pulse.privacy.externalSources';
const LASTFM_VAULT_KEY = 'lastfm_api_key';

const DEFAULT_CONFIG: ExternalSourcesConfig = {
  lrclibEnabled: false,
  musicBrainzEnabled: false,
  coverArtArchiveEnabled: false,
  lastFmEnabled: false,
};

export function getExternalSourcesConfig(): ExternalSourcesConfig {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_CONFIG;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_CONFIG;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ExternalSourcesConfig>;
    return {
      lrclibEnabled: Boolean(parsed.lrclibEnabled),
      musicBrainzEnabled: Boolean(parsed.musicBrainzEnabled),
      coverArtArchiveEnabled: Boolean(parsed.coverArtArchiveEnabled),
      lastFmEnabled: Boolean(parsed.lastFmEnabled),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function setExternalSourcesConfig(next: ExternalSourcesConfig): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function saveLastFmApiKey(apiKey: string): Promise<void> {
  const vault = getTokenVault();
  const trimmed = apiKey.trim();
  if (!trimmed) {
    await vault.deleteSecret(LASTFM_VAULT_KEY);
    return;
  }
  await vault.setSecret(LASTFM_VAULT_KEY, trimmed);
}

export async function getLastFmApiKey(): Promise<string | null> {
  return await getTokenVault().getSecret(LASTFM_VAULT_KEY);
}
