import { expect, test } from '@playwright/test';

test('Pulse customizable user journey: Non-Glass Themes (Matte / Brutalist / CRT) -> Layout Modes -> Sample Library -> Studio Views -> Command Palette', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1080, height: 700 });
  await page.goto('/');

  // 1. Verify initial shell on launch
  await expect(page.getByRole('searchbox', { name: /search songs or artists/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Midnight Oscillations' })).toBeVisible();

  // 2. Open Settings & switch across Frutiger Aero 2007, Pitch Matte Studio & Neo-Brutalist Zine
  await page.getByRole('button', { name: /open settings/i }).click();
  await expect(
    page.getByRole('heading', { name: /connect your own spotify client id/i }),
  ).toBeVisible();
  await expect(page.getByTestId('exact-redirect-uri')).toContainText(
    'http://127.0.0.1:4173/auth/callback',
  );

  await page.getByRole('button', { name: /frutiger aero 2007/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-surface', 'aero');

  await page.getByRole('button', { name: /pitch matte studio/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-surface', 'matte');

  await page.getByRole('button', { name: /neo-brutalist zine/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-surface', 'brutalist');

  // Switch layout to Bottom Bar and back to Split Panels
  await page.getByRole('button', { name: /^bottom bar$/i }).click();
  await expect(page.locator('#main-content')).toHaveAttribute('data-layout', 'bottom-player');
  await page.getByRole('button', { name: /^split panels$/i }).click();
  await expect(page.locator('#main-content')).toHaveAttribute('data-layout', 'split');

  // 3. Launch Sample Library & inspect Playlists
  await page.getByRole('button', { name: /preview with sample library/i }).click();
  await page.getByRole('tab', { name: /^playlists/i }).click();
  await expect(page.getByText('Late Night Mastering Desk')).toBeVisible();

  // 4. Open Achievements Trophy Room, Smart Playlists, Theme Studio, Plugins in Settings Sheet
  await page.getByRole('button', { name: /open achievements/i }).click();
  await expect(page.getByRole('heading', { name: /^level \d+ — /i })).toBeVisible();
  await expect(page.getByText(/\/ 248 Achievements Unlocked/i)).toBeVisible();

  await page.getByRole('button', { name: /smart playlists/i }).click();
  await expect(page.getByRole('heading', { name: /smart playlist rules/i })).toBeVisible();

  await page.getByRole('button', { name: /^theme studio$/i }).click();
  await expect(page.getByRole('heading', { name: /theme studio & layout engine/i })).toBeVisible();

  await page.getByRole('button', { name: /^plugins$/i }).click();
  await expect(page.getByRole('heading', { name: /sandboxed plugins & registry/i })).toBeVisible();

  // 5. Command Palette (Ctrl+K)
  await page.keyboard.press('Control+KeyK');
  await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible();
});

test('OBS Browser Source compact overlay renders cleanly at /?mode=obs', async ({ page }) => {
  await page.goto('/?mode=obs');
  await expect(page.getByRole('main', { name: /obs now playing overlay/i })).toBeVisible();
});
