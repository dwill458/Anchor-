import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import type { ReflectionStructuredContent } from '@/types/chart';

export const StructuredCompletionFields: React.FC<{
  value: ReflectionStructuredContent;
  onChange: (value: ReflectionStructuredContent) => void;
}> = ({ value, onChange }) => (
  <View style={styles.wrap}>
    <Field label="What helped" value={value.whatHelped ?? ''} onChangeText={(whatHelped) => onChange({ ...value, whatHelped })} />
    <Field label="What I learned" value={value.whatLearned ?? ''} onChangeText={(whatLearned) => onChange({ ...value, whatLearned })} />
  </View>
);

const Field: React.FC<{ label: string; value: string; onChangeText: (text: string) => void }> = ({ label, value, onChangeText }) => (
  <View>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      multiline
      maxLength={1000}
      accessibilityLabel={label}
      style={styles.input}
      textAlignVertical="top"
    />
    {value.length >= 850 ? <Text accessibilityLiveRegion="polite" style={styles.count}>{value.length}/1000</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  label: { ...typography.bodyBold, color: colors.text.primary, marginBottom: spacing.xs },
  input: { minHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 14, padding: spacing.md, ...typography.body, color: colors.text.primary },
  count: { ...typography.caption, color: colors.text.secondary, textAlign: 'right', marginTop: 3 },
});
