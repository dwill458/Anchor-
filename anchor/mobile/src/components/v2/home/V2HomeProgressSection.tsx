import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography } from '@/theme/v2';
import type { HomeProgressState } from '@/adapters/v2/home';

type Props = {
  progress: HomeProgressState;
  categoryColor?: string;
  onOpenProgress?: () => void;
  testID?: string;
};

function ArrowRight({ color }: { color: string }) {
  return (
    <Svg width={17} height={11} viewBox="0 0 17 11" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M0.8 5.5H15.4M10.9 1L15.4 5.5L10.9 10" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Progress preview for the ACTIVE Anchor, built only from persisted evidence.
 *
 * Nothing here is illustrative: no sample weekdays, no example stage
 * transitions and no invented entries. Day labels are formatted from each
 * event's real timestamp in the device's local timezone. With no evidence yet
 * the section states that plainly rather than manufacturing activity, and it
 * renders no strength-derived stage, so an earned stage can never appear to
 * regress when Thread Strength falls.
 */
function V2HomeProgressSectionComponent({ progress, categoryColor, onOpenProgress, testID }: Props) {
  if (progress.state === 'none') return null;

  const accent = categoryColor ?? colors.semantic.info;

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
        {progress.state === 'ready' && progress.totalSessions > 0 ? (
          <Text testID="v2-home-progress-sessions" style={styles.sessions}>
            {progress.totalSessions + (progress.totalSessions === 1 ? ' practice' : ' practices')}
          </Text>
        ) : null}
      </View>

      {progress.state === 'empty' ? (
        <Text testID="v2-home-progress-empty" style={styles.emptyCopy}>
          Nothing recorded yet. Your first practice starts the record.
        </Text>
      ) : (
        <View style={styles.evidenceList}>
          {progress.evidence.map((item) => (
            <View key={item.id} testID={'v2-home-progress-item-' + item.id} style={styles.evidenceRow}>
              <View style={[styles.evidenceMark, { backgroundColor: accent }]} />
              <Text numberOfLines={1} style={styles.evidenceTitle}>
                {item.title}
              </Text>
              <Text style={styles.evidenceDay}>{item.dayLabel}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.link}>
        <Text style={styles.linkText}>View Progress</Text>
        <ArrowRight color={colors.graphite.text.tertiary} />
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
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: typography.bodyBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.graphite.text.tertiary,
  },
  sessions: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    color: colors.graphite.text.secondary,
  },
  evidenceList: {
    marginTop: 14,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
  },
  evidenceMark: {
    width: 5,
    height: 5,
    borderRadius: 3,
    opacity: 0.85,
  },
  evidenceTitle: {
    flex: 1,
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.graphite.text.primary,
  },
  evidenceDay: {
    fontFamily: typography.body,
    fontSize: 12,
    color: colors.graphite.text.tertiary,
  },
  emptyCopy: {
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.graphite.text.secondary,
    marginTop: 12,
    maxWidth: 300,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  linkText: {
    fontFamily: typography.bodyMedium,
    fontSize: 13.5,
    color: colors.graphite.text.secondary,
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
