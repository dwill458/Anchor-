import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleScene } from '../components/StyleScene';
import type { StyleStepState } from '../useStyleStep';

const mockChip = jest.fn((_props: unknown) => null);
const mockSheet = jest.fn((_props: unknown) => null);
jest.mock('../components/StyleChip', () => ({ CHIP_WIDTH: 76, CHIP_HEIGHT: 96, StyleChip: (props: unknown) => mockChip(props) }));
jest.mock('../components/AllStylesSheet', () => ({ AllStylesSheet: (props: unknown) => mockSheet(props) }));
jest.mock('../components/Reveal', () => ({ Reveal: ({ children }: { children: React.ReactNode }) => children }));

it('keeps the actual strokes on every thumbnail and moves the wait caveat out of the choice', () => {
  const strokes = [[{ x: 7, y: 18 }, { x: 87, y: 76 }]];
  const step: StyleStepState = {
    chipIds: ['alloy', 'woven', 'paper'], selectedId: 'alloy', defaultId: 'woven',
    showsLongerWait: true, sheetOpen: false, select: jest.fn(), openSheet: jest.fn(), closeSheet: jest.fn(), commit: jest.fn(), reset: jest.fn(),
  };
  const screen = render(<StyleScene step={step} strokes={strokes} reduceMotion onOpenAll={jest.fn()} onPick={jest.fn()} />);
  expect(screen.queryByText(/takes a little longer/)).toBeNull();
  expect(mockChip).toHaveBeenCalledTimes(3);
  mockChip.mock.calls.forEach(([props]) => expect((props as { strokes: unknown }).strokes).toBe(strokes));
  expect((mockSheet.mock.calls[0][0] as { strokes: unknown }).strokes).toBe(strokes);
});
