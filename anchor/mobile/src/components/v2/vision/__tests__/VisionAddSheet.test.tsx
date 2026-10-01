import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { VisionAddSheet, VISION_ADD_SHEET_HANDOFF_MS } from '../VisionAddSheet';

describe('VisionAddSheet', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('uses the Vision ink palette without Focus purple literals', () => {
    const source = fs.readFileSync(path.join(__dirname, '../VisionAddSheet.tsx'), 'utf8');
    expect(source).not.toMatch(/#(?:8B5CF6|F5EEFA|E9D5FF|EDE4F7|D8B4FE|6B21A8)/i);
  });

  it('offers exactly the three ways to add', () => {
    const view = render(<VisionAddSheet visible onClose={jest.fn()} onChoose={jest.fn()} />);
    expect(view.getByText('Generate with AI')).toBeTruthy();
    expect(view.getByText('Choose from Photos')).toBeTruthy();
    expect(view.getByText('Take Photo')).toBeTruthy();
  });

  it('closes first, then acts once the sheet has left (a native picker cannot open over a dismissing modal)', () => {
    const onClose = jest.fn();
    const onChoose = jest.fn();
    const view = render(<VisionAddSheet visible onClose={onClose} onChoose={onChoose} />);
    fireEvent.press(view.getByLabelText('Take Photo'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(VISION_ADD_SHEET_HANDOFF_MS); });
    expect(onChoose).toHaveBeenCalledWith('camera');
  });

  it('reports each choice by name', () => {
    const onChoose = jest.fn();
    const view = render(<VisionAddSheet visible onClose={jest.fn()} onChoose={onChoose} />);
    fireEvent.press(view.getByLabelText('Generate with AI'));
    act(() => { jest.advanceTimersByTime(VISION_ADD_SHEET_HANDOFF_MS); });
    fireEvent.press(view.getByLabelText('Choose from Photos'));
    act(() => { jest.advanceTimersByTime(VISION_ADD_SHEET_HANDOFF_MS); });
    expect(onChoose.mock.calls.map(([choice]) => choice)).toEqual(['generate', 'library']);
  });
});
