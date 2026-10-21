import React, { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ViewInstance } from 'react-native';
import Animated from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { colors, spacing, typography } from '@/theme/v2';
import { progressTokens } from '@/components/v2/progress/progressTokens';
import { FAMILY_LABEL, describeEarnedValue, getMilestoneSpec } from '@/milestones/registry';
import type { MilestoneRecord } from '@/milestones/milestoneModel';
import { MilestoneArtwork } from './MilestoneArtwork';
import { useMilestoneReveal } from './useMilestoneReveal';
import { MilestoneLightStream } from './MilestoneLightStream';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface MilestoneCelebrationSceneProps {
  record: MilestoneRecord;
  /** `replay` is the same scene in non-awarding mode: it only labels itself differently. */
  mode: 'award' | 'replay';
  categoryColor?: string;
  reducedMotion?: boolean;
  onContinue: () => void;
  onBackToMilestones?: () => void;
  transition?: boolean;
  origin?: { x: number; y: number };
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
  onBackToMilestones,
  transition = mode === 'award',
  origin,
  testID = 'milestone-celebration',
}) => {
  const spec = getMilestoneSpec(record.definitionId);
  const { progress, travel, fieldStyle, artStyle, copyStyle, settled, reducedEarnedStyle, reducedLockedStyle } = useMilestoneReveal(spec, reducedMotion, transition);
  const { width, height } = useWindowDimensions();
  const artRef = useRef<ViewInstance>(null);
  const [target, setTarget] = useState<{ x: number; y: number }>();
  const insets = useSafeAreaInsets();
  const finished = useRef(false);
  const finish = () => { if (!finished.current) { finished.current = true; onContinue(); } };
  const continuePresentation = () => {
    if (finished.current) return;
    finish();
    if (mode === 'replay') onBackToMilestones?.();
  };

  if (!spec) return null;
  const date = formatEarnedDate(record.earnedAt);
  const value = describeEarnedValue(spec, record.metadata);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={finish} testID={testID}>
      <View style={styles.overlay} accessibilityViewIsModal>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.field, fieldStyle]} />
        {!reducedMotion && !settled && origin && target ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <MilestoneLightStream progress={travel} source={origin} target={target} width={width} height={height} />
        </View> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={finish}
          hitSlop={12}
          style={[styles.close, { top: insets.top + spacing[2] }]}
          testID={`${testID}-close`}
        >
          <X size={20} color={colors.cream} />
        </Pressable>

        <ScrollView style={styles.scroll} contentContainerStyle={[styles.presentation, { paddingTop: insets.top + spacing[8], paddingBottom: insets.bottom + spacing[6] }]} showsVerticalScrollIndicator={false}>
        <Animated.Text style={[styles.eyebrow, copyStyle]}>{mode === 'replay' ? 'REPLAY' : 'MILESTONE'} · {FAMILY_LABEL[spec.family].toUpperCase()}</Animated.Text>

        <Animated.View ref={artRef} onLayout={() => artRef.current?.measureInWindow?.((x, y, w, h) => { if (w > 0) setTarget({ x: x + w / 2, y: y + h / 2 }); })} style={[styles.art, artStyle]} testID={`${testID}-art`}>
          {!reducedMotion && !settled && !origin ? <View style={styles.stream}><MilestoneLightStream progress={progress} /></View> : null}
          {reducedMotion && !settled ? <>
            <Animated.View style={[StyleSheet.absoluteFill, reducedLockedStyle]}><MilestoneArtwork definitionId={spec.id} state="locked" size={ART_SIZE} /></Animated.View>
            <Animated.View style={reducedEarnedStyle}><MilestoneArtwork definitionId={spec.id} state="earned" size={ART_SIZE} /></Animated.View>
          </> : <MilestoneArtwork definitionId={spec.id} state="earned" size={ART_SIZE} categoryColor={categoryColor} animated={!settled} progress={progress} reducedMotion={reducedMotion} />}
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

        <Animated.View style={copyStyle}>
          <V2Button size="large" onPress={continuePresentation} testID={`${testID}-continue`}>
            {mode === 'replay' ? 'Back to Milestones' : 'Continue'}
          </V2Button>
        </Animated.View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  scroll: { flex: 1 },
  presentation: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[5],
    paddingHorizontal: spacing[6],
  },
  field: { backgroundColor: colors.ink.base },
  stream: { position: 'absolute', left: -30, top: -30 },
  close: { position: 'absolute', zIndex: 1, top: spacing[8], right: spacing[5], minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { ...typography.labelSM, letterSpacing: 1.6, color: progressTokens.heroMuted },
  art: { width: ART_SIZE, height: ART_SIZE },
  copy: { alignItems: 'center', gap: spacing[2] },
  title: { fontFamily: progressTokens.serif, fontSize: 30, lineHeight: 36, color: progressTokens.heroText, textAlign: 'center' },
  description: { ...typography.bodyMD, color: progressTokens.heroMuted, textAlign: 'center' },
  value: { ...typography.bodySM, color: progressTokens.heroFaint, textAlign: 'center' },
  note: { ...typography.caption, color: progressTokens.heroFaint, textAlign: 'center', marginTop: spacing[1] },
});
