import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AskRevealText } from '../AskRevealText';
import { askReveal } from '../askReveal';
import { trackChart } from '@/hooks/v2/chart/useAnchorChart';

jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({ trackChart: jest.fn() }));

const props = { revealKey: 'reply', text: 'abcd', style: {}, animate: true, final: true };
const tick = () => act(() => jest.runOnlyPendingTimers());
const measure = (screen: ReturnType<typeof render>, text: string) => fireEvent(screen.UNSAFE_getAllByType(Text)[0], 'textLayout', {
  nativeEvent: { lines: [{ text, y: 0, x: 0, width: 200, height: 24 }] },
});

describe('AskRevealText character choreography', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); askReveal.reset(); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('reveals exactly one code point per tick without splitting a surrogate pair', () => {
    const screen = render(<AskRevealText {...props} text="a😀bc" />);
    measure(screen, 'a😀bc');
    for (const [index, visible] of ['a', 'a😀', 'a😀b', 'a😀bc'].entries()) {
      tick();
      expect(askReveal.count('reply')).toBe(index + 1);
      if (index < 3) expect(screen.getByTestId('ask-reveal-line-0').props.children).toBe(visible);
      else expect(screen.getByText(visible)).toBeTruthy();
    }
    expect(askReveal.isDone('reply')).toBe(true);
  });

  it('keeps the whole reply laid out invisibly while only the visible prefix is drawn', () => {
    const screen = render(<AskRevealText {...props} />);
    measure(screen, 'abcd');
    tick();
    const outer = screen.UNSAFE_getAllByType(Text)[0];
    expect(StyleSheet.flatten(outer.props.style).opacity).toBe(0);
    expect(outer.props.children).toBe('abcd');
    expect(screen.getByTestId('ask-reveal-line-0').props.children).toBe('a');
  });

  it('hides the layout layer with native opacity so Android cannot expose the unrevealed tail', () => {
    const screen = render(<AskRevealText {...props} style={{ color: '#123456', fontSize: 16 }} />);
    tick();
    const outer = screen.UNSAFE_getAllByType(Text)[0];
    expect(StyleSheet.flatten(outer.props.style).opacity).toBe(0);
    expect(outer.props.children).toBe('abcd');
  });

  it('keeps a partial word on its measured line instead of rewrapping the visible prefix', () => {
    const screen = render(<AskRevealText {...props} text="Hello world" />);
    fireEvent(screen.UNSAFE_getAllByType(Text)[0], 'textLayout', { nativeEvent: { lines: [
      { text: 'Hello ', y: 0, x: 0, width: 80, height: 24 },
      { text: 'world', y: 24, x: 3, width: 70, height: 24 },
    ] } });
    for (let index = 0; index < 5; index += 1) tick();
    expect(screen.queryByTestId('ask-reveal-line-1')).toBeNull();
    tick();
    expect(screen.getByTestId('ask-reveal-line-0').props.children).toBe('Hello ');
    const next = screen.getByTestId('ask-reveal-line-1');
    expect(next.props.children).toBe('w');
    expect(StyleSheet.flatten(next.props.style)).toMatchObject({ top: 24, left: 3 });
  });

  it('restores a completed key whole without a pulse or replay timer', () => {
    askReveal.markDone('reply');
    const bump = jest.spyOn(askReveal, 'bump');
    const screen = render(<AskRevealText {...props} />);
    expect(screen.getByText('abcd')).toBeTruthy();
    expect(jest.getTimerCount()).toBe(0);
    expect(bump).not.toHaveBeenCalled();
  });

  it('registers tap skip to finish immediately and clears it on unmount', () => {
    const register = jest.fn();
    const screen = render(<AskRevealText {...props} registerSkip={register} />);
    const skip = register.mock.calls.find(([value]) => typeof value === 'function')?.[0];
    act(() => skip());
    expect(screen.getByText('abcd')).toBeTruthy();
    expect(askReveal.isDone('reply')).toBe(true);
    expect(askReveal.isActive('reply')).toBe(false);
    screen.unmount();
    expect(register).toHaveBeenLastCalledWith(null);
  });

  it('records a skip once with the revealed and total code-point counts', () => {
    const register = jest.fn();
    render(<AskRevealText {...props} text="a😀bc" registerSkip={register} />);
    tick();
    const skip = register.mock.calls.find(([value]) => typeof value === 'function')?.[0];
    act(() => { skip(); skip(); });
    expect(trackChart).toHaveBeenCalledTimes(1);
    expect(trackChart).toHaveBeenCalledWith('ask_chart_reveal_skipped', { chars: 1, total: 4 });
    expect(askReveal.count('reply')).toBe(4);
  });

  it('pulses once at each word boundary and consumes whitespace in the same tick', () => {
    const bump = jest.spyOn(askReveal, 'bump');
    render(<AskRevealText {...props} text="ab cd ef" />);
    tick();
    expect(bump).not.toHaveBeenCalled();
    tick();
    expect(askReveal.count('reply')).toBe(3);
    expect(bump).toHaveBeenCalledTimes(1);
    tick();
    expect(bump).toHaveBeenCalledTimes(1);
    tick();
    expect(bump).toHaveBeenCalledTimes(2);
  });

  it('shows reduced-motion text instantly without word pulses', () => {
    const bump = jest.spyOn(askReveal, 'bump');
    const screen = render(<AskRevealText {...props} text="one two three" animate={false} />);
    expect(screen.getByText('one two three')).toBeTruthy();
    expect(jest.getTimerCount()).toBe(0);
    expect(bump).not.toHaveBeenCalled();
  });

  it('waits at the streaming frontier and resumes when another delta arrives', () => {
    const screen = render(<AskRevealText {...props} text="ab" final={false} />);
    tick(); tick();
    expect(askReveal.count('reply')).toBe(2);
    expect(askReveal.isDone('reply')).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    screen.rerender(<AskRevealText {...props} text="abcd" final={false} />);
    tick();
    expect(askReveal.count('reply')).toBe(3);
  });

  it('drops a frontier punctuation pause when the next streamed character makes a decimal', () => {
    const timer = jest.spyOn(global, 'setTimeout');
    const screen = render(<AskRevealText {...props} text="3." final={false} />);
    tick(); tick();
    expect(askReveal.count('reply')).toBe(2);
    expect(jest.getTimerCount()).toBe(0);
    screen.rerender(<AskRevealText {...props} text="3.5" final={false} />);
    expect(timer).toHaveBeenLastCalledWith(expect.any(Function), 24);
  });

  it('does not pause after the final period of a common abbreviation before a space', () => {
    const timer = jest.spyOn(global, 'setTimeout');
    render(<AskRevealText {...props} text="e.g. next" />);
    tick(); tick(); tick(); tick();
    expect(askReveal.count('reply')).toBe(5);
    expect(timer).toHaveBeenLastCalledWith(expect.any(Function), 24);
  });

  it.each([[140, 24], [141, 12], [320, 12], [321, 6]])('accelerates a streaming backlog of %i characters to %i ms', (length, expected) => {
    const timer = jest.spyOn(global, 'setTimeout');
    render(<AskRevealText {...props} text={'a'.repeat(length)} final={false} />);
    expect(timer).toHaveBeenLastCalledWith(expect.any(Function), expected);
  });

  it('scales the base cadence to the long-reply cap without crossing its floor', () => {
    const timer = jest.spyOn(global, 'setTimeout');
    const screen = render(<AskRevealText {...props} text={'a'.repeat(600)} />);
    expect(timer).toHaveBeenLastCalledWith(expect.any(Function), 15);
    screen.unmount();
    render(<AskRevealText {...props} revealKey="very-long" text={'a'.repeat(2000)} />);
    expect(timer).toHaveBeenLastCalledWith(expect.any(Function), 9);
  });

  it('reports line bottoms only when the revealed character crosses to another line', () => {
    const onLine = jest.fn();
    const screen = render(<AskRevealText {...props} text="abcd" onLine={onLine} />);
    fireEvent(screen.UNSAFE_getAllByType(Text)[0], 'textLayout', { nativeEvent: { lines: [
      { text: 'ab', y: 0, height: 24, x: 0, width: 20 },
      { text: 'cd', y: 24, height: 24, x: 0, width: 20 },
    ] } });
    tick(); tick();
    expect(onLine.mock.calls).toEqual([[24]]);
    tick(); tick();
    expect(onLine.mock.calls).toEqual([[24], [48]]);
  });
});
