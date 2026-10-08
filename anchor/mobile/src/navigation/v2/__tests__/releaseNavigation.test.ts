import { createReleaseContinuations, releaseHomeScreenOptions } from '../releaseNavigation';
import { Platform } from 'react-native';

function setup(platform: typeof Platform.OS = 'android') {
  const navigation = { replace: jest.fn(), goBack: jest.fn(), push: jest.fn() };
  return { navigation, continuations: createReleaseContinuations(navigation, platform) };
}

describe('createReleaseContinuations', () => {
  it('marks only iOS Return Home for the custom fade', () => {
    const { navigation, continuations } = setup('ios');
    continuations.onReleaseCompleted('a1', {} as never);
    expect(navigation.replace).toHaveBeenCalledWith('V2DevelopmentHome', { releaseReturnFade: true });
    continuations.onViewProgress?.('a1');
    expect(navigation.replace).toHaveBeenLastCalledWith('V2Progress', { anchorId: 'a1' });
  });

  it('uses 260ms only for the marked iOS arrival and 120ms with Reduced Motion', () => {
    expect(releaseHomeScreenOptions({ releaseReturnFade: true }, false, 'ios')).toEqual({
      animation: 'fade', animationDuration: 260, animationTypeForReplace: 'push',
    });
    expect(releaseHomeScreenOptions({ releaseReturnFade: true }, true, 'ios').animationDuration).toBe(120);
    expect(releaseHomeScreenOptions(undefined, false, 'ios')).toEqual({});
    expect(releaseHomeScreenOptions({ releaseReturnFade: undefined }, false, 'ios')).toEqual({});
    expect(releaseHomeScreenOptions({ releaseReturnFade: true }, false, 'android')).toEqual({});
  });

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

  it('the Evolve paywall opens the Paywall route with the creation gates\' params, on top of Release', () => {
    const navigate = jest.fn();
    const navigation = { replace: jest.fn(), goBack: jest.fn(), push: jest.fn(), navigate };
    const continuations = createReleaseContinuations(navigation, 'android');
    continuations.onEvolvePaywall?.({ source: 'create_anchor_free_locked', preferredPlanId: 'annual' });
    expect(navigate).toHaveBeenCalledWith('Paywall', { source: 'create_anchor_free_locked', preferredPlanId: 'annual' });
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('Evolve it pushes creation on top of Release with the intention carried over', () => {
    const { navigation, continuations } = setup();
    continuations.onBeginEvolve?.({ anchorId: 'a1', intentionText: 'Publish my novel' });
    expect(navigation.push).toHaveBeenCalledWith('FirstAnchorCreation', {
      initialIntention: 'Publish my novel',
      evolve: { fromAnchorId: 'a1' },
    });
    // Release is never replaced, popped or navigated away from.
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
