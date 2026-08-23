import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

import type { PracticeMode } from '@/types/practice';
import { WeaveCanvas } from './WeaveCanvas';
import { buildWeaveGeometry } from './weaveGeometry';
import type { WeaveNode } from './weaveData';

const MODES: PracticeMode[] = ['focus', 'visualize', 'deep_prime', 'release'];
const MODE_COLORS: Record<PracticeMode, string> = {
  focus: '#AD99D2',
  visualize: '#78B4D1',
  deep_prime: '#F0CB6A',
  release: '#C8875A',
};

const node = (mode: PracticeMode, bucketIndex: number, sessionCount: number): WeaveNode => ({
  id: `${mode}-${bucketIndex}`,
  mode,
  bucketIndex,
  startDateKey: '2026-08-20',
  endDateKey: '2026-08-20',
  events: [],
  sessionCount,
  durationSeconds: sessionCount * 30,
});

const nodesByMode = {
  focus: [node('focus', 3, 1)],
  visualize: [],
  deep_prime: [],
  release: [],
} as Record<PracticeMode, WeaveNode[]>;

const geometry = buildWeaveGeometry({ modes: MODES, nodesByMode, bucketCount: 4, width: 320, height: 148 });

const renderCanvas = (still: boolean) =>
  render(
    <WeaveCanvas
      width={320}
      height={148}
      geometry={geometry}
      nodes={nodesByMode.focus}
      modeColors={MODE_COLORS}
      backgroundColor="#0E141A"
      still={still}
    />,
  );

describe('WeaveCanvas', () => {
  it('draws every chunk of all four threads, each over its own backing stroke', () => {
    const screen = renderCanvas(false);

    // 4 modes x 4 buckets, doubled by the background stroke behind each chunk.
    expect(screen.UNSAFE_getAllByType('Path' as any)).toHaveLength(32);
  });

  it('renders a mark and a strike spark per completed-practice node', () => {
    const screen = renderCanvas(false);

    // The node's main mark plus its lightning-strike spark flash.
    expect(screen.UNSAFE_getAllByType('Circle' as any)).toHaveLength(2);
  });
});
