import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { HomeRecentActivityItem } from '@/adapters/v2/home/recentActivityAdapter';
import { colors, typography } from '@/theme/v2';
import { getPracticeColor } from '@/theme/v2/practiceColors';

function durationLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  return seconds < 60 ? `${Math.round(seconds)} sec` : `${Math.round(seconds / 60)} min`;
}

function PracticeGlyph({ mode, color }: { mode: string; color: string }) {
  const normalized = mode.replace(/[\s_-]/g, '').toLowerCase();
  return (
    <Svg testID={`v2-home-practice-glyph-${normalized}`} width={32} height={32} viewBox="0 0 32 32" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {normalized === 'visualize' ? <>
        <Path d="M3 16c3.2-5.1 7.6-7.7 13-7.7S25.8 10.9 29 16c-3.2 5.1-7.6 7.7-13 7.7S6.2 21.1 3 16Z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={16} cy={16} r={3.4} stroke={color} strokeWidth={1.8} />
      </> : normalized === 'deepprime' ? <>
        <Circle cx={16} cy={16} r={11.5} stroke={color} strokeWidth={1.7} />
        <Circle cx={16} cy={16} r={6.7} stroke={color} strokeWidth={1.7} />
        <Circle cx={16} cy={16} r={2} fill={color} />
      </> : normalized === 'release' ? <>
        <Path d="M7 10.5h9.2c4.4 0 7.3 2.1 7.3 5.5s-2.9 5.5-7.3 5.5H7M18.8 7.5l4.7 3-4.7 3M20 19l4.8 2.8-4.8 3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </> : <>
        <Path d="M5 12V6h6M21 6h6v6M27 20v6h-6M11 26H5v-6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="m12 20 7-8M14 12h5v5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </>}
    </Svg>
  );
}

function V2HomeRecentActivitySectionComponent({ items, onViewAll }: { items: HomeRecentActivityItem[]; onViewAll?: () => void }) {
  if (items.length === 0) return null;
  return <View testID="v2-home-recent-activity" style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.heading}>Recent Practice</Text>
      {onViewAll ? <Pressable accessibilityRole="button" accessibilityLabel="View all Recent Practice" onPress={onViewAll} hitSlop={8}><Text style={styles.link}>View all ›</Text></Pressable> : null}
    </View>
    {items.map((item) => <View key={item.id} style={styles.row}>
      <PracticeGlyph mode={item.mode} color={getPracticeColor(item.mode)} />
      <Text numberOfLines={1} style={styles.title}>{item.title}{durationLabel(item.durationSeconds) ? ` · ${durationLabel(item.durationSeconds)}` : ''}</Text>
      <Text numberOfLines={1} style={styles.day}>{item.dayLabel}</Text>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  // A wider gap than the other section dividers: Vision (and, when Vision is
  // absent, Chart) is now the visually heaviest module above this one, and
  // Recent Activity needs to read as history rather than part of it.
  container: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.graphite.hairline },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  link: { fontFamily: 'Figtree-Regular', fontSize: 13, color: colors.graphite.text.secondary },
  heading: { fontFamily: 'BricolageGrotesque-SemiBold', fontSize: 18, lineHeight: 23, color: colors.graphite.text.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.graphite.hairline },
  title: { flex: 1, minWidth: 0, fontFamily: 'Figtree-Regular', fontSize: 15, color: colors.graphite.text.primary },
  day: { maxWidth: 88, fontFamily: 'Figtree-Regular', fontSize: 13, color: colors.graphite.text.tertiary, textAlign: 'right' },
});

export const V2HomeRecentActivitySection = memo(V2HomeRecentActivitySectionComponent);
