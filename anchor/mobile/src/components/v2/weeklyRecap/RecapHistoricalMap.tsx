import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChartMapCrop } from '@/components/chart/ChartMapCrop';
import { colors, radii, typography } from '@/theme/v2';
import type { RecapViewModel } from '@/adapters/v2/weeklyRecap/recapViewModel';

/**
 * Read-only historical route. It renders the existing Chart etched map through ChartMapCrop
 * (unchanged) from server-verified week-end state. It never touches live Chart state, and when
 * the state is not verified it shows a plain note instead of approximating a route.
 */
export const RecapHistoricalMap = React.memo(function RecapHistoricalMap({ map, category, title, testID }: {
  map: RecapViewModel['map'];
  category: string | null;
  title: string;
  testID?: string;
}) {
  if (map.mode === 'NONE') {
    if (map.reason === 'NO_COURSE') return null;
    return (
      <View style={styles.note} testID={testID ? `${testID}-unavailable` : undefined}>
        <Text style={styles.noteText}>Route progress for this week isn’t available.</Text>
      </View>
    );
  }
  if (!category) {
    return (
      <View style={styles.note}>
        <Text style={styles.noteText}>Route progress for this week isn’t available.</Text>
      </View>
    );
  }
  const waypoints = map.reachedMask.map((reached, i) => ({ id: `week-wp-${i}`, title: `Waypoint ${i + 1}`, reached, isCurrent: false }));
  return (
    <View style={styles.frame} testID={testID} accessible accessibilityLabel={`Route at the end of the week: ${map.waypointIndex} of ${map.waypointTotal} waypoints reached.`}>
      <ChartMapCrop
        data={{ category, status: map.routeStatus, waypointIndex: map.waypointIndex, waypointTotal: map.waypointTotal, title }}
        full={false}
        height={210}
        waypoints={waypoints}
      />
      <Text style={styles.caption}>{map.waypointIndex} of {map.waypointTotal} waypoints reached</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { marginHorizontal: 20, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border.subtle },
  caption: { fontFamily: typography.body, fontSize: 12, color: colors.text.secondary, paddingHorizontal: 14, paddingVertical: 10 },
  note: { marginHorizontal: 20, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border.subtle },
  noteText: { fontFamily: typography.body, fontSize: 13, color: colors.text.secondary },
});
