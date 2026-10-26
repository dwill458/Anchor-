import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Keyboard, ScrollView, StyleSheet, TextInput, View, type KeyboardEvent } from 'react-native';
import { act } from '@testing-library/react-native';
import { ChartKeyboardFrame } from '../ChartKeyboardFrame';

describe('Chart keyboard frame review arrival and focused input', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it('resets to offset zero at mount and on proposal changes, without resetting edits', () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    const screen = render(<ChartKeyboardFrame resetKey="proposal-a"><View /></ChartKeyboardFrame>);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
    const initialCalls = scrollTo.mock.calls.length;
    fireEvent.scroll(screen.UNSAFE_getByType(ScrollView), { nativeEvent: { contentOffset: { y: 320 } } });
    screen.rerender(<ChartKeyboardFrame resetKey="proposal-a"><View /></ChartKeyboardFrame>);
    expect(scrollTo).toHaveBeenCalledTimes(initialCalls);
    screen.rerender(<ChartKeyboardFrame resetKey="proposal-b"><View /></ChartKeyboardFrame>);
    expect(scrollTo).toHaveBeenCalledTimes(initialCalls + 1);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false });
  });

  it('reveals the whole mid-list input above the footer on focus, viewport shrink, and input growth', () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    jest.spyOn(ScrollView.prototype, 'getInnerViewRef').mockReturnValue({} as never);
    let inputHeight = 100;
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({ measureLayout: (_inner: unknown, success: (x:number,y:number,w:number,h:number) => void) => success(0, 500, 280, inputHeight) } as never);
    const screen = render(<ChartKeyboardFrame resetKey="review"><TextInput /></ChartKeyboardFrame>);
    const scroll = screen.UNSAFE_getByType(ScrollView);
    fireEvent(scroll, 'focus');
    // 667pt phone with a keyboard, safe areas and pinned footer deducted.
    fireEvent(scroll, 'layout', { nativeEvent: { layout: { height: 220, width: 360, x: 0, y: 0 } } });
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 396, animated: false });
    fireEvent(scroll, 'focus');
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 396, animated: false });
    inputHeight = 150;
    fireEvent(scroll, 'contentSizeChange', 360, 1100);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 446, animated: false });
  });

  it('does not scroll a new review toward the still-focused Ask composer', () => {
    const scrollTo=jest.spyOn(ScrollView.prototype,'scrollTo');
    jest.spyOn(ScrollView.prototype,'getInnerViewRef').mockReturnValue({} as never);
    jest.spyOn(TextInput.State,'currentlyFocusedInput').mockReturnValue({measureLayout:(_inner:unknown,success:(x:number,y:number,w:number,h:number)=>void)=>success(0,1200,280,100)} as never);
    const screen=render(<ChartKeyboardFrame resetKey="new-review"><TextInput /></ChartKeyboardFrame>);
    fireEvent(screen.UNSAFE_getByType(ScrollView),'layout',{nativeEvent:{layout:{height:400,width:360,x:0,y:0}}});
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith({y:0,animated:false});
  });

  it('keeps the review footer above a keyboard when a native modal has no animated keyboard height', () => {
    const listeners:Record<string,(event:KeyboardEvent)=>unknown>={};
    const event=(height:number):KeyboardEvent => ({duration:0,easing:'keyboard',isEventFromThisApp:true,startCoordinates:{screenX:0,screenY:367,width:360,height},endCoordinates:{screenX:0,screenY:367,width:360,height}});
    jest.spyOn(Keyboard,'addListener').mockImplementation((name,listener) => {
      listeners[name]=listener;
      return {remove:jest.fn()};
    });
    const screen=render(<ChartKeyboardFrame nativeKeyboardFallback footer={<View testID="actions" />}><TextInput /></ChartKeyboardFrame>);
    act(()=>{ listeners.keyboardDidShow(event(300)); });
    let footer=screen.getByTestId('actions').parent;
    while(footer && !Array.isArray(footer.props.style)) footer=footer.parent;
    expect(StyleSheet.flatten(footer?.props.style).paddingBottom).toBe(312);
    act(()=>{ listeners.keyboardDidHide(event(0)); });
    expect(StyleSheet.flatten(footer?.props.style).paddingBottom).toBeLessThan(100);
  });
});
