import { act, render } from '@testing-library/react-native';
import { VisionAddSceneEntry } from '../VisionAddSceneEntry';

const sheetProps: Array<{ visible: boolean }> = [];
jest.mock('../VisionAddSceneSheet', () => ({ VisionAddSceneSheet: (props: { visible: boolean }) => { sheetProps.push(props); return null; } }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({ user: { id: 'owner' } }) }));
// The draft never finishes loading: storage is busy.
jest.mock('@/hooks/v2/vision/useVisionConversation', () => ({
  useVisionConversation: () => ({ loaded: false, session: null, draft: { current: null }, saveDraft: jest.fn(), flushDraft: jest.fn() }),
}));

const props = { anchorId: 'a', onResume: jest.fn(), visible: true, onClose: jest.fn(), anchorIntention: 'x', onSubmit: jest.fn() };

describe('Add sheet opening', () => {
  beforeEach(() => { jest.useFakeTimers(); sheetProps.length = 0; });
  afterEach(() => { jest.useRealTimers(); });
  it('opens even when the saved draft is slow to load', () => {
    render(<VisionAddSceneEntry {...props} />);
    expect(sheetProps[sheetProps.length - 1].visible).toBe(false);
    act(() => { jest.advanceTimersByTime(800); });
    expect(sheetProps[sheetProps.length - 1].visible).toBe(true);
  });
});
