import React from 'react';
import { fireEvent, render, renderHook, act } from '@testing-library/react-native';
import { ThreadStrengthExplainerSheet } from '../ThreadStrengthExplainerSheet';
import { ThreadStrengthEducationCard, useThreadStrengthEducation } from '../ThreadStrengthEducationCard';
import { useTeachingStore } from '@/stores/teachingStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { getLevelProgress, THREAD_STRENGTH_DECAY_COPY } from '@/constants/v2/threadStrengthCopy';

const mockDiscover = jest.fn();
const mockConfirm = jest.fn();
jest.mock('@/hooks/v2/guidance/guidanceRuntime', () => ({ discoverGuidance: (...args: unknown[]) => mockDiscover(...args) }));
jest.mock('@/hooks/v2/guidance/guidanceActions', () => ({ beginGuidanceAction: () => mockConfirm }));

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/hooks/v2', () => ({ useV2ReduceMotion: () => true }));
jest.mock('@/components/v2/primitives/V2SheetModal', () => {
  const { View } = require('react-native');
  return {
    V2SheetModal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => (visible ? <View>{children}</View> : null),
    V2SheetGrabZone: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    V2_SHEET_SKIRT: 48,
  };
});

describe('getLevelProgress', () => {
  it('reports the level and points to the next one', () => {
    expect(getLevelProgress(16)).toEqual({ level: 'Surface', nextLevel: 'Grounded', pointsToNext: 4 });
    expect(getLevelProgress(79)).toEqual({ level: 'Embedded', nextLevel: 'Sovereign', pointsToNext: 1 });
    expect(getLevelProgress(100)).toEqual({ level: 'Sovereign', nextLevel: null, pointsToNext: null });
  });
});

describe('ThreadStrengthExplainerSheet', () => {
  beforeEach(() => useSettingsStore.setState({ threadStrengthSensitivity: 'balanced' } as never));

  it('shows the title, the five levels, the current level and the real value', () => {
    const { getByText, getByTestId } = render(<ThreadStrengthExplainerSheet visible onClose={jest.fn()} strength={16} />);
    expect(getByText('Your Thread Strength')).toBeTruthy();
    for (const level of ['Surface', 'Grounded', 'Rooted', 'Embedded', 'Sovereign']) expect(getByText(level)).toBeTruthy();
    expect(getByText('0–19')).toBeTruthy();
    expect(getByText('80–100')).toBeTruthy();
    expect(getByText('16')).toBeTruthy();
    expect(getByText('4 points to Grounded')).toBeTruthy();
    expect(getByTestId('thread-strength-explainer-sheet-levels')).toBeTruthy();
  });

  it.each(['lenient', 'balanced', 'strict'] as const)('displays the %s decay preference and its plain-English rule', sensitivity => {
    useSettingsStore.setState({ threadStrengthSensitivity: sensitivity } as never);
    const { getByText } = render(<ThreadStrengthExplainerSheet visible onClose={jest.fn()} strength={40} />);
    expect(getByText(THREAD_STRENGTH_DECAY_COPY[sensitivity], { exact: false })).toBeTruthy();
    expect(getByText(sensitivity[0].toUpperCase() + sensitivity.slice(1) + '.', { exact: false })).toBeTruthy();
  });

  it('reveals the exact rules, including that the +12 bonus is once only', () => {
    const { getByTestId, queryByTestId, getByText } = render(<ThreadStrengthExplainerSheet visible onClose={jest.fn()} strength={40} />);
    expect(queryByTestId('thread-strength-explainer-sheet-rules')).toBeNull();
    fireEvent.press(getByTestId('thread-strength-explainer-sheet-rules-toggle'));
    expect(getByText(/First completed practice on an Anchor: \+12 bonus, once only\./)).toBeTruthy();
    expect(getByText(/First completed practice each day: \+1\.5\./)).toBeTruthy();
    expect(getByText(/Each eligible minute: \+0\.5\./)).toBeTruthy();
    expect(getByText(/up to 10 minutes/)).toBeTruthy();
  });

  it('omits the current-value block when Strength is not established, and renders nothing when closed', () => {
    const { queryByTestId, rerender } = render(<ThreadStrengthExplainerSheet visible onClose={jest.fn()} strength={null} />);
    expect(queryByTestId('thread-strength-explainer-sheet-current')).toBeNull();
    rerender(<ThreadStrengthExplainerSheet visible={false} onClose={jest.fn()} strength={null} />);
    expect(queryByTestId('thread-strength-explainer-sheet-levels')).toBeNull();
  });
});

describe('first-practice education', () => {
  beforeEach(() => useTeachingStore.getState().reset());

  it('is hidden until the first-practice scene flags it, then shows once and stays dismissed', () => {
    const { result, rerender } = renderHook(() => useThreadStrengthEducation(14));
    expect(result.current.visible).toBe(false);

    act(() => useTeachingStore.getState().setUserFlag('threadStrengthEducationPending', true));
    rerender({});
    expect(result.current.visible).toBe(true);

    act(() => result.current.dismiss());
    rerender({});
    expect(result.current.visible).toBe(false);
    expect(useTeachingStore.getState().userFlags.hasSeenThreadStrengthEducation).toBe(true);

    // Even if something re-flags it, a dismissed education never returns.
    act(() => useTeachingStore.getState().setUserFlag('threadStrengthEducationPending', true));
    rerender({});
    expect(result.current.visible).toBe(false);
  });

  it('never shows without an established Strength value', () => {
    act(() => useTeachingStore.getState().setUserFlag('threadStrengthEducationPending', true));
    const { result } = renderHook(() => useThreadStrengthEducation(null));
    expect(result.current.visible).toBe(false);
  });

  it('shows the real value and level and can be dismissed', () => {
    const onDismiss = jest.fn();
    const { getByText, getByTestId } = render(<ThreadStrengthEducationCard strength={13.58} onDismiss={onDismiss} />);
    expect(getByText('Your Anchor is taking hold.')).toBeTruthy();
    expect(getByText(/Thread Strength is now 14, Surface\./)).toBeTruthy();
    fireEvent.press(getByTestId('thread-strength-education-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

it('records voluntary explainer discovery once per opening for only the two Thread lessons', () => {
 mockDiscover.mockClear(); mockConfirm.mockClear();
 const close = jest.fn();
 const view = render(<ThreadStrengthExplainerSheet visible={false} onClose={close} strength={0} />);
 expect(mockDiscover).not.toHaveBeenCalled();
 view.rerender(<ThreadStrengthExplainerSheet visible onClose={close} strength={0} />);
 expect(mockDiscover.mock.calls.map(call => call[1])).toEqual(['thread.glow', 'progress.levels']);
 view.rerender(<ThreadStrengthExplainerSheet visible onClose={close} strength={10} />);
 expect(mockDiscover).toHaveBeenCalledTimes(2);
 fireEvent.press(view.getByLabelText('Close Thread Strength explanation'));
 expect(close).toHaveBeenCalledTimes(1);
});
