import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, radii, spacing, V2_MIN_TOUCH_TARGET } from '@/theme/v2';
import { chartTypography as typography } from '@/components/v2/chart/chartTypography';
import { formatMetricNumber } from '@/adapters/v2/chart/chartV2Model';
import { useChartPreview } from '@/hooks/useChartPreview';
import { ChartMapCrop } from './ChartMapCrop';
import { ChartProgressBar } from './ChartProgressBar';

export type ChartPreviewProps = {
  variant: 'hero' | 'card' | 'row';
  anchorId: string;
  onPress: () => void;
};
const number = (value: number | null) => value === null ? '—' : formatMetricNumber(value);

/** All variants consume only the shared preview selection. Navigation belongs to callers. */
// DEFERRED: pre-663ce64e prototype. The corrected etched-map preview lives in
// E:/Projects/anchor-chart-map/anchor/mobile/src/components/chart/ChartPreview.tsx.
// DEFERRED: migrate existing Chart/Home/Details/Vision surfaces in a later pass.
export function ChartPreview({ variant, anchorId, onPress }: ChartPreviewProps) {
  const data = useChartPreview(anchorId);
  const row = variant === 'row';
  const hero = variant === 'hero';
  const title = data?.title ?? 'Chart unavailable';
  const label = [title, data && data.status !== 'empty' && data.waypointIndex > 0
    ? `Waypoint ${data.waypointIndex} of ${data.waypointTotal}` : null,
    !row && data && data.status !== 'empty' ? `${number(data.current)} / ${number(data.target)}` : null,
    data && data.status !== 'empty' ? `${Math.round(data.progress * 100)}% progress` : null,
    hero && data?.startValue != null ? `started at ${number(data.startValue)}` : null,
    data?.nextMove ? `Next move: ${data.nextMove}` : null].filter(Boolean).join('. ');
  return (
    <Pressable testID="chart-preview" accessibilityRole="button" accessibilityLabel={label}
      onPress={onPress} style={({ pressed }) => [styles.frame, row && styles.row, pressed && styles.pressed]}>
      {data && data.status !== 'empty' && !row ? <ChartMapCrop data={data} full={hero} /> : null}
      <View testID="chart-preview-copy" style={[styles.copy, row && styles.rowCopy, hero && styles.panel]}>
        {data && data.status !== 'empty' && !row ? <>
          {hero && data.status === 'active' ? <Text style={styles.label}>CURRENT WAYPOINT</Text> : null}
          {data.waypointIndex > 0 ? <Text style={styles.label}>WAYPOINT {data.waypointIndex} OF {data.waypointTotal}</Text> : null}
        </> : null}
        <Text style={[styles.title, hero && styles.heroTitle]}>{title}</Text>
        {data && data.status !== 'empty' ? <>
          {!row ? <Text style={styles.metric}>{number(data.current)} / {number(data.target)}</Text> : null}
          {hero && data.startValue !== null ? <Text style={styles.secondary}>started at {number(data.startValue)}</Text> : null}
          <ChartProgressBar progress={data.progress} category={data.category} />
          {data.nextMove && !hero ? <View style={styles.move}>
            <Text style={styles.label}>Next move</Text>
            <Text style={styles.secondary} numberOfLines={row ? 1 : undefined} ellipsizeMode="tail">{data.nextMove}</Text>
          </View> : null}
        </> : null}
      </View>
      <View pointerEvents="none" style={row ? styles.rowChevron : styles.chevron}>
        <ChevronRight size={spacing[6]} color={colors.ink.text.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { minHeight: V2_MIN_TOUCH_TARGET, borderRadius: radii.lg, overflow: 'hidden',
    backgroundColor: colors.ink.deep, borderWidth: 1, borderColor: colors.ink.hairlineStrong },
  row: { flexDirection: 'row', alignItems: 'center' },
  copy: { padding: spacing[4], paddingRight: spacing[10], gap: spacing[2] },
  rowCopy: { flex: 1, minWidth: 0, paddingRight: spacing[2] },
  panel: { backgroundColor: colors.ink.raised },
  label: { ...typography.labelSM, color: colors.ink.text.secondary },
  title: { ...typography.headingSM, color: colors.ink.text.primary },
  heroTitle: { ...typography.headingLG },
  metric: { ...typography.numericMedium, color: colors.ink.text.primary },
  secondary: { ...typography.bodySM, color: colors.ink.text.secondary },
  move: { gap: spacing[1] },
  chevron: { position: 'absolute', bottom: spacing[4], right: spacing[4] },
  rowChevron: { paddingRight: spacing[4], flexShrink: 0 },
  pressed: { opacity: 0.8 },
});
