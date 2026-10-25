jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { __esModule: true, ...actual };
});
jest.mock('@/components/v2/anchor/CircularAnchorRenderer', () => {
  const { View } = require('react-native');
  return { CircularAnchorRenderer: (props: { testID?: string; svg: string; category?: string }) => <View testID={props.testID ?? 'anchor-avatar'} accessibilityLabel={`avatar:${props.svg}:${props.category}`} /> };
});

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { categories, colors } from '@/theme/v2';
import { contrastRatio } from '../../panel/chartPanelColors';
import type { AskUiMessage } from '@/hooks/v2/chart/askChartState';
import { initialAskState, type AskState } from '@/hooks/v2/chart/askChartState';
import { AskChartView } from '../AskChartView';
import { askAccent } from '../askChartTheme';

const msg = (over: Partial<AskUiMessage>): AskUiMessage => ({
  id: 'm', key: 'm', role: 'ASSISTANT', text: 'text', createdAt: '2026-10-21T00:00:00Z', attachments: [], suggestions: [], requestPhoto: null,
  readyToPlan: false, planInput: null, action: null, actionUnavailable: false, skill: null, status: 'sent', animate: false, ...over,
});

function stub(state: Partial<AskState> = {}, extra: Record<string, unknown> = {}) {
  return {
    state: { ...initialAskState, status: 'ready', ...state } as AskState,
    send: jest.fn(() => true), retry: jest.fn(), cancel: jest.fn(), reload: jest.fn(),
    suggestions: [] as string[], requestPhoto: null, planInput: null, busy: false, ...extra,
  };
}

const art = { svg: '<svg id="mine"/>', imageUrl: null, category: 'desire', expression: null };

function view(ask: ReturnType<typeof stub>, props: Partial<React.ComponentProps<typeof AskChartView>> = {}) {
  const onSend = jest.fn();
  const onComposerChange = jest.fn();
  const screen = render(
    <AskChartView
      ask={ask as never}
      intention="Restore my Buick Regal"
      category="desire"
      anchorArt={art}
      reducedMotion
      composerValue=""
      onComposerChange={onComposerChange}
      onSend={onSend}
      {...props}
    />
  );
  return { screen, onSend, onComposerChange };
}

describe('askAccent', () => {
  it.each(Object.keys(categories))('%s: every colour used in the conversation is readable on cream', category => {
    const accent = askAccent(category);
    // Small accent text (links, Retry) is AA on the cream ground.
    expect(contrastRatio(accent.text, colors.canvas)).toBeGreaterThanOrEqual(4.5);
    // The send arrow and the build button label read on the category fill (non-text contrast 3:1 or better).
    expect(contrastRatio(accent.onFill, accent.fill)).toBeGreaterThanOrEqual(3);
  });

  it('re-themes with the category: nothing is hardcoded to one colour', () => {
    expect(askAccent('career').fill).not.toBe(askAccent('desire').fill);
    expect(askAccent('health').wash).not.toBe(askAccent('desire').wash);
    expect(askAccent(null).fill).toBe(askAccent('custom').fill);
  });
});

describe('AskChartView', () => {
  it('shows the header with the intention, and the conversation with the person’s real Anchor as the assistant avatar', () => {
    const { screen } = view(stub({ messages: [msg({ id: 'a', key: 'a', text: 'I can see you are restoring a Regal.' }), msg({ id: 'u', key: 'u', role: 'USER', text: 'It runs but needs paint.' })] }));
    expect(screen.getByText('Ask Chart')).toBeTruthy();
    expect(screen.getByText('Restore my Buick Regal')).toBeTruthy();
    expect(screen.getByText('I can see you are restoring a Regal.')).toBeTruthy();
    expect(screen.getByText('It runs but needs paint.')).toBeTruthy();
    expect(screen.getByLabelText('avatar:<svg id="mine"/>:desire')).toBeTruthy();
  });

  it('falls back to a quiet disc, not a stock icon, when there is no Anchor art', () => {
    const { screen } = view(stub({ messages: [msg({ text: 'Hello' })] }), { anchorArt: null });
    expect(screen.queryByLabelText(/avatar:/)).toBeNull();
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('shows the thinking avatar (no text bubble) until the first words arrive, then the words', () => {
    const thinking = view(stub({ turn: 'thinking', draft: { key: 'd', text: '' } }));
    expect(thinking.screen.getByTestId('ask-thinking')).toBeTruthy();
    thinking.screen.unmount();
    const streaming = view(stub({ turn: 'streaming', draft: { key: 'd', text: 'Start with the' } }));
    // The Anchor keeps glowing while its words arrive.
    expect(streaming.screen.getByTestId('ask-thinking')).toBeTruthy();
    expect(streaming.screen.getByText(/Start with the/)).toBeTruthy();
  });

  it('keeps the reply being written directly under the message it answers', () => {
    const { screen } = view(stub({
      turn: 'streaming', draft: { key: 'd', text: 'Answering first' },
      messages: [msg({ id: 'u1', key: 'u1', role: 'USER', text: 'first', status: 'sending' }), msg({ id: 'u2', key: 'u2', role: 'USER', text: 'second', status: 'queued' })],
    }));
    const order = screen.getByTestId('ask-list').findAll(node => typeof node.props.testID === 'string' && /^ask-(user|draft)/.test(node.props.testID)).map(node => node.props.testID);
    const unique = order.filter((id, index) => order.indexOf(id) === index);
    expect(unique).toEqual(['ask-user-u1', 'ask-draft', 'ask-user-u2']);
  });

  it('lets the person send only when there is something to send, and reports the tap', () => {
    const empty = view(stub());
    expect(empty.screen.getByTestId('ask-send').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(empty.screen.getByTestId('ask-send'));
    expect(empty.onSend).not.toHaveBeenCalled();
    empty.screen.unmount();
    const filled = view(stub(), { composerValue: 'hello' });
    expect(filled.screen.getByTestId('ask-send').props.accessibilityState).toMatchObject({ disabled: false });
    fireEvent.press(filled.screen.getByTestId('ask-send'));
    expect(filled.onSend).toHaveBeenCalledTimes(1);
    fireEvent.changeText(filled.screen.getByTestId('ask-input'), 'more');
    expect(filled.onComposerChange).toHaveBeenCalledWith('more');
  });

  it('can send a photo with no text when one is attached', () => {
    const { screen } = view(stub(), { canSendEmpty: true });
    expect(screen.getByTestId('ask-send').props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('suggestions send on one tap and disappear while an action is offered', () => {
    const ask = stub({}, { suggestions: ['Mostly myself', 'Body shop'] });
    const first = view(ask);
    fireEvent.press(first.screen.getByLabelText('Mostly myself'));
    expect(ask.send).toHaveBeenCalledWith('Mostly myself');
    first.screen.unmount();
    const second = view(ask, { primaryAction: { label: 'Build my route', onPress: jest.fn() } });
    expect(second.screen.queryByTestId('ask-suggestions')).toBeNull();
  });

  it('offers the primary and secondary actions above the composer', () => {
    const build = jest.fn();
    const draft = jest.fn();
    const { screen } = view(stub(), { primaryAction: { label: 'Build my route', onPress: build, testID: 'build' }, secondaryAction: { label: 'Draft my route now', onPress: draft, testID: 'draft' } });
    fireEvent.press(screen.getByTestId('build'));
    fireEvent.press(screen.getByTestId('draft'));
    expect(build).toHaveBeenCalledTimes(1);
    expect(draft).toHaveBeenCalledTimes(1);
  });

  it('explains a failure in plain words, keeps the composer usable and offers a retry', () => {
    const ask = stub({ error: { kind: 'offline', messageKey: 'u' }, messages: [msg({ id: 'u', key: 'u', role: 'USER', text: 'hi', status: 'failed' })] });
    const { screen } = view(ask);
    expect(screen.getByText(/offline/i)).toBeTruthy();
    expect(screen.getByTestId('ask-input').props.editable).toBe(true);
    fireEvent.press(screen.getByTestId('ask-error-retry'));
    expect(ask.retry).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('ask-retry'));
    expect(ask.retry).toHaveBeenCalledTimes(2);
  });

  it('a cancelled turn offers to get the answer rather than pretending nothing happened', () => {
    const { screen } = view(stub({ error: { kind: 'cancelled', messageKey: 'u' }, messages: [msg({ id: 'u', key: 'u', role: 'USER', text: 'hi', status: 'failed' })] }));
    expect(screen.getByText('Get the answer')).toBeTruthy();
  });

  it('shows Stop while a turn is running and the real stage when there is one', () => {
    const ask = stub({ turn: 'streaming', stage: 'preparing_change', draft: { key: 'd', text: 'x' } });
    const { screen } = view(ask);
    expect(screen.getByText('Preparing a change to your route')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ask-stop'));
    expect(ask.cancel).toHaveBeenCalledTimes(1);
  });

  it('shows a clear failure with a retry when the conversation cannot be opened', () => {
    const ask = stub({ status: 'load_failed' });
    const { screen } = view(ask);
    expect(screen.getByText('Couldn’t open this conversation.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ask-reload'));
    expect(ask.reload).toHaveBeenCalledTimes(1);
  });

  it('shows a back control only when there is somewhere to go', () => {
    const none = view(stub());
    expect(none.screen.queryByTestId('ask-back')).toBeNull();
    none.screen.unmount();
    const onBack = jest.fn();
    const withBack = view(stub(), { onBack });
    fireEvent.press(withBack.screen.getByTestId('ask-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('labels the failed-send control for assistive tech', () => {
    const { screen } = view(stub({ messages: [msg({ id: 'u', key: 'u', role: 'USER', text: 'hi', status: 'failed' })] }));
    expect(screen.getByLabelText('Couldn’t send. Try again')).toBeTruthy();
  });
});
