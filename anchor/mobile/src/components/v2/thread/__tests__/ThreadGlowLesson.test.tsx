import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThreadGlowLesson, threadGlowVariant } from '../ThreadGlowLesson';
const mockShown = jest.fn();
const mockDismiss = jest.fn();
const mockHost = jest.fn();
jest.mock('@/hooks/v2/guidance/useGuidanceHost', () => ({ useGuidanceHost: (options: unknown) => { mockHost(options); return { presentation: { token: '1' }, markShown: mockShown, dismiss: mockDismiss }; } }));
jest.mock('../ThreadStrengthExplainerSheet', () => { const { Text } = require('react-native'); return { ThreadStrengthExplainerSheet: ({ visible }: { visible: boolean }) => visible ? <Text>explainer opened</Text> : null }; });
const base = { sessionId: 'saved', saved: true, before: 12, after: 15, kind: 'repeat' as const, phase: 'settled' as const };
it.each([
  [{ ...base, kind: 'first' }, 'A'], [base, 'B'],
  [{ ...base, saved: false }, null], [{ ...base, after: 12 }, null],
  [{ ...base, before: 0, after: 0 }, null], [{ ...base, after: NaN }, null],
  [{ ...base, before: null }, null], [{ ...base, after: 11 }, null],
  [{ ...base, phase: 'playing' }, null], [{ ...base, kind: 'stageFirst' }, null],
  [{ ...base, kind: 'fullFirst' }, null], [{ ...base, sessionId: null }, null],
] as const)('qualifies only a saved, known, settled first/repeat result %#', (input, expected) => {
  expect(threadGlowVariant(input)).toBe(expected);
});
it('renders quiet copy, reports visibility once and opens only on explicit request', () => {
  mockShown.mockClear();
  const props = { account: 'a', anchorId: 'anchor', sessionId: 'saved', variant: 'B' as const, strength: 15, active: true };
  const view = render(<ThreadGlowLesson {...props} />);
  expect(view.getByText("Your Thread Strength grew — and your Anchor's glow with it.")).toBeTruthy();
  expect(view.queryByText('explainer opened')).toBeNull();
  fireEvent(view.getByTestId('thread-glow-lesson'), 'layout');
  view.rerender(<ThreadGlowLesson {...props} />);
  expect(mockShown).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByText("What's Thread Strength?"));
  expect(view.getByText('explainer opened')).toBeTruthy();
});
it('ties readiness to the active completion and offers dismissal', () => {
  const view = render(<ThreadGlowLesson account="a" anchorId="anchor" sessionId="saved" variant="A" strength={15} active={false} />);
  expect(mockHost).toHaveBeenLastCalledWith(expect.objectContaining({ blocked: true, isFocused: false, contextKey: 'anchor:saved', variant: 'A' }));
  fireEvent.press(view.getByLabelText('Dismiss Thread Strength tip'));
  expect(mockDismiss).toHaveBeenCalled();
});
