import React from 'react';
import { render } from '@testing-library/react-native';
import { useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { ChartPreviewDevScreen } from '../ChartPreviewDevScreen';

jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({ useAnchorChart: jest.fn(() => ({ data: null })) }));

it('renders all 15 combinations without live Anchor requests', () => {
  const tree = render(<ChartPreviewDevScreen />);
  expect(tree.getAllByTestId('chart-preview')).toHaveLength(15);
  expect(jest.mocked(useAnchorChart).mock.calls.every(([id]) => id === null)).toBe(true);
});

it('renders nothing in release builds', () => {
  const original = __DEV__;
  try {
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;
    expect(render(<ChartPreviewDevScreen />).toJSON()).toBeNull();
  } finally {
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = original;
  }
});
