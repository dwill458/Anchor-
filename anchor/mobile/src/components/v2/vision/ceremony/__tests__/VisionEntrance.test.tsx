import { act, fireEvent, render } from '@testing-library/react-native';
import { Image, StyleSheet } from 'react-native';
import { AnalyticsService } from '@/services/AnalyticsService';
import { playCreationSound } from '@/services/CreationSounds';
import { ENTRANCE, VisionEntrance, emergeRank, entranceLayout, fanSlot, type VisionEntranceProps } from '../VisionEntrance';
import { VISION_ENTRANCE_EXAMPLES } from '../visionEntranceExamples';
import { visionCeremonyCopy as copy } from '../visionCeremonyCopy';

jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn(() => ({ stop: jest.fn() })) }));
let mockReduced = false;
let mockTier = 'high';
jest.mock('@/hooks/v2', () => ({ useV2ReduceMotion: () => mockReduced, v2Haptics: { selection: jest.fn() } }));
jest.mock('@/hooks/useAppPerformanceTier', () => ({ useAppPerformanceTier: () => mockTier }));

const target = { x: 171, y: 66, width: 48, height: 48, opacity: 0 };
const handlers = () => ({ onWords: jest.fn(), onBack: jest.fn(), onAnchorHandoff: jest.fn() });
function setup(overrides: Partial<VisionEntranceProps> = {}) {
  const fns = handlers();
  const props: VisionEntranceProps = { mode: 'create', anchorId: 'anchor', category: 'health', firstRun: true, anchorTarget: target, ...fns, ...overrides };
  return { ...render(<VisionEntrance {...props} />), ...fns, props };
}
async function advance(ms: number) { await act(async () => { jest.advanceTimersByTime(ms); }); }
const calls = (id: string) => (playCreationSound as jest.Mock).mock.calls.filter(([name]) => name === id);
const OPEN_DONE = ENTRANCE.liftAt + ENTRANCE.liftMs + ENTRANCE.handoffOverlapMs + 100;
/** The photograph of one print: the cover-mode image, not the frame art. */
const byId = (view: ReturnType<typeof setup>, id: string) => view.getByTestId(id, { includeHiddenElements: true });
const shown = (view: ReturnType<typeof setup>, text: string) => view.getByText(text, { includeHiddenElements: true });
const photoOf = (view: ReturnType<typeof setup>, index: number) => byId(view, `vision-entrance-print-${index}`).findAll((node: any) => node.type === Image && node.props.resizeMode === 'cover')[0];

describe('VisionEntrance', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockReduced = false; mockTier = 'high'; });
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
  it('keeps each print inside the 300-450ms window and the stagger inside 80-130ms', () => {
    expect(ENTRANCE.spawnMs).toBeGreaterThanOrEqual(300); expect(ENTRANCE.spawnMs).toBeLessThanOrEqual(450);
    expect(ENTRANCE.spawnStagger).toBeGreaterThanOrEqual(80); expect(ENTRANCE.spawnStagger).toBeLessThanOrEqual(130);
    expect(ENTRANCE.printFadeMs).toBeLessThanOrEqual(ENTRANCE.spawnMs);
  });
  it('brings the centre print out first and opens the fan to either side behind it', () => {
    expect(emergeRank('center')).toBe(0); expect(emergeRank('left')).toBe(1); expect(emergeRank('right')).toBe(2);
    expect(emergeRank('twoL')).toBeLessThan(emergeRank('twoR'));
  });
  it('a later visit plays no open, no sound and no hand-off', async () => {
    const view = setup({ firstRun: false }); await advance(OPEN_DONE * 2);
    expect(view.queryByTestId('vision-entrance-anchor')).toBeNull(); expect(playCreationSound).not.toHaveBeenCalled(); expect(view.onAnchorHandoff).not.toHaveBeenCalled();
    expect(AnalyticsService.track).toHaveBeenCalledWith('vision_entrance_viewed', expect.objectContaining({ first_run: false }));
    fireEvent.press(view.getByLabelText(copy.createVision)); expect(view.onWords).toHaveBeenCalledTimes(1);
  });
  it('Reduce Motion shows the final state at once, silently', async () => {
    mockReduced = true; const view = setup(); await advance(400);
    expect(view.queryByTestId('vision-entrance-anchor')).toBeNull();
    for (const example of VISION_ENTRANCE_EXAMPLES) expect(shown(view, example.caption)).toBeTruthy();
    expect(calls('anchorPulse')).toHaveLength(0); expect(calls('formTick')).toHaveLength(0);
  });
  it('reads as a headline, one call to action, a supporting line and three captioned prints, and nothing else', () => {
    const view = setup({ firstRun: false });
    for (const text of [copy.askCreate, copy.createVision, copy.startFrom]) expect(view.getByText(text)).toBeTruthy();
    for (const text of ['I built this.', 'I actually did it.', 'This is my life.']) expect(shown(view, text)).toBeTruthy();
    for (const gone of ['Tap one to start from it', copy.words, copy.ownPhoto, copy.camera, 'Add a note', copy.footnote, copy.suggestionLabel, copy.anotherMoment, copy.add, 'Health']) expect(view.queryByText(gone)).toBeNull();
  });
  it('the example prints are purely decorative: no press handler, hidden from accessibility', () => {
    const view = setup({ firstRun: false });
    expect(view.queryAllByLabelText(/Start from this example/)).toHaveLength(0);
    for (let i = 0; i < 3; i += 1) {
      const slot = byId(view, `vision-entrance-slot-${i}`);
      expect(slot.findAll((node: any) => typeof node.props?.onPress === 'function' || typeof node.props?.onStartShouldSetResponder === 'function')).toHaveLength(0);
      let node: any = byId(view, `vision-entrance-print-${i}`), hidden = false;
      while (node) { if (node.props?.importantForAccessibility === 'no-hide-descendants' || node.props?.accessibilityElementsHidden) hidden = true; node = node.parent; }
      expect(hidden).toBe(true);
    }
  });
  it('lays each photograph out at its own proportions inside the frame, never stretched', () => {
    const view = setup({ firstRun: false });
    VISION_ENTRANCE_EXAMPLES.forEach((example, index) => {
      const style = StyleSheet.flatten(photoOf(view, index).props.style);
      expect(style.width / style.height).toBeCloseTo(example.size.width / example.size.height, 2);
    });
  });
  it('anchors a portrait photograph near the top of its window so the head is kept', () => {
    const view = setup({ firstRun: false });
    const style = StyleSheet.flatten(photoOf(view, 1).props.style);
    // The image is taller than its window, so it overflows downward; top is 0 or negative and never positive (no blank edge).
    expect(style.top).toBeLessThanOrEqual(0);
    expect(style.left).toBeCloseTo(0, 5);
  });
  it('the call to action plays the tap cue and opens the composer, and Back still leaves', async () => {
    const view = setup({ firstRun: false });
    fireEvent.press(view.getByTestId('vision-entrance-cta')); expect(view.onWords).toHaveBeenCalledTimes(1); expect(calls('uiTap')).toHaveLength(1);
    fireEvent.press(view.getByLabelText(copy.back)); expect(view.onBack).toHaveBeenCalledTimes(1);
  });
  it('ignores a tap on the call to action until it has faded in', async () => {
    const view = setup(); fireEvent.press(view.getByLabelText(copy.createVision)); expect(view.onWords).not.toHaveBeenCalled();
    await advance(ENTRANCE.ctaAt); fireEvent.press(view.getByLabelText(copy.createVision)); expect(view.onWords).toHaveBeenCalledTimes(1);
  });
  it('keeps the fan clear of the one call to action on a short screen', () => {
    const footerTop = 667 - 34 - ENTRANCE.footerGap - ENTRANCE.footerHeight;
    const short = entranceLayout({ width: 375, anchorBottom: 68, footerTop, positions: ['left', 'center', 'right'] });
    expect(short.W).toBeGreaterThanOrEqual(84);
    expect(short.hintTop + 16 + 16).toBeLessThanOrEqual(footerTop);
  });
  it('disables the call to action at the image limit and says why', () => {
    const view = setup({ firstRun: false, canAddImage: false });
    expect(view.getByTestId('vision-entrance-cta').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(view.getByLabelText(copy.createVision));
    expect(view.onWords).not.toHaveBeenCalled();
    expect(view.getByText('This Vision is full. Remove an image to add another.')).toBeTruthy();
  });
  it('shows a photo notice under the prints', () => {
    const view = setup({ firstRun: false, notice: 'Unable to open photo library.' });
    expect(view.getByText('Unable to open photo library.')).toBeTruthy();
  });

  describe('add mode', () => {
    const add = (extra: Partial<VisionEntranceProps> = {}) => setup({ mode: 'add', firstRun: false, previewImageUrl: 'file:///latest.jpg', previewCaption: 'I am vibrant.', ...extra });
    it('shows the latest print with its pin, an opaque What else? frame, and one decorative example', () => {
      const view = add();
      expect(view.getByText(copy.askAdd)).toBeTruthy(); expect(shown(view, 'I am vibrant.')).toBeTruthy();
      expect(byId(view, 'vision-entrance-pin')).toBeTruthy(); expect(shown(view, copy.whatElse)).toBeTruthy();
      expect(shown(view, 'This is my life.')).toBeTruthy(); expect(view.queryByText('I built this.', { includeHiddenElements: true })).toBeNull();
    });
    it('nothing on the prints is tappable; the one call to action adds', () => {
      const view = add();
      expect(view.queryByLabelText(copy.whatElse, { includeHiddenElements: true })).toBeNull(); expect(view.queryAllByLabelText(/Start from this example/)).toHaveLength(0);
      fireEvent.press(view.getByLabelText(copy.addScene)); expect(view.onWords).toHaveBeenCalledTimes(1);
    });
    it('with no latest print it uses the create layout under the add headline', () => {
      const view = add({ previewImageUrl: null });
      expect(view.getByText(copy.askAdd)).toBeTruthy(); expect(shown(view, 'I actually did it.')).toBeTruthy(); expect(view.queryByText('I am vibrant.', { includeHiddenElements: true })).toBeNull();
    });
  });

  describe('lower-performance devices', () => {
    it('keeps the open and the prints but skips the idle drift', async () => {
      mockTier = 'low'; const view = setup(); await advance(OPEN_DONE * 2);
      expect(shown(view, 'I actually did it.')).toBeTruthy(); expect(view.onAnchorHandoff).toHaveBeenCalledTimes(1);
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
  it('keeps the hint clear of the first button by 16pt on a 667pt screen', () => {
    const frame = layout(375, 667, 20, 0);
    expect(frame.W).toBeLessThanOrEqual(170); expect(frame.hintTop + 16 + 16).toBeLessThanOrEqual(frame.footerTop);
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
