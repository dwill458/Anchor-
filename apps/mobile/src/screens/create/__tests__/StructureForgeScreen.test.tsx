import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Animated } from 'react-native';
import StructureForgeScreen from '../StructureForgeScreen';
import { generateAllVariants, VARIANT_METADATA } from '@/utils/sigil/traditional-generator';
import * as Haptics from 'expo-haptics';

const mockNavigate = jest.fn();
const mockUseRoute = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => mockUseRoute(),
}));

jest.mock('@/components/common', () => ({
  ZenBackground: () => null,
  SigilSvg: () => null,
}));

const mockUseAuthStore = jest.fn();
mockUseAuthStore.getState = jest.fn();

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

jest.mock('@/utils/sigil/traditional-generator', () => {
  const actual = jest.requireActual('@/utils/sigil/traditional-generator');
  return {
    ...actual,
    generateAllVariants: jest.fn(),
  };
});

const mockVariants = [
  { variant: 'dense', svg: '<svg>dense</svg>' },
  { variant: 'balanced', svg: '<svg>balanced</svg>' },
  { variant: 'minimal', svg: '<svg>minimal</svg>' },
];

describe('StructureForgeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseRoute.mockReturnValue({
      params: {
        intentionText: 'Test intention',
        category: 'personal_growth',
        distilledLetters: ['A', 'B'],
      },
    });

    mockUseAuthStore.mockReturnValue({
      anchorCount: 0,
      incrementAnchorCount: jest.fn(),
    });

    (generateAllVariants as jest.Mock).mockReturnValue(mockVariants);
  });

  it('renders the main header after loading', async () => {
    const { getByText } = render(<StructureForgeScreen />);

    await waitFor(() => {
      expect(getByText('Choose Structure')).toBeTruthy();
    });
  });

  it('generates variants using the distilled letters', async () => {
    render(<StructureForgeScreen />);

    await waitFor(() => {
      expect(generateAllVariants).toHaveBeenCalledWith(['A', 'B']);
    });
  });

  it('preselects the balanced structure for first-time users', async () => {
    const { getAllByText, getByTestId } = render(<StructureForgeScreen />);

    await waitFor(() => {
      expect(getAllByText(VARIANT_METADATA.balanced.title).length).toBeGreaterThan(0);
    });

    expect(getAllByText('Recommended').length).toBeGreaterThan(0);

    const continueButton = getByTestId('continue-forge-button');
    expect(continueButton.props.accessibilityState?.disabled).toBe(false);
  });

  it('does not preselect a structure for returning users', async () => {
    mockUseAuthStore.mockReturnValue({
      anchorCount: 2,
      incrementAnchorCount: jest.fn(),
    });

    const { getByText, getByTestId } = render(<StructureForgeScreen />);

    await waitFor(() => {
      expect(getByText('Select a structure')).toBeTruthy();
    });

    const continueButton = getByTestId('continue-forge-button');
    expect(continueButton.props.accessibilityState?.disabled).toBe(true);
  });

  it('triggers haptics and updates selection when a new variant is chosen', async () => {
    mockUseAuthStore.mockReturnValue({
      anchorCount: 3,
      incrementAnchorCount: jest.fn(),
    });

    const timingSpy = jest
      .spyOn(Animated, 'timing')
      .mockImplementation(() => ({ start: (cb?: () => void) => cb && cb() }) as any);
    const parallelSpy = jest
      .spyOn(Animated, 'parallel')
      .mockImplementation(() => ({ start: (cb?: () => void) => cb && cb() }) as any);
    const sequenceSpy = jest
      .spyOn(Animated, 'sequence')
      .mockImplementation(() => ({ start: (cb?: () => void) => cb && cb() }) as any);

    const { getByLabelText, getByText, getAllByText } = render(<StructureForgeScreen />);

    await waitFor(() => {
      expect(getByLabelText('Ritual structure')).toBeTruthy();
    });

    fireEvent.press(getByLabelText('Ritual structure'));

    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(getAllByText(VARIANT_METADATA.dense.title).length).toBeGreaterThan(0);

    timingSpy.mockRestore();
    parallelSpy.mockRestore();
    sequenceSpy.mockRestore();
  });

  it('does not trigger haptics when selecting the current variant', async () => {
    const { getByLabelText } = render(<StructureForgeScreen />);

    await waitFor(() => {
      expect(getByLabelText('Focused structure')).toBeTruthy();
    });

    fireEvent.press(getByLabelText('Focused structure'));

    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('navigates to ManualReinforcement with the selected variant', async () => {
    const { getByText, getByTestId } = render(<StructureForgeScreen />);

    await waitFor(() => {
      expect(getByText('Continue to Forge')).toBeTruthy();
    });

    fireEvent.press(getByTestId('continue-forge-button'));

    expect(mockNavigate).toHaveBeenCalledWith('ManualReinforcement', {
      intentionText: 'Test intention',
      category: 'personal_growth',
      distilledLetters: ['A', 'B'],
      baseSigilSvg: '<svg>balanced</svg>',
      structureVariant: 'balanced',
    });
  });

  it('does not navigate when no variant is selected', async () => {
    mockUseAuthStore.mockReturnValue({
      anchorCount: 2,
      incrementAnchorCount: jest.fn(),
    });

    const { getByText, getByTestId } = render(<StructureForgeScreen />);

    await waitFor(() => {
      expect(getByText('Continue to Forge')).toBeTruthy();
    });

    fireEvent.press(getByTestId('continue-forge-button'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders structure cards with accessibility labels', async () => {
    const { getByLabelText } = render(<StructureForgeScreen />);

    await waitFor(() => {
      expect(getByLabelText('Focused structure')).toBeTruthy();
      expect(getByLabelText('Ritual structure')).toBeTruthy();
      expect(getByLabelText('Raw structure')).toBeTruthy();
    });
  });
});
