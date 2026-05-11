/**
 * DefaultChargeDisplay Unit Tests
 *
 * Tests for default charge preference display
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { DefaultChargeDisplay } from '../DefaultChargeDisplay';

describe('DefaultChargeDisplay', () => {
  const mockOnContinue = jest.fn();
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnContinue.mockClear();
    mockOnChange.mockClear();
  });

  it('renders the default charge display', () => {
    render(
      <DefaultChargeDisplay
        mode="focus"
        durationSeconds={120}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Using your default charge:')).toBeTruthy();
  });

  it('displays Focus mode correctly', () => {
    render(
      <DefaultChargeDisplay
        mode="focus"
        durationSeconds={120}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Focus')).toBeTruthy();
  });

  it('displays Ritual mode correctly', () => {
    render(
      <DefaultChargeDisplay
        mode="ritual"
        durationSeconds={300}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Ritual')).toBeTruthy();
  });

  it('formats and displays 2 minute duration correctly', () => {
    render(
      <DefaultChargeDisplay
        mode="focus"
        durationSeconds={120}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('2 min')).toBeTruthy();
  });

  it('formats and displays 5 minute duration correctly', () => {
    render(
      <DefaultChargeDisplay
        mode="ritual"
        durationSeconds={300}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('5 min')).toBeTruthy();
  });

  it('formats single minute duration correctly', () => {
    render(
      <DefaultChargeDisplay
        mode="focus"
        durationSeconds={60}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('1 min')).toBeTruthy();
  });

  it('formats duration in seconds when less than 60 seconds', () => {
    render(
      <DefaultChargeDisplay
        mode="focus"
        durationSeconds={30}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('30s')).toBeTruthy();
  });

  it('renders Continue button', () => {
    render(
      <DefaultChargeDisplay
        mode="focus"
        durationSeconds={120}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('renders Change button', () => {
    render(
      <DefaultChargeDisplay
        mode="focus"
        durationSeconds={120}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Change')).toBeTruthy();
  });

  it('calls onContinue when Continue button is pressed', async () => {
    render(
      <DefaultChargeDisplay
        mode="focus"
        durationSeconds={120}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    const continueButton = screen.getByText('Continue');
    fireEvent.press(continueButton);

    await waitFor(() => {
      expect(mockOnContinue).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onChange when Change button is pressed', async () => {
    render(
      <DefaultChargeDisplay
        mode="focus"
        durationSeconds={120}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    const changeButton = screen.getByText('Change');
    fireEvent.press(changeButton);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });
  });

  it('displays both buttons without overlapping', () => {
    render(
      <DefaultChargeDisplay
        mode="focus"
        durationSeconds={120}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Continue')).toBeTruthy();
    expect(screen.getByText('Change')).toBeTruthy();
  });

  it('handles different mode and duration combinations', () => {
    const { rerender } = render(
      <DefaultChargeDisplay
        mode="focus"
        durationSeconds={30}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Focus')).toBeTruthy();
    expect(screen.getByText('30s')).toBeTruthy();

    rerender(
      <DefaultChargeDisplay
        mode="ritual"
        durationSeconds={600}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Ritual')).toBeTruthy();
    expect(screen.getByText('10 min')).toBeTruthy();
  });
});
