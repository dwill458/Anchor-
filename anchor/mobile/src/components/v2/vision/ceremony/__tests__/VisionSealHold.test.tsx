import { act, fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';
import { VisionSealHold } from '../VisionSealHold';

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
  it('accessibility activate commits immediately', () => {
    const onCommit = jest.fn();
    const view = render(<VisionSealHold active committed={false} reduced onCommit={onCommit}><View /></VisionSealHold>);
    fireEvent(view.getByTestId('vision-seal-hold'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
