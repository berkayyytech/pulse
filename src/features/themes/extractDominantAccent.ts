import { useThemeStore } from '@/stores/themeStore';

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Samples an album artwork image on a tiny 16x16 offscreen canvas to extract a vibrant
 * accent color when `dynamicAlbumArtAccent` is enabled by the user.
 */
export async function extractDominantAccentHex(imageUrl: string): Promise<string | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return null;
  }

  return await new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, 16, 16);
        const { data } = ctx.getImageData(0, 0, 16, 16);
        let bestScore = -1;
        let bestRgb: [number, number, number] = [245, 166, 35];

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const brightness = max / 255;
          const score = saturation * 0.7 + brightness * 0.3;
          if (score > bestScore && max > 48) {
            bestScore = score;
            bestRgb = [r, g, b];
          }
        }
        resolve(rgbToHex(bestRgb[0], bestRgb[1], bestRgb[2]));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = imageUrl;
  });
}

export async function applyDynamicAlbumAccentIfEnabled(
  artworkUrl: string | null,
): Promise<void> {
  const store = useThemeStore.getState();
  if (!store.dynamicAlbumArtAccent || !artworkUrl) {
    return;
  }
  const hex = await extractDominantAccentHex(artworkUrl);
  if (hex) {
    store.updateSingleToken('--pulse-color-accent', hex);
  }
}
