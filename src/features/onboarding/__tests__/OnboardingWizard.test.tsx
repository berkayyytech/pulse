import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingWizard } from '@/features/onboarding/OnboardingWizard';
import { useAuthStore } from '@/stores/authStore';

describe('OnboardingWizard UX', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().setClientId(null);
  });

  it('validates Client ID format instantly and supports Offline Sample Library preview', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);

    expect(screen.getByTestId('exact-redirect-uri')).toHaveTextContent('/auth/callback');

    const input = screen.getByRole('textbox', { name: /spotify client id/i });
    await user.type(input, 'not-a-valid-hex');
    expect(screen.getByText(/invalid format/i)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'a1b2c3d4e5f60718293a4b5c6d7e8f90');
    expect(screen.getByText(/valid 32-character hexadecimal client id format/i)).toBeInTheDocument();

    const demoBtn = screen.getByRole('button', { name: /preview with sample library/i });
    await user.click(demoBtn);
    expect(useAuthStore.getState().status).toBe('demo');
  });
});
