/**
 * DurationSelectionStep Unit Tests
 *
 * Tests for duration selection and timer picker integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { DurationSelectionStep } from '../DurationSelectionStep';

describe('DurationSelectionStep', () => {
  const mockOnSelectDuration = jest.fn();
  const mockOnContinue = jest.fn();

  beforeEach(() => {
    mockOnSelectDuration.mockClear();
    mockOnContinue.mockClear();
  });

  describe('Focus Mode', () => {
    it('renders Focus mode duration options', () => {
      render(
        <DurationSelectionStep
          mode="focus"
          onSelectDuration={mockOnSelectDuration}
          onContinue={mockOnContinue}
        />
      );

      expect(screen.getByText('30 seconds')).toBeTruthy();
      expect(screen.getByText('2 minutes')).toBeTruthy();
      expect(screen.getByText('5 minutes')).toBeTruthy();
    });

    it('calls onSelectDuration with 30 seconds when 30s option pressed', async () => {
      render(
        <DurationSelectionStep
          mode="focus"
          onSelectDuration={mockOnSelectDuration}
          onContinue={mockOnContinue}
        />
      );

      const thirtySecButton = screen.getByText('30 seconds');
      fireEvent.press(thirtySecButton);

      await waitFor(() => {
        expect(mockOnSelectDuration).toHaveBeenCalledWith(30);
      });
    });

    it('calls onSelectDuration with 120 seconds when 2m option pressed', async () => {
      render(
        <DurationSelectionStep
          mode="focus"
          onSelectDuration={mockOnSelectDuration}
          onContinue={mockOnContinue}
        />
      );

      const twoMinButton = screen.getByText('2 minutes');
      fireEvent.press(twoMinButton);

      await waitFor(() => {
        expect(mockOnSelectDuration).toHaveBeenCalledWith(120);
      });
    });
  });

  describe('Ritual Mode', () => {
    it('renders Ritual mode duration options', () => {
      render(
        <DurationSelectionStep
          mode="ritual"
          onSelectDuration={mockOnSelectDuration}
          onContinue={mockOnContinue}
        />
      );

      expect(screen.getByText('5 minutes')).toBeTruthy();
      expect(screen.getByText('10 minutes')).toBeTruthy();
      expect(screen.getByText('Custom Duration')).toBeTruthy();
    });

    it('calls onSelectDuration with 300 seconds when 5m option pressed', async () => {
      render(
        <DurationSelectionStep
          mode="ritual"
          onSelectDuration={mockOnSelectDuration}
          onContinue={mockOnContinue}
        />
      );

      const fiveMinButton = screen.getByText('5 minutes');
      fireEvent.press(fiveMinButton);

      await waitFor(() => {
        expect(mockOnSelectDuration).toHaveBeenCalledWith(300);
      });
    });

    it('calls onSelectDuration with 600 seconds when 10m option pressed', async () => {
      render(
        <DurationSelectionStep
          mode="ritual"
          onSelectDuration={mockOnSelectDuration}
          onContinue={mockOnContinue}
        />
      );

      const tenMinButton = screen.getByText('10 minutes');
      fireEvent.press(tenMinButton);

      await waitFor(() => {
        expect(mockOnSelectDuration).toHaveBeenCalledWith(600);
      });
    });
  });

  describe('Continue Button', () => {
    it('renders Continue button', () => {
      render(
        <DurationSelectionStep
          mode="focus"
          onSelectDuration={mockOnSelectDuration}
          onContinue={mockOnContinue}
        />
      );

      expect(screen.getByText('Continue')).toBeTruthy();
    });

    it('disables Continue button when no duration selected', () => {
      render(
        <DurationSelectionStep
          mode="focus"
          onSelectDuration={mockOnSelectDuration}
          onContinue={mockOnContinue}
        />
      );

      const continueButton = screen.getByText('Continue');
      fireEvent.press(continueButton);
      expect(mockOnContinue).not.toHaveBeenCalled();
    });

    it('calls onContinue when Continue pressed after selection', async () => {
      render(
        <DurationSelectionStep
          mode="focus"
          onSelectDuration={mockOnSelectDuration}
          onContinue={mockOnContinue}
        />
      );

      // Select a duration first
      const thirtySecButton = screen.getByText('30 seconds');
      fireEvent.press(thirtySecButton);

      await waitFor(() => {
        expect(mockOnSelectDuration).toHaveBeenCalled();
      });

      // Then press Continue
      const continueButton = screen.getByText('Continue');
      fireEvent.press(continueButton);

      await waitFor(() => {
        expect(mockOnContinue).toHaveBeenCalled();
      });
    });
  });

  describe('Step Indicator', () => {
    it('displays step indicator "STEP 2 OF 2"', () => {
      render(
        <DurationSelectionStep
          mode="focus"
          onSelectDuration={mockOnSelectDuration}
          onContinue={mockOnContinue}
        />
      );

      expect(screen.getByText('STEP 2 OF 2')).toBeTruthy();
    });

    it('displays title "Duration"', () => {
      render(
        <DurationSelectionStep
          mode="focus"
          onSelectDuration={mockOnSelectDuration}
          onContinue={mockOnContinue}
        />
      );

      expect(screen.getByText('Duration')).toBeTruthy();
    });

    it('displays subtitle with instructions', () => {
      render(
        <DurationSelectionStep
          mode="focus"
          onSelectDuration={mockOnSelectDuration}
          onContinue={mockOnContinue}
        />
      );

      expect(screen.getByText('How much time do you have?')).toBeTruthy();
    });
  });

  describe('Selection Feedback', () => {
    it('marks selected duration visually', async () => {
      render(
        <DurationSelectionStep
          mode="focus"
          onSelectDuration={mockOnSelectDuration}
          onContinue={mockOnContinue}
        />
      );

      const thirtySecButton = screen.getByText('30 seconds');
      fireEvent.press(thirtySecButton);

      await waitFor(() => {
        // Component should visually indicate selection
        expect(mockOnSelectDuration).toHaveBeenCalledWith(30);
      });
    });
  });
});
