import { act, fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { safeHaptics } from '@/utils/haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { VisionImageArrivalProvider, useVisionImageArrival } from '../VisionImageArrival';
import { visionCelebrationTrace } from '../ceremony/visionCelebrationTrace';
jest.mock('@/hooks/v2', () => ({ useV2ReduceMotion: () => false }));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { impact: jest.fn() } }));
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn(() => ({ stop: jest.fn() })) }));
jest.mock('../ceremony/visionCelebrationTrace', () => ({ visionCelebrationTrace: jest.fn() }));

function Flow({ first = false }: { first?: boolean }) {
  const arrival = useVisionImageArrival()!;
  return <><Pressable testID="begin" onPress={() => arrival.beginSet?.([0, 1, 2, 3].map(index => ({
    sceneId: `scene-${index}`, url: `https://cdn/photo-${index}.jpg`, source: { x: 30, y: 100, width: 220, height: 300 },
  })), first)} />
    <Pressable testID="measure" onPress={() => [0, 1, 2, 3].forEach(index => arrival.landSet?.(`scene-${index}`, {
      x: index * 60, y: 300, width: 90, height: 120,
    }))} />
    <Text testID="phases">{arrival.setPrints?.map(item => item.phase).join(',')}</Text>
    <Text testID="active">{String(arrival.setActive)}</Text></>;
}
describe('each saved photo arrives at its existing measured board slot', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
  const advance = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
  function start(first: boolean) {
    const view = render(<VisionImageArrivalProvider><Flow first={first} /></VisionImageArrivalProvider>);
    fireEvent.press(view.getByTestId('begin')); fireEvent.press(view.getByTestId('measure'));
    for (let i = 0; i < 4; i++) fireEvent(view.getByTestId(`vision-arrival-set-scene-${i}`, { includeHiddenElements: true }), 'load');
    return view;
  }
  it('staggered flights land 120ms apart, pin after landing, and release the orb after the last pin', async () => {
    const view = start(true);
    await advance(759); expect(view.getByTestId('phases').props.children).toBe('flying,flying,flying,flying');
    await advance(1); expect(view.getByTestId('phases').props.children).toBe('landed,flying,flying,flying');
    await advance(120); expect(view.getByTestId('phases').props.children).toBe('landed,landed,flying,flying');
    await advance(550 + 240); expect(view.getByTestId('phases').props.children).toBe('pinned,pinned,pinned,pinned');
    expect(view.getByTestId('active').props.children).toBe('false');
    expect(safeHaptics.impact).not.toHaveBeenCalled(); // Heavy belongs exclusively to the seal stamp.
    expect((visionCelebrationTrace as jest.Mock).mock.calls.filter(([trigger]) => trigger === 'pin dropped')).toHaveLength(4);
  });
  it('later sets fire exactly one Medium at impact and no Heavy or additional pin haptics', async () => {
    start(false); await advance(2500);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith(ImpactFeedbackStyle.Medium);
    await advance(2500); expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
  });
  it('waits for a slow sibling decoder before starting the set in card order', async () => {
    const view = render(<VisionImageArrivalProvider><Flow first /></VisionImageArrivalProvider>);
    fireEvent.press(view.getByTestId('begin')); fireEvent.press(view.getByTestId('measure'));
    for (let i = 0; i < 3; i++) fireEvent(view.getByTestId(`vision-arrival-set-scene-${i}`, { includeHiddenElements: true }), 'load');
    await advance(1000); expect(view.getByTestId('phases').props.children).toBe('waiting,waiting,waiting,waiting');
    fireEvent(view.getByTestId('vision-arrival-set-scene-3', { includeHiddenElements: true }), 'load');
    await advance(760); expect(view.getByTestId('phases').props.children).toBe('landed,flying,flying,flying');
    await advance(120); expect(view.getByTestId('phases').props.children).toBe('landed,landed,flying,flying');
  });
  it('a missing decoder or measurement callback gives way to the persisted board', async () => {
    const view = render(<VisionImageArrivalProvider><Flow first /></VisionImageArrivalProvider>);
    fireEvent.press(view.getByTestId('begin')); await advance(4400);
    expect(view.getByTestId('active').props.children).toBe('false');
    expect(view.getByTestId('phases').props.children).toBe('failed,failed,failed,failed');
    expect(safeHaptics.impact).not.toHaveBeenCalled();
  });
});
