import React from 'react';
import { act, configure, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ChartIntroOpening } from '../ChartIntroOpening';
import { CHART_INTRO_TIMING, CHART_MAP_REDUCED_FADE } from '../chartMotion';
import { getChartIntroSeen, setChartIntroSeen } from '../chartIntroSeen';
import { useChartSound } from '../useChartSound';
import type { SequenceSpec } from '../map/chartMapContracts';

configure({ defaultIncludeHiddenElements: true });

let mockSeen = false;
let mockTier: 'high' | 'medium' | 'low' = 'high';
let mockIntroProgress: { route: { value: number }; marker: { value: number }; land: { value: number } } | null = null;
let mockMapBaseVisible: boolean | undefined;
let mockMapMountCount = 0;
let mockMapInstance: object | null = null;
let mockSpec: SequenceSpec | null = null;
let mockResolve: (() => void) | null = null;
const mockBusy = { current: false };
const mockRun = jest.fn((spec: SequenceSpec) => {
  mockBusy.current = true;
  mockSpec = spec;
  return new Promise<void>(resolve => { mockResolve = () => { mockBusy.current = false; resolve(); }; });
});
const mockSkip = jest.fn(() => { mockBusy.current = false; });
const mockCancel = jest.fn(() => { mockBusy.current = false; });
const mockRunner = { run: mockRun, skip: mockSkip, cancel: mockCancel, isBusy: () => mockBusy.current };
const mockSound = {
  open: jest.fn(), ink: jest.fn(), flag: jest.fn(), duck: jest.fn(),
  startAir: jest.fn(), stopAir: jest.fn(), check: jest.fn(), stamp: jest.fn(), wind: jest.fn(),
};

jest.mock('../chartIntroSeen', () => ({
  getChartIntroSeen: jest.fn(() => Promise.resolve(mockSeen)),
  setChartIntroSeen: jest.fn(() => Promise.resolve()),
}));
jest.mock('../useChartSound', () => ({ useChartSound: jest.fn(() => mockSound) }));
jest.mock('@/hooks/usePerformanceTier', () => ({ usePerformanceTier: () => mockTier }));
jest.mock('../map/useChartSequencer', () => ({
  useChartSequencer: () => mockRunner,
}));
jest.mock('../panel/ChartStaticMap', () => {
  const mockReact = jest.requireActual('react');
  const mockNative = jest.requireActual('react-native');
  return {
    ChartStaticMap: (props: { testID?: string; onArtReady?: (ready: boolean) => void; onIntroSurfaceSized?: () => void; onMapPress?: () => void; introProgress?: typeof mockIntroProgress; introBaseVisible?: boolean }) => {
      const [instance] = mockReact.useState(() => ({ id: ++mockMapMountCount }));
      mockMapInstance = instance;
      mockIntroProgress = props.introProgress ?? null;
      mockMapBaseVisible = props.introBaseVisible;
      mockReact.useEffect(() => { props.onArtReady?.(true); props.onIntroSurfaceSized?.(); }, [props.onArtReady, props.onIntroSurfaceSized]);
      return mockReact.createElement(mockNative.Pressable, { testID: props.testID, onPress: props.onMapPress }, mockReact.createElement(mockNative.Text, null, 'Map'));
    },
  };
});
jest.mock('@/components/v2/primitives/V2Button', () => {
  const mockReact = jest.requireActual('react');
  const mockNative = jest.requireActual('react-native');
  return {
    V2Button: (props: { testID?: string; disabled?: boolean; onPress?: () => void; children: React.ReactNode }) => mockReact.createElement(
      mockNative.Pressable,
      { testID: props.testID, accessibilityRole: 'button', accessibilityState: { disabled: props.disabled }, disabled: props.disabled, onPress: props.onPress },
      mockReact.createElement(mockNative.Text, null, props.children),
    ),
  };
});
jest.mock('expo-linear-gradient', () => {
  const mockReact = jest.requireActual('react');
  const mockNative = jest.requireActual('react-native');
  return { LinearGradient: (props: object) => mockReact.createElement(mockNative.View, props) };
});

const props = { category: 'career', categoryColor: '#345678', reducedMotion: false, onContinue: jest.fn() };
const callAt = (spec: SequenceSpec, at: number) => spec.steps.find(step => step.kind === 'call' && step.at === at);

beforeEach(() => {
  mockSeen = false;
  mockTier = 'high';
  mockIntroProgress = null;
  mockMapBaseVisible = undefined;
  mockMapMountCount = 0;
  mockMapInstance = null;
  mockSpec = null;
  mockResolve = null;
  mockBusy.current = false;
  mockRun.mockClear();
  mockSkip.mockClear();
  mockCancel.mockClear();
  (getChartIntroSeen as jest.Mock).mockClear();
  Object.values(mockSound).forEach(value => value.mockClear());
  (getChartIntroSeen as jest.Mock).mockImplementation(() => Promise.resolve(mockSeen));
  (setChartIntroSeen as jest.Mock).mockClear();
  props.onContinue.mockClear();
});

describe('ChartIntroOpening', () => {
  it('keeps the native map mounted under preparation cover and starts only after exposure', async () => {
    const frames: FrameRequestCallback[] = [];
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
      frames.push(callback);
      return frames.length;
    });
    const onIntroSurfaceReady = jest.fn();
    const screen = render(<ChartIntroOpening {...props} preparing onIntroSurfaceReady={onIntroSurfaceReady} />);
    await waitFor(() => expect(mockMapInstance).not.toBeNull());
    const mountedMap = mockMapInstance;
    expect(getChartIntroSeen).not.toHaveBeenCalled();
    expect(mockRun).not.toHaveBeenCalled();
    expect(mockSound.startAir).not.toHaveBeenCalled();
    expect(mockSound.open).not.toHaveBeenCalled();
    expect(screen.getByTestId('chart-intro-opening').props.accessibilityElementsHidden).toBe(true);
    await waitFor(() => expect(frames).toHaveLength(1));
    act(() => frames[0](0));
    expect(frames).toHaveLength(2);
    expect(onIntroSurfaceReady).not.toHaveBeenCalled();
    act(() => frames[1](16));
    expect(onIntroSurfaceReady).toHaveBeenCalledTimes(1);

    screen.rerender(<ChartIntroOpening {...props} preparing={false} initialSeen={false} onIntroSurfaceReady={onIntroSurfaceReady} artReadyAtMount artPreparationSettledAtMount />);
    await waitFor(() => expect(mockSpec?.name).toBe('introFull'));
    expect(mockMapInstance).toBe(mountedMap);
    expect(mockMapMountCount).toBe(1);
    expect(mockSound.startAir).not.toHaveBeenCalled();
  });

  it('waits for the stored seen state and decoded map before starting the first-time sequence', async () => {
    let resolveSeen!: (seen: boolean) => void;
    (getChartIntroSeen as jest.Mock).mockImplementation(() => new Promise<boolean>(resolve => { resolveSeen = resolve; }));
    render(<ChartIntroOpening {...props} />);
    expect(mockIntroProgress?.route.value).toBe(0);
    expect(mockIntroProgress?.marker.value).toBe(0);
    expect(mockRun).not.toHaveBeenCalled();
    await act(async () => { resolveSeen(false); });
    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));
    expect(mockSpec?.name).toBe('introFull');
    const start = callAt(mockSpec!, 0);
    await act(async () => { if (start?.kind === 'call') start.run(); });
    expect(mockSound.startAir).toHaveBeenCalledTimes(1);
    expect(mockSound.open).not.toHaveBeenCalled();
    const open = callAt(mockSpec!, CHART_INTRO_TIMING.openAt);
    await act(async () => { if (open?.kind === 'call') open.run(); });
    expect(mockSound.open).toHaveBeenCalledTimes(1);
  });

  it('keeps settled land layers mounted and masked while the final crossfade is pending', async () => {
    render(<ChartIntroOpening {...props} initialSeen={false} artReadyAtMount artPreparationSettledAtMount />);
    await waitFor(() => expect(mockSpec?.name).toBe('introFull'));
    expect(mockMapBaseVisible).toBe(true);
    expect(mockIntroProgress?.land.value).toBe(0);
    const reveal = callAt(mockSpec!, CHART_INTRO_TIMING.landPrepareAt);
    expect(reveal?.kind).toBe('call');
    await act(async () => { if (reveal?.kind === 'call') reveal.run(); });
    expect(mockMapBaseVisible).toBe(true);
    expect(mockIntroProgress?.land.value).toBe(0);
  });

  it('falls back to the full first-time sequence when intro storage rejects', async () => {
    (getChartIntroSeen as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'));
    render(<ChartIntroOpening {...props} />);
    await waitFor(() => expect(mockSpec?.name).toBe('introFull'));
  });

  it('does not restart or cancel an opening when the performance tier resolves mid-sequence', async () => {
    const screen = render(<ChartIntroOpening {...props} />);
    await waitFor(() => expect(mockSpec?.name).toBe('introFull'));
    mockTier = 'low';
    screen.rerender(<ChartIntroOpening {...props} />);
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('cancels delayed intro visuals after the open cue and does not replay that cue', async () => {
    const screen = render(<ChartIntroOpening {...props} />);
    await waitFor(() => expect(mockSpec?.name).toBe('introFull'));
    const original = mockSpec!;
    const open = callAt(original, CHART_INTRO_TIMING.openAt);
    await act(async () => { if (open?.kind === 'call') open.run(); });
    screen.rerender(<ChartIntroOpening {...props} reducedMotion />);
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledTimes(2);
    expect(mockSpec?.name).toBe('introReduced');
    expect(mockSpec?.steps.some(step => step.kind === 'call' && step.transient)).toBe(false);
    expect(mockSound.stopAir).toHaveBeenCalledTimes(1);
    expect(original.steps.filter(step => step.kind === 'call' && step.transient)).toHaveLength(4);
    expect(mockSound.open).toHaveBeenCalledTimes(1);
    expect(mockSpec?.steps.filter(step => step.kind === 'tween').every(step => step.kind === 'tween' && step.duration <= CHART_MAP_REDUCED_FADE)).toBe(true);
  });

  it('keeps the reduced open cue when Reduce Motion is enabled before the original open beat', async () => {
    const screen = render(<ChartIntroOpening {...props} />);
    await waitFor(() => expect(mockSpec?.name).toBe('introFull'));
    screen.rerender(<ChartIntroOpening {...props} reducedMotion />);
    expect(mockSpec?.name).toBe('introReduced');
    const open = mockSpec!.steps.find(step => step.kind === 'call' && step.transient);
    await act(async () => { if (open?.kind === 'call') open.run(); });
    expect(mockSound.open).toHaveBeenCalledTimes(1);
  });

  it('cancels the running sequence when the intro unmounts', async () => {
    const screen = render(<ChartIntroOpening {...props} />);
    await waitFor(() => expect(mockSpec?.name).toBe('introFull'));
    screen.unmount();
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('marks the intro seen at route start, even though the complete sequence continues', async () => {
    render(<ChartIntroOpening {...props} />);
    await waitFor(() => expect(mockSpec?.name).toBe('introFull'));
    const routeStart = callAt(mockSpec!, CHART_INTRO_TIMING.routeAt);
    await act(async () => { if (routeStart?.kind === 'call') routeStart.run(); });
    expect(setChartIntroSeen).toHaveBeenCalledTimes(1);
  });

  it('selects the short version for a returning account and uses its one-second route sound', async () => {
    mockSeen = true;
    render(<ChartIntroOpening {...props} />);
    await waitFor(() => expect(mockSpec?.name).toBe('introShort'));
    const transientBeats = mockSpec!.steps.filter(step => step.kind === 'call' && step.transient);
    await act(async () => { if (transientBeats[1]?.kind === 'call') transientBeats[1].run(); });
    expect(mockSound.ink).toHaveBeenCalledWith(CHART_INTRO_TIMING.shortRoute);
    expect(mockSound.startAir).not.toHaveBeenCalled();
  });

  it('uses the reduced-motion crossfade sequence and plays its open cue', async () => {
    render(<ChartIntroOpening {...props} reducedMotion />);
    await waitFor(() => expect(mockSpec?.name).toBe('introReduced'));
    const open = mockSpec!.steps.find(step => step.kind === 'call' && step.transient);
    await act(async () => { if (open?.kind === 'call') open.run(); });
    expect(mockSound.open).toHaveBeenCalledTimes(1);
    expect(mockSound.startAir).not.toHaveBeenCalled();
  });

  it('always uses the short sweep for low performance tier', async () => {
    mockTier = 'low';
    render(<ChartIntroOpening {...props} />);
    await waitFor(() => expect(mockSpec?.name).toBe('introShort'));
    expect(mockSound.startAir).not.toHaveBeenCalled();
  });

  it('starts on the first layout commit when seen state and map art are parent-prepared', async () => {
    render(<ChartIntroOpening {...props} initialSeen={false} artReadyAtMount introWidth={393} />);
    expect(getChartIntroSeen).not.toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockSpec?.name).toBe('introFull');
    expect(mockIntroProgress?.route.value).toBe(0);
    const start = callAt(mockSpec!, 0);
    await act(async () => { if (start?.kind === 'call') start.run(); });
    expect(mockSound.startAir).toHaveBeenCalledTimes(1);
  });

  it('uses the final reduced sequence when parent shader preparation has settled unsuccessfully', async () => {
    render(<ChartIntroOpening {...props} initialSeen={false} artReadyAtMount={false} artPreparationSettledAtMount />);
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockSpec?.name).toBe('introReduced');
    const open = mockSpec!.steps.find(step => step.kind === 'call' && step.transient);
    await act(async () => { if (open?.kind === 'call') open.run(); });
    expect(mockSound.open).toHaveBeenCalledTimes(1);
    expect(mockSound.startAir).not.toHaveBeenCalled();
  });

  it('honors an explicit full replay on low-tier devices in the dev lab', async () => {
    mockTier = 'low';
    render(<ChartIntroOpening {...props} replayMode="full" initialSeen={false} artReadyAtMount />);
    await waitFor(() => expect(mockSpec?.name).toBe('introFull'));
    expect(mockSound.startAir).toHaveBeenCalledTimes(0);
  });

  it('uses a silent 250ms map-tap skip and keeps Continue hidden until it appears', async () => {
    const { getByTestId } = render(<ChartIntroOpening {...props} />);
    await waitFor(() => expect(mockSpec?.name).toBe('introFull'));
    expect(getByTestId('chart-create-cta').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('chart-intro-continue-wrap').props.pointerEvents).toBe('none');
    expect(getByTestId('chart-intro-continue-wrap').props.accessibilityElementsHidden).toBe(true);
    fireEvent.press(getByTestId('chart-intro-map'));
    expect(mockRun).toHaveBeenCalledTimes(2);
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockSpec?.name).toBe('introSkip');
    expect(mockSpec?.steps.some(step => step.kind === 'call' && step.transient)).toBe(false);
    expect(mockSpec?.steps.filter(step => step.kind === 'tween').every(step => step.kind === 'tween' && step.duration === CHART_INTRO_TIMING.skip)).toBe(true);
    const visible = callAt(mockSpec!, 0);
    await act(async () => { if (visible?.kind === 'call') visible.run(); });
    expect(getByTestId('chart-create-cta').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(getByTestId('chart-create-cta'));
    expect(props.onContinue).toHaveBeenCalledTimes(1);
    expect(mockSound.stopAir).toHaveBeenCalledTimes(1);
  });

  it('accepts a skip request forwarded from non-button header content', async () => {
    render(<ChartIntroOpening {...props} skipRequest={1} />);
    await waitFor(() => expect(mockSpec?.name).toBe('introSkip'));
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockSpec?.steps.some(step => step.kind === 'call' && step.transient)).toBe(false);
  });
});
