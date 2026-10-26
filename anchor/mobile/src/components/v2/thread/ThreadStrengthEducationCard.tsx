import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { useTeachingStore } from '@/stores/teachingStore';
import { THREAD_STRENGTH_EDUCATION_COPY, getLevelProgress } from '@/constants/v2/threadStrengthCopy';

/**
 * One-time education after the user's first completed practice. Shown on Anchor Details (never during
 * the completion scene) once the scene has flagged it, and only for an established Strength.
 */
export function useThreadStrengthEducation(strength: number | null | undefined): { visible: boolean; dismiss: () => void } {
  const pending = useTeachingStore(state => state.userFlags.threadStrengthEducationPending);
  const seen = useTeachingStore(state => state.userFlags.hasSeenThreadStrengthEducation);
  const established = typeof strength === 'number' && Number.isFinite(strength);
  const dismiss = React.useCallback(() => {
    const store = useTeachingStore.getState();
    store.setUserFlag('hasSeenThreadStrengthEducation', true);
    store.setUserFlag('threadStrengthEducationPending', false);
  }, []);
  return { visible: pending && !seen && established, dismiss };
}

export interface ThreadStrengthEducationCardProps {
  strength: number;
  accentColor?: string;
  onDismiss: () => void;
  onLearnMore?: () => void;
  testID?: string;
}

export function ThreadStrengthEducationCard({
  strength,
  accentColor = colors.text.primary,
  onDismiss,
  onLearnMore,
  testID = 'thread-strength-education',
}: ThreadStrengthEducationCardProps) {
  const value = Math.min(100, Math.max(0, Math.round(strength)));
  const { level } = getLevelProgress(value);
  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]} testID={testID} accessibilityRole="summary">
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>{THREAD_STRENGTH_EDUCATION_COPY.title}</Text>
        <Text style={styles.body}>{THREAD_STRENGTH_EDUCATION_COPY.body}</Text>
        <Text style={styles.support}>
          {THREAD_STRENGTH_EDUCATION_COPY.support} Thread Strength is now {value}, {level}.
        </Text>
        {onLearnMore ? (
          <Pressable
            accessibilityRole="button"
            onPress={onLearnMore}
            hitSlop={{ top: 8, bottom: 8, right: 12 }}
            style={styles.learn}
            testID={`${testID}-learn`}
          >
            <Text style={styles.learnText}>How Thread Strength works</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.dismiss}
        testID={`${testID}-dismiss`}
      >
        <Text style={styles.dismissText}>Got it</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    marginBottom: spacing[3],
    padding: spacing[4],
    borderRadius: radii.lg,
    borderLeftWidth: 3,
    backgroundColor: colors.grouped,
  },
  copy: { flex: 1, gap: spacing[1] },
  title: { fontFamily: 'EBGaramond-Medium', fontSize: 20, lineHeight: 24, color: colors.text.primary },
  body: { ...typography.bodySM, color: colors.text.primary },
  support: { ...typography.caption, color: colors.text.secondary },
  learn: { minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
  learnText: { ...typography.bodySM, color: colors.text.secondary, textDecorationLine: 'underline' },
  dismiss: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  dismissText: { ...typography.labelMD, color: colors.text.primary },
});
