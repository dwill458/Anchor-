import { chartTypography as typography } from './chartTypography';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { cancelAnimation, withDelay } from 'react-native-reanimated';
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
  // Faint pencil map while the request runs: nothing is drawn, no node exists yet.
  useEffect(()=>{
    anim.mapOpacity.value=1; anim.fog.value=0; anim.flagIndex.value=0;
    anim.revealArc.value=0; anim.flagOpacity.value=0;
    const finding=setTimeout(()=>setStage(current=>current==='reading' ? 'finding' : current),900);
    const waiting=T.longWait.map((ms,index)=>setTimeout(()=>{ if (!committed.current) setLongWaitIndex(index); },ms));
    return ()=>{ clearTimeout(finding); waiting.forEach(clearTimeout); };
  },[anim]);
  useEffect(()=>{
    if (!hasMarkers || committed.current || revealed.current) return;
    committed.current=true;
    setLongWaitIndex(-1); setStage('building');
    if (reducedMotion) { anim.revealArc.value=firstArc; anim.flagOpacity.value=1; }
    else {
      anim.revealArc.value=chartTiming(firstArc,{duration:1600,easing:CHART_EASING.settle});
      anim.flagOpacity.value=withDelay(1300,chartTiming(1,{duration:500,easing:CHART_EASING.settle}));
    }
    const finish=setTimeout(()=>{ revealed.current=true; setStage('ready'); callback.current?.(); },reducedMotion ? 420 : 1900);
    return ()=>{ committed.current=false; clearTimeout(finish); cancelAnimation(anim.revealArc); cancelAnimation(anim.flagOpacity); };
  },[hasMarkers,reducedMotion,anim,firstArc]);
  const phrase=longWaitIndex>=0 && (stage==='reading'||stage==='finding') ? CHART_COPY.generation.longWait[longWaitIndex] : CHART_COPY.generation.stages[stage];
  const stageIndex=STAGES.indexOf(stage);
  return <View testID={testID} style={[styles.stage,{width,height}]}>
    {/* The map sits on its start: bottom-aligned, so the route's foot stays in view. */}
    <View style={{position:'absolute',left:(width-mapWidth)/2,top:0,width:mapWidth,height:mapHeight}}>
      <ChartMap width={mapWidth} table={table} placement={placement} anim={anim} markers={mapMarkers} categoryColor={accent} category={category ?? undefined}
        interactive={false} reducedMotion={reducedMotion} arrived={false} clouds={hasMarkers} onMarkerPress={noop} onMapPress={noop}
        testID={`${testID ?? 'chart-stage'}-map`} />
    </View>
    {/* DEFERRED: <ChartJourneyWorld width={width} height={Math.max(1,height-footerSpace)} category={category} markers={markers ?? []} staticProgress={ROUTE_START} nodeReveal={nodeReveal} onReady={setReady} accessibilityLabel={markers ? `Road mapped with ${markers.length} waypoints` : 'Mapping your journey'} /> */}
    {destinationImageUrl ? <View style={[styles.polaroid,{bottom:footerSpace+spacing[3]}]} pointerEvents="none" testID="chart-stage-vision">
      <Image source={{uri:destinationImageUrl}} style={styles.polaroidImage} accessibilityIgnoresInvertColors />
      <Text style={styles.polaroidLabel}>VISION</Text>
    </View> : null}
    {!settled ? <View style={[styles.status,{height:footerSpace}]} accessibilityLiveRegion="polite" accessible accessibilityLabel={phrase} testID="chart-generation-status">
      {CHECKLIST.map((key,index)=>{
        const done=stage==='ready' || index<stageIndex;
        const current=!done && index===stageIndex;
        const text=current && longWaitIndex>=0 && key!=='building' ? CHART_COPY.generation.longWait[longWaitIndex] : CHART_COPY.generation.stages[key];
        return <View key={key} style={styles.line}>
          <View style={[styles.mark,done&&{backgroundColor:accent,borderColor:accent},current&&{borderColor:accent}]}>
            {done ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
          </View>
          <Text style={[styles.lineText,!done&&!current&&styles.linePending]} numberOfLines={1}>{text}</Text>
        </View>;
      })}
    </View> : null}
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
