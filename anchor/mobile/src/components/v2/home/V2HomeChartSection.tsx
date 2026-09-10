import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { V2Button } from '@/components/v2';
import { colors, spacing, typography } from '@/theme/v2';
import type { HomeChartState } from '@/adapters/v2/home';

type Props = {
  chart: HomeChartState;
  onOpenChart?: () => void;
  onCreateChart?: () => void;
};

/** Consumes the real Course/Waypoint data. Read-only; never advances progress. */
export function V2HomeChartSection({ chart, onOpenChart, onCreateChart }: Props) {
  if (chart.state === 'none') {
    return (
      <View style={styles.section}>
        <View style={styles.heading}><Text style={styles.kicker}>NEXT ON YOUR CHART  ✦</Text></View>
        <View style={styles.card}><Text style={styles.destination}>Give your future a path.</Text><Text style={styles.description}>Meaningful waypoints. One clear next move.</Text><V2Button variant="secondary" accessibilityLabel="Start a Chart" onPress={onCreateChart}>Plot your Chart</V2Button></View>
      </View>
    );
  }
  const progress = `${chart.reachedCount} of ${chart.waypointCount} waypoints`;
  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.heading}><Text style={styles.kicker}>NEXT ON YOUR CHART  ✦</Text><Text onPress={onOpenChart} style={styles.action}>View Chart  ›</Text></View>
        <Text style={styles.destination}>{chart.destinationText}</Text>
        {chart.nextMove ? (
          <View style={styles.moveRow}>
            <Text style={styles.moveLabel}>NEXT MOVE</Text>
            <Text style={styles.move}>{chart.nextMove}</Text>
          </View>
        ) : null}
        <Text style={styles.progress}>{progress}</Text>
        <View style={styles.route} accessibilityElementsHidden><Svg width="100%" height={54} viewBox="0 0 320 54" style={styles.routeRibbon}><Path d="M16 35C57 5 74 54 112 34S171 13 205 28S266 47 305 19" stroke="#E4E0D8" strokeWidth={7} strokeDasharray="9 7" strokeLinecap="round" fill="none"/><Path d="M16 35C57 5 74 54 112 34S171 13 205 28S266 47 305 19" stroke="#7C5CFA" strokeWidth={8} strokeDasharray="139 500" strokeLinecap="round" fill="none"/><Path d="M16 32C57 3 74 51 112 31S171 10 205 25" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={2} fill="none"/></Svg><View style={[styles.completedDot, styles.dotOne]} /><View style={[styles.currentDot, styles.dotTwo]} /><View style={[styles.futureDot, styles.dotThree]} /><Text style={styles.star}>✦</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { ...typography.labelSM, color: '#8054DC', fontSize: 10 },
  action: { ...typography.caption, color: colors.text.secondary },
  card: {
    gap: spacing[2], padding: spacing[4],
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  destination: { ...typography.headingLG, color: colors.text.primary },
  description: { ...typography.bodySM, color: '#62738B' },
  moveRow: { gap: 2 },
  moveLabel: { ...typography.labelSM, color: colors.text.secondary },
  move: { ...typography.bodyMD, color: colors.text.primary },
  progress: { ...typography.caption, color: colors.text.secondary },
  route: { height: 54, position: 'relative', justifyContent: 'center' },
  routeRibbon: { position: 'absolute', left: 0, top: 0 },
  completedDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#287D57', borderWidth: 4, borderColor: '#ACE7D2' },
  currentDot: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#3157D8', borderWidth: 5, borderColor: '#B7C8FE' },
  futureDot: { width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: '#BFC0BB' },
  dotOne: { position: 'absolute', left: '5%', top: 25 }, dotTwo: { position: 'absolute', left: '35%', top: 18 }, dotThree: { position: 'absolute', left: '65%', top: 25 },
  star: { position: 'absolute', right: 0, top: 6, color: '#F28A2E', fontSize: 30, lineHeight: 34 },
});
