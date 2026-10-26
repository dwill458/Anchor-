jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { __esModule: true, ...actual };
});
jest.mock('@/components/v2/anchor/CircularAnchorRenderer', () => {
  const { View } = require('react-native');
  return { CircularAnchorRenderer: (props: { testID?: string; svg: string; category?: string }) => <View testID={props.testID ?? 'anchor-avatar'} accessibilityLabel={`avatar:${props.svg}:${props.category}`} /> };
});

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { FlatList, StyleSheet, View } from 'react-native';
import { withTiming } from 'react-native-reanimated';
import { categories, colors, spacing } from '@/theme/v2';
import { contrastRatio } from '../../panel/chartPanelColors';
import type { AskUiMessage } from '@/hooks/v2/chart/askChartState';
import { initialAskState, type AskState } from '@/hooks/v2/chart/askChartState';
import { AskChartView } from '../AskChartView';
import { askAccent } from '../askChartTheme';
import { ASK_TOKENS } from '../askChartTheme';
import { askReveal } from '../askReveal';

const msg = (over: Partial<AskUiMessage>): AskUiMessage => ({
  id: 'm', key: 'm', role: 'ASSISTANT', text: 'text', createdAt: '2026-10-21T00:00:00Z', attachments: [], suggestions: [], requestPhoto: null,
  readyToPlan: false, planInput: null, action: null, actionUnavailable: false, skill: null, status: 'sent', animate: false, ...over,
});

describe('Ask follow-scroll and composer motion controls', () => {
  beforeEach(() => { jest.useFakeTimers(); askReveal.reset(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  const scrollEvent = (offset: number) => ({ nativeEvent: {
    contentOffset: { x: 0, y: offset }, contentSize: { width: 360, height: 1400 },
    layoutMeasurement: { width: 360, height: 300 },
  } });

  it('clamps a tall bubble follow to its top so the first line remains visible', () => {
    const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(() => undefined);
    const scrollToEnd = jest.spyOn(FlatList.prototype, 'scrollToEnd').mockImplementation(() => undefined);
    const { screen } = view(stub({ messages: [msg({ key: 'long', text: 'Long answer in progress', animate: true })] }), { reducedMotion: false });
    const list = screen.getByTestId('ask-list');
    fireEvent(list, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 300 } } });
    const Cell = screen.UNSAFE_getByType(FlatList).props.CellRendererComponent;
    const cell = screen.UNSAFE_getByType(Cell);
    fireEvent(cell.findAllByType(View)[0], 'layout', { nativeEvent: { layout: { x: 0, y: 500, width: 360, height: 1200 } } });
    const flatList = screen.UNSAFE_getByType(FlatList);
    act(() => flatList.props.renderItem({ item: flatList.props.data[0] }).props.onFollow('long', 1000));
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 500 - spacing[3], animated: true });
    expect(scrollToOffset.mock.calls.every(([options]) => options.offset <= 500 - spacing[3])).toBe(true);
    fireEvent(list, 'contentSizeChange', 360, 1800);
    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  it('releases following when the person drags up and shows New without scrolling them back', () => {
    const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(() => undefined);
    const scrollToEnd = jest.spyOn(FlatList.prototype, 'scrollToEnd').mockImplementation(() => undefined);
    const { screen } = view(stub({ messages: [msg({ key: 'reading', text: 'A new response', animate: true })] }), { reducedMotion: false });
    const list = screen.getByTestId('ask-list');
    expect(typeof list.props.onScrollBeginDrag).toBe('function');
    fireEvent(list, 'scrollBeginDrag', scrollEvent(1100));
    fireEvent.scroll(list, scrollEvent(500));
    const flatList = screen.UNSAFE_getByType(FlatList);
    act(() => flatList.props.renderItem({ item: flatList.props.data[0] }).props.onFollow('reading', 1000));
    fireEvent(list, 'contentSizeChange', 360, 1800);
    expect(scrollToOffset).not.toHaveBeenCalled();
    expect(scrollToEnd).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('ask-new-pill'));
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: true });
    expect(screen.queryByTestId('ask-new-pill')).toBeNull();
    fireEvent(list, 'scrollBeginDrag', scrollEvent(1100));
    fireEvent.scroll(list, scrollEvent(500));
    expect(screen.getByTestId('ask-new-pill')).toBeTruthy();
    fireEvent.scroll(list, scrollEvent(1050));
    expect(screen.queryByTestId('ask-new-pill')).toBeNull();
  });

  it('keeps following when a programmatic glide leaves a taller transparent tail below the viewport', () => {
    const { screen } = view(stub({ messages: [msg({ key: 'glide', text: 'A longer response', animate: true })] }), { reducedMotion: false });
    const list = screen.getByTestId('ask-list');
    fireEvent.scroll(list, scrollEvent(1100));
    fireEvent.scroll(list, scrollEvent(500));
    fireEvent(list, 'contentSizeChange', 360, 1800);
    expect(screen.queryByTestId('ask-new-pill')).toBeNull();
  });

  it('uses the composer Stop square while busy and keeps its old text link absent', () => {
    const ask = stub({ turn: 'thinking', draft: { key: 'busy', text: '' } });
    const { screen } = view(ask);
    expect(screen.queryByText('Stop')).toBeNull();
    expect(screen.queryByTestId('ask-send')).toBeNull();
    const stop = screen.getByTestId('ask-stop');
    expect(stop.props.accessibilityLabel).toBe('Stop');
    expect(StyleSheet.flatten(stop.props.style)).toEqual(expect.objectContaining({ width: 48, height: 48, opacity: 1 }));
    fireEvent.press(stop);
    expect(ask.cancel).toHaveBeenCalledTimes(1);
  });

  it('renders Draft my route now as the approved outlined 44 point pill', () => {
    const { screen } = view(stub(), { secondaryAction: { label: 'Draft my route now', onPress: jest.fn(), testID: 'ask-draft-now' } });
    expect(StyleSheet.flatten(screen.getByTestId('ask-draft-now').props.style)).toEqual(expect.objectContaining({
      minHeight: 44, paddingHorizontal: 18, borderWidth: 1.25, borderColor: ASK_TOKENS.ink, backgroundColor: 'transparent',
    }));
  });
});

describe('one persistent Ask Anchor', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); askReveal.reset(); });
  afterEach(() => jest.useRealTimers());

  const conversation = (state: Partial<AskState>, reducedMotion = true) => (
    <AskChartView ask={stub(state) as never} intention="Restore my Buick Regal" category="desire" anchorArt={art} reducedMotion={reducedMotion} composerValue="" onComposerChange={jest.fn()} onSend={jest.fn()} />
  );

  it('keeps one Anchor instance as messages become a new draft and then a finished reply', () => {
    const history = [msg({ key: 'actor-old-1', text: 'First answer' }), msg({ key: 'actor-old-2', text: 'Second answer' })];
    const screen = render(conversation({ messages: history }));
    expect(screen.getAllByLabelText(/^avatar:/)).toHaveLength(1);
    const actor = screen.getByTestId('ask-anchor');
    const user = msg({ key: 'actor-user', role: 'USER', text: 'Another question', status: 'sending' });
    screen.rerender(conversation({ messages: [...history, user], draft: { key: 'actor-next', text: '' }, turn: 'thinking' }));
    expect(screen.getAllByLabelText(/^avatar:/)).toHaveLength(1);
    expect(screen.getByTestId('ask-anchor')).toBe(actor);
    expect(screen.getByTestId('ask-thinking')).toBeTruthy();
    screen.rerender(conversation({ messages: [...history, { ...user, status: 'sent' }, msg({ key: 'actor-next', text: 'The next answer' })], draft: null, turn: 'idle' }));
    expect(screen.getAllByLabelText(/^avatar:/)).toHaveLength(1);
    expect(screen.getByTestId('ask-anchor')).toBe(actor);
  });

  it('moves beside the latest assistant cell and stays attached while the list scrolls', () => {
    const history = [msg({ key: 'actor-earlier' }), msg({ key: 'actor-latest' })];
    const screen = render(conversation({ messages: history }, false));
    const flatList = screen.UNSAFE_getByType(FlatList);
    const Cell = flatList.props.CellRendererComponent;
    for (const cell of screen.UNSAFE_getAllByType(Cell)) {
      const key = cell.props.item.kind === 'message' ? cell.props.item.message.key : cell.props.item.key;
      const y = key === 'actor-latest' ? 420 : 80;
      fireEvent(cell.findAllByType(View)[0], 'layout', { nativeEvent: { layout: { x: 0, y, width: 360, height: 150 } } });
    }
    const actor = screen.getByTestId('ask-anchor');
    expect(StyleSheet.flatten(actor.props.style).transform).toEqual(expect.arrayContaining([{ translateY: 422 }]));
    fireEvent.scroll(screen.getByTestId('ask-list'), { nativeEvent: {
      contentOffset: { x: 0, y: 100 }, contentSize: { width: 360, height: 1400 }, layoutMeasurement: { width: 360, height: 300 },
    } });
    expect(StyleSheet.flatten(actor.props.style).transform).toEqual(expect.arrayContaining([{ translateY: 322 }]));
    expect(screen.getAllByLabelText(/^avatar:/)).toHaveLength(1);
    screen.rerender(conversation({ messages: [...history, msg({ key: 'actor-new-reply' })] }, false));
    const nextCell = screen.UNSAFE_getAllByType(Cell).find(cell => cell.props.item.kind === 'message' && cell.props.item.message.key === 'actor-new-reply');
    expect(nextCell).toBeDefined();
    fireEvent(nextCell!.findAllByType(View)[0], 'layout', { nativeEvent: { layout: { x: 0, y: 700, width: 360, height: 150 } } });
    expect(screen.getByTestId('ask-anchor')).toBe(actor);
    expect(StyleSheet.flatten(actor.props.style).transform).toEqual(expect.arrayContaining([{ translateY: 602 }]));
    expect(jest.mocked(withTiming).mock.calls.some(([, config]) => config?.duration === 450)).toBe(true);
  });

  it('snaps the actor to its cell without a travel animation under reduced motion', () => {
    const screen = render(conversation({ messages: [msg({ key: 'actor-reduced' })] }));
    const Cell = screen.UNSAFE_getByType(FlatList).props.CellRendererComponent;
    const cell = screen.UNSAFE_getByType(Cell);
    fireEvent(cell.findAllByType(View)[0], 'layout', { nativeEvent: { layout: { x: 0, y: 240, width: 360, height: 150 } } });
    expect(StyleSheet.flatten(screen.getByTestId('ask-anchor').props.style).transform).toEqual(expect.arrayContaining([{ translateY: 242 }]));
    expect(jest.mocked(withTiming).mock.calls.some(([, config]) => config?.duration === 450)).toBe(false);
  });
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
    expect(screen.getByText('Ask Anchor')).toBeTruthy();
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

  it('keeps the composer disabled while an opening is loading and enables it once ready', () => {
    const loading = view(stub({ status: 'loading' }), { composerValue: 'early' });
    expect(loading.screen.getByTestId('ask-input').props.editable).toBe(false);
    expect(loading.screen.getByTestId('ask-send').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(loading.screen.getByTestId('ask-send'));
    expect(loading.onSend).not.toHaveBeenCalled();
    loading.screen.unmount();
    const ready = view(stub({ status: 'ready' }), { composerValue: 'After opening' });
    expect(ready.screen.getByTestId('ask-input').props.editable).toBe(true);
    expect(ready.screen.getByTestId('ask-send').props.accessibilityState).toMatchObject({ disabled: false });
    fireEvent.press(ready.screen.getByTestId('ask-send'));
    expect(ready.onSend).toHaveBeenCalledTimes(1);
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
