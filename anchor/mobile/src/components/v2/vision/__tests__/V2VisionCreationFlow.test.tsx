import { act, fireEvent, render } from '@testing-library/react-native';
import { V2VisionCreationFlow } from '../V2VisionCreationFlow';
import { ENTRANCE } from '../ceremony/VisionEntrance';

const mockStart = jest.fn(async () => true);
const mockPick = jest.fn();
jest.mock('@/hooks/v2/vision', () => ({
  useV2VisionSceneGeneration: () => ({ job: null, error: null, start: mockStart, retry: jest.fn() }),
  pickVisionPhoto: (...args: unknown[]) => mockPick(...args),
  uploadVisionPhoto: jest.fn(),
  useVisionAppearanceReference: () => ({ profilePhoto: null, reference: null, loading: false, saving: false }),
}));
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn(() => ({ stop: jest.fn() })) }));
const base = { anchorId: 'anchor', anchorIntention: 'I build what matters.', initialDescription: 'A studio full of finished work.',
  onBack: jest.fn(), onUploadAsset: jest.fn(), onAssemble: jest.fn(async () => true) };
// The Ask controls go live once the entrance's open has finished.
const ASK_READY = ENTRANCE.liftAt + ENTRANCE.liftMs + ENTRANCE.handoffOverlapMs + 50;
function enterDescription(view: ReturnType<typeof render>) { act(() => { jest.advanceTimersByTime(ASK_READY); }); fireEvent.press(view.getByLabelText('Imagine it from words')); }
async function submit(view: ReturnType<typeof render>) { await act(async () => { fireEvent.press(view.getByTestId('vision-generate')); }); }

describe('V2VisionCreationFlow ceremony entry and existing actions', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockStart.mockResolvedValue(true); });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
  it.each(['empty', 'ready', 'prompt'] as const)('starts legacy initialStep %s at Ask with no stock art', initialStep => {
    const view = render(<V2VisionCreationFlow {...base} initialStep={initialStep} />);
    expect(view.getByText("When it's true, what do you see?")).toBeTruthy();
    expect(view.getByLabelText('Use my own photo')).toBeTruthy();
    expect(view.getByLabelText('Take a photo')).toBeTruthy();
    expect(view.queryByTestId('vision-intro-art')).toBeNull();
    expect(mockStart).not.toHaveBeenCalled(); expect(base.onAssemble).not.toHaveBeenCalled();
  });
  it('Imagine enters the existing words path and preserves description across Back', () => {
    const view = render(<V2VisionCreationFlow {...base} />); enterDescription(view);
    expect(view.getByTestId('vision-path-words').props.accessibilityState.selected).toBe(true);
    fireEvent.changeText(view.getByTestId('vision-prompt-input'), 'My meaningful new scene.');
    fireEvent.press(view.getByLabelText('Go back')); enterDescription(view);
    expect(view.getByTestId('vision-prompt-input').props.value).toBe('My meaningful new scene.');
  });
  it('saves the draft before requesting generation and saves no scene before Seal', async () => {
    const saveDraft = jest.fn(async () => true);
    const view = render(<V2VisionCreationFlow {...base} onSaveDescription={saveDraft} />); enterDescription(view); await submit(view);
    expect(saveDraft).toHaveBeenCalledWith(base.initialDescription);
    expect(mockStart).toHaveBeenCalledWith(base.initialDescription, null);
    expect(base.onAssemble).not.toHaveBeenCalled(); expect(base.onUploadAsset).not.toHaveBeenCalled();
  });
  it('a failed draft save leaves Describe available and does not start generation', async () => {
    const view = render(<V2VisionCreationFlow {...base} onSaveDescription={async () => false} />); enterDescription(view); await submit(view);
    expect(view.getByText('Your description could not be saved. Please try again.')).toBeTruthy();
    expect(mockStart).not.toHaveBeenCalled();
  });
  it('a failed generation stays on Describe with the entered text', async () => {
    mockStart.mockResolvedValue(false);
    const view = render(<V2VisionCreationFlow {...base} />); enterDescription(view); await submit(view);
    expect(view.getByTestId('vision-prompt-input').props.value).toBe(base.initialDescription);
    expect(base.onAssemble).not.toHaveBeenCalled();
  });
  it('consumes paywall resume once and starts with the saved description', async () => {
    const consumed = jest.fn();
    const view = render(<V2VisionCreationFlow {...base} resumeGeneration onResumeGenerationConsumed={consumed} />);
    await act(async () => undefined);
    expect(mockStart).toHaveBeenCalledTimes(1); expect(consumed).toHaveBeenCalledTimes(1);
    expect(view.getByText('Reading your moment')).toBeTruthy();
  });
});
