import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './runtime';

export interface TokenVault {
  readonly backendName: 'tauri-os-keychain' | 'webcrypto-aes-gcm';
  setSecret(key: string, plaintext: string): Promise<void>;
  getSecret(key: string): Promise<string | null>;
  deleteSecret(key: string): Promise<void>;
  clearAll(): Promise<void>;
}

const VAULT_DB_NAME = 'pulse_secure_vault_v1';
const KEY_STORE = 'crypto_keys';
const CIPHERTEXT_STORE = 'encrypted_secrets';
const MASTER_KEY_ID = 'pulse_master_aes_gcm_256';
const KNOWN_TAURI_KEYS = [
  'spotify_refresh_token',
  'spotify_pkce_verifier',
  'lastfm_api_key',
] as const;

interface EncryptedEnvelope {
  readonly key: string;
  readonly iv: Uint8Array;
  readonly ciphertext: ArrayBuffer;
  readonly updatedAt: number;
}

function openVaultDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VAULT_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE);
      }
      if (!db.objectStoreNames.contains(CIPHERTEXT_STORE)) {
        db.createObjectStore(CIPHERTEXT_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error('Failed to open secure vault IndexedDB'));
    };
  });
}

function idbGet<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => {
      resolve(req.result as T | undefined);
    };
    req.onerror = () => {
      reject(req.error ?? new Error(`IndexedDB get failed on ${storeName}`));
    };
  });
}

function idbPut(
  db: IDBDatabase,
  storeName: string,
  value: unknown,
  key?: IDBValidKey,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = key !== undefined ? store.put(value, key) : store.put(value);
    req.onsuccess = () => {
      resolve();
    };
    req.onerror = () => {
      reject(req.error ?? new Error(`IndexedDB put failed on ${storeName}`));
    };
  });
}

function idbDelete(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => {
      resolve();
    };
    req.onerror = () => {
      reject(req.error ?? new Error(`IndexedDB delete failed on ${storeName}`));
    };
  });
}

function idbClear(db: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => {
      resolve();
    };
    req.onerror = () => {
      reject(req.error ?? new Error(`IndexedDB clear failed on ${storeName}`));
    };
  });
}

async function getOrCreateMasterKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await idbGet<CryptoKey>(db, KEY_STORE, MASTER_KEY_ID);
  if (existing) {
    return existing;
  }
  // Non-extractable AES-GCM 256-bit key: raw key material can never be exported
  const generated = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  await idbPut(db, KEY_STORE, generated, MASTER_KEY_ID);
  return generated;
}

export class WebCryptoIndexedDbVault implements TokenVault {
  public readonly backendName = 'webcrypto-aes-gcm' as const;

  public async setSecret(key: string, plaintext: string): Promise<void> {
    const db = await openVaultDatabase();
    try {
      const cryptoKey = await getOrCreateMasterKey(db);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(plaintext);
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded);
      const envelope: EncryptedEnvelope = {
        key,
        iv,
        ciphertext,
        updatedAt: Date.now(),
      };
      await idbPut(db, CIPHERTEXT_STORE, envelope);
    } finally {
      db.close();
    }
  }

  public async getSecret(key: string): Promise<string | null> {
    const db = await openVaultDatabase();
    try {
      const envelope = await idbGet<EncryptedEnvelope>(db, CIPHERTEXT_STORE, key);
      if (!envelope) {
        return null;
      }
      const cryptoKey = await getOrCreateMasterKey(db);
      const ivBuffer = new Uint8Array(envelope.iv);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuffer },
        cryptoKey,
        envelope.ciphertext,
      );
      return new TextDecoder().decode(decrypted);
    } catch {
      return null;
    } finally {
      db.close();
    }
  }

  public async deleteSecret(key: string): Promise<void> {
    const db = await openVaultDatabase();
    try {
      await idbDelete(db, CIPHERTEXT_STORE, key);
    } finally {
      db.close();
    }
  }

  public async clearAll(): Promise<void> {
    const db = await openVaultDatabase();
    try {
      await idbClear(db, CIPHERTEXT_STORE);
      await idbClear(db, KEY_STORE);
    } finally {
      db.close();
    }
  }

  /** Exposed solely for unit tests verifying secrets are stored encrypted, never plaintext. */
  public async inspectRawEnvelopeForTesting(key: string): Promise<EncryptedEnvelope | undefined> {
    const db = await openVaultDatabase();
    try {
      return await idbGet<EncryptedEnvelope>(db, CIPHERTEXT_STORE, key);
    } finally {
      db.close();
    }
  }
}

export class TauriKeychainVault implements TokenVault {
  public readonly backendName = 'tauri-os-keychain' as const;

  public async setSecret(key: string, plaintext: string): Promise<void> {
    await invoke('vault_set', { key, value: plaintext });
  }

  public async getSecret(key: string): Promise<string | null> {
    return await invoke<string | null>('vault_get', { key });
  }

  public async deleteSecret(key: string): Promise<void> {
    await invoke('vault_delete', { key });
  }

  public async clearAll(): Promise<void> {
    await Promise.all(
      KNOWN_TAURI_KEYS.map((key) => invoke('vault_delete', { key }).catch(() => undefined)),
    );
  }
}

let activeVault: TokenVault | null = null;

export function getTokenVault(): TokenVault {
  if (!activeVault) {
    activeVault = isTauriRuntime() ? new TauriKeychainVault() : new WebCryptoIndexedDbVault();
  }
  return activeVault;
}
