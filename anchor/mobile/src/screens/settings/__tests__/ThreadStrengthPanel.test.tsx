import React from 'react';
import { render } from '@testing-library/react-native';
import { ThreadStrengthPanel } from '../ThreadStrengthPanel';
import { ThreadStrengthExplainerSheet } from '@/components/v2/thread/ThreadStrengthExplainerSheet';
import { THREAD_STRENGTH_DECAY_COPY } from '@/constants/v2/threadStrengthCopy';
jest.mock('@/components/v2/primitives/V2SheetModal', () => {
  const { View } = require('react-native');
  return { V2SheetModal: ({ children }: any) => <View>{children}</View>, V2SheetGrabZone: ({ children }: any) => <View>{children}</View>, V2_SHEET_SKIRT: 48 };
});
it('uses accurate Strength Buffer terms for every sensitivity', () => {
  const expected = {
    lenient: 'Strength Buffer: 2 days away. After that, your thread softens by 3 points for each additional day.',
    balanced: 'Strength Buffer: 1 day away. After that, your thread softens by 3 points for each additional day.',
    strict: 'No Strength Buffer. Your thread softens by 3 points for each day away.',
  };
  expect(THREAD_STRENGTH_DECAY_COPY).toEqual(expected);
  const tree = render(<ThreadStrengthPanel onBack={jest.fn()} />);
  for (const copy of Object.values(expected)) expect(tree.getByText(copy)).toBeTruthy();
  expect(tree.queryByText(/thins/)).toBeNull();
});
