import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cancelAnimation, runOnJS, useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { useAuthStore } from '@/stores/authStore';
import { CHART_EASING, chartDelay, chartSequence, chartTiming } from './chartMotion';
import { journeySessionKey, rememberedJourney, rememberJourney } from './chartJourneySession';

/** Drives actual progress only. Inspection belongs to the renderer's separate blend. */
export function useChartJourneyCamera(courseId:string, target:number, reducedMotion:boolean, initialProgress?:number) {
  const accountId = useAuthStore(state => state.user?.id ?? null);
  const key = useMemo(() => journeySessionKey(accountId,courseId), [accountId,courseId]);
  const initial = useMemo(() => initialProgress === undefined ? rememberedJourney(key,target) : { from:initialProgress,animate:true }, [key]);
  const progress = useSharedValue(reducedMotion ? target : initial.from);
  const [ready,setReady] = useState(false);
  const entered = useRef(false);
  const remember = useCallback((value:number) => rememberJourney(key,value), [key]);
  useAnimatedReaction(() => progress.value, (value,previous) => {
    if (previous !== value && Math.abs(value-target)<.0001) runOnJS(remember)(value);
  }, [target,remember]);
  useEffect(() => {
    entered.current=false;
    progress.value=reducedMotion ? target : initial.from;
    return () => { rememberJourney(key,progress.value); cancelAnimation(progress); };
  }, [key]);
  useEffect(() => {
    if (!ready) { cancelAnimation(progress); return; }
    if (reducedMotion) { progress.value=target; remember(target); entered.current=true; return; }
    const first = !entered.current;
    entered.current=true;
    const animation = target === 1 && progress.value < .96
      ? chartSequence(chartTiming(.96,{ duration:650,easing:CHART_EASING.deliberate }),chartTiming(1,{ duration:750,easing:CHART_EASING.settle }))
      : chartTiming(target,{ duration:target === 1 ? 1000 : first ? 800 : 650,easing:CHART_EASING.deliberate });
    progress.value=first && initial.animate ? chartDelay(180,animation) : animation;
    return () => cancelAnimation(progress);
  }, [ready,target,reducedMotion,progress,remember,initial.animate]);
  return { progress,onReady:setReady,ready };
}
