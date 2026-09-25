import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { ArrowRight } from 'lucide-react-native';
import {
  CHART_COPY,
  CHART_THOUGHT_STARTERS,
  chartRealityGuide,
  type ChartThoughtStarter,
} from '@/constants/v2/chartCopy';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { ChartInkButton, ChartTextArea } from './ChartChrome';
import { ChartKeyboardFrame } from './ChartKeyboardFrame';
import { CHART_EASING, chartTiming } from './chartMotion';

type Props = {
  intention: string;
  category?: string | null;
  value: string;
  onChangeText: (value: string) => void;
  onContinue: () => void;
  /** Rendered above the question (the Vision card, when there is one). */
  header?: React.ReactNode;
  reducedMotion: boolean;
  minLength?: number;
  testID?: string;
};

/**
 * "What would make this real?" — the one question Chart asks.
 *
 * ABSTRACT INTENTION → OBSERVABLE REALITY → destination → waypoints → One Move.
 * The person describes what would be true in the world; they are not asked to
 * plan. The example and the thought-starter hints are chosen from their own
 * intention, and never write into the field.
 */
export function ChartRealityInput({
  intention,
  category,
  value,
  onChangeText,
  onContinue,
  header,
  reducedMotion,
  minLength = 3,
  testID,
}: Props) {
  const guide = useMemo(() => chartRealityGuide(intention, category), [category, intention]);
  const [starter, setStarter] = useState<ChartThoughtStarter | null>(null);
  const hintOpacity = useSharedValue(0);

  const toggleStarter = (key: ChartThoughtStarter) => {
    const next = starter === key ? null : key;
    setStarter(next);
    if (next) {
      hintOpacity.value = 0;
      hintOpacity.value = reducedMotion ? 1 : chartTiming(1, { duration: 280, easing: CHART_EASING.settle });
    }
  };
  const hintStyle = useAnimatedStyle(() => ({ opacity: hintOpacity.value }));
  const canContinue = value.trim().length >= minLength;

  return (
    <ChartKeyboardFrame
      testID={testID}
      contentContainerStyle={styles.scroll}
      footerStyle={styles.footer}
      footer={
        <ChartInkButton
          label={CHART_COPY.creation.continue}
          variant={canContinue ? 'primary' : 'outline'}
          disabled={!canContinue}
          onPress={onContinue}
          icon={<ArrowRight size={18} color={canContinue ? colors.text.primary : colors.ink.text.primary} />}
          testID="chart-context-continue"
        />
      }
    >
      {header}
      <View style={styles.section} testID="chart-starting-context">
        <Text accessibilityRole="header" style={styles.question}>
          {CHART_COPY.creation.realQuestion}
        </Text>
        <Text style={styles.support}>{CHART_COPY.creation.realSupport}</Text>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>{CHART_COPY.creation.realLabel}</Text>
          <ChartTextArea
            value={value}
            onChangeText={onChangeText}
            placeholder={`${CHART_COPY.creation.examplePrefix}${guide.example}`}
            maxLength={500}
            minHeight={112}
            maxHeight={196}
            accessibilityLabel={CHART_COPY.creation.realLabel}
            testID="chart-starting-input"
          />
        </View>

        <View style={styles.starters}>
          {CHART_THOUGHT_STARTERS.map((item) => {
            const active = starter === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityHint="Shows a prompt to help you think. It doesn’t change what you’ve written."
                accessibilityState={{ expanded: active }}
                onPress={() => toggleStarter(item.key)}
                hitSlop={{ top: 6, bottom: 6 }}
                style={({ pressed }) => [styles.starter, active && styles.starterActive, pressed && styles.pressed]}
                testID={`chart-starter-${item.key}`}
              >
                <Text style={[styles.starterText, active && styles.starterTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {starter ? (
          <Animated.View style={[styles.hint, hintStyle]} accessibilityLiveRegion="polite" testID="chart-starter-hint">
            <Text style={styles.hintText}>{guide.hints[starter]}</Text>
          </Animated.View>
        ) : null}
      </View>
    </ChartKeyboardFrame>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[6], gap: spacing[6] },
  section: { gap: spacing[3] },
  question: { ...typography.displayMedium, fontSize: 32, lineHeight: 37, color: colors.ink.text.primary },
  support: { ...typography.bodyLG, color: colors.ink.text.secondary },
  fieldBlock: { gap: spacing[2], marginTop: spacing[3] },
  label: { ...typography.labelLG, color: colors.ink.text.primary },
  starters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  starter: {
    minHeight: 32,
    paddingHorizontal: spacing[3],
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink.hairlineStrong,
    justifyContent: 'center',
  },
  starterActive: { borderColor: colors.ink.text.secondary, backgroundColor: colors.ink.raised },
  starterText: { ...typography.labelMD, color: colors.ink.text.secondary },
  starterTextActive: { color: colors.ink.text.primary },
  hint: {
    borderLeftWidth: 2,
    borderLeftColor: colors.ink.hairlineStrong,
    paddingLeft: spacing[3],
    paddingVertical: spacing[1],
  },
  hintText: { ...typography.bodyMD, color: colors.ink.text.secondary },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    backgroundColor: colors.ink.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink.hairline,
  },
  pressed: { opacity: 0.75 },
});
