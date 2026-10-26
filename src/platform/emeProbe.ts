export interface EmeSupportStatus {
  readonly supported: boolean;
  readonly keySystem: string | null;
  readonly fallbackMode: 'sdk' | 'connect-remote-only';
  readonly reason?: string;
}

const CANDIDATE_KEY_SYSTEMS = ['com.widevine.alpha', 'com.microsoft.playready'] as const;

const EME_CONFIGS: MediaKeySystemConfiguration[] = [
  {
    initDataTypes: ['cenc'],
    audioCapabilities: [
      {
        contentType: 'audio/mp4; codecs="mp4a.40.2"',
      },
    ],
  },
];

/**
 * Probes standard browser/WebView Encrypted Media Extensions (EME) availability
 * without attempting any DRM workarounds. When unavailable (e.g. macOS WKWebView),
 * Pulse cleanly degrades to Spotify Connect Remote Control mode.
 */
export async function probeEmeSupport(
  nav: Pick<Navigator, 'requestMediaKeySystemAccess'> | undefined = typeof navigator !== 'undefined'
    ? navigator
    : undefined,
): Promise<EmeSupportStatus> {
  if (!nav || typeof nav.requestMediaKeySystemAccess !== 'function') {
    return {
      supported: false,
      keySystem: null,
      fallbackMode: 'connect-remote-only',
      reason:
        'This WebView does not expose Encrypted Media Extensions (EME). Pulse will run in Spotify Connect Remote Control mode (or you can open the browser audio bridge).',
    };
  }

  for (const keySystem of CANDIDATE_KEY_SYSTEMS) {
    try {
      await nav.requestMediaKeySystemAccess(keySystem, EME_CONFIGS);
      return {
        supported: true,
        keySystem,
        fallbackMode: 'sdk',
      };
    } catch {
      // Try next supported key system
    }
  }

  return {
    supported: false,
    keySystem: null,
    fallbackMode: 'connect-remote-only',
    reason:
      'No compatible EME audio module (Widevine) was detected in this WebView. Direct in-window Web Playback SDK streaming is disabled; Spotify Connect Remote Control remains active.',
  };
}
