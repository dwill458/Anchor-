import React, { memo, useCallback } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { ArrowUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AnimatedPressable, usePressScale } from '@/components/v2/motion';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { safeHaptics } from '@/utils/haptics';
import { colors, radii, spacing } from '@/theme/v2';
import { chartTypography as typography } from '../chartTypography';
import type { AskAccent } from './askChartTheme';

const COPY = CHART_COPY.ask;
const MAX_LENGTH = 1000;

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  accent: AskAccent;
  /** Attach (Phase 4) sits before the field and the microphone after it. Absent means the capability is not offered. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** A photo is attached, so sending is allowed without text. */
  canSendEmpty?: boolean;
  /** Sending is paused (a photo is still uploading, or one failed). The reason is shown by the parent. */
  blocked?: boolean;
  placeholder?: string;
  editable?: boolean;
  testID?: string;
};

/**
 * The floating composer. It never changes height until the text needs a second line, never disappears under the
 * keyboard (the parent lifts it), and its send control answers the touch immediately.
 */
export const AskComposer = memo(function AskComposer({ value, onChangeText, onSend, accent, leading, trailing, canSendEmpty = false, blocked = false, placeholder, editable = true, testID }: Props) {
  const press = usePressScale();
  const ready = (value.trim().length > 0 || canSendEmpty) && editable && !blocked;
  const send = useCallback(() => {
    if (!ready) return;
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    onSend();
  }, [onSend, ready]);
  return (
    <View style={styles.row} testID={testID ?? 'ask-composer'}>
      {leading}
      <View style={[styles.field, { borderColor: accent.border }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? COPY.placeholder}
          placeholderTextColor={colors.text.tertiary}
          style={styles.input}
          multiline
          maxLength={MAX_LENGTH}
          editable={editable}
          accessibilityLabel={COPY.placeholder}
          textAlignVertical="center"
          returnKeyType="default"
          blurOnSubmit={false}
          testID="ask-input"
        />
        {trailing}
      </View>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={COPY.send}
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        onPress={send}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[styles.send, { backgroundColor: accent.fill, opacity: ready ? 1 : 0.38 }, press.style]}
        testID="ask-send"
      >
        <ArrowUp size={20} color={accent.onFill} strokeWidth={2.4} />
      </AnimatedPressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], paddingHorizontal: spacing[4] },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingLeft: spacing[4],
    paddingRight: spacing[2],
    borderRadius: radii.pill,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, ...typography.bodyLG, color: colors.text.primary, maxHeight: 120, paddingTop: 10, paddingBottom: 10 },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
