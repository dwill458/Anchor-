import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent, act, within } from '@testing-library/react-native';
import LetterDistillationScreen from '../LetterDistillationScreen';

let mockReduceMotion = false;
const mockUpdateDraft = jest.fn();

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => mockReduceMotion,
}));

jest.mock('@/stores/firstAnchorFlowStore', () => ({
  useFirstAnchorFlowStore: {
    getState: () => ({ updateDraft: mockUpdateDraft }),
  },
}));

describe('LetterDistillationScreen', () => {
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  } as any;

  const route = {
    params: {
      intentionText: 'I lead my team with confidence',
      distilledLetters: ['L', 'D', 'M', 'Y', 'T', 'W', 'H', 'C', 'N', 'F'],
      category: 'custom',
    },
  } as any;

  beforeEach(() => {
    navigation.navigate.mockClear();
    navigation.goBack.mockClear();
    mockUpdateDraft.mockClear();
    mockReduceMotion = false;
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('shows the submitted intention in the quote card', () => {
    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    expect(screen.getByText('“I lead my team with confidence”')).toBeTruthy();
  });

  it('shows the title, body copy and "The Essential Form" label', () => {
    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    expect(screen.getByText('Intention')).toBeTruthy();
    expect(
      screen.getByText(
        'We remove repetition and reduce your intention to its essential letters. These become the foundation of your Anchor.'
      )
    ).toBeTruthy();
    expect(screen.getByText('The Essential Form')).toBeTruthy();
  });

  it('walks through the three reduction steps in order', () => {
    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    expect(screen.getByText(/Step 1 of 3 · Removing Vowels/)).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(2400);
    });
    expect(screen.getByText(/Step 2 of 3 · Removing Repeated Letters/)).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.getByText(/Step 3 of 3 · Essential Letters/)).toBeTruthy();
  });

  it('renders the canonical distilled letters after the reduction settles', () => {
    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    act(() => {
      jest.advanceTimersByTime(3900);
    });

    const resultLayer = within(screen.getByTestId('distill-result-layer'));
    for (const letter of route.params.distilledLetters) {
      expect(resultLayer.getByText(letter)).toBeTruthy();
    }
  });

  it('keeps only the visible hero layer in the accessibility tree', () => {
    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    expect(screen.getByTestId('distill-phrase-layer').props.accessibilityElementsHidden).toBe(false);
    expect(screen.getByTestId('distill-result-layer', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);

    act(() => {
      jest.advanceTimersByTime(3900);
    });

    expect(screen.getByTestId('distill-phrase-layer', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
    expect(screen.getByTestId('distill-result-layer', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(false);
  });

  it('waits for the final character reduction before settling long intentions', () => {
    const longRoute = {
      params: {
        ...route.params,
        intentionText: 'b'.repeat(100),
        distilledLetters: ['B'],
      },
    } as any;

    render(<LetterDistillationScreen navigation={navigation} route={longRoute} />);

    act(() => {
      jest.advanceTimersByTime(3500);
    });
    expect(screen.getByTestId('distill-result-layer', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.getByTestId('distill-result-layer').props.accessibilityElementsHidden).toBe(false);
  });

  it('auto-proceeds to StructureForge three seconds after the letters settle', () => {
    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    act(() => {
      jest.advanceTimersByTime(3900);
    });
    expect(navigation.navigate).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith('StructureForge', {
      intentionText: route.params.intentionText,
      category: route.params.category,
      distilledLetters: route.params.distilledLetters,
    });
  });

  it('suspends the auto-proceed countdown while the explainer sheet is open', () => {
    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    act(() => {
      jest.advanceTimersByTime(3900);
    });
    fireEvent.press(screen.getByRole('button', { name: 'How does this work?' }));

    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(navigation.navigate).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it('only navigates once when the button is pressed before the countdown finishes', () => {
    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    act(() => {
      jest.advanceTimersByTime(3900);
    });
    fireEvent.press(screen.getByRole('button', { name: 'Choose Your Structure' }));

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it('settles quickly when reduced motion is enabled', () => {
    mockReduceMotion = true;
    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    act(() => {
      jest.advanceTimersByTime(520);
    });

    expect(screen.getByText('The Essential Form')).toBeTruthy();
    const resultLayer = within(screen.getByTestId('distill-result-layer'));
    for (const letter of route.params.distilledLetters) {
      expect(resultLayer.getByText(letter)).toBeTruthy();
    }
  });

  it('skips the entrance slide when reduced motion is enabled', () => {
    mockReduceMotion = true;
    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    const contentStyle = StyleSheet.flatten(screen.getByTestId('distill-content').props.style);
    expect(contentStyle.transform).toEqual([{ translateX: 0 }]);
  });

  it('opens and dismisses the "How does this work?" sheet', () => {
    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByRole('button', { name: 'How does this work?' }));
    expect(screen.getByText('How Distillation Works')).toBeTruthy();
    expect(screen.getByText('CONFIDENCE → C · N · F · D')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText('How Distillation Works')).toBeNull();
  });

  it('returns to Set Intention on back press', () => {
    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('navigates to StructureForge with the canonical params on Choose Your Structure', () => {
    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByRole('button', { name: 'Choose Your Structure' }));

    expect(navigation.navigate).toHaveBeenCalledWith('StructureForge', {
      intentionText: route.params.intentionText,
      category: route.params.category,
      distilledLetters: route.params.distilledLetters,
    });
  });

  it('saves the intention and canonical letters to the first-anchor draft', () => {
    render(<LetterDistillationScreen navigation={navigation} route={route} />);

    expect(mockUpdateDraft).toHaveBeenCalledWith({
      originalIntention: route.params.intentionText,
      distilledLetters: route.params.distilledLetters,
    });
  });
});

