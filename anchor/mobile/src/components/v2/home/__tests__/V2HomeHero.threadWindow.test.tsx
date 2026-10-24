import React from 'react';
import { render } from '@testing-library/react-native';
import { V2HomeHero } from '../V2HomeHero';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { toThreadPresentation } from '@/adapters/v2/home/threadAdapter';
import { ProgressiveFocusTransitionProvider } from '@/navigation/v2/ProgressiveFocusTransition';

let mockTier: 'high' | 'medium' | 'low' = 'high';
jest.mock('@/hooks/useAppPerformanceTier', () => ({ useAppPerformanceTier: () => mockTier }));
jest.mock('@/hooks/v2/home/useHomePrewarm', () => ({ useHomePrewarm: jest.fn() }));
jest.mock('@/components/v2', () => ({ CircularAnchorRenderer: () => null }));

const anchors = Array.from({ length: 7 }, (_, index) => {
  const anchor = makeAnchor({ id: `thread-${index}`, threadStrength: 20 + index });
  return { anchor, thread: toThreadPresentation(anchor), isSelected: index === 3, practicedToday: false };
});

it.each(['high', 'medium'] as const)('mounts all five percentage drawings before a swipe on %s tier', tier => {
  mockTier = tier;
  const screen = render(<ProgressiveFocusTransitionProvider><V2HomeHero anchors={anchors} selectedIndex={3} onSelect={jest.fn()} thread={anchors[3].thread} /></ProgressiveFocusTransitionProvider>);
  expect(screen.getAllByTestId('v2-home-thread-percentage', { includeHiddenElements: true })).toHaveLength(5);
});

it('preserves the low-tier centered percentage drawing budget', () => {
  mockTier = 'low';
  const screen = render(<ProgressiveFocusTransitionProvider><V2HomeHero anchors={anchors} selectedIndex={3} onSelect={jest.fn()} thread={anchors[3].thread} /></ProgressiveFocusTransitionProvider>);
  expect(screen.getAllByTestId('v2-home-thread-percentage', { includeHiddenElements: true })).toHaveLength(1);
});
