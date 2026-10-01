import { act, renderHook } from '@testing-library/react-native';
import { useChartJourneyCamera } from '../useChartJourneyCamera';
import { chartSequence, chartTiming } from '../chartMotion';
import { rememberJourney, journeySessionKey } from '../chartJourneySession';

let mockAccount = 'camera-test-account';
jest.mock('@/stores/authStore', () => ({ useAuthStore: (select:any) => select({ user:{id:mockAccount} }) }));
jest.mock('react-native-reanimated', () => ({
  useSharedValue:(initial:number) => require('react').useRef({value:initial}).current,
  useAnimatedReaction:jest.fn(), cancelAnimation:jest.fn(), runOnJS:(fn:any)=>fn,
}));
jest.mock('../chartMotion', () => ({
  CHART_EASING:{deliberate:undefined,settle:undefined},
  chartTiming:jest.fn((target:number)=>target),
  chartSequence:jest.fn((...values:number[])=>values[values.length-1]),
  chartDelay:jest.fn((_delay:number,value:number)=>value),
}));
beforeEach(()=>{jest.clearAllMocks(); mockAccount=`account-${Math.random()}`;});

it('holds remembered progress until textures are ready, then follows updated server truth',()=>{
  const key=journeySessionKey(mockAccount,'course');
  rememberJourney(key,.25,Date.now()-11000);
  const hook=renderHook(()=>useChartJourneyCamera('course',.6,false));
  expect(hook.result.current.progress.value).toBe(.25);
  expect(chartTiming).not.toHaveBeenCalled();
  act(()=>hook.result.current.onReady(true));
  expect(hook.result.current.progress.value).toBe(.6);
});
it('crosses .96 only in a confirmed arrival and cancels obsolete transitions',()=>{
  const hook=renderHook(({target})=>useChartJourneyCamera('course',target,false),{initialProps:{target:.9}});
  act(()=>hook.result.current.onReady(true));
  hook.rerender({target:1});
  expect(chartSequence).toHaveBeenCalledWith(.96,1);
  hook.rerender({target:.7});
  expect(hook.result.current.progress.value).toBe(.7);
});
it('resolves reduced motion immediately and clears another account\'s remembered camera',()=>{
  const hook=renderHook(({target})=>useChartJourneyCamera('course',target,true),{initialProps:{target:.6}});
  act(()=>hook.result.current.onReady(true));
  hook.rerender({target:.8});
  expect(hook.result.current.progress.value).toBe(.8);
  expect(chartTiming).not.toHaveBeenCalled();
  mockAccount='another-account';
  hook.rerender({target:.08});
  expect(hook.result.current.progress.value).toBe(.08);
});
