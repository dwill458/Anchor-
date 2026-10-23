import React, { useState } from 'react';
import { Pencil } from 'lucide-react-native';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ChartKeyboardFrame } from './ChartKeyboardFrame';
import { ChartEyebrow } from './ChartChrome';
import { ChartRouteEditor, type DraftWaypoint } from './ChartRouteEditor';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { colors, radii, spacing } from '@/theme/v2';
import { chartTypography as typography } from './chartTypography';
import { CHART_MAP_TOKENS } from './map/chartMapTokens';

type Props = {
  destination: string;
  waypoints: DraftWaypoint[];
  oneMove: string;
  onOneMoveChange: (value: string) => void;
  onWaypointsChange: (waypoints: DraftWaypoint[]) => void;
  onEdit?: (kind: 'reorder' | 'rename' | 'remove' | 'add') => void;
  guidance?: string | null;
  needsNaming?: boolean;
  saveError?: string | null;
  saving: boolean;
  canConfirm: boolean;
  onAdjust: () => void;
  onConfirm: () => void;
  topInset: number;
  testID?: string;
};

const ROUTE_GOLD = '#B99855';
/** A direction cue only. The real etched landscape belongs to the reveal. */
export function ChartDestinationCard({ destination }: { destination: string }) {
  return (
    <View style={styles.destinationCard} testID="chart-review-destination">
      <View style={styles.destinationHeader}>
        <ChartEyebrow tone="cream">YOUR DESTINATION</ChartEyebrow>
        <Svg width={64} height={18} viewBox="0 0 64 18" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Path d="M4 13 C20 16 24 3 38 7 S50 13 60 4" fill="none" stroke={colors.border.strong} strokeWidth={1} strokeDasharray="2 3" />
          <Circle cx={4} cy={13} r={2} fill={colors.canvas} stroke={colors.text.tertiary} strokeWidth={1} />
          <Circle cx={60} cy={4} r={2.5} fill={ROUTE_GOLD} />
        </Svg>
      </View>
      <Text style={styles.destinationText}>{destination}</Text>
    </View>
  );
}

export function ChartCourseReviewScreen({
  destination,
  waypoints,
  oneMove,
  onOneMoveChange,
  onWaypointsChange,
  onEdit,
  guidance,
  needsNaming = false,
  saveError,
  saving,
  canConfirm,
  onAdjust,
  onConfirm,
  topInset,
  testID = 'chart-review-screen',
}: Props) {
  const [moveHeight, setMoveHeight] = useState(48);
  const firstNamedIndex = waypoints.findIndex((waypoint) => waypoint.title.trim());
  const waypointNumber = firstNamedIndex >= 0 ? firstNamedIndex + 1 : 1;
  const waypointTitle = firstNamedIndex >= 0 ? waypoints[firstNamedIndex].title : '';
  const onMoveContentSize = (event: { nativeEvent: { contentSize: { height: number } } }) => {
    const nextHeight = Math.ceil(event.nativeEvent.contentSize.height);
    if (Number.isFinite(nextHeight) && nextHeight > 0) setMoveHeight(Math.max(48, nextHeight));
  };

  return (
    <View style={styles.screen} testID={testID}>
      <ChartKeyboardFrame
        contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + spacing[2] }]}
        restingBottom={spacing[3]}
        footer={(
          <View style={styles.actions}>
            <V2Button variant="secondary" size="large" onPress={onAdjust} style={styles.actionHalf} testID="chart-review-adjust" accessibilityLabel={CHART_COPY.review.adjust} disabled={saving}>
              {CHART_COPY.review.adjust}
            </V2Button>
            <V2Button size="large" onPress={onConfirm} loading={saving} disabled={!canConfirm} iconRight={<Text style={styles.arrow}>→</Text>} style={styles.actionHalf} testID="chart-review-confirm" accessibilityLabel="Reveal my Chart">
              Reveal my Chart
            </V2Button>
          </View>
        )}
        footerStyle={styles.footer}
      >
        <Text accessibilityRole="header" style={styles.headline}>{CHART_COPY.review.headline.replace(/[’]/g, "'")}</Text>
        <Text style={styles.intro}>{needsNaming ? CHART_COPY.review.outline : `We found ${waypoints.length} meaningful waypoint${waypoints.length === 1 ? '' : 's'} for this destination. Keep what fits. Change what doesn't.`}</Text>
        <ChartDestinationCard destination={destination} />

        <View style={styles.oneMoveCard} testID="chart-review-one-move-card">
          <View style={styles.oneMoveHeader}>
            <View style={styles.oneMoveLabel}>
              <Text style={styles.sparkle}>✦</Text>
              <Text style={styles.oneMoveEyebrow}>YOUR FIRST MOVE THIS WEEK</Text>
            </View>
            <View style={styles.oneMoveFor}>
              <Text style={styles.oneMoveForText}>FOR WAYPOINT {waypointNumber}</Text>
            </View>
          </View>
          <Text style={styles.oneMoveExplainer}>{CHART_COPY.review.oneMoveFor(waypointTitle)}</Text>
          <View style={styles.oneMoveRow}>
            <TextInput
              value={oneMove}
              onChangeText={onOneMoveChange}
              placeholder={CHART_COPY.active.noMove}
              placeholderTextColor={colors.text.tertiary}
              maxLength={120}
              multiline
              scrollEnabled={false}
              blurOnSubmit={false}
              textAlignVertical="top"
              onContentSizeChange={onMoveContentSize}
              accessibilityLabel="Your first move"
              style={[styles.oneMoveInput, Platform.OS === 'android' && styles.androidOneMoveInput, { height: moveHeight }]}
              testID="chart-review-one-move"
            />
            <Pencil size={17} color={colors.text.secondary} style={styles.pencil} />
          </View>
        </View>

        <View style={styles.routeSection}>
          <View style={styles.routeHeader}>
            <ChartEyebrow tone="cream">YOUR ROUTE</ChartEyebrow>
            <View style={styles.routeCount} testID="chart-review-count"><Text style={styles.routeCountText}>{`${waypoints.length} waypoint${waypoints.length === 1 ? '' : 's'}`}</Text></View>
          </View>
          {guidance ? <Text style={styles.guidance}>{guidance}</Text> : null}
          <ChartRouteEditor waypoints={waypoints} onChange={onWaypointsChange} onEdit={onEdit} showRail testID="chart-route-editor" />
          {saveError ? <Text style={styles.saveError} accessibilityLiveRegion="polite">{saveError}</Text> : null}
        </View>
      </ChartKeyboardFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { paddingHorizontal: spacing[5], paddingBottom: spacing[4], gap: spacing[3] },
  headline: { ...typography.displayMedium, fontFamily: CHART_MAP_TOKENS.serif, fontSize: 34, lineHeight: 39, color: colors.text.primary },
  intro: { ...typography.bodyLG, lineHeight: 25, color: colors.text.secondary },
  destinationCard: { padding: spacing[3], gap: spacing[2], borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default, backgroundColor: colors.surface },
  destinationHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  destinationText: { ...typography.headingSM, fontFamily: CHART_MAP_TOKENS.serif, fontSize: 21, lineHeight: 27, color: colors.text.primary, flexShrink: 1 },
  oneMoveCard: { padding: spacing[4], gap: spacing[3], borderRadius: radii.xl, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default },
  oneMoveHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2] },
  oneMoveLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexBasis: 190, flexGrow: 1, flexShrink: 1 },
  oneMoveEyebrow: { ...typography.labelSM, letterSpacing: 1.1, color: colors.text.secondary, flexShrink: 1 },
  sparkle: { fontSize: 20, color: colors.semantic.warning },
  oneMoveFor: { maxWidth: '100%', paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radii.pill, backgroundColor: colors.grouped },
  oneMoveForText: { ...typography.labelSM, color: colors.text.secondary, flexShrink: 0 },
  oneMoveExplainer: { ...typography.bodyMD, lineHeight: 23, color: colors.text.secondary },
  oneMoveRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], borderWidth: 1, borderColor: colors.border.default, borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: spacing[3], backgroundColor: colors.canvas },
  oneMoveInput: { flex: 1, ...typography.bodyLG, lineHeight: 25, color: colors.text.primary, minHeight: 48, padding: 0, margin: 0 },
  androidOneMoveInput: { includeFontPadding: false },
  pencil: { marginBottom: 3 },
  routeSection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.default, paddingTop: spacing[3] },
  routeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] },
  routeCount: { paddingHorizontal: spacing[3], paddingVertical: 5, borderRadius: radii.pill, backgroundColor: colors.grouped },
  routeCountText: { ...typography.labelMD, color: colors.text.secondary },
  guidance: { ...typography.bodyMD, lineHeight: 23, color: colors.text.secondary, marginBottom: spacing[2] },
  saveError: { ...typography.bodySM, color: colors.semantic.error, marginTop: spacing[2] },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.subtle, backgroundColor: colors.canvas },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], paddingHorizontal: spacing[5], paddingTop: spacing[3] },
  actionHalf: { flexGrow: 1, flexBasis: 150, paddingHorizontal: spacing[2] },
  arrow: { fontSize: 20, lineHeight: 20, color: colors.text.inverse },
});
