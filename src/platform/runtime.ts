export type PulseRuntimeKind = 'tauri' | 'pwa';
export type PulseWindowMode = 'full' | 'mini' | 'obs';

interface WindowWithTauri extends Window {
  __TAURI_INTERNALS__?: unknown;
}

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean((window as WindowWithTauri).__TAURI_INTERNALS__);
}

export function getRuntimeKind(): PulseRuntimeKind {
  return isTauriRuntime() ? 'tauri' : 'pwa';
}

export function getWindowMode(search: string = window.location.search): PulseWindowMode {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  if (mode === 'obs') {
    return 'obs';
  }
  if (mode === 'mini') {
    return 'mini';
  }
  return 'full';
}
