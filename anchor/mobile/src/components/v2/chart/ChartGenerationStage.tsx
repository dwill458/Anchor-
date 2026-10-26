import { chartTypography as typography } from './chartTypography';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import Animated, { cancelAnimation, Easing, FadeIn, FadeOut, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { getCategoryColor, spacing } from '@/theme/v2';
import type { ChartAnchorArt, ChartMarker } from './ChartLandscape';
// DEFERRED: import { ChartJourneyWorld } from './ChartJourneyWorld';
// DEFERRED: import { ROUTE_START } from './chartJourneyGeometry';
import { ChartMap } from './map/ChartMap';
import { MAP_H, MAP_W, type ChartMapMarker } from './map/chartMapContracts';
import { buildRouteTable, waypointPlacement } from './map/chartMapGeometry';
import { CHART_MAP_TOKENS as TOKENS } from './map/chartMapTokens';
import { useChartMapAnimState } from './map/useChartMapAnimState';
import { setChartWeatherHandoff } from './map/chartWeatherHandoff';
import { CHART_EASING, CHART_MAPPING_TIMING as T, chartTiming } from './chartMotion';
export const CHART_REVEAL_TIMING = T;
export type ChartMappingStage = 'reading' | 'finding' | 'building' | 'ready';
const STAGES: ChartMappingStage[] = ['reading','finding','building','ready'];
/** The checklist shows the three working stages; `ready` completes the third. */
const CHECKLIST: Array<Exclude<ChartMappingStage, 'ready'>> = ['reading','finding','building'];
type Props = {
  width:number; height:number; category?:string|null; anchorArt?:ChartAnchorArt|null;
  destinationImageUrl?:string|null; destinationLabel?:string|null;
  markers:ChartMarker[]|null; reducedMotion:boolean; onRevealed?:()=>void;
  settled?:boolean; hereCaption?:string; footerSpace?:number; testID?:string;
};
// Fog of war: the first waypoint is the current one until the Chart exists; the rest stay hidden by the marker layer.
const toMapMarkers=(markers:ChartMarker[]):ChartMapMarker[]=>markers.map((marker,index)=>({
  id:marker.id, index, number:marker.number, title:'',
  state:marker.state==='completed' ? 'done' : (index===0 && !markers.some(item=>item.state==='current')) ? 'current' : marker.state,
  selected:false, accessibilityLabel:marker.accessibilityLabel,
}));
/** Mapping reveals only real server-returned nodes; no additional route is drawn on the map. */
export function ChartGenerationStage({ width,height,category,destinationImageUrl,markers,reducedMotion,onRevealed,settled=false,footerSpace=96,testID }:Props) {
  const [stage,setStage]=useState<ChartMappingStage>('reading');
  const [longWaitIndex,setLongWaitIndex]=useState(-1);
  const [flagAppearing,setFlagAppearing]=useState(false);
  const statusOpacity=useSharedValue(1);
  const breath=useSharedValue(1);
  const printCover=useSharedValue(destinationImageUrl ? 1 : 0);
  const developedUrls=useRef(new Set<string>());
  const completedStage=useRef(0);
  const anim=useChartMapAnimState({ revealArc:0, flagIndex:0 });
  const table=useMemo(()=>buildRouteTable(),[]);
  const placement=useMemo(()=>waypointPlacement(Math.max(1,markers?.length ?? 1)),[markers?.length]);
  const callback=useRef(onRevealed); callback.current=onRevealed;
  const committed=useRef(false);
  const revealed=useRef(false);
  const hasMarkers=markers !== null;
  const accent=getCategoryColor(category);
  // Cover-fit: wide enough that the map fills the whole stage (cropped at the sides, never a blank band).
  // DEFERRED: cover-fit enlarged the art and clipped the summit at the sides.
  const mapWidth=width;
  const mapHeight=(mapWidth*MAP_H)/MAP_W;
  const mapMarkers=useMemo(()=>hasMarkers ? toMapMarkers(markers) : [],[hasMarkers,markers]);
  // The first waypoint is the drawn end of the revealed route; the flag stands on it.
  const firstArc=placement.arcs[0] ?? 0;
  useEffect(()=>{
    const next=STAGES.indexOf(stage);
    if (!reducedMotion) {
      for (let index=completedStage.current;index<next;index+=1) {
        safeHaptics.impact(index===2 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
      }
    }
    completedStage.current=next;
  },[stage,reducedMotion]);
  useEffect(()=>{
    cancelAnimation(printCover);
    if (!destinationImageUrl || developedUrls.current.has(destinationImageUrl)) { printCover.value=0; return; }
    developedUrls.current.add(destinationImageUrl);
    printCover.value=reducedMotion ? 0 : 1;
    if (!reducedMotion) printCover.value=withDelay(300,chartTiming(0,{duration:1400,easing:CHART_EASING.settle}));
    return ()=>cancelAnimation(printCover);
  },[destinationImageUrl,reducedMotion,printCover]);
  useEffect(()=>{
    breath.value=1;
    if (longWaitIndex>=0 && !reducedMotion) breath.value=withRepeat(chartTiming(.6,{duration:1200}),-1,true);
    return ()=>cancelAnimation(breath);
  },[longWaitIndex,reducedMotion,breath]);
  const statusStyle=useAnimatedStyle(()=>({opacity:statusOpacity.value*breath.value}));
  const printStyle=useAnimatedStyle(()=>({opacity:printCover.value}));
  // Faint pencil map while the request runs: nothing is drawn, no node exists yet.
  useEffect(()=>{
    anim.mapOpacity.value=1; anim.fog.value=0; anim.flagIndex.value=0;
    anim.revealArc.value=0; anim.coverArc.value=0; anim.closed.value=0; anim.flagOpacity.value=0;
    const finding=setTimeout(()=>setStage(current=>current==='reading' ? 'finding' : current),900);
    const waiting=T.longWait.map((ms,index)=>setTimeout(()=>{ if (!committed.current) setLongWaitIndex(index); },ms));
    return ()=>{ clearTimeout(finding); waiting.forEach(clearTimeout); };
  },[anim]);
  useEffect(()=>{
    if (!hasMarkers || committed.current || revealed.current) return;
    committed.current=true;
    setLongWaitIndex(-1); setStage('building');
    // The planned route is surveyed, not travelled: the clouds part along leg 1 and the dotted route follows
    // them out to waypoint 1, while the ink stays where the permanent Chart computes it (a new Chart: 0, the
    // start dot inked). "Explore your Chart" hands the parted cover to the permanent Chart; the ink needs no
    // hand-off, so the drawn route never retreats.
    // DEFERRED: setChartWeatherHandoff({ coverArc:firstArc, inkArc:firstArc }); and revealArc tweened to firstArc.
    setChartWeatherHandoff({ coverArc:firstArc });
    if (reducedMotion) { anim.coverArc.value=firstArc; anim.flagOpacity.value=1; }
    else {
      anim.coverArc.value=chartTiming(firstArc,{duration:1600,easing:CHART_EASING.settle});
      anim.flagOpacity.value=withDelay(1300,chartTiming(1,{duration:500,easing:CHART_EASING.settle}));
    }
    // Complete the checklist when the existing flag begins appearing; the survey and finish clock stay unchanged.
    const flag=setTimeout(()=>setFlagAppearing(true),reducedMotion ? 0 : 1300);
    const fade=setTimeout(()=>{ statusOpacity.value=reducedMotion ? 0 : chartTiming(0,{duration:300,easing:CHART_EASING.exit}); },reducedMotion ? 420 : 1600);
    const finish=setTimeout(()=>{ revealed.current=true; setStage('ready'); callback.current?.(); },reducedMotion ? 420 : 1900);
    return ()=>{ committed.current=false; clearTimeout(flag); clearTimeout(fade); clearTimeout(finish); cancelAnimation(statusOpacity); cancelAnimation(anim.revealArc); cancelAnimation(anim.coverArc); cancelAnimation(anim.flagOpacity); };
  },[hasMarkers,reducedMotion,anim,firstArc,statusOpacity]);
  const phrase=longWaitIndex>=0 && (stage==='reading'||stage==='finding') ? CHART_COPY.generation.longWait[longWaitIndex] : CHART_COPY.generation.stages[stage];
  const stageIndex=STAGES.indexOf(stage);
  return <View testID={testID} style={[styles.stage,{width,height}]}>
    {/* The map sits on its start: bottom-aligned, so the route's foot stays in view. */}
    <View style={{position:'absolute',left:(width-mapWidth)/2,top:0,width:mapWidth,height:mapHeight}}>
      <ChartMap width={mapWidth} table={table} placement={placement} anim={anim} markers={mapMarkers} categoryColor={accent} category={category ?? undefined}
        // DEFERRED: static clouds (CLOUD_SKSL in the land canvas) here switched style when the permanent Chart mounted.
        interactive={false} reducedMotion={reducedMotion} arrived={false} clouds={hasMarkers} weather="living" onMarkerPress={noop} onMapPress={noop}
        testID={`${testID ?? 'chart-stage'}-map`} />
    </View>
    {/* DEFERRED: <ChartJourneyWorld width={width} height={Math.max(1,height-footerSpace)} category={category} markers={markers ?? []} staticProgress={ROUTE_START} nodeReveal={nodeReveal} onReady={setReady} accessibilityLabel={markers ? `Road mapped with ${markers.length} waypoints` : 'Mapping your journey'} /> */}
    {destinationImageUrl ? <View style={[styles.polaroid,{bottom:footerSpace+spacing[3]}]} pointerEvents="none" testID="chart-stage-vision">
      <View style={styles.polaroidImage}>
        <Image source={{uri:destinationImageUrl}} style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
        <Animated.View testID="chart-stage-vision-cover" style={[StyleSheet.absoluteFill,{backgroundColor:'#14162B'},printStyle]} />
      </View>
      <Text style={styles.polaroidLabel}>VISION</Text>
    </View> : null}
    {!settled ? <Animated.View style={[styles.status,{height:footerSpace},statusStyle]} accessibilityLiveRegion="polite" accessible accessibilityLabel={phrase} testID="chart-generation-status">
      {CHECKLIST.map((key,index)=>{
        const done=stage==='ready' || index<stageIndex || (key==='building' && flagAppearing);
        const current=!done && index===stageIndex;
        const text=current && longWaitIndex>=0 && key!=='building' ? CHART_COPY.generation.longWait[longWaitIndex] : CHART_COPY.generation.stages[key];
        return <ChecklistLine key={key} name={key} done={done} current={current} accent={accent} text={text} reducedMotion={reducedMotion} />;
      })}
    </Animated.View> : null}
  </View>;
}
function ChecklistLine({name,done,current,accent,text,reducedMotion}:{name:string;done:boolean;current:boolean;accent:string;text:string;reducedMotion:boolean}) {
  const dot=useSharedValue(1);
  const check=useSharedValue(.6);
  const popped=useRef(false);
  useEffect(()=>{
    dot.value=1;
    if (current && !reducedMotion) dot.value=withRepeat(chartTiming(.35,{duration:450}),-1,true);
    return ()=>cancelAnimation(dot);
  },[current,reducedMotion,dot]);
  useEffect(()=>{
    if (!done || popped.current) return;
    popped.current=true;
    check.value=reducedMotion ? 1 : withSequence(chartTiming(1.08,{duration:130,easing:Easing.out(Easing.cubic)}),chartTiming(1,{duration:50}));
  },[done,reducedMotion,check]);
  const dotStyle=useAnimatedStyle(()=>({opacity:dot.value}));
  const checkStyle=useAnimatedStyle(()=>({transform:[{scale:check.value}]}));
  return <View style={styles.line} testID={`chart-checklist-${name}`} accessibilityLabel={`${text}, ${done ? 'done' : current ? 'current' : 'pending'}`}>
    {/* DEFERRED: the current line's empty ring is replaced by its breathing category dot. */}
    <View style={[styles.mark,done&&{backgroundColor:accent,borderColor:accent},current&&{borderWidth:0}]}>
      {done ? <Animated.View style={checkStyle} testID={`chart-check-${name}`}><Check size={12} color="#FFFFFF" strokeWidth={3} /></Animated.View> : current ? <Animated.View style={[{width:6,height:6,borderRadius:3,backgroundColor:accent},dotStyle]} /> : null}
    </View>
    <View style={{flex:1}}><Animated.Text key={text} entering={reducedMotion ? undefined : FadeIn.duration(160).reduceMotion(ReduceMotion.Never)} exiting={reducedMotion ? undefined : FadeOut.duration(160).reduceMotion(ReduceMotion.Never)} style={[styles.lineText,!done&&!current&&styles.linePending]} numberOfLines={1}>{text}</Animated.Text></View>
  </View>;
}
function noop() { return undefined; }
const styles=StyleSheet.create({
  stage:{overflow:'hidden',backgroundColor:TOKENS.paper},
  status:{position:'absolute',left:0,right:0,bottom:0,paddingHorizontal:spacing[5],justifyContent:'center',gap:spacing[2],backgroundColor:'rgba(244,241,233,.88)'},
  line:{flexDirection:'row',alignItems:'center',gap:spacing[3]},
  mark:{width:20,height:20,borderRadius:10,borderWidth:1.5,borderColor:TOKENS.muted,alignItems:'center',justifyContent:'center'},
  lineText:{...typography.bodyMD,fontFamily:'Figtree-Regular',color:TOKENS.ink,flexShrink:1},
  linePending:{color:TOKENS.muted},
  polaroid:{position:'absolute',left:spacing[4],width:72,padding:4,paddingBottom:14,backgroundColor:'#FFFFFF',transform:[{rotate:'-4deg'}],shadowColor:'#000',shadowOpacity:.18,shadowRadius:6,shadowOffset:{width:0,height:3},elevation:3},
  polaroidImage:{width:'100%',aspectRatio:1,backgroundColor:TOKENS.muted},
  polaroidLabel:{position:'absolute',bottom:2,alignSelf:'center',fontFamily:TOKENS.sansStrong,fontSize:7,letterSpacing:1.2,color:TOKENS.ink},
});
