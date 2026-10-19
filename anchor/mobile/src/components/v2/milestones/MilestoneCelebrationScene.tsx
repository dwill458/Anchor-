import React, { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { colors, spacing, typography } from '@/theme/v2';
import { progressTokens } from '@/components/v2/progress/progressTokens';
import { playCreationSound } from '@/services/CreationSounds';
import { v2Haptics } from '@/hooks/v2/haptics';
import { FAMILY_LABEL, describeEarnedValue, getMilestoneSpec } from '@/milestones/registry';
import type { MilestoneRecord } from '@/milestones/milestoneModel';
import { MilestoneArtwork } from './MilestoneArtwork';

export interface MilestoneCelebrationSceneProps {
  record: MilestoneRecord;
  /** `replay` is the same scene in non-awarding mode: it only labels itself differently. */
  mode: 'award' | 'replay';
  categoryColor?: string;
  reducedMotion?: boolean;
  onContinue: () => void;
  testID?: string;
}

const ART_SIZE = 240;

export function formatEarnedDate(iso: string): string | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * One shared celebration structure for every milestone: the artwork arrives (bloom, engrave or
 * rise, per the registry), then the title and what was accomplished, with one haptic and one
 * sound accent. Reduce Motion lands on the settled state with a short fade. The scene never
 * awards, writes or settles anything itself: the presenter does that when the user continues.
 */
export const MilestoneCelebrationScene: React.FC<MilestoneCelebrationSceneProps> = ({
  record,
  mode,
  categoryColor,
  reducedMotion = false,
  onContinue,
  testID = 'milestone-celebration',
}) => {
  const spec = getMilestoneSpec(record.definitionId);
  const art = useSharedValue(reducedMotion ? 1 : 0);
  const copy = useSharedValue(reducedMotion ? 1 : 0);
  const cued = useRef(false);

  useEffect(() => {
    if (!spec) return;
    if (reducedMotion) {
      art.value = withTiming(1, { duration: 160 });
      copy.value = withTiming(1, { duration: 160 });
    } else {
      art.value = withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) });
      copy.value = withDelay(520, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    }
    // One haptic and one sound per presentation, even if the effect re-runs.
    if (!cued.current) {
      cued.current = true;
      v2Haptics[spec.haptic]();
      playCreationSound(spec.sound);
    }
  }, [art, copy, reducedMotion, spec]);

  const reveal = spec?.celebration.reveal ?? 'bloom';
  const artStyle = useAnimatedStyle(() => ({
    opacity: art.value,
    transform:
      reducedMotion || reveal === 'bloom'
        ? [{ scale: reducedMotion ? 1 : 0.86 + 0.14 * art.value }]
        : [{ translateY: (reveal === 'rise' ? 24 : 8) * (1 - art.value) }],
  }));
  const copyStyle = useAnimatedStyle(() => ({ opacity: copy.value, transform: [{ translateY: 8 * (1 - copy.value) }] }));

  if (!spec) return null;
  const date = formatEarnedDate(record.earnedAt);
  const value = describeEarnedValue(spec, record.metadata);

  return (
    <Modal visible transparent animationType={reducedMotion ? 'fade' : 'none'} onRequestClose={onContinue} testID={testID}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onContinue}
          hitSlop={12}
          style={styles.close}
          testID={`${testID}-close`}
        >
          <X size={20} color={colors.cream} />
        </Pressable>

        <Text style={styles.eyebrow}>{mode === 'replay' ? 'REPLAY' : 'MILESTONE'} · {FAMILY_LABEL[spec.family].toUpperCase()}</Text>

        <Animated.View style={[styles.art, artStyle]} testID={`${testID}-art`}>
          <MilestoneArtwork definitionId={spec.id} state="earned" size={ART_SIZE} categoryColor={categoryColor} />
        </Animated.View>

        <Animated.View style={[styles.copy, copyStyle]}>
          <Text accessibilityRole="header" style={styles.title} testID={`${testID}-title`}>
            {spec.title}
          </Text>
          <Text style={styles.description}>{spec.description}</Text>
          {value ? <Text style={styles.value}>{value}</Text> : null}
          {date ? <Text style={styles.value}>{mode === 'replay' ? `Earned ${date}` : date}</Text> : null}
          {mode === 'replay' ? <Text style={styles.note}>Replaying doesn’t change your progress.</Text> : null}
        </Animated.View>

        <V2Button size="large" onPress={onContinue} testID={`${testID}-continue`}>
          Continue
        </V2Button>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[5],
    paddingHorizontal: spacing[6],
    backgroundColor: colors.ink.base,
  },
  close: { position: 'absolute', top: spacing[8], right: spacing[5], minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { ...typography.labelSM, letterSpacing: 1.6, color: progressTokens.heroMuted },
  art: { width: ART_SIZE, height: ART_SIZE },
  copy: { alignItems: 'center', gap: spacing[2] },
  title: { fontFamily: progressTokens.serif, fontSize: 30, lineHeight: 36, color: progressTokens.heroText, textAlign: 'center' },
  description: { ...typography.bodyMD, color: progressTokens.heroMuted, textAlign: 'center' },
  value: { ...typography.bodySM, color: progressTokens.heroFaint, textAlign: 'center' },
  note: { ...typography.caption, color: progressTokens.heroFaint, textAlign: 'center', marginTop: spacing[1] },
});
