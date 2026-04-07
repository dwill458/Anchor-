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

  it('renders Change settings button', () => {
    // The component renders a single action button labelled "Change settings".
    // A separate "Continue" button was removed from the component during a
    // refactor — the onContinue prop is accepted but the parent (ChargeSetup)
    // owns that flow now.
    render(
      <DefaultChargeDisplay
        mode="focus"
        durationSeconds={120}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Change settings')).toBeTruthy();
  });

  it('calls onChange when Change settings button is pressed', async () => {
    render(
      <DefaultChargeDisplay
        mode="focus"
        durationSeconds={120}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    const changeButton = screen.getByText('Change settings');
    fireEvent.press(changeButton);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });
  });

  it('displays Change settings button', () => {
    render(
      <DefaultChargeDisplay
        mode="focus"
        durationSeconds={120}
        onContinue={mockOnContinue}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Change settings')).toBeTruthy();
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
