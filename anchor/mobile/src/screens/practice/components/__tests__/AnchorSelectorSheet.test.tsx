import React from 'react';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { AnchorSelectorSheet } from '../AnchorSelectorSheet';
import type { Anchor } from '@/types';

jest.mock('@/utils/haptics', () => ({
  safeHaptics: {
    selection: jest.fn(),
    impact: jest.fn(),
  },
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => false,
}));

function mockAnchor(
  id: string,
  intention: string,
  category = 'career',
  overrides: Partial<Anchor> = {}
): Anchor {
  return {
    id,
    userId: 'u1',
    intentionText: intention,
    category: category as any,
    distilledLetters: ['A', 'B'],
    baseSigilSvg: '<svg><path d="M0 0h10v10H0z"/></svg>',
    structureVariant: 'balanced',
    isCharged: true,
    activationCount: 5,
    lastActivatedAt: new Date(Date.now() - 86400000), // yesterday
    chargedAt: new Date(Date.now() - 86400000 * 2),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('AnchorSelectorSheet', () => {
  const onSelectMock = jest.fn();
  const onCloseMock = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders header, featured current anchor, search bar, and recent anchors list', () => {
    const anchors = [
      mockAnchor('a1', 'Lead with quiet conviction', 'career'),
      mockAnchor('a2', 'Protect creative focus', 'health'),
      mockAnchor('a3', 'Build lasting strength', 'desire'),
    ];

    const { getByText, getByPlaceholderText } = render(
      <AnchorSelectorSheet
        visible={true}
        anchors={anchors}
        selectedAnchorId="a1"
        onSelect={onSelectMock}
        onClose={onCloseMock}
      />
    );

    expect(getByText('CHOOSE YOUR ANCHOR')).toBeTruthy();
    expect(getByText('Which intention are you returning to?')).toBeTruthy();
    expect(getByText('CURRENT ANCHOR')).toBeTruthy();
    expect(getByText('Lead with quiet conviction')).toBeTruthy();
    expect(getByPlaceholderText('Search your anchors')).toBeTruthy();
    expect(getByText('RECENT ANCHORS')).toBeTruthy();
    expect(getByText('Protect creative focus')).toBeTruthy();
    expect(getByText('Build lasting strength')).toBeTruthy();
  });

  it('filters anchors as user types in the search field', () => {
    const anchors = [
      mockAnchor('a1', 'Lead with quiet conviction', 'career'),
      mockAnchor('a2', 'Protect creative focus', 'health'),
      mockAnchor('a3', 'Build lasting strength', 'desire'),
    ];

    const { getByPlaceholderText, getByText, queryByText } = render(
      <AnchorSelectorSheet
        visible={true}
        anchors={anchors}
        selectedAnchorId="a1"
        onSelect={onSelectMock}
        onClose={onCloseMock}
      />
    );

    const searchInput = getByPlaceholderText('Search your anchors');
    fireEvent.changeText(searchInput, 'creative');

    expect(getByText('Protect creative focus')).toBeTruthy();
    expect(queryByText('Build lasting strength')).toBeNull();
    expect(getByText('ALL MATCHES')).toBeTruthy();
  });

  it('shows empty text message when search finds no matches', () => {
    const anchors = [
      mockAnchor('a1', 'Lead with quiet conviction', 'career'),
    ];

    const { getByPlaceholderText, getByText } = render(
      <AnchorSelectorSheet
        visible={true}
        anchors={anchors}
        selectedAnchorId="a1"
        onSelect={onSelectMock}
        onClose={onCloseMock}
      />
    );

    const searchInput = getByPlaceholderText('Search your anchors');
    fireEvent.changeText(searchInput, 'nonexistent query');

    expect(getByText('No matching anchors.')).toBeTruthy();
  });

  it('triggers onSelect automatically after the selection animation delay (~220ms)', async () => {
    const anchors = [
      mockAnchor('a1', 'Lead with quiet conviction', 'career'),
      mockAnchor('a2', 'Protect creative focus', 'health'),
    ];

    const { getByLabelText } = render(
      <AnchorSelectorSheet
        visible={true}
        anchors={anchors}
        selectedAnchorId="a1"
        onSelect={onSelectMock}
        onClose={onCloseMock}
      />
    );

    const anchorTwoButton = getByLabelText('Select Protect creative focus');
    fireEvent.press(anchorTwoButton);

    // Before timer fires, onSelect shouldn't be called yet
    expect(onSelectMock).not.toHaveBeenCalled();

    // Advance timers past 220ms
    act(() => {
      jest.advanceTimersByTime(250);
    });

    expect(onSelectMock).toHaveBeenCalledTimes(1);
    expect(onSelectMock).toHaveBeenCalledWith(anchors[1]);
  });

  it('allows selecting the featured current anchor', async () => {
    const anchors = [
      mockAnchor('a1', 'Lead with quiet conviction', 'career'),
      mockAnchor('a2', 'Protect creative focus', 'health'),
    ];

    const { getByLabelText } = render(
      <AnchorSelectorSheet
        visible={true}
        anchors={anchors}
        selectedAnchorId="a1"
        onSelect={onSelectMock}
        onClose={onCloseMock}
      />
    );

    const currentAnchorButton = getByLabelText(
      'Select Lead with quiet conviction'
    );
    fireEvent.press(currentAnchorButton);

    act(() => {
      jest.advanceTimersByTime(250);
    });

    expect(onSelectMock).toHaveBeenCalledWith(anchors[0]);
  });

  it('excludes the current anchor from the Recent Anchors list when not searching', () => {
    const anchors = [
      mockAnchor('a1', 'I am focused and present', 'mind'),
      mockAnchor('a2', 'Protect creative focus', 'health'),
      mockAnchor('a3', 'Build lasting strength', 'desire'),
    ];

    const { getAllByText, getByText } = render(
      <AnchorSelectorSheet
        visible={true}
        anchors={anchors}
        selectedAnchorId="a1"
        onSelect={onSelectMock}
        onClose={onCloseMock}
      />
    );

    // "I am focused and present" should only appear once (in CURRENT ANCHOR card)
    const currentAnchorMatches = getAllByText('I am focused and present');
    expect(currentAnchorMatches).toHaveLength(1);

    expect(getByText('Protect creative focus')).toBeTruthy();
    expect(getByText('Build lasting strength')).toBeTruthy();
  });

  it('distinguishes multiple separate forge instances with same intention by forged recency', () => {
    const anchors = [
      mockAnchor('a1', 'I am focused and present', 'mind', {
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
        lastActivatedAt: undefined,
        chargedAt: undefined,
        isCharged: false,
      }),
      mockAnchor('a2', 'I am focused and present', 'mind', {
        createdAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
        lastActivatedAt: undefined,
        chargedAt: undefined,
        isCharged: false,
      }),
    ];

    const { getByText } = render(
      <AnchorSelectorSheet
        visible={true}
        anchors={anchors}
        selectedAnchorId="a1"
        onSelect={onSelectMock}
        onClose={onCloseMock}
      />
    );

    // Current anchor shows "Forged today"
    expect(getByText('Forged today')).toBeTruthy();
    // Recent anchor shows "Forged 3d ago"
    expect(getByText('Forged 3d ago')).toBeTruthy();
  });

  it('generates a deterministic sigil for anchors lacking precomputed baseSigilSvg', () => {
    const anchors = [
      mockAnchor('a1', 'Uncut raw intention', 'health', {
        baseSigilSvg: '' as any,
        reinforcedSigilSvg: undefined,
        enhancedImageUrl: undefined,
      }),
    ];

    const { getByText } = render(
      <AnchorSelectorSheet
        visible={true}
        anchors={anchors}
        selectedAnchorId="a1"
        onSelect={onSelectMock}
        onClose={onCloseMock}
      />
    );

    expect(getByText('Uncut raw intention')).toBeTruthy();
  });
});
