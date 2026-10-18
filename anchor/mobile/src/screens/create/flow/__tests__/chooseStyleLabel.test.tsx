import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { ChooseScene } from '../components/ChooseScene';
import { normalizeGeneratedForms } from '../generatedForms';
import { CARD } from '../choosePager';
import type { ChooseController } from '../useChooseController';

jest.mock('react-native-reanimated', () => require('@/__tests__/mocks/reactNativeReanimated').default);
jest.mock('@/components/common/OptimizedImage', () => ({ OptimizedImage: () => null }));

it('keeps the style line spacing but paints one centred label outside the pager', () => {
  const controller = {
    page: { value: 0 }, hold: { value: 0 }, sealU: { value: 0 }, flash: { value: 0 },
    phase: 'choosing', activePage: 0, panHandlers: {}, goToPage: jest.fn(), sealNow: jest.fn(),
    holdActive: false, reset: jest.fn(),
  } as unknown as ChooseController;
  const tree = render(<ChooseScene controller={controller} forms={normalizeGeneratedForms(['a', 'b'])} styleName="Alloy"
    intentionText="Stay calm" reduceMotion showSheen={false} holdHint="idle" />);
  const placeholders = tree.UNSAFE_getAllByType(Text).filter((node) => node.props.children === 'Alloy');
  expect(placeholders).toHaveLength(2);
  placeholders.forEach((node) => expect(StyleSheet.flatten(node.props.style).opacity).toBe(0));
  fireEvent(placeholders[0], 'layout', { nativeEvent: { layout: { x: 0, y: 24, width: 100, height: 16 } } });
  expect(screen.getAllByText('Alloy')).toHaveLength(1);
  const label = screen.getByText('Alloy');
  expect(StyleSheet.flatten(label.props.style)).toMatchObject({ fontSize: 13, opacity: 0.7, marginTop: 0 });
  let overlay = label.parent;
  while (overlay && StyleSheet.flatten(overlay.props.style)?.position !== 'absolute') overlay = overlay.parent;
  expect(StyleSheet.flatten(overlay!.props.style)).toMatchObject({ top: CARD.y + CARD.height + 26 + 24, left: 0, width: 390 });
  expect(screen.getByText('Hold your Anchor to seal')).toBeTruthy();
});
