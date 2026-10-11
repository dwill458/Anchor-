import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, radii, spacing, V2_MIN_TOUCH_TARGET } from '@/theme/v2';
import { chartTypography as typography } from '@/components/v2/chart/chartTypography';
import { useV2Responsive } from '@/hooks/v2/useV2Responsive';
import { formatMetricNumber } from '@/adapters/v2/chart/chartV2Model';
import { useChartPreview } from '@/hooks/useChartPreview';
import { ChartMapCrop } from './ChartMapCrop';
import { ChartProgressBar } from './ChartProgressBar';

export type ChartPreviewProps = {
  variant: 'hero' | 'card' | 'row';
  anchorId: string;
  onPress: () => void;
  testID?: string;
};
const number = (value: number | null) => value === null ? '—' : formatMetricNumber(value);
const CARD_COPY_HEIGHT = spacing[10] * 3 + spacing[4];

/** All variants consume only the shared preview selection. Navigation belongs to callers. */
// DEFERRED: migrate existing Chart/Home/Details/Vision surfaces in a later pass.
export const ChartPreview = memo(function ChartPreview({ variant, anchorId, onPress, testID = 'chart-preview' }: ChartPreviewProps) {
  const data = useChartPreview(anchorId);
  const { width, gutter } = useV2Responsive();
  const row = variant === 'row';
  const hero = variant === 'hero';
  const title = data?.title ?? '';
  const label = data
    ? [title, data.status !== 'empty' && data.waypointIndex > 0
      ? `Waypoint ${data.waypointIndex} of ${data.waypointTotal}` : null,
      !row && data.status !== 'empty' ? (data.target !== null ? `${number(data.current)} / ${number(data.target)}` : data.movesLabel ?? null) : null,
      data.status !== 'empty' ? `${Math.round(data.progress * 100)}% progress` : null,
      hero && data.startValue ? `started at ${number(data.startValue)}` : null,
      data?.nextMove ? `Next move: ${data.nextMove}` : null].filter(Boolean).join('. ')
    : 'Loading Chart';
  const mapHeight = (width - gutter * 2) * 9 / 16;
  const cardHeight = mapHeight + CARD_COPY_HEIGHT;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label}
      onPress={onPress} style={({ pressed }) => [styles.frame, !row && !hero && { height: cardHeight }, row && styles.row, pressed && styles.pressed]}>
      {data && !row ? <ChartMapCrop data={data} full={hero} coverArc={data.weatherCoverArc} /> : null}
      <View testID="chart-preview-copy" style={[styles.copy, row && styles.rowCopy, hero && styles.panel]}>
        {data && data.status !== 'empty' && !row ? <>
          {hero && data.status === 'active' ? <Text style={styles.label}>CURRENT WAYPOINT</Text> : null}
          {data.waypointIndex > 0 ? <Text style={styles.label}>WAYPOINT {data.waypointIndex} OF {data.waypointTotal}</Text> : null}
        </> : null}
        <Text style={[styles.title, hero && styles.heroTitle]}>{title}</Text>
        {data && data.status !== 'empty' ? <>
          {!row && data.target !== null ? <Text style={styles.metric}>{number(data.current)} / {number(data.target)}</Text> : null}
          {!row && data.target === null && data.movesLabel ? <Text style={styles.metric}>{data.movesLabel}</Text> : null}
          {hero && data.target !== null && data.startValue ? <Text style={styles.secondary}>started at {number(data.startValue)}</Text> : null}
          <ChartProgressBar progress={data.progress} category={data.category} />
          {data.nextMove && !hero ? <View style={styles.move}>
            <Text style={styles.label}>Next move</Text>
            <Text style={styles.secondary} numberOfLines={row ? 1 : undefined} ellipsizeMode="tail">{data.nextMove}</Text>
          </View> : null}
        </> : null}
      </View>
      {!data ? <View testID="chart-preview-loading" pointerEvents="none" style={[styles.loading, { height: cardHeight }]}>
        <View style={{ height: mapHeight, backgroundColor: colors.ink.raised }} />
        <View style={styles.loadingCopy}>
          <View style={styles.loadingTitle} />
          <View style={styles.loadingMetric} />
          <View style={styles.loadingBar} />
          <View style={styles.loadingMove} />
        </View>
      </View> : null}
      <View pointerEvents="none" style={row ? styles.rowChevron : styles.chevron}>
        <ChevronRight size={spacing[6]} color={colors.ink.text.primary} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  frame: { minHeight: V2_MIN_TOUCH_TARGET, borderRadius: radii.lg, overflow: 'hidden',
    backgroundColor: colors.ink.deep, borderWidth: 1, borderColor: colors.ink.hairlineStrong },
  row: { flexDirection: 'row', alignItems: 'center' },
  copy: { padding: spacing[4], paddingRight: spacing[4], gap: spacing[2] },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, borderRadius: radii.lg,
    backgroundColor: colors.ink.deep },
  loadingCopy: { flex: 1, padding: spacing[4], gap: spacing[3] },
  loadingTitle: { width: '62%', height: spacing[5], borderRadius: spacing[1], backgroundColor: colors.ink.hairlineStrong },
  loadingMetric: { width: '34%', height: spacing[4], borderRadius: spacing[1], backgroundColor: colors.ink.hairlineStrong },
  loadingBar: { width: '100%', height: spacing[1], borderRadius: spacing[1], backgroundColor: colors.ink.hairlineStrong },
  loadingMove: { width: '58%', height: spacing[4], borderRadius: spacing[1], backgroundColor: colors.ink.hairlineStrong },
  rowCopy: { flex: 1, minWidth: 0, paddingRight: spacing[2] },
  panel: { backgroundColor: colors.ink.raised },
  label: { ...typography.labelSM, color: colors.ink.text.secondary },
  title: { ...typography.headingSM, color: colors.ink.text.primary },
  heroTitle: { ...typography.headingLG },
  metric: { ...typography.numericMedium, color: colors.ink.text.primary },
  secondary: { ...typography.bodySM, color: colors.ink.text.secondary },
  move: { gap: spacing[1], paddingRight: spacing[8] },
  chevron: { position: 'absolute', bottom: spacing[4], right: spacing[4] },
  rowChevron: { paddingRight: spacing[4], flexShrink: 0 },
  pressed: { opacity: 0.8 },
});
