import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AnchorStack } from '../AnchorStack';
import type { Anchor } from '@/types';

jest.mock('../MedallionCoin', () => ({
  MedallionCoin: () => null,
}));

const mockAnchor: Anchor = {
  id: 'anchor-1',
  user_id: 'user-1',
  intentionText: 'Focus & Clarity',
  category: 'work',
  baseSigilSvg: '<svg></svg>',
  isCharged: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as any;

describe('AnchorStack', () => {
  it('renders a list of anchors with the trailing NewAnchorTile when anchors exist', () => {
    const onAnchorPress = jest.fn();
    const onAddPress = jest.fn();
    const onViewAll = jest.fn();

    render(
      <AnchorStack
        anchors={[mockAnchor]}
        primaryAnchorId="anchor-1"
        onAnchorPress={onAnchorPress}
        onAddPress={onAddPress}
        onViewAll={onViewAll}
      />
    );

    expect(screen.getByText('YOUR ANCHORS')).toBeTruthy();
    expect(screen.getByText('All Anchors →')).toBeTruthy();
    expect(screen.getByText('Focus & Clar…')).toBeTruthy();
    expect(screen.getByText('New Anchor')).toBeTruthy();

    fireEvent.press(screen.getByText('New Anchor'));
    expect(onAddPress).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText('All Anchors →'));
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });

  it('renders the full-width zero-anchor button when no anchors exist', () => {
    const onAddPress = jest.fn();

    render(
      <AnchorStack
        anchors={[]}
        onAnchorPress={jest.fn()}
        onAddPress={onAddPress}
        onViewAll={jest.fn()}
      />
    );

    expect(screen.getByText('CREATE NEW ANCHOR')).toBeTruthy();
    fireEvent.press(screen.getByText('CREATE NEW ANCHOR'));
    expect(onAddPress).toHaveBeenCalledTimes(1);
  });
});
