import { chartTypography as typography } from './chartTypography';
import React from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Wind } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { VisionPhoto } from '@/components/v2/vision/VisionPhoto';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { formatJourneyDate, type ChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import { colors, radii, spacing } from '@/theme/v2';
import { ChartCreamPanel, ChartEyebrow, ChartInkScreen, ChartTopBar, type ChartIdentity } from './ChartChrome';
import type { ChartVisionPreview } from './ChartActiveView';
import type { ChartAnchorArt } from './ChartLandscape';
// DEFERRED: import { ChartJourneyWorld } from './ChartJourneyWorld';
import { ChartStaticMap } from './panel/ChartStaticMap';
import { getCategoryColor } from '@/theme/v2';
type Props = {
  view:ChartViewModel; identity:ChartIdentity; anchorArt:ChartAnchorArt|null;
  vision:ChartVisionPreview|null; released:boolean; reducedMotion:boolean;
  onBack:()=>void; onViewJourney:()=>void; onRelease:()=>void; testID?:string;
};
type Row = { label: string; value: string };

/** Only facts the server gave us; a missing count is omitted, never invented. */
export function journeyRows(view: ChartViewModel): Row[] {
  const rows: Row[] = [];
  const created = formatJourneyDate(view.plottedAt);
  const reached = formatJourneyDate(view.completedAt);
  if (created) rows.push({ label: 'Created', value: created });
  if (reached) rows.push({ label: 'Reached', value: reached });
  rows.push({ label: 'Waypoints', value: String(view.total) });
  rows.push({ label: 'Moves completed', value: String(view.completedMoveCount) });
  if (typeof view.practiceCount === 'number') rows.push({ label: 'Practices', value: String(view.practiceCount) });
  return rows;
}

// DEFERRED: export function ChartDestinationReached({ view,identity,vision,released,onBack,onViewJourney,onRelease,testID }:Props) {
export function ChartDestinationReached({ view,identity,vision,released,reducedMotion,onBack,onViewJourney,onRelease,testID }:Props) {
  // DEFERRED:   const {width,height}=useWindowDimensions();
  const {width}=useWindowDimensions();
  const insets=useSafeAreaInsets();
  return <ChartInkScreen testID={testID ?? 'chart-destination-reached'}>
    <ScrollView contentContainerStyle={{paddingBottom:insets.bottom+spacing[6]}}>
      <ChartTopBar title={view.isStretch ? "Stretch completed" : "Destination reached"} onBack={onBack} />
      {/*
      // DEFERRED:       <ChartJourneyWorld width={width} height={height*.46} category={identity.category} staticProgress={view.isFinished ? 1 : 0}
      // DEFERRED:         markers={view.waypoints.map(w=>({id:w.id,number:w.number,state:w.state,accessibilityLabel:w.accessibilityLabel}))} />
      */}
      <ChartStaticMap width={width} categoryColor={getCategoryColor(identity.category)} category={identity.category} mode="arrived" waypointCount={view.total} reducedMotion={reducedMotion}
        markers={view.waypoints.map((w,index)=>({id:w.id,index,number:w.number,title:w.title,state:'done' as const,selected:false,accessibilityLabel:`Waypoint ${w.number}: ${w.title}, reached`}))} testID="chart-arrived-map" />
      <ChartCompletionPanel view={view} vision={vision} released={released} onViewJourney={onViewJourney} onRelease={onRelease} />
    </ScrollView>
  </ChartInkScreen>;
}
/** Reused below the still-mounted active world, so completion cannot interrupt its final camera rail. */
export function ChartCompletionPanel({ view,vision,released=false,onViewJourney,onRelease }: Pick<Props,'view'|'vision'|'onViewJourney'|'onRelease'> & {released?:boolean}) {
  return <ChartCreamPanel style={styles.panel} testID="chart-completion-panel">
    <ChartEyebrow tone="cream">{view.isStretch ? "NEXT STRETCH" : CHART_COPY.labels.destinationReached}</ChartEyebrow>
    <Text accessibilityRole="header" style={styles.headline}>{view.isStretch ? "This stretch is complete." : CHART_COPY.reached.destinationHeadline}</Text>
    <Text style={styles.destination}>{view.destination}</Text>
    {vision?.imageUrl ? <VisionPhoto source={vision.imageUrl} scrim="none" style={styles.vision} testID="chart-reached-vision" /> : null}
    <View style={styles.rows}>{journeyRows(view).map(row=><View key={row.label} style={styles.row} accessible accessibilityLabel={`${row.label}: ${row.value}`}>
      <Text style={styles.rowLabel}>{row.label}</Text><Text style={styles.rowValue}>{row.value}</Text>
    </View>)}</View>
    <V2Button size="large" onPress={onViewJourney} iconRight={<ArrowRight size={18} color={colors.text.inverse}/>} testID="chart-view-journey" accessibilityLabel={CHART_COPY.reached.viewJourney}>{CHART_COPY.reached.viewJourney}</V2Button>
    {!released ? <V2Button variant="secondary" size="large" onPress={onRelease} iconLeft={<Wind size={18} color={colors.text.primary}/>} testID="chart-release-anchor" accessibilityLabel={view.isStretch ? "Plan the next stretch" : CHART_COPY.reached.release}>{view.isStretch ? "Plan the next stretch" : CHART_COPY.reached.release}</V2Button> : null}
  </ChartCreamPanel>;
}
const styles=StyleSheet.create({
  panel:{borderTopLeftRadius:radii.xl,borderTopRightRadius:radii.xl,paddingBottom:spacing[5],gap:spacing[3]},
  headline:{...typography.headingXL,fontFamily:'BricolageGrotesque-SemiBold',color:colors.text.primary},
  destination:{...typography.bodyLG,fontFamily:'Figtree-Regular',color:colors.text.primary},
  vision:{height:200,borderRadius:radii.md,overflow:'hidden'},rows:{gap:0,marginBottom:spacing[2]},
  row:{flexDirection:'row',justifyContent:'space-between',paddingVertical:spacing[2],borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border.subtle},
  rowLabel:{...typography.bodyMD,fontFamily:'Figtree-Regular',color:colors.text.secondary},
  rowValue:{...typography.labelLG,fontFamily:'Figtree-SemiBold',color:colors.text.primary},
});
