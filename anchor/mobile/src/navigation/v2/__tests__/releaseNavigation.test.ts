import { createReleaseContinuations } from '../releaseNavigation';

function setup() {
  const navigation = { replace: jest.fn(), goBack: jest.fn() };
  return { navigation, continuations: createReleaseContinuations(navigation) };
}

describe('createReleaseContinuations', () => {
  it('Return Home replaces Release with Home', () => {
    const { navigation, continuations } = setup();
    continuations.onReleaseCompleted('a1', {} as never);
    expect(navigation.replace).toHaveBeenCalledWith('V2DevelopmentHome');
  });

  it('View Progress opens Progress for the released intention', () => {
    const { navigation, continuations } = setup();
    continuations.onViewProgress?.('a1');
    expect(navigation.replace).toHaveBeenCalledWith('V2Progress', { anchorId: 'a1' });
  });

  it('Continue to Chart opens the course so its next waypoint leads', () => {
    const { navigation, continuations } = setup();
    continuations.onContinueToChart?.('course-1', 'a1');
    expect(navigation.replace).toHaveBeenCalledWith('V2Chart', { courseId: 'course-1', source: 'release' });
  });

  it('View completed Chart opens the completed course', () => {
    const { navigation, continuations } = setup();
    continuations.onViewCompletedChart?.('course-1', 'a1');
    expect(navigation.replace).toHaveBeenCalledWith('V2Chart', { courseId: 'course-1', source: 'release_completed' });
  });

  it('falls back to the Anchor when the course id is unknown', () => {
    const { navigation, continuations } = setup();
    continuations.onContinueToChart?.(null, 'a1');
    expect(navigation.replace).toHaveBeenCalledWith('V2Chart', { anchorId: 'a1', source: 'release' });
  });

  it('Continue with new Anchor opens the successor Anchor Details', () => {
    const { navigation, continuations } = setup();
    continuations.onContinueWithSuccessor?.('a2');
    expect(navigation.replace).toHaveBeenCalledWith('V2AnchorDetails', { anchorId: 'a2' });
  });

  it('a missing successor returns to creation', () => {
    const { navigation, continuations } = setup();
    continuations.onCreateSuccessor?.();
    expect(navigation.replace).toHaveBeenCalledWith('V2Creation');
  });

  it('Keep this Anchor active goes back without replacing anything', () => {
    const { navigation, continuations } = setup();
    continuations.onCancel();
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('View in Your Anchors still works', () => {
    const { navigation, continuations } = setup();
    continuations.onViewHistory?.();
    expect(navigation.replace).toHaveBeenCalledWith('V2AnchorLibrary');
  });
});
