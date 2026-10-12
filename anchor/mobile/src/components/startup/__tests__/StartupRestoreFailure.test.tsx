import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StartupRestoreFailure } from '../StartupRestoreFailure';
import { reloadCurrentApp } from '@/services/reloadCurrentApp';

jest.mock('@/services/reloadCurrentApp', () => ({
  reloadCurrentApp: jest.fn(),
}));

describe('StartupRestoreFailure', () => {
  beforeEach(() => jest.resetAllMocks());

  it('exposes a retry action that reloads the current app bundle', () => {
    render(<StartupRestoreFailure />);

    fireEvent.press(screen.getByRole('button', { name: 'Restart Anchor and try again' }));

    expect(reloadCurrentApp).toHaveBeenCalledTimes(1);
  });

  it('shows an actionable message if the reload request fails', async () => {
    (reloadCurrentApp as jest.Mock).mockRejectedValue(new Error('restart unavailable'));
    render(<StartupRestoreFailure />);

    fireEvent.press(screen.getByRole('button', { name: 'Restart Anchor and try again' }));

    expect(await screen.findByText('Restart did not begin. Close and reopen Anchor to try again.')).toBeTruthy();
  });
});
