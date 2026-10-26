import React from 'react';
import { render } from '@testing-library/react-native';
import { V2ProgressWeekCard } from '../V2ProgressWeek';
it.each([true, false])('shows practice rhythm without the non-functional grace badge (%s)', graceAvailable => {
  const tree = render(<V2ProgressWeekCard week={{ days: [true, false, true, false, false, false, false], todayIndex: 2 }} streak={{ current: 2, best: 4, graceAvailable } as never} longestRhythm={4} />);
  expect(tree.getByText('2 active days')).toBeTruthy();
  expect(tree.getByText('Longest rhythm 4')).toBeTruthy();
  expect(tree.queryByText(/Grace day/)).toBeNull();
  expect(tree.getByLabelText('Wednesday, today: practiced')).toBeTruthy();
});
