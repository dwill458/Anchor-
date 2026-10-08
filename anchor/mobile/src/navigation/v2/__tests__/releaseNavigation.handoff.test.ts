const mockHandOff = jest.fn(async (..._args: unknown[]) => 'started');
const mockHandOffEvolved = jest.fn(async (..._args: unknown[]) => 'started');
jest.mock('../releaseHandoff', () => ({
  handOffReleaseToHome: (...args: unknown[]) => mockHandOff(...args),
  handOffEvolvedToHome: (...args: unknown[]) => mockHandOffEvolved(...args),
}));

import { createReleaseContinuations } from '../releaseNavigation';

const makeNavigation = () => ({
  replace: jest.fn(), goBack: jest.fn(), push: jest.fn(), navigate: jest.fn(),
  setOptions: jest.fn(), popToTop: jest.fn(), canGoBack: jest.fn(() => true),
});

describe('createReleaseContinuations: Return Home', () => {
  beforeEach(() => { mockHandOff.mockClear(); mockHandOffEvolved.mockClear(); });

  it('hands off to the Home beneath, reading Reduce Motion when it is tapped', () => {
    const navigation = makeNavigation();
    let reduceMotion = false;
    const continuations = createReleaseContinuations(navigation, 'android', { getReduceMotion: () => reduceMotion });

    continuations.onReleaseCompleted('a1', {} as never);
    reduceMotion = true;
    continuations.onReleaseCompleted('a2', {} as never);

    expect(mockHandOff).toHaveBeenCalledTimes(2);
    expect(mockHandOff.mock.calls[0][0]).toBe(navigation);
    expect(mockHandOff.mock.calls[0][1]).toMatchObject({ anchorId: 'a1' });
    expect(mockHandOff.mock.calls[0][2]).toEqual({ reduceMotion: false });
    expect(mockHandOff.mock.calls[1][2]).toEqual({ reduceMotion: true });
    // Nothing is replaced unless the hand-off cannot stage.
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('keeps the existing Return Home as its fallback: the iOS fade replacement, and the plain one elsewhere', () => {
    const ios = makeNavigation();
    createReleaseContinuations(ios, 'ios').onReleaseCompleted('a1', {} as never);
    (mockHandOff.mock.calls[0][1] as { fallback: () => void }).fallback();
    expect(ios.replace).toHaveBeenCalledWith('V2DevelopmentHome', { releaseReturnFade: true });

    const android = makeNavigation();
    createReleaseContinuations(android, 'android').onReleaseCompleted('a1', {} as never);
    (mockHandOff.mock.calls[1][1] as { fallback: () => void }).fallback();
    expect(android.replace).toHaveBeenCalledWith('V2DevelopmentHome');
  });

  it('leaves every other continuation alone: they replace Release and never hand off', () => {
    const navigation = makeNavigation();
    const continuations = createReleaseContinuations(navigation, 'android');
    continuations.onViewHistory?.();
    continuations.onViewProgress?.('a1');
    continuations.onContinueToChart?.('course-1', 'a1');
    continuations.onViewCompletedChart?.('course-1', 'a1');
    continuations.onCreateSuccessor?.();
    expect(navigation.replace.mock.calls).toEqual([
      ['V2AnchorLibrary'],
      ['V2Progress', { anchorId: 'a1' }],
      ['V2Chart', { courseId: 'course-1', source: 'release' }],
      ['V2Chart', { courseId: 'course-1', source: 'release_completed' }],
      ['V2Creation'],
    ]);
    expect(mockHandOff).not.toHaveBeenCalled();
    expect(mockHandOffEvolved).not.toHaveBeenCalled();
  });
});

describe('createReleaseContinuations: Continue with new Anchor', () => {
  beforeEach(() => { mockHandOff.mockClear(); mockHandOffEvolved.mockClear(); });

  it('hands off to Home with the released artwork, reading Reduce Motion when it is tapped', () => {
    const navigation = makeNavigation();
    let reduceMotion = false;
    const continuations = createReleaseContinuations(navigation, 'android', { getReduceMotion: () => reduceMotion });
    const released = { svg: '<svg />', category: 'creativity' };

    continuations.onContinueWithSuccessor?.('a2', released);
    reduceMotion = true;
    continuations.onContinueWithSuccessor?.('a3');

    expect(mockHandOffEvolved).toHaveBeenCalledTimes(2);
    expect(mockHandOffEvolved.mock.calls[0][0]).toBe(navigation);
    expect(mockHandOffEvolved.mock.calls[0][1]).toMatchObject({ successorAnchorId: 'a2', released });
    expect(mockHandOffEvolved.mock.calls[0][2]).toEqual({ reduceMotion: false });
    expect(mockHandOffEvolved.mock.calls[1][2]).toEqual({ reduceMotion: true });
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(mockHandOff).not.toHaveBeenCalled();
  });

  it('keeps the successor\'s Details as its fallback', () => {
    const navigation = makeNavigation();
    createReleaseContinuations(navigation, 'ios').onContinueWithSuccessor?.('a2');
    (mockHandOffEvolved.mock.calls[0][1] as { fallback: () => void }).fallback();
    expect(navigation.replace).toHaveBeenCalledWith('V2AnchorDetails', { anchorId: 'a2' });
  });
});
