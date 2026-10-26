let mockFlag = true;
jest.mock('@/config', () => ({ get ENABLE_WEEKLY_RECAP_V2() { return mockFlag; } }));
let mockDisable: (() => void) | undefined;
jest.mock('../V2WeeklyInsightScreen', () => ({ V2WeeklyInsightScreen: () => { const { Text } = require('react-native'); return <Text>legacy</Text>; } }));
jest.mock('../V2WeeklyRecapScreen', () => ({ V2WeeklyRecapScreen: (p: any) => { const { Text } = require('react-native'); mockDisable = p.onDisabled; return <Text>recap</Text>; } }));

import React from 'react';
import { act, render } from '@testing-library/react-native';
import { V2WeeklyInsightEntry } from '../V2WeeklyInsightEntry';

beforeEach(() => { mockFlag = true; mockDisable = undefined; });

it('opens the legacy screen when the client flag is off', () => {
  mockFlag = false;
  expect(render(<V2WeeklyInsightEntry route={{ params: {} }} />).getByText('legacy')).toBeTruthy();
});
it('opens the recap when the flag is on and no legacy param is present', () => {
  expect(render(<V2WeeklyInsightEntry route={{ params: { anchorId: 'a1' } }} />).getByText('recap')).toBeTruthy();
});
it('keeps legacy snapshots reachable by snapshotId and weekOffset', () => {
  expect(render(<V2WeeklyInsightEntry route={{ params: { snapshotId: 's1' } }} />).getByText('legacy')).toBeTruthy();
  expect(render(<V2WeeklyInsightEntry route={{ params: { weekOffset: 0 } }} />).getByText('legacy')).toBeTruthy();
});
it('falls back to legacy when the server reports the feature disabled', () => {
  const view = render(<V2WeeklyInsightEntry route={{ params: {} }} />);
  expect(view.getByText('recap')).toBeTruthy();
  act(() => mockDisable!());
  expect(view.getByText('legacy')).toBeTruthy();
});
