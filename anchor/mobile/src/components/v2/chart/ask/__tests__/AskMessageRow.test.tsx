jest.mock('../AskAnchorAvatar', () => {
  const { View } = require('react-native');
  return {
    AskAnchorAvatar: ({ testID }: { testID?: string }) => <View testID={testID} />,
    AskSpeakingAvatar: ({ testID, mode }: { testID?: string; mode?: string }) => <View testID={testID} accessibilityLabel={`avatar mode:${mode}`} />,
  };
});

import React from 'react';
import { act, render } from '@testing-library/react-native';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import type { AskUiMessage } from '@/hooks/v2/chart/askChartState';
import { AskMessageRow, type AskRowItem } from '../AskMessageRow';
import { askAccent } from '../askChartTheme';
import { askReveal } from '../askReveal';

const rowProps = { accent: askAccent('career'), art: null, category: 'career', reducedMotion: false, onRetry: jest.fn() };
const thinking: AskRowItem = { kind: 'draft', key: 'draft', text: '', thinking: true };

describe('Ask thinking bubble', () => {
  beforeEach(() => { jest.useFakeTimers(); askReveal.reset(); });
  afterEach(() => jest.useRealTimers());

  it('fills the avatar-only gap with an accessible thinking bubble and thinking avatar mode', () => {
    const screen = render(<AskMessageRow {...rowProps} item={thinking} />);
    expect(screen.getByTestId('ask-thinking-bubble')).toBeTruthy();
    expect(screen.getByLabelText(CHART_COPY.ask.thinking)).toBeTruthy();
    expect(screen.getByTestId('ask-thinking').props.accessibilityLabel).toBe('avatar mode:thinking');
    expect(screen.queryByText('Reading your answer…')).toBeNull();
  });

  it('introduces the reply status after 1100 ms and cycles it every 1500 ms', () => {
    const screen = render(<AskMessageRow {...rowProps} item={thinking} />);
    act(() => jest.advanceTimersByTime(1099));
    expect(screen.queryByText('Reading your answer…')).toBeNull();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByText('Reading your answer…')).toBeTruthy();
    act(() => jest.advanceTimersByTime(1500));
    expect(screen.getByText('Weighing what it changes…')).toBeTruthy();
    act(() => jest.advanceTimersByTime(1500));
    expect(screen.getByText('Shaping the next question…')).toBeTruthy();
  });

  it('uses intention and Vision status copy for the opening loading row', () => {
    const screen = render(<AskMessageRow {...rowProps} item={{ ...thinking, key: 'loading' }} />);
    act(() => jest.advanceTimersByTime(1100));
    expect(screen.getByText('Reading your intention…')).toBeTruthy();
    act(() => jest.advanceTimersByTime(1500));
    expect(screen.getByText('Looking at your Vision…')).toBeTruthy();
  });

  it('keeps thinking visible for at least 600 ms when the first text arrives early', () => {
    const screen = render(<AskMessageRow {...rowProps} item={thinking} />);
    act(() => jest.advanceTimersByTime(100));
    screen.rerender(<AskMessageRow {...rowProps} item={{ kind: 'draft', key: 'draft', text: 'Hello there', thinking: false }} />);
    act(() => jest.advanceTimersByTime(499));
    expect(screen.getByTestId('ask-thinking-bubble')).toBeTruthy();
    expect(askReveal.count('draft')).toBe(0);
    act(() => jest.advanceTimersByTime(121));
    expect(screen.queryByTestId('ask-thinking-bubble')).toBeNull();
  });

  it('shows a static first status immediately under reduced motion', () => {
    const screen = render(<AskMessageRow {...rowProps} reducedMotion item={thinking} />);
    expect(screen.getByText('Reading your answer…')).toBeTruthy();
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByText('Reading your answer…')).toBeTruthy();
    expect(screen.queryByText('Weighing what it changes…')).toBeNull();
  });

  it('preserves the same minimum hold when a fast completed reply replaces the draft row', () => {
    const screen = render(<AskMessageRow {...rowProps} item={thinking} />);
    act(() => jest.advanceTimersByTime(100));
    const message: AskUiMessage = {
      id: 'server-reply', key: 'draft', role: 'ASSISTANT', text: 'Hello there', createdAt: '2026-10-25T12:00:00Z',
      attachments: [], suggestions: [], requestPhoto: null, readyToPlan: false, planInput: null, action: null,
      actionUnavailable: false, skill: null, status: 'sent', animate: true,
    };
    screen.rerender(<AskMessageRow {...rowProps} item={{ kind: 'message', message }} />);
    act(() => jest.advanceTimersByTime(499));
    expect(screen.getByTestId('ask-thinking-bubble')).toBeTruthy();
    expect(askReveal.count('draft')).toBe(0);
    act(() => jest.advanceTimersByTime(121));
    expect(screen.queryByTestId('ask-thinking-bubble')).toBeNull();
  });
});
