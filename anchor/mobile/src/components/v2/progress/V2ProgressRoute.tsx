import React from 'react';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, typography } from '@/theme/v2';
import { V2SectionHeader } from '@/components/v2/primitives';
import { ChartMapCrop } from '@/components/chart/ChartMapCrop';
import type { V2ProgressRouteSummary } from '@/adapters/v2/progress/types';
import { progressTokens } from './progressTokens';

export interface V2ProgressRouteProps {
  route: V2ProgressRouteSummary;
  /** Drop the "Your route" header when the card sits inside another section. */
  hideHeader?: boolean;
  compact?: boolean;
  hidePreview?: boolean;
  /** Tints the etched map the way the Chart does. */
  category?: string | null;
  /** Opens the Chart. When absent the card is not tappable. */
  onOpenChart?: () => void;
  testID?: string;
}

/**
 * Your route: a miniature of the Anchor's own Chart. The map is the same etched
 * map the Chart draws (paper, terrain, brush route, dotted way ahead, waypoint
 * markers), cropped around the current waypoint. The figures come from the
 * current waypoint's measure; with none recorded the card shows no number.
 */
export const V2ProgressRoute: React.FC<V2ProgressRouteProps> = ({
  route,
  hideHeader = false,
  compact = false,
  hidePreview = false,
  category,
  onOpenChart,
  testID = 'v2-progress-route',
}) => {
  const position = Math.min(route.total, route.currentIndex + 1);
  const metric = route.currentMetric;
  const ahead = Math.max(0, route.total - route.reachedCount - (route.isFinished ? 0 : 1));
  const caption = `${route.reachedCount} reached · ${ahead} ahead`;
  const eyebrow = route.isFinished ? 'DESTINATION REACHED' : `WAYPOINT ${position} OF ${route.total}`;
  const fraction = metric?.fraction ?? null;

  const preview = (
      <View style={[styles.map, compact && styles.compactMap]} testID={`${testID}-map`}>
        <ChartMapCrop
          full={false}
          height={compact ? 80 : undefined}
          initialWidth={compact ? 96 : undefined}
          data={{
            category: category ?? null,
            status: route.isFinished ? 'complete' : 'active',
            waypointIndex: position,
            waypointTotal: route.total,
            title: route.currentTitle,
          }}
        />
      </View>
  );

  const body = (
    <View style={[styles.card, compact && styles.compact]}>
      {compact && !hidePreview ? preview : null}
      <View style={[styles.head, compact && styles.compactHead]}>
        <View style={styles.headCopy}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title} numberOfLines={compact ? undefined : 2}>
            {route.currentTitle}
          </Text>
        </View>
        {metric ? (
          <View style={[styles.metric, compact && styles.compactMetric]} testID={`${testID}-metric`}>
            <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
              {metric.display}
            </Text>
            <View style={styles.metricRow}>
              <View style={styles.track}>
                {fraction !== null ? (
                  <View style={[styles.fill, { width: `${Math.max(4, Math.round(fraction * 100))}%` }]} />
                ) : null}
              </View>
              {metric.percentLabel ? <Text style={styles.percent}>{metric.percentLabel}</Text> : null}
            </View>
          </View>
        ) : null}
      </View>


      {!compact ? preview : null}
      {compact && onOpenChart ? <ChevronRight size={16} color={progressTokens.muted} /> : null}
    </View>
  );

  return (
    <View style={styles.container} testID={testID}>
      {hideHeader ? null : (
        <V2SectionHeader title="Your route" actionLabel={onOpenChart ? 'Open Chart' : undefined} onActionPress={onOpenChart} />
      )}
      {onOpenChart ? (
        <Pressable
          onPress={onOpenChart}
          accessibilityRole="button"
          accessibilityLabel={`Open Chart. ${eyebrow.toLowerCase()}: ${route.currentTitle}.${metric ? ` ${metric.display}${metric.percentLabel ? `, ${metric.percentLabel}` : ''}.` : ''} ${caption}`}
          testID={`${testID}-card`}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 11 },
  card: {
    backgroundColor: progressTokens.card,
    borderWidth: 1,
    borderColor: progressTokens.cardBorder,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  compact: { flexDirection: 'row', alignItems: 'center', borderWidth: 0, borderRadius: 0, gap: 12 },
  compactHead: { flex: 1, padding: 0, flexDirection: 'column', gap: 6 },
  compactMap: { width: 96, height: 80, borderRadius: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16, paddingBottom: 12 },
  headCopy: { flex: 1, minWidth: 0 },
  eyebrow: { ...typography.labelSM, fontSize: 10, letterSpacing: 1.2, color: progressTokens.muted },
  title: { fontFamily: progressTokens.serif, fontSize: 18, lineHeight: 23, color: progressTokens.text, marginTop: 4 },
  metric: { alignItems: 'flex-end', maxWidth: '44%' },
  compactMetric: { alignItems: 'flex-start', maxWidth: '100%', flexShrink: 1 },
  metricValue: { fontFamily: progressTokens.serif, fontSize: 18, lineHeight: 23, color: progressTokens.text },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 },
  track: {
    width: 74,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: progressTokens.inkWash(0.1),
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: progressTokens.current },
  percent: { ...typography.labelMD, fontSize: 11, color: progressTokens.muted },
  map: { overflow: 'hidden' },
});
