import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { AnalyticsService } from '@/services/AnalyticsService';
import { playCreationSound } from '@/services/CreationSounds';
import { ENTRANCE, VisionEntrance, entranceLayout, fanSlot, type VisionEntranceProps } from '../VisionEntrance';
import { visionCeremonyCopy as copy } from '../visionCeremonyCopy';

jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn(() => ({ stop: jest.fn() })) }));
let mockReduced = false;
jest.mock('@/hooks/v2', () => ({ useV2ReduceMotion: () => mockReduced, v2Haptics: { selection: jest.fn() } }));
let mockExamples: Array<{ image: { uri: string }; caption: string; moment: string }> = [];
jest.mock('../visionExamples', () => ({ ...jest.requireActual('../visionExamples'), visionExamplesFor: () => mockExamples }));

const example = (i: number) => ({ image: { uri: `file:///example-${i}.webp` }, caption: `Example ${i}`, moment: `Moment ${i}.` });
const target = { x: 171, y: 66, width: 48, height: 48, opacity: 0 };
const handlers = () => ({ onPickExample: jest.fn(), onPickEmpty: jest.fn(), onWords: jest.fn(), onPhoto: jest.fn(), onBack: jest.fn(), onAnchorHandoff: jest.fn() });
function setup(overrides: Partial<VisionEntranceProps> = {}) {
  const fns = handlers();
  const props: VisionEntranceProps = { mode: 'create', anchorId: 'anchor', category: 'health', firstRun: true, anchorTarget: target, ...fns, ...overrides };
  return { ...render(<VisionEntrance {...props} />), ...fns, props };
}
async function advance(ms: number) { await act(async () => { jest.advanceTimersByTime(ms); }); }
const calls = (id: string) => (playCreationSound as jest.Mock).mock.calls.filter(([name]) => name === id);
const OPEN_DONE = ENTRANCE.driftAt + 100;

describe('VisionEntrance', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockReduced = false; mockExamples = [example(1), example(2), example(3)]; });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it('first run opens with one anchor pulse and a tick per print, then hands the anchor off once', async () => {
    const view = setup(); expect(view.getByTestId('vision-entrance-anchor')).toBeTruthy();
    await advance(OPEN_DONE);
    expect(calls('anchorPulse')).toEqual([['anchorPulse', 0.35]]);
    expect(calls('formTick')).toEqual([['formTick', 0.18], ['formTick', 0.18], ['formTick', 0.18]]);
    expect(calls('revealSettle')).toHaveLength(0); expect(view.onAnchorHandoff).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('vision-entrance-anchor')).toBeNull();
    expect(AnalyticsService.track).toHaveBeenCalledWith('vision_entrance_viewed', { anchor_id: 'anchor', mode: 'create', category: 'health', examples_shown: 3, first_run: true });
  });
  it('lands the lift and the ticks on the specified schedule', async () => {
    const view = setup(); let now = 0;
    const at = async (t: number) => { await advance(t - now); now = t; };
    await at(ENTRANCE.anchorAt - 1); expect(calls('anchorPulse')).toHaveLength(0);
    await at(ENTRANCE.anchorAt + 1); expect(calls('anchorPulse')).toHaveLength(1);
    await at(ENTRANCE.tickAt - 1); expect(calls('formTick')).toHaveLength(0);
    await at(ENTRANCE.tickAt + 1); expect(calls('formTick')).toHaveLength(1);
    await at(ENTRANCE.tickAt + ENTRANCE.spawnStagger * 2 + 1); expect(calls('formTick')).toHaveLength(3);
    await at(ENTRANCE.liftAt + ENTRANCE.liftMs - 1); expect(view.onAnchorHandoff).not.toHaveBeenCalled(); expect(view.getByTestId('vision-entrance-anchor')).toBeTruthy();
    await at(ENTRANCE.liftAt + ENTRANCE.liftMs + 1); expect(view.onAnchorHandoff).toHaveBeenCalledTimes(1);
    await at(ENTRANCE.liftAt + ENTRANCE.liftMs + ENTRANCE.handoffOverlapMs + 1); expect(view.queryByTestId('vision-entrance-anchor')).toBeNull();
  });
  it('a later visit plays no open, no sound and no hand-off', async () => {
    const view = setup({ firstRun: false }); await advance(OPEN_DONE * 2);
    expect(view.queryByTestId('vision-entrance-anchor')).toBeNull(); expect(playCreationSound).not.toHaveBeenCalled(); expect(view.onAnchorHandoff).not.toHaveBeenCalled();
    expect(AnalyticsService.track).toHaveBeenCalledWith('vision_entrance_viewed', expect.objectContaining({ first_run: false }));
    fireEvent.press(view.getByLabelText(copy.words)); expect(view.onWords).toHaveBeenCalledTimes(1);
  });
  it('Reduce Motion shows the final state at once, silently', async () => {
    mockReduced = true; const view = setup(); await advance(400);
    expect(view.queryByTestId('vision-entrance-anchor')).toBeNull(); expect(view.getAllByText(copy.exampleLabel)).toHaveLength(3);
    fireEvent.press(view.getByLabelText('Start from this example: Example 2'));
    expect(calls('anchorPulse')).toHaveLength(0); expect(calls('formTick')).toHaveLength(0);
  });
  it('reads as a headline, two buttons, a link, a hint and the print labels, and nothing else', () => {
    const view = setup({ firstRun: false });
    for (const text of [copy.askCreate, copy.words, copy.ownPhoto, copy.camera, copy.hintCreate, 'Example 1', 'Example 2', 'Example 3']) expect(view.getByText(text)).toBeTruthy();
    expect(view.getAllByText(copy.exampleLabel)).toHaveLength(3);
    for (const gone of [copy.footnote, copy.suggestionLabel, copy.anotherMoment, copy.add, 'Health']) expect(view.queryByText(gone)).toBeNull();
  });
  it('pins a bundled picture to its window, since it would otherwise keep its own pixel size', () => {
    const view = setup({ firstRun: false });
    expect(StyleSheet.flatten(view.getByTestId('vision-entrance-print-0-sharp').props.style)).toMatchObject({ width: '100%', height: '100%' });
  });
  it('ignores taps until the controls have faded in', async () => {
    const view = setup(); fireEvent.press(view.getByLabelText(copy.words)); fireEvent.press(view.getByLabelText('Start from this example: Example 1'));
    expect(view.onWords).not.toHaveBeenCalled(); await advance(ENTRANCE.pickMs * 2); expect(view.onPickExample).not.toHaveBeenCalled();
    await advance(ENTRANCE.ctaAt); fireEvent.press(view.getByLabelText(copy.words)); expect(view.onWords).toHaveBeenCalledTimes(1);
  });
  it('tapping an example settles, then hands the right example and index over after 900ms', async () => {
    const view = setup(); await advance(OPEN_DONE);
    fireEvent.press(view.getByLabelText('Start from this example: Example 3'));
    expect(calls('revealSettle')).toHaveLength(1);
    expect(AnalyticsService.track).toHaveBeenCalledWith('vision_example_picked', { anchor_id: 'anchor', mode: 'create', category: 'health', index: 2 });
    await advance(ENTRANCE.pickMs - 1); expect(view.onPickExample).not.toHaveBeenCalled();
    await advance(2); expect(view.onPickExample).toHaveBeenCalledWith(mockExamples[2], 2); expect(view.onPickExample).toHaveBeenCalledTimes(1);
    fireEvent.press(view.getByLabelText('Start from this example: Example 1')); await advance(ENTRANCE.pickMs + 50); expect(view.onPickExample).toHaveBeenCalledTimes(1);
  });
  it('the buttons play the tap cue and forward their source', async () => {
    const view = setup({ firstRun: false });
    fireEvent.press(view.getByLabelText(copy.ownPhoto)); fireEvent.press(view.getByLabelText(copy.camera));
    expect(view.onPhoto.mock.calls).toEqual([['library'], ['camera']]); expect(calls('uiTap')).toHaveLength(2);
    fireEvent.press(view.getByLabelText(copy.back)); expect(view.onBack).toHaveBeenCalledTimes(1);
  });
  it('shows a photo notice in place of the hint', () => {
    const view = setup({ firstRun: false, notice: 'Unable to open photo library.' });
    expect(view.getByText('Unable to open photo library.')).toBeTruthy(); expect(view.queryByText(copy.hintCreate)).toBeNull();
  });

  describe('add mode', () => {
    const add = (extra: Partial<VisionEntranceProps> = {}) => setup({ mode: 'add', firstRun: false, previewImageUrl: 'file:///latest.jpg', previewCaption: 'I am vibrant.', ...extra });
    it('shows the latest print as Yours with its pin, an opaque What else? frame, and one example', () => {
      const view = add();
      expect(view.getByText(copy.askAdd)).toBeTruthy(); expect(view.getByText(copy.yoursLabel)).toBeTruthy(); expect(view.getByText('I am vibrant.')).toBeTruthy();
      expect(view.getByTestId('vision-entrance-pin')).toBeTruthy(); expect(view.getByText(copy.whatElse)).toBeTruthy();
      expect(view.getAllByText(copy.exampleLabel)).toHaveLength(1); expect(view.getByText('Example 1')).toBeTruthy(); expect(view.getByText(copy.hintAdd)).toBeTruthy();
      const center = view.getByTestId('vision-entrance-print-1');
      expect(center).toBeTruthy(); expect(view.queryByTestId('vision-entrance-pick-0')).toBeNull();
      const opaque = view.UNSAFE_getAllByType(require('react-native').View).some((node: any) => [].concat(node.props.style ?? []).flat(3).some((style: any) => style?.backgroundColor === '#1A1D36'));
      expect(opaque).toBe(true);
    });
    it('tapping the frame opens an empty Describe after the pick animation; Yours cannot be picked', async () => {
      const view = add(); fireEvent.press(view.getByLabelText(copy.whatElse));
      await advance(ENTRANCE.pickMs + 50); expect(view.onPickEmpty).toHaveBeenCalledTimes(1); expect(view.onPickExample).not.toHaveBeenCalled();
    });
    it('tapping the example works the same as in create', async () => {
      const view = add(); fireEvent.press(view.getByLabelText('Start from this example: Example 1')); await advance(ENTRANCE.pickMs + 50);
      expect(view.onPickExample).toHaveBeenCalledWith(mockExamples[0], 0);
    });
    it('with no latest print it uses the create layout under the add headline', () => {
      const view = add({ previewImageUrl: null });
      expect(view.getByText(copy.askAdd)).toBeTruthy(); expect(view.getAllByText(copy.exampleLabel)).toHaveLength(3); expect(view.queryByText(copy.yoursLabel)).toBeNull();
      expect(view.getByText(copy.hintCreate)).toBeTruthy();
    });
  });

  describe('missing pictures', () => {
    it('renders the empty frame, not the old suggestion, when there are no examples at all', async () => {
      mockExamples = []; const view = setup({ firstRun: false });
      expect(view.getByText(copy.whatSee)).toBeTruthy(); expect(view.queryByText(copy.exampleLabel)).toBeNull(); expect(view.queryByText(copy.suggestionLabel)).toBeNull(); expect(view.queryByText(copy.hintCreate)).toBeNull();
      expect(AnalyticsService.track).toHaveBeenCalledWith('vision_entrance_viewed', expect.objectContaining({ examples_shown: 0 }));
      fireEvent.press(view.getByLabelText(copy.whatSee)); await advance(ENTRANCE.pickMs + 50); expect(view.onPickEmpty).toHaveBeenCalledTimes(1);
    });
    it('shows one print centred and two prints side by side', () => {
      mockExamples = [example(1)]; const one = setup({ firstRun: false });
      expect(one.getAllByText(copy.exampleLabel)).toHaveLength(1); one.unmount();
      mockExamples = [example(1), example(2)]; const two = setup({ firstRun: false });
      expect(two.getAllByText(copy.exampleLabel)).toHaveLength(2);
    });
  });
});

describe('entranceLayout', () => {
  const positions = ['left', 'center', 'right'] as const;
  const layout = (width: number, height: number, top = 47, bottom = 34) => {
    const anchorBottom = top + (height - top - bottom) * 0.025 + 48, footerTop = height - bottom - ENTRANCE.footerGap - ENTRANCE.footerHeight;
    return { ...entranceLayout({ width, anchorBottom, footerTop, positions: [...positions] }), anchorBottom, footerTop };
  };
  it('matches the reference frame: 170pt prints, centre print about 250pt down', () => {
    const frame = layout(390, 844);
    expect(frame.W).toBe(170); expect(frame.top).toBeGreaterThan(235); expect(frame.top).toBeLessThan(265);
    expect(frame.hintTop + 16 + 16).toBeLessThanOrEqual(frame.footerTop);
  });
  it('shrinks the prints on a 667pt screen so the hint clears the first button by 16pt', () => {
    const frame = layout(375, 667, 20, 0);
    expect(frame.W).toBeLessThan(165); expect(frame.hintTop + 16 + 16).toBeLessThanOrEqual(frame.footerTop);
    expect(frame.top + frame.H * 0.9).toBeLessThan(frame.footerTop);
  });
  it('keeps full-size prints and clear spacing on a 932pt screen', () => {
    const frame = layout(430, 932);
    expect(frame.W).toBe(170); expect(frame.hintTop + 16 + 16).toBeLessThanOrEqual(frame.footerTop);
  });
  it('puts the headline about 20pt under the anchor and the side prints on the specified fan', () => {
    const frame = layout(390, 844); expect(frame.headlineTop).toBe(frame.anchorBottom + 20);
    expect(fanSlot('left', 170)).toEqual(expect.objectContaining({ rot: -9, scale: 0.86, ty: 24 }));
    expect(fanSlot('right', 170).tx).toBeCloseTo(170 * 0.53); expect(fanSlot('center', 170)).toEqual(expect.objectContaining({ rot: 0, scale: 1 }));
  });
});
