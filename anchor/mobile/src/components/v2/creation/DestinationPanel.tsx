import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { V2Button } from '@/components/v2';
import { V2InlineError } from '@/components/v2/feedback/V2Feedback';
import { DESTINATION_COPY, DESTINATION_EXAMPLES } from '@/constants/v2/creation';
import { colors, spacing, typography } from '@/theme/v2';

/**
 * Destination: the future state the intention points at. The text becomes the Anchor's
 * Vision description, so the Vision screen later opens already knowing where this is going.
 */
export function DestinationPanel({
  intention,
  category,
  value,
  saving,
  error,
  onChange,
  onSubmit,
  onSkip,
}: {
  intention: string;
  category?: string | null;
  value: string;
  saving: boolean;
  error: boolean;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const ready = value.trim().length >= DESTINATION_COPY.minLength;
  const example = DESTINATION_EXAMPLES[(category ?? 'custom').toLowerCase()] ?? DESTINATION_EXAMPLES.custom;

  return (
    <View style={styles.root} testID="destination-panel">
      <View style={styles.from}>
        <Text style={styles.label}>{DESTINATION_COPY.fromLabel}</Text>
        <Text style={styles.intention} numberOfLines={2}>“{intention}”</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{DESTINATION_COPY.fieldLabel}</Text>
        <View style={[styles.surface, focused && styles.surfaceFocused]}>
          <TextInput
            value={value}
            onChangeText={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={example}
            placeholderTextColor={colors.text.disabled}
            multiline
            maxLength={DESTINATION_COPY.maxLength}
            editable={!saving}
            autoCapitalize="sentences"
            selectionColor={colors.text.primary}
            style={styles.input}
            accessibilityLabel="Picture this: what getting there looks like"
            accessibilityHint={DESTINATION_COPY.guidance}
            testID="destination-input"
          />
        </View>
        {!focused && !value ? <Text style={styles.guidance}>{DESTINATION_COPY.guidance}</Text> : null}
      </View>

      {error ? <V2InlineError message={DESTINATION_COPY.error} onRetry={onSubmit} /> : null}

      <V2Button
        size="large"
        style={styles.cta}
        disabled={!ready}
        loading={saving}
        onPress={onSubmit}
        accessibilityLabel={DESTINATION_COPY.cta}
        testID="destination-submit"
      >
        {DESTINATION_COPY.cta}
      </V2Button>
      <Pressable
        onPress={onSkip}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel="Skip the destination for now"
        hitSlop={10}
        style={styles.skip}
        testID="destination-skip"
      >
        <Text style={styles.skipText}>{DESTINATION_COPY.skip}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[4] },
  from: { gap: 4 },
  label: { ...typography.labelSM, color: colors.text.secondary },
  intention: { fontFamily: 'EBGaramond-Medium', fontSize: 18, lineHeight: 23, color: colors.text.primary },
  field: { gap: spacing[2] },
  surface: {
    minHeight: 92,
    maxHeight: 140,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  surfaceFocused: { borderColor: colors.border.default },
  input: {
    fontFamily: typography.body,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text.primary,
    minHeight: 68,
    textAlignVertical: 'top',
    padding: 0,
  },
  guidance: { ...typography.caption, color: colors.text.secondary },
  cta: { height: 56, borderRadius: 16 },
  skip: { alignSelf: 'center', paddingVertical: spacing[1] },
  skipText: { ...typography.labelMD, color: colors.text.secondary },
});
