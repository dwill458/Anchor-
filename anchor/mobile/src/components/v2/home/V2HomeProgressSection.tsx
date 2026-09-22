import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography } from '@/theme/v2';
import type { HomeProgressState, V2ThreadPresentation } from '@/adapters/v2/home';
import { threadQualitativeLabel } from '@/adapters/v2/home/threadAdapter';
import { ThreadStrength } from '@/components/v2/thread';

type Props = {
  progress: HomeProgressState;
  thread?: V2ThreadPresentation | null;
  categoryColor?: string;
  onOpenProgress?: () => void;
  testID?: string;
};

function ChevronRight({ color }: { color: string }) {
  return (
    <Svg width={7} height={12} viewBox="0 0 7 12" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M1 1L6 6L1 11" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** The small bar mark beside the PROGRESS eyebrow. */
function BarsMark({ color }: { color: string }) {
  return (
    <Svg width={11} height={10} viewBox="0 0 11 10" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M1 9.25H10M2.5 7.5V5.5M5.5 7.5V1.5M8.5 7.5V3.5" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * The unwoven strands past the percentage point. The Details defaults are
 * tuned for cream and all but disappear on graphite, so this surface lifts
 * them to a cool grey that reads as "not yet" without competing with the
 * woven, category-coloured part.
 */
const INACTIVE_STRAND = '#8C97AD';
const INACTIVE_STRAND_OPACITY = 0.42;
const THREAD_HEIGHT = 44;

/**
 * Progress preview for the ACTIVE Anchor, built only from persisted evidence.
 *
 * The thread is the same `ThreadStrength` visualization Anchor Details uses —
 * same strands, same reveal, same real value — with its own metrics row turned
 * off because this section prints the value above it. Evidence itself lives
 * one tap away in Progress, and practice history in Recent Activity below, so
 * the preview carries only the count. With no evidence yet the section states
 * that plainly rather than manufacturing activity.
 */
function V2HomeProgressSectionComponent({ progress, thread, categoryColor, onOpenProgress, testID }: Props) {
  if (progress.state === 'none') return null;

  const accent = categoryColor ?? colors.semantic.info;
  const measured = thread ? thread.value !== null : false;

  return (
    <Pressable
      testID={testID ?? 'v2-home-progress'}
      accessibilityRole="button"
      accessibilityLabel="Open Progress"
      onPress={onOpenProgress}
      disabled={!onOpenProgress}
      style={({ pressed }) => [styles.container, pressed && onOpenProgress ? styles.pressed : null]}
    >
      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>PROGRESS</Text>
        <BarsMark color={colors.graphite.text.tertiary} />
      </View>

      {thread ? <>
        <View style={styles.strengthRow}>
          <Text testID="v2-home-progress-strength" style={styles.strengthValue}>{measured ? `${thread.value}%` : '—'}</Text>
          <View style={styles.strengthDash} />
          <Text style={styles.strengthStatus}>{measured ? threadQualitativeLabel(thread.value as number, thread.unmeasured) : 'Not established yet'}</Text>
        </View>
        <ThreadStrength
          testID="v2-home-progress-thread"
          percent={measured ? (thread.value as number) : 0}
          color={accent}
          showMetrics={false}
          showDelta={false}
          inactiveColor={INACTIVE_STRAND}
          inactiveOpacity={INACTIVE_STRAND_OPACITY}
          height={THREAD_HEIGHT}
          style={styles.thread}
        />
      </> : null}

      <View style={styles.footerRow}>
        {progress.state === 'ready' && progress.totalSessions > 0 ? (
          <Text testID="v2-home-progress-sessions" style={styles.footerCopy}>
            {progress.totalSessions + (progress.totalSessions === 1 ? ' practice' : ' practices')}
          </Text>
        ) : (
          <Text testID={progress.state === 'empty' ? 'v2-home-progress-empty' : undefined} style={styles.footerCopy}>
            {progress.state === 'empty' ? 'Nothing recorded yet. ' : ''}Your first practice starts the record.
          </Text>
        )}
        <View style={styles.chevron}>
          <ChevronRight color={colors.graphite.text.secondary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.graphite.hairline,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kicker: {
    fontFamily: typography.bodyBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.graphite.text.tertiary,
  },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  strengthValue: {
    fontFamily: 'EBGaramond-Medium',
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.5,
    color: colors.graphite.text.primary,
    fontVariant: ['tabular-nums'],
  },
  strengthDash: { width: 14, height: 1, backgroundColor: colors.graphite.text.secondary, marginTop: 3 },
  strengthStatus: { fontFamily: typography.body, fontSize: 13, lineHeight: 18, color: colors.graphite.text.secondary, marginTop: 3 },
  thread: { marginTop: 6 },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 8,
  },
  footerCopy: {
    flex: 1,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.graphite.text.secondary,
  },
  chevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.graphite.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
});

/**
 * Memoised. Switching the Home Anchor re-renders this screen twice - once on
 * selection and again when Today's recommendation settles - and most of these
 * sections do not depend on Today at all. With stable props from V2HomeScreen
 * they now render only when their own data actually changes.
 */
export const V2HomeProgressSection = memo(V2HomeProgressSectionComponent);
