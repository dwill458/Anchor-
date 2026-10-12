import { CommonActions, StackActions } from '@react-navigation/native';
import { StackRouter } from '@react-navigation/routers';
import { returnToReleaseWithSuccessor } from '../evolveReturn';
import { useEvolveSessionStore } from '@/stores/v2/evolveSessionStore';

beforeEach(() => useEvolveSessionStore.getState().clear());

describe('returnToReleaseWithSuccessor', () => {
  it('attaches the sealed Anchor and returns to the existing Release route with reason and successor', () => {
    const navigate = jest.fn();
    useEvolveSessionStore.getState().begin({ fromAnchorId: 'old-1', fromIntention: 'Publish my novel' });
    returnToReleaseWithSuccessor({ navigate }, 'old-1', { anchorId: 'new-1', intentionText: 'Finish my novel' });

    expect(useEvolveSessionStore.getState().successor).toEqual({ anchorId: 'new-1', intentionText: 'Finish my novel', fromAnchorId: 'old-1' });
    expect(useEvolveSessionStore.getState().pending).toBeNull();
    // navigate (not push): back to the Release already in the stack; merge keeps its other params.
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({
      name: 'V2Release',
      params: { anchorId: 'old-1', reason: 'evolve', successor: { anchorId: 'new-1', intentionText: 'Finish my novel' } },
      merge: true,
    });
  });

  it('with the real stack router: pops creation off, keeps one Release, and replaces reason and successor', () => {
    const routeNames = ['V2DevelopmentHome', 'V2Release', 'FirstAnchorCreation', 'AnchorCreationFlow'];
    const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
    const router = StackRouter({});
    let state: any = router.getInitialState(options);
    const apply = (action: any) => { state = router.getStateForAction(state, action, options) ?? state; };

    apply(CommonActions.navigate('V2Release', { anchorId: 'old-1', anchorTransition: true }));
    apply(StackActions.push('FirstAnchorCreation', { initialIntention: 'Publish my novel', evolve: { fromAnchorId: 'old-1' } }));
    apply(StackActions.push('AnchorCreationFlow', { intentionText: 'Publish my novel', evolve: { fromAnchorId: 'old-1' } }));
    expect(state.routes.map((r: any) => r.name)).toEqual(['V2DevelopmentHome', 'V2Release', 'FirstAnchorCreation', 'AnchorCreationFlow']);
    const releaseKey = state.routes[1].key;

    const navigate = jest.fn((action: any) => apply(CommonActions.navigate(action)));
    returnToReleaseWithSuccessor({ navigate }, 'old-1', { anchorId: 'new-1', intentionText: 'Finish my novel' });

    expect(state.routes.map((r: any) => r.name)).toEqual(['V2DevelopmentHome', 'V2Release']);
    expect(state.index).toBe(1);
    // The same Release route instance, not a second one.
    expect(state.routes[1].key).toBe(releaseKey);
    expect(state.routes[1].params).toEqual({
      anchorId: 'old-1',
      anchorTransition: true,
      reason: 'evolve',
      successor: { anchorId: 'new-1', intentionText: 'Finish my novel' },
    });
  });
});
