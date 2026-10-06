import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { V2Button } from '@/components/v2';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT } from '@/components/v2/primitives/V2SheetModal';
import { useV2ReduceMotion } from '@/hooks/v2';
import type { V2ProgressRouteSummary, V2ThreadEventItem } from '@/adapters/v2/progress/types';
import { progressTokens } from './progressTokens';

export interface V2ThreadEventDetailSheetProps {
  event: V2ThreadEventItem | null;
  /** The live route, to resolve the waypoint an event belongs to. */
  route?: V2ProgressRouteSummary | null;
  visible: boolean;
  onClose: () => void;
  testID?: string;
}

export const V2ThreadEventDetailSheet: React.FC<V2ThreadEventDetailSheetProps> = ({
  event,
  route,
  visible,
  onClose,
  testID = 'v2-thread-event-detail-sheet',
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useV2ReduceMotion();
  // Keep the last event while the sheet slides away, so its content does not vanish mid-exit.
  const lastEvent = useRef<V2ThreadEventItem | null>(event);
  if (event) lastEvent.current = event;
  const shown = event ?? lastEvent.current;
  if (!shown) return null;

  const range = shown.authoritativeThreadRange;
  const waypoint = shown.waypointId ? route?.waypoints.find((w) => w.id === shown.waypointId) ?? null : null;

  return (
    <V2SheetModal
      visible={visible && !!event}
      onClose={onClose}
      reduceMotion={reduceMotion}
      scrimAccessibilityLabel="Close event details"
      testID={testID}
    >
      <View style={[styles.sheet, { paddingBottom: spacing[7] + V2_SHEET_SKIRT + insets.bottom }]}>
        <V2SheetGrabZone>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{shown.title}</Text>
              <Text style={styles.timestamp}>
                {shown.formattedDate}
                {shown.formattedTime ? ` · ${shown.formattedTime}` : ''}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              testID={`${testID}-close`}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={20} color={colors.text.secondary} />
            </Pressable>
          </View>
        </V2SheetGrabZone>

        <Text style={styles.copy}>{shown.copy}</Text>

        {shown.note ? (
          <View style={styles.note} testID={`${testID}-note`}>
            <Text style={styles.noteText}>{`“${shown.note}”`}</Text>
          </View>
        ) : null}

        {waypoint?.metric ? (
          <View style={styles.fact} testID={`${testID}-progress`}>
            <View style={styles.factRow}>
              <Text style={styles.factLabel}>Progress</Text>
              <Text style={styles.factValue}>{waypoint.metric.display}</Text>
            </View>
            <View style={styles.progressRow}>
              <View style={styles.track}>
                {waypoint.metric.fraction !== null ? (
                  <View style={[styles.fill, { width: `${Math.max(4, Math.round(waypoint.metric.fraction * 100))}%` }]} />
                ) : null}
              </View>
              {waypoint.metric.percentLabel ? <Text style={styles.percent}>{waypoint.metric.percentLabel}</Text> : null}
            </View>
          </View>
        ) : null}

        {waypoint && route ? (
          <View style={[styles.fact, styles.factRow]} testID={`${testID}-waypoint`}>
            <Text style={styles.factLabel}>Related waypoint</Text>
            <Text style={styles.factValue}>{`Waypoint ${waypoint.number} of ${route.total}`}</Text>
          </View>
        ) : null}

        {/* Thread Strength movement is shown only when the practice record persisted it. */}
        {range ? (
          <View style={styles.range} testID={`${testID}-range`}>
            <Text style={styles.rangeValue}>{range[0]}</Text>
            <ArrowRight size={22} color={colors.text.secondary} />
            <Text style={styles.rangeValue}>{range[1]}</Text>
            <Text style={styles.rangeNote}>Thread Strength, from the practice record</Text>
          </View>
        ) : shown.authoritativeDelta !== null ? (
          <Text style={styles.deltaValue}>
            {shown.authoritativeDelta > 0 ? `+${shown.authoritativeDelta}` : shown.authoritativeDelta}
          </Text>
        ) : null}

        {!shown.note && !waypoint ? (
          <View style={styles.why}>
            <Text style={styles.whyLabel}>Why this is here</Text>
            <Text style={styles.whyText}>{shown.why}</Text>
          </View>
        ) : null}

        <V2Button variant="tertiary" onPress={onClose} testID={`${testID}-done-btn`}>
          Close
        </V2Button>
      </View>
    </V2SheetModal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: 22,
    paddingTop: spacing[3],
    // The surface continues below the screen edge so the entrance spring's overshoot never opens a gap.
    marginBottom: -V2_SHEET_SKIRT,
    flexShrink: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.default,
    marginBottom: 14,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: spacing.md },
  titleBlock: { flex: 1 },
  closeButton: { padding: 4 },
  timestamp: { ...typography.caption, color: progressTokens.muted, marginTop: 3 },
  title: {
    fontFamily: progressTokens.serif,
    fontSize: 22,
    lineHeight: 27,
    color: progressTokens.text,
  },
  note: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radii.md,
    backgroundColor: progressTokens.card,
    borderWidth: 1,
    borderColor: progressTokens.cardBorder,
  },
  noteText: { ...typography.bodyMD, color: progressTokens.text },
  fact: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: progressTokens.hairline },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  factLabel: { ...typography.labelMD, color: progressTokens.text },
  factValue: { ...typography.bodySM, color: progressTokens.muted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: progressTokens.inkWash(0.1) },
  fill: { height: '100%', borderRadius: 3, backgroundColor: progressTokens.current },
  percent: { ...typography.labelMD, fontSize: 11, color: progressTokens.muted },
  copy: { ...typography.bodyMD, color: progressTokens.muted },
  range: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  rangeValue: { fontFamily: progressTokens.serif, fontSize: 26, lineHeight: 30, color: progressTokens.text },
  rangeNote: { ...typography.caption, color: progressTokens.muted },
  deltaValue: { ...typography.numericMedium, color: progressTokens.text, marginTop: 14 },
  why: {
    marginTop: 16,
    padding: 14,
    borderRadius: radii.md,
    backgroundColor: progressTokens.card,
    borderWidth: 1,
    borderColor: progressTokens.cardBorder,
  },
  whyLabel: { ...typography.labelSM, fontSize: 10, letterSpacing: 1.2, color: progressTokens.muted },
  whyText: { ...typography.bodyMD, color: progressTokens.text, marginTop: 5 },
});
