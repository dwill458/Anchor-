import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import RefineExpressionScreen from '../RefineExpressionScreen';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
    }),
    useRoute: () => ({
      params: {
        intention: 'I cultivate inner calm and deep focus',
        category: 'health',
        structureType: 'focused',
      },
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, style }: any) => {
    const { View } = require('react-native');
    return <View style={style}>{children}</View>;
  },
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('@/utils/haptics', () => ({
  safeHaptics: {
    impact: jest.fn().mockResolvedValue(undefined),
    selection: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('RefineExpressionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFirstAnchorFlowStore.getState().clearDraft();
  });

  it('renders top bar, intro typography, and structure hero correctly', () => {
    render(<RefineExpressionScreen />);

    expect(screen.getByText('STYLE')).toBeTruthy();
    expect(screen.getByText('Refine Style')).toBeTruthy();
    expect(screen.getByText('Choose how your Anchor will be visually treated during generation.')).toBeTruthy();
    expect(screen.getByText('Same structure. New style.')).toBeTruthy();
    expect(screen.getByText('YOUR STRUCTURE')).toBeTruthy();
    expect(screen.getByText('Focused')).toBeTruthy();
    expect(screen.getByText('RECOMMENDED')).toBeTruthy();
    expect(screen.getByText('EXPLORE MORE')).toBeTruthy();
  });

  it('allows selecting a style card, updates store draft, and triggers teaching', () => {
    render(<RefineExpressionScreen />);

    // Select an unselected style card (e.g. Watercolor)
    const watercolorCard = screen.getByRole('button', { name: 'Watercolor style' });
    expect(watercolorCard).toBeTruthy();

    act(() => {
      fireEvent.press(watercolorCard);
    });

    // Teaching message appears
    expect(screen.getByText('Style changes the appearance, not the meaning.')).toBeTruthy();
    expect(screen.getByText('Your structure stays the same through generation.')).toBeTruthy();

    // Draft store is updated
    expect(useFirstAnchorFlowStore.getState().draft?.selectedStyleId).toBe('watercolor');
  });

  it('toggles explore more tabs (This Week, Core, Seasonal, All Styles)', () => {
    render(<RefineExpressionScreen />);

    // Tap This Week tab
    const thisWeekTab = screen.getByRole('button', { name: 'This Week tab' });
    act(() => {
      fireEvent.press(thisWeekTab);
    });
    expect(screen.getByText('A curated set of limited finishes available now.')).toBeTruthy();

    // Tap Core tab
    const coreTab = screen.getByRole('button', { name: 'Core tab' });
    act(() => {
      fireEvent.press(coreTab);
    });
    expect(screen.getByText('Permanent finishes available any time.')).toBeTruthy();

    // Tap Seasonal tab
    const seasonalTab = screen.getByRole('button', { name: 'Seasonal tab' });
    act(() => {
      fireEvent.press(seasonalTab);
    });
    expect(screen.getByText('Lunar Collection')).toBeTruthy();
    expect(screen.getByText('Finishes that leave when the season turns.')).toBeTruthy();

    // Tap All Styles tab
    const allTab = screen.getByRole('button', { name: 'All Styles → tab' });
    act(() => {
      fireEvent.press(allTab);
    });
    expect(screen.getByRole('button', { name: 'Luminous family filter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mystic family filter' })).toBeTruthy();
  });

  it('displays selected style in the sticky CTA bar and navigates to AIGenerating', () => {
    jest.useFakeTimers();
    render(<RefineExpressionScreen />);

    expect(screen.getByText('SELECTED STYLE:')).toBeTruthy();

    const generateBtn = screen.getByRole('button', { name: 'Generate Anchor' });
    expect(generateBtn).toBeTruthy();

    act(() => {
      fireEvent.press(generateBtn);
    });

    // Overlay appears
    expect(screen.getByText('CREATING YOUR ANCHOR')).toBeTruthy();

    // Advance timer for transition handoff
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      'AIGenerating',
      expect.objectContaining({
        intention: 'I cultivate inner calm and deep focus',
        category: 'health',
        selectedStyle: expect.any(Object),
      })
    );
    jest.useRealTimers();
  });

  it('navigates back when top back button is pressed', () => {
    render(<RefineExpressionScreen />);

    const backBtn = screen.getByRole('button', { name: 'Back to Style' });
    act(() => {
      fireEvent.press(backBtn);
    });

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
