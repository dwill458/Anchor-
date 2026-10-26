import { beginGuidanceAction } from '@/hooks/v2/guidance/guidanceActions';
import { discoverGuidance } from '@/hooks/v2/guidance/guidanceRuntime';
import { useAuthStore } from '@/stores/authStore';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT } from '@/components/v2/primitives/V2SheetModal';
import { useV2ReduceMotion } from '@/hooks/v2';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { THREAD_STRENGTH_LEVELS } from '@/constants/v2/threadEvents';
import {
  THREAD_STRENGTH_DECAY_COPY,
  THREAD_STRENGTH_EXPLAINER_COPY,
  THREAD_STRENGTH_RULES,
  THREAD_STRENGTH_SENSITIVITY_LABEL,
  getLevelProgress,
  normalizeSensitivity,
} from '@/constants/v2/threadStrengthCopy';

export interface ThreadStrengthExplainerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The authoritative value the screen already shows. null/undefined when not yet established. */
  strength?: number | null;
  /** Category accent used for the current level; falls back to ink. */
  accentColor?: string;
  testID?: string;
}

const RULES = THREAD_STRENGTH_RULES;

/**
 * One reusable explanation of Thread Strength, opened from Anchor Details and Progress. It only
 * reads values (strength, the user's decay setting); it never computes or changes Strength.
 */
export function ThreadStrengthExplainerSheet({
  visible,
  onClose,
  strength,
  accentColor = colors.text.primary,
  testID = 'thread-strength-explainer-sheet',
}: ThreadStrengthExplainerSheetProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useV2ReduceMotion();
  const sensitivity = normalizeSensitivity(useSettingsStore(state => state.threadStrengthSensitivity));
  const [rulesOpen, setRulesOpen] = useState(false);
  const account = useAuthStore(state => state.user?.id ?? 'guest');
  const confirmGuidance = React.useMemo(() => beginGuidanceAction(account, 'progress.levels', 'link:explainer'), [account, visible]);
  React.useEffect(() => {
    if (!visible) return;
    confirmGuidance(true);
    discoverGuidance(account, 'progress.levels');
  }, [account, visible, confirmGuidance]);

  const established = typeof strength === 'number' && Number.isFinite(strength);
  const value = established ? Math.min(100, Math.max(0, Math.round(strength as number))) : null;
  const progress = value !== null ? getLevelProgress(value) : null;

  return (
    <V2SheetModal visible={visible} onClose={onClose} reduceMotion={reduceMotion} scrimAccessibilityLabel="Close" testID={testID}>
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[3]) + V2_SHEET_SKIRT }]} accessibilityViewIsModal>
        <V2SheetGrabZone>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>{THREAD_STRENGTH_EXPLAINER_COPY.title}</Text>
        </V2SheetGrabZone>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body} testID={`${testID}-scroll`}>
          {value !== null && progress ? (
            <View style={styles.current} testID={`${testID}-current`}>
              <Text style={styles.currentValue}>{value}</Text>
              <View style={styles.currentCopy}>
                <Text style={[styles.currentLevel, { color: accentColor }]}>{progress.level.toUpperCase()}</Text>
                <Text style={styles.caption}>
                  {progress.nextLevel && progress.pointsToNext !== null
                    ? `${progress.pointsToNext} ${progress.pointsToNext === 1 ? 'point' : 'points'} to ${progress.nextLevel}`
                    : 'The highest level'}
                </Text>
              </View>
            </View>
          ) : null}

          {THREAD_STRENGTH_EXPLAINER_COPY.summary.map(line => (
            <Text key={line} style={styles.paragraph}>{line}</Text>
          ))}

          <Text style={styles.sectionLabel}>The five levels</Text>
          <View style={styles.levels} testID={`${testID}-levels`}>
            {THREAD_STRENGTH_LEVELS.map(item => {
              const active = progress?.level === item.level;
              return (
                <View key={item.level} style={[styles.levelRow, active && { borderColor: accentColor }]} accessibilityState={{ selected: active }}>
                  <Text style={[styles.levelName, active && { color: accentColor }]}>{item.level}</Text>
                  <Text style={styles.levelRange}>{item.minStrength}–{item.maxStrength}</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>How it grows</Text>
          {THREAD_STRENGTH_EXPLAINER_COPY.growth.map(line => (
            <Text key={line} style={styles.paragraph}>{line}</Text>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: rulesOpen }}
            onPress={() => setRulesOpen(open => !open)}
            hitSlop={{ top: 8, bottom: 8 }}
            style={styles.toggle}
            testID={`${testID}-rules-toggle`}
          >
            <Text style={styles.toggleText}>{rulesOpen ? 'Hide the exact numbers' : 'See the exact numbers'}</Text>
          </Pressable>
          {rulesOpen ? (
            <View style={styles.rules} testID={`${testID}-rules`}>
              <Text style={styles.rule}>First completed practice on an Anchor: +{RULES.activationBonus} bonus, once only.</Text>
              <Text style={styles.rule}>First completed practice each day: +{RULES.dailyReturnBonus}.</Text>
              <Text style={styles.rule}>Each eligible minute: +{RULES.pointsPerMinute}.</Text>
              <Text style={styles.rule}>Daily credited time: up to {RULES.dailyDurationCapMinutes} minutes.</Text>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>Time away</Text>
          <Text style={styles.paragraph} testID={`${testID}-decay`}>
            <Text style={styles.strong}>{THREAD_STRENGTH_SENSITIVITY_LABEL[sensitivity]}. </Text>
            {THREAD_STRENGTH_DECAY_COPY[sensitivity]}
          </Text>
          <Text style={styles.caption}>Your rest days never count as time away. Returning to practice picks your thread back up.</Text>

          <Text style={[styles.caption, styles.disclaimer]}>{THREAD_STRENGTH_EXPLAINER_COPY.disclaimer}</Text>
        </ScrollView>
      </View>
    </V2SheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    marginBottom: -V2_SHEET_SKIRT,
    flexShrink: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: Platform.OS === 'android' ? 12 : 0,
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 99, backgroundColor: colors.border.default, marginBottom: 14 },
  title: { fontFamily: 'EBGaramond-Medium', fontSize: 26, lineHeight: 31, color: colors.text.primary, textAlign: 'center', marginBottom: spacing[3] },
  body: { gap: spacing[3], paddingBottom: spacing[3] },
  current: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  currentValue: { fontFamily: 'EBGaramond-Medium', fontSize: 44, lineHeight: 48, color: colors.text.primary },
  currentCopy: { flex: 1, gap: 2 },
  currentLevel: { ...typography.labelSM },
  paragraph: { ...typography.bodyMD, color: colors.text.primary },
  caption: { ...typography.caption, color: colors.text.secondary },
  strong: { fontFamily: typography.labelMD.fontFamily },
  sectionLabel: { ...typography.labelSM, color: colors.text.secondary, marginTop: spacing[2] },
  levels: { gap: spacing[1] },
  levelRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    borderRadius: radii.md,
    backgroundColor: colors.grouped,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  levelName: { ...typography.labelMD, color: colors.text.primary },
  levelRange: { ...typography.bodySM, color: colors.text.secondary },
  toggle: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  toggleText: { ...typography.bodySM, color: colors.text.secondary, textDecorationLine: 'underline' },
  rules: { gap: spacing[1], paddingLeft: spacing[3] },
  rule: { ...typography.bodySM, color: colors.text.primary },
  disclaimer: { marginTop: spacing[2] },
});
