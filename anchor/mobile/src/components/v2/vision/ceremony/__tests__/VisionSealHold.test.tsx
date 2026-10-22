import { act, fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import { VisionSealHold } from '../VisionSealHold';
import { CEREMONY } from '../VisionDevelop';

jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn(() => ({ stop: jest.fn() })) }));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { impact: jest.fn() } }));

describe('Vision seal commitment', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
  it('saves only at 1600ms and exactly once even if release follows commit', () => {
    const onCommit = jest.fn();
    const view = render(<VisionSealHold active committed={false} reduced={false} onCommit={onCommit}><View /></VisionSealHold>);
    const hold = view.getByTestId('vision-seal-hold');
    fireEvent(hold, 'pressIn');
    act(() => jest.advanceTimersByTime(1599));
    expect(onCommit).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    fireEvent(hold, 'pressOut'); fireEvent(hold, 'pressIn');
    act(() => jest.advanceTimersByTime(2000));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
  it('an early release makes no save call and permits another attempt', () => {
    const onCommit = jest.fn(), onAbandon = jest.fn();
    const view = render(<VisionSealHold active committed={false} reduced onCommit={onCommit} onAbandon={onAbandon}><View /></VisionSealHold>);
    const hold = view.getByTestId('vision-seal-hold');
    fireEvent(hold, 'pressIn'); act(() => jest.advanceTimersByTime(800)); fireEvent(hold, 'pressOut');
    act(() => jest.advanceTimersByTime(2000));
    expect(onCommit).not.toHaveBeenCalled(); expect(onAbandon).toHaveBeenCalledWith(.5);
    fireEvent(hold, 'pressIn'); act(() => jest.advanceTimersByTime(1600)); expect(onCommit).toHaveBeenCalledTimes(1);
  });
  it('a later image commits at its 900ms hold; the first image keeps 1600ms', () => {
    const later = jest.fn(), first = jest.fn();
    const laterView = render(<VisionSealHold active committed={false} reduced={false} holdMs={CEREMONY.sealHoldLaterMs} onCommit={later}><View /></VisionSealHold>);
    expect(CEREMONY.sealHoldLaterMs).toBe(900); expect(CEREMONY.sealHoldMs).toBe(1600);
    fireEvent(laterView.getByTestId('vision-seal-hold'), 'pressIn');
    act(() => jest.advanceTimersByTime(899)); expect(later).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1)); expect(later).toHaveBeenCalledTimes(1);
    laterView.unmount();
    const firstView = render(<VisionSealHold active committed={false} reduced={false} onCommit={first}><View /></VisionSealHold>);
    fireEvent(firstView.getByTestId('vision-seal-hold'), 'pressIn');
    act(() => jest.advanceTimersByTime(1599)); expect(first).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1)); expect(first).toHaveBeenCalledTimes(1);
  });
  it('the hold fires Light haptics only, never Medium', () => {
    (safeHaptics.impact as jest.Mock).mockClear();
    const onCommit = jest.fn();
    const view = render(<VisionSealHold active committed={false} reduced={false} onCommit={onCommit}><View /></VisionSealHold>);
    fireEvent(view.getByTestId('vision-seal-hold'), 'pressIn');
    act(() => jest.advanceTimersByTime(1600));
    const styles = (safeHaptics.impact as jest.Mock).mock.calls.map(call => call[0]);
    expect(styles.length).toBeGreaterThan(0);
    expect(styles).not.toContain(ImpactFeedbackStyle.Medium);
    expect(styles.every(style => style === ImpactFeedbackStyle.Light)).toBe(true);
  });
  it('accessibility activate commits immediately', () => {
    const onCommit = jest.fn();
    const view = render(<VisionSealHold active committed={false} reduced onCommit={onCommit}><View /></VisionSealHold>);
    fireEvent(view.getByTestId('vision-seal-hold'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
