import { act, fireEvent, render } from '@testing-library/react-native';
import { AppState, Pressable } from 'react-native';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useVisionPicker, VisionPickerHolding } from '../VisionPickerHolding';
jest.mock('@/hooks/v2', () => ({ useV2ReduceMotion: () => true }));
jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));

function Harness({ open, consume }: { open: () => Promise<string>; consume: (value: string) => void }) {
  const picker = useVisionPicker('anchor');
  return <><Pressable testID="open" onPress={() => { void picker.run(open, consume); }} />
    {picker.state ? <VisionPickerHolding retrying={picker.state === 'retry'} onRetry={picker.retry} onBack={picker.dismiss} /> : null}</>;
}
describe('Vision picker presentation', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
  it('holds the ceremony and retries a missing presentation after 1500ms', async () => {
    const open = jest.fn().mockImplementationOnce(() => new Promise(() => undefined)).mockResolvedValueOnce('photo');
    const consume = jest.fn(), view = render(<Harness open={open} consume={consume} />);
    await act(async () => { fireEvent.press(view.getByTestId('open')); });
    expect(view.getByTestId('vision-picker-holding')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(1499); }); expect(view.queryByLabelText('Retry opening photos')).toBeNull();
    act(() => { jest.advanceTimersByTime(1); }); expect(view.getByLabelText('Retry opening photos')).toBeTruthy();
    expect(AnalyticsService.track).toHaveBeenCalledWith('vision_picker_failed', expect.objectContaining({ reason: 'presentation_timeout' }));
    await act(async () => { fireEvent.press(view.getByLabelText('Retry opening photos')); });
    expect(open).toHaveBeenCalledTimes(2); expect(consume).toHaveBeenCalledWith('photo');
    expect(view.queryByTestId('vision-picker-holding')).toBeNull();
  });
  it('measures native presentation once and does not confuse time choosing photos with open latency', async () => {
    const open = jest.fn(() => new Promise<string>(() => undefined));
    const view = render(<Harness open={open} consume={jest.fn()} />);
    const listeners = AppState.addEventListener as unknown as jest.Mock;
    const before = listeners.mock.calls.length;
    await act(async () => { fireEvent.press(view.getByTestId('open')); });
    act(() => { jest.advanceTimersByTime(100); listeners.mock.calls.slice(before).filter(([name]) => name === 'blur').forEach(([, handler]) => handler()); });
    act(() => { jest.advanceTimersByTime(30000); });
    expect(AnalyticsService.track).toHaveBeenCalledWith('vision_picker_open_ms', expect.objectContaining({ duration_ms: 100, signal: 'native_blur' }));
    expect(AnalyticsService.track).not.toHaveBeenCalledWith('vision_picker_failed', expect.anything());
    expect(view.queryByLabelText('Retry opening photos')).toBeNull();
  });
  it('ignores an older attempt that returns after retry or dismissal', async () => {
    let resolveOld!: (value: string) => void;
    const open = jest.fn().mockImplementationOnce(() => new Promise<string>(resolve => { resolveOld = resolve; })).mockResolvedValueOnce('new');
    const consume = jest.fn(), view = render(<Harness open={open} consume={consume} />);
    await act(async () => { fireEvent.press(view.getByTestId('open')); });
    act(() => { jest.advanceTimersByTime(1500); });
    await act(async () => { fireEvent.press(view.getByLabelText('Retry opening photos')); });
    await act(async () => { resolveOld('old'); });
    expect(consume).toHaveBeenCalledTimes(1); expect(consume).toHaveBeenCalledWith('new');
  });
});
