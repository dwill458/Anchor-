import { chartTypography as typography } from './chartTypography';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { colors, spacing } from '@/theme/v2';
import type { ChartAnchorArt, ChartMarker } from './ChartLandscape';
import { ChartJourneyWorld } from './ChartJourneyWorld';
import { ROUTE_START } from './chartJourneyGeometry';
import { CHART_EASING, CHART_MAPPING_TIMING as T, chartTiming } from './chartMotion';
export const CHART_REVEAL_TIMING = T;
export type ChartMappingStage = 'reading' | 'finding' | 'building' | 'ready';
const STAGES: ChartMappingStage[] = ['reading','finding','building','ready'];
type Props = {
  width:number; height:number; category?:string|null; anchorArt?:ChartAnchorArt|null;
  destinationImageUrl?:string|null; destinationLabel?:string|null;
  markers:ChartMarker[]|null; reducedMotion:boolean; onRevealed?:()=>void;
  settled?:boolean; hereCaption?:string; footerSpace?:number; testID?:string;
};
/** Mapping reveals only real server-returned nodes; no additional route is drawn on the highway. */
export function ChartGenerationStage({ width,height,category,markers,reducedMotion,onRevealed,settled=false,footerSpace=96,testID }:Props) {
  const [stage,setStage]=useState<ChartMappingStage>('reading');
  const [ready,setReady]=useState(false);
  const [longWaitIndex,setLongWaitIndex]=useState(-1);
  const terrain=useSharedValue(reducedMotion ? 1 : 0);
  const nodeReveal=useSharedValue(0);
  const callback=useRef(onRevealed); callback.current=onRevealed;
  const committed=useRef(false);
  const revealed=useRef(false);
  const hasMarkers=markers !== null;
  const style=useAnimatedStyle(()=>({ opacity:.65+.35*terrain.value }));
  useEffect(()=>{
    if (!ready) return;
    terrain.value=reducedMotion ? 1 : chartTiming(1,{duration:900,easing:CHART_EASING.settle});
    const finding=setTimeout(()=>setStage(current=>current==='reading' ? 'finding' : current),900);
    const waiting=T.longWait.map((ms,index)=>setTimeout(()=>{ if (!committed.current) setLongWaitIndex(index); },ms));
    return ()=>{ clearTimeout(finding); waiting.forEach(clearTimeout); cancelAnimation(terrain); };
  },[ready,reducedMotion,terrain]);
  useEffect(()=>{
    if (!ready || !hasMarkers || committed.current || revealed.current) return;
    committed.current=true;
    setLongWaitIndex(-1); setStage('building');
    nodeReveal.value=reducedMotion ? 1 : chartTiming(1,{duration:1600,easing:CHART_EASING.settle});
    const finish=setTimeout(()=>{ revealed.current=true; setStage('ready'); callback.current?.(); },reducedMotion ? 420 : 1900);
    return ()=>{ committed.current=false; clearTimeout(finish); cancelAnimation(nodeReveal); };
  },[ready,hasMarkers,reducedMotion,nodeReveal]);
  const phrase=longWaitIndex>=0 && (stage==='reading'||stage==='finding') ? CHART_COPY.generation.longWait[longWaitIndex] : CHART_COPY.generation.stages[stage];
  return <View testID={testID} style={[styles.stage,{width,height}]}>
    <Animated.View style={style}><ChartJourneyWorld width={width} height={Math.max(1,height-footerSpace)} category={category}
      markers={markers ?? []} staticProgress={ROUTE_START} nodeReveal={nodeReveal} onReady={setReady} accessibilityLabel={markers ? `Road mapped with ${markers.length} waypoints` : 'Mapping your journey'} /></Animated.View>
    {!settled ? <View style={[styles.status,{height:footerSpace}]} accessibilityLiveRegion="polite" accessible accessibilityLabel={phrase} testID="chart-generation-status">
      <View style={styles.ticks}>{STAGES.map((key,index)=><View key={key} style={[styles.tick,index<=STAGES.indexOf(stage)&&styles.tickOn]} />)}</View>
      <Text style={styles.phrase}>{phrase}</Text>
    </View> : null}
  </View>;
}
const styles=StyleSheet.create({
  stage:{overflow:'hidden',backgroundColor:colors.ink.base},
  status:{position:'absolute',left:0,right:0,bottom:0,paddingHorizontal:spacing[5],justifyContent:'center',gap:spacing[2]},
  ticks:{flexDirection:'row',gap:6},tick:{width:18,height:2,borderRadius:1,backgroundColor:colors.ink.hairlineStrong},
  tickOn:{backgroundColor:'#F2E6CB'},phrase:{...typography.bodyMD,fontFamily:'Figtree-Regular',color:colors.ink.text.primary},
});
