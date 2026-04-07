/**
 * ModeSelectionStep Unit Tests
 *
 * Tests for mode selection interaction and rendering
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ModeSelectionStep } from '../ModeSelectionStep';

describe('ModeSelectionStep', () => {
  const mockOnSelectMode = jest.fn();

  beforeEach(() => {
    mockOnSelectMode.mockClear();
  });

  it('renders both mode cards', () => {
    render(<ModeSelectionStep onSelectMode={mockOnSelectMode} />);

    expect(screen.getByText('Focus Charge')).toBeTruthy();
    expect(screen.getByText('Ritual Charge')).toBeTruthy();
  });

  it('displays correct descriptions for each mode', () => {
    render(<ModeSelectionStep onSelectMode={mockOnSelectMode} />);

    expect(screen.getByText('A brief moment of alignment')).toBeTruthy();
    expect(screen.getByText('A guided, immersive experience')).toBeTruthy();
  });

  it('calls onSelectMode with "focus" when Focus Charge is pressed', async () => {
    render(<ModeSelectionStep onSelectMode={mockOnSelectMode} />);

    const focusCard = screen.getByText('Focus Charge');
    fireEvent.press(focusCard);

    await waitFor(() => {
      expect(mockOnSelectMode).toHaveBeenCalledWith('focus');
    });
  });

  it('calls onSelectMode with "ritual" when Ritual Charge is pressed', async () => {
    render(<ModeSelectionStep onSelectMode={mockOnSelectMode} />);

    const ritualCard = screen.getByText('Ritual Charge');
    fireEvent.press(ritualCard);

    await waitFor(() => {
      expect(mockOnSelectMode).toHaveBeenCalledWith('ritual');
    });
  });

  it('displays step indicator', () => {
    render(<ModeSelectionStep onSelectMode={mockOnSelectMode} />);

    expect(screen.getByText('STEP 1 OF 2')).toBeTruthy();
  });

  it('displays charging mode title', () => {
    render(<ModeSelectionStep onSelectMode={mockOnSelectMode} />);

    expect(screen.getByText('Charging Mode')).toBeTruthy();
  });

  it('displays subtitle with instructions', () => {
    render(<ModeSelectionStep onSelectMode={mockOnSelectMode} />);

    expect(screen.getByText('Choose how deeply you want to connect.')).toBeTruthy();
  });

  it('displays benefit items for Focus mode', () => {
    render(<ModeSelectionStep onSelectMode={mockOnSelectMode} />);

    expect(screen.getByText('30 sec, 2 min, or 5 min')).toBeTruthy();
    expect(screen.getByText('Single phase practice')).toBeTruthy();
    expect(screen.getByText('Quick energy boost')).toBeTruthy();
  });

  it('displays benefit items for Ritual mode', () => {
    render(<ModeSelectionStep onSelectMode={mockOnSelectMode} />);

    expect(screen.getByText('5 min, 10 min, or custom')).toBeTruthy();
    expect(screen.getByText('Multi-phase ceremony')).toBeTruthy();
    expect(screen.getByText('Lasting transformation')).toBeTruthy();
  });

  it('only calls onSelectMode once per press', async () => {
    render(<ModeSelectionStep onSelectMode={mockOnSelectMode} />);

    const focusCard = screen.getByText('Focus Charge');
    fireEvent.press(focusCard);

    await waitFor(() => {
      expect(mockOnSelectMode).toHaveBeenCalledTimes(1);
    });
  });
});
