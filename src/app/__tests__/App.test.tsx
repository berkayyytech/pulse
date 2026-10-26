import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/app/App';

describe('Pulse Customizable Shell, Non-Glass Themes & Accessibility', () => {
  it('renders shell, switches to non-glass CRT & Brutalist themes, changes layout to Bottom Bar, and navigates Settings', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /search songs or artists/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /midnight oscillations/i })).toBeInTheDocument();

    // Open top-right Settings overlay
    await user.click(screen.getByRole('button', { name: /open settings/i }));
    expect(
      screen.getByRole('heading', {
        name: /connect your own spotify client id/i,
      }),
    ).toBeInTheDocument();

    // Switch to Frutiger Aero 2007 glossy gel theme
    const aeroBtn = screen.getByRole('button', { name: /frutiger aero 2007/i });
    await user.click(aeroBtn);
    expect(document.documentElement.getAttribute('data-surface')).toBe('aero');

    // Switch to non-glass "Phosphor CRT Terminal" theme directly inside Settings
    const crtBtn = screen.getByRole('button', { name: /phosphor crt terminal/i });
    await user.click(crtBtn);
    expect(crtBtn).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.getAttribute('data-surface')).toBe('matte');
    expect(document.documentElement.getAttribute('data-font')).toBe('mono');
    expect(document.documentElement.getAttribute('data-artwork')).toBe('sharp');

    // Switch to "Neo-Brutalist Zine" light print theme
    const brutalBtn = screen.getByRole('button', { name: /neo-brutalist zine/i });
    await user.click(brutalBtn);
    expect(document.documentElement.getAttribute('data-surface')).toBe('brutalist');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    // Customize Player Layout to "Bottom Bar" and Artwork to "Spinning Vinyl"
    await user.click(screen.getByRole('button', { name: /^bottom bar$/i }));
    expect(document.getElementById('main-content')).toHaveAttribute('data-layout', 'bottom-player');

    await user.click(screen.getByRole('button', { name: /^spinning vinyl$/i }));
    expect(document.documentElement.getAttribute('data-artwork')).toBe('vinyl');

    // Open Command Palette & close
    const cmdBtn = screen.getByRole('button', { name: /open command palette/i });
    await user.click(cmdBtn);
    expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close command palette/i }));

    // Navigate to Achievements Trophy Room (248 badges)
    const achievementsNav = screen.getByRole('button', { name: /^achievements$/i });
    await user.click(achievementsNav);
    expect(await screen.findByRole('heading', { name: /^level \d+ — /i })).toBeInTheDocument();
    expect(screen.getByText(/\/ 248 Achievements Unlocked/i)).toBeInTheDocument();

    // Navigate to Privacy & Sources
    const privacyNav = screen.getByRole('button', { name: /privacy & sources/i });
    await user.click(privacyNav);
    expect(
      await screen.findByRole('heading', { name: /privacy & external data sources/i }),
    ).toBeInTheDocument();
  });
});
