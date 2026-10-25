import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { PanelButton } from '../panel/ChartPanelCards';
import type { PanelAccent } from '../panel/chartPanelColors';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';

type Props = { accent: PanelAccent; label: string; busy: boolean; onReach: () => void };

/** Replaces the One Move card once every move on the waypoint is done. The button is the same reach action as the route row's. */
export function ChartAllMovesDone({ accent, label, busy, onReach }: Props) {
  return (
    <View style={styles.card} testID="chart-all-moves-done">
      <Text style={styles.text}>{CHART_COPY.sheet.allDone}</Text>
      <PanelButton label={label} variant="primary" accent={accent} loading={busy} onPress={onReach} testID="chart-all-done-reach" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239,234,223,.12)', backgroundColor: T.panel },
  text: { fontFamily: T.serif, fontSize: 18, lineHeight: 23, color: T.light },
});
