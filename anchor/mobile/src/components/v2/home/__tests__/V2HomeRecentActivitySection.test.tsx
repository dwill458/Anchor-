import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { V2HomeRecentActivitySection } from '../V2HomeRecentActivitySection';

const items = [
  { id: 'visualize', title: 'Visualize', dayLabel: 'Thursday', mode: 'visualize' as const, durationSeconds: 60 },
  { id: 'focus', title: 'Focus', dayLabel: 'Wednesday', mode: 'focus' as const, durationSeconds: 30 },
  { id: 'deep', title: 'Deep Focus', dayLabel: 'Sep 22', mode: 'deep_prime' as const, durationSeconds: 5 },
  { id: 'release', title: 'Release', dayLabel: 'Sep 20', mode: 'release' as const, durationSeconds: 120 },
];

it('uses distinct unframed line glyphs with the locked practice colors', () => {
  render(<V2HomeRecentActivitySection items={items} />);
  expect(screen.getByText('Recent Practice')).toBeTruthy();
  expect(screen.getByTestId('v2-home-practice-glyph-visualize', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByTestId('v2-home-practice-glyph-focus', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByTestId('v2-home-practice-glyph-deepprime', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByTestId('v2-home-practice-glyph-release', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByText('Visualize · 1 min')).toBeTruthy();
  expect(screen.getByText('Deep Focus · 5 sec')).toBeTruthy();
});

it('keeps Recent Practice lightweight and opens the existing history destination', () => {
  const viewAll = jest.fn();
  render(<V2HomeRecentActivitySection items={items.slice(0, 3)} onViewAll={viewAll} />);
  fireEvent.press(screen.getByLabelText('View all Recent Practice'));
  expect(viewAll).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('RECENT PRACTICE')).toBeNull();
});
