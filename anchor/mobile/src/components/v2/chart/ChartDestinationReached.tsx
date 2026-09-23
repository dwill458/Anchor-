import React, { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ArrowRight, Wind } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { VisionPhoto } from '@/components/v2/vision/VisionPhoto';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { formatJourneyDate, type ChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { ChartCreamPanel, ChartEyebrow, ChartInkScreen, ChartTopBar, type ChartIdentity } from './ChartChrome';
import type { ChartVisionPreview } from './ChartActiveView';
import { ChartLandscape, type ChartAnchorArt, type ChartMarker } from './ChartLandscape';
import { CHART_WINDOWS } from './chartRouteGeometry';

type Props = {
  view: ChartViewModel;
  identity: ChartIdentity;
  anchorArt: ChartAnchorArt | null;
  vision: ChartVisionPreview | null;
  released: boolean;
  reducedMotion: boolean;
  onBack: () => void;
  onViewJourney: () => void;
  onRelease: () => void;
  testID?: string;
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

export function ChartDestinationReached({
  view,
  identity,
  anchorArt,
  vision,
  released,
  reducedMotion,
  onBack,
  onViewJourney,
  onRelease,
  testID,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const resolve = useSharedValue(reducedMotion ? 1 : 0);
  const travelled = useSharedValue(1);

  useEffect(() => {
    if (!reducedMotion) resolve.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) });
  }, [reducedMotion, resolve]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + resolve.value * 0.65,
    transform: [{ scale: 1.04 - resolve.value * 0.04 }],
  }));

  const markers: ChartMarker[] = useMemo(
    () =>
      view.waypoints.map((waypoint) => ({
        id: waypoint.id,
        number: waypoint.number,
        state: 'completed' as const,
        accessibilityLabel: waypoint.accessibilityLabel,
      })),
    [view.waypoints]
  );

  const heroHeight = Math.round(height * 0.46);
  const title = 'Destination reached';

  return (
    <ChartInkScreen testID={testID ?? 'chart-destination-reached'}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing[6] }} showsVerticalScrollIndicator={false}>
        {vision?.imageUrl ? (
          <View style={{ height: heroHeight }}>
            <Animated.View style={[StyleSheet.absoluteFill, heroStyle]}>
              {/* The person's own Vision is the hero: never tinted, never replaced by category art. */}
              <VisionPhoto source={vision.imageUrl} scrim="both" bottomScrimColor={colors.ink.base} style={StyleSheet.absoluteFill} testID="chart-reached-vision" />
            </Animated.View>
            <View style={styles.headerOverlay}>
              <ChartTopBar title={title} onBack={onBack} />
            </View>
            <View style={styles.heroCopy} accessibilityLiveRegion="polite">
              <ChartEyebrow color="#F2E6CB">{CHART_COPY.labels.destinationReached}</ChartEyebrow>
              <Text accessibilityRole="header" style={styles.headline}>
                {CHART_COPY.reached.destinationHeadline}
              </Text>
              <Text style={styles.support}>{CHART_COPY.reached.destinationSupport}</Text>
            </View>
          </View>
        ) : (
          <>
            <ChartTopBar title={title} onBack={onBack} />
            {/* No Vision: the fully travelled route is the record — never a stand-in photo. */}
            <Animated.View style={heroStyle}>
              <ChartLandscape
                width={width}
                category={identity.category}
                window={CHART_WINDOWS.hero}
                markers={markers}
                travelled={travelled}
                anchorArt={anchorArt}
                scrimTop
                scrimBottom={colors.ink.base}
                accessibilityLabel={`Every waypoint reached. Destination: ${view.destination}`}
              />
            </Animated.View>
            <View style={styles.stackedCopy} accessibilityLiveRegion="polite">
              <ChartEyebrow color="#F2E6CB">{CHART_COPY.labels.destinationReached}</ChartEyebrow>
              <Text accessibilityRole="header" style={styles.headline}>
                {CHART_COPY.reached.destinationHeadline}
              </Text>
            </View>
          </>
        )}

        <ChartCreamPanel style={styles.panel}>
          <Text style={styles.destination}>{view.destination}</Text>
          <View style={styles.rows}>
            {journeyRows(view).map((row) => (
              <View key={row.label} style={styles.row} accessible accessibilityLabel={`${row.label}: ${row.value}`}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            ))}
          </View>
          <V2Button
            size="large"
            onPress={onViewJourney}
            iconRight={<ArrowRight size={18} color={colors.text.inverse} />}
            testID="chart-view-journey"
            accessibilityLabel={CHART_COPY.reached.viewJourney}
          >
            {CHART_COPY.reached.viewJourney}
          </V2Button>
          {!released ? (
            <V2Button
              variant="secondary"
              size="large"
              onPress={onRelease}
              iconLeft={<Wind size={18} color={colors.text.primary} />}
              testID="chart-release-anchor"
              accessibilityLabel={CHART_COPY.reached.release}
              style={styles.release}
            >
              {CHART_COPY.reached.release}
            </V2Button>
          ) : null}
        </ChartCreamPanel>
      </ScrollView>
    </ChartInkScreen>
  );
}

const styles = StyleSheet.create({
  headerOverlay: { position: 'absolute', left: 0, right: 0, top: 0 },
  stackedCopy: { paddingHorizontal: spacing[5], gap: spacing[2], marginTop: -spacing[4], marginBottom: spacing[2] },
  heroCopy: { position: 'absolute', left: spacing[5], right: spacing[5], bottom: spacing[5], gap: spacing[2] },
  headline: { ...typography.displayMedium, fontSize: 36, lineHeight: 40, color: colors.ink.text.primary },
  support: { ...typography.bodyLG, color: colors.ink.text.primary },
  panel: { borderRadius: radii.xl, marginHorizontal: spacing[4], marginTop: spacing[2], paddingBottom: spacing[5], gap: spacing[3] },
  destination: { ...typography.headingMD, color: colors.text.primary },
  rows: { gap: 0, marginBottom: spacing[2] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  rowLabel: { ...typography.bodyMD, color: colors.text.secondary },
  rowValue: { ...typography.labelLG, color: colors.text.primary },
  release: { marginTop: 0 },
});
