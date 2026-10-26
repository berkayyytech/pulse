import { invoke } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { isTauriRuntime } from './runtime';

/**
 * Opens an external HTTPS URL in the user's default system browser on Tauri desktop
 * (where WebView2 blocks `<a target="_blank">` popups by default) and via a safe
 * `noopener,noreferrer` new tab in the browser/PWA runtime.
 */
export async function openExternalUrl(rawUrl: string): Promise<void> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS external links may be opened.');
  }
  const safeUrl = parsed.toString();

  if (isTauriRuntime()) {
    await invoke('open_external_url', { url: safeUrl });
    return;
  }

  window.open(safeUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Opens Pulse's compact Mini-Player or OBS Browser Source window natively in Tauri
 * or via `window.open` in the web/PWA build.
 */
export async function openPulsePopupWindow(mode: 'mini' | 'obs'): Promise<void> {
  const relativeUrl = `/?mode=${mode}`;

  if (isTauriRuntime()) {
    const label = mode === 'mini' ? 'mini-player' : 'obs-overlay';
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      await existing.setFocus();
      return;
    }

    new WebviewWindow(label, {
      url: relativeUrl,
      title: mode === 'mini' ? 'Pulse Mini Player' : 'Pulse OBS Overlay',
      width: mode === 'mini' ? 440 : 520,
      height: mode === 'mini' ? 170 : 150,
      decorations: false,
      transparent: true,
      resizable: true,
      alwaysOnTop: mode === 'mini',
    });
    return;
  }

  window.open(
    relativeUrl,
    `pulse_${mode}`,
    mode === 'mini' ? 'width=440,height=160' : 'width=520,height=140',
  );
}
