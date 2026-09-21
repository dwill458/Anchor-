import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { HomeRecentActivityItem } from '@/adapters/v2/home/recentActivityAdapter';
import { colors, typography } from '@/theme/v2';
import { getPracticeColor } from '@/theme/v2/practiceColors';

function durationLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  return seconds < 60 ? `${Math.round(seconds)} sec` : `${Math.round(seconds / 60)} min`;
}

function V2HomeRecentActivitySectionComponent({ items }: { items: HomeRecentActivityItem[] }) {
  if (items.length === 0) return null;
  return <View testID="v2-home-recent-activity" style={styles.container}>
    <Text style={styles.kicker}>RECENT ACTIVITY</Text>
    {items.map((item) => <View key={item.id} style={styles.row}>
      <View style={[styles.mark, { backgroundColor: getPracticeColor(item.mode) }]}><Text style={styles.markSymbol}>✦</Text></View>
      <Text style={styles.title}>{item.title}{durationLabel(item.durationSeconds) ? ` · ${durationLabel(item.durationSeconds)}` : ''}</Text>
      <Text style={styles.day}>{item.dayLabel}</Text>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  container: { marginTop: 30, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.graphite.hairline },
  kicker: { fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 2.2, color: colors.graphite.text.tertiary, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  mark: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  markSymbol: { color: '#FFFFFF', fontSize: 13 },
  title: { flex: 1, fontFamily: 'EBGaramond-Regular', fontSize: 16, color: colors.graphite.text.primary },
  day: { fontFamily: typography.body, fontSize: 12, color: colors.graphite.text.tertiary },
});

export const V2HomeRecentActivitySection = memo(V2HomeRecentActivitySectionComponent);
