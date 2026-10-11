import 'react-native-gesture-handler';
import React, { useMemo, useState } from 'react';
import { registerRootComponent } from 'expo';
import { ScrollView, StatusBar, StyleSheet, Text, Pressable, useWindowDimensions, View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { EBGaramond_500Medium } from '@expo-google-fonts/eb-garamond';
import { Figtree_400Regular, Figtree_600SemiBold } from '@expo-google-fonts/figtree';
import { BricolageGrotesque_400Regular, BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque';
import { ChartPreview } from '@/components/chart/ChartPreview';
import { ChartWorldPreview } from '@/components/v2/chart/ChartWorldPreview';
import { ChartPreviewFixtureContext, selectChartPreview } from '@/hooks/useChartPreview';
import { chartPreviewCourses } from '@/components/chart/__fixtures__/chartPreviewStates';
import { toHomeChartState } from '@/adapters/v2/home/chartAdapter';
import { chartWeatherProgress, routeRevealArc } from '@/components/v2/chart/map/chartProgress';
import { buildRouteTable, waypointPlacement } from '@/components/v2/chart/map/chartMapGeometry';
import type { CourseDetail } from '@/types/chart';
import { V2ChartPreview } from '@/screens/v2/system/V2ChartPreview';
import { ChartMapCropBefore } from './ChartMapCropBefore';

const base = chartPreviewCourses.normal!;
const atWaypoint = (index: number): CourseDetail => ({
  ...base,
  id: `chart-cloud-qa-${index}`,
  currentWaypointId: `w${index}`,
  currentMoveId: null,
  reachedCount: index - 1,
  waypoints: base.waypoints.map((waypoint, i) => ({
    ...waypoint,
    courseId: `chart-cloud-qa-${index}`,
    state: i + 1 < index ? 'REACHED' : i + 1 === index ? 'CURRENT' : 'UPCOMING',
    reachedAt: i + 1 < index ? '2026-01-02T00:00:00Z' : null,
})),
});
const fixtures = Object.fromEntries([1, 3, 5].map((index) => {
  const course = atWaypoint(index);
  const progress = chartWeatherProgress(course);
  const table = buildRouteTable();
  const placement = waypointPlacement(progress.inputs.length);
  const weatherCoverArc = routeRevealArc({
    inputs: progress.inputs,
    currentIndex: progress.currentIndex,
    isFinished: progress.isFinished,
    hw: {},
    placement,
    table,
  });
  return [`progress-${index}`, { ...selectChartPreview(course, 'desire'), weatherCoverArc }];
}));

function PreviewEvidence() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState(1);
  const [baseline, setBaseline] = useState(false);
  const [activeChart, setActiveChart] = useState(false);
  const course = useMemo(() => atWaypoint(selected), [selected]);
  const chartState = toHomeChartState(course);
  if (activeChart) return <V2ChartPreview onClose={() => setActiveChart(false)} />;
  return (
    <ChartPreviewFixtureContext.Provider value={fixtures}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Chart cloud QA</Text>
            <Text style={styles.subtitle}>Home · Details · canonical map · waypoint {selected}/5</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setActiveChart(true)} style={styles.button}>
            <Text style={styles.buttonText}>Open full Chart</Text>
          </Pressable>
        </View>
        <View style={styles.progressRow}>
          {[1, 3, 5].map((index) => (
            <Pressable key={index} accessibilityRole="button" onPress={() => setSelected(index)} style={[styles.progress, selected === index && styles.progressActive]}>
              <Text style={[styles.progressText, selected === index && styles.progressTextActive]}>{index}/5 progress</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.modeRow}>
          <Pressable accessibilityRole="button" onPress={() => setBaseline(true)} style={[styles.mode, baseline && styles.modeActive]}>
            <Text style={[styles.modeText, baseline && styles.modeTextActive]}>Before · static</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setBaseline(false)} style={[styles.mode, !baseline && styles.modeActive]}>
            <Text style={[styles.modeText, !baseline && styles.modeTextActive]}>After · actual previews</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {chartState.state === 'ready' ? (
            <View style={styles.section}>
              <Text style={styles.label}>WAYPOINT {selected} OF 5</Text>
              {baseline ? <>
                <Text style={styles.surface}>Home map crop · original static compositor</Text>
                <View style={{ height: (width - 32) * 9 / 16 }}>
                  <ChartMapCropBefore data={fixtures[`progress-${selected}`]} full={false} />
                </View>
                <Text style={styles.surface}>Details map crop · original static compositor</Text>
                <View style={{ height: (width - 32) * 0.6 }}>
                  <ChartMapCropBefore data={fixtures[`progress-${selected}`]} full={false} />
                </View>
                <Text style={styles.surface}>Full map · original static compositor</Text>
                <ChartMapCropBefore data={fixtures[`progress-${selected}`]} full />
              </> : <>
                <Text style={styles.surface}>Home card</Text>
                <ChartPreview variant="card" anchorId={`progress-${selected}`} onPress={() => undefined} testID={`qa-home-${selected}`} />
                <Text style={styles.surface}>Details card</Text>
                <ChartWorldPreview variant="details" chart={chartState} width={width - 32} category="desire" testID={`qa-details-${selected}`} />
                <Text style={styles.surface}>Full map crop · canonical Chart map renderer</Text>
                <ChartPreview variant="hero" anchorId={`progress-${selected}`} onPress={() => undefined} testID={`qa-fullmap-${selected}`} />
              </>}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </ChartPreviewFixtureContext.Provider>
  );
}

function App() {
  useFonts({
    'EBGaramond-Medium': EBGaramond_500Medium,
    'Figtree-Regular': Figtree_400Regular,
    'Figtree-SemiBold': Figtree_600SemiBold,
    'BricolageGrotesque-Regular': BricolageGrotesque_400Regular,
    'BricolageGrotesque-SemiBold': BricolageGrotesque_600SemiBold,
  });
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><PreviewEvidence /></SafeAreaProvider></GestureHandlerRootView>;
}

registerRootComponent(App);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F0E7' },
  header: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { color: '#25211D', fontSize: 19, fontFamily: 'BricolageGrotesque-SemiBold' },
  subtitle: { color: '#686058', fontSize: 11, fontFamily: 'Figtree-Regular' },
  button: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: '#352E25' },
  buttonText: { color: '#F5F0E7', fontSize: 11, fontFamily: 'Figtree-SemiBold' },
  progressRow: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', gap: 8 },
  progress: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10, backgroundColor: '#E4DCCF' },
  progressActive: { backgroundColor: '#352E25' },
  progressText: { color: '#50483E', fontSize: 11, fontFamily: 'Figtree-SemiBold' },
  progressTextActive: { color: '#F5F0E7' },
  modeRow: { paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', gap: 8 },
  mode: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10, backgroundColor: '#E4DCCF' },
  modeActive: { backgroundColor: '#78634A' },
  modeText: { color: '#50483E', fontSize: 10, fontFamily: 'Figtree-SemiBold' },
  modeTextActive: { color: '#FFFFFF' },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 22 },
  section: { gap: 8 },
  label: { color: '#766A5E', fontSize: 10, letterSpacing: 1, fontFamily: 'Figtree-SemiBold' },
  surface: { color: '#766A5E', fontSize: 11, fontFamily: 'Figtree-SemiBold', marginTop: 6 },
});
