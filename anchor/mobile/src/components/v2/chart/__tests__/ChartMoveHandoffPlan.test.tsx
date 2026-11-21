import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import type { MovePlan } from '@/types/chart';

let mockOneMove: { id: string; title: string; plan?: MovePlan | null } | null = null;
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('@/stores/encryptedPersistStorage', () => ({ encryptedPersistStorage: { getItem: async () => null, setItem: async () => undefined } }));
jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({
  trackChart: jest.fn(),
  useAnchorChart: () => ({ view: { oneMove: mockOneMove, isFinished: false } }),
}));
import { ChartMoveHandoff, resetChartHandoffMemory } from '../ChartMoveHandoff';

beforeEach(() => resetChartHandoffMemory());

const today = new Date();
const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

it('renders the plan line when the One Move has a cue or a day', async () => {
  mockOneMove = { id: 'm', title: 'Open the curtains', plan: { cue: 'After I wake up', date: todayKey, time: null, remind: false } };
  const screen = render(<ChartMoveHandoff anchorId="a1" surface="practice" tone="ink" />);
  await waitFor(() => expect(screen.getByTestId('chart-handoff-plan').props.children).toBe('After I wake up · Today'));
});

it('renders no plan line without a cue or a day', async () => {
  mockOneMove = { id: 'm', title: 'Open the curtains', plan: null };
  const screen = render(<ChartMoveHandoff anchorId="a2" surface="practice" tone="ink" />);
  await waitFor(() => expect(screen.getByTestId('chart-handoff-practice')).toBeTruthy());
  expect(screen.queryByTestId('chart-handoff-plan')).toBeNull();
});
